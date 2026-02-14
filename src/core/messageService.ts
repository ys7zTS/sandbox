import { dbService } from './db'
import { eventBus, Events, MessageSavedEvent } from './bus'
import { UnifiedMessage } from './types'

export const messageService = {
  /**
   * 发送并广播消息
   */
  async sendMessage (msg: Omit<UnifiedMessage, 'seq' | 'timestamp' | 'isRevoked'>) {
    const saved = dbService.saveMsg({
      ...msg,
      timestamp: Math.floor(Date.now() / 1000),
      isRevoked: 0
    })

    // 如果原始消息带了 tempId，把它带到广播中，但不一定存数据库
    if (msg.tempId) {
      (saved as any).tempId = msg.tempId
    }

    // 触发保存成功事件，其它模块（如 WS, OB11 适配器）监听并处理
    eventBus.emit(Events.MESSAGE_SAVED, { message: saved } as MessageSavedEvent)

    return saved
  },

  /**
   * 撤回消息
   */
  async recallMessage (type: 'private' | 'group', seq: number) {
    dbService.recallMsg(type, seq)
    eventBus.emit(Events.MESSAGE_RECALLED, { type, seq })
  }
}
