'use client'

import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Film,
  Users,
  Package,
  Wrench,
  Bot,
  Menu,
  X,
  Calendar,
  Shield,
  Settings as SettingsIcon,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { NotificationBell } from '@/components/prestige/notification-bell'
import { LanguageToggle } from '@/components/prestige/language-toggle'
import { PrestigeLogo } from '@/components/prestige/logo'
import { BackgroundDecoration } from '@/components/prestige/background'
import { PWAInstallButton } from '@/components/prestige/pwa-install-button'
import { PasswordGate } from '@/components/prestige/password-gate'
import { Dashboard } from '@/components/modules/dashboard'
import { RollsModule } from '@/components/modules/rolls-module'
import { EmployeesModule } from '@/components/modules/employees-module'
import { StockModule } from '@/components/modules/stock-module'
import { ServicesModule } from '@/components/modules/services-module'
import { AIChat } from '@/components/modules/ai-chat'
import { AttendanceModule } from '@/components/modules/attendance-module'
import { ProtectionModule } from '@/components/modules/protection-module'
import { SettingsModule } from '@/components/modules/settings-module'

type TabId = 'dashboard' | 'rolls' | 'protection' | 'employees' | 'attendance' | 'stock' | 'services' | 'ai' | 'settings'

export default function Home() {
  const { t, lang, dir } = useI18n()
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const NAV_ITEMS: { id: TabId; label: string; icon: any; color: string }[] = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard, color: '#DC143C' },
    { id: 'protection', label: lang === 'ar' ? 'البروتيكشن' : 'Protection', icon: Shield, color: '#00C853' },
    { id: 'rolls', label: t('rolls'), icon: Film, color: '#FF9100' },
    { id: 'employees', label: t('employees'), icon: Users, color: '#00C853' },
    { id: 'attendance', label: lang === 'ar' ? 'الحضور والغياب' : 'Attendance', icon: Calendar, color: '#03DAC6' },
    { id: 'stock', label: t('stock'), icon: Package, color: '#BB86FC' },
    { id: 'services', label: t('services'), icon: Wrench, color: '#03DAC6' },
    { id: 'ai', label: t('aiAssistant'), icon: Bot, color: '#DC143C' },
    { id: 'settings', label: lang === 'ar' ? 'الإعدادات' : 'Settings', icon: SettingsIcon, color: '#888888' },
  ]

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  // Read tab from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab') as TabId
    if (tabParam && NAV_ITEMS.find(n => n.id === tabParam)) {
      setActiveTab(tabParam)
    } else if (hash && NAV_ITEMS.find(n => n.id === hash as TabId)) {
      setActiveTab(hash as TabId)
    }
  }, [])

  return (
    <PasswordGate>
    <div className="min-h-screen bg-black text-white flex relative" dir={dir}>
      <BackgroundDecoration />

      {/* Mobile overlay — no animation to prevent shaking */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 z-50 h-screen w-72 bg-[#050505]/95 backdrop-blur-md border-white/5 flex flex-col ${
          dir === 'rtl' ? 'right-0 border-l' : 'left-0 border-r'
        } ${
          sidebarOpen
            ? 'translate-x-0'
            : dir === 'rtl'
            ? 'translate-x-full lg:translate-x-0'
            : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ transitionProperty: 'transform', transitionDuration: '0.2s', transitionTimingFunction: 'ease-out' }}
      >
        {/* Logo / Header */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <PrestigeLogo size={48} className="flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-white leading-tight truncate">Prestige Garage</h1>
              <p className="text-xs text-gray-500 truncate">{t('appTagline')}</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden mr-auto p-2 text-gray-400 hover:text-white flex-shrink-0"
              aria-label="Close sidebar"
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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-[#DC143C]/15 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                style={{ transition: 'background-color 0.15s, color 0.15s' }}
              >
                <Icon size={20} style={{ color: isActive ? item.color : undefined }} className="flex-shrink-0" />
                <span className="flex-1 text-right">{item.label}</span>
                {item.id === 'ai' && (
                  <span className="w-2 h-2 rounded-full bg-[#DC143C] animate-pulse flex-shrink-0" />
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
              aria-label="Open sidebar"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2">
              <PrestigeLogo size={32} className="lg:hidden" />
              <span className="font-bold hidden sm:inline">Prestige Garage</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PWAInstallButton />
            <LanguageToggle />
            <NotificationBell />
          </div>
        </header>

        {/* Module content — NO animation to prevent shaking */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden" key={activeTab + lang}>
          {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
          {activeTab === 'protection' && <ProtectionModule />}
          {activeTab === 'rolls' && <RollsModule />}
          {activeTab === 'employees' && <EmployeesModule />}
          {activeTab === 'attendance' && <AttendanceModule />}
          {activeTab === 'stock' && <StockModule />}
          {activeTab === 'services' && <ServicesModule />}
          {activeTab === 'ai' && <AIChat />}
          {activeTab === 'settings' && <SettingsModule />}
        </main>
      </div>
    </div>
    </PasswordGate>
  )
}
