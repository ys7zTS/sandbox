import express from 'express'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import multer from 'multer'
import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import { dbService } from './core/db'
import { SendMsgPayload, UnifiedUser, UnifiedGroup, GroupMemberInfo } from './core/types'
import { ActionTypes, WSMessage, WSOPType } from './core/protocol'
import { eventBus, Events, MessageSavedEvent } from './core/bus'
import { messageService } from './core/messageService'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })
const port = 3000

// -------------------- Event Bus Listeners --------------------
// 消息广播监听：处理推送给相关在线客户端
eventBus.on(Events.MESSAGE_SAVED, ({ message }: MessageSavedEvent) => {
  if (message.type === 'private') {
    // 私聊消息：仅发送给发送者和接收者
    sendToUsers([message.senderId, message.targetId], { type: ActionTypes.PUSH_MESSAGE, data: message })
  } else {
    // 群聊消息：发送给群内在线成员
    const group = dbService.getGroupInfo(message.targetId) as UnifiedGroup | undefined
    if (group && group.memberList) {
      const memberIds = group.memberList.map((m: GroupMemberInfo) => m.userId)
      sendToUsers(memberIds, { type: ActionTypes.PUSH_MESSAGE, data: message })
    }
  }
})

eventBus.on(Events.MESSAGE_RECALLED, ({ type, seq, message }: any) => {
  if (type === 'private') {
    const targetId = message ? (message.senderId === message.targetId ? message.senderId : [message.senderId, message.targetId]) : undefined
    const users = Array.isArray(targetId) ? targetId : (targetId ? [targetId] : [])
    sendToUsers(users, {
      type: ActionTypes.RECALL,
      data: { type, seq, targetId: message?.senderId }
    })
  } else {
    const group = dbService.getGroupInfo(message.targetId) as UnifiedGroup | undefined
    if (group && group.memberList) {
      const memberIds = group.memberList.map((m: GroupMemberInfo) => m.userId)
      sendToUsers(memberIds, {
        type: ActionTypes.RECALL,
        data: { type, seq, targetId: message.targetId }
      })
    }
  }
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
    let type: WSOPType | undefined
    let echo: string | undefined
    try {
      const parsed = JSON.parse(message.toString()) as WSMessage
      type = parsed.type
      echo = parsed.echo
      const data = parsed.data as any // We will cast locally for better types

      const session = clients.get(ws)!
      let result: any = null

      switch (type) {
        case ActionTypes.HEARTBEAT:
          ws.send(JSON.stringify({ type: ActionTypes.HEARTBEAT, data: 'pong', echo }))
          return

        case ActionTypes.GET_USER_INFO: {
          const target = (data as { target?: any, userId?: any })?.target || (data as { target?: any, userId?: any })?.userId
          if (target === 'current') {
            result = session.userId
              ? dbService.getUserInfo(session.userId)
              : { userId: 0, nickname: '访客', age: 0, gender: 'unknown', friendList: [], groupList: [] }
          } else {
            result = dbService.getUserInfo(parseTarget(target))
          }
          break
        }

        case ActionTypes.SAVE_USER: {
          const payload = data as UnifiedUser
          const nickname = payload.nickname?.trim() || `用户 ${payload.userId}`
          dbService.saveUser({
            ...payload,
            nickname,
            userId: Number(payload.userId),
            age: payload.age ? Number(payload.age) : undefined
          })
          // 触发所有连接的同步以更新联系人列表
          broadcastSync()
          result = { status: 'ok' }
          break
        }

        case ActionTypes.SET_ACTIVE_USER: {
          const payload = data as { userId: any }
          const uid = Number(payload.userId)
          const exists = dbService.getUserInfo(uid)
          if (uid !== 0 && (!exists || (Array.isArray(exists) && exists.length === 0))) {
            session.userId = 0
          } else {
            session.userId = uid
          }
          // 触发当前连接的同步
          syncClient(ws).catch(() => { })
          result = { status: 'ok', userId: session.userId }
          break
        }

        case ActionTypes.REMOVE_USER: {
          const payload = data as { userId: any, clearMessages?: boolean }
          dbService.removeUser(Number(payload.userId), { clearMessages: !!payload.clearMessages })
          broadcastSync()
          result = { status: 'ok' }
          break
        }

        case ActionTypes.UPDATE_FRIENDSHIP: {
          const { userAId, userBId, action, clearMessages } = data as { userAId: any, userBId: any, action: 'add' | 'remove', clearMessages?: boolean }
          const a = Number(userAId)
          const b = Number(userBId)
          dbService.updateFriendship(a, b, action)
          if (action === 'remove' && clearMessages) {
            dbService.clearPrivateConversation(a, b)
          }
          result = { status: 'ok' }
          break
        }

        case ActionTypes.GET_GROUP_INFO: {
          const payload = data as { target?: any, groupId?: any }
          const target = payload?.target || payload?.groupId
          result = dbService.getGroupInfo(parseTarget(target))
          break
        }

        case ActionTypes.SAVE_GROUP: {
          const payload = data as UnifiedGroup
          const groupName = payload.groupName?.trim() || `群聊 ${payload.groupId}`
          const groupId = Number(payload.groupId)
          const ownerId = payload.ownerId ? Number(payload.ownerId) : undefined

          dbService.saveGroup({
            ...payload,
            groupName,
            groupId,
            ownerId
          })

          // 如果创建群聊时有指定的群主，确保群主在成员列表中
          if (ownerId && ownerId !== 0) {
            const owner = dbService.getUserInfo(ownerId) as UnifiedUser | undefined
            if (owner && !Array.isArray(owner)) {
              dbService.upsertGroupMember(groupId, {
                userId: ownerId,
                nickname: owner.nickname,
                gender: owner.gender,
                age: owner.age,
                role: 'owner',
                joinTime: Math.floor(Date.now() / 1000)
              })
            }
          }

          // 触发全端同步
          broadcastSync()
          result = { status: 'ok' }
          break
        }

        case ActionTypes.REMOVE_GROUP: {
          const payload = data as { groupId: any, clearMessages?: boolean }
          dbService.removeGroup(Number(payload.groupId), { clearMessages: !!payload.clearMessages })
          broadcastSync()
          result = { status: 'ok' }
          break
        }

        case ActionTypes.JOIN_GROUP: {
          const payload = data as { userId: any, groupId: any }
          const joinUser = dbService.getUserInfo(Number(payload.userId)) as UnifiedUser | undefined
          if (joinUser && !Array.isArray(joinUser)) {
            dbService.upsertGroupMember(Number(payload.groupId), {
              userId: Number(joinUser.userId),
              nickname: joinUser.nickname || '',
              gender: joinUser.gender || 'unknown',
              age: joinUser.age || 0,
              role: 'member',
              joinTime: Math.floor(Date.now() / 1000)
            })
            // 发送系统消息
            const sysMsg = dbService.saveMsg({
              type: 'group',
              senderId: 1,
              targetId: Number(payload.groupId),
              content: [{ type: 'text', text: `@${joinUser.userId} 加入群聊` }],
              timestamp: Math.floor(Date.now() / 1000),
              isRevoked: 0
            })
            // 推送给群成员
            const group = dbService.getGroupInfo(Number(payload.groupId)) as UnifiedGroup | undefined
            if (group && group.memberList) {
              const ids = group.memberList.map((m) => m.userId)
              sendToUsers(ids, { type: ActionTypes.PUSH_MESSAGE, data: sysMsg })
              sendToUsers(ids, { type: ActionTypes.GROUP_MEMBER_UPDATE, data: { groupId: Number(payload.groupId) } })
            }
          }
          result = { status: 'ok' }
          break
        }

        case ActionTypes.LEAVE_GROUP: {
          const payload = data as { userId: any, groupId: any }
          const gid = Number(payload.groupId)
          const uid = Number(payload.userId)
          const group = dbService.getGroupInfo(gid) as UnifiedGroup | undefined
          if (group && group.ownerId === uid) {
            // 群主退出，解散群聊，保留消息
            dbService.removeGroup(gid, { clearMessages: false })
          } else {
            dbService.removeGroupMember(gid, uid)
          }
          // 推送群成员更新事件
          if (group && group.memberList) {
            sendToUsers(group.memberList.map((m) => m.userId), { type: ActionTypes.GROUP_MEMBER_UPDATE, data: { groupId: gid } })
          }
          result = { status: 'ok' }
          break
        }

        case ActionTypes.SET_GROUP_ADMIN: {
          const payload = data as { userId: any, groupId: any, isAdmin: boolean }
          const gid = Number(payload.groupId)
          dbService.updateGroupMemberRole(gid, Number(payload.userId), payload.isAdmin ? 'admin' : 'member')
          const group = dbService.getGroupInfo(gid) as UnifiedGroup | undefined
          if (group && group.memberList) {
            sendToUsers(group.memberList.map((m) => m.userId), { type: ActionTypes.GROUP_MEMBER_UPDATE, data: { groupId: gid } })
          }
          result = { status: 'ok' }
          break
        }

        case ActionTypes.UPDATE_GROUP_MEMBER: {
          const payload = data as GroupMemberInfo & { groupId: any }
          const gid = Number(payload.groupId)
          const group = dbService.getGroupInfo(gid) as UnifiedGroup | undefined
          const oldMember = group?.memberList?.find((m: any) => m.userId === Number(payload.userId))
          dbService.updateGroupMemberInfo(gid, Number(payload.userId), payload)

          if (group && group.memberList) {
            const ids = group.memberList.map((m: any) => m.userId)
            // 如果头衔发生变化，发送系统消息
            if (payload.title !== undefined && payload.title !== oldMember?.title) {
              if (payload.title) {
                const titleMsg = dbService.saveMsg({
                  type: 'group',
                  senderId: 1,
                  targetId: gid,
                  content: [{ type: 'text', text: `@${payload.userId} 获得群主授予的头衔「${payload.title}」` }],
                  timestamp: Math.floor(Date.now() / 1000),
                  isRevoked: 0
                })
                sendToUsers(ids, { type: ActionTypes.PUSH_MESSAGE, data: titleMsg })
              }
            }
            sendToUsers(ids, { type: ActionTypes.GROUP_MEMBER_UPDATE, data: { groupId: gid } })
          }
          result = { status: 'ok' }
          break
        }

        case ActionTypes.TRANSFER_GROUP_OWNER: {
          const payload = data as { groupId: any, userId: any }
          const gid = Number(payload.groupId)
          dbService.transferGroupOwner(gid, Number(payload.userId))
          const group = dbService.getGroupInfo(gid) as UnifiedGroup | undefined
          if (group && group.memberList) {
            const ids = group.memberList.map((m: any) => m.userId)
            // 发送系统消息
            const transferMsg = dbService.saveMsg({
              type: 'group',
              senderId: 1,
              targetId: gid,
              content: [{ type: 'text', text: `群主已转让给 @${payload.userId}` }],
              timestamp: Math.floor(Date.now() / 1000),
              isRevoked: 0
            })
            sendToUsers(ids, { type: ActionTypes.PUSH_MESSAGE, data: transferMsg })
            sendToUsers(ids, { type: ActionTypes.GROUP_MEMBER_UPDATE, data: { groupId: gid } })
          }
          result = { status: 'ok' }
          break
        }

        case ActionTypes.GET_MESSAGES: {
          const payload = data as { type: 'private' | 'group', targetId: any, limit?: number }
          const session = clients.get(ws)!
          const activeId = session.userId ?? (dbService.getUserInfo('current') as UnifiedUser)?.userId
          result = dbService.getMsg({
            type: payload.type,
            targetId: Number(payload.targetId),
            limit: payload.limit,
            selfId: activeId
          })
          break
        }

        case ActionTypes.SEND_MESSAGE: {
          const sendPayload = data as SendMsgPayload
          const session = clients.get(ws)!
          const curActiveId = session.userId ?? (dbService.getUserInfo('current') as UnifiedUser)?.userId
          const senderId = sendPayload.senderId ?? curActiveId
          if (!senderId) throw new Error('sender not resolved')

          const saved = await messageService.sendMessage({
            type: sendPayload.type,
            senderId: Number(senderId),
            targetId: Number(sendPayload.targetId),
            content: sendPayload.content,
            tempId: (data as any).tempId // 传递 tempId 以便前端去重
          })

          result = { seq: saved.seq, timestamp: saved.timestamp, tempId: saved.tempId }
          break
        }

        case ActionTypes.SET_READ: {
          const payload = data as { type: 'private' | 'group', targetId: any, seq: any }
          const session = clients.get(ws)!
          const curActiveId = session.userId ?? (dbService.getUserInfo('current') as UnifiedUser)?.userId
          if (curActiveId) {
            dbService.updateReadState(curActiveId, payload.type, Number(payload.targetId), Number(payload.seq))
          }
          result = { status: 'ok' }
          break
        }

        case ActionTypes.RECALL_MESSAGE: {
          const payload = data as { type: 'private' | 'group', seq: any }
          await messageService.recallMessage(payload.type, Number(payload.seq))
          result = { status: 'ok' }
          break
        }

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

/**
 * 广播同步事件给所有客户端
 */
function broadcastSync () {
  clients.forEach((_, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      syncClient(ws).catch(() => { })
    }
  })
}

/**
 * 推送消息给指定的用户列表（如果在线）
 */
function sendToUsers (userIds: number[], msg: WSMessage) {
  const payload = JSON.stringify(msg)
  const idSet = new Set(userIds)
  clients.forEach((session, client) => {
    if (client.readyState === WebSocket.OPEN && session.userId && idSet.has(session.userId)) {
      client.send(payload)
    }
  })
}

async function syncClient (ws: WebSocket) {
  const session = clients.get(ws)
  let me = (session?.userId ? dbService.getUserInfo(session.userId) : null) as UnifiedUser | UnifiedUser[] | undefined

  if (!me || Array.isArray(me)) {
    if (session) session.userId = 0
    me = { userId: 0, nickname: '访客', age: 0, gender: 'unknown', friendList: [], groupList: [] }
  }

  const friends = dbService.getUserInfo('all') as UnifiedUser[]
  const groups = dbService.getGroupInfo('all') as UnifiedGroup[]

  const contacts = [
    ...friends.map(f => ({ ...f, type: 'private' as const })),
    ...groups.map(g => ({ ...g, type: 'group' as const }))
  ]

  const syncData = {
    me,
    contacts: contacts.map(c => {
      const scene = c.type
      const targetId = scene === 'private' ? (c as UnifiedUser).userId : (c as UnifiedGroup).groupId
      const lastReadSeq = dbService.getReadState(me.userId, scene, targetId)

      // 获取最后一条消息及其 seq
      const msgs = dbService.getMsg({ type: scene, targetId, selfId: me.userId, limit: 1 })
      const lastMsg = msgs[0]

      return {
        ...c,
        lastReadSeq,
        lastMsg: lastMsg || null,
        unreadCount: lastMsg && lastMsg.seq !== undefined ? Math.max(0, lastMsg.seq - lastReadSeq) : 0
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
