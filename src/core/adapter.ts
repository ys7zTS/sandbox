import { UnifiedMessage } from './types'

export abstract class BaseAdapter {
  abstract readonly protocol: string

  /**
   * 发送消息到客户端（机器人端）
   */
  abstract pushEvent (event: UnifiedMessage): void

  /**
   * 处理来自客户端的调用（API Action）
   */
  abstract handleAction (action: string, params: any): Promise<any>

  /**
   * 启动协议适配器
   */
  abstract start (): void
}
