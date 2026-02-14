import { EventEmitter } from 'events'
import { UnifiedMessage } from './types'

export const eventBus = new EventEmitter()

// 全局事件播报
const originalEmit = eventBus.emit.bind(eventBus)
eventBus.emit = (event: string | symbol, ...args: any[]) => {
  console.log(`[EventBus] ${String(event)}`, JSON.stringify(args[0] || {}).substring(0, 200))
  return originalEmit(event, ...args)
}

export const Events = {
  /** 发送消息事件 */
  SEND_MESSAGE: 'message:send',
  /** 消息已保存到数据库 */
  MESSAGE_SAVED: 'message:saved',
  /** 消息撤回 */
  MESSAGE_RECALLED: 'message:recalled',
  /** 用户状态变更 */
  USER_UPDATED: 'user:updated',
}

export interface SendMessageEvent {
  message: Omit<UnifiedMessage, 'seq' | 'timestamp'>
}

export interface MessageSavedEvent {
  message: UnifiedMessage
}
