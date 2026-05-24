import { describe, it, expect } from 'vitest'
import {
  serializeFrame,
  parseFrame,
  SeqGenerator,
  type AuthFrame,
  type HeartbeatFrame,
  type RequestFrame,
  type ResponseFrame,
  type EventFrame,
  type ConnectedFrame,
} from '../protocol/frames'

describe('DeviceChannel Frames', () => {
  describe('serializeFrame / parseFrame', () => {
    it('should round-trip an auth frame', () => {
      const frame: AuthFrame = { type: 'auth', seq: 1, deviceToken: 'test-token-123' }
      const serialized = serializeFrame(frame)
      const parsed = parseFrame(serialized)
      expect(parsed).toEqual(frame)
    })

    it('should round-trip a connected frame', () => {
      const frame: ConnectedFrame = { type: 'connected', seq: 0, deviceId: 'dev-1', workspaceIds: ['ws-1', 'ws-2'] }
      const parsed = parseFrame(serializeFrame(frame))
      expect(parsed).toEqual(frame)
    })

    it('should round-trip a heartbeat frame', () => {
      const frame: HeartbeatFrame = { type: 'heartbeat', seq: 5, sentAt: 1700000000000 }
      const parsed = parseFrame(serializeFrame(frame))
      expect(parsed).toEqual(frame)
    })

    it('should round-trip a request frame', () => {
      const frame: RequestFrame = {
        type: 'request', seq: 10, requestId: 'req-1',
        requestType: 'runtime_invoke', payload: { command: 'claude', args: ['-p', 'hello'] },
      }
      const parsed = parseFrame(serializeFrame(frame))
      expect(parsed).toEqual(frame)
    })

    it('should round-trip a response frame', () => {
      const frame: ResponseFrame = { type: 'response', seq: 11, requestId: 'req-1', ok: true, payload: { exitCode: 0 } }
      const parsed = parseFrame(serializeFrame(frame))
      expect(parsed).toEqual(frame)
    })

    it('should round-trip an event frame', () => {
      const frame: EventFrame = { type: 'event', seq: 12, eventId: 'evt-1', eventType: 'runtime_event', payload: { delta: 'hello' } }
      const parsed = parseFrame(serializeFrame(frame))
      expect(parsed).toEqual(frame)
    })

    it('should return null for invalid JSON', () => {
      expect(parseFrame('not json')).toBeNull()
    })

    it('should return null for missing type', () => {
      expect(parseFrame('{"seq": 1}')).toBeNull()
    })

    it('should return null for missing seq', () => {
      expect(parseFrame('{"type": "auth"}')).toBeNull()
    })
  })

  describe('SeqGenerator', () => {
    it('should generate incrementing sequence numbers', () => {
      const gen = new SeqGenerator()
      expect(gen.next()).toBe(1)
      expect(gen.next()).toBe(2)
      expect(gen.next()).toBe(3)
    })

    it('should reset to 0', () => {
      const gen = new SeqGenerator()
      gen.next()
      gen.next()
      gen.reset()
      expect(gen.next()).toBe(1)
    })
  })
})
