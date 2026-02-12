export interface WSMessage<T = any> {
  type: string
  data: T
  echo?: string // 用于前端识别响应
}

export const ActionTypes = {
  // 用户相关
  GET_USER_INFO: 'get_user_info',
  SAVE_USER: 'save_user',
  SET_ACTIVE_USER: 'set_active_user',
  REMOVE_USER: 'remove_user',

  // 好友相关
  UPDATE_FRIENDSHIP: 'update_friendship',

  // 群组相关
  GET_GROUP_INFO: 'get_group_info',
  SAVE_GROUP: 'save_group',
  REMOVE_GROUP: 'remove_group',
  JOIN_GROUP: 'join_group',
  LEAVE_GROUP: 'leave_group',

  // 消息相关
  GET_MESSAGES: 'get_messages',
  SEND_MESSAGE: 'send_message',
  RECALL_MESSAGE: 'recall_message',
  PUSH_MESSAGE: 'push_message', // 后端主动推送

  // 系统相关
  HEARTBEAT: 'heartbeat',
  ACK: 'ack'
}
