import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Message, UserInfo, Contact, Target, ChatScene, GroupInfo, GroupMember } from './types'
import { MessageType } from '../types/Message'
import { ActionTypes } from '../core/protocol'
import { api } from './api'

interface ChatContextType {
  me: UserInfo | null
  setMe: (user: UserInfo | null) => void
  contacts: Contact[]
  setContacts: (contacts: Contact[]) => void
  messages: Message[]
  setMessages: (messages: Message[]) => void
  currentTarget: Target
  setCurrentTarget: (target: Target) => void
  messageCache: Record<string, Message[]>
  setMessageCache: (cache: Record<string, Message[]>) => void
  sendMsg: (scene: ChatScene, content: MessageType) => Promise<void>
  handleFiles: (files: FileList | null) => Promise<void>
  resendMsg: (tempId: string) => Promise<void>
  loadMe: () => Promise<void>
  loadProfiles: () => Promise<void>
  switchUser: (userId: number) => Promise<void>
  loadContacts: () => Promise<void>
  // UI States
  activeTab: string
  setActiveTab: (tab: string) => void
  toast: { message: string, type: 'success' | 'error' | 'info' } | null
  setToast: (toast: string | { message: string, type: 'success' | 'error' | 'info' } | null) => void
  showSettings: boolean
  setShowSettings: (show: boolean) => void
  showProfilesSidebar: boolean
  setShowProfilesSidebar: (show: boolean) => void
  profiles: UserInfo[]
  setProfiles: (profiles: UserInfo[]) => void
  plusMenu: { x: number, y: number } | null
  setPlusMenu: (menu: { x: number, y: number } | null) => void
  contextMenu: { x: number, y: number, type: any, data: any } | null
  setContextMenu: (menu: { x: number, y: number, type: any, data: any } | null) => void
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  actualTheme: 'light' | 'dark'

  // Staged content for InputArea
  stagedImages: string[]
  setStagedImages: (v: string[]) => void

  // New shared states
  showMeSettings: boolean
  setShowMeSettings: (v: boolean) => void
  detailInfo: UserInfo | GroupInfo | null
  setDetailInfo: (v: UserInfo | GroupInfo | null) => void
  editInfo: UserInfo | GroupInfo | null
  setEditInfo: (v: UserInfo | GroupInfo | null) => void
  showDeleteConfirm: { type: 'dissolve' | 'friend' | 'user' | 'group', id: number, clearMessages: boolean } | null
  setShowDeleteConfirm: (v: { type: 'dissolve' | 'friend' | 'user' | 'group', id: number, clearMessages: boolean } | null) => void
  showCreateModal: 'private' | 'group' | null
  setShowCreateModal: (v: 'private' | 'group' | null) => void
  backendError: string | null
  setBackendError: (v: string | null) => void
  createData: { name: string, id: string, age: number, gender: 'male' | 'female' | 'unknown' }
  setCreateData: (v: { name: string, id: string, age: number, gender: 'male' | 'female' | 'unknown' }) => void
  replyTo: Message | null
  setReplyTo: (v: Message | null) => void
  showMembersSidebar: boolean
  setShowMembersSidebar: (v: boolean) => void
  showMemberInfoSidebar: boolean
  setShowMemberInfoSidebar: (v: boolean) => void
  selectedMember: GroupMember | null
  setSelectedMember: (v: GroupMember | null) => void
  showTransferSidebar: boolean
  setShowTransferSidebar: (v: boolean) => void
  showAvatarZoom: { url: string, type: 'private' | 'group', id: number } | null
  setShowAvatarZoom: (v: { url: string, type: 'private' | 'group', id: number } | null) => void
  showGroupEdit: boolean
  setShowGroupEdit: (v: boolean) => void
  alertDialog: { title: string, message: string } | null
  setAlertDialog: (v: { title: string, message: string } | null) => void
  confirmDialog: { title: string, message: string, onConfirm: () => void, confirmText?: string, cancelText?: string } | null
  setConfirmDialog: (v: { title: string, message: string, onConfirm: () => void, confirmText?: string, cancelText?: string } | null) => void

