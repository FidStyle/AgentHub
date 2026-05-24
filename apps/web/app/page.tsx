'use client'

import { createClient } from '@/lib/supabase-browser'

export default function Home() {
  const handleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">AgentHub 工作台</h1>
      <p className="text-lg text-gray-600 mb-8">
        多 Agent 协作平台 — IM 聊天式交互体验
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mb-8">
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">💬 智能对话</h2>
          <p className="text-gray-500">与多个 AI Agent 自然对话协作</p>
        </div>
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">🤖 多角色协作</h2>
          <p className="text-gray-500">Orchestrator 自动协调任务分派</p>
        </div>
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">🖥️ 三端联动</h2>
          <p className="text-gray-500">Web + Desktop + Mobile 无缝协作</p>
        </div>
      </div>
      <button
        onClick={handleLogin}
        className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
        使用 GitHub 登录
      </button>
    </main>
  )
}
