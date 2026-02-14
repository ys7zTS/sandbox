import express from 'express'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import multer from 'multer'
import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import { dbService } from './core/db'
import { GetMsgPayload, SendMsgPayload } from './core/types'
import { ActionTypes, WSMessage } from './core/protocol'
import { eventBus, Events, MessageSavedEvent } from './core/bus'
import { messageService } from './core/messageService'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })
const port = 3000

// -------------------- Event Bus Listeners --------------------
// 消息广播监听：处理推送给所有在线客户端
eventBus.on(Events.MESSAGE_SAVED, ({ message }: MessageSavedEvent) => {
  broadcast({ type: ActionTypes.PUSH_MESSAGE, data: message })
})

eventBus.on(Events.MESSAGE_RECALLED, ({ type, seq }: any) => {
  broadcast({ type: ActionTypes.RECALL_MESSAGE, data: { type, seq } })
})

app.use(express.json())

// 临时文件目录（图片/文件上传输出位置）
const tempDir = join(process.cwd(), 'temp')
if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true })
// 设置静态目录并确保 mime 类型正确
app.use('/temp', express.static(tempDir, {
  setHeaders: (res, filePath) => {
    const lower = filePath.toLowerCase()
    if (lower.endsWith('.png')) res.setHeader('Content-Type', 'image/png')
    else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg')
    else if (lower.endsWith('.gif')) res.setHeader('Content-Type', 'image/gif')
    else if (lower.endsWith('.mp4')) res.setHeader('Content-Type', 'video/mp4')
    else if (lower.endsWith('.webm')) res.setHeader('Content-Type', 'video/webm')
  }
}))

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir)
  },
  filename: (req, file, cb) => {
    // 修复 Multer 默认将文件名解析为 latin1 导致的中文乱码问题
    // 为确保后续 extension 提取正确，先转换编码
    const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')
    const ext = originalname.includes('.') ? originalname.split('.').pop() : ''
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
const clients = new Map<WebSocket, { userId?: number }>()

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress
  console.log(`[WS] New connection from ${ip}`)
  clients.set(ws, {})

  // 连线后立即推送全量同步信息
  syncClient(ws).catch(err => console.error('[WS] Sync failed:', err))

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
    let type: string | undefined
    let echo: string | undefined
    try {
      const parsed = JSON.parse(message.toString()) as WSMessage
      type = parsed.type
      echo = parsed.echo
      const data = parsed.data

      const session = clients.get(ws)!
      let result: any = null

      switch (type) {
        case ActionTypes.HEARTBEAT:
          ws.send(JSON.stringify({ type: ActionTypes.HEARTBEAT, data: 'pong', echo }))
          return

        case ActionTypes.GET_USER_INFO:
          if (data?.target === 'current') {
            result = session.userId
              ? dbService.getUserInfo(session.userId)
              : { userId: 0, nickname: '访客', age: 0, gender: 'unknown', friendList: [], groupList: [], isCurrent: 0 }
          } else {
            result = dbService.getUserInfo(parseTarget(data?.target))
          }
          break

        case ActionTypes.SAVE_USER: {
          const nickname = data.nickname?.trim() || `用户 ${data.userId}`
          dbService.saveUser({
            ...data,
            nickname,
            userId: Number(data.userId),
            age: data.age ? Number(data.age) : undefined,
            isCurrent: 0
          })
          result = { status: 'ok' }
          break
        }

        case ActionTypes.SET_ACTIVE_USER: {
          const uid = Number(data.userId)
          const exists = dbService.getUserInfo(uid)
          if (uid !== 0 && (!exists || (Array.isArray(exists) && exists.length === 0))) {
            session.userId = 0
          } else {
            session.userId = uid
          }
          // 触发重新同步
          syncClient(ws).catch(() => { })
          result = { status: 'ok' }
          break
        }

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

        case ActionTypes.SAVE_GROUP: {
          const groupName = data.groupName?.trim() || `群聊 ${data.groupId}`
          const groupId = Number(data.groupId)
          const ownerId = data.ownerId ? Number(data.ownerId) : undefined

          dbService.saveGroup({
            ...data,
            groupName,
            groupId,
            ownerId
          })

          // 如果创建群聊时有指定的群主，确保群主在成员列表中
          if (ownerId && ownerId !== 0) {
            const owner = dbService.getUserInfo(ownerId)
            if (owner && !Array.isArray(owner)) {
              dbService.upsertGroupMember(groupId, {
                userId: ownerId,
                nickname: (owner as any).nickname,
                gender: (owner as any).gender,
                age: (owner as any).age,
                role: 'owner',
                joinTime: Math.floor(Date.now() / 1000)
              })
            }
          }

          result = { status: 'ok' }
          break
        }

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
            // 发送系统消息
            const sysMsg = dbService.saveMsg({
              type: 'group',
              senderId: 1,
              targetId: Number(data.groupId),
              content: `@${joinUser.userId} 加入群聊`,
              timestamp: Math.floor(Date.now() / 1000),
              isRevoked: 0
            })
            broadcast({ type: ActionTypes.PUSH_MESSAGE, data: sysMsg })
            // 推送群成员更新事件
            broadcast({ type: ActionTypes.GROUP_MEMBER_UPDATE, data: { groupId: Number(data.groupId) } })
          }
          result = { status: 'ok' }
          break
        }

        case ActionTypes.LEAVE_GROUP: {
          const gid = Number(data.groupId)
          const uid = Number(data.userId)
          const group = dbService.getGroupInfo(gid) as any
          if (group && group.ownerId === uid) {
            // 群主退出，解散群聊，保留消息
            dbService.removeGroup(gid, { clearMessages: false })
          } else {
            dbService.removeGroupMember(gid, uid)
          }
          // 推送群成员更新事件
          broadcast({ type: ActionTypes.GROUP_MEMBER_UPDATE, data: { groupId: gid } })
          result = { status: 'ok' }
          break
        }

        case ActionTypes.SET_GROUP_ADMIN:
          dbService.updateGroupMemberRole(Number(data.groupId), Number(data.userId), data.isAdmin ? 'admin' : 'member')
          broadcast({ type: ActionTypes.GROUP_MEMBER_UPDATE, data: { groupId: Number(data.groupId) } })
          result = { status: 'ok' }
          break

        case ActionTypes.UPDATE_GROUP_MEMBER: {
          const oldMember = (dbService.getGroupInfo(Number(data.groupId)) as any)?.memberList?.find((m: any) => m.userId === Number(data.userId))
          dbService.updateGroupMemberInfo(Number(data.groupId), Number(data.userId), data)
          // 如果头衔发生变化，发送系统消息
          if (data.title !== undefined && data.title !== oldMember?.title) {
            if (data.title) {
              const titleMsg = dbService.saveMsg({
                type: 'group',
                senderId: 1,
                targetId: Number(data.groupId),
                content: `@${data.userId} 获得群主授予的头衔「${data.title}」`,
                timestamp: Math.floor(Date.now() / 1000),
                isRevoked: 0
              })
              broadcast({ type: ActionTypes.PUSH_MESSAGE, data: titleMsg })
            }
          }
          broadcast({ type: ActionTypes.GROUP_MEMBER_UPDATE, data: { groupId: Number(data.groupId) } })
          result = { status: 'ok' }
          break
        }

        case ActionTypes.TRANSFER_GROUP_OWNER:
          dbService.transferGroupOwner(Number(data.groupId), Number(data.userId))
          // 发送系统消息
          const transferMsg = dbService.saveMsg({
            type: 'group',
            senderId: 1,
            targetId: Number(data.groupId),
            content: `群主已转让给 @${data.userId}`,
            timestamp: Math.floor(Date.now() / 1000),
            isRevoked: 0
          })
          broadcast({ type: ActionTypes.PUSH_MESSAGE, data: transferMsg })
          broadcast({ type: ActionTypes.GROUP_MEMBER_UPDATE, data: { groupId: Number(data.groupId) } })
          result = { status: 'ok' }
          break

        case ActionTypes.GET_MESSAGES: {
          const session = clients.get(ws)!
          const activeId = session.userId ?? (dbService.getUserInfo('current') as any)?.userId
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
          const session = clients.get(ws)!
          const curActiveId = session.userId ?? (dbService.getUserInfo('current') as any)?.userId
          const senderId = sendPayload.senderId ?? curActiveId
          if (!senderId) throw new Error('sender not resolved')

          const saved = await messageService.sendMessage({
            type: sendPayload.type,
            senderId: Number(senderId),
            targetId: Number(sendPayload.targetId),
            content: sendPayload.content
          })

          result = { seq: saved.seq, timestamp: saved.timestamp }
          break
        }

        case ActionTypes.SET_READ: {
          const session = clients.get(ws)!
          const curActiveId = session.userId ?? (dbService.getUserInfo('current') as any)?.userId
          if (curActiveId) {
            dbService.updateReadState(curActiveId, data.type, Number(data.targetId), Number(data.seq))
          }
          result = { status: 'ok' }
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
  clients.forEach((_, client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload)
    }
  })
}

