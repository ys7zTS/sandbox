import React from 'react'
import { Settings, Bot, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChat } from '../ChatContext'
import { MessageList } from './MessageList'
import { InputArea } from './InputArea'
import { ChatDetailsSidebar } from './ChatDetailsSidebar'
import { GroupEditSidebar } from './GroupEditSidebar'

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ')

export const ChatWindow: React.FC = () => {
  const { currentTarget, me, messages, setShowSettings, showSettings, showGroupEdit, setShowGroupEdit, actualTheme } = useChat()
  const isDark = actualTheme === 'dark'

  if (!me || me.userId === 0) {
    return (
      <div className={cn('flex-1 flex flex-col items-center justify-center p-8 text-center transition-colors duration-500',
        isDark ? 'bg-gray-950' : 'bg-[#fafafa]')}>
        <div className={cn('w-32 h-32 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center justify-center mb-10 border transition-all hover:scale-105',
          isDark ? 'bg-gray-800 border-white/10' : 'bg-white border-white')}>
          <Bot className='w-16 h-16 text-mac-blue animate-pulse' />
        </div>
        <h2 className={cn('text-3xl font-black tracking-tight mb-3', isDark ? 'text-white' : 'text-gray-900')}>
          准备就绪
        </h2>
        <p className={cn('max-w-xs text-sm font-medium leading-relaxed mb-10', isDark ? 'text-gray-400' : 'text-gray-500')}>
          你还没有登录任何账号。请点击左上角的头像选择角色，或点击 <span className='inline-flex items-center justify-center w-6 h-6 bg-mac-blue text-white rounded-lg shadow-lg shadow-mac-blue/30 mx-1'><Plus className='w-3 h-3' /></span> 开始。
        </p>
        <div className='flex gap-4'>
          <div className='px-4 py-2 rounded-full bg-mac-blue/10 text-mac-blue text-xs font-bold border border-mac-blue/20'>
            模拟环境
          </div>
          <div className='px-4 py-2 rounded-full bg-green-500/10 text-green-600 text-xs font-bold border border-green-500/20'>
            连接正常
          </div>
        </div>
      </div>
    )
  }

  if (!currentTarget) {
    return (
      <div className={cn('flex-1 flex flex-col items-center justify-center transition-colors duration-500',
        isDark ? 'bg-gray-900' : 'bg-white')}>
        <div className='relative'>
          <div className='absolute inset-0 bg-mac-blue blur-3xl opacity-10 animate-pulse' />
          <Bot className={cn('w-40 h-40 mb-8 opacity-20 relative z-10', isDark ? 'text-white' : 'text-mac-blue')} />
        </div>
        <span className={cn('text-xl font-bold tracking-tight opacity-40', isDark ? 'text-white' : 'text-gray-900')}>
          开启沟通之旅
        </span>
        <p className={cn('text-xs font-medium mt-3 opacity-30', isDark ? 'text-gray-400' : 'text-gray-500')}>
          在左侧列表中选择一个联系人开始聊天
        </p>
      </div>
    )
  }

  return (
    <main className={cn('flex-1 flex flex-col relative overflow-hidden transition-colors duration-300',
      isDark ? 'bg-gray-900 text-gray-100' : 'bg-white')}>
      <header className={cn('h-16 px-8 flex items-center justify-between border-b backdrop-blur-3xl sticky top-0 z-20 shrink-0',
        isDark ? 'bg-gray-800/60 border-white/10' : 'bg-white/70 border-black/5')}>
        <div className='flex flex-col gap-0.5'>
          <h2 className={cn('text-base font-black tracking-tight', isDark ? 'text-white' : 'text-gray-900')}>
            {currentTarget.name}
          </h2>
          <div className='flex items-center gap-2'>
            <div className='w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' />
            <span className={cn('text-[10px] font-bold opacity-50 uppercase tracking-widest',
              isDark ? 'text-gray-300' : 'text-gray-500')}>
              {currentTarget.type === 'private' ? '私聊会话' : '群聊频道'}
            </span>
          </div>
        </div>
        <div className='flex items-center gap-5'>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn('p-2.5 rounded-2xl transition-all duration-200 active:scale-90',
              (showSettings || (isDark ? false : false)) // Placeholder for active state styling
                ? (isDark ? 'bg-mac-blue text-white' : 'bg-mac-blue text-white shadow-lg shadow-mac-blue/20')
                : (isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-mac-text-secondary hover:text-mac-blue'))}
          >
            <Settings className='w-5 h-5' />
          </button>
        </div>
      </header>

      <div className='flex-1 overflow-hidden relative flex flex-col'>
        <MessageList />

        <AnimatePresence>
          {showSettings && (
            <motion.div
              key='settings-backdrop'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onMouseDown={() => setShowSettings(false)}
              className='absolute inset-0 bg-black/5 z-25'
            />
          )}
          {showSettings && (
            <motion.div
              key='settings-panel'
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className='absolute top-0 right-0 bottom-0 z-30'
            >
              <ChatDetailsSidebar />
            </motion.div>
          )}

          {showGroupEdit && (
            <motion.div
              key='group-edit-backdrop'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onMouseDown={() => setShowGroupEdit(false)}
              className='absolute inset-0 bg-black/5 z-35'
            />
          )}
          {showGroupEdit && (
            <motion.div
              key='group-edit-panel'
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className='absolute top-0 right-0 bottom-0 z-40'
            >
              <GroupEditSidebar />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className='relative z-10'>
        <InputArea />
      </div>
    </main>
  )
}
