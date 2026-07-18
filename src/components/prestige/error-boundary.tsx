'use client'

import React from 'react'

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ProtectionModule Error:', error)
    console.error('Error Info:', errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black p-6 flex items-center justify-center" dir="rtl">
          <div className="max-w-lg w-full">
            <h2 className="text-xl font-bold text-[#DC143C] mb-4">⚠️ خطأ في تحميل الصفحة</h2>
            <pre className="text-xs text-gray-300 bg-[#0A0A0A] p-4 rounded-lg border border-white/10 overflow-auto whitespace-pre-wrap">
              {this.state.error?.message || 'Unknown error'}
              {'\n\n'}
              {this.state.error?.stack?.substring(0, 500)}
            </pre>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-4 py-2 bg-[#DC143C] text-white rounded-lg text-sm"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
