'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, User, Lightbulb, X, MessageCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { PrestigeLogo } from '@/components/prestige/logo'
import { useI18n } from '@/lib/i18n-context'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  intent?: string
  provider?: string
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

const QUICK_SUGGESTIONS = [
  { icon: '🎞️', text: 'كم رصيد رول Hexis BF-001؟' },
  { icon: '👷', text: 'من أكثر فني أداءً هذا الشهر؟' },
  { icon: '📦', text: 'قيمة المخزون المتبقي؟' },
  { icon: '📊', text: 'اعملي تقرير شهري ليونيو' },
  { icon: '⚠️', text: 'أظهر لي الرولات اللي أوشكت على النفاذ' },
  { icon: '💰', text: 'كم ربحنا من البروتيكشن؟' },
  { icon: '💵', text: 'صافي مرتب علي يحيى في يونيو؟' },
  { icon: '🔧', text: 'كم استهلكنا من TPU هذا الشهر؟' },
  { icon: '📈', text: 'قارن بين أداء الفنيين' },
  { icon: '🔔', text: 'ما هي التنبيهات النشطة؟' },
]

const STORAGE_KEY = 'prestige-ai-conversations'
const ACTIVE_KEY = 'prestige-ai-active-conversation'

interface AIChatProps {
  onClose: () => void
}

