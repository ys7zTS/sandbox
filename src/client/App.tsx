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
  User,
  UserMinus,
  UserCog,
  FolderPlus,
  ChevronRight,
  Paperclip,
  Upload,
  Sun,
  Moon,
  Monitor
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
  unreadCount?: number
}

interface GroupInfo {
  groupId: number
  groupName: string
  avatarUrl?: string
  ownerId: number
  adminList?: number[]
  memberList: any[]
  unreadCount?: number
}

const getAvatarUrl = (type: 'private' | 'group', id: number | string, customUrl?: string) => {
  if (customUrl) return customUrl
  const finalId = (!id || id === 0 || id === '0') ? '10000' : id
  if (type === 'private') {
    return `https://q1.qlogo.cn/g?b=qq&s=640&nk=${finalId}`
  }
  return `https://p.qlogo.cn/gh/${finalId}/${finalId}/640`
}

const getMessageSummary = (content: any): string => {
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
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'message' | 'contact' | 'profile' | 'member' | 'avatar', data: any } | null>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [showSendTip, setShowSendTip] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [pendingFile, setPendingFile] = useState<UploadedPart | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showMembersSidebar, setShowMembersSidebar] = useState(false)
  const [showMemberInfoSidebar, setShowMemberInfoSidebar] = useState(false)
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [showTransferSidebar, setShowTransferSidebar] = useState(false)
  const [showAvatarZoom, setShowAvatarZoom] = useState<{ url: string, type: 'private' | 'group', id: number } | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('theme')
    return (saved as any) || 'system'
  })
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light')
  const [alertDialog, setAlertDialog] = useState<{ title: string, message: string } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ title: string, message: string, onConfirm: () => void, confirmText?: string, cancelText?: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastSyncedUserRef = useRef<number | null>(null)

  const isMember = currentTarget?.type === 'group' && !!me && me.userId !== 0 && !!editInfo?.memberList && editInfo.memberList.some((m: any) => String(m.userId) === String(me.userId))
  const isOwner = currentTarget?.type === 'group' && !!me && me.userId !== 0 && !!editInfo && String(editInfo.ownerId) === String(me.userId)
  const isAdmin = currentTarget?.type === 'group' && !!me && me.userId !== 0 && !!editInfo?.adminList && editInfo.adminList.includes(me.userId)
  const canModifyGroupName = isOwner || isAdmin
  const actualTheme = theme === 'system' ? systemTheme : theme
  const isDark = actualTheme === 'dark'

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light')
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light')
    mediaQuery.addEventListener('change', handler)
    return () => { mediaQuery.removeEventListener('change', handler) }
  }, [])

  useEffect(() => {
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const renderMessagePart = (part: MessageType[number], idx: number, isInverse: boolean = false) => {
    switch (part.type) {
      case 'text':
        return <span key={idx}>{part.text}</span>
      case 'image': {
        const style: React.CSSProperties = {}
        if (part.width) style.width = part.width
        if (part.height) style.height = part.height
        return (
          <img
            key={idx}
            src={part.url || part.uri}
            alt=''
            className='max-w-full rounded-lg shadow-sm object-contain'
            style={style}
          />
        )
      }
      case 'video':
        return (
          <video key={idx} controls className='max-w-full rounded-lg shadow-sm'>
            <source src={part.url || part.uri} />
          </video>
        )
      case 'file': {
        const sizeStr = part.size ? (part.size > 1024 * 1024 ? `${(part.size / (1024 * 1024)).toFixed(2)} MB` : `${(part.size / 1024).toFixed(2)} KB`) : '未知大小'
        return (
          <a
            key={idx}
            href={part.url || part.uri}
            target='_blank'
            rel='noreferrer'
            className='flex items-center gap-3 p-3 bg-white border border-mac-border rounded-xl shadow-sm hover:shadow-md hover:bg-gray-50 transition-all group min-w-[220px] max-w-[320px] no-underline'
          >
            <div className='w-10 h-10 bg-mac-active rounded-lg flex items-center justify-center shrink-0 group-hover:bg-mac-blue/10 transition-colors'>
              <Paperclip className='w-5 h-5 text-mac-text-secondary group-hover:text-mac-blue transition-colors' />
            </div>
            <div className='min-w-0 flex-1 text-left'>
              <div className='text-sm font-medium text-mac-text-main truncate mb-0.5' title={part.filename}>{part.filename || '未知文件'}</div>
              <div className='text-[10px] text-mac-text-secondary'>{sizeStr}</div>
            </div>
          </a>
        )
      }
      case 'reply': {
        const targetMsg = messages.find(m => m.seq === part.messageSeq)
        const timeStr = targetMsg ? new Date(targetMsg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
        const senderContact = targetMsg ? contacts.find(c => (c as any).userId === targetMsg.senderId || (c as any).groupId === targetMsg.senderId) : null
        const sender = senderContact ? (senderContact as any).nickname || (senderContact as any).groupName : (targetMsg ? targetMsg.senderId : '#' + part.messageSeq)
        return (
          <div
            key={idx}
            onClick={(e) => {
              e.stopPropagation()
              const el = document.getElementById(`msg-${part.messageSeq}`)
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el.classList.add('highlight-msg')
                setTimeout(() => el.classList.remove('highlight-msg'), 2000)
              }
            }}
            className={cn(
              'text-[10px] px-2.5 py-1.5 rounded-lg border-l-4 cursor-pointer transition-all mb-1 overflow-hidden max-w-full flex flex-col gap-0.5 shadow-sm',
              isInverse
                ? 'bg-white/15 text-white/90 border-white/40 hover:bg-white/20'
                : 'bg-black/[0.03] text-mac-text-secondary border-mac-blue/30 hover:bg-black/[0.06]'
            )}
          >
            <div className='flex items-center justify-between font-bold opacity-80 scale-95 origin-left'>
              <span>{sender}</span>
              <span className='font-normal opacity-60'>{timeStr}</span>
            </div>
            <div className='truncate italic opacity-90'>
              {targetMsg ? getMessageSummary(targetMsg.content) : `引用消息 #${part.messageSeq}`}
            </div>
          </div>
        )
      }
      case 'at':
        return <span key={idx} className={isInverse ? 'text-white font-bold underline' : 'text-mac-blue font-semibold'}>@{part.targetId === 'all' ? '全体成员' : part.targetId}</span>
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

  const handleSendFile = async (filePart: UploadedPart) => {
    if (!currentTarget || !me) return
    try {
      await api.sendMessage({
        type: currentTarget.type,
        targetId: currentTarget.id,
        senderId: me.userId,
        content: [filePart.part]
      })
      setPendingFile(null)
    } catch (e) {
      setToast('发送失败')
    }
  }

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return
    try {
      if (files.length > 1) {
        setToast('目前仅支持单文件发送')
      }
      const up = await uploadFile(files[0])
      const mime = files[0].type || ''
      if (mime.startsWith('image/') || mime.startsWith('video/')) {
        setPendingParts(prev => [...prev, up])
      } else {
        setPendingFile(up)
      }
    } catch (err) {
      console.error('upload failed', err)
      setToast('上传失败')
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    await processFiles(files)
    if (e.target) e.target.value = ''
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    await processFiles(files)
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
    api.connect().catch(err => {
      console.error('[UI] WebSocket connection failed:', err)
    })

    const unbindConnect = api.onConnect(() => {
      console.log('[UI] WebSocket connected/reconnected')
      // 从本地存储恢复身份
      const savedUserId = localStorage.getItem('active_user_id')
      if (savedUserId && savedUserId !== '0') {
        console.log('[UI] Restore user identity:', savedUserId)
        api.setActiveUser(Number(savedUserId)).catch(() => {
          console.warn('[UI] Restore identity failed, user might be deleted.')
          localStorage.setItem('active_user_id', '0')
          loadMe()
        })
      } else {
        loadMe()
      }
      loadProfiles()
    })

    return () => { unbindConnect() }
  }, [])

  useEffect(() => {
    setShowSettings(false)
    setShowMembersSidebar(false)
    setShowMemberInfoSidebar(false)
    setShowTransferSidebar(false)
  }, [currentTarget?.id])

  useEffect(() => {
    const unbindInit = api.on(ActionTypes.SYNC_ALL, (data: any) => {
      console.log('[UI] sync all', data)
      if (data.me) {
        setMe(data.me || null)
        // 同步更新本地存储以保持一致
        if (data.me.userId !== 0) {
          localStorage.setItem('active_user_id', String(data.me.userId))
        } else {
          // 如果后端明确返回是 0，只有在本地存的 ID 不为空时才考虑是否需要重置
          // 但考虑到网络延迟，这里不直接重置，除非是 setActiveUser 之后的 SYNC_ALL
          // 之前的逻辑太武断，这里简单地按照后端返回的来，但如果 savedUserId 有值，SET_ACTIVE_USER 之后会再次刷新
        }
      }
      if (data.contacts) {
        setContacts(data.contacts)

        // 只有切换账号时才主动请求该账号的所有消息
        if (data.me && data.me.userId !== 0 && lastSyncedUserRef.current !== data.me.userId) {
          console.log('[UI] Detected account switch, clearing old cache and syncing all messages...')
          lastSyncedUserRef.current = data.me.userId
          setMessageCache({}) // 立即清除旧缓存防止消息错乱

          const syncAll = async () => {
            const newCache: Record<string, Message[]> = {}
            for (const contact of data.contacts) {
              const targetId = contact.userId || contact.groupId
              const type = contact.type
              try {
                // 后端获取每个聊天最近的 50 条记录
                const msgs = await api.getMessages({ type, targetId, limit: 50 })
                newCache[`${type}-${targetId}`] = msgs
              } catch (e) { }
            }
            setMessageCache(newCache)
          }
          syncAll()
        }
      }
    })

    const unbindMsg = api.on(ActionTypes.PUSH_MESSAGE, (msg: Message) => {
      console.log('[UI] push message', msg)

      const isFromSystem = msg.senderId === 1
      // 过滤掉与我无关的私聊消息。如果是系统消息且被推送，认为其相关
      const isMyPrivate = msg.type === 'private' && (msg.targetId === me?.userId || msg.senderId === me?.userId || isFromSystem)
      const isRelevant = msg.type === 'group' || isMyPrivate
      if (!isRelevant) return

      // 计算这条消息对应的“会话对方 ID”
      const msgPeerId = msg.type === 'private'
        ? (msg.senderId === me?.userId ? msg.targetId : (isFromSystem ? (msg.targetId === me?.userId ? 1 : msg.targetId) : msg.senderId))
        : msg.targetId

      // 只有当消息类型和对方 ID 都匹配时，才认为是当前选中的聊天框
      const isMatchCurrent = currentTarget &&
        msg.type === currentTarget.type &&
        msgPeerId === currentTarget.id

      if (isMatchCurrent) {
        setMessages(prev => {
          if (prev.some(m => m.seq === msg.seq)) return prev
          return [...prev, msg]
        })
        // 自动设为已读
        api.send(ActionTypes.SET_READ, {
          type: msg.type,
          targetId: msgPeerId,
          seq: msg.seq
        }).catch(() => { })
      }

      // 更新联系人列表中的最后一条消息和未读数
      setContacts(prev => prev.map(c => {
        const isMatch = (c.type === 'group' && msg.type === 'group' && (c as any).groupId === msg.targetId) ||
          (c.type === 'private' && msg.type === 'private' && (
            (msg.senderId === me?.userId && msg.targetId === (c as any).userId) ||
            (msg.targetId === me?.userId && msg.senderId === (c as any).userId) ||
            (isFromSystem && (msg.targetId === (c as any).userId || (msg.targetId === me?.userId && (c as any).userId === 1)))
          ))

        if (isMatch) {
          const newUnread = isMatchCurrent ? 0 : (c.unreadCount || 0) + 1
          return { ...c, lastMsg: msg, unreadCount: newUnread }
        }
        return c
      }))

      // 更新缓存
      const key = `${msg.type}-${msgPeerId}`
      setMessageCache(prev => {
        const existing = prev[key] || []
        if (existing.some(m => m.seq === msg.seq)) return prev
        return { ...prev, [key]: [...existing, msg] }
      })
    })

    const unbindRecall = api.on(ActionTypes.RECALL_MESSAGE, (data: { type: string, seq: number }) => {
      console.log('[UI] push recall', data)
      // 更新全局缓存
      setMessageCache(prev => {
        const newCache = { ...prev }
        Object.keys(newCache).forEach(key => {
          newCache[key] = newCache[key].map(m =>
            m.seq === data.seq ? { ...m, isRevoked: 1 } : m
          )
        })
        return newCache
      })
      // 如果正好是当前会话，也要更新 messages
      setMessages(prev => prev.map(m => m.seq === data.seq ? { ...m, isRevoked: 1 } : m))
    })

    const unbindGroupMemberUpdate = api.on(ActionTypes.GROUP_MEMBER_UPDATE, (data: { groupId: number }) => {
      console.log('[UI] group member update', data)
      // 如果当前打开的是这个群聊，刷新详情
      if (currentTarget?.type === 'group' && currentTarget.id === data.groupId) {
        fetchDetail()
      }
      // 刷新联系人列表
      loadContacts()
    })

    return () => {
      unbindInit()
      unbindMsg()
      unbindRecall()
      unbindGroupMemberUpdate()
    }
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

    // 当切换聊天目标时，关闭所有相关的右侧边栏，防止误操作
    setShowSettings(false)
    setShowMembersSidebar(false)
    setShowMemberInfoSidebar(false)
    setShowTransferSidebar(false)

    // 仅从本地缓存加载消息，不再在切换联系人时主动请求后端
    const key = `${currentTarget.type}-${currentTarget.id}`
    setMessages(messageCache[key] || [])
  }, [currentTarget, messageCache]) // 增加对 messageCache 的依赖以配合 Bulk Sync 更新 UI

  useEffect(scrollToBottom, [messages])

  useEffect(() => {
    if (currentTarget?.type === 'group') {
      fetchDetail()
    } else if (showMeSettings) {
      setEditInfo(me ? { ...me } : { userId: '', nickname: '', age: 0, gender: 'unknown' })
    } else if (!showSettings) {
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
      localStorage.setItem('active_user_id', String(userId))
      await loadMe()
      setContacts([])
      setCurrentTarget(null)
      setMessages([])
      setMessageCache({}) // 切换用户时立即清空本地旧消息缓存
    } catch (e) {
      setToast('切换失败')
    }
  }

  const handleSaveMe = async () => {
    if (!editInfo || !editInfo.userId) return
    try {
      await api.saveUser(editInfo)
      setShowMeSettings(false)
      loadMe()
    } catch (e) {
      setAlertDialog({ title: '保存失败', message: '无法保存用户信息，请稍后重试' })
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
      setAlertDialog({ title: '保存失败', message: '无法保存设置，请稍后重试' })
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
        loadMe()
        loadContacts()
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
      setAlertDialog({ title: '删除失败', message: '无法完成删除操作，请稍后重试' })
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
        if (isOwner) {
          setConfirmDialog({
            title: '群主退群',
            message: '群主退群会解散群聊，是否退出？',
            confirmText: '确定退出',
            cancelText: '取消',
            onConfirm: async () => {
              try {
                await api.leaveGroup(currentTarget.id, me.userId)
                setCurrentTarget(null)
                setShowSettings(false)
                fetchDetail()
                loadContacts()
              } catch (e) {
                setAlertDialog({ title: '操作失败', message: '无法退出群聊，请稍后重试' })
              }
            }
          })
          return
        }
        await api.leaveGroup(currentTarget.id, me.userId)
      }
      fetchDetail()
      loadContacts()
    } catch (e) {
      setAlertDialog({ title: '操作失败', message: '无法完成操作，请稍后重试' })
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
      setToast('发送消息失败，请检查网络连接')
    }
  }

  const handleRecall = async (seq: number) => {
    try {
      await api.recallMessage(currentTarget?.type || 'private', seq)
    } catch (e) {
      setToast('撤回消息失败')
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
    const isPrivate = showCreateModal === 'private'
    if (!isPrivate && (!me || me.userId === 0)) {
      setToast('访客模式无法创建群聊')
      return
    }
    try {
      if (isPrivate) {
        await api.saveUser({
          userId: Number(createData.id),
          nickname: createData.name,
          age: Number(createData.age),
          gender: createData.gender
        })
      } else {
        const gid = Number(createData.id)
        await api.saveGroup({
          groupId: gid,
          groupName: createData.name,
          ownerId: me?.userId || 0
        })
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
      className={cn('flex h-screen font-sans antialiased overflow-hidden transition-colors duration-200', isDark ? 'bg-gray-900 text-gray-100' : 'bg-white text-mac-text-main')}
      onClick={() => {
        setContextMenu(null)
        setPlusMenu(null)
        setShowDeleteConfirm(null)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (currentTarget) setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
    >
      {/* Left Nav Rail */}
      <nav className={cn('w-16 flex flex-col items-center py-5 border-r gap-6 shrink-0', isDark ? 'bg-gray-800 border-gray-700' : 'bg-mac-sidebar border-mac-border')}>
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
        <div className='flex flex-col gap-2 mb-2'>
          <button
            onClick={() => setTheme('light')}
            className={cn(
              'p-2 rounded-lg transition-all',
              theme === 'light' ? 'bg-mac-blue text-white shadow-md' : 'text-mac-text-secondary hover:bg-mac-active'
            )}
            title='白天模式'
          >
            <Sun className='w-4 h-4' />
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={cn(
              'p-2 rounded-lg transition-all',
              theme === 'dark' ? 'bg-mac-blue text-white shadow-md' : 'text-mac-text-secondary hover:bg-mac-active'
            )}
            title='黑夜模式'
          >
            <Moon className='w-4 h-4' />
          </button>
          <button
            onClick={() => setTheme('system')}
            className={cn(
              'p-2 rounded-lg transition-all',
              theme === 'system' ? 'bg-mac-blue text-white shadow-md' : 'text-mac-text-secondary hover:bg-mac-active'
            )}
            title='跟随系统'
          >
            <Monitor className='w-4 h-4' />
          </button>
        </div>
      </nav>

      {/* Profiles List Sidebar */}
      {showProfilesSidebar && (
        <div
          className={cn('w-[72px] border-r flex flex-col items-center py-4 gap-4 animate-in slide-in-from-left-4 duration-200 shrink-0', isDark ? 'bg-gray-800 border-gray-700' : 'bg-[#f0f0f0] border-mac-border')}
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
      <aside className={cn('w-64 flex flex-col border-r shrink-0', isDark ? 'bg-gray-800 border-gray-700' : 'bg-mac-sidebar border-mac-border')}>
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
            const lastMsg = contact.lastMsg || (messageCache[key] ? messageCache[key][messageCache[key].length - 1] : null)
            const lastTime = lastMsg ? new Date(lastMsg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
            const unreadCount = contact.unreadCount || 0

            return (
              <div
                key={key}
                onClick={() => {
                  setCurrentTarget({
                    type: contact.type,
                    id,
                    name: contact.nickname || contact.groupName
                  })
                  // 点击时重置未读
                  setContacts(prev => prev.map(c => {
                    if ((c.type === 'group' && (c as any).groupId === id) || (c.type === 'private' && (c as any).userId === id)) {
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
                  'px-3 py-2.5 flex items-center gap-3 cursor-pointer rounded-xl transition-all mb-1',
                  currentTarget?.id === id
                    ? 'bg-mac-blue text-white shadow-md'
                    : isDark ? 'hover:bg-gray-700' : 'hover:bg-mac-active'
                )}
              >
                <div className='relative w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm overflow-hidden'>
                  <img src={getAvatarUrl(contact.type, id, (contact as any).avatarUrl)} alt='avatar' className='w-full h-full object-cover' />
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='flex justify-between items-center mb-0.5'>
                    <span className={cn(
                      'text-sm font-medium truncate',
                      currentTarget?.id === id ? 'text-white' : (isDark ? 'text-gray-200' : 'text-mac-text-main')
                    )}
                    >{contact.nickname || contact.groupName}
                    </span>
                    <span className={cn(
                      'text-[10px]',
                      currentTarget?.id === id ? 'text-white/70' : (isDark ? 'text-gray-400' : 'text-mac-text-secondary')
                    )}
                    >{lastTime}
                    </span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <p className={cn(
                      'text-xs truncate flex-1',
                      currentTarget?.id === id ? 'text-white/80' : (isDark ? 'text-gray-400' : 'text-mac-text-secondary')
                    )}
                    >
                      {getMessageSummary(lastMsg?.content)}
                      {lastMsg?.isRevoked === 1 && <span className='ml-1 opacity-70'>[已撤回]</span>}
                    </p>
                    {unreadCount > 0 && (
                      <div className='bg-red-500 text-white text-[9px] min-w-[14px] h-[14px] rounded-full flex items-center justify-center px-1 font-bold shrink-0 animate-in zoom-in'>
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

      {/* Main Chat Area */}
      <main className='flex-1 flex flex-col relative bg-white'>
        <div className='absolute inset-0 flex flex-col'>
          {!me || me.userId === 0
            ? (
              <div className={cn('flex-1 flex flex-col items-center justify-center', isDark ? 'text-gray-400 bg-gray-900/50' : 'text-gray-600 bg-mac-sidebar/50')}>
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
                  <header className={cn('h-[52px] px-6 flex items-center justify-between border-b backdrop-blur-md sticky top-0 z-10', isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-mac-border')}>
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

                  <div className={cn('flex-1 overflow-y-auto p-6 flex flex-col gap-8', isDark ? 'bg-gray-900' : 'bg-[#fafafa]')}>
                    {messages.map((m, index) => {
                      const isMe = me && m.senderId === me.userId
                      const isRecalled = m.isRevoked === 1

                      // Show time strip if gap > 10 minutes
                      const prevMsg = messages[index - 1]
                      const showTime = !prevMsg || (m.timestamp - prevMsg.timestamp) > 600

                      // 系统消息渲染（像时间条一样）
                      if (m.senderId === 1) {
                        const getSystemContent = () => {
                          if (typeof m.content === 'string') {
                            return m.content
                          }
                          if (Array.isArray(m.content)) {
                            return m.content.map(p => {
                              if (p.type === 'text') return p.text
                              if (p.type === 'at') return `@${p.targetId}`
                              return ''
                            }).join('')
                          }
                          return String(m.content)
                        }

                        const content = getSystemContent()
                        const parts = content.split(/(@\d+)/g).filter(Boolean)
                        return (
                          <div key={m.seq} id={`msg-${m.seq}`} className='flex flex-col'>
                            {showTime && (
                              <div className='self-center text-mac-text-secondary text-[10px] my-2 font-medium bg-mac-active px-3 py-1 rounded-full'>
                                {new Date(m.timestamp * 1000).toLocaleString()}
                              </div>
                            )}
                            <div
                              className='self-center text-mac-text-secondary text-[10px] my-1 font-medium bg-mac-active px-3 py-1 rounded-full cursor-default max-w-[90%] text-center'
                              onContextMenu={(e) => e.preventDefault()}
                            >
                              {parts.map((part, i) => {
                                if (part.startsWith('@')) {
                                  const userId = Number(part.slice(1))
                                  const member = editInfo?.memberList?.find((mi: any) => String(mi.userId) === String(userId))
                                  const displayName = member?.card || member?.nickname || userId
                                  return (
                                    <span
                                      key={i}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (member) {
                                          setSelectedMember(member)
                                          setShowMemberInfoSidebar(true)
                                        }
                                      }}
                                      className='font-semibold hover:underline cursor-pointer text-mac-blue'
                                    >
                                      {displayName}
                                    </span>
                                  )
                                }
                                return <span key={i}>{part}</span>
                              })}
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div key={m.seq} id={`msg-${m.seq}`} className='flex flex-col'>
                          {showTime && (
                            <div className='self-center text-mac-text-secondary text-[10px] my-2 font-medium bg-mac-active px-3 py-1 rounded-full'>
                              {new Date(m.timestamp * 1000).toLocaleString()}
                            </div>
                          )}
                          <div
                            className={cn('flex max-w-[75%]', !isMe ? 'self-start' : 'self-end flex-row-reverse')}
                          >
                            <div
                              onContextMenu={(e) => {
                                if (m.senderId === 1) return // 系统消息不触发
                                e.preventDefault()
                                e.stopPropagation()
                                const mInfo = editInfo?.memberList?.find((mi: any) => String(mi.userId) === String(m.senderId))
                                setContextMenu({
                                  x: e.clientX,
                                  y: e.clientY,
                                  type: 'avatar',
                                  data: { userId: m.senderId, member: mInfo }
                                })
                              }}
                              className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-sm shrink-0 overflow-hidden cursor-pointer select-none', isMe ? 'ml-3' : 'mr-3', isDark ? 'bg-gray-700 border border-gray-600' : 'bg-white border border-mac-border')}
                            >
                              <img
                                src={getAvatarUrl('private', m.senderId)}
                                alt='avatar'
                                className='w-full h-full object-cover pointer-events-none'
                              />
                            </div>
                            <div className='flex-1 flex flex-col min-w-0'>
                              {currentTarget?.type === 'group' && !isRecalled && (
                                <div className={cn('flex items-center gap-2 mb-1', isMe ? 'flex-row-reverse' : 'flex-row')}>
                                  {(() => {
                                    const mInfo = editInfo?.memberList?.find((mi: any) => String(mi.userId) === String(m.senderId))
                                    const name = mInfo?.card || mInfo?.nickname || m.senderId
                                    const title = mInfo?.title
                                    const displayLabel = title || (mInfo?.role === 'owner' ? '群主' : (mInfo?.role === 'admin' ? '管理员' : '成员'))
                                    // 群主和管理员保持角色颜色，普通成员有头衔时显示紫色
                                    const bgColor = mInfo?.role === 'owner' ? 'bg-yellow-400' : (mInfo?.role === 'admin' ? 'bg-green-500' : (title ? 'bg-purple-500' : 'bg-gray-500'))
                                    return (
                                      <>
                                        <span className={cn('text-[10px] font-medium truncate', isDark ? 'text-gray-400' : 'text-mac-text-secondary')}>{name}</span>
                                        <span className={cn(
                                          'px-1.5 py-0.5 rounded text-[8px] font-bold text-white leading-none shrink-0',
                                          bgColor
                                        )}
                                        >
                                          {displayLabel}
                                        </span>
                                      </>
                                    )
                                  })()}
                                </div>
                              )}
                              {(() => {
                                const content = m.content as any
                                const hasText = Array.isArray(content)
                                  ? content.some(p => (p.type === 'text' && p.text.trim().length > 0) || p.type === 'at')
                                  : typeof content === 'string' && content.trim().length > 0

                                const isOnlyMedia = !hasText && Array.isArray(m.content) && m.content.length > 0 && m.content.every(p => ['image', 'video', 'file'].includes(p.type))
                                const isOnlyImageVideo = isOnlyMedia && m.content.every(p => ['image', 'video'].includes(p.type))
                                const isOnlyFile = isOnlyMedia && m.content.length === 1 && m.content[0].type === 'file'

                                return (
                                  <div
                                    onContextMenu={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      setContextMenu({ x: e.clientX, y: e.clientY, type: 'message', data: m })
                                    }}
                                    className={cn(
                                      'px-4 py-2.5 rounded-2xl text-[13px] shadow-sm break-all leading-relaxed relative transition-all cursor-default flex flex-col gap-1.5',
                                      isMe ? 'bg-mac-blue text-white' : (isDark ? 'bg-gray-700 text-gray-100 border border-gray-600' : 'bg-white text-mac-text-main border border-mac-border'),
                                      isRecalled && 'opacity-60 grayscale-[0.5] border-red-400 border-2 bg-red-50 text-red-700',
                                      (isOnlyImageVideo || isOnlyFile) && 'bg-transparent border-none shadow-none p-0'
                                    )}
                                  >
                                    {Array.isArray(m.content)
                                      ? m.content.map((part, i) => renderMessagePart(part, i, isMe))
                                      : renderMessagePart({ type: 'text', text: String(m.content) } as any, 0, isMe)}
                                    {isRecalled && (
                                      <span className={cn(
                                        'absolute -top-2 -right-2 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full shadow-sm blink',
                                        (isOnlyImageVideo || isOnlyFile) && 'top-1 right-1'
                                      )}
                                      >
                                        已撤回
                                      </span>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        </div>
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
                            {getMessageSummary(replyTo.content)}
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
                    <div className={cn('relative rounded-xl border focus-within:border-mac-blue/50 transition-all', isDark ? 'bg-gray-700 border-gray-600 focus-within:bg-gray-600' : 'bg-mac-sidebar border-mac-border focus-within:bg-white')}>
                      <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        disabled={!me || me.userId === 0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendMessage()
                          }
                        }}
                        placeholder={(!me || me.userId === 0) ? '请先选择或创建一个操控账号' : '输入消息...'}
                        className='w-full bg-transparent border-none outline-none resize-none text-[13px] p-3 min-h-[100px] disabled:opacity-50'
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
          <>
            <div className='absolute inset-0 z-[45] bg-black/5 animate-in fade-in duration-300' onClick={() => setShowSettings(false)} />
            <div className={cn('absolute inset-y-0 right-0 z-50 w-80 border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-300', isDark ? 'bg-gray-800 border-gray-700' : 'bg-[#f8f9fa] border-mac-border')}>
              {/* Header */}
              <div className={cn('h-[52px] px-4 border-b backdrop-blur-md flex items-center justify-between sticky top-0 z-10', isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-mac-border')}>
                <h2 className={cn('text-sm font-bold', isDark ? 'text-gray-100' : 'text-mac-text-main')}>
                  {currentTarget.type === 'private' ? '编辑资料' : '群聊详情'}
                </h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className={cn('p-1.5 rounded-lg transition-all', isDark ? 'hover:bg-gray-700' : 'hover:bg-black/5')}
                >
                  <X className='w-4 h-4 text-mac-text-secondary' />
                </button>
              </div>

              <div className={cn('flex-1 overflow-y-auto custom-scrollbar', isDark ? 'bg-gray-900' : 'bg-[#f2f3f5]')}>
                {/* Hero Section */}
                <div className={cn('p-6 flex flex-col items-center gap-4 mb-2', isDark ? 'bg-gray-800' : 'bg-white')}>
                  <div
                    onClick={() => setShowAvatarZoom({ url: getAvatarUrl(currentTarget.type, currentTarget.id, editInfo?.avatarUrl), type: currentTarget.type, id: currentTarget.id })}
                    className='w-20 h-20 rounded-2xl shadow-xl border-4 border-white overflow-hidden relative group cursor-pointer'
                  >
                    <img
                      src={getAvatarUrl(currentTarget.type, currentTarget.id, editInfo?.avatarUrl)}
                      alt='avatar'
                      className='w-full h-full object-cover transition-transform group-hover:scale-110'
                    />
                    <div className='absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity'>
                      <Plus className='w-6 h-6 text-white' />
                    </div>
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
                      <div
                        onClick={() => setShowMembersSidebar(true)}
                        className='flex items-center gap-0.5 text-[11px] text-mac-text-secondary hover:text-mac-blue cursor-pointer transition-colors'
                      >
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
                        <div className='px-4 py-3 flex flex-col gap-1.5'>
                          <label className='text-[10px] text-mac-text-secondary font-bold uppercase tracking-wider'>群名称</label>
                          {canModifyGroupName
                            ? (
                              <input
                                type='text'
                                value={editInfo?.groupName || ''}
                                onChange={(e) => setEditInfo((prev: any) => (prev ? { ...prev, groupName: e.target.value } : null))}
                                className='w-full text-sm bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-mac-blue/20 rounded-md py-1 transition-all'
                              />
                            )
                            : (
                              <div className='text-sm py-1'>{editInfo?.groupName || '未设置'}</div>
                            )}
                        </div>
                        {isOwner && (
                          <div
                            onClick={() => setShowTransferSidebar(true)}
                            className='px-4 py-4 flex items-center justify-between group cursor-pointer hover:bg-mac-active transition-all'
                          >
                            <span className='text-xs font-medium text-mac-text-main'>转让群聊</span>
                            <ChevronRight className='w-4 h-4 text-mac-text-secondary group-hover:translate-x-0.5 transition-transform' />
                          </div>
                        )}
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
                      onClick={() => {
                        if (!me || me.userId === 0) {
                          setToast('访客身份无法修改资料')
                          return
                        }
                        handleSave()
                      }}
                      className={cn(
                        'w-full py-2.5 bg-mac-blue text-white rounded-xl font-bold text-sm shadow-lg shadow-mac-blue/20 hover:opacity-90 active:scale-[0.98] transition-all',
                        (!me || me.userId === 0) && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      保存资料更改
                    </button>
                  )}

                  {currentTarget.type === 'group' && (
                    !isMember
                      ? (
                        <button
                          onClick={() => {
                            if (!me || me.userId === 0) {
                              setToast('访客身份无法申请入群')
                              return
                            }
                            handleGroupAction('join')
                          }}
                          className={cn(
                            'w-full py-2.5 bg-mac-blue text-white rounded-xl font-bold text-sm shadow-lg shadow-mac-blue/20 hover:opacity-90 active:scale-[0.98] transition-all',
                            (!me || me.userId === 0) && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          申请加入该群
                        </button>
                      )
                      : (
                        <div className='flex flex-col gap-3'>
                          <button
                            onClick={() => {
                              if (!me || me.userId === 0) {
                                setToast('访客身份无法退出群聊')
                                return
                              }
                              handleGroupAction('leave')
                            }}
                            className={cn(
                              'w-full py-2.5 bg-red-50 text-red-500 rounded-xl font-bold text-sm hover:bg-red-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2',
                              (!me || me.userId === 0) && 'opacity-50 cursor-not-allowed'
                            )}
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
                          : 'bg-mac-blue text-white shadow-lg shadow-mac-blue/20 hover:opacity-90',
                        (!me || me.userId === 0) && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {me?.friendList?.includes(currentTarget.id) ? <><Trash2 className='w-4 h-4' /> 删除好友</> : <><Plus className='w-4 h-4' /> 添加好友</>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* File Send Confirmation Modal */}
        {pendingFile && (
          <div className='fixed inset-0 z-[400] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200'>
            <div className='w-[400px] bg-white/90 backdrop-blur-xl border border-white/20 rounded-[28px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200'>
              <div className='p-8 space-y-6'>
                <div className='w-20 h-20 bg-mac-blue/10 rounded-[22px] flex items-center justify-center mx-auto shadow-inner'>
                  <Paperclip className='w-10 h-10 text-mac-blue' />
                </div>
                <div className='text-center space-y-2'>
                  <h3 className='text-lg font-bold text-mac-text-main'>发送文件</h3>
                  <div className='px-4 py-2 bg-mac-active/50 rounded-xl inline-block max-w-full'>
                    <p className='text-sm font-medium text-mac-text-main truncate'>
                      {(pendingFile.part as any).filename || '未知文件'}
                    </p>
                    <p className='text-[10px] text-mac-text-secondary mt-0.5'>
                      {(pendingFile.part as any).size ? ((pendingFile.part as any).size > 1024 * 1024 ? `${((pendingFile.part as any).size / (1024 * 1024)).toFixed(2)} MB` : `${((pendingFile.part as any).size / 1024).toFixed(2)} KB`) : '未知大小'}
                    </p>
                  </div>
                  <p className='text-xs text-mac-text-secondary mt-4'>
                    发送给 <span className='font-bold text-mac-text-main'>{currentTarget?.name}</span> ？
                  </p>
                </div>
                <div className='flex gap-3'>
                  <button
                    onClick={() => setPendingFile(null)}
                    className='flex-1 py-3 bg-mac-active text-mac-text-main rounded-xl text-sm font-bold hover:bg-mac-border transition-colors'
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleSendFile(pendingFile)}
                    className='flex-1 py-3 bg-mac-blue text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-lg shadow-mac-blue/20 transition-all'
                  >
                    确认发送
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Drag & Drop Overlay */}
        {isDragging && (
          <div
            className='fixed inset-0 z-[500] flex items-center justify-center bg-mac-blue/10 backdrop-blur-[2px] border-4 border-dashed border-mac-blue/50 pointer-events-none animate-in fade-in duration-200'
          >
            <div className='bg-white/90 backdrop-blur-xl px-10 py-8 rounded-[32px] shadow-2xl flex flex-col items-center gap-4 scale-110 border border-mac-blue/20'>
              <div className='w-16 h-16 bg-mac-blue text-white rounded-[20px] flex items-center justify-center shadow-lg shadow-mac-blue/30'>
                <Upload className='w-8 h-8' />
              </div>
              <p className='text-lg font-bold text-mac-blue'>松开即可发送文件</p>
              <p className='text-sm text-mac-text-secondary'>支持拖拽单个文件或图片</p>
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

        {contextMenu && (
          <div
            className='fixed z-[200] bg-white/95 backdrop-blur-md border border-mac-border rounded-xl shadow-2xl py-1 w-40 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100'
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.type === 'avatar' && (
              <>
                <button
                  onClick={() => {
                    const userId = contextMenu.data.userId
                    const contact = contacts.find(c => (c as any).userId === userId)
                    const profile = profiles.find(p => p.userId === userId)
                    const name = (contact as any)?.nickname || profile?.nickname || String(userId)
                    setCurrentTarget({ type: 'private', id: userId, name })
                    setContextMenu(null)
                  }}
                  className='px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-mac-blue hover:text-white transition-colors text-left'
                >
                  <MessageSquare className='w-3.5 h-3.5' /> 发送消息
                </button>
                {currentTarget?.type === 'group' && (
                  <button
                    onClick={() => {
                      const userId = contextMenu.data.userId
                      setInputValue(prev => prev.trim() + (prev ? ' ' : '') + `@${userId} `)
                      setContextMenu(null)
                    }}
                    className='px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-mac-blue hover:text-white transition-colors text-left'
                  >
                    <Bot className='w-3.5 h-3.5' /> @ TA
                  </button>
                )}
                <button
                  onClick={() => {
                    const member = contextMenu.data.member
                    if (member) {
                      setSelectedMember(member)
                      setShowMemberInfoSidebar(true)
                    } else {
                      // 如果没有群成员信息（比如私聊），尝试从 profiles 找
                      const profile = profiles.find(p => p.userId === contextMenu.data.userId)
                      if (profile) {
                        setSelectedMember(profile)
                        setShowMemberInfoSidebar(true)
                      }
                    }
                    setContextMenu(null)
                  }}
                  className='px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-mac-blue hover:text-white transition-colors text-left'
                >
                  <User className='w-3.5 h-3.5' /> 查看资料
                </button>
                {currentTarget?.type === 'group' && (isOwner || isAdmin) && (
                  <>
                    <div className='h-[1px] bg-mac-border my-1' />
                    <button
                      onClick={() => {
                        const member = contextMenu.data.member
                        const userId = contextMenu.data.userId
                        const oldCard = member?.card || ''
                        const newCard = prompt('请输入新的群名片', oldCard)
                        if (newCard !== null) {
                          api.updateGroupMember(currentTarget.id, userId, { card: newCard })
                            .then(fetchDetail)
                        }
                        setContextMenu(null)
                      }}
                      className='px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-mac-blue hover:text-white transition-colors text-left'
                    >
                      <UserCog className='w-3.5 h-3.5' /> 修改群名片
                    </button>
                    {(() => {
                      const member = contextMenu.data.member
                      const userId = contextMenu.data.userId
                      const canKick = isOwner ? String(userId) !== String(me?.userId) : (isAdmin && (!member || member.role === 'member'))
                      if (!canKick) return null

                      return (
                        <button
                          onClick={() => {
                            const memberName = member?.nickname || String(userId)
                            setConfirmDialog({
                              title: '踢出群聊',
                              message: `确定要将 ${memberName} 踢出群聊吗？`,
                              confirmText: '踢出',
                              cancelText: '取消',
                              onConfirm: () => {
                                api.leaveGroup(currentTarget.id, userId)
                                  .then(fetchDetail)
                              }
                            })
                            setContextMenu(null)
                          }}
                          className='px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-red-500 hover:text-white transition-colors text-red-500 text-left'
                        >
                          <UserMinus className='w-3.5 h-3.5' /> 踢出本群
                        </button>
                      )
                    })()}
                  </>
                )}
              </>
            )}

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
                    if (!me || me.userId === 0) {
                      setToast('请先选择一个账号进行操作')
                      return
                    }
                    setReplyTo(contextMenu.data)
                    setContextMenu(null)
                  }}
                  className={cn(
                    'px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-mac-blue hover:text-white transition-colors text-left',
                    (!me || me.userId === 0) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Bot className='w-3.5 h-3.5' /> 回复
                </button>
                {contextMenu.data.senderId !== 10001 && contextMenu.data.isRevoked !== 1 && (
                  <button
                    onClick={() => {
                      if (!me || me.userId === 0) {
                        setToast('请先选择一个账号进行操作')
                        return
                      }
                      handleRecall(contextMenu.data.seq)
                      setContextMenu(null)
                    }}
                    className={cn(
                      'px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-red-500 hover:text-white transition-colors text-red-500 text-left',
                      (!me || me.userId === 0) && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <Undo2 className='w-3.5 h-3.5' /> 撤回
                  </button>
                )}
              </>
            )}

            {(contextMenu.type === 'contact' || contextMenu.type === 'profile') && (
              <button
                onClick={() => {
                  const isProfile = contextMenu.type === 'profile'
                  if (!isProfile && (!me || me.userId === 0)) {
                    setToast('请先选择一个账号进行操作')
                    return
                  }
                  // 如果是私聊联系人，也将类型设为 user 以便彻底删除账号，而不是仅解除好友关系
                  const type = isProfile || contextMenu.data.type === 'private' ? 'user' : 'group'
                  setShowDeleteConfirm({ type: type as any, id: contextMenu.data.userId || contextMenu.data.groupId, clearMessages: true })
                  setContextMenu(null)
                }}
                className={cn(
                  'px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-red-500 hover:text-white transition-colors text-red-500 text-left',
                  (contextMenu.type !== 'profile' && (!me || me.userId === 0)) && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Trash2 className='w-3.5 h-3.5' /> 删除{contextMenu.type === 'profile' ? '身份' : (contextMenu.data.type === 'private' ? '账号' : '群聊')}
              </button>
            )}

            {contextMenu.type === 'member' && (
              <>
                {isOwner && String(contextMenu.data.userId) !== String(me?.userId) && (
                  <button
                    onClick={() => {
                      api.setGroupAdmin(currentTarget!.id, contextMenu.data.userId, contextMenu.data.role !== 'admin')
                        .then(fetchDetail)
                      setContextMenu(null)
                    }}
                    className='px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-mac-blue hover:text-white transition-colors text-left'
                  >
                    <Bot className='w-3.5 h-3.5' /> {contextMenu.data.role === 'admin' ? '取消管理员' : '设为管理员'}
                  </button>
                )}
                {(isOwner || isAdmin) && String(contextMenu.data.userId) !== String(me?.userId) && contextMenu.data.role !== 'owner' && (
                  <button
                    onClick={() => {
                      const memberData = contextMenu.data
                      setConfirmDialog({
                        title: '踢出群聊',
                        message: `确定要将 ${memberData.nickname} 踢出群聊吗？`,
                        confirmText: '踢出',
                        cancelText: '取消',
                        onConfirm: () => {
                          api.leaveGroup(currentTarget!.id, memberData.userId)
                            .then(fetchDetail)
                        }
                      })
                      setContextMenu(null)
                    }}
                    className='px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-red-500 hover:text-white transition-colors text-red-500 text-left'
                  >
                    <LogOut className='w-3.5 h-3.5' /> 踢出群聊
                  </button>
                )}
                {String(contextMenu.data.userId) === String(me?.userId) && (
                  <button
                    onClick={() => {
                      handleGroupAction('leave')
                      setContextMenu(null)
                    }}
                    className='px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-red-500 hover:text-white transition-colors text-red-500 text-left'
                  >
                    <LogOut className='w-3.5 h-3.5' /> 退出群聊
                  </button>
                )}
              </>
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
                if (!me || me.userId === 0) {
                  setToast('访客模式无法创建群聊')
                  return
                }
                setShowCreateModal('group')
                setPlusMenu(null)
              }}
              className={cn(
                'px-3 py-2 text-[13px] flex items-center gap-2 hover:bg-mac-blue hover:text-white transition-colors text-left',
                (!me || me.userId === 0) && 'opacity-50 cursor-not-allowed'
              )}
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
            <div className={cn(
              'backdrop-blur-md text-white px-6 py-2.5 rounded-full shadow-xl flex items-center gap-2 font-medium text-sm border border-white/20',
              toast.includes('失败') ? 'bg-red-500/90 shadow-red-500/20' : 'bg-green-500/90 shadow-green-500/20'
            )}
            >
              <div className='w-1.5 h-1.5 rounded-full bg-white' />
              {toast}
            </div>
          </div>
        )}

        {/* Avatar Zoom Overlay */}
        {showAvatarZoom && (
          <div
            className='fixed inset-0 z-[300] bg-black/80 flex flex-col items-center justify-center animate-in fade-in duration-300'
            onClick={() => setShowAvatarZoom(null)}
          >
            <div className='relative max-w-[90vw] max-h-[80vh]' onClick={e => e.stopPropagation()}>
              <img
                src={showAvatarZoom.url}
                alt='Zoomed Avatar'
                className='max-w-full max-h-[80vh] rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300'
              />
              {(isOwner || isAdmin) && showAvatarZoom.type === 'group' && (
                <div className='absolute -bottom-16 left-1/2 -translate-x-1/2'>
                  <button
                    onClick={() => {
                      const newUrl = window.prompt('请输入新的群头像URL (当前仅支持URL修改)')
                      if (newUrl) {
                        api.saveGroup({ groupId: showAvatarZoom.id, avatarUrl: newUrl })
                          .then(() => {
                            setToast('修改成功')
                            setShowAvatarZoom(null)
                            fetchDetail()
                          })
                          .catch(() => setToast('修改失败'))
                      }
                    }}
                    className='bg-mac-blue text-white px-6 py-2 rounded-xl font-bold shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center gap-2'
                  >
                    <Upload className='w-4 h-4' /> 修改背景/头像
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Member List Sidebar */}
        {showMembersSidebar && currentTarget?.type === 'group' && (
          <>
            <div className='absolute inset-0 z-[55] bg-black/5 animate-in fade-in duration-300' onClick={() => setShowMembersSidebar(false)} />
            <div className={cn('absolute inset-y-0 right-0 z-[60] w-80 border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-300', isDark ? 'bg-gray-800 border-gray-700' : 'bg-[#f8f9fa] border-mac-border')}>
              <div className={cn('h-[52px] px-4 border-b backdrop-blur-md flex items-center justify-between sticky top-0 z-10', isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-mac-border')}>
                <div className='flex items-center gap-2'>
                  <button onClick={() => setShowMembersSidebar(false)} className={cn('p-1 rounded-md', isDark ? 'hover:bg-gray-700' : 'hover:bg-black/5')}>
                    <Undo2 className='w-4 h-4 text-mac-text-secondary rotate-180' />
                  </button>
                  <h2 className={cn('text-sm font-bold', isDark ? 'text-gray-100' : 'text-mac-text-main')}>群成员 ({editInfo?.memberList?.length || 0})</h2>
                </div>
                <button onClick={() => setShowMembersSidebar(false)} className={cn('p-1.5 rounded-lg transition-all', isDark ? 'hover:bg-gray-700' : 'hover:bg-black/5')}>
                  <X className='w-4 h-4 text-mac-text-secondary' />
                </button>
              </div>
              <div className='flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1'>
                {editInfo?.memberList?.map((m: any) => (
                  <div
                    key={m.userId}
                    onClick={() => {
                      setSelectedMember(m)
                      setShowMemberInfoSidebar(true)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const isSelf = String(m.userId) === String(me?.userId)
                      if (!isOwner && !isAdmin && !isSelf) return
                      setContextMenu({ x: e.clientX, y: e.clientY, type: 'member', data: m })
                    }}
                    className={cn('flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all group', isDark ? 'hover:bg-gray-700' : 'hover:bg-white')}
                  >
                    <div className='w-10 h-10 rounded-full bg-mac-active overflow-hidden shrink-0 border border-mac-border'>
                      <img src={`https://q1.qlogo.cn/g?b=qq&s=100&nk=${m.userId}`} className='w-full h-full object-cover' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2'>
                        <span className={cn('text-sm font-medium truncate', isDark ? 'text-gray-200' : 'text-mac-text-main')}>{m.card || m.nickname || m.userId}</span>
                        <span className={cn(
                          'px-1 py-0.5 rounded text-[8px] font-bold text-white shrink-0',
                          m.role === 'owner' ? 'bg-yellow-400' : (m.role === 'admin' ? 'bg-green-500' : (m.title ? 'bg-purple-500' : 'bg-gray-500'))
                        )}
                        >
                          {m.title || (m.role === 'owner' ? '群主' : (m.role === 'admin' ? '管理员' : '成员'))}
                        </span>
                      </div>
                      <div className='text-[10px] text-mac-text-secondary truncate'>ID: {m.userId}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Member Info Sidebar */}
        {showMemberInfoSidebar && selectedMember && (
          <>
            <div className='absolute inset-0 z-[65] bg-black/5 animate-in fade-in duration-300' onClick={() => setShowMemberInfoSidebar(false)} />
            <div className='absolute inset-y-0 right-0 z-[70] w-80 bg-white border-l border-mac-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300'>
              <div className='h-[52px] px-4 border-b border-mac-border bg-white flex items-center justify-between sticky top-0 z-10'>
                <div className='flex items-center gap-2'>
                  <button onClick={() => setShowMemberInfoSidebar(false)} className='p-1 hover:bg-black/5 rounded-md'>
                    <Undo2 className='w-4 h-4 text-mac-text-secondary rotate-180' />
                  </button>
                  <h2 className='text-sm font-bold text-mac-text-main'>成员信息</h2>
                </div>
                <button onClick={() => setShowMemberInfoSidebar(false)} className='p-1.5 hover:bg-black/5 rounded-lg transition-all'>
                  <X className='w-4 h-4 text-mac-text-secondary' />
                </button>
              </div>
              <div className='flex-1 overflow-y-auto'>
                <div className='p-6 flex flex-col items-center gap-4 bg-gradient-to-b from-white to-gray-50'>
                  <div className='w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden'>
                    <img src={`https://q1.qlogo.cn/g?b=qq&s=640&nk=${selectedMember.userId}`} className='w-full h-full object-cover' />
                  </div>
                  <div className='text-center'>
                    <h3 className='text-lg font-bold text-mac-text-main'>{selectedMember.nickname}</h3>
                    <p className='text-xs text-mac-text-secondary'>ID: {selectedMember.userId}</p>
                  </div>
                </div>
                <div className='p-4 space-y-4'>
                  <div className='space-y-1.5'>
                    <label className='text-[10px] text-mac-text-secondary font-bold uppercase'>群名片</label>
                    {(isOwner || isAdmin || String(me?.userId) === String(selectedMember.userId))
                      ? (
                        <input
                          type='text'
                          value={selectedMember.card || ''}
                          onChange={e => setSelectedMember({ ...selectedMember, card: e.target.value })}
                          onBlur={() => api.updateGroupMember(currentTarget!.id, selectedMember.userId, { card: selectedMember.card }).then(fetchDetail)}
                          className='w-full text-sm bg-gray-50 border border-mac-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mac-blue/20'
                          placeholder='设置群名片'
                        />
                      )
                      : (
                        <div className='text-sm px-3 py-2 bg-gray-50 rounded-lg text-mac-text-main'>{selectedMember.card || '未设置'}</div>
                      )}
                  </div>
                  <div className='space-y-1.5'>
                    <label className='text-[10px] text-mac-text-secondary font-bold uppercase'>群头衔</label>
                    {isOwner
                      ? (
                        <input
                          type='text'
                          value={selectedMember.title || ''}
                          onChange={e => setSelectedMember({ ...selectedMember, title: e.target.value })}
                          onBlur={() => api.updateGroupMember(currentTarget!.id, selectedMember.userId, { title: selectedMember.title }).then(fetchDetail)}
                          className='w-full text-sm bg-gray-50 border border-mac-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mac-blue/20'
                          placeholder='设置群头衔'
                        />
                      )
                      : (
                        <div className='text-sm px-3 py-2 bg-gray-50 rounded-lg text-mac-text-main'>{selectedMember.title || '未设置'}</div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Transfer Group Sidebar */}
        {showTransferSidebar && currentTarget?.type === 'group' && (
          <>
            <div className='absolute inset-0 z-[75] bg-black/5 animate-in fade-in duration-300' onClick={() => setShowTransferSidebar(false)} />
            <div className={cn('absolute inset-y-0 right-0 z-[80] w-80 border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-300', isDark ? 'bg-gray-800 border-gray-700' : 'bg-[#f8f9fa] border-mac-border')}>
              <div className='h-[52px] px-4 border-b border-mac-border bg-white flex items-center justify-between sticky top-0 z-10'>
                <div className='flex items-center gap-2'>
                  <button onClick={() => setShowTransferSidebar(false)} className='p-1 hover:bg-black/5 rounded-md'>
                    <Undo2 className='w-4 h-4 text-mac-text-secondary rotate-180' />
                  </button>
                  <h2 className='text-sm font-bold text-mac-text-main'>选择新群主</h2>
                </div>
                <button onClick={() => setShowTransferSidebar(false)} className='p-1.5 hover:bg-black/5 rounded-lg transition-all'>
                  <X className='w-4 h-4 text-mac-text-secondary' />
                </button>
              </div>
              <div className='flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1'>
                <p className='text-[10px] text-mac-text-secondary p-2'>注：群主只能转让给管理员</p>
                {editInfo?.memberList?.filter((m: any) => String(m.userId) !== String(me?.userId)).map((m: any) => (
                  <div
                    key={m.userId}
                    onClick={() => {
                      if (m.role !== 'admin') {
                        setAlertDialog({ title: '无法转让', message: '群主只能转让给管理员' })
                        return
                      }
                      setConfirmDialog({
                        title: '转让群主',
                        message: `确定要将群主转让给 ${m.nickname} 吗？`,
                        confirmText: '确定转让',
                        cancelText: '取消',
                        onConfirm: () => {
                          api.transferGroupOwner(currentTarget.id, m.userId)
                            .then(() => {
                              setToast('转让成功')
                              setShowTransferSidebar(false)
                              fetchDetail()
                            })
                            .catch(() => setToast('转让失败'))
                        }
                      })
                    }}
                    className='flex items-center gap-3 p-2 hover:bg-white rounded-xl cursor-pointer transition-all'
                  >
                    <div className='w-10 h-10 rounded-full bg-mac-active overflow-hidden shrink-0 border border-mac-border'>
                      <img src={`https://q1.qlogo.cn/g?b=qq&s=100&nk=${m.userId}`} className='w-full h-full object-cover' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <span className='text-sm font-medium text-mac-text-main truncate block'>{m.card || m.nickname}</span>
                      <span className={cn(
                        'text-[10px]',
                        m.role === 'admin' ? 'text-mac-blue font-bold' : 'text-mac-text-secondary'
                      )}
                      >{m.role === 'admin' ? '管理员' : '普通成员'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Custom Dialogs */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          confirmText={confirmDialog.confirmText}
          cancelText={confirmDialog.cancelText}
          isDark={isDark}
        />
      )}
      {alertDialog && (
        <AlertDialog
          title={alertDialog.title}
          message={alertDialog.message}
          onClose={() => setAlertDialog(null)}
          isDark={isDark}
        />
      )}
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

function ConfirmDialog ({ title, message, onConfirm, onCancel, confirmText = '确定', cancelText = '取消', isDark }: { title: string, message: string, onConfirm: () => void, onCancel: () => void, confirmText?: string, cancelText?: string, isDark: boolean }) {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center' onClick={onCancel}>
      <div className='absolute inset-0 bg-black/40 backdrop-blur-sm' />
      <div
        className={cn(
          'relative w-full max-w-md mx-4 rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200',
          isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={cn('text-lg font-semibold', isDark ? 'text-gray-100' : 'text-mac-text-main')}>{title}</h2>
        <p className={cn('text-sm leading-relaxed', isDark ? 'text-gray-300' : 'text-mac-text-secondary')}>{message}</p>
        <div className='flex gap-3 pt-2'>
          <button
            onClick={onCancel}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
              isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-mac-active text-mac-text-main hover:bg-gray-200'
            )}
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm()
              onCancel()
            }}
            className='flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-mac-blue text-white hover:bg-blue-600 transition-all shadow-md shadow-mac-blue/20'
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

function AlertDialog ({ title, message, onClose, isDark }: { title: string, message: string, onClose: () => void, isDark: boolean }) {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center' onClick={onClose}>
      <div className='absolute inset-0 bg-black/40 backdrop-blur-sm' />
      <div
        className={cn(
          'relative w-full max-w-md mx-4 rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200',
          isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={cn('text-lg font-semibold', isDark ? 'text-gray-100' : 'text-mac-text-main')}>{title}</h2>
        <p className={cn('text-sm leading-relaxed', isDark ? 'text-gray-300' : 'text-mac-text-secondary')}>{message}</p>
        <div className='flex justify-end pt-2'>
          <button
            onClick={onClose}
            className='px-6 py-2.5 rounded-xl text-sm font-medium bg-mac-blue text-white hover:bg-blue-600 transition-all shadow-md shadow-mac-blue/20'
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
