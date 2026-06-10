import { auth, signIn } from '@/auth'
import { redirect } from 'next/navigation'
import { Github, MessageCircle, ShieldCheck, Smartphone } from 'lucide-react'

type MobileLoginSearchParams = {
  callbackUrl?: string | string[]
}

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function normalizeMobileCallback(value: string | string[] | undefined) {
  const raw = firstString(value)
  if (!raw || !raw.startsWith('/m') || raw.startsWith('/m/login')) return '/m'
  return raw
}

export default async function MobileLoginPage({
  searchParams,
}: {
  searchParams: Promise<MobileLoginSearchParams>
}) {
  const params = await searchParams
  const callbackUrl = normalizeMobileCallback(params.callbackUrl)
  const session = await auth()
  if (session?.user) {
    redirect(callbackUrl)
  }

  return (
    <div data-testid="mobile-login" className="flex min-h-[calc(100vh-88px)] flex-col justify-center">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-primary">
            <Smartphone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">移动端登录</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">轻量 IM、远程授权和产物预览</p>
          </div>
        </div>

        <div className="mt-5 space-y-3 rounded-lg border border-border bg-background p-3">
          <div className="flex items-start gap-2">
            <MessageCircle className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">查看联系人、群聊和 Agent 执行进度。</p>
          </div>
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">手机上确认标准权限、部署和启动动作。</p>
          </div>
        </div>

        <form
          className="mt-5"
          action={async () => {
            'use server'
            await signIn('github', { redirectTo: callbackUrl })
          }}
        >
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Github className="h-4 w-4" />
            使用 GitHub 登录
          </button>
        </form>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          登录后会回到刚才打开的移动端页面。
        </p>
      </section>
    </div>
  )
}