export function AIChat({ onClose }: AIChatProps) {
  const { t, lang } = useI18n()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = loadConversations()
    if (saved.length > 0) {
      setConversations(saved)
      const activeSaved = localStorage.getItem(ACTIVE_KEY)
      if (activeSaved && saved.find(c => c.id === activeSaved)) setActiveId(activeSaved)
      else startNewConversation(saved)
    } else {
      startNewConversation([])
    }
  }, [])

  useEffect(() => {
    if (conversations.length > 0) saveConversations(conversations)
  }, [conversations])

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId)
  }, [activeId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [activeId, conversations, loading])

  function loadConversations(): Conversation[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return []
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  }

  function saveConversations(convs: Conversation[]) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(convs.slice(-20))) } catch {}
  }

  function startNewConversation(existing: Conversation[] = conversations): string {
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      title: lang === 'ar' ? 'محادثة جديدة' : 'New Conversation',
      messages: [{
        role: 'assistant',
        content: lang === 'ar'
          ? 'مرحباً! أنا **مساعد برستيج** 🤖\n\nأنا هنا لمساعدتك في إدارة المركز بذكاء. أقدر أجيب على أسئلتك عن المخزون والرواتب والإيرادات.\n\nاكتب سؤالك أو اختر من الاقتراحات 👇'
          : 'Hello! I am **Prestige Assistant** 🤖\n\nAsk me anything about inventory, salaries, or revenue.',
        timestamp: new Date().toISOString(),
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setConversations(prev => [...prev, newConv])
    setActiveId(newConv.id)
    return newConv.id
  }

  function handleNewChat() { startNewConversation(); setShowHistory(false) }

  function handleDeleteConversation(id: string) {
    if (!confirm(lang === 'ar' ? 'حذف هذه المحادثة؟' : 'Delete?')) return
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id)
      if (id === activeId) {
        if (filtered.length > 0) setActiveId(filtered[filtered.length - 1].id)
        else startNewConversation([])
      }
      return filtered
    })
  }

  const activeConversation = conversations.find(c => c.id === activeId)
  const messages = activeConversation?.messages || []

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    let currentId = activeId
    if (!currentId) currentId = startNewConversation()

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date().toISOString() }
    setConversations(prev => prev.map(c => {
      if (c.id === currentId) {
        const title = c.messages.length <= 1 ? text.slice(0, 40) + (text.length > 40 ? '...' : '') : c.title
        return { ...c, title, messages: [...c.messages, userMsg], updatedAt: new Date().toISOString() }
      }
      return c
    }))
    setInput('')
    setLoading(true)

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })
      if (!res.ok) throw new Error('فشل الاتصال')
      const data = await res.json()
      const aiMsg: Message = {
        role: 'assistant', content: data.reply,
        timestamp: data.timestamp || new Date().toISOString(),
        intent: data.intent, provider: data.provider,
      }
      setConversations(prev => prev.map(c => c.id === currentId ? { ...c, messages: [...c.messages, aiMsg], updatedAt: new Date().toISOString() } : c))
    } catch (e: any) {
      toast.error(e.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <PrestigeLogo size={48} />
            <span className="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 rounded-full bg-[#00C853] border-2 border-black" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{t('aiAssistant')}</h1>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Sparkles size={10} className="text-[#DC143C]" />
              {t('aiSubtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} className="text-gray-400 hover:text-white" title={lang === 'ar' ? 'السجل' : 'History'}>
            <MessageCircle size={18} />
            {conversations.length > 1 && <Badge className="ml-1 bg-[#DC143C]/20 text-[#DC143C] border-[#DC143C]/30 text-[10px] px-1">{conversations.length}</Badge>}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleNewChat} className="text-gray-400 hover:text-white" title={lang === 'ar' ? 'جديد' : 'New'}>
            <Plus size={18} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-[#DC143C]" title={lang === 'ar' ? 'إغلاق' : 'Close'}>
            <X size={18} />
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="prestige-card mb-3 overflow-hidden">
            <div className="p-3 max-h-60 overflow-y-auto">
              <p className="text-xs text-gray-400 mb-2 px-2">{lang === 'ar' ? 'المحادثات السابقة' : 'History'}</p>
              <div className="space-y-1">
                {[...conversations].reverse().map(conv => (
                  <div key={conv.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer group ${conv.id === activeId ? 'bg-[#DC143C]/15' : 'hover:bg-white/5'}`} onClick={() => { setActiveId(conv.id); setShowHistory(false) }}>
                    <MessageCircle size={14} className="text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{conv.title}</p>
                      <p className="text-[10px] text-gray-500">{conv.messages.length} {lang === 'ar' ? 'رسالة' : 'msgs'}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id) }} className="p-1 text-gray-500 hover:text-[#DC143C] opacity-0 group-hover:opacity-100">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 prestige-card overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4 min-h-0" ref={scrollRef} style={{ scrollBehavior: 'smooth' }}>
          <div className="space-y-4">
            <AnimatePresence>
              {messages.map((msg, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden ${msg.role === 'user' ? 'bg-white/10' : 'bg-transparent'}`}>
                    {msg.role === 'user' ? <User size={16} /> : <PrestigeLogo size={36} />}
                  </div>
                  <div className={`flex-1 min-w-0 max-w-[80%] ${msg.role === 'user' ? 'text-left' : ''}`}>
                    <div className={`rounded-2xl p-3.5 ${msg.role === 'user' ? 'bg-[#DC143C]/15 border border-[#DC143C]/20 text-white rounded-tr-sm' : 'bg-[#0A0A0A] border border-white/5 text-gray-100 rounded-tl-sm'}`}>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{formatMessage(msg.content)}</div>
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {msg.intent && msg.intent !== 'query' && (
                          <Badge className="bg-white/5 text-gray-400 border-white/10 text-xs">{msg.intent === 'add' ? '📝' : msg.intent === 'report' ? '📊' : msg.intent === 'alert' ? '🔔' : msg.intent === 'suggestion' ? '💡' : ''} {msg.intent}</Badge>
                        )}
                        {msg.provider && (
                          <Badge className="bg-[#03DAC6]/10 text-[#03DAC6] border-[#03DAC6]/20 text-[10px]" title="AI Model">
                            {msg.provider === 'groq-llama-3.3-70b' ? '🦙 Llama 3.3 70B' : msg.provider === 'openrouter-llama-3.1-8b' ? '🦙 Llama 3.1 8B' : msg.provider === 'z-ai-glm' ? '🤖 GLM' : msg.provider}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 px-2">{new Date(msg.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden"><PrestigeLogo size={36} /></div>
                <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl rounded-tl-sm p-4">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#DC143C] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-[#DC143C] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-[#DC143C] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {messages.length <= 1 && !loading && (
          <div className="border-t border-white/5 px-3 py-2 bg-black/40 flex-shrink-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Lightbulb size={11} className="text-[#FF9100] flex-shrink-0" />
              <p className="text-[10px] text-gray-500">{lang === 'ar' ? 'اقتراحات سريعة' : 'Quick suggestions'}</p>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
              {QUICK_SUGGESTIONS.map((q, idx) => (
                <button key={idx} onClick={() => sendMessage(q.text)} className="flex-shrink-0 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/5 hover:bg-[#DC143C]/15 hover:border-[#DC143C]/30 text-[11px] text-gray-300 hover:text-white whitespace-nowrap transition-colors flex items-center gap-1">
                  <span className="text-xs">{q.icon}</span>
                  <span>{q.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-white/5 p-3 bg-black/50 flex-shrink-0 sticky bottom-0">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
            <Input value={input} onChange={e => setInput(e.target.value)} placeholder={t('typeQuestion')} disabled={loading} className="bg-[#0A0A0A] border-white/10 text-white placeholder:text-gray-600 flex-1" autoFocus />
            <Button type="submit" disabled={loading || !input.trim()} className="prestige-gradient border-0 hover:opacity-90 px-4 flex-shrink-0">
              <Send size={18} className="rotate-180" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

function formatMessage(text: string): React.ReactNode {
  const lines = text.split('\n')
  return lines.map((line, idx) => {
    const boldParts = line.split(/(\*\*[^*]+\*\*)/g)
    const formatted = boldParts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>
      return <span key={i}>{part}</span>
    })
    if (line.match(/^[-•*]\s/)) return <div key={idx} className="flex gap-2 my-1"><span className="text-[#DC143C]">•</span><span>{formatted.slice(1)}</span></div>
    if (line.match(/^\d+\.\s/)) return <div key={idx} className="my-1 mr-4">{formatted}</div>
    if (!line.trim()) return <div key={idx} className="h-2" />
    return <div key={idx} className="my-0.5">{formatted}</div>
  })
}
