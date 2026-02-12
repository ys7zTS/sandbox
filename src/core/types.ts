import { MessageType } from '@/types/Message'

export { MessageType }

export type ChatScene = 'private' | 'group'

/** 联系人 */
export interface ContactType {
  /** 私聊/群聊 */
  scene: ChatScene,
  /** 好友/群ID */
  peer: number
  /** 群名/昵称 */
  name: string
}
/** 用户信息 */
export interface UserInfoType {
  /** ID */
  userId: number
  /** 昵称 */
  nickname: string
  /** 年龄 */
  age: number
  /** 性别 */
  sex: string
}

/** 发送者信息 */
export type SenderType = UserInfoType & {
  /** 群聊中的角色 */
  role?: 'owner' | 'admin' | 'member' | 'unknown'
  /** 群名片 */
  card?: string
  /** 头衔 */
  title?: string
  /** 群等级 */
  level?: number
}
export interface MessageInfoType {
  /** 消息seq */
  messageSeq: number
  /** 消息时间戳 */
  timestamp: number
  contact: ContactType
  /** 发送者信息 */
  sender: SenderType
  /** 消息内容 */
  content: MessageType
}

export interface MessagePart {
  type: 'text' | 'image'
  text?: string
  url?: string
}

export interface UnifiedMessage {
  seq?: number
  type: ChatScene
  senderId: number
  targetId: number // Original target (userId or groupId)
  groupId?: number // For group messages
  peerId?: string  // For private messages: 'minUserId:maxUserId'
  content: MessageType
  timestamp: number
  isRevoked: 0 | 1
  raw?: any
}

export interface UnifiedUser {
  userId: number
  nickname: string
  age: number
  gender: 'male' | 'female' | 'unknown'
  friendList: number[] // Array of userIds
  groupList: number[]  // Array of groupIds
}

export interface GroupMemberInfo {
  userId: number
  nickname: string
  card?: string
  gender: 'male' | 'female' | 'unknown'
  age: number
  role: 'owner' | 'admin' | 'member'
  title?: string
  level?: number
  joinTime: number
}

export interface MuteItem {
  userId: number
  expireTime: number
}

export interface UnifiedGroup {
  groupId: number
  groupName: string
  ownerId: number
  adminList: number[]
  memberList: GroupMemberInfo[]
  muteList: MuteItem[]
}

export abstract class ProtocolTransformer {
  abstract toUnified (raw: any): UnifiedMessage
  abstract fromUnified (unified: UnifiedMessage): any
}

export interface SendMsgPayload {
  type: ChatScene
  /** 对于私聊是对端用户ID；群聊为群ID */
  targetId: number
  /** 统一消息内容 */
  content: MessageType
  /** 可选：显式指定发送者（默认取当前账号） */
  senderId?: number
}

export interface GetMsgPayload {
  type: ChatScene
  /** 私聊：对端用户ID；群聊：群ID */
  targetId: number
  /** 可选：限制条数，默认 50 */
  limit?: number
}
