import React, { useState, useRef, useEffect } from 'react'
import {
  Smile,
  Paperclip,
  ImageIcon,
  FolderInput,
  Mic,
  AtSign
} from 'lucide-react'
import { useChat } from '../ChatContext'
import { MessageType } from '../../types/Message'

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ')

export const InputArea: React.FC = () => {
  const { currentTarget, sendMsg, actualTheme, me, detailInfo } = useChat()
  const [inputValue, setInputValue] = useState('')
  const [atMenu, setAtMenu] = useState<{ x: number, y: number, filter: string } | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isDark = actualTheme === 'dark'
  const isGroup = currentTarget?.type === 'group'
  const isMember = !isGroup || (
    detailInfo?.memberList?.some((m: any) => String(m.userId) === String(me?.userId)) ||
    me?.groupList?.some((gid: any) => String(gid) === String(currentTarget?.id))
  )

  // 只有在明确已经加载完且确认不是成员时才禁用，且输入内容不能为空
  const isDisabled = !inputValue.trim() || (isGroup && detailInfo && !isMember)

  const members = detailInfo?.memberList || []
  const filteredMembers = [
    ...(isGroup && (!atMenu?.filter || '全体成员'.includes(atMenu.filter) || 'all'.includes(atMenu.filter.toLowerCase()))
      ? [{ userId: 'all', nickname: '全体成员' }]
      : []),
    ...members.filter((m: any) => {
      const searchStr = atMenu?.filter.toLowerCase() || ''
      return (
        String(m.userId).includes(searchStr) ||
        (m.nickname || '').toLowerCase().includes(searchStr) ||
        (m.card || '').toLowerCase().includes(searchStr)
      )
    })
  ]

  useEffect(() => {
    setSelectedIndex(0)
  }, [atMenu?.filter])

  const handleSend = async () => {
    if (isDisabled || !currentTarget) return

    // 简单的解析逻辑：将 @用户(带空格) 替换为 at 类型的消息体
    // 规则：必须是 @ID + 空格，且 ID 必须在当前群成员中
    const parts: MessageType = []
    let lastIndex = 0
    const atRegex = /@(\d+|all)\s/g

    let match
    while ((match = atRegex.exec(inputValue)) !== null) {
      const atTarget = match[1]
      const targetId = atTarget === 'all' ? 'all' : parseInt(atTarget)

      const isMemberMatch = isGroup && (
        targetId === 'all' ||
        (detailInfo as any)?.memberList?.some((m: any) => String(m.userId) === String(targetId))
      )

      if (isMemberMatch) {
        if (match.index > lastIndex) {
          parts.push({ type: 'text', text: inputValue.substring(lastIndex, match.index) })
        }
        parts.push({ type: 'at', targetId: targetId as number | 'all' })
        lastIndex = atRegex.lastIndex
      }
    }

    if (lastIndex < inputValue.length) {
      parts.push({ type: 'text', text: inputValue.substring(lastIndex) })
    }

    // 如果没有识别到特定的 @ 格式，则作为普通文本发送
    const finalContent: MessageType = parts.length > 0 ? parts : [{ type: 'text' as const, text: inputValue }]

    await sendMsg(currentTarget.type, finalContent)
    setInputValue('')
  }

  const insertAt = (userId: number | 'all', nickname: string) => {
    if (!textareaRef.current) return
    const before = inputValue.substring(0, textareaRef.current.selectionStart).replace(/@\S*$/, '')
    const after = inputValue.substring(textareaRef.current.selectionEnd)
    const newValue = `${before}@${userId} ${after}`
    setInputValue(newValue)
    setAtMenu(null)

    // 重新聚焦并设置光标位置
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const cursorGap = `@${userId} `.length
        const pos = before.length + cursorGap
        textareaRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInputValue(value)

    if (isGroup) {
      const cursor = e.target.selectionStart
      const textBeforeCursor = value.substring(0, cursor)
      const lastAt = textBeforeCursor.lastIndexOf('@')

      // 只有当 @ 后面没有空格，且是在最后一个词的位置时才触发
      if (lastAt !== -1) {
        const textAfterAt = textBeforeCursor.substring(lastAt + 1)
        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
          const filter = textAfterAt
          setAtMenu({
            x: 0, // 坐标不再由 JS 计算，交由 CSS 处理
            y: 0,
            filter
          })
          return
        }
      }
    }
    setAtMenu(null)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (atMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredMembers.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filteredMembers.length) % Math.max(1, filteredMembers.length))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (filteredMembers[selectedIndex]) {
          insertAt(filteredMembers[selectedIndex].userId, filteredMembers[selectedIndex].nickname)
        }
      } else if (e.key === 'Escape') {
        setAtMenu(null)
      }
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <footer className={cn('p-4 border-t shrink-0 relative', isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-mac-border')}>
      {/* At Menu */}
      {atMenu && isGroup && filteredMembers.length > 0 && (
        <div
          className={cn(
            'absolute bottom-full mb-2 left-4 w-56 max-h-48 overflow-y-auto rounded-2xl shadow-2xl border backdrop-blur-3xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200',
            isDark ? 'bg-gray-900/90 border-white/10' : 'bg-white/90 border-black/5'
          )}
        >
          <div className='p-2 space-y-0.5'>
            <div className='px-3 py-1.5 text-[10px] font-black uppercase tracking-widest opacity-40 flex items-center gap-1.5'>
              <AtSign className='w-3 h-3' /> 选择群成员
            </div>
            {filteredMembers.map((member: any, idx: number) => (
              <button
                key={member.userId}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => insertAt(member.userId, member.nickname)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all',
                  idx === selectedIndex
                    ? (isDark ? 'bg-mac-blue text-white' : 'bg-mac-blue text-white shadow-lg shadow-mac-blue/20')
                    : (isDark ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-black/5 text-gray-700')
                )}
              >
                <img
                  src={`https://q.qlogo.cn/g?b=qq&nk=${member.userId}&s=100`}
                  alt=''
                  className='w-6 h-6 rounded-full shrink-0 shadow-sm border border-black/5'
                />
                <div className='flex-1 min-w-0'>
                  <div className='text-xs font-bold truncate'>{member.nickname || member.userId}</div>
                  <div className={cn('text-[9px] font-medium opacity-50', idx === selectedIndex ? 'text-white' : '')}>{member.userId}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className='flex flex-col gap-3'>
        <div className='flex items-center gap-1.5 text-mac-text-secondary'>
          <button className='p-2 hover:bg-black/5 rounded-lg transition-all'><Smile className='w-5 h-5' /></button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className='p-2 hover:bg-black/5 rounded-lg transition-all'
          >
            <Paperclip className='w-5 h-5' />
          </button>
          <button className='p-2 hover:bg-black/5 rounded-lg transition-all'><ImageIcon className='w-5 h-5' /></button>
          <button className='p-2 hover:bg-black/5 rounded-lg transition-all'><FolderInput className='w-5 h-5' /></button>
          <button className='p-2 hover:bg-black/5 rounded-lg transition-all ml-auto'><Mic className='w-5 h-5' /></button>

          <input
            type='file'
            ref={fileInputRef}
            className='hidden'
            onChange={(e) => {
              // Handle file upload
            }}
          />
        </div>

        <div className='relative flex items-end gap-2'>
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            disabled={isGroup && !isMember}
            placeholder={
              !currentTarget
                ? '选择一个会话开始聊天'
                : (isGroup && !isMember)
                  ? '加入群聊后即可发言'
                  : `发送给 ${currentTarget.name}...`
            }
            rows={1}
            className={cn(
              'flex-1 resize-none bg-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-mac-blue/20 transition-all max-h-32 min-h-[40px]',
              isDark && 'bg-gray-700 text-gray-200',
              (isGroup && !isMember) && 'opacity-50 cursor-not-allowed'
            )}
            style={{ height: 'auto' }}
          />
          <button
            onClick={handleSend}
            disabled={isDisabled}
            className={cn(
              'h-10 px-5 rounded-xl bg-mac-blue text-white font-medium text-sm transition-all flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:shadow-none shrink-0',
              isDisabled && 'bg-gray-400'
            )}
          >
            发送
          </button>
        </div>
      </div>
    </footer>
  )
}
