import React from 'react'
import { useChat } from './ChatContext'
import { Sidebar } from './components/Sidebar'
import { ChatWindow } from './components/ChatWindow'
import { Overlays } from './components/Overlays'
import { cn } from './utils'

export default function App () {
  const {
    actualTheme,
    setContextMenu,
    setPlusMenu
  } = useChat()

  const isDark = actualTheme === 'dark'

  return (
    <div
      className={cn(
        'flex h-full font-sans antialiased overflow-hidden transition-colors duration-500 relative',
        isDark ? 'bg-gray-950 text-gray-100' : 'bg-white text-mac-text-main'
      )}
      onClick={() => {
        setContextMenu(null)
        setPlusMenu(null)
      }}
    >
      {/* Background Orbs for glass effect visibility */}
      <div className='absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-mac-blue/10 rounded-full blur-[120px] pointer-events-none' />
      <div className='absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none' />

      <Sidebar />
      <ChatWindow />
      <Overlays />
    </div>
  )
}
