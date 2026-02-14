import React from 'react'
import { X, ChevronLeft } from 'lucide-react'
import { useChat } from '../ChatContext'

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ')

export const GroupEditSidebar: React.FC = () => {
  const {
    setShowGroupEdit,
    currentTarget, me,
    detailInfo,
    editInfo, setEditInfo,
    handleSave,
    actualTheme
  } = useChat()

  const isDark = actualTheme === 'dark'

  if (!currentTarget || currentTarget.type !== 'group') return null

  const isOwner = String(detailInfo?.ownerId) === String(me?.userId)
  const myMemberInfo = detailInfo?.memberList?.find((m: any) => String(m.userId) === String(me?.userId))
  const isAdmin = myMemberInfo?.role === 'admin' || isOwner

  const handleBlur = () => {
    if (isAdmin && editInfo) {
      handleSave()
    }
  }

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        'h-full w-80 flex flex-col border-l shadow-2xl backdrop-blur-3xl overflow-hidden',
        isDark ? 'bg-gray-900/90 border-white/10' : 'bg-[#F9F1F3]/90 border-black/5'
      )}
    >
      <header className='h-14 px-4 flex items-center gap-2 shrink-0 border-b border-transparent'>
        <button
          onClick={() => setShowGroupEdit(false)}
          className={cn('p-2 rounded-full transition-colors', isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-black/5 text-gray-500')}
        >
          <ChevronLeft className='w-4 h-4' />
        </button>
        <h3 className={cn('text-sm font-bold', isDark ? 'text-gray-200' : 'text-gray-700')}>
          群资料设置
        </h3>
      </header>

      <div className='flex-1 overflow-y-auto px-4 pb-8 space-y-6 pt-6'>
        <div className='space-y-2'>
          <h5 className='px-1 text-[11px] font-bold text-gray-500 uppercase tracking-widest opacity-70'>群聊名称</h5>
          <div className={cn('p-4 rounded-2xl shadow-sm transition-all', isDark ? 'bg-gray-800/50' : 'bg-white')}>
            {isAdmin
              ? (
                <input
                  type='text'
                  value={editInfo?.groupName || ''}
                  onBlur={handleBlur}
                  onChange={(e) => setEditInfo({ ...editInfo, groupName: e.target.value })}
                  className={cn('w-full bg-transparent border-none outline-none text-sm font-bold focus:ring-0 p-0',
                    isDark ? 'text-white' : 'text-gray-900')}
                  placeholder='输入群名称'
                />
              )
              : (
                <div className={cn('text-sm font-bold', isDark ? 'text-gray-200' : 'text-gray-700')}>
                  {detailInfo?.groupName}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}
