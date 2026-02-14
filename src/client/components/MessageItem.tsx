import React from 'react'
import { AlertCircle, Loader2, FileIcon, Download } from 'lucide-react'
import { Message } from '../types'
import { useChat } from '../ChatContext'
import { getAvatarUrl } from '../utils'

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
  const isGroup = message.type === 'group'

  const senderMember = (isGroup && detailInfo?.type === 'group') ? detailInfo?.memberList?.find((m) => String(m.userId) === String(message.senderId)) : undefined
  const senderDisplayName = senderMember ? (senderMember.card || senderMember.nickname) : (profiles.find((p) => String(p.userId) === String(message.senderId))?.nickname) || message.senderId

  const getRoleTitle = () => {
    if (!isGroup || !senderMember) return null
    const role = senderMember.role
    const customTitle = senderMember.title

    let text = customTitle
    let colorClasses = ''

    if (role === 'owner') {
      text = customTitle || '群主'
      colorClasses = isDark ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600'
    } else if (role === 'admin') {
      text = customTitle || '管理员'
      colorClasses = isDark ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
    } else {
      // member
      text = customTitle || '成员'
      if (customTitle) {
        colorClasses = isDark ? 'bg-purple-500/20 border-purple-500/30 text-purple-400' : 'bg-purple-50 border-purple-200 text-purple-600'
      } else {
        colorClasses = isDark ? 'bg-gray-500/20 border-gray-500/30 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600'
      }
    }

    return { text, colorClasses }
  }

  const roleTitle = getRoleTitle()

  const formatSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getAtDisplayName = (targetId: number | 'all') => {
    if (targetId === 'all') return '@全体成员'

    // 如果是群聊，尝试从群成员列表中获取名片
    if (message.type === 'group' && detailInfo?.type === 'group' && detailInfo.memberList) {
      const member = detailInfo.memberList.find((m) => String(m.userId) === String(targetId))
      if (member) {
        return `@${member.nickname || member.userId}`
      }
    }

    // 尝试从全局 profiles 中获取昵称
    const profile = profiles.find((p) => String(p.userId) === String(targetId))
    if (profile) {
      return `@${profile.nickname || profile.userId}`
    }

    return `@${targetId}`
  }

  const parts = Array.isArray(message.content) ? message.content : [{ type: 'text' as const, text: String(message.content) }]
  const hasText = parts.some(p => (p.type === 'text' && p.text.trim() !== '') || p.type === 'at' || p.type === 'reply')
  const isPureMedia = !hasText && parts.every(p => ['image', 'file', 'video'].includes(p.type) || (p.type === 'text' && p.text.trim() === ''))

  const renderMessageContent = () => {
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
              className={cn('max-w-full rounded-lg shadow-sm object-contain cursor-pointer', !isPureMedia && 'my-1')}
              style={{ width: part.width, height: part.height }}
              onClick={() => window.open(part.url || part.uri, '_blank')}
            />
          )
        case 'file':
          return (
            <div
              key={idx}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group/file w-full max-w-[280px]',
                isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-black/5 border-black/5 hover:bg-black/10'
              )}
              onClick={() => {
                const link = document.createElement('a')
                link.href = part.url || part.uri
                link.download = part.filename || 'file'
                link.click()
              }}
            >
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-mac-blue/10'
              )}
              >
                <FileIcon className='w-5 h-5 text-mac-blue' />
              </div>
              <div className='flex-1 min-w-0'>
                <div className={cn('text-xs font-bold truncate', isDark ? 'text-gray-200' : 'text-gray-900')}>
                  {part.filename || '未知文件'}
                </div>
                <div className={cn('text-[10px] opacity-60', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {formatSize(part.size)}
                </div>
              </div>
              <Download className='w-4 h-4 opacity-0 group-hover/file:opacity-100 transition-opacity text-mac-blue' />
            </div>
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
        <div className={cn(
          'w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm overflow-hidden cursor-pointer active:scale-95 transition-transform z-10 ring-2 ring-inset',
          isGroup && senderMember?.role === 'owner'
            ? 'ring-amber-500/50'
            : isGroup && senderMember?.role === 'admin' ? 'ring-emerald-500/50' : 'ring-transparent'
        )}
        >
          <img src={getAvatarUrl('private', message.senderId)} alt='' className='w-full h-full object-cover' />
        </div>

        {/* Message Content Column */}
        <div className={cn('flex flex-col max-w-[70%]', isMe ? 'items-end' : 'items-start')}>
          {/* Metadata Row (Title & Display Name) - Always above the bubble */}
          <div className={cn('flex items-center gap-1.5 mb-1 px-1', isMe ? 'flex-row-reverse' : 'flex-row')}>
            {isGroup && roleTitle && (
              <span className={cn(
                'text-[8px] px-1 py-0.5 rounded font-black uppercase tracking-widest shadow-sm border whitespace-nowrap leading-none',
                roleTitle.colorClasses
              )}
              >
                {roleTitle.text}
              </span>
            )}
            <span className={cn('text-[10px] font-bold opacity-50 truncate max-w-[120px] leading-none', isDark ? 'text-gray-400' : 'text-gray-500')}>
              {isGroup ? senderDisplayName : (!isMe ? message.senderId : '')}
            </span>
          </div>

          <div className='flex items-center gap-2 group'>
            {/* Status Indicators (Left of bubble if isMe) */}
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
                'relative transition-all duration-300',
                isPureMedia ? '' : 'px-4 py-2.5 rounded-2xl shadow-sm text-sm break-all leading-relaxed',
                isRecalled
                  ? (isDark ? 'bg-red-900/30 text-red-200/50' : 'bg-red-50 text-red-400')
                  : isPureMedia
                    ? ''
                    : isMe
                      ? 'bg-mac-blue text-white'
                      : (isDark ? 'bg-gray-800 text-gray-200' : 'bg-white border border-mac-border text-mac-text-main')
              )}
            >
              {isRecalled && (
                <div className={cn(
                  'absolute -top-2 -right-2 px-1.5 py-0.5 rounded-md text-[9px] shadow-sm font-medium border animate-in fade-in zoom-in duration-300',
                  isDark ? 'bg-gray-800 border-red-900/50 text-red-400' : 'bg-white border-red-100 text-red-400'
                )}
                >
                  已撤回
                </div>
              )}
              {renderMessageContent()}
            </div>

            {/* Status Indicators (Right of bubble if not isMe - though failed usually only happens for isMe) */}
          </div>
        </div>
      </div>
    </div>
  )
}
