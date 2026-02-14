export const ActionTypes = {
  // 用户相关
  GET_USER_INFO: 'get_user_info',
  SAVE_USER: 'save_user',
  SET_ACTIVE_USER: 'set_active_user',
  REMOVE_USER: 'remove_user',

  // 好友相关
  UPDATE_FRIENDSHIP: 'update_friendship',
  ADD_FRIEND: 'add_friend',
  DELETE_FRIEND: 'delete_friend',

  // 群组相关
  GET_GROUP_INFO: 'get_group_info',
  SAVE_GROUP: 'save_group',
  REMOVE_GROUP: 'remove_group',
  JOIN_GROUP: 'join_group',
  LEAVE_GROUP: 'leave_group',
  SET_GROUP_ADMIN: 'set_group_admin',
  UPDATE_GROUP_MEMBER: 'update_group_member',
  TRANSFER_GROUP_OWNER: 'transfer_group_owner',
  GROUP_MEMBER_UPDATE: 'group_member_update',
  CREATE_GROUP: 'create_group',

  // 消息相关
  MESSAGE: 'message', // 标准消息类型
  GET_MESSAGES: 'get_messages',
  SEND_MESSAGE: 'send_message',
  RECALL_MESSAGE: 'recall_message',
  RECALL: 'recall', // 消息撤回指令
  PUSH_MESSAGE: 'push_message', // 后端主动推送
  SET_READ: 'set_read',

  // 集成相关
  SYNC_ALL: 'sync_all',

  // 文件相关
  UPLOAD_FILE: 'upload_file',

  // 系统相关
  HEARTBEAT: 'heartbeat',
  ACK: 'ack'
} as const

export type ActionType = typeof ActionTypes[keyof typeof ActionTypes]

export type WSOPType = 'Event' | 'System' | 'Action' | 'Response' | ActionType

export interface WSMessage<T = any> {
  type: WSOPType
  data: T
  echo?: string // 用于前端识别响应
}
