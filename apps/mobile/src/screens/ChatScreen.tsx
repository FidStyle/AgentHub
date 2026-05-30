import React, { useState, useCallback, useMemo } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native'
import { colors } from '@agenthub/shared'
import type { Message } from '@agenthub/shared'
import { getRuntimeConfig } from '../lib/config'
import { sendChat } from '../lib/chatClient'

let counter = 0
const genId = () => `msg-${++counter}-${Date.now()}`

const now = () => new Date().toISOString()

function makeMessage(partial: Partial<Message> & Pick<Message, 'session_id' | 'content' | 'sender_type'>): Message {
  return {
    id: genId(),
    message_type: 'text',
    sender_id: partial.sender_type === 'user' ? 'mobile-user' : 'orchestrator',
    role_agent_id: null,
    streaming_status: 'complete',
    metadata: null,
    is_pinned: false,
    created_at: now(),
    updated_at: now(),
    ...partial,
  }
}

export function ChatScreen() {
  const config = useMemo(() => getRuntimeConfig(), [])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = useCallback(async () => {
    if (!config.configured || sending || !input.trim()) return
    const content = input.trim()
    setInput('')
    setError(null)
    setSending(true)

    setMessages((m) => [...m, makeMessage({ session_id: config.sessionId, content, sender_type: 'user' })])

    const replyId = genId()
    const upsertReply = (reply: string) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === replyId)) {
          return prev.map((m) => (m.id === replyId ? { ...m, content: reply, updated_at: now() } : m))
        }
        return [...prev, makeMessage({ id: replyId, session_id: config.sessionId, content: reply, sender_type: 'agent' })]
      })
    }
    const pushNotice = (text: string) => {
      setMessages((prev) => [...prev, makeMessage({ session_id: config.sessionId, content: text, sender_type: 'system' })])
    }

    try {
      await sendChat({
        baseUrl: config.baseUrl,
        sessionId: config.sessionId,
        token: config.token,
        content,
        onDelta: upsertReply,
        onNotice: pushNotice,
        onError: setError,
      })
    } finally {
      setSending(false)
    }
  }, [config, sending, input])

  if (!config.configured) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>AgentHub</Text>
        </View>
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>运行时未配置</Text>
          <Text style={styles.stateBody}>
            原生 App 暂未注入会话与登录凭证，无法连接 Agent 运行时。请配置以下环境变量后重新启动：
          </Text>
          {config.missing.map((k) => (
            <Text key={k} style={styles.stateKey}>
              • {k}
            </Text>
          ))}
          <Text style={styles.stateHint}>配置完成后即可发送消息并接收真实 Agent 回复。</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>AgentHub</Text>
      </View>
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        style={styles.list}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.sender_type === 'user'
                ? styles.userBubble
                : item.sender_type === 'system'
                  ? styles.systemBubble
                  : styles.agentBubble,
            ]}
          >
            <Text style={item.sender_type === 'user' ? styles.userText : styles.agentText}>{item.content}</Text>
          </View>
        )}
      />
      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          editable={!sending}
          placeholder="输入消息..."
          placeholderTextColor={colors.mutedForeground}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={sending}
        >
          <Text style={styles.sendText}>{sending ? '发送中' : '发送'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: 16, borderBottomWidth: 1, borderColor: colors.border },
  headerText: { fontSize: 18, fontWeight: '600', color: colors.primary },
  list: { flex: 1, padding: 16 },
  bubble: { maxWidth: '75%', padding: 12, borderRadius: 12, marginBottom: 8 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  agentBubble: { alignSelf: 'flex-start', backgroundColor: colors.muted },
  systemBubble: { alignSelf: 'center', backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border },
  userText: { color: colors.primaryForeground, fontSize: 14 },
  agentText: { color: colors.primary, fontSize: 14 },
  inputRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderColor: colors.border },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, color: colors.primary },
  sendBtn: { marginLeft: 8, backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: colors.primaryForeground, fontWeight: '600' },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.muted },
  errorText: { color: colors.primary, fontSize: 13 },
  stateCard: { margin: 16, padding: 20, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.muted },
  stateTitle: { fontSize: 16, fontWeight: '600', color: colors.primary, marginBottom: 8 },
  stateBody: { fontSize: 14, color: colors.primary, lineHeight: 20, marginBottom: 12 },
  stateKey: { fontSize: 13, color: colors.primary, fontFamily: 'monospace', marginBottom: 4 },
  stateHint: { fontSize: 13, color: colors.mutedForeground, marginTop: 12 },
})
