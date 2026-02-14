import { ActionTypes, WSMessage } from '../core/protocol'

class WebSocketAPI {
  private ws: WebSocket | null = null
  private url: string
  private echoMap = new Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }>()
  private handlers = new Map<string, Set<(data: any) => void>>()
  private onConnectHandlers = new Set<() => void>()
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null
  private lastMessageTime: number = 0
  private connectPromise: Promise<void> | null = null

  constructor () {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    // 增加对开发环境的适配：如果是 5173 端口，强制连接到 3000
    let host = window.location.host
    if (host.includes(':5173')) {
      host = host.replace(':5173', ':3000')
    }
    this.url = `${protocol}//${host}`
  }

  onConnect (handler: () => void) {
    this.onConnectHandlers.add(handler)
    if (this.ws?.readyState === WebSocket.OPEN) {
      handler()
    }
    return () => this.onConnectHandlers.delete(handler)
  }

  connect (): Promise<void> {
    if (this.connectPromise) return this.connectPromise

    this.connectPromise = new Promise((resolve, reject) => {
      console.log(`[WS] Attempting to connect to ${this.url}...`)
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log(`[WS] Connected to ${this.url}`)
        this.lastMessageTime = Date.now()
        this.resetHeartbeat()
        this.onConnectHandlers.forEach(h => h())
        resolve()
      }

      this.ws.onmessage = (event) => {
        this.lastMessageTime = Date.now()
        // 收到任何消息，如果正在等待心跳恢复，则清除超时定时器并重置心跳
        if (this.timeoutTimer) {
          clearTimeout(this.timeoutTimer)
          this.timeoutTimer = null
          this.resetHeartbeat()
        }

        try {
          const raw = JSON.parse(event.data) as WSMessage<any>
          const { type, data, echo } = raw

          if (echo && this.echoMap.has(echo)) {
            const { resolve } = this.echoMap.get(echo)!
            this.echoMap.delete(echo)
            resolve(data)
          }

          // 处理核心事件/系统消息
          if (type === 'Event' && data?.event) {
            this.emit(data.event, data.payload)
          } else if (type === 'System') {
            this.emit('System', data)
          } else {
            // 兼容旧的或者直接以 type 为事件名的逻辑
            this.emit(type, data)
          }
        } catch (err) {
          console.error('[WS] Parse error', err)
        }
      }

      this.ws.onclose = () => {
        console.log('[WS] Disconnected, retrying in 3s...')
        this.stopHeartbeat()
        this.connectPromise = null
        setTimeout(() => this.connect(), 3000)
      }

      this.ws.onerror = (err) => {
        console.error('[WS] Error', err)
        this.connectPromise = null
        reject(err)
      }
    })

    return this.connectPromise
  }

  private emit (type: string, data: any) {
    if (this.handlers.has(type)) {
      this.handlers.get(type)!.forEach(handler => handler(data))
    }
  }

  private resetHeartbeat () {
    this.stopHeartbeat()
    this.heartbeatTimer = setTimeout(() => {
      this.sendHeartbeat()
    }, 30000)
  }

  private sendHeartbeat () {
    this.send(ActionTypes.HEARTBEAT as any, {}).catch(() => { })

    // 发送心跳后启动 5s 超时检测
    this.timeoutTimer = setTimeout(() => {
      console.warn('[WS] Heartbeat timeout (5s), closing connection...')
      this.ws?.close()
    }, 5000)
  }

  private stopHeartbeat () {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer)
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer)
    this.heartbeatTimer = null
    this.timeoutTimer = null
  }

  on (type: string, handler: (data: any) => void) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
    return () => { this.handlers.get(type)!.delete(handler) }
  }

  async send<T = any> (type: string, data: any): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // 如果还没连上，等待连接
      await this.connect()
    }

    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket not connected after retry'))
      }

      const echo = Math.random().toString(36).substring(7)
      this.echoMap.set(echo, { resolve, reject })

      this.ws.send(JSON.stringify({ type, data, echo }))

      // Timeout for ACK
      setTimeout(() => {
        if (this.echoMap.has(echo)) {
          this.echoMap.delete(echo)
          reject(new Error(`Timeout for action: ${type}`))
        }
      }, 10000)
    })
  }

  // 辅助方法匹配后端接口
  getUserInfo (target: any = 'all') { return this.send(ActionTypes.GET_USER_INFO, { target }) }
  saveUser (data: any) { return this.send(ActionTypes.SAVE_USER, data) }
  setActiveUser (userId: number) { return this.send(ActionTypes.SET_ACTIVE_USER, { userId }) }
  removeUser (userId: number, options: any = {}) { return this.send(ActionTypes.REMOVE_USER, { userId, ...options }) }

  updateFriendship (data: any) { return this.send(ActionTypes.UPDATE_FRIENDSHIP, data) }

  getGroupInfo (target: any = 'all') { return this.send(ActionTypes.GET_GROUP_INFO, { target }) }
  saveGroup (data: any) { return this.send(ActionTypes.SAVE_GROUP, data) }
  removeGroup (groupId: number, options: any = {}) { return this.send(ActionTypes.REMOVE_GROUP, { groupId, ...options }) }
  joinGroup (groupId: number, userId: number) { return this.send(ActionTypes.JOIN_GROUP, { groupId, userId }) }
  leaveGroup (groupId: number, userId: number) { return this.send(ActionTypes.LEAVE_GROUP, { groupId, userId }) }
  setGroupAdmin (groupId: number, userId: number, isAdmin: boolean) { return this.send(ActionTypes.SET_GROUP_ADMIN, { groupId, userId, isAdmin }) }
  updateGroupMember (groupId: number, userId: number, data: any) { return this.send(ActionTypes.UPDATE_GROUP_MEMBER, { groupId, userId, ...data }) }
  transferGroupOwner (groupId: number, userId: number) { return this.send(ActionTypes.TRANSFER_GROUP_OWNER, { groupId, userId }) }

  getMessages (params: any) { return this.send(ActionTypes.GET_MESSAGES, params) }
  sendMessage (data: any) { return this.send(ActionTypes.SEND_MESSAGE, data) }
  recallMessage (type: string, seq: number) { return this.send(ActionTypes.RECALL_MESSAGE, { type, seq }) }
}

export const api = new WebSocketAPI()
