import React, { useState, useCallback } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native'
import { colors } from '@agenthub/shared'
import type { Message } from '@agenthub/shared'

let counter = 0
const genId = () => `msg-${++counter}-${Date.now()}`

export function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')

  const handleSend = useCallback(() => {
    if (!input.trim()) return

    const userMsg: Message = {
      id: genId(),
      session_id: 'mobile-sess-1',
      message_type: 'text',
      content: input.trim(),
      sender_type: 'user',
      sender_id: 'mobile-user',
      role_agent_id: null,
      streaming_status: 'complete',
      metadata: null,
      is_pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setMessages((m) => [...m, userMsg])
    setInput('')

    setTimeout(() => {
      const aiMsg: Message = {
        id: genId(),
        session_id: 'mobile-sess-1',
        message_type: 'text',
        content: `[Agent] 收到: "${userMsg.content}"`,
        sender_type: 'agent',
        sender_id: 'orchestrator',
        role_agent_id: null,
        streaming_status: 'complete',
        metadata: null,
        is_pinned: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setMessages((m) => [...m, aiMsg])
    }, 500)
  }, [input])

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
          <View style={[styles.bubble, item.sender_type === 'user' ? styles.userBubble : styles.agentBubble]}>
            <Text style={item.sender_type === 'user' ? styles.userText : styles.agentText}>
              {item.content}
            </Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="输入消息..."
          placeholderTextColor={colors.mutedForeground}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendText}>发送</Text>
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
  userText: { color: colors.primaryForeground, fontSize: 14 },
  agentText: { color: colors.primary, fontSize: 14 },
  inputRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderColor: colors.border },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, color: colors.primary },
  sendBtn: { marginLeft: 8, backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center' },
  sendText: { color: colors.primaryForeground, fontWeight: '600' },
})