  // New shared functions
  fetchDetail: () => Promise<void>
  handleSaveMe: () => Promise<void>
  handleSave: () => Promise<void>
  confirmDelete: (mode: 'clear' | 'only') => Promise<void>
  handleDelete: () => Promise<void>
  handleGroupAction: (action: 'join' | 'leave') => Promise<void>
  handleRecall: (seq: number) => Promise<void>
  handleCreateContact: () => Promise<void>
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [me, setMe] = useState<UserInfo | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [currentTarget, setCurrentTarget] = useState<Target>(null)
  const [messageCache, setMessageCache] = useState<Record<string, Message[]>>(() => {
    try {
      const saved = localStorage.getItem('message_cache')
      return saved ? JSON.parse(saved) : {}
    } catch (e) {
      return {}
    }
  })
  const [activeTab, setActiveTab] = useState('chat')
  const [showSettings, setShowSettings] = useState(false)
  const [profiles, setProfiles] = useState<UserInfo[]>([])
  const [showProfilesSidebar, setShowProfilesSidebar] = useState(false)
  const [plusMenu, setPlusMenu] = useState<{ x: number, y: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'contact' | 'profile' | 'message', data: any } | null>(null)
  const [toast, _setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null)

  const setToast = useCallback((val: string | { message: string, type: 'success' | 'error' | 'info' } | null) => {
    if (typeof val === 'string') {
      _setToast({ message: val, type: 'info' })
    } else {
      _setToast(val)
    }
  }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => _setToast(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const [showMeSettings, setShowMeSettings] = useState(false)
  const [detailInfo, setDetailInfo] = useState<UserInfo | GroupInfo | null>(null)
  const [editInfo, setEditInfo] = useState<UserInfo | GroupInfo | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'dissolve' | 'friend' | 'user' | 'group', id: number, clearMessages: boolean } | null>(null)
  const [showCreateModal, setShowCreateModal] = useState<'private' | 'group' | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [createData, setCreateData] = useState({ name: '', id: '', age: 20, gender: 'unknown' as 'male' | 'female' | 'unknown' })
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [showMembersSidebar, setShowMembersSidebar] = useState(false)
  const [showMemberInfoSidebar, setShowMemberInfoSidebar] = useState(false)
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null)
  const [showTransferSidebar, setShowTransferSidebar] = useState(false)
  const [showAvatarZoom, setShowAvatarZoom] = useState<{ url: string, type: 'private' | 'group', id: number } | null>(null)
  const [showGroupEdit, setShowGroupEdit] = useState(false)
  const [alertDialog, setAlertDialog] = useState<{ title: string, message: string } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ title: string, message: string, onConfirm: () => void, confirmText?: string, cancelText?: string } | null>(null)

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system'
  })
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light')

  const [stagedImages, setStagedImages] = useState<string[]>([])

  const actualTheme = theme === 'system' ? systemTheme : theme

  const updateMessageStatus = useCallback((tempId: string, updates: Partial<Message>) => {
    setMessageCache(prev => {
      const newCache = { ...prev }
      for (const key in newCache) {
        newCache[key] = newCache[key].map(m =>
          m.tempId === tempId ? { ...m, ...updates } : m
        )
      }
      return newCache
    })

    // Also update current messages if they match
    setMessages(prev => prev.map(m =>
      m.tempId === tempId ? { ...m, ...updates } : m
    ))
  }, [])

  const loadMe = useCallback(async () => {
    try {
      const data = await api.send(ActionTypes.GET_USER_INFO, { target: 'current' }) as any
      setMe(data || { type: 'private', userId: 0, nickname: '未登录', age: 0, gender: 'unknown', friendList: [] })
    } catch (e) {
      setMe({ type: 'private', userId: 0, nickname: '未登录', age: 0, gender: 'unknown', friendList: [] })
    }
  }, [])

  const loadProfiles = useCallback(async () => {
    try {
      const data = await api.send(ActionTypes.GET_USER_INFO, {}) as any
      setProfiles(Array.isArray(data) ? data : [])
    } catch (e) {
      setProfiles([])
    }
  }, [])

  const loadContacts = useCallback(async () => {
    try {
      const [users, groups] = await Promise.all([
        api.send(ActionTypes.GET_USER_INFO, {}) as Promise<any[]>,
        api.send(ActionTypes.GET_GROUP_INFO, {}) as Promise<any[]>
      ])

      const filteredUsers = (Array.isArray(users) ? users : [])
        .map((u: any) => ({ ...u, type: 'private' }))
      const filteredGroups = (Array.isArray(groups) ? groups : [])
        .map((g: any) => ({ ...g, type: 'group' }))

      setContacts([...filteredUsers, ...filteredGroups])
    } catch (e) {
      console.error('Failed to load contacts', e)
    }
  }, [])

  const loadMessages = useCallback(async (target: Target) => {
    if (!target) return
    try {
      const data = await api.send(ActionTypes.GET_MESSAGES, {
        type: target.type,
        targetId: target.id,
        limit: 50
      })
      const history = (Array.isArray(data) ? data : []).map((m: any) => ({ ...m, status: 'success' }))
      setMessages(history)

      const key = `${target.type}-${target.id}`
      setMessageCache(prev => ({
        ...prev,
        [key]: history
      }))
    } catch (e) {
      console.error('Failed to load messages', e)
    }
  }, [])

  const sendMsg = useCallback(async (scene: ChatScene, content: MessageType) => {
    if (!me || !currentTarget) return

    const tempId = Math.random().toString(36).substring(7)
    const timestamp = Math.floor(Date.now() / 1000)

    const newMessage: Message = {
      type: scene,
      senderId: me.userId,
      targetId: currentTarget.id,
      content,
      timestamp,
      isRevoked: 0,
      status: 'sending',
      tempId
    }

    // Add to cache and current messages
    const cacheKey = `${scene}-${currentTarget.id}`
    setMessageCache(prev => ({
      ...prev,
      [cacheKey]: [...(prev[cacheKey] || []), newMessage]
    }))

    if (currentTarget.type === scene && currentTarget.id === newMessage.targetId) {
      setMessages(prev => [...prev, newMessage])
    }

    try {
      const result = await api.send<any>(ActionTypes.SEND_MESSAGE, {
        type: scene,
        targetId: currentTarget.id,
        content,
        tempId
      })

      // Update with real seq and status
      updateMessageStatus(tempId, {
        seq: result.messageSeq || result.seq,
        status: 'success',
        timestamp: result.timestamp || timestamp
      })
    } catch (error) {
      console.error('Failed to send message:', error)
      updateMessageStatus(tempId, { status: 'failed' })
    }
  }, [me, currentTarget, updateMessageStatus])

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !currentTarget) return

    const fileList = Array.from(files)
    const targetName = currentTarget.name

    const processSingleFile = async (file: File) => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader()
        reader.onload = async (e) => {
          const base64 = e.target?.result as string
          if (base64) {
            const isImage = file.type.startsWith('image/')
            if (isImage) {
              setStagedImages(prev => [...prev, base64])
            } else {
              const content: MessageType = [{ type: 'file', uri: base64, filename: file.name, size: file.size }]
              await sendMsg(currentTarget.type, content)
            }
          }
          resolve()
        }
        reader.readAsDataURL(file)
      })
    }

    const images = fileList.filter(f => f.type.startsWith('image/'))
    const nonImages = fileList.filter(f => !f.type.startsWith('image/'))

    // 图片直接进入待发送状态，无需确认
    for (const img of images) {
      await processSingleFile(img)
    }

    // 非图片文件走确认流程
    if (nonImages.length === 1) {
      setConfirmDialog({
        title: '发送文件',
        message: `是否要将文件 "${nonImages[0].name}" 发送到 ${targetName}？`,
        onConfirm: () => processSingleFile(nonImages[0]),
        confirmText: '发送',
        cancelText: '取消'
      })
    } else if (nonImages.length > 1) {
      setConfirmDialog({
        title: '批量发送文件',
        message: `确认要将选中的 ${nonImages.length} 个文件发送到 ${targetName} 吗？每个文件将作为独立消息发送。`,
        onConfirm: async () => {
          for (const file of nonImages) {
            await processSingleFile(file)
          }
        },
        confirmText: '确定发送',
        cancelText: '取消'
      })
    }
  }, [currentTarget, sendMsg, setConfirmDialog])

  const resendMsg = useCallback(async (tempId: string) => {
    // Find the message in cache
    let msgToResend: Message | undefined
    for (const key in messageCache) {
      msgToResend = messageCache[key].find(m => m.tempId === tempId)
      if (msgToResend) break
    }

    if (!msgToResend) return

    // Reset status to sending
    updateMessageStatus(tempId, { status: 'sending' })

    try {
      const result = await api.send<any>(ActionTypes.SEND_MESSAGE, {
        type: msgToResend.type,
        targetId: msgToResend.targetId,
        content: msgToResend.content
      })

      updateMessageStatus(tempId, {
        seq: result.messageSeq || result.seq,
        status: 'success',
        timestamp: result.timestamp || msgToResend.timestamp
      })
    } catch (error) {
      updateMessageStatus(tempId, { status: 'failed' })
    }
  }, [messageCache, updateMessageStatus])

  const switchUser = useCallback(async (userId: number) => {
    try {
      setMessages([])
      setCurrentTarget(null)
      setMessageCache({})
      // 不要在切换时立即清空联系人，等待同步更新

      await api.send(ActionTypes.SET_ACTIVE_USER, { userId })
      localStorage.setItem('active_user_id', String(userId))
      await loadMe()
    } catch (e) {
      setToast({ message: '切换失败', type: 'error' })
    }
  }, [loadMe])

  const fetchDetail = useCallback(async () => {
    if (!currentTarget) return
    try {
      const data = currentTarget.type === 'private'
        ? await api.send(ActionTypes.GET_USER_INFO, { userId: currentTarget.id })
        : await api.send(ActionTypes.GET_GROUP_INFO, { groupId: currentTarget.id })

      setDetailInfo(data as any)

      // Initialize editInfo
      let initialEditInfo = data ? { ...(data as any) } : null

      // If it's a group, we also want to be able to edit "My Group Card" in this group
      if (currentTarget.type === 'group' && data && me) {
        const myMemberInfo = (data as any).memberList?.find((m: any) => String(m.userId) === String(me.userId))
        if (myMemberInfo) {
          initialEditInfo = {
            ...initialEditInfo,
            card: myMemberInfo.card || '' // Use the member's card from the list
          }
        }
      }

      setEditInfo(initialEditInfo)
    } catch (e) {
      console.error('Failed to fetch detail', e)
    }
  }, [currentTarget, me])

  useEffect(() => {
    if (currentTarget) {
      loadMessages(currentTarget)
      // Close all sidebars when target changes
      setShowSettings(false)
      setShowMembersSidebar(false)
      setShowMemberInfoSidebar(false)
      setShowTransferSidebar(false)
      setShowGroupEdit(false)
      setDetailInfo(null)
      setEditInfo(null)
    } else {
      setMessages([])
    }
  }, [currentTarget?.id, currentTarget?.type, loadMessages])

  useEffect(() => {
    if (currentTarget) {
      fetchDetail()
    }
  }, [currentTarget, fetchDetail])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light')
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light')
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const handleSync = (data: any) => {
      if (data.me) setMe(data.me)
      if (data.contacts) setContacts(data.contacts)
    }

    const unbindSync = api.on(ActionTypes.SYNC_ALL, handleSync)
    const unbindMessage = api.on(ActionTypes.MESSAGE, (data: any) => {
      // 这里的 data 已经是 payload 了，因为 api.ts 做了转发
      const msg = data as Message
      // 这里的 key 需要保持一致：private 场景下，缓存键名应始终为对端 ID
      const peerId = msg.type === 'group' ? msg.targetId : (msg.senderId === me?.userId ? msg.targetId : msg.senderId)
      const key = `${msg.type}-${peerId}`

      setContacts(prev => prev.map(c => {
        const cId = c.type === 'private' ? c.userId : c.groupId
        if (c.type === msg.type && cId === peerId) {
          const isMe = msg.senderId === me?.userId
          const isCurrentChat = currentTarget && currentTarget.type === msg.type && currentTarget.id === peerId
          return {
            ...c,
            lastMsg: msg,
            unreadCount: (!isMe && !isCurrentChat) ? (c.unreadCount || 0) + 1 : (c.unreadCount || 0)
          }
        }
        return c
      }))

      setMessageCache(prev => {
        const current = prev[key] || []
        // 幂等处理：通过 seq 或 tempId 判定（防止发送者收到自己的广播后重复显示）
        if (current.some(m => (m.seq && m.seq === msg.seq) || (m.tempId && msg.tempId && m.tempId === msg.tempId))) {
          // 如果找到了 tempId 匹配但状态还是 sending，说明广播比 response 先到，这里可以顺便更新下
          return {
            ...prev,
            [key]: current.map(m => (m.tempId && msg.tempId && m.tempId === msg.tempId) ? { ...m, ...msg, status: 'success' } : m)
          }
        }
        return {
          ...prev,
          [key]: [...current, { ...msg, status: 'success' }]
        }
      })

      if (currentTarget && currentTarget.type === msg.type && (
        (msg.type === 'group' && currentTarget.id === msg.targetId) ||
        (msg.type === 'private' && (currentTarget.id === msg.senderId || currentTarget.id === msg.targetId))
      )) {
        setMessages(prev => {
          if (prev.some(m => (m.seq && m.seq === msg.seq) || (m.tempId && msg.tempId && m.tempId === msg.tempId))) {
            return prev.map(m => (m.tempId && msg.tempId && m.tempId === msg.tempId) ? { ...m, ...msg, status: 'success' } : m)
          }
          return [...prev, { ...msg, status: 'success' }]
        })
      }
    })

    const unbindPush = api.on(ActionTypes.PUSH_MESSAGE, (data: any) => {
      // 兼容 PUSH_MESSAGE 动作
      const msg = data as Message
      const peerId = msg.type === 'group' ? msg.targetId : (msg.senderId === me?.userId ? msg.targetId : msg.senderId)
      const key = `${msg.type}-${peerId}`

      setContacts(prev => prev.map(c => {
        const cId = c.type === 'private' ? c.userId : c.groupId
        if (c.type === msg.type && cId === peerId) {
          const isMe = msg.senderId === me?.userId
          const isCurrentChat = currentTarget && currentTarget.type === msg.type && currentTarget.id === peerId
          return {
            ...c,
            lastMsg: msg,
            unreadCount: (!isMe && !isCurrentChat) ? (c.unreadCount || 0) + 1 : (c.unreadCount || 0)
          }
        }
        return c
      }))

      setMessageCache(prev => {
        const current = prev[key] || []
        if (current.some(m => (m.seq && m.seq === msg.seq) || (m.tempId && msg.tempId && m.tempId === msg.tempId))) {
          return {
            ...prev,
            [key]: current.map(m => (m.tempId && msg.tempId && m.tempId === msg.tempId) ? { ...m, ...msg, status: 'success' } : m)
          }
        }
        return {
          ...prev,
          [key]: [...current, { ...msg, status: 'success' }]
        }
      })

      if (currentTarget && currentTarget.type === msg.type && (
        (msg.type === 'group' && currentTarget.id === msg.targetId) ||
        (msg.type === 'private' && (currentTarget.id === msg.senderId || currentTarget.id === msg.targetId))
      )) {
        setMessages(prev => {
          if (prev.some(m => (m.seq && m.seq === msg.seq) || (m.tempId && msg.tempId && m.tempId === msg.tempId))) {
            return prev.map(m => (m.tempId && msg.tempId && m.tempId === msg.tempId) ? { ...m, ...msg, status: 'success' } : m)
          }
          return [...prev, { ...msg, status: 'success' }]
        })
      }
    })

    const unbindRecall = api.on(ActionTypes.RECALL, (data: any) => {
      const { type, seq } = data
      // 更新缓存
      setMessageCache(prev => {
        const newCache = { ...prev }
        for (const k in newCache) {
          if (k.startsWith(type)) {
            newCache[k] = newCache[k].map(m => m.seq === seq ? { ...m, isRevoked: 1 } : m)
          }
        }
        return newCache
      })
      // 更新当前视图
      setMessages(prev => prev.map(m => m.seq === seq ? { ...m, isRevoked: 1 } : m))
    })

    return () => {
      unbindSync()
      unbindMessage()
      unbindPush()
      unbindRecall()
    }
  }, [me, currentTarget])

  useEffect(() => {
    api.connect().catch(console.error)
    const unbindConnect = api.onConnect(() => {
      const savedUserId = localStorage.getItem('active_user_id')
      if (savedUserId && savedUserId !== '0') {
        api.send(ActionTypes.SET_ACTIVE_USER, { userId: Number(savedUserId) })
          .then((res: any) => {
            // 后端返回确认后的真实 userId
            const actualId = res.userId || 0
            localStorage.setItem('active_user_id', String(actualId))
            loadMe()
          })
          .catch(() => {
            localStorage.setItem('active_user_id', '0')
            loadMe()
          })
      } else {
        loadMe()
      }
      loadProfiles()
    })
    return () => { unbindConnect() }
  }, [loadMe, loadProfiles])

  const handleSaveMe = useCallback(async () => {
    if (!editInfo || editInfo.type !== 'private') return
    try {
      await api.send(ActionTypes.SAVE_USER, editInfo)
      setShowMeSettings(false)
      loadMe()
    } catch (e) {
      setAlertDialog({ title: '保存失败', message: '无法保存用户信息，请稍后重试' })
    }
  }, [editInfo, loadMe])

  const handleSave = useCallback(async (manualInfo?: any) => {
    const info = manualInfo || editInfo
    if (!currentTarget || !info) return
    try {
      if (currentTarget.type === 'private') {
        await api.send(ActionTypes.SAVE_USER, { ...info, userId: currentTarget.id })
      } else {
        // Save group basic info
        await api.send(ActionTypes.SAVE_GROUP, { ...info, groupId: currentTarget.id })

        // If in a group, also update "My Group Card" if it was changed
        if (me) {
          await api.send(ActionTypes.UPDATE_GROUP_MEMBER, {
            groupId: currentTarget.id,
            userId: me.userId,
            card: info.card
          })
        }
      }
      loadContacts()
      fetchDetail()
    } catch (e) {
      setAlertDialog({ title: '保存失败', message: '无法保存设置，请稍后重试' })
    }
  }, [currentTarget, editInfo, me, loadContacts, fetchDetail])

  const confirmDelete = useCallback(async (mode: 'clear' | 'only') => {
    if (!showDeleteConfirm) return
    const { type, id } = showDeleteConfirm

    try {
      if (type === 'user') {
        await api.send(ActionTypes.REMOVE_USER, { userId: id, clearMessages: mode === 'clear' })
        if (me?.userId === id) {
          setMe({ type: 'private', userId: 0, nickname: '未登录', age: 0, gender: 'unknown', friendList: [] })
          setCurrentTarget(null)
          setContacts([])
        }
        loadProfiles()
        loadMe()
        loadContacts()
      } else if (type === 'friend') {
        await api.send(ActionTypes.UPDATE_FRIENDSHIP, { userAId: me?.userId, userBId: id, action: 'remove', clearMessages: mode === 'clear' })
        loadMe()
        loadContacts()
      } else if (type === 'group') {
        // Disband/Delete Group logic
        await api.send(ActionTypes.REMOVE_GROUP, { groupId: id, clearMessages: mode === 'clear' })
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
  }, [showDeleteConfirm, me, currentTarget, loadMe, loadProfiles, loadContacts, setShowSettings, setCurrentTarget])

  const handleDelete = useCallback(async () => {
    if (!currentTarget || !me) return
    const isFriend = me.friendList?.includes(currentTarget.id)

    if (currentTarget.type === 'private' && !isFriend) {
      setToast({ message: '好友申请已发送', type: 'success' })
      try {
        await api.send(ActionTypes.UPDATE_FRIENDSHIP, { userAId: me.userId, userBId: currentTarget.id, action: 'add' })
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
  }, [currentTarget, me, loadMe, loadContacts])

  const handleGroupAction = useCallback(async (action: 'join' | 'leave') => {
    if (!currentTarget || !me) return
    try {
      if (action === 'join') {
        await api.send(ActionTypes.JOIN_GROUP, { groupId: currentTarget.id, userId: me.userId })
        setToast({ message: '成功加入群聊', type: 'success' })
        await loadMe()
      } else {
        const isOwner = currentTarget.type === 'group' && detailInfo?.type === 'group' && String(detailInfo.ownerId) === String(me.userId)
        if (isOwner) {
          setConfirmDialog({
            title: '群主退群',
            message: '群主退群将导致群聊被解散。确定要继续吗？',
            confirmText: '确定退出',
            cancelText: '取消',
            onConfirm: () => {
              setShowDeleteConfirm({ type: 'group', id: currentTarget.id, clearMessages: true })
            }
          })
          return
        }
        await api.send(ActionTypes.LEAVE_GROUP, { groupId: currentTarget.id, userId: me.userId })
        setToast({ message: '已退出群聊', type: 'info' })
        await loadMe()
      }
      await fetchDetail()
      await loadContacts()
    } catch (e) {
      setAlertDialog({ title: '操作失败', message: '无法完成操作，请稍后重试' })
    }
  }, [currentTarget, me, detailInfo, fetchDetail, loadContacts, loadMe, setShowSettings, setCurrentTarget, setToast])

  const handleRecall = useCallback(async (seq: number) => {
    try {
      await api.send(ActionTypes.RECALL_MESSAGE, {
        type: currentTarget?.type || 'private',
        targetId: currentTarget?.id,
        seq
      })
    } catch (e) {
      setToast({ message: '撤回消息失败', type: 'error' })
    }
  }, [currentTarget])

  const handleCreateContact = useCallback(async () => {
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
        const exists = contacts.some(c => c.type === 'group' && String((c as any).groupId) === createData.id)
        if (exists) return '该群聊已在你的列表中'
      }
      return null
    }

    if (getCreateError()) return
    const isPrivate = showCreateModal === 'private'
    if (!isPrivate && (!me || me.userId === 0)) {
      setToast({ message: '访客模式无法创建群聊', type: 'error' })
      return
    }
    try {
      if (isPrivate) {
        await api.send(ActionTypes.SAVE_USER, {
          userId: Number(createData.id),
          nickname: createData.name,
          age: Number(createData.age),
          gender: createData.gender
        })
      } else {
        const gid = Number(createData.id)
        await api.send(ActionTypes.SAVE_GROUP, {
          groupId: gid,
          groupName: createData.name,
          ownerId: me?.userId || 0
        })
      }
      setShowCreateModal(null)
      setBackendError(null)
      setCreateData({ name: '', id: '', age: 20, gender: 'unknown' })
      setToast({ message: isPrivate ? '用户添加成功' : '群聊创建成功', type: 'success' })
      await loadMe()
      await loadContacts()
      await loadProfiles()
    } catch (e) {
      setBackendError('创建失败')
    }
  }, [backendError, createData, showCreateModal, profiles, contacts, me, loadMe, loadContacts, loadProfiles])

  return (
    <ChatContext.Provider value={{
      me,
      setMe,
      contacts,
      setContacts,
      messages,
      setMessages,
      currentTarget,
      setCurrentTarget,
      messageCache,
      setMessageCache,
      sendMsg,
      handleFiles,
      resendMsg,
      loadMe,
      loadProfiles,
      switchUser,
      loadContacts,
      activeTab,
      setActiveTab,
      toast,
      setToast,
      showSettings,
      setShowSettings,
      showProfilesSidebar,
      setShowProfilesSidebar,
      profiles,
      setProfiles,
      plusMenu,
      setPlusMenu,
      contextMenu,
      setContextMenu,
      theme,
      setTheme,
      actualTheme,

      stagedImages,
      setStagedImages,

      showMeSettings,
      setShowMeSettings,
      detailInfo,
      setDetailInfo,
      editInfo,
      setEditInfo,
      showDeleteConfirm,
      setShowDeleteConfirm,
      showCreateModal,
      setShowCreateModal,
      backendError,
      setBackendError,
      createData,
      setCreateData,
      replyTo,
      setReplyTo,
      showMembersSidebar,
      setShowMembersSidebar,
      showMemberInfoSidebar,
      setShowMemberInfoSidebar,
      selectedMember,
      setSelectedMember,
      showTransferSidebar,
      setShowTransferSidebar,
      showAvatarZoom,
      setShowAvatarZoom,
      showGroupEdit,
      setShowGroupEdit,
      alertDialog,
      setAlertDialog,
      confirmDialog,
      setConfirmDialog,

      fetchDetail,
      handleSaveMe,
      handleSave,
      confirmDelete,
      handleDelete,
      handleGroupAction,
      handleRecall,
      handleCreateContact
    }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export const useChat = () => {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}
