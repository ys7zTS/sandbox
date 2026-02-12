import { ActionTypes, WSMessage } from '../core/protocol'

class WebSocketAPI {
  private ws: WebSocket | null = null
  private url: string
  private echoMap = new Map<string, { resolve: Function, reject: Function }>()
  private handlers = new Map<string, Set<Function>>()
  private heartbeatInterval: any
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

  connect (): Promise<void> {
    if (this.connectPromise) return this.connectPromise

    this.connectPromise = new Promise((resolve, reject) => {
      console.log(`[WS] Attempting to connect to ${this.url}...`)
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log(`[WS] Connected to ${this.url}`)
        this.lastMessageTime = Date.now()
        this.startHeartbeat()
        resolve()
      }

      this.ws.onmessage = (event) => {
        this.lastMessageTime = Date.now()
        try {
          const { type, data, echo } = JSON.parse(event.data) as WSMessage

          if (echo && this.echoMap.has(echo)) {
            const { resolve } = this.echoMap.get(echo)!
            this.echoMap.delete(echo)
            resolve(data)
          }

          if (this.handlers.has(type)) {
            this.handlers.get(type)!.forEach(handler => handler(data))
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

  private startHeartbeat () {
    this.heartbeatInterval = setInterval(() => {
      // 检查接收超时
      if (Date.now() - this.lastMessageTime > 30000) {
        console.warn('[WS] Heartbeat timeout (30s), closing connection...')
        this.ws?.close()
        return
      }
      this.send(ActionTypes.HEARTBEAT, {}).catch(() => { })
    }, 5000) // 每 5 秒发送心跳并检查一次
  }

  private stopHeartbeat () {
    clearInterval(this.heartbeatInterval)
  }

  on (type: string, handler: Function) {
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

  getMessages (params: any) { return this.send(ActionTypes.GET_MESSAGES, params) }
  sendMessage (data: any) { return this.send(ActionTypes.SEND_MESSAGE, data) }
  recallMessage (type: string, seq: number) { return this.send(ActionTypes.RECALL_MESSAGE, { type, seq }) }
}

export const api = new WebSocketAPI()
