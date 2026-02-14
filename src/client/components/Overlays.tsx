import React from 'react'
import { User, Trash2, Plus } from 'lucide-react'
import { useChat } from '../ChatContext'

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ')

export const Overlays: React.FC = () => {
  const {
    plusMenu, setPlusMenu,
    contextMenu, setContextMenu,
    toast,
    confirmDialog, setConfirmDialog,
    alertDialog, setAlertDialog,
    actualTheme,
    showCreateModal, setShowCreateModal,
    createData, setCreateData,
    handleCreateContact,
    backendError, setBackendError,
    profiles, contacts, me,
    showDeleteConfirm, setShowDeleteConfirm, confirmDelete
  } = useChat()

  const isDark = actualTheme === 'dark'

  const getValidationError = () => {
    if (!createData.id) return null
    if (!/^\d+$/.test(createData.id)) return 'QQ号为纯数字'
    const len = createData.id.length
    if (showCreateModal === 'private') {
      if (len < 5 || len > 10) return 'QQ号请在 5-10 位之间'
      if (profiles.some(p => String(p.userId) === createData.id)) return 'QQ号已存在'
    } else if (showCreateModal === 'group') {
      if (len < 5 || len > 11) return '群号请在 5-11 位之间'
      if (contacts.some(c => c.type === 'group' && String((c as any).groupId) === createData.id)) return '该群号已存在'
    }
    return null
  }

  const validationError = getValidationError()

  if (!plusMenu && !contextMenu && !toast && !showCreateModal && !confirmDialog && !alertDialog && !showDeleteConfirm) return null

  const displayId = createData.id && /^\d+$/.test(createData.id) && createData.id.length >= 5 ? createData.id : '10000'
  const avatarUrl = showCreateModal === 'private'
    ? `https://q.qlogo.cn/g?b=qq&nk=${displayId}&s=100`
    : `https://p.qlogo.cn/gh/${displayId}/${displayId}/100`

  return (
    <>
      {/* Plus Menu */}
      {plusMenu && (
        <div
          className='fixed inset-0 z-50'
          onClick={() => setPlusMenu(null)}
        >
          <div
            className={cn('absolute w-40 rounded-2xl shadow-2xl border p-1 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-2xl transition-colors',
              isDark ? 'bg-gray-800/80 border-white/10' : 'bg-white/80 border-black/5')}
            style={{ left: plusMenu.x, top: plusMenu.y }}
          >
            <button
              onClick={() => {
                setCreateData({ name: '', id: '', age: 0, gender: 'unknown' as any })
                setShowCreateModal('private')
                setPlusMenu(null)
              }}
              className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl transition-colors', isDark ? 'hover:bg-mac-blue text-white' : 'hover:bg-mac-blue hover:text-white text-mac-text-main')}
            >
              <User className='w-4 h-4' /> 创建角色
            </button>
            <button
              disabled={!me || me.userId === 0}
              onClick={() => {
                setCreateData({ name: '', id: '', age: 0, gender: 'unknown' as any })
                setShowCreateModal('group')
                setPlusMenu(null)
              }}
              className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl transition-colors transition-opacity',
                (!me || me.userId === 0) ? 'opacity-30 cursor-not-allowed' : (isDark ? 'hover:bg-mac-blue text-white' : 'hover:bg-mac-blue hover:text-white text-mac-text-main'))}
            >
              <Plus className='w-4 h-4' /> 创建群聊
            </button>
          </div>
        </div>
      )}

      {/* Create Account/Group Modal */}
      {showCreateModal && (
        <div className='fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300'>
          <div className={cn('w-full max-w-[360px] rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border animate-in zoom-in-95 duration-200 overflow-hidden backdrop-blur-3xl',
            isDark ? 'bg-gray-800/85 border-white/15' : 'bg-white/85 border-white/40')}
          >
            <div className='p-8 flex flex-col gap-6'>
              <div className='flex items-center gap-5'>
                <div className={cn('w-20 h-20 rounded-[22px] overflow-hidden border-2 shrink-0 flex items-center justify-center shadow-lg transition-all',
                  isDark ? 'border-white/10 bg-gray-900/50' : 'border-black/5 bg-white/50')}
                >
                  <img src={avatarUrl} alt='avatar' className='w-full h-full object-cover' />
                </div>
                <div>
                  <h3 className={cn('text-xl font-bold tracking-tight', isDark ? 'text-white' : 'text-gray-900')}>
                    {showCreateModal === 'private' ? '创建新角色' : '创建新群聊'}
                  </h3>
                  <p className={cn('text-xs font-medium opacity-50 mt-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {showCreateModal === 'private' ? '模拟一个 QQ 用户登录' : '创建一个全新的模拟群聊'}
                  </p>
                </div>
              </div>

              <div className='space-y-4'>
                <div className='space-y-1.5'>
                  <label className={cn('text-[10px] font-bold px-1 uppercase tracking-widest opacity-60', isDark ? 'text-gray-300' : 'text-gray-500')}>
                    {showCreateModal === 'private' ? '昵称' : '群聊名称'}
                  </label>
                  <input
                    type='text'
                    value={createData.name}
                    onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                    placeholder={showCreateModal === 'private' ? '选填 (默认使用ID)' : '如: 开发讨论群'}
                    className={cn('w-full px-4 py-2.5 rounded-2xl border outline-none focus:ring-4 transition-all text-sm font-medium',
                      isDark ? 'bg-black/20 border-white/10 focus:ring-mac-blue/20 text-white' : 'bg-white/50 border-black/5 focus:ring-mac-blue/15 text-mac-text-main')}
                  />
                </div>

                <div className='space-y-1.5'>
                  <label className={cn('text-[10px] font-bold px-1 uppercase tracking-widest opacity-60', isDark ? 'text-gray-300' : 'text-gray-500')}>
                    {showCreateModal === 'private' ? '账号 ID' : '群组 ID'}
                  </label>
                  <input
                    type='text'
                    value={createData.id}
                    onChange={(e) => setCreateData({ ...createData, id: e.target.value })}
                    placeholder='QQ号 (数字)'
                    className={cn('w-full px-4 py-2.5 rounded-2xl border outline-none focus:ring-4 transition-all text-sm font-medium',
                      validationError
                        ? 'border-red-500/50 bg-red-500/5 focus:ring-red-500/10'
                        : (isDark ? 'bg-black/20 border-white/10 focus:ring-mac-blue/20 text-white' : 'bg-white/50 border-black/5 focus:ring-mac-blue/15 text-mac-text-main'))}
                  />
                  {validationError && (
                    <p className='text-[10px] text-red-500 mt-1.5 ml-1 px-1 font-bold animate-in slide-in-from-top-1'>{validationError}</p>
                  )}
                </div>

                {showCreateModal === 'private' && (
                  <div className='flex gap-4'>
                    <div className='flex-1 space-y-1.5'>
                      <label className={cn('text-[10px] font-bold px-1 uppercase tracking-widest opacity-60', isDark ? 'text-gray-300' : 'text-gray-500')}>年龄</label>
                      <input
                        type='number'
                        value={createData.age}
                        onChange={(e) => setCreateData({ ...createData, age: parseInt(e.target.value) || 0 })}
                        className={cn('w-full px-4 py-2.5 rounded-2xl border outline-none focus:ring-4 transition-all text-sm font-medium backdrop-blur-md',
                          isDark ? 'bg-black/20 border-white/10 focus:ring-mac-blue/20 text-white' : 'bg-white/50 border-black/5 focus:ring-mac-blue/15 text-mac-text-main')}
                      />
                    </div>
                    <div className='flex-1 space-y-1.5'>
                      <label className={cn('text-[10px] font-bold px-1 uppercase tracking-widest opacity-60', isDark ? 'text-gray-300' : 'text-gray-500')}>性别</label>
                      <div className={cn('flex p-1 rounded-2xl border backdrop-blur-md transition-all',
                        isDark ? 'bg-black/20 border-white/10' : 'bg-white/50 border-black/5')}
                      >
                        {[
                          { val: 'male', label: '男' },
                          { val: 'female', label: '女' },
                          { val: 'unknown', label: '未知' }
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            onClick={() => setCreateData({ ...createData, gender: opt.val as any })}
                            className={cn('flex-1 py-1.5 text-xs font-bold rounded-xl transition-all',
                              createData.gender === opt.val
                                ? (isDark ? 'bg-mac-blue text-white shadow-lg shadow-mac-blue/20' : 'bg-mac-blue text-white shadow-md shadow-mac-blue/20')
                                : (isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-mac-text-main hover:bg-black/5')
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {backendError && (
                <div className='text-xs text-red-500 bg-red-500/10 p-3 rounded-2xl border border-red-500/20 font-bold'>
                  {backendError}
                </div>
              )}

              <div className='flex gap-4 mt-2'>
                <button
                  onClick={() => {
                    setShowCreateModal(null)
                    setBackendError(null)
                  }}
                  className={cn('flex-1 px-5 py-3 text-sm font-bold rounded-2xl border transition-all active:scale-95',
                    isDark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-black/5 text-gray-600 hover:bg-black/5')}
                >
                  取消
                </button>
                <button
                  onClick={handleCreateContact}
                  disabled={!!validationError || !createData.id}
                  className={cn('flex-1 px-5 py-3 text-sm font-bold text-white rounded-2xl shadow-xl transition-all active:scale-95',
                    (validationError || !createData.id)
                      ? 'bg-gray-400/50 cursor-not-allowed'
                      : 'bg-mac-blue hover:shadow-mac-blue/40 shadow-mac-blue/20')}
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className='fixed inset-0 z-50'
          onClick={() => setContextMenu(null)}
        >
          <div
            className={cn('absolute w-44 rounded-2xl shadow-2xl border p-1 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-2xl',
              isDark ? 'bg-gray-800/80 border-white/10' : 'bg-white/80 border-black/5')}
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className='px-3 py-2 text-[10px] uppercase tracking-widest text-gray-400 font-black opacity-50'>菜单</div>
            <button
              onClick={() => {
                if (contextMenu.type === 'contact') {
                  const contact = contextMenu.data
                  setConfirmDialog({
                    title: contact.type === 'private' ? '删除好友' : '解散群聊',
                    message: `确定要${contact.type === 'private' ? '删除该好友' : '解散该群聊'}吗？此操作不可撤销。`,
                    onConfirm: () => {
                      if (contact.type === 'private') {
                        api.send(ActionTypes.REMOVE_USER, { userId: contact.userId }).catch(console.error)
                      } else {
                        api.send(ActionTypes.REMOVE_GROUP, { groupId: contact.groupId }).catch(console.error)
                      }
                    }
                  })
                } else if (contextMenu.type === 'profile') {
                  const profile = contextMenu.data
                  setConfirmDialog({
                    title: '删除角色',
                    message: `确定要删除角色「${profile.nickname}」吗？`,
                    onConfirm: () => {
                      api.send(ActionTypes.REMOVE_USER, { userId: profile.userId }).catch(console.error)
                    }
                  })
                }
                setContextMenu(null)
              }}
              className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl transition-colors text-red-500',
                isDark ? 'hover:bg-red-500 hover:text-white' : 'hover:bg-red-500 hover:text-white')}
            >
              <Trash2 className='w-4 h-4' /> 删除
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className='fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 duration-300'>
          <div className={cn(
            'backdrop-blur-2xl px-6 py-3 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] flex items-center gap-3 border transition-all duration-300',
            toast.type === 'success'
              ? (isDark ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-green-50/80 border-green-200 text-green-600')
              : toast.type === 'error'
                ? (isDark ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-red-50/80 border-red-200 text-red-600')
                : (isDark ? 'bg-gray-800/80 border-white/10 text-white' : 'bg-white/80 border-black/5 text-mac-text-main')
          )}
          >
            <div className={cn('w-2 h-2 rounded-full animate-pulse',
              toast.type === 'success' ? 'bg-green-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-mac-blue')}
            />
            <span className='text-sm font-bold tracking-tight'>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className='fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200'>
          <div className={cn('w-full max-w-[320px] rounded-2xl shadow-2xl border animate-in zoom-in-95 duration-200 overflow-hidden', isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-mac-border')}>
            <div className='p-6 pb-4'>
              <h3 className={cn('text-lg font-semibold mb-2', isDark ? 'text-white' : 'text-gray-900')}>{confirmDialog.title}</h3>
              <p className={cn('text-sm leading-relaxed', isDark ? 'text-gray-400' : 'text-gray-500')}>{confirmDialog.message}</p>
            </div>
            <div className={cn('flex border-t', isDark ? 'border-gray-700' : 'border-mac-border')}>
              <button
                onClick={() => setConfirmDialog(null)}
                className={cn('flex-1 px-4 py-3 text-sm font-medium transition-colors border-r', isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-700' : 'border-mac-border text-gray-500 hover:bg-mac-active')}
              >
                {confirmDialog.cancelText || '取消'}
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm()
                  setConfirmDialog(null)
                }}
                className='flex-1 px-4 py-3 text-sm font-bold text-mac-blue transition-colors hover:bg-mac-blue/10 active:bg-mac-blue/20'
              >
                {confirmDialog.confirmText || '确定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Dialog */}
      {alertDialog && (
        <div className='fixed inset-0 z-[111] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200'>
          <div className={cn('w-full max-w-[320px] rounded-2xl shadow-2xl border animate-in zoom-in-95 duration-200 overflow-hidden', isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-mac-border')}>
            <div className='p-6 pb-4 text-center'>
              <h3 className={cn('text-lg font-semibold mb-2', isDark ? 'text-white' : 'text-gray-900')}>{alertDialog.title}</h3>
              <p className={cn('text-sm leading-relaxed', isDark ? 'text-gray-400' : 'text-gray-500')}>{alertDialog.message}</p>
            </div>
            <div className={cn('flex border-t', isDark ? 'border-gray-700' : 'border-mac-border')}>
              <button
                onClick={() => setAlertDialog(null)}
                className='w-full px-4 py-3 text-sm font-bold text-mac-blue transition-colors hover:bg-mac-blue/10 active:bg-mac-blue/20'
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className='fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200'>
          <div className={cn('w-full max-w-[340px] rounded-[24px] shadow-2xl border-2 overflow-hidden animate-in zoom-in-95 duration-200 backdrop-blur-3xl',
            isDark ? 'bg-gray-800/90 border-white/10' : 'bg-white/95 border-black/5')}
          >
            <div className='p-8 text-center space-y-4'>
              <div className='w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4'>
                <Trash2 className='w-8 h-8 text-red-500' />
              </div>
              <h3 className={cn('text-xl font-black tracking-tight', isDark ? 'text-white' : 'text-gray-900')}>
                {showDeleteConfirm.type === 'friend' ? '删除好友' : (showDeleteConfirm.type === 'group' ? '退出群聊' : '注销角色')}
              </h3>
              <p className={cn('text-sm font-medium leading-relaxed opacity-60', isDark ? 'text-gray-300' : 'text-mac-text-secondary')}>
                {showDeleteConfirm.type === 'friend'
                  ? '确定要删除该好友吗？你可以选择是否同时清空你们的所有聊天记录。'
                  : '操作后将无法找回该目标，请确认是否继续？'}
              </p>
            </div>
            <div className='p-6 pt-0 flex flex-col gap-3'>
              <button
                onClick={() => confirmDelete('clear')}
                className='w-full py-3.5 rounded-2xl bg-red-500 text-white font-black text-sm shadow-xl shadow-red-500/20 hover:scale-[1.02] active:scale-95 transition-all'
              >
                {showDeleteConfirm.type === 'friend' ? '删除并清空聊天记录' : '确定执行'}
              </button>
              {showDeleteConfirm.type === 'friend' && (
                <button
                  onClick={() => confirmDelete('only')}
                  className={cn('w-full py-3.5 rounded-2xl font-bold text-sm border transition-all active:scale-95',
                    isDark ? 'border-white/10 text-white hover:bg-white/5' : 'border-black/5 text-gray-700 hover:bg-black/5')}
                >
                  仅删除好友
                </button>
              )}
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className={cn('w-full py-2 text-xs font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity',
                  isDark ? 'text-gray-400' : 'text-gray-500')}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const PlusIcon = ({ className }: { className?: string }) => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className={className}>
    <line x1='12' y1='5' x2='12' y2='19' />
    <line x1='5' y1='12' x2='19' y2='12' />
  </svg>
)
