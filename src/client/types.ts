import { MessageType } from '../types/Message'

export interface Message {
  seq: number
  type: 'private' | 'group'
  senderId: number
  targetId: number
  content: MessageType
  timestamp: number
  isRevoked: 0 | 1
}

export type UploadedPart = {
  part: MessageType[number]
  preview: string
}

export interface UserInfo {
  type: 'private'
  userId: number
  nickname: string
  age: number
  gender: 'male' | 'female' | 'unknown' | 'bot'
  friendList: number[]
  groupList?: number[]
  unreadCount?: number
  lastMsg?: Message
}

export interface GroupMember {
  userId: number
  nickname: string
  card?: string
  gender: 'male' | 'female' | 'unknown' | 'bot'
  age: number
  role: 'owner' | 'admin' | 'member'
  title?: string
  level?: number
  joinTime: number
}

export interface GroupInfo {
  type: 'group'
  groupId: number
  groupName: string
  avatarUrl?: string
  ownerId: number
  adminList?: number[]
  memberList: GroupMember[]
  unreadCount?: number
  lastMsg?: Message
}

export type Contact = UserInfo | GroupInfo

export type ContextMenuData =
  | { x: number, y: number, type: 'message', data: Message }
  | { x: number, y: number, type: 'contact', data: Contact }
  | { x: number, y: number, type: 'profile', data: UserInfo }
  | { x: number, y: number, type: 'member', data: GroupMember }
  | { x: number, y: number, type: 'avatar', data: { userId: number, member?: GroupMember } }

export type Target = {
  type: 'private' | 'group'
  id: number
  name: string
} | null

export interface SyncData {
  me: UserInfo
  contacts: Contact[]
}