async function syncClient (ws: WebSocket) {
  const session = clients.get(ws)
  let me = (session?.userId ? dbService.getUserInfo(session.userId) : null) as any

  if (!me) {
    if (session) session.userId = 0
    me = { userId: 0, nickname: '访客', age: 0, gender: 'unknown', friendList: [], groupList: [], isCurrent: 0 }
  }

  const friends = dbService.getUserInfo('all') as any[]
  const groups = dbService.getGroupInfo('all') as any[]

  const contacts = [
    ...friends.filter(f => f.userId !== me.userId).map(f => ({ ...f, type: 'private' })),
    ...groups.map(g => ({ ...g, type: 'group' }))
  ]

  const syncData = {
    me,
    contacts: contacts.map(c => {
      const scene = c.type as 'private' | 'group'
      const targetId = scene === 'private' ? c.userId : c.groupId
      const lastReadSeq = dbService.getReadState(me.userId, scene, targetId)

      // 获取最后一条消息及其 seq
      const msgs = dbService.getMsg({ type: scene, targetId, selfId: me.userId, limit: 1 })
      const lastMsg = msgs[0]

      return {
        ...c,
        lastReadSeq,
        lastMsg: lastMsg || null,
        unreadCount: lastMsg ? Math.max(0, lastMsg.seq - lastReadSeq) : 0
      }
    })
  }

  ws.send(JSON.stringify({ type: ActionTypes.SYNC_ALL, data: syncData }))
}

// -------------------- 文件上传 --------------------
app.post('/api/upload', uploader.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' })

  // 再次确保文件名编码正确（双重保险）
  const filename = Buffer.from(req.file.originalname, 'latin1').toString('utf8')

  const publicUrl = `/temp/${req.file.filename}`
  res.json({
    url: publicUrl,
    filename,
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
