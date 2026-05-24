import React, { useState, useCallback } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native'
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
      sessionId: 'mobile-sess-1',
      type: 'text',
      content: input.trim(),
      senderType: 'user',
      senderId: 'mobile-user',
      streamingStatus: 'complete',
      createdAt: new Date(),
    }
    setMessages((m) => [...m, userMsg])
    setInput('')

    // Simulate response
    setTimeout(() => {
      const aiMsg: Message = {
        id: genId(),
        sessionId: 'mobile-sess-1',
        type: 'text',
        content: `[Agent] 收到: "${userMsg.content}"`,
        senderType: 'agent',
        senderId: 'orchestrator',
        streamingStatus: 'complete',
        createdAt: new Date(),
      }
      setMessages((m) => [...m, aiMsg])
    }, 500)
  }, [input])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>AgentHub Mobile</Text>
      </View>
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.senderType === 'user' ? styles.userBubble : styles.agentBubble]}>
            <Text style={item.senderType === 'user' ? styles.userText : styles.agentText}>
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
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  headerText: { fontSize: 18, fontWeight: '600' },
  list: { flex: 1, padding: 16 },
  bubble: { maxWidth: '75%', padding: 12, borderRadius: 12, marginBottom: 8 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#007AFF' },
  agentBubble: { alignSelf: 'flex-start', backgroundColor: '#F0F0F0' },
  userText: { color: '#fff', fontSize: 14 },
  agentText: { color: '#333', fontSize: 14 },
  inputRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderColor: '#eee' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  sendBtn: { marginLeft: 8, backgroundColor: '#007AFF', borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center' },
  sendText: { color: '#fff', fontWeight: '600' },
})
