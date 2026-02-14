import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn (...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getAvatarUrl = (type: 'private' | 'group', id: number | string, customUrl?: string) => {
  if (customUrl) return customUrl
  const finalId = (!id || id === 0 || id === '0') ? '10000' : id
  if (type === 'private') {
    return `https://q1.qlogo.cn/g?b=qq&s=640&nk=${finalId}`
  }
  return `https://p.qlogo.cn/gh/${finalId}/${finalId}/640`
}

export const getMessageSummary = (content: any): string => {
  if (!content) return '[暂无消息]'
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return String(content)

  return content.map((p: any) => {
    if (p.type === 'text') return p.text
    if (p.type === 'image') return `[${p.summary || '图片'}]`
    if (p.type === 'file') return `[文件]${p.filename || ''}`
    if (p.type === 'video') return '[视频]'
    if (p.type === 'at') return p.targetId === 'all' ? '@全体成员' : `@${p.targetId}`
    if (p.type === 'reply') return '' // 摘要不显示引用标记
    return `[${p.type}]`
  }).join(' ').trim()
}
