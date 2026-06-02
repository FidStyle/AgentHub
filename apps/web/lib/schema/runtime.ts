import { pgTable, text, uuid, timestamp, integer, jsonb } from 'drizzle-orm/pg-core'

export const runtimeEndpoints = pgTable('runtime_endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id'),
  kind: text('kind').notNull(),
  runtimeType: text('runtime_type').notNull().default('hosted'),
  deviceId: uuid('device_id'),
  status: text('status').notNull().default('unconfigured'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const runtimeSessions = pgTable('runtime_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull(),
  endpointId: uuid('endpoint_id'),
  roleAgentId: uuid('role_agent_id'),
  runtimeType: text('runtime_type').notNull().default('claude_code'),
  nativeSessionId: text('native_session_id'),
  cwd: text('cwd'),
  capabilitySnapshot: jsonb('capability_snapshot').default({}),
  status: text('status').notNull().default('idle'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const runtimeLogs = pgTable('runtime_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  runtimeSessionId: uuid('runtime_session_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').default({}),
  seq: integer('seq').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const deviceRuntimeChannels = pgTable('device_runtime_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull(),
  endpointId: uuid('endpoint_id'),
  status: text('status').notNull().default('disconnected'),
  connectedAt: timestamp('connected_at', { withTimezone: true }),
  lastHeartbeat: timestamp('last_heartbeat', { withTimezone: true }),
})

export const runtimeCapabilities = pgTable('runtime_capabilities', {
  id: uuid('id').primaryKey().defaultRandom(),
  endpointId: uuid('endpoint_id').notNull(),
  capability: text('capability').notNull(),
  value: jsonb('value').default({}),
})

export type RuntimeEndpointRow = typeof runtimeEndpoints.$inferSelect
export type RuntimeSessionRow = typeof runtimeSessions.$inferSelect
export type RuntimeLogRow = typeof runtimeLogs.$inferSelect
export type DeviceRuntimeChannelRow = typeof deviceRuntimeChannels.$inferSelect
export type RuntimeCapabilityRow = typeof runtimeCapabilities.$inferSelect
