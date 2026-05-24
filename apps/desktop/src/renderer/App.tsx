import { useState } from 'react'
import { ConnectionStatus } from './components/ConnectionStatus'
import { BindingFlow } from './components/BindingFlow'
import { RuntimeStatus } from './components/RuntimeStatus'
import { ActivityLog } from './components/ActivityLog'
import { RuntimeConfigPage } from './components/RuntimeConfigPage'

type Tab = 'connector' | 'runtime-config'

export default function App() {
  const [bound, setBound] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('connector')

  const handleBound = (deviceToken: string) => {
    setBound(true)
    const gatewayUrl = 'ws://localhost:3000/ws/device'
    window.electronAPI.deviceChannel.connect({ gatewayUrl, deviceToken })
  }

  return (
    <div style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.75rem', color: '#111827' }}>
        AgentHub 桌面连接器
      </h1>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1.25rem', borderBottom: '1px solid #e5e7eb' }}>
        <TabButton active={activeTab === 'connector'} onClick={() => setActiveTab('connector')}>
          连接器
        </TabButton>
        <TabButton active={activeTab === 'runtime-config'} onClick={() => setActiveTab('runtime-config')}>
          Runtime 配置
        </TabButton>
      </div>

      {/* Tab Content */}
      {activeTab === 'connector' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <ConnectionStatus />
          {!bound && <BindingFlow onBound={handleBound} />}
          <RuntimeStatus />
          <ActivityLog />
        </div>
      )}

      {activeTab === 'runtime-config' && <RuntimeConfigPage />}

      <p style={{ marginTop: '1.5rem', color: '#9ca3af', fontSize: '0.75rem', textAlign: 'center' }}>
        AgentHub Desktop Connector v0.7.0
      </p>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.5rem 1rem',
        fontSize: '0.875rem',
        fontWeight: active ? 600 : 400,
        color: active ? '#3b82f6' : '#6b7280',
        backgroundColor: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
        cursor: 'pointer',
        marginBottom: '-1px',
      }}
    >
      {children}
    </button>
  )
}
