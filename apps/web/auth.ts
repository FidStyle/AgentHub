import NextAuth from 'next-auth'
import type { NextAuthResult } from 'next-auth'
import GitHub from 'next-auth/providers/github'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from './lib/db'

const githubClientId = process.env.AUTH_GITHUB_ID ?? process.env.GITHUB_CLIENT_ID
const githubClientSecret = process.env.AUTH_GITHUB_SECRET ?? process.env.GITHUB_CLIENT_SECRET
const authSecret =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  (process.env.NODE_ENV === 'production' ? undefined : 'agenthub-local-dev-auth-secret')
const hasDatabase = Boolean(process.env.DATABASE_URL)

const nextAuth: NextAuthResult = NextAuth({
  ...(hasDatabase ? { adapter: DrizzleAdapter(db) } : {}),
  secret: authSecret,
  providers: [
    GitHub({
      clientId: githubClientId,
      clientSecret: githubClientSecret,
    }),
  ],
  session: { strategy: hasDatabase ? 'database' : 'jwt' },
  callbacks: {
    jwt({ token, profile }) {
      if (profile?.id) {
        token.sub = String(profile.id)
      }
      return token
    },
    session({ session, token, user }) {
      const userId = user?.id ?? token?.sub
      if (session.user && userId) {
        session.user.id = userId
      }
      return session
    },
  },
})

export const { handlers, auth, signIn, signOut } = nextAuth
