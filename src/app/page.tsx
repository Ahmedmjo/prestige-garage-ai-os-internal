'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Film,
  Users,
  Package,
  Wrench,
  Bot,
  Menu,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/lib/i18n-context'
import { NotificationBell } from '@/components/prestige/notification-bell'
import { LanguageToggle } from '@/components/prestige/language-toggle'
import { PrestigeLogo } from '@/components/prestige/logo'
import { BackgroundDecoration } from '@/components/prestige/background'
import { Dashboard } from '@/components/modules/dashboard'
import { RollsModule } from '@/components/modules/rolls-module'
import { EmployeesModule } from '@/components/modules/employees-module'
import { StockModule } from '@/components/modules/stock-module'
import { ServicesModule } from '@/components/modules/services-module'
import { AIChat } from '@/components/modules/ai-chat'

type TabId = 'dashboard' | 'rolls' | 'employees' | 'stock' | 'services' | 'ai'

export default function Home() {
  const { t, lang, dir } = useI18n()
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const NAV_ITEMS: { id: TabId; label: string; icon: any; color: string }[] = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard, color: '#DC143C' },
    { id: 'rolls', label: t('rolls'), icon: Film, color: '#FF9100' },
    { id: 'employees', label: t('employees'), icon: Users, color: '#00C853' },
    { id: 'stock', label: t('stock'), icon: Package, color: '#BB86FC' },
    { id: 'services', label: t('services'), icon: Wrench, color: '#03DAC6' },
    { id: 'ai', label: t('aiAssistant'), icon: Bot, color: '#DC143C' },
  ]

  return (
    <div className="min-h-screen bg-black text-white flex relative" dir={dir}>
      {/* Subtle luxury car background */}
      <BackgroundDecoration />

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 ${dir === 'rtl' ? 'right-0 border-l' : 'left-0 border-r'} z-50 h-screen w-72 bg-[#050505]/95 backdrop-blur-md border-white/5 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : (dir === 'rtl' ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0')
        }`}
      >
        {/* Logo / Header */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <PrestigeLogo size={48} className="flex-shrink-0" />
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Prestige Garage</h1>
              <p className="text-xs text-gray-500">{t('appTagline')}</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden mr-auto p-2 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id)
                  setSidebarOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#DC143C]/15 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                style={isActive ? { borderRightWidth: dir === 'rtl' ? '2px' : '0', borderLeftWidth: dir === 'ltr' ? '2px' : '0', borderStyle: 'solid', borderColor: '#DC143C' } : {}}
              >
                <Icon size={20} style={{ color: isActive ? item.color : undefined }} />
                <span className="flex-1 text-right">{item.label}</span>
                {item.id === 'ai' && (
                  <span className="w-2 h-2 rounded-full bg-[#DC143C] animate-pulse" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/5">
          <div className="glass-effect rounded-lg p-3 flex items-center justify-between">
            <LanguageToggle />
            <NotificationBell />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 glass-effect border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-400 hover:text-white"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2">
              <PrestigeLogo size={32} className="lg:hidden" />
              <span className="font-bold hidden sm:inline">Prestige Garage</span>
            </div>
          </div>
          {/* Right side actions */}
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <NotificationBell />
          </div>
        </header>

        {/* Module content — fixed: no AnimatePresence mode="wait" to prevent shaking */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden">
          {/* Use simple key-based remount without exit animation to prevent shaking */}
          <motion.div
            key={activeTab + lang}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
            {activeTab === 'rolls' && <RollsModule />}
            {activeTab === 'employees' && <EmployeesModule />}
            {activeTab === 'stock' && <StockModule />}
            {activeTab === 'services' && <ServicesModule />}
            {activeTab === 'ai' && <AIChat />}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
