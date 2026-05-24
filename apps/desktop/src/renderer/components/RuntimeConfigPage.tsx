import { useState, useEffect } from 'react'

interface RuntimeCardConfig {
  enabled: boolean
  authMode: string
  env: Record<string, string>
  nativeConfig: Record<string, unknown>
}

interface TestResult {
  ok: boolean
  version?: string
  error?: string
}

const RUNTIMES = [
  {
    type: 'claude_code',
    label: 'Claude Code',
    icon: '🟣',
    authModes: [
      { value: 'official', label: '官方订阅 (claude login)' },
      { value: 'api_key', label: '自定义 API Key' },
    ],
    envHints: {
      apiKey: 'ANTHROPIC_API_KEY',
      baseUrl: 'ANTHROPIC_BASE_URL',
      model: 'ANTHROPIC_MODEL',
    },
  },
  {
    type: 'codex',
    label: 'Codex (OpenAI)',
    icon: '🟢',
    authModes: [
      { value: 'default', label: '默认认证' },
      { value: 'api_key', label: '自定义 API Key' },
    ],
    envHints: {
      apiKey: 'OPENAI_API_KEY',
      baseUrl: 'OPENAI_BASE_URL',
      model: 'OPENAI_MODEL',
    },
  },
] as const

export function RuntimeConfigPage() {
  const [configs, setConfigs] = useState<Record<string, RuntimeCardConfig>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.electronAPI.runtimeConfig.get().then((cfg) => {
      setConfigs(cfg)
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ padding: '1.5rem', color: '#6b7280' }}>加载配置中...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
        配置本地 AI Runtime 的认证方式和环境变量，用于执行代理任务。
      </p>
      {RUNTIMES.map((rt) => (
        <RuntimeCard
          key={rt.type}
          runtime={rt}
          config={configs[rt.type] || { enabled: true, authMode: rt.authModes[0].value, env: {}, nativeConfig: {} }}
          onSave={(cfg) => setConfigs((prev) => ({ ...prev, [rt.type]: cfg }))}
        />
      ))}
    </div>
  )
}

