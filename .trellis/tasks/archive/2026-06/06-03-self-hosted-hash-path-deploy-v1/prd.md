# Self-hosted hash-path deploy v1

## Goal

Implement the first self-hosted deployment path for AgentHub in this worktree:

- Web/static assets are built for a hash-based route base and emitted into the deployment directory.
- The Docker app service listens only on an internal application port.
- Caddy is the public entrypoint and reverse-proxies to the internal app service.
- The deployment path stays self-hosted and does not introduce managed wrapper platforms.

## Scope

- Update existing build/deploy configuration, Docker configuration, and Caddy routing as needed.
- Keep changes limited to this `feature/deploy-v1` worktree.
- Do not modify `research/contracts/*`, shared contracts, trunk, or other worktrees.
- Preserve existing local development behavior unless a deployment-specific override is required.

## Acceptance Criteria

- Production build emits static web assets into the configured deployment directory.
- Built frontend works under hash-path routing without server-side route rewrites for app routes.
- Docker Compose app service exposes the app only to the Compose network; Caddy publishes the external HTTP port.
- Caddy reverse-proxies app/API traffic to the app service over the internal port and can serve or reach the deployed static output per the existing repo pattern.
- No new dependency on Supabase, Fly, Neon, Upstash, Vercel Postgres, PlanetScale, Railway, Render, Firebase, Clerk/Auth0, Convex, Turso, or similar managed wrapper platforms.
- Relevant tests/checks pass before handoff.

## Required Checks

- Run the affected build/test/lint/type-check commands available in the repo.
- Run the self-hosted forbidden dependency scan required by `.trellis/spec/cross-layer/self-hosted-infra-policy.md`.
- Inspect final `git status` and report any unrecognized dirty files separately.
