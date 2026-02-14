import React, { useEffect } from 'react'
import { ChevronRight, Plus, Minus } from 'lucide-react'
import { useChat } from '../ChatContext'

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ')

export const ChatDetailsSidebar: React.FC = () => {
  const {
    showSettings,
    currentTarget, me,
    detailInfo,
    editInfo, setEditInfo,
    fetchDetail, handleSave,
    handleGroupAction,
    actualTheme, setShowDeleteConfirm,
    setShowGroupEdit
  } = useChat()

  const isDark = actualTheme === 'dark'

  useEffect(() => {
    if (showSettings && currentTarget) {
      fetchDetail()
    }
  }, [showSettings, currentTarget, fetchDetail])

  if (!currentTarget) return null

  const isMe = currentTarget.type === 'private' && String(me?.userId) === String(currentTarget.id)
  const isPrivate = currentTarget.type === 'private'
  const isGroup = currentTarget.type === 'group'
  const isOwner = isGroup && String(detailInfo?.ownerId) === String(me?.userId)
  const isMember = isGroup && (
    detailInfo?.memberList?.some((m: any) => String(m.userId) === String(me?.userId)) ||
    me?.groupList?.some((gid: any) => String(gid) === String(currentTarget.id))
  )

  const displayId = String(currentTarget.id)
  const avatarUrl = isPrivate
    ? `https://q.qlogo.cn/g?b=qq&nk=${displayId}&s=100`
    : `https://p.qlogo.cn/gh/${displayId}/${displayId}/100`

  const handleBlur = () => {
    if ((isMe || isOwner || isMember) && editInfo) {
      // Ensure age is a valid number if in private chat
      let sanitizedInfo = { ...editInfo }
      if (isPrivate) {
        sanitizedInfo = {
          ...sanitizedInfo,
          age: parseInt(String(editInfo.age)) || 0
        }
      }
      setEditInfo(sanitizedInfo)
      handleSave()
    }
  }

  const members = [...(detailInfo?.memberList || [])].sort((a: any, b: any) => {
    const priority: any = { owner: 1, admin: 2, member: 3 }
    const aP = priority[a.role] || 4
    const bP = priority[b.role] || 4
    return aP - bP
  })
  const displayMembers = members.slice(0, 13)

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'h-full w-80 flex flex-col border-l shadow-2xl backdrop-blur-3xl overflow-hidden',
        isDark ? 'bg-gray-900/90 border-white/10' : 'bg-[#F9F1F3]/90 border-black/5'
      )}
    >
      <header className='h-14 px-4 flex items-center justify-between shrink-0'>
        <div className='w-8' />
        <h3 className={cn('text-sm font-bold', isDark ? 'text-gray-200' : 'text-gray-700')}>
          {isGroup ? '群聊资料' : '用户资料'}
        </h3>
        <div className='w-8' />
      </header>

      <div className='flex-1 overflow-y-auto px-4 pb-8 space-y-4 pt-2'>
        {/* Top Header Card */}
        <div className={cn('p-4 rounded-2xl shadow-sm flex items-center gap-4', isDark ? 'bg-gray-800/50' : 'bg-white')}>
          <div className='w-14 h-14 rounded-full overflow-hidden shrink-0 border-2 border-white shadow-sm'>
            <img src={avatarUrl} alt='avatar' className='w-full h-full object-cover' />
          </div>
          <div className='flex-1 min-w-0 text-left'>
            <div className='flex items-center gap-2'>
              <h4 className={cn('text-base font-bold truncate', isDark ? 'text-white' : 'text-gray-900')}>
                {isGroup
                  ? (detailInfo?.groupName || currentTarget.name)
                  : (detailInfo?.nickname || String(currentTarget.id))}
              </h4>
            </div>
            <div className={cn('text-xs opacity-50 font-medium', isDark ? 'text-gray-100' : 'text-gray-900')}>
              {isPrivate ? `QQ: ${displayId}` : `ID: ${displayId}`}
            </div>
          </div>
        </div>

        {/* Private Chat Profile Info */}
        {isPrivate && (
          <div className='space-y-2'>
            <h5 className='px-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest opacity-70 text-left'>个人资料</h5>
            <div className={cn('p-4 rounded-2xl shadow-sm space-y-4', isDark ? 'bg-gray-800/50' : 'bg-white')}>
              <div className='flex flex-col gap-1 text-left'>
                <span className='text-[10px] font-bold opacity-40 uppercase tracking-wider'>昵称</span>
                {isMe
                  ? (
                    <input
                      type='text'
                      value={editInfo?.nickname || ''}
                      onBlur={handleBlur}
                      onChange={(e) => setEditInfo({ ...editInfo, nickname: e.target.value })}
                      className={cn('text-sm font-bold bg-transparent border-b border-transparent focus:border-mac-blue outline-none transition-all',
                        isDark ? 'text-white' : 'text-gray-900')}
                      placeholder='输入昵称'
                    />)
                  : (
                    <span className={cn('text-sm font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                      {detailInfo?.nickname || '未设置'}
                    </span>)}
              </div>
              <div className='flex flex-col gap-1 text-left'>
                <span className='text-[10px] font-bold opacity-40 uppercase tracking-wider'>QQ号</span>
                <span className={cn('text-sm font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                  {displayId}
                </span>
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div className='flex flex-col gap-1 text-left'>
                  <span className='text-[10px] font-bold opacity-40 uppercase tracking-widest px-1'>性别</span>
                  {isMe
                    ? (
                      <div className={cn('flex p-1 rounded-2xl border backdrop-blur-md transition-all mt-1',
                        isDark ? 'bg-black/20 border-white/10' : 'bg-white/50 border-black/5')}
                      >
                        {[
                          { val: 'male', label: '男' },
                          { val: 'female', label: '女' },
                          { val: 'unknown', label: '未知' }
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            onClick={() => {
                              const nextInfo = { ...editInfo, gender: opt.val as any }
                              setEditInfo(nextInfo)
                              handleSave()
                            }}
                            className={cn('flex-1 py-1.5 text-xs font-bold rounded-xl transition-all',
                              (editInfo?.gender || detailInfo?.gender) === opt.val
                                ? (isDark ? 'bg-mac-blue text-white shadow-lg shadow-mac-blue/20' : 'bg-mac-blue text-white shadow-md shadow-mac-blue/20')
                                : (isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-mac-text-main hover:bg-black/5')
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>)
                    : (
                      <span className={cn('text-sm font-bold px-1', isDark ? 'text-white' : 'text-gray-900')}>
                        {detailInfo?.gender === 'male' ? '男' : detailInfo?.gender === 'female' ? '女' : '未知'}
                      </span>)}
                </div>
                <div className='flex flex-col gap-1 text-left'>
                  <span className='text-[10px] font-bold opacity-40 uppercase tracking-wider'>年龄</span>
                  {isMe
                    ? (
                      <input
                        type='number'
                        value={editInfo?.age ?? ''}
                        onBlur={handleBlur}
                        onChange={(e) => setEditInfo({ ...editInfo, age: e.target.value })}
                        className={cn('text-sm font-bold bg-transparent border-b border-transparent focus:border-mac-blue outline-none transition-all w-full',
                          isDark ? 'text-white' : 'text-gray-900')}
                        placeholder='年龄'
                      />)
                    : (
                      <span className={cn('text-sm font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                        {detailInfo?.age ?? '未知'} 岁
                      </span>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Member Grid Card */}
        {isGroup && (
          <div className={cn('p-4 rounded-2xl shadow-sm space-y-4', isDark ? 'bg-gray-800/50' : 'bg-white')}>
            <div className='flex items-center justify-between'>
              <span className={cn('text-sm font-bold', isDark ? 'text-gray-200' : 'text-gray-700')}>群聊成员</span>
              <button className='flex items-center gap-0.5 text-xs font-medium opacity-50 hover:opacity-100 transition-opacity'>
                查看{members.length}名群成员 <ChevronRight className='w-4 h-4' />
              </button>
            </div>
            <div className='grid grid-cols-5 gap-y-4 gap-x-2'>
              {displayMembers.map((member: any) => (
                <div key={member.userId} className='flex flex-col items-center gap-1 cursor-pointer group'>
                  <div className='w-10 h-10 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-mac-blue/20 transition-all'>
                    <img
                      src={`https://q.qlogo.cn/g?b=qq&nk=${member.userId}&s=100`}
                      alt='m'
                      className='w-full h-full object-cover'
                    />
                  </div>
                  <span className='text-[10px] w-full text-center truncate font-medium opacity-60'>
                    {member.nickname || member.userId}
                  </span>
                </div>
              ))}
              {isMember && (
                <div className='flex flex-col items-center gap-1'>
                  <button className={cn('w-10 h-10 rounded-full border-2 border-dashed flex items-center justify-center transition-colors',
                    isDark ? 'border-white/20 hover:bg-white/10' : 'border-black/10 hover:bg-black/5')}
                  >
                    <Plus className='w-5 h-5 opacity-40' />
                  </button>
                  <span className='text-[10px] font-medium opacity-40 uppercase'>邀请</span>
                </div>
              )}
              {isOwner && (
                <div className='flex flex-col items-center gap-1'>
                  <button className={cn('w-10 h-10 rounded-full border-2 border-dashed flex items-center justify-center transition-colors',
                    isDark ? 'border-white/20 hover:bg-white/10' : 'border-black/10 hover:bg-black/5')}
                  >
                    <Minus className='w-5 h-5 opacity-40' />
                  </button>
                  <span className='text-[10px] font-medium opacity-40 uppercase'>移出</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section: Management */}
        {isGroup && isMember && (
          <div className='space-y-2'>
            <h5 className='px-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest opacity-70 text-left'>资料管理</h5>
            <div className={cn('rounded-2xl shadow-sm divide-y overflow-hidden', isDark ? 'bg-gray-800/50 divide-white/5' : 'bg-white divide-black/5')}>
              <button
                onClick={() => setShowGroupEdit(true)}
                className={cn('w-full flex items-center justify-between p-4 text-sm font-bold transition-colors active:opacity-60',
                  isDark ? 'hover:bg-white/5' : 'hover:bg-black/5')}
              >
                <span>群资料设置</span>
                <ChevronRight className='w-4 h-4 opacity-30' />
              </button>
            </div>
          </div>
        )}

        {/* Section: Announcement */}
        {isGroup && (
          <div className='space-y-2'>
            <h5 className='px-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest opacity-70 text-left'>群公告</h5>
            <div className={cn('p-4 rounded-2xl shadow-sm text-sm font-bold flex flex-col gap-2 group cursor-pointer transition-all',
              isDark ? 'bg-gray-800/50 hover:bg-gray-800/80' : 'bg-white hover:shadow-md')}
            >
              <div className='flex items-center justify-between'>
                <div className='flex-1 truncate opacity-70 text-left font-medium leading-relaxed'>
                  {detailInfo?.announcement || '暂无公告'}
                </div>
                <ChevronRight className='w-4 h-4 opacity-30 translate-x-1 group-hover:translate-x-2 transition-transform shrink-0' />
              </div>
            </div>
          </div>
        )}

        {/* Section: My Nickname */}
        {isGroup && isMember && (
          <div className={cn('p-4 rounded-2xl shadow-sm flex items-center justify-between transition-colors group', isDark ? 'bg-gray-800/50 hover:bg-gray-800/80' : 'bg-white hover:bg-gray-50')}>
            <div className='grow space-y-0.5 text-left min-w-0'>
              <span className={cn('text-[10px] font-bold opacity-40 uppercase tracking-wider')}>我的本群昵称</span>
              <input
                type='text'
                value={editInfo?.card || ''}
                onBlur={handleBlur}
                onChange={(e) => setEditInfo({ ...editInfo, card: e.target.value })}
                placeholder='未设置'
                className={cn('text-sm font-bold w-full bg-transparent border-b border-transparent focus:border-mac-blue outline-none transition-all',
                  isDark ? 'text-white' : 'text-gray-900')}
              />
            </div>
            <ChevronRight className='w-4 h-4 opacity-30 shrink-0 group-focus-within:rotate-90 transition-transform' />
          </div>
        )}

        {/* Actions - Leave/Disband */}
        <div className='pt-6 space-y-3'>
          {isMember && (
            <>
              <button
                onClick={() => handleGroupAction('leave')}
                className={cn('w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-sm',
                  isDark ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white' : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white')}
              >
                退出群聊
              </button>
              {isOwner && (
                <button
                  onClick={() => setShowDeleteConfirm({ type: 'group', id: currentTarget.id, clearMessages: true })}
                  className={cn('w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95 border-2 border-dashed border-red-500/10 text-red-500/40 hover:text-red-500 hover:border-red-500/30',
                    isDark ? 'hover:bg-red-500/5' : 'hover:bg-white')}
                >
                  解散该群
                </button>
              )}
            </>
          )}
          {!isMember && isGroup && (
            <button
              onClick={() => handleGroupAction('join')}
              className='w-full py-3.5 bg-mac-blue text-white rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-mac-blue/20'
            >
              加入群聊
            </button>
          )}
          {isPrivate && !isMe && (
            <button
              onClick={() => setShowDeleteConfirm({ type: 'friend', id: currentTarget.id, clearMessages: true })}
              className={cn('w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-sm',
                isDark ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white' : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white')}
            >
              删除好友
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
