import React, { useEffect, useRef } from 'react'
import { useChat } from '../ChatContext'
import { MessageItem } from './MessageItem'

export const MessageList: React.FC = () => {
  const { messages, me, } = useChat()
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <div ref={scrollRef} className='flex-1 overflow-y-auto p-6 flex flex-col gap-8 scroll-smooth'>
      {messages.map((m, index) => {
        const isMe = !!me && m.senderId === me.userId
        const prevMsg = messages[index - 1]
        const showTime = !prevMsg || (m.timestamp - prevMsg.timestamp) > 600

        // Handle System Messages if senderId is 1 (as seen in App.tsx)
        if (m.senderId === 1) {
          const systemText = Array.isArray(m.content)
            ? m.content.map(p => (p.type === 'text' ? p.text : (p.type === 'at' ? (p.targetId === 'all' ? '@全体成员' : `@${p.targetId}`) : ''))).join('')
            : (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))

          return (
            <div key={m.tempId || m.seq || index} className='flex justify-center'>
              <span className='px-3 py-1 bg-black/5 rounded-full text-[10px] text-gray-500'>
                {systemText}
              </span>
            </div>
          )
        }

        return (
          <MessageItem
            key={m.tempId || m.seq || index}
            message={m}
            isMe={isMe}
            showTime={showTime}
          />
        )
      })}
    </div>
  )
}