function RuntimeCard({
  runtime,
  config,
  onSave,
}: {
  runtime: (typeof RUNTIMES)[number]
  config: RuntimeCardConfig
  onSave: (cfg: RuntimeCardConfig) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState<RuntimeCardConfig>(config)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [envText, setEnvText] = useState('')

  useEffect(() => {
    setDraft(config)
    setEnvText(envToText(config.env))
  }, [config])

  const apiKey = draft.env[runtime.envHints.apiKey] || ''
  const baseUrl = draft.env[runtime.envHints.baseUrl] || ''
  const model = draft.env[runtime.envHints.model] || ''

  const setEnvField = (key: string, value: string) => {
    const env = { ...draft.env }
    if (value) env[key] = value
    else delete env[key]
    setDraft({ ...draft, env })
  }

  const handleSave = async () => {
    setSaving(true)
    // Merge advanced env text back
    const finalEnv = { ...parseEnvText(envText) }
    // Overlay the structured fields
    if (apiKey) finalEnv[runtime.envHints.apiKey] = apiKey
    if (baseUrl) finalEnv[runtime.envHints.baseUrl] = baseUrl
    if (model) finalEnv[runtime.envHints.model] = model

    const finalConfig = { ...draft, env: finalEnv }
    await window.electronAPI.runtimeConfig.save(runtime.type, finalConfig)
    onSave(finalConfig)
    setSaving(false)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await window.electronAPI.runtimeConfig.test(runtime.type)
    setTestResult(result)
    setTesting(false)
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.75rem 1rem', cursor: 'pointer', backgroundColor: expanded ? '#f9fafb' : 'white',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>{runtime.icon}</span>
          <span style={{ fontWeight: 600 }}>{runtime.label}</span>
          {testResult && (
            <span style={{
              fontSize: '0.7rem', padding: '2px 6px', borderRadius: '9999px',
              backgroundColor: testResult.ok ? '#dcfce7' : '#fee2e2',
              color: testResult.ok ? '#166534' : '#991b1b',
            }}>
              {testResult.ok ? `✓ ${testResult.version}` : '✗ 不可用'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            />
            启用
          </label>
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Auth Mode */}
          <FieldRow label="认证模式">
            <select
              value={draft.authMode}
              onChange={(e) => setDraft({ ...draft, authMode: e.target.value })}
              style={selectStyle}
            >
              {runtime.authModes.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </FieldRow>

          {/* API Key - only show for custom mode */}
          {draft.authMode !== 'official' && draft.authMode !== 'default' && (
            <>
              <FieldRow label="API Key">
                <div style={{ display: 'flex', gap: '0.25rem', flex: 1 }}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setEnvField(runtime.envHints.apiKey, e.target.value)}
                    placeholder={`输入 ${runtime.envHints.apiKey}`}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={() => setShowKey(!showKey)} style={smallBtnStyle}>
                    {showKey ? '隐藏' : '显示'}
                  </button>
                </div>
              </FieldRow>

              <FieldRow label="Base URL (可选)">
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setEnvField(runtime.envHints.baseUrl, e.target.value)}
                  placeholder="留空使用官方地址"
                  style={inputStyle}
                />
              </FieldRow>

              <FieldRow label="Model (可选)">
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setEnvField(runtime.envHints.model, e.target.value)}
                  placeholder="留空使用默认模型"
                  style={inputStyle}
                />
              </FieldRow>
            </>
          )}

          {/* Advanced: raw env */}
          <div>
            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              style={{ ...smallBtnStyle, fontSize: '0.75rem', color: '#6b7280' }}
            >
              {advancedOpen ? '▼' : '▶'} 高级：环境变量
            </button>
            {advancedOpen && (
              <textarea
                value={envText}
                onChange={(e) => setEnvText(e.target.value)}
                placeholder="KEY=VALUE 格式，每行一个"
                style={{
                  width: '100%', minHeight: '80px', marginTop: '0.5rem',
                  padding: '0.5rem', fontSize: '0.75rem', fontFamily: 'monospace',
                  border: '1px solid #d1d5db', borderRadius: '0.375rem', resize: 'vertical',
                }}
              />
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
            <button onClick={handleTest} disabled={testing} style={{ ...actionBtnStyle, backgroundColor: '#f3f4f6', color: '#374151' }}>
              {testing ? '测试中...' : '测试连接'}
            </button>
            <button onClick={handleSave} disabled={saving} style={{ ...actionBtnStyle, backgroundColor: '#3b82f6', color: 'white' }}>
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>

          {/* Test result detail */}
          {testResult && !testResult.ok && (
            <div style={{ fontSize: '0.75rem', color: '#991b1b', backgroundColor: '#fef2f2', padding: '0.5rem', borderRadius: '0.25rem' }}>
              {testResult.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <span style={{ fontSize: '0.8rem', color: '#374151', minWidth: '100px', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

function envToText(env: Record<string, string>): string {
  return Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n')
}

function parseEnvText(text: string): Record<string, string> {
  const map: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    map[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
  }
  return map
}

const inputStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem', fontSize: '0.8rem',
  border: '1px solid #d1d5db', borderRadius: '0.375rem', width: '100%',
}

const selectStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem', fontSize: '0.8rem',
  border: '1px solid #d1d5db', borderRadius: '0.375rem', width: '100%',
}

const smallBtnStyle: React.CSSProperties = {
  padding: '0.3rem 0.5rem', fontSize: '0.75rem',
  border: '1px solid #d1d5db', borderRadius: '0.25rem',
  cursor: 'pointer', backgroundColor: 'white',
}

const actionBtnStyle: React.CSSProperties = {
  padding: '0.4rem 1rem', fontSize: '0.8rem',
  border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 500,
}
