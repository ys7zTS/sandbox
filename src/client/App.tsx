import React, { useEffect, useRef, useState } from 'react'
import {
  MessageSquare,
  Settings,
  Smile,
  FolderInput,
  Image as ImageIcon,
  Mic,
  Bot,
  X,
  Copy,
  Undo2,
  Trash2,
  Plus,
  LogOut,
  Users,
  FolderPlus,
  ChevronRight,
  Paperclip
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { MessageType } from '../types/Message'
import { ActionTypes } from '../core/protocol'
import { api } from './api'

function cn (...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface Message {
  seq: number
  type: 'private' | 'group'
  senderId: number
  targetId: number
  content: MessageType
  timestamp: number
  isRevoked: 0 | 1
}

type UploadedPart = {
  part: MessageType[number]
  preview: string
}

interface UserInfo {
  userId: number
  nickname: string
  age: number
  gender: 'male' | 'female' | 'unknown'
  friendList: number[]
  groupList?: number[]
}

interface GroupInfo {
  groupId: number
  groupName: string
  ownerId: string
  memberList: any[]
}

const getAvatarUrl = (type: 'private' | 'group', id: number | string) => {
  const finalId = (!id || id === 0 || id === '0') ? '10000' : id
  if (type === 'private') {
    return `https://q1.qlogo.cn/g?b=qq&s=640&nk=${finalId}`
  }
  return `https://p.qlogo.cn/gh/${finalId}/${finalId}/640`
}

export default function App () {
  const [activeTab, setActiveTab] = useState('chat')
  const [contacts, setContacts] = useState<((UserInfo & { type: 'private' }) | (GroupInfo & { type: 'group' }))[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [messageCache, setMessageCache] = useState<Record<string, Message[]>>(() => {
    try {
      const saved = localStorage.getItem('message_cache')
      return saved ? JSON.parse(saved) : {}
    } catch (e) {
      return {}
    }
  })
  const [currentTarget, setCurrentTarget] = useState<{ type: 'private' | 'group', id: number, name: string } | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [pendingParts, setPendingParts] = useState<UploadedPart[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [showMeSettings, setShowMeSettings] = useState(false)
  const [me, setMe] = useState<UserInfo | null>(null)
  const [profiles, setProfiles] = useState<UserInfo[]>([])
  const [showProfilesSidebar, setShowProfilesSidebar] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [detailInfo, setDetailInfo] = useState<any>(null)
  const [editInfo, setEditInfo] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'dissolve' | 'friend' | 'user' | 'group', id: number, clearMessages: boolean } | null>(null)
  const [plusMenu, setPlusMenu] = useState<{ x: number, y: number } | null>(null)
  const [showCreateModal, setShowCreateModal] = useState<'private' | 'group' | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [createData, setCreateData] = useState({ name: '', id: '', age: 20, gender: 'unknown' as any })
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'message' | 'contact' | 'profile', data: any } | null>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [showSendTip, setShowSendTip] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isMember = currentTarget?.type === 'group' && !!me && me.userId !== 0 && !!editInfo?.memberList && editInfo.memberList.some((m: any) => String(m.userId) === String(me.userId))
  const isOwner = currentTarget?.type === 'group' && !!me && me.userId !== 0 && !!editInfo && String(editInfo.ownerId) === String(me.userId)

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const renderMessagePart = (part: MessageType[number], idx: number) => {
    switch (part.type) {
      case 'text':
        return <span key={idx}>{part.text}</span>
      case 'image':
        return <img key={idx} src={part.url || part.uri} alt='' className='max-w-full rounded-lg shadow-sm' />
      case 'video':
        return (
          <video key={idx} controls className='max-w-full rounded-lg shadow-sm'>
            <source src={part.url || part.uri} />
          </video>
        )
      case 'file':
        return (
          <a key={idx} href={part.url || part.uri} target='_blank' rel='noreferrer' className='text-xs underline flex items-center gap-1'>
            <Paperclip className='w-3 h-3' /> {part.filename || '文件'}
          </a>
        )
      case 'reply':
        return <span key={idx} className='text-[11px] text-mac-text-secondary bg-mac-active px-2 py-0.5 rounded-full'>引用消息 #{part.messageSeq}</span>
      case 'at':
        return <span key={idx} className='text-mac-blue font-semibold'>@{part.targetId === 'all' ? '全体成员' : part.targetId}</span>
      default:
        return null
    }
  }

  const uploadFile = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    if (!res.ok) throw new Error('upload failed')
    const data = await res.json()
    console.log('[UI] upload', data)

    const mime = data.mime || file.type || ''
    let part: MessageType[number]
    if (mime.startsWith('image/')) {
      part = { type: 'image', uri: data.url, url: data.url, name: data.filename, size: data.size }
    } else if (mime.startsWith('video/')) {
      part = { type: 'video', uri: data.url, url: data.url, filename: data.filename, size: data.size }
    } else {
      part = { type: 'file', uri: data.url, url: data.url, filename: data.filename, size: data.size }
    }

    return { part, preview: data.url } as UploadedPart
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    try {
      const uploaded: UploadedPart[] = []
      for (const f of files) {
        const up = await uploadFile(f)
        uploaded.push(up)
      }
      setPendingParts(prev => [...prev, ...uploaded])
    } catch (err) {
      console.error('upload failed', err)
      setToast('上传失败')
    } finally {
      if (e.target) e.target.value = ''
    }
  }

  useEffect(() => {
    localStorage.setItem('message_cache', JSON.stringify(messageCache))
  }, [messageCache])

  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  useEffect(() => {
    console.log('[UI] App mounted, connecting to WebSocket...')
    api.connect().then(() => {
      console.log('[UI] WebSocket connected successfully')
      loadMe()
      loadProfiles()
    }).catch(err => {
      console.error('[UI] WebSocket connection failed:', err)
    })
  }, [])

  useEffect(() => {
    const unbind = api.on(ActionTypes.PUSH_MESSAGE, (msg: Message) => {
      console.log('[UI] push message', msg)
      // 如果消息属于当前会话，则更新 messages
      const isCurrent = currentTarget && (
        (msg.type === 'group' && msg.targetId === currentTarget.id) ||
        (msg.type === 'private' && (msg.targetId === currentTarget.id || msg.senderId === currentTarget.id))
      )

      // 更新缓存
      const key = `${msg.type}-${msg.type === 'group' ? msg.targetId : (msg.senderId === me?.userId ? msg.targetId : msg.senderId)}`
      setMessageCache(prev => {
        const existing = prev[key] || []
        // 避免重复
        if (existing.some(m => m.seq === msg.seq)) return prev
        return { ...prev, [key]: [...existing, msg] }
      })

      if (isCurrent) {
        setMessages(prev => {
          if (prev.some(m => m.seq === msg.seq)) return prev
          return [...prev, msg]
        })
      }
    })

    return () => { unbind() }
  }, [currentTarget, me])

  useEffect(() => {
    loadContacts()
    if (me?.userId === 0) {
      setCurrentTarget(null)
    }
  }, [me])

  useEffect(() => {
    if (!currentTarget) {
      setMessages([])
      return
    }

    // 立即从缓存加载
    const key = `${currentTarget.type}-${currentTarget.id}`
    if (messageCache[key]) {
      setMessages(messageCache[key])
    } else {
      setMessages([])
    }

    // 立即抓取最新消息
    fetchMessages()
  }, [currentTarget])

  useEffect(scrollToBottom, [messages])

  useEffect(() => {
    if (showSettings && currentTarget) {
      fetchDetail()
    } else if (showMeSettings) {
      setEditInfo(me ? { ...me } : { userId: '', nickname: '', age: 0, gender: 'unknown' })
    } else {
      setEditInfo(null)
    }
  }, [showSettings, showMeSettings, currentTarget])

  const loadMe = async () => {
    try {
      const data = await api.getUserInfo('current') as any
      console.log('[UI] get active user', data)
      setMe(data || { userId: 0, nickname: '未登录', age: 0, gender: 'unknown', friendList: [] })
    } catch (e) {
      setMe({ userId: 0, nickname: '未登录', age: 0, gender: 'unknown', friendList: [] })
    }
  }

  const loadProfiles = async () => {
    try {
      const data = await api.getUserInfo() as any
      console.log('[UI] load profiles', data)
      setProfiles(Array.isArray(data) ? data : [])
    } catch (e) {
      setProfiles([])
    }
  }

  const switchUser = async (userId: number) => {
    try {
      await api.setActiveUser(userId)
      await loadMe()
      setContacts([])
      setCurrentTarget(null)
      setMessages([])
    } catch (e) {
      alert('切换失败')
    }
  }

  const handleSaveMe = async () => {
    if (!editInfo || !editInfo.userId) return
    try {
      await api.saveUser(editInfo)
      setShowMeSettings(false)
      loadMe()
    } catch (e) {
      alert('保存失败')
    }
  }

  const fetchDetail = async () => {
    if (!currentTarget) return
    try {
      const data = currentTarget.type === 'private'
        ? await api.getUserInfo(currentTarget.id)
        : await api.getGroupInfo(currentTarget.id)
      setDetailInfo(data as any)
      setEditInfo(data ? { ...(data as any) } : null)
    } catch (e) {
      console.error('Failed to fetch detail', e)
    }
  }

  const handleSave = async () => {
    if (!currentTarget || !editInfo) return
    try {
      if (currentTarget.type === 'private') {
        await api.saveUser({ ...editInfo, userId: currentTarget.id })
      } else {
        await api.saveGroup({ ...editInfo, groupId: currentTarget.id })
      }
      setShowSettings(false)
      loadContacts()
    } catch (e) {
      alert('保存失败')
    }
  }

  const confirmDelete = async (mode: 'clear' | 'only') => {
    if (!showDeleteConfirm) return
    const { type, id } = showDeleteConfirm

    try {
      if (type === 'user') {
        await api.removeUser(id, { clearMessages: mode === 'clear' })
        if (me?.userId === id) {
          setMe({ userId: 0, nickname: '未登录', age: 0, gender: 'unknown', friendList: [] })
          setCurrentTarget(null)
          setContacts([])
        }
        loadProfiles()
      } else if (type === 'friend') {
        await api.updateFriendship({ userAId: me?.userId, userBId: id, action: 'remove', clearMessages: mode === 'clear' })
        loadMe()
        loadContacts()
      } else if (type === 'group') {
        await api.removeGroup(id, { clearMessages: mode === 'clear' })
        loadMe()
        loadContacts()
      }

      setShowDeleteConfirm(null)
      setShowSettings(false)
      if (currentTarget?.id === id) {
        setCurrentTarget(null)
      }
    } catch (e) {
      alert('删除失败')
    }
  }

  const handleDelete = async () => {
    if (!currentTarget || !me) return
    const isFriend = me.friendList?.includes(currentTarget.id)

    if (currentTarget.type === 'private' && !isFriend) {
      setToast('好友申请已发送')

      try {
        await api.updateFriendship({ userAId: me.userId, userBId: currentTarget.id, action: 'add' })
        loadMe()
        loadContacts()
      } catch (e) {
        console.error('Failed to add friend', e)
      }
      return
    }

    setShowDeleteConfirm({
      type: currentTarget.type === 'private' ? 'friend' : 'group',
      id: currentTarget.id,
      clearMessages: true
    })
  }

  const handleGroupAction = async (action: 'join' | 'leave') => {
    if (!currentTarget || !me) return
    try {
      if (action === 'join') {
        await api.joinGroup(currentTarget.id, me.userId)
      } else {
        await api.leaveGroup(currentTarget.id, me.userId)
      }
      fetchDetail()
      loadContacts()
    } catch (e) {
      alert('操作失败')
    }
  }

  const loadContacts = async () => {
    try {
      const [users, groups] = await Promise.all([
        api.getUserInfo() as Promise<any[]>,
        api.getGroupInfo() as Promise<any[]>
      ])

      console.log('[UI] contacts', { users, groups })

      const filteredUsers = (Array.isArray(users) ? users : [])
        .map((u: any) => ({ ...u, type: 'private' }))

      const filteredGroups = (Array.isArray(groups) ? groups : [])
        .map((g: any) => ({ ...g, type: 'group' }))

      setContacts([...filteredUsers, ...filteredGroups])
    } catch (e) {
      console.error('Failed to load contacts', e)
    }
  }

  const fetchMessages = async () => {
    if (!currentTarget) return
    try {
      const data = await api.getMessages({ type: currentTarget.type, targetId: currentTarget.id }) as Message[]

      console.log('[UI] fetch messages', currentTarget, data)

      const key = `${currentTarget.type}-${currentTarget.id}`
      const existing = messageCache[key] || []

      // 仅在数据变化时更新 state 和缓存
      if (JSON.stringify(existing) !== JSON.stringify(data)) {
        setMessageCache(prev => ({ ...prev, [key]: data }))
        setMessages(data)
      }
    } catch (e) {
      console.error('Failed to fetch messages', e)
    }
  }

  const sendMessage = async () => {
    if (!currentTarget || !me) return

    const parts: MessageType = []
    if (replyTo) parts.push({ type: 'reply', messageSeq: replyTo.seq })
    if (inputValue.trim()) parts.push({ type: 'text', text: inputValue.trim() })
    pendingParts.forEach(item => parts.push(item.part))

    if (parts.length === 0) return

    try {
      console.log('[UI] send message', { parts, target: currentTarget, me })
      await api.sendMessage({
        type: currentTarget.type,
        senderId: me.userId,
        targetId: currentTarget.id,
        content: parts
      })
      setInputValue('')
      setReplyTo(null)
      setPendingParts([])
    } catch (e) {
      alert('发送失败')
    }
  }

  const handleRecall = async (seq: number) => {
    try {
      await api.recallMessage(currentTarget?.type || 'private', seq)
      fetchMessages()
    } catch (e) {
      alert('撤回失败')
    }
  }

  const isCreateValid = () => {
    return !getCreateError() && !!createData.id
  }

  const getCreateError = () => {
    if (backendError) return backendError
    if (!createData.id) return '请输入 ID'
    if (!/^\d+$/.test(createData.id)) return 'ID 必须由纯数字组成'

    const len = createData.id.length
    if (showCreateModal === 'private') {
      if (len < 5 || len > 10) return 'QQ号应为 5-10 位'
      const exists = profiles.some(p => String(p.userId) === createData.id)
      if (exists) return '该用户已存在'
    } else if (showCreateModal === 'group') {
      if (len < 5 || len > 11) return '群号应为 5-11 位'
      const exists = contacts.some(c => c.type === 'group' && String(c.groupId) === createData.id)
      if (exists) return '该群聊已在你的列表中'
    }
    return null
  }

  const handleCreateContact = async () => {
    if (!isCreateValid()) return
    try {
      const isPrivate = showCreateModal === 'private'
      if (isPrivate) {
        await api.saveUser({
          userId: Number(createData.id),
          nickname: createData.name,
          age: Number(createData.age),
          gender: createData.gender
        })
        if (me?.userId) {
          await api.updateFriendship({ userAId: me.userId, userBId: Number(createData.id), action: 'add' })
        }
      } else {
        await api.saveGroup({
          groupId: Number(createData.id),
          groupName: createData.name,
          ownerId: me?.userId
        })
        if (me?.userId) {
          await api.joinGroup(Number(createData.id), me.userId)
        }
      }
      setShowCreateModal(null)
      setBackendError(null)
      setCreateData({ name: '', id: '', age: 20, gender: 'unknown' })
      setToast(isPrivate ? '用户添加成功' : '群聊创建成功')
      await loadMe()
      await loadContacts()
      await loadProfiles()
    } catch (e) {
      setBackendError('创建失败')
    }
  }

  return (
    <div
      className='flex h-screen bg-white font-sans antialiased text-mac-text-main overflow-hidden'
      onClick={() => {
        setContextMenu(null)
        setPlusMenu(null)
        setShowDeleteConfirm(null)
      }}
    >
      {/* Left Nav Rail */}
      <nav className='w-16 bg-mac-sidebar flex flex-col items-center py-5 border-r border-mac-border gap-6 shrink-0'>
        <div className='flex gap-1.5 mb-2'>
          <div className='w-3 h-3 rounded-full bg-[#ff5f57]' />
          <div className='w-3 h-3 rounded-full bg-[#febc2e]' />
          <div className='w-3 h-3 rounded-full bg-[#28c840]' />
        </div>
        <div
          onClick={(e) => {
            e.stopPropagation()
            setShowProfilesSidebar(!showProfilesSidebar)
            loadProfiles()
          }}
          className={cn(
            'w-10 h-10 rounded-xl bg-white border border-mac-border flex items-center justify-center text-xl mb-1 shadow-sm cursor-pointer hover:bg-mac-active transition-all overflow-hidden shrink-0',
            showProfilesSidebar && 'ring-2 ring-mac-blue ring-offset-2'
          )}
        >
          {me && me.userId !== 0
            ? (
              <img
                src={getAvatarUrl('private', me.userId)}
                alt='me'
                className='w-full h-full object-cover'
              />
            )
            : (
              <Bot className='w-6 h-6 text-mac-text-secondary' />
            )}
        </div>
        <NavItem active={activeTab === 'chat'} onClick={() => setActiveTab('chat')}>
          <MessageSquare className='w-5 h-5' />
        </NavItem>
        <NavItem active={activeTab === 'settings'} onClick={() => setShowSettings(true)}>
          <Settings className='w-5 h-5' />
        </NavItem>
        <div className='mt-auto' />
      </nav>

      {/* Profiles List Sidebar */}
      {showProfilesSidebar && (
        <div
          className='w-[72px] bg-[#f0f0f0] border-r border-mac-border flex flex-col items-center py-4 gap-4 animate-in slide-in-from-left-4 duration-200 shrink-0'
          onClick={(e) => e.stopPropagation()}
        >
          <div className='flex flex-col gap-3 w-full items-center overflow-y-auto overflow-x-hidden no-scrollbar pb-4'>
            {profiles.map(p => (
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
                  'w-12 h-12 rounded-xl overflow-hidden border-2 transition-all',
                  me?.userId === p.userId ? 'border-mac-blue shadow-md' : 'border-transparent hover:border-mac-border'
                )}
                >
                  <img src={getAvatarUrl('private', p.userId)} alt='' className='w-full h-full object-cover' />
                </div>
                {me?.userId === p.userId && (
                  <div className='absolute -bottom-1 -right-1 w-4 h-4 bg-mac-blue rounded-full border-2 border-white flex items-center justify-center'>
                    <div className='w-1.5 h-1.5 bg-white rounded-full' />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sidebar List */}
      <aside className='w-64 bg-mac-sidebar flex flex-col border-r border-mac-border shrink-0'>
        <div className='p-4'>
          <div className='relative flex items-center gap-2'>
            <input
              type='text'
              placeholder='搜索'
              className='flex-1 bg-white border border-mac-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-mac-blue/20 transition-all'
            />
            <button
              onClick={(e) => {
                e.stopPropagation()
                setPlusMenu({ x: e.clientX, y: e.clientY })
              }}
              className='p-1.5 hover:bg-black/5 rounded-lg transition-all text-mac-text-secondary shrink-0'
            >
              <Plus className='w-4 h-4' />
            </button>
          </div>
        </div>
        <div className='flex-1 overflow-y-auto px-2'>
          {contacts.map((contact: any) => {
            const id = contact.userId || contact.groupId
            const key = `${contact.type}-${id}`
            const cachedMsgs = messageCache[key] || []
            const lastMsg = cachedMsgs[cachedMsgs.length - 1]
            const lastTime = lastMsg ? new Date(lastMsg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''

            return (
              <div
                key={key}
                onClick={() => setCurrentTarget({
                  type: contact.type,
                  id,
                  name: contact.nickname || contact.groupName
                })}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setContextMenu({ x: e.clientX, y: e.clientY, type: 'contact', data: contact })
                }}
                className={cn(
                  'px-3 py-2.5 flex items-center gap-3 cursor-pointer rounded-xl transition-all mb-1',
                  currentTarget?.id === id
                    ? 'bg-mac-blue text-white shadow-md'
                    : 'hover:bg-mac-active'
                )}
              >
                <div className='w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm overflow-hidden'>
                  <img src={getAvatarUrl(contact.type, id)} alt='avatar' className='w-full h-full object-cover' />
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='flex justify-between items-center mb-0.5'>
                    <span className={cn(
                      'text-sm font-medium truncate',
                      currentTarget?.id === id ? 'text-white' : 'text-mac-text-main'
                    )}
                    >{contact.nickname || contact.groupName}
                    </span>
                    <span className={cn(
                      'text-[10px]',
                      currentTarget?.id === id ? 'text-white/70' : 'text-mac-text-secondary'
                    )}
                    >{lastTime}
                    </span>
                  </div>
                  <p className={cn(
                    'text-xs truncate',
                    currentTarget?.id === id ? 'text-white/80' : 'text-mac-text-secondary'
                  )}
                  >
                    {lastMsg
                      ? (Array.isArray(lastMsg.content)
                        ? ((lastMsg.content.find((p: any) => p.type === 'text') as any)?.text || `[${lastMsg.content[0]?.type || '多媒体'}]`)
                        : lastMsg.content)
                      : '[暂无消息]'}
                    {lastMsg?.isRevoked === 1 && <span className='ml-1 opacity-70'>[已撤回]</span>}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className='flex-1 flex flex-col relative bg-white'>
        <div className='absolute inset-0 flex flex-col'>
          {!me || me.userId === 0
            ? (
              <div className='flex-1 flex flex-col items-center justify-center text-gray-600 bg-mac-sidebar/50'>
                <div className='w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6 border border-mac-border animate-bounce'>
                  <Bot className='w-12 h-12 text-mac-blue' />
                </div>
                <h2 className='text-xl font-bold text-mac-text'>欢迎使用 Sandbox</h2>
                <p className='text-sm text-mac-text-secondary mt-2 mb-8'>点击左侧 <span className='inline-flex items-center justify-center w-5 h-5 bg-white border border-mac-border rounded text-mac-text-main font-bold'>+</span> 创建身份</p>
              </div>
            )
            : !currentTarget
              ? (
                <div className='flex-1 flex flex-col items-center justify-center text-gray-600'>
                  <Bot className='w-24 h-24 mb-5 text-gray-300' />
                  <span className='text-lg'>发现精彩，开启沟通之旅</span>
                </div>
              )
              : (
                <>
                  <header className='h-[52px] px-6 flex items-center justify-between border-b border-mac-border bg-white/80 backdrop-blur-md sticky top-0 z-10'>
                    <div className='flex flex-col'>
                      <h2 className='text-sm font-bold'>{currentTarget.name}</h2>
                      <span className='text-[10px] text-mac-text-secondary'>
                        {messages.length > 0
                          ? `最近消息: ${new Date(messages[messages.length - 1].timestamp * 1000).toLocaleString()}`
                          : '暂无消息'}
                      </span>
                    </div>
                    <div className='flex gap-4 text-mac-text-secondary'>
                      <Settings
                        className='w-4 h-4 cursor-pointer hover:text-mac-blue transition-colors'
                        onClick={() => setShowSettings(true)}
                      />
                    </div>
                  </header>

                  <div className='flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-[#fafafa]'>
                    {messages.map((m, index) => {
                      const isMe = me && m.senderId === me.userId
                      const isRecalled = m.isRevoked === 1

                      // Show time strip if gap > 10 minutes
                      const prevMsg = messages[index - 1]
                      const showTime = !prevMsg || (m.timestamp - prevMsg.timestamp) > 600

                      return (
                        <React.Fragment key={m.seq}>
                          {showTime && (
                            <div className='self-center text-mac-text-secondary text-[10px] my-2 font-medium bg-mac-active px-3 py-1 rounded-full'>
                              {new Date(m.timestamp * 1000).toLocaleString()}
                            </div>
                          )}
                          <div
                            className={cn('flex flex-col gap-1 max-w-[75%]', !isMe ? 'self-start items-start' : 'self-end items-end')}
                          >
                            <div className={cn('flex gap-3 relative', isMe && 'flex-row-reverse')}>
                              <div className='w-9 h-9 rounded-xl bg-white border border-mac-border flex items-center justify-center text-lg shadow-sm shrink-0 overflow-hidden'>
                                <img
                                  src={getAvatarUrl('private', m.senderId)}
                                  alt='avatar'
                                  className='w-full h-full object-cover'
                                />
                              </div>
                              <div
                                onContextMenu={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setContextMenu({ x: e.clientX, y: e.clientY, type: 'message', data: m })
                                }}
                                className={cn(
                                  'px-4 py-2.5 rounded-2xl text-[13px] shadow-sm break-all leading-relaxed relative transition-all cursor-default flex flex-col gap-1.5',
                                  isMe ? 'bg-mac-blue text-white' : 'bg-white text-mac-text-main border border-mac-border',
                                  isRecalled && 'opacity-60 grayscale-[0.5] border-red-400 border-2 bg-red-50 text-red-700'
                                )}
                              >
                                {Array.isArray(m.content)
                                  ? m.content.map((part, i) => renderMessagePart(part, i))
                                  : renderMessagePart({ type: 'text', text: String(m.content) } as any, 0)}
                                {isRecalled && (
                                  <span className='absolute -top-2 -right-2 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full shadow-sm blink'>
                                    已撤回
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  <footer className='bg-white border-t border-mac-border p-4'>
                    {replyTo && (
                      <div className='mb-2 px-3 py-1.5 bg-mac-active rounded-lg flex items-center justify-between animate-in slide-in-from-bottom-2 duration-200'>
                        <div className='flex flex-col min-w-0'>
                          <span className='text-[10px] font-bold text-mac-blue uppercase'>正在回复 {replyTo.senderId}</span>
                          <span className='text-xs text-mac-text-secondary truncate'>
                            {Array.isArray(replyTo.content)
                              ? replyTo.content.map((p: any) => p.text || '[图片]').join(' ')
                              : replyTo.content}
                          </span>
                        </div>
                        <X className='w-4 h-4 cursor-pointer text-mac-text-secondary hover:text-mac-text-main' onClick={() => setReplyTo(null)} />
                      </div>
                    )}
                    <div className='flex gap-4 px-2 py-2 text-mac-text-secondary mb-2'>
                      <Smile className='w-5 h-5 cursor-pointer hover:text-mac-blue transition-colors' />
                      <ImageIcon className='w-5 h-5 cursor-pointer hover:text-mac-blue transition-colors' onClick={() => fileInputRef.current?.click()} />
                      <FolderInput className='w-5 h-5 cursor-pointer hover:text-mac-blue transition-colors' onClick={() => fileInputRef.current?.click()} />
                      <Mic className='w-5 h-5 cursor-pointer hover:text-mac-blue transition-colors' />
                    </div>
                    <input
                      type='file'
                      ref={fileInputRef}
                      multiple
                      onChange={handleFileChange}
                      className='hidden'
                    />
                    {pendingParts.length > 0 && (
                      <div className='flex flex-wrap gap-3 px-2 pb-2'>
                        {pendingParts.map((p, idx) => (
                          <div key={idx} className='relative bg-white border border-mac-border rounded-lg shadow-sm p-2 flex items-center gap-2'>
                            {p.part.type === 'image'
                              ? <img src={p.preview} className='w-16 h-16 object-cover rounded-md' />
                              : p.part.type === 'video'
                                ? <video src={p.preview} className='w-20 h-14 rounded-md object-cover' />
                                : <div className='flex items-center gap-1 text-xs text-mac-text-secondary'><Paperclip className='w-3 h-3' />{(p.part as any).filename || '文件'}</div>}
                            <button
                              className='absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow'
                              onClick={() => setPendingParts(prev => prev.filter((_, i) => i !== idx))}
                            >
                              <X className='w-3 h-3' />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className='relative bg-mac-sidebar rounded-xl border border-mac-border focus-within:border-mac-blue/50 focus-within:bg-white transition-all'>
                      <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendMessage()
                          }
                        }}
                        placeholder='输入消息...'
                        className='w-full bg-transparent border-none outline-none resize-none text-[13px] p-3 min-h-[100px]'
                      />
                      <div className='flex justify-end p-2 relative'>
                        <div
                          onMouseMove={(e) => {
                            if (!me || me.userId === 0) {
                              setMousePos({ x: e.clientX, y: e.clientY })
                            }
                          }}
                          onMouseEnter={() => (!me || me.userId === 0) && setShowSendTip(true)}
                          onMouseLeave={() => setShowSendTip(false)}
                          className={cn('relative inline-block', (!me || me.userId === 0) && 'cursor-not-allowed')}
                        >
                          <button
                            onClick={sendMessage}
                            disabled={(!inputValue.trim() && pendingParts.length === 0) || !me || me.userId === 0}
                            className={cn(
                              'px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm',
                              (inputValue.trim() || pendingParts.length > 0) && me && me.userId !== 0
                                ? 'bg-mac-blue text-white hover:opacity-90'
                                : 'bg-gray-200 text-gray-400',
                              (!me || me.userId === 0) && 'pointer-events-none'
                            )}
                          >
                            发送
                          </button>
                        </div>

                        {showSendTip && (!me || me.userId === 0) && (
                          <div
                            className='fixed z-[200] bg-white border border-red-200 shadow-xl px-3 py-1.5 rounded-lg text-red-500 text-[11px] font-medium pointer-events-none whitespace-nowrap'
                            style={{
                              left: mousePos.x + 10,
                              top: mousePos.y + 10,
                              transform: `translate(${mousePos.x + 240 > window.innerWidth ? '-100%' : '0'}, ${mousePos.y + 30 > window.innerHeight ? '-100%' : '0'})`
                            }}
                          >
                            请先选择或创建一个操控账号
                          </div>
                        )}
                      </div>
                    </div>
                  </footer>
                </>
              )}
        </div>

        {/* Settings / User Detail Overlay (Right Sidebar) */}
        {showSettings && currentTarget && (
          <div className='absolute inset-y-0 right-0 z-50 w-80 bg-[#f8f9fa] border-l border-mac-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300'>
            {/* Header */}
            <div className='h-[52px] px-4 border-b border-mac-border bg-white/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-10'>
              <h2 className='text-sm font-bold text-mac-text-main'>
                {currentTarget.type === 'private' ? '编辑资料' : '群聊详情'}
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className='p-1.5 hover:bg-black/5 rounded-lg transition-all'
              >
                <X className='w-4 h-4 text-mac-text-secondary' />
              </button>
            </div>

            <div className='flex-1 overflow-y-auto custom-scrollbar bg-[#f2f3f5]'>
              {/* Hero Section */}
              <div className='bg-white p-6 flex flex-col items-center gap-4 mb-2'>
                <div className='w-20 h-20 rounded-2xl shadow-xl border-4 border-white overflow-hidden relative group'>
                  <img
                    src={currentTarget.type === 'private'
                      ? `https://q1.qlogo.cn/g?b=qq&s=640&nk=${currentTarget.id}`
                      : `https://p.qlogo.cn/gh/${currentTarget.id}/${currentTarget.id}/640/`}
                    alt='avatar'
                    className='w-full h-full object-cover'
                  />
                </div>
                <div className='text-center space-y-1'>
                  <h3 className='text-lg font-bold text-mac-text-main truncate max-w-[200px]'>
                    {editInfo?.nickname || editInfo?.groupName || '未命名'}
                  </h3>
                  <div className='inline-flex items-center px-2 py-0.5 bg-mac-active rounded-md text-[11px] text-mac-text-secondary font-medium'>
                    {currentTarget.type === 'private' ? 'QQ: ' : '群号: '}{currentTarget.id}
                  </div>
                </div>
              </div>

              {/* Members Section */}
              {currentTarget.type === 'group' && (
                <div className='bg-white p-4 mb-2'>
                  <div className='flex items-center justify-between mb-4'>
                    <span className='text-xs font-bold text-mac-text-main'>群聊成员</span>
                    <div className='flex items-center gap-0.5 text-[11px] text-mac-text-secondary hover:text-mac-blue cursor-pointer transition-colors'>
                      共 {editInfo?.memberList?.length || 0} 人 <ChevronRight className='w-3 h-3 mt-0.5' />
                    </div>
                  </div>
                  <div className='grid grid-cols-5 gap-y-5 gap-x-2'>
                    {editInfo?.memberList?.slice(0, 8).map((m: any) => (
                      <div key={m.userId} className='flex flex-col items-center gap-1.5'>
                        <div className='w-9 h-9 rounded-full bg-mac-active overflow-hidden border border-mac-border shadow-sm'>
                          <img
                            src={`https://q1.qlogo.cn/g?b=qq&s=100&nk=${m.userId}`}
                            className='w-full h-full object-cover'
                          />
                        </div>
                        <span className='text-[10px] text-mac-text-secondary truncate w-full text-center px-0.5'>{m.nickname}</span>
                      </div>
                    ))}
                    <div className='flex flex-col items-center gap-1.5 group cursor-pointer'>
                      <div className='w-9 h-9 rounded-full border-2 border-dashed border-mac-border flex items-center justify-center group-hover:border-mac-blue group-hover:bg-mac-blue/5 transition-all'>
                        <Plus className='w-4 h-4 text-mac-text-secondary group-hover:text-mac-blue' />
                      </div>
                      <span className='text-[10px] text-mac-text-secondary group-hover:text-mac-blue font-medium'>邀请</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Detail Info Section */}
              <div className='bg-white mb-2 divide-y divide-mac-border'>
                {currentTarget.type === 'private'
                  ? (
                    <>
                      <div className='px-4 py-3 flex flex-col gap-1.5'>
                        <label className='text-[10px] text-mac-text-secondary font-bold uppercase tracking-wider'>昵称</label>
                        <input
                          type='text'
                          value={editInfo?.nickname || ''}
                          onChange={(e) => setEditInfo((prev: any) => (prev ? { ...prev, nickname: e.target.value } : null))}
                          className='w-full text-sm bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-mac-blue/20 rounded-md py-1 transition-all'
                        />
                      </div>
                      <div className='flex'>
                        <div className='flex-1 px-4 py-3 border-r border-mac-border flex flex-col gap-1.5'>
                          <label className='text-[10px] text-mac-text-secondary font-bold uppercase tracking-wider'>年龄</label>
                          <input
                            type='number'
                            value={editInfo?.age || 0}
                            onChange={(e) => setEditInfo((prev: any) => (prev ? { ...prev, age: Number(e.target.value) } : null))}
                            className='w-full text-sm bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-mac-blue/20 rounded-md py-1 transition-all'
                          />
                        </div>
                        <div className='flex-1 px-4 py-3 flex flex-col gap-1.5'>
                          <label className='text-[10px] text-mac-text-secondary font-bold uppercase tracking-wider'>性别</label>
                          <select
                            value={editInfo?.gender || 'unknown'}
                            onChange={(e) => setEditInfo((prev: any) => (prev ? { ...prev, gender: e.target.value } : null))}
                            className='w-full text-sm bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-mac-blue/20 rounded-md py-1 transition-all'
                          >
                            <option value='male'>男</option>
                            <option value='female'>女</option>
                            <option value='unknown'>未知</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )
                  : (
                    <>
                      <div className='px-4 py-4 flex items-center justify-between group cursor-pointer hover:bg-mac-active transition-all'>
                        <span className='text-xs font-medium text-mac-text-main'>群资料设置</span>
                        <ChevronRight className='w-4 h-4 text-mac-text-secondary group-hover:translate-x-0.5 transition-transform' />
                      </div>
                      <div className='px-4 py-4 flex flex-col gap-1'>
                        <div className='flex items-center justify-between'>
                          <span className='text-xs font-medium text-mac-text-main'>群公告</span>
                          <ChevronRight className='w-4 h-4 text-mac-text-secondary' />
                        </div>
                        <p className='text-[10px] text-mac-text-secondary line-clamp-2 mt-1'>暂无公告</p>
                      </div>
                    </>
                  )}
              </div>

              {/* Actions */}
              <div className='p-6 flex flex-col gap-3'>
                {JSON.stringify(editInfo) !== JSON.stringify(detailInfo) && (
                  <button
                    onClick={handleSave}
                    className='w-full py-2.5 bg-mac-blue text-white rounded-xl font-bold text-sm shadow-lg shadow-mac-blue/20 hover:opacity-90 active:scale-[0.98] transition-all'
                  >
                    保存资料更改
                  </button>
                )}

                {currentTarget.type === 'group' && (
                  !isMember
                    ? (
                      <button
                        onClick={() => handleGroupAction('join')}
                        className='w-full py-2.5 bg-mac-blue text-white rounded-xl font-bold text-sm shadow-lg shadow-mac-blue/20 hover:opacity-90 active:scale-[0.98] transition-all'
                      >
                        申请加入该群
                      </button>
                    )
                    : (
                      <div className='flex flex-col gap-3'>
                        <button
                          onClick={() => handleGroupAction('leave')}
                          className='w-full py-2.5 bg-red-50 text-red-500 rounded-xl font-bold text-sm hover:bg-red-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2'
                        >
                          <LogOut className='w-4 h-4' /> 退出群聊
                        </button>
                        {isOwner && (
                          <button
                            onClick={handleDelete}
                            className='w-full py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20'
                          >
                            <Trash2 className='w-4 h-4' /> 解散群聊
                          </button>
                        )}
                      </div>
                    )
                )}

                {currentTarget.type === 'private' && (
                  <button
                    onClick={() => {
                      if (!me || me.userId === 0) {
                        setToast('请先在左侧选择或创建一个操作身份')
                        return
                      }
                      handleDelete()
                    }}
                    className={cn(
                      'w-full py-2.5 rounded-xl font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2',
                      me?.friendList?.includes(currentTarget.id)
                        ? 'bg-red-50 text-red-500 hover:bg-red-100'
                        : 'bg-mac-blue text-white shadow-lg shadow-mac-blue/20 hover:opacity-90'
                    )}
                  >
                    {me?.friendList?.includes(currentTarget.id) ? <><Trash2 className='w-4 h-4' /> 删除好友</> : <><Plus className='w-4 h-4' /> 添加好友</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Unified Deletion Confirmation */}
        {showDeleteConfirm && (
          <div className='absolute inset-0 z-[300] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200'>
            <div className='w-[320px] bg-white rounded-2xl shadow-2xl border border-mac-border overflow-hidden flex flex-col animate-in zoom-in-95 duration-200'>
              <div className='p-6 text-center space-y-4'>
                <div className='w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto'>
                  <Trash2 className='w-6 h-6 text-red-500' />
                </div>
                <div>
                  <h3 className='text-sm font-bold text-mac-text-main'>
                    删除{showDeleteConfirm.type === 'user' ? '身份' : showDeleteConfirm.type === 'friend' ? '好友' : '群聊'}确认
                  </h3>
                  <p className='text-xs text-mac-text-secondary mt-2 leading-relaxed'>
                    确定要删除该{showDeleteConfirm.type === 'user' ? '身份' : showDeleteConfirm.type === 'friend' ? '好友' : '群聊'}吗？此操作不可撤销。
                  </p>
                </div>
                <div className='flex flex-col gap-2 pt-2'>
                  <button
                    onClick={() => confirmDelete('clear')}
                    className='w-full py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors'
                  >
                    选项一：清理所有数据(包括记录)
                  </button>
                  <button
                    onClick={() => confirmDelete('only')}
                    className='w-full py-2 bg-red-50 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors'
                  >
                    选项二：仅删除本条目(保留记录)
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className='w-full py-2 text-mac-text-secondary text-xs font-medium hover:bg-black/5 rounded-lg transition-colors border border-mac-border'
                  >
                    选项三：取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showMeSettings && (
          <div className='absolute inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm animate-in fade-in duration-200'>
            <div className='w-[360px] bg-white rounded-2xl shadow-2xl border border-mac-border overflow-hidden flex flex-col animate-in zoom-in-95 duration-200'>
              {/* Cover/Avatar Header */}
              <div className='h-24 bg-gradient-to-r from-mac-light-blue via-white to-[#ffe5f1] relative flex items-end justify-center'>
                <button
                  onClick={() => setShowMeSettings(false)}
                  className='absolute top-3 right-3 text-mac-text-secondary hover:text-mac-text-main hover:bg-black/5 p-1.5 rounded-full transition-all'
                >
                  <X className='w-4 h-4' />
                </button>
                <div className='w-20 h-20 rounded-2xl border-4 border-white bg-white shadow-xl overflow-hidden absolute -bottom-10 flex items-center justify-center'>
                  {editInfo?.userId
                    ? (
                      <img
                        src={`https://q1.qlogo.cn/g?b=qq&s=640&nk=${editInfo.userId}`}
                        alt='avatar'
                        className='w-full h-full object-cover'
                      />
                    )
                    : (
                      <div className='w-full h-full bg-mac-sidebar flex items-center justify-center'>
                        <Plus className='w-8 h-8 text-mac-text-secondary opacity-30' />
                      </div>
                    )}
                </div>
              </div>

              {/* Info Body */}
              <div className='pt-14 pb-6 px-8 flex flex-col items-center gap-5 w-full bg-gradient-to-b from-white to-mac-light-blue/20'>
                <div className='w-full space-y-4'>
                  <div className='flex flex-col gap-1.5'>
                    <label className='text-[10px] text-mac-text-secondary font-bold uppercase tracking-wider ml-1'>我的昵称</label>
                    <input
                      type='text'
                      placeholder='请输入昵称'
                      value={editInfo?.nickname || ''}
                      onChange={(e) => setEditInfo((prev: any) => (prev ? { ...prev, nickname: e.target.value } : null))}
                      className='w-full px-3 py-2 bg-white/50 border border-mac-border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-mac-blue/30 focus:bg-white transition-all'
                    />
                  </div>

                  <div className='flex flex-col gap-1.5'>
                    <label className='text-[10px] text-mac-text-secondary font-bold uppercase tracking-wider ml-1'>我的 QQ 号</label>
                    <input
                      type='number'
                      readOnly
                      placeholder='请输入 QQ 号'
                      value={editInfo?.userId || ''}
                      className='w-full px-3 py-2 bg-gray-100 border border-mac-border rounded-lg text-[13px] text-gray-500 cursor-not-allowed outline-none transition-all'
                    />
                  </div>

                  <div className='flex gap-4'>
                    <div className='flex-1 flex flex-col gap-1.5'>
                      <label className='text-[10px] text-mac-text-secondary font-bold uppercase tracking-wider ml-1'>年龄</label>
                      <input
                        type='number'
                        value={editInfo?.age || 0}
                        onChange={(e) => setEditInfo((prev: any) => (prev ? { ...prev, age: Number(e.target.value) } : null))}
                        className='w-full px-3 py-2 bg-white/50 border border-mac-border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-mac-blue/30 focus:bg-white transition-all'
                      />
                    </div>
                    <div className='flex-1 flex flex-col gap-1.5'>
                      <label className='text-[10px] text-mac-text-secondary font-bold uppercase tracking-wider ml-1'>性别</label>
                      <select
                        value={editInfo?.gender || 'unknown'}
                        onChange={(e) => setEditInfo((prev: any) => (prev ? { ...prev, gender: e.target.value } : null))}
                        className='w-full px-3 py-2 bg-white/50 border border-mac-border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-mac-blue/30 focus:bg-white transition-all'
                      >
                        <option value='male'>男</option>
                        <option value='female'>女</option>
                        <option value='unknown'>未知</option>
                        <option value='bot'>机器人</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className='w-full border-t border-mac-border my-1' />

                <button
                  onClick={handleSaveMe}
                  disabled={!editInfo?.userId}
                  className={cn(
                    'w-full py-2.5 rounded-xl text-white transition-all text-sm font-bold shadow-lg',
                    editInfo?.userId
                      ? 'bg-mac-blue hover:opacity-90 shadow-mac-blue/20'
                      : 'bg-gray-300 cursor-not-allowed'
                  )}
                >
                  {me ? '保存个人信息' : '创建用户'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unified Context Menu */}
        {contextMenu && (
          <div
            className='fixed z-[200] bg-white/95 backdrop-blur-md border border-mac-border rounded-xl shadow-2xl py-1 w-36 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100'
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.type === 'message' && (
              <>
                <button
                  onClick={() => {
                    const content = Array.isArray(contextMenu.data.content)
                      ? contextMenu.data.content.map((p: any) => p.text || '').join('')
                      : contextMenu.data.content
                    navigator.clipboard.writeText(content)
                    setContextMenu(null)
                  }}
                  className='px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-mac-blue hover:text-white transition-colors text-left'
                >
                  <Copy className='w-3.5 h-3.5' /> 复制
                </button>
                <button
                  onClick={() => {
                    setReplyTo(contextMenu.data)
                    setContextMenu(null)
                  }}
                  className='px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-mac-blue hover:text-white transition-colors text-left'
                >
                  <Bot className='w-3.5 h-3.5' /> 回复
                </button>
                {contextMenu.data.senderId !== 10001 && contextMenu.data.isRevoked !== 1 && (
                  <button
                    onClick={() => {
                      handleRecall(contextMenu.data.seq)
                      setContextMenu(null)
                    }}
                    className='px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-red-500 hover:text-white transition-colors text-red-500 text-left'
                  >
                    <Undo2 className='w-3.5 h-3.5' /> 撤回
                  </button>
                )}
              </>
            )}

            {(contextMenu.type === 'contact' || contextMenu.type === 'profile') && (
              <button
                onClick={() => {
                  const type = contextMenu.type === 'profile' ? 'user' : (contextMenu.data.type === 'private' ? 'friend' : 'group')
                  setShowDeleteConfirm({ type: type as any, id: contextMenu.data.userId || contextMenu.data.groupId, clearMessages: true })
                  setContextMenu(null)
                }}
                className='px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-red-500 hover:text-white transition-colors text-red-500 text-left'
              >
                <Trash2 className='w-3.5 h-3.5' /> 删除{contextMenu.type === 'profile' ? '身份' : (contextMenu.data.type === 'private' ? '好友' : '群聊')}
              </button>
            )}
          </div>
        )}

        {/* Plus Menu Popup */}
        {plusMenu && (
          <div
            className='fixed z-[100] bg-white/90 backdrop-blur-md border border-mac-border rounded-xl shadow-2xl py-1.5 w-36 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100'
            style={{ left: plusMenu.x, top: plusMenu.y }}
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <button
              onClick={() => {
                setShowCreateModal('private')
                setPlusMenu(null)
              }}
              className='px-3 py-2 text-[13px] flex items-center gap-2 hover:bg-mac-blue hover:text-white transition-colors text-left'
            >
              <Users className='w-4 h-4' /> 创建用户/好友
            </button>
            <button
              onClick={() => {
                setShowCreateModal('group')
                setPlusMenu(null)
              }}
              className='px-3 py-2 text-[13px] flex items-center gap-2 hover:bg-mac-blue hover:text-white transition-colors text-left'
            >
              <FolderPlus className='w-4 h-4' /> 创建群聊
            </button>
          </div>
        )}

        {/* Create User/Group Modal */}
        {showCreateModal && (
          <div
            className='fixed inset-0 z-[110] flex items-center justify-center bg-black/10 backdrop-blur-[2px] animate-in fade-in duration-200'
            onClick={() => setShowCreateModal(null)}
          >
            <div
              className='bg-mac-bg/80 backdrop-blur-2xl border border-white/40 rounded-[24px] shadow-2xl w-[320px] p-6 animate-in zoom-in-95 duration-200'
              onClick={e => e.stopPropagation()}
            >
              <div className='flex items-center gap-3 mb-6'>
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center text-white overflow-hidden bg-mac-sidebar border border-mac-border',
                  showCreateModal === 'group' ? 'shadow-lg shadow-orange-500/10' : 'shadow-lg shadow-mac-blue/10'
                )}
                >
                  <img
                    src={getAvatarUrl(showCreateModal === 'group' ? 'group' : 'private', Number(createData.id) || 0)}
                    alt='avatar-preview'
                    className='w-full h-full object-cover'
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://api.multiavatar.com/${createData.id || 'default'}.png`
                    }}
                  />
                </div>
                <div>
                  <h3 className='text-[15px] font-bold text-mac-text'>
                    {showCreateModal === 'private' ? '添加好友/账号' : '创建群聊'}
                  </h3>
                </div>
              </div>

              <div className='space-y-4'>
                <div className='space-y-1.5'>
                  <label className='text-[11px] font-semibold text-mac-text-secondary' style={{ marginLeft: '4px' }}>
                    {showCreateModal === 'group' ? '群组名称' : '昵称'}
                  </label>
                  <input
                    type='text'
                    value={createData.name}
                    onChange={e => {
                      setCreateData({ ...createData, name: e.target.value })
                      setBackendError(null)
                    }}
                    placeholder={showCreateModal === 'group' ? '请输入群名 (可选)' : '请输入昵称 (可选)'}
                    className='w-full px-4 py-2.5 bg-white/50 border border-mac-border rounded-xl focus:outline-none focus:ring-2 focus:ring-mac-blue/20 focus:border-mac-blue transition-all text-sm placeholder:text-mac-text-secondary/40'
                  />
                </div>

                <div className='space-y-1.5'>
                  <label className='text-[11px] font-semibold text-mac-text-secondary' style={{ marginLeft: '4px' }}>
                    {showCreateModal === 'group' ? '群组 ID (5-11位)' : 'QQ (5-10位)'}
                  </label>
                  <input
                    type='text'
                    value={createData.id}
                    onChange={e => {
                      setCreateData({ ...createData, id: e.target.value })
                      setBackendError(null)
                    }}
                    placeholder={showCreateModal === 'group' ? '请输入群号' : '请输入QQ号'}
                    className={cn(
                      'w-full px-4 py-2.5 bg-white/50 border rounded-xl focus:outline-none focus:ring-2 transition-all text-sm placeholder:text-mac-text-secondary/40',
                      getCreateError() ? 'border-red-300 focus:ring-red-100' : 'border-mac-border focus:ring-mac-blue/20 focus:border-mac-blue'
                    )}
                  />
                  {getCreateError() && (
                    <p className='text-[10px] text-red-500 font-medium' style={{ marginLeft: '4px' }}>
                      {getCreateError()}
                    </p>
                  )}
                </div>

                {showCreateModal !== 'group' && (
                  <div className='flex gap-4'>
                    <div className='flex-1 space-y-1.5'>
                      <label className='text-[11px] font-semibold text-mac-text-secondary' style={{ marginLeft: '4px' }}>年龄</label>
                      <input
                        type='number'
                        value={createData.age}
                        onChange={e => setCreateData({ ...createData, age: Number(e.target.value) })}
                        className='w-full px-4 py-2.5 bg-white/50 border border-mac-border rounded-xl focus:outline-none focus:ring-2 focus:ring-mac-blue/20 focus:border-mac-blue transition-all text-sm'
                      />
                    </div>
                    <div className='flex-1 space-y-1.5'>
                      <label className='text-[11px] font-semibold text-mac-text-secondary' style={{ marginLeft: '4px' }}>性别</label>
                      <select
                        value={createData.gender}
                        onChange={e => setCreateData({ ...createData, gender: e.target.value as any })}
                        className='w-full px-4 py-2.5 bg-white/50 border border-mac-border rounded-xl focus:outline-none focus:ring-2 focus:ring-mac-blue/20 focus:border-mac-blue transition-all text-sm appearance-none'
                      >
                        <option value='male'>男</option>
                        <option value='female'>女</option>
                        <option value='unknown'>未知</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className='flex gap-3 mt-6 pt-2'>
                  <button
                    onClick={() => setShowCreateModal(null)}
                    className='flex-1 py-2.5 rounded-xl text-mac-text border border-mac-border hover:bg-gray-100 transition-colors text-sm font-medium'
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreateContact}
                    disabled={!isCreateValid()}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-white transition-all text-sm font-bold shadow-lg',
                      isCreateValid()
                        ? (showCreateModal === 'group' ? 'bg-orange-500 hover:opacity-90 shadow-orange-500/20' : 'bg-mac-blue hover:opacity-90 shadow-mac-blue/20')
                        : 'bg-gray-300 cursor-not-allowed shadow-none opacity-50'
                    )}
                  >
                    确认创建
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Toast Notification */}
        {toast && (
          <div className='fixed top-8 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300'>
            <div className='bg-green-500/90 backdrop-blur-md text-white px-6 py-2.5 rounded-full shadow-xl shadow-green-500/20 flex items-center gap-2 font-medium text-sm border border-white/20'>
              <div className='w-1.5 h-1.5 rounded-full bg-white' />
              {toast}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function NavItem ({ children, active, onClick }: { children: React.ReactNode, active?: boolean, onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative cursor-pointer transition-all p-2 rounded-xl',
        active ? 'bg-mac-blue text-white shadow-md shadow-mac-blue/20' : 'text-mac-text-secondary hover:bg-mac-active'
      )}
    >
      {children}
    </div>
  )
}
