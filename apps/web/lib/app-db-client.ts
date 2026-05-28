import { createPostgresQueryClient, type AppDbClient } from './postgres-query-client'

export async function createClient(): Promise<AppDbClient> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required')
  }
  return createPostgresQueryClient()
}
