import React from 'react'
import {
  MessageSquare,
  Settings,
  Plus,
  Bot,
  Sun,
  Moon,
  Monitor
} from 'lucide-react'
import { useChat } from '../ChatContext'
import { getAvatarUrl, getMessageSummary } from '../utils'
import { ActionTypes } from '../../core/protocol'
import { api } from '../api'
import { UserInfo, Contact } from '../types'

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ')

const NavItem: React.FC<{ active: boolean, onClick: () => void, children: React.ReactNode }> = ({ active, onClick, children }) => (
  <div
    onClick={onClick}
    className={cn(
      'w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-200',
      active ? 'bg-mac-blue text-white shadow-[0_4px_12px_rgba(0,122,255,0.3)] scale-105' : 'text-mac-text-secondary hover:bg-black/5 hover:text-mac-text-main'
    )}
  >
    {children}
  </div>
)

export const Sidebar: React.FC = () => {
  const {
    me, contacts, setContacts,
    activeTab, setActiveTab,
    currentTarget, setCurrentTarget,
    messageCache,
    showProfilesSidebar, setShowProfilesSidebar,
    profiles,
    switchUser,
    loadProfiles,
    theme, setTheme,
    actualTheme,
    setPlusMenu,
    setContextMenu
  } = useChat()

  const isDark = actualTheme === 'dark'

  return (
    <>
      {/* Left Nav Rail */}
      <nav className={cn('w-[68px] flex flex-col items-center py-6 border-r gap-8 shrink-0 relative z-40 transition-colors duration-300',
        isDark ? 'bg-gray-900 border-white/10' : 'bg-mac-sidebar border-black/5')}
      >
        <div className='flex gap-2 mb-2'>
          <div className='w-3 h-3 rounded-full bg-[#ff5f57] shadow-inner' />
          <div className='w-3 h-3 rounded-full bg-[#febc2e] shadow-inner' />
          <div className='w-3 h-3 rounded-full bg-[#28c840] shadow-inner' />
        </div>
        <div
          onClick={(e) => {
            e.stopPropagation()
            setShowProfilesSidebar(!showProfilesSidebar)
            loadProfiles()
          }}
          className={cn(
            'w-11 h-11 rounded-2xl border flex items-center justify-center text-xl mb-2 shadow-lg cursor-pointer transition-all duration-300 overflow-hidden shrink-0 group hover:ring-2 hover:ring-mac-blue/50 hover:ring-offset-2',
            isDark ? 'border-white/10 bg-gray-800' : 'border-white bg-white',
            showProfilesSidebar ? 'ring-2 ring-mac-blue ring-offset-2' : ''
          )}
        >
          {me && me.userId !== 0
            ? (
              <img
                src={getAvatarUrl('private', me.userId)}
                alt='me'
                className='w-full h-full object-cover transition-transform group-hover:scale-110'
              />
            )
            : (
              <Bot className='w-6 h-6 text-mac-text-secondary' />
            )}
        </div>
        <div className='flex flex-col gap-4'>
          <NavItem active={activeTab === 'chat'} onClick={() => setActiveTab('chat')}>
            <MessageSquare className='w-5 h-5' />
          </NavItem>
          <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
            <Settings className='w-5 h-5' />
          </NavItem>
        </div>
        <div className='mt-auto flex flex-col gap-3 mb-4'>
          <button
            onClick={() => setTheme('light')}
            className={cn(
              'p-2.5 rounded-xl transition-all duration-200',
              theme === 'light' ? 'bg-mac-blue text-white shadow-md' : 'text-mac-text-secondary hover:bg-black/5'
            )}
            title='白天模式'
          >
            <Sun className='w-4.5 h-4.5' />
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={cn(
              'p-2.5 rounded-xl transition-all duration-200',
              theme === 'dark' ? 'bg-mac-blue text-white shadow-md' : 'text-mac-text-secondary hover:bg-white/5'
            )}
            title='黑夜模式'
          >
            <Moon className='w-4.5 h-4.5' />
          </button>
          <button
            onClick={() => setTheme('system')}
            className={cn(
              'p-2.5 rounded-xl transition-all duration-200',
              theme === 'system' ? 'bg-mac-blue text-white shadow-md' : 'text-mac-text-secondary hover:bg-black/5'
            )}
            title='跟随系统'
          >
            <Monitor className='w-4.5 h-4.5' />
          </button>
        </div>
      </nav>

      {/* Profiles List Sidebar */}
      {showProfilesSidebar && (
        <div
          className={cn('w-[78px] border-r flex flex-col items-center py-6 gap-5 animate-in slide-in-from-left-4 duration-300 shrink-0 z-30 backdrop-blur-3xl shadow-2xl',
            isDark ? 'bg-gray-800/80 border-white/10' : 'bg-white/70 border-black/5')}
          onClick={(e) => e.stopPropagation()}
        >
          <div className='px-2 text-[10px] font-black uppercase tracking-widest text-mac-text-secondary opacity-40 mb-1'>角色</div>
          <div className='flex flex-col gap-4 w-full items-center overflow-y-auto no-scrollbar pb-6'>
            {profiles.map((p: UserInfo) => (
              <div
                key={p.userId}
                className='relative group cursor-pointer'
                onClick={() => switchUser(p.userId)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setContextMenu({ x: e.clientX, y: e.clientY, type: 'profile', data: p })
                }}
              >
                <div className={cn(
                  'w-13 h-13 rounded-2xl overflow-hidden border-2 transition-all duration-300 shadow-md',
                  me?.userId === p.userId
                    ? 'border-mac-blue scale-110 shadow-mac-blue/20'
                    : 'border-white/20 group-hover:border-mac-blue/50 group-hover:scale-105'
                )}
                >
                  <img src={getAvatarUrl('private', p.userId)} alt='' className='w-full h-full object-cover' />
                </div>
                {me?.userId === p.userId && (
                  <div className='absolute -bottom-1 -right-1 w-5 h-5 bg-mac-blue rounded-full border-[3px] border-white flex items-center justify-center shadow-lg'>
                    <div className='w-1.5 h-1.5 bg-white rounded-full' />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sidebar List */}
      <aside className={cn('w-[280px] flex flex-col border-r shrink-0 transition-all duration-300 relative z-20',
        isDark ? 'bg-gray-800/90 border-white/10' : 'bg-[#f6f6f6]/95 border-black/5')}
      >
        <div className='p-6 pb-2'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className={cn('text-xl font-bold tracking-tight', isDark ? 'text-white' : 'text-gray-900')}>消息</h2>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setPlusMenu({ x: e.clientX, y: e.clientY })
              }}
              className={cn('p-2 rounded-xl transition-all duration-200 active:scale-90',
                isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-black/5 text-mac-text-secondary')}
            >
              <Plus className='w-5 h-5' />
            </button>
          </div>
          <div className='relative flex items-center mb-4'>
            <input
              type='text'
              placeholder='搜索'
              className={cn('w-full rounded-2xl px-4 py-2 text-xs outline-none focus:ring-4 transition-all',
                isDark ? 'bg-black/20 border border-white/5 focus:ring-mac-blue/20 text-white' : 'bg-white border border-black/5 focus:ring-mac-blue/15 text-mac-text-main')}
            />
          </div>
        </div>
        <div className='flex-1 overflow-y-auto px-3 space-y-1.5 pb-6'>
          {contacts.length === 0 && (
            <div className='flex flex-col items-center justify-center h-40 opacity-30 select-none'>
              <div className='w-12 h-12 rounded-2xl border-2 border-dashed flex items-center justify-center mb-2'>
                <Plus className='w-6 h-6' />
              </div>
              <p className='text-xs font-bold'>暂无联系人</p>
            </div>
          )}
          {contacts.map((contact: Contact) => {
            const id = contact.type === 'private' ? contact.userId : contact.groupId
            const key = `${contact.type}-${id}`
            const cachedMsgs = messageCache[key]
            const cachedLast = cachedMsgs && cachedMsgs.length > 0 ? cachedMsgs[cachedMsgs.length - 1] : null
            const lastMsg = cachedLast && (!contact.lastMsg || cachedLast.timestamp >= contact.lastMsg.timestamp)
              ? cachedLast
              : contact.lastMsg
            const lastTime = lastMsg ? new Date(lastMsg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
            const unreadCount = contact.unreadCount || 0
            const name = contact.type === 'private' ? (contact as UserInfo).nickname : (contact as GroupInfo).groupName

            return (
              <div
                key={key}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setCurrentTarget({
                    type: contact.type,
                    id,
                    name
                  })
                  setContacts(contacts.map((c: Contact) => {
                    const cid = c.type === 'private' ? c.userId : c.groupId
                    if (c.type === contact.type && cid === id) {
                      return { ...c, unreadCount: 0 }
                    }
                    return c
                  }))
                  api.send(ActionTypes.SET_READ, {
                    type: contact.type,
                    targetId: id,
                    seq: lastMsg?.seq || 0
                  }).catch(() => { })
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setContextMenu({ x: e.clientX, y: e.clientY, type: 'contact', data: contact })
                }}
                className={cn(
                  'px-3.5 py-3 rounded-2xl flex items-center gap-3.5 cursor-pointer transition-all duration-200 group relative',
                  currentTarget?.id === id
                    ? 'bg-mac-blue text-white shadow-[0_8px_20px_-5px_rgba(0,122,255,0.4)] z-10'
                    : isDark ? 'hover:bg-white/5 active:bg-white/10' : 'hover:bg-white shadow-sm hover:shadow-md active:scale-[0.98]'
                )}
              >
                <div className='relative w-11 h-11 rounded-[14px] overflow-hidden shrink-0 shadow-sm transition-transform group-hover:scale-105'>
                  <img src={getAvatarUrl(contact.type, id, (contact as any).avatarUrl)} alt='avatar' className='w-full h-full object-cover' />
                </div>
                <div className='min-w-0 flex-1 py-0.5'>
                  <div className='flex justify-between items-center mb-1'>
                    <span className={cn(
                      'text-sm font-bold truncate tracking-tight',
                      currentTarget?.id === id ? 'text-white' : (isDark ? 'text-gray-100' : 'text-mac-text-main')
                    )}
                    >{name}
                    </span>
                    <span className={cn(
                      'text-[10px] font-medium shrink-0',
                      currentTarget?.id === id ? 'text-white/70' : (isDark ? 'text-gray-500' : 'text-mac-text-secondary')
                    )}
                    >{lastTime}
                    </span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <p className={cn(
                      'text-[11px] truncate flex-1 font-medium',
                      currentTarget?.id === id ? 'text-white/80' : (isDark ? 'text-gray-400' : 'text-mac-text-secondary')
                    )}
                    >
                      {getMessageSummary(lastMsg?.content)}
                      {lastMsg?.isRevoked === 1 && <span className='ml-1 opacity-70'>[已撤回]</span>}
                    </p>
                    {unreadCount > 0 && (
                      <div className='bg-red-500 text-white text-[9px] min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 font-black shadow-lg shadow-red-500/20 animate-in zoom-in'>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </aside>
    </>
  )
}
