import React from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Message } from '../types'
import { useChat } from '../ChatContext'
import { getAvatarUrl } from '../utils'
import { MessageType } from '../../types/Message'

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ')

interface MessageItemProps {
  message: Message
  isMe: boolean
  showTime: boolean
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, isMe, showTime }) => {
  const { resendMsg, actualTheme, setConfirmDialog, detailInfo, profiles } = useChat()
  const isDark = actualTheme === 'dark'
  const isRecalled = message.isRevoked === 1

  const getAtDisplayName = (targetId: number | 'all') => {
    if (targetId === 'all') return '@全体成员'

    // 如果是群聊，尝试从群成员列表中获取名片
    if (message.type === 'group' && detailInfo?.memberList) {
      const member = detailInfo.memberList.find((m: any) => String(m.userId) === String(targetId))
      if (member) {
        return `@${member.nickname || member.userId}`
      }
    }

    // 尝试从全局 profiles 中获取昵称
    const profile = profiles.find((p: any) => String(p.userId) === String(targetId))
    if (profile) {
      return `@${profile.nickname || profile.userId}`
    }

    return `@${targetId}`
  }

  const renderMessageContent = (content: MessageType) => {
    // 基础兼容：如果 content 是字符串，将其包装为文本类型数组
    const parts = Array.isArray(content) ? content : [{ type: 'text' as const, text: String(content) }]

    return parts.map((part, idx) => {
      switch (part.type) {
        case 'text':
          return <span key={idx}>{part.text}</span>
        case 'image':
          return (
            <img
              key={idx}
              src={part.url || part.uri}
              alt=''
              className='max-w-full rounded-lg shadow-sm object-contain'
              style={{ width: part.width, height: part.height }}
            />
          )
        case 'video':
          return (
            <video key={idx} controls className='max-w-full rounded-lg shadow-sm'>
              <source src={part.url || part.uri} />
            </video>
          )
        case 'at':
          return (
            <span
              key={idx}
              className={cn(
                'font-medium cursor-pointer hover:underline px-1 rounded transition-colors',
                isMe
                  ? 'text-blue-100 bg-white/10 hover:bg-white/20'
                  : 'text-mac-blue bg-mac-blue/5 hover:bg-mac-blue/10'
              )}
            >
              {getAtDisplayName(part.targetId)}
            </span>
          )
        default:
          return null
      }
    })
  }

  return (
    <div className='flex flex-col gap-4'>
      {showTime && (
        <div className='flex justify-center'>
          <span className={cn('px-2 py-0.5 rounded-full text-[10px]', isDark ? 'bg-gray-800 text-gray-400' : 'bg-black/5 text-gray-500')}>
            {new Date(message.timestamp * 1000).toLocaleString()}
          </span>
        </div>
      )}

      <div className={cn('flex group items-start gap-3', isMe ? 'flex-row-reverse' : 'flex-row')}>
        {/* Avatar */}
        <div className='w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm overflow-hidden cursor-pointer active:scale-95 transition-transform'>
          <img src={getAvatarUrl('private', message.senderId)} alt='' className='w-full h-full object-cover' />
        </div>

        {/* Message Bubble Column */}
        <div className={cn('flex flex-col max-w-[70%]', isMe ? 'items-end' : 'items-start')}>
          {!isMe && (
            <span className={cn('text-[10px] mb-1 px-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
              {message.senderId}
            </span>
          )}

          <div className='flex items-center gap-2 group'>
            {/* Status Indicators (Left of bubble if isMe) */}
            {isMe && message.status === 'sending' && (
              <Loader2 className='w-4 h-4 text-mac-blue animate-spin shrink-0' />
            )}
            {isMe && message.status === 'failed' && (
              <button
                onClick={() => {
                  setConfirmDialog({
                    title: '重新发送',
                    message: '消息发送失败，是否尝试重新发送该消息？',
                    onConfirm: () => resendMsg(message.tempId!),
                    confirmText: '重新发送',
                    cancelText: '取消'
                  })
                }}
                className='text-red-500 hover:text-red-600 transition-colors'
                title='发送失败，点击重试'
              >
                <AlertCircle className='w-4 h-4' />
              </button>
            )}

            <div
              className={cn(
                'relative px-4 py-2.5 rounded-2xl shadow-sm text-sm break-all leading-relaxed transition-all duration-300',
                isRecalled
                  ? (isDark ? 'bg-red-900/30 text-red-200/50' : 'bg-red-50 text-red-400')
                  : isMe
                    ? 'bg-mac-blue text-white'
                    : (isDark ? 'bg-gray-800 text-gray-200' : 'bg-white border border-mac-border text-mac-text-main')
              )}
            >
              {isRecalled && (
                <div className={cn(
                  'absolute -top-2 -right-2 px-1.5 py-0.5 rounded-md text-[9px] shadow-sm font-medium border animate-in fade-in zoom-in duration-300',
                  isDark ? 'bg-gray-800 border-red-900/50 text-red-400' : 'bg-white border-red-100 text-red-400'
                )}>
                  已撤回
                </div>
              )}
              {renderMessageContent(message.content)}
            </div>

            {/* Status Indicators (Right of bubble if not isMe - though failed usually only happens for isMe) */}
          </div>
        </div>
      </div>
    </div>
  )
}
