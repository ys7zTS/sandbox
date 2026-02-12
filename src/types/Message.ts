export interface Text {
  type: 'text',
  /** 文本内容 */
  text: string
}

/** 图片 */
export interface Image {
  type: 'image',
  /** 图片URL/base64/路径 */
  uri: string
  /** 可选的 http(s) 访问地址（便于前端直接渲染） */
  url?: string
  /** 图片大小 */
  size?: number
  /** 图片外显 */
  summary?: string
  /** 图片宽度 */
  width?: number
  /** 图片高度 */
  height?: number
  /** 图片名称 */
  name?: string
}

/** 回复 */
export interface Reply {
  type: 'reply',
  /** 被回复的消息ID */
  messageSeq: number
}

/** @用户 */
export interface At {
  type: 'at',
  /** 被@的用户ID */
  targetId: number | 'all'
}

export interface File {
  type: 'file',
  /** 文件URL/base64/路径 */
  uri: string,
  /** 可选的 http(s) 访问地址 */
  url?: string,
  /** 文件名 */
  filename?: string,
  /** 文件大小，单位字节 */
  size?: number
}

export interface Video {
  type: 'video',
  /** 视频URL/base64/路径 */
  uri: string
  /** 可选的 http(s) 访问地址 */
  url?: string
  /** 视频名称 */
  filename?: string
  /** 视频大小，单位字节 */
  size?: number
  /** 时长，单位秒 */
  duration?: number
  /** 宽度 */
  width?: number
  /** 高度 */
  height?: number
}

/** 消息内容 */
export type MessageType = (Text | Image | File | Video | Reply | At)[]
