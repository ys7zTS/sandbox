import express from 'express'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import multer from 'multer'
import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import { dbService } from './core/db'
import { GetMsgPayload, SendMsgPayload } from './core/types'
import { ActionTypes, WSMessage } from './core/protocol'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })
const port = 3000

app.use(express.json())

// 临时文件目录（图片/文件上传输出位置）
const tempDir = join(process.cwd(), 'temp')
if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true })
// 设置静态目录并确保 mime 类型正确
app.use('/temp', express.static(tempDir, {
  setHeaders: (res, path) => {
    if (path.endsWith('.png')) res.setHeader('Content-Type', 'image/png')
    else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg')
    else if (path.endsWith('.gif')) res.setHeader('Content-Type', 'image/gif')
  }
}))

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir)
  },
  filename: (req, file, cb) => {
    const ext = file.originalname.includes('.') ? file.originalname.split('.').pop() : ''
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, `${uniqueSuffix}${ext ? '.' + ext : ''}`)
  }
})
const uploader = multer({ storage })

// 实例化 OneBot V11 适配器（保留可选启用）
// const ob11 = new OneBotV11Adapter(3001)
// ob11.start()

const parseTarget = (value: any) => {
  if (!value) return 'all'
  if (value === 'current' || value === 'all') return value
  const num = Number(value)
  return Number.isNaN(num) ? 'all' : num
}

// -------------------- WebSocket 逻辑 --------------------
const clients = new Set<WebSocket>()

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress
  console.log(`[WS] New connection from ${ip}`)
  clients.add(ws)

  let isAlive = true
  ws.on('pong', () => { isAlive = true })

  const heartbeatInterval = setInterval(() => {
    if (!isAlive) {
      console.log('[WS] Connection timeout, closing')
      ws.terminate()
      return
    }
    isAlive = false
    ws.ping()
  }, 30000)

  ws.on('message', async (message) => {
    try {
      const { type, data, echo } = JSON.parse(message.toString()) as WSMessage
      let result: any = null

      switch (type) {
        case ActionTypes.HEARTBEAT:
          ws.send(JSON.stringify({ type: ActionTypes.HEARTBEAT, data: 'pong', echo }))
          return

        case ActionTypes.GET_USER_INFO:
          result = dbService.getUserInfo(parseTarget(data?.target))
          break

        case ActionTypes.SAVE_USER: {
          const hasCurrent = !!dbService.getUserInfo('current')
          const nickname = data.nickname?.trim() || `用户 ${data.userId}`
          dbService.saveUser({
            ...data,
            nickname,
            userId: Number(data.userId),
            age: data.age ? Number(data.age) : undefined,
            isCurrent: data.isCurrent !== undefined ? !!data.isCurrent : !hasCurrent
          })
          result = { status: 'ok' }
          break
        }

        case ActionTypes.SET_ACTIVE_USER:
          dbService.setActiveUser(Number(data.userId))
          result = { status: 'ok' }
          break

        case ActionTypes.REMOVE_USER:
          dbService.removeUser(Number(data.userId), { clearMessages: !!data.clearMessages })
          result = { status: 'ok' }
          break

        case ActionTypes.UPDATE_FRIENDSHIP: {
          const { userAId, userBId, action, clearMessages } = data
          const a = Number(userAId)
          const b = Number(userBId)
          dbService.updateFriendship(a, b, action)
          if (action === 'remove' && clearMessages) {
            dbService.clearPrivateConversation(a, b)
          }
          result = { status: 'ok' }
          break
        }

        case ActionTypes.GET_GROUP_INFO:
          result = dbService.getGroupInfo(parseTarget(data?.target))
          break

        case ActionTypes.SAVE_GROUP:
          const groupName = data.groupName?.trim() || `群聊 ${data.groupId}`
          dbService.saveGroup({
            ...data,
            groupName,
            groupId: Number(data.groupId),
            ownerId: data.ownerId ? Number(data.ownerId) : undefined,
          })
          result = { status: 'ok' }
          break

        case ActionTypes.REMOVE_GROUP:
          dbService.removeGroup(Number(data.groupId), { clearMessages: !!data.clearMessages })
          result = { status: 'ok' }
          break

        case ActionTypes.JOIN_GROUP: {
          const joinUser = dbService.getUserInfo(Number(data.userId))
          if (joinUser && !Array.isArray(joinUser)) {
            dbService.upsertGroupMember(Number(data.groupId), {
              userId: Number(joinUser.userId),
              nickname: (joinUser as any).nickname || '',
              gender: (joinUser as any).gender || 'unknown',
              age: (joinUser as any).age || 0,
              role: 'member',
              joinTime: Math.floor(Date.now() / 1000)
            })
          }
          result = { status: 'ok' }
          break
        }

        case ActionTypes.LEAVE_GROUP:
          dbService.removeGroupMember(Number(data.groupId), Number(data.userId))
          result = { status: 'ok' }
          break

        case ActionTypes.GET_MESSAGES: {
          const active = dbService.getUserInfo('current')
          const activeId = !active || Array.isArray(active) ? undefined : active.userId
          result = dbService.getMsg({
            type: data.type,
            targetId: Number(data.targetId),
            limit: data.limit,
            selfId: activeId
          })
          break
        }

        case ActionTypes.SEND_MESSAGE: {
          const sendPayload = data as SendMsgPayload
          const curActive = dbService.getUserInfo('current')
          const curActiveId = !curActive || Array.isArray(curActive) ? undefined : curActive.userId
          const senderId = sendPayload.senderId ?? curActiveId
          if (!senderId) throw new Error('sender not resolved')

          const saved = dbService.saveMsg({
            type: sendPayload.type,
            senderId: Number(senderId),
            targetId: Number(sendPayload.targetId),
            content: sendPayload.content,
            timestamp: Math.floor(Date.now() / 1000),
            isRevoked: 0
          })
          result = { seq: saved.seq, timestamp: saved.timestamp }

          // 广播新消息
          broadcast({ type: ActionTypes.PUSH_MESSAGE, data: saved })
          break
        }

        case ActionTypes.RECALL_MESSAGE:
          dbService.recallMsg(data.type, Number(data.seq))
          result = { status: 'ok' }
          break

        case ActionTypes.ACK:
          // 仅作为占位
          break

        default:
          console.warn('[WS] Unknown action type:', type)
      }

      // ... handle messages ... (existing cases)

      if (echo && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, data: result, echo }))
      }
    } catch (err: any) {
      console.error('[WS] Error handling message:', err)
      if (echo && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, data: { error: err.message || 'Internal Error' }, echo }))
      }
    }
  })

  ws.on('close', () => {
    console.log('[WS] Connection closed')
    clients.delete(ws)
    clearInterval(heartbeatInterval)
  })
})

function broadcast (msg: WSMessage) {
  const payload = JSON.stringify(msg)
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload)
    }
  })
}

// -------------------- 文件上传 --------------------
app.post('/api/upload', uploader.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' })
  const publicUrl = `/temp/${req.file.filename}`
  res.json({
    url: publicUrl,
    filename: req.file.originalname,
    size: req.file.size,
    mime: req.file.mimetype
  })
})

// -------------------- 前端静态资源 --------------------
const distPath = join(process.cwd(), 'dist')
app.use('/sandbox', express.static(distPath))

app.get('/sandbox/*splat', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/temp/')) return
  res.sendFile(join(distPath, 'index.html'))
})

app.get('/', (req, res) => {
  res.redirect('/sandbox')
})

server.listen(port, () => {
  console.log(`Sandbox Manager running at http://localhost:${port}`)
  console.log(`Sandbox UI available at http://localhost:${port}/sandbox`)
})
