CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'execution_domain') THEN
    CREATE TYPE execution_domain AS ENUM ('cloud', 'local_desktop');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
    CREATE TYPE session_status AS ENUM ('active', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'routing_mode') THEN
    CREATE TYPE routing_mode AS ENUM ('orchestrated', 'direct');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sender_type') THEN
    CREATE TYPE sender_type AS ENUM ('user', 'agent', 'system');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type') THEN
    CREATE TYPE message_type AS ENUM ('text', 'plan_card', 'result_card', 'approval', 'system_event');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'streaming_status') THEN
    CREATE TYPE streaming_status AS ENUM ('idle', 'streaming', 'complete');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."user" (
  id text PRIMARY KEY,
  name text,
  email text UNIQUE,
  "emailVerified" timestamp,
  image text
);

CREATE TABLE IF NOT EXISTS public.account (
  "userId" text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  type text NOT NULL,
  provider text NOT NULL,
  "providerAccountId" text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at integer,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  PRIMARY KEY (provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS public.session (
  "sessionToken" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  expires timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS public."verificationToken" (
  identifier text NOT NULL,
  token text NOT NULL,
  expires timestamp NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id text PRIMARY KEY REFERENCES public."user"(id) ON DELETE CASCADE,
  github_username text,
  avatar_url text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  execution_domain execution_domain NOT NULL,
  cloud_project_dir text,
  local_root_display text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '新会话',
  status session_status NOT NULL DEFAULT 'active',
  routing_mode routing_mode NOT NULL DEFAULT 'orchestrated',
  auto_advance boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  role_type text NOT NULL DEFAULT 'engineer',
  system_prompt text DEFAULT '',
  capabilities jsonb DEFAULT '[]'::jsonb,
  is_orchestrator boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  sender_type sender_type NOT NULL,
  sender_id uuid,
  role_agent_id uuid REFERENCES public.role_agents(id) ON DELETE SET NULL,
  content text NOT NULL DEFAULT '',
  message_type message_type NOT NULL DEFAULT 'text',
  streaming_status streaming_status NOT NULL DEFAULT 'complete',
  metadata jsonb DEFAULT '{}'::jsonb,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '桌面连接器',
  type text NOT NULL DEFAULT 'desktop',
  online boolean NOT NULL DEFAULT false,
  last_heartbeat timestamptz,
  device_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.device_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  bind_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.device_login_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(36) UNIQUE NOT NULL,
  user_id text REFERENCES public."user"(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  bound_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES public."user"(id),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_confirm','running','completed','failed','cancelled')),
  dag jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plan_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  label text NOT NULL,
  agent_id uuid REFERENCES public.role_agents(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','running','completed','failed','skipped')),
  action_type text,
  action_payload jsonb DEFAULT '{}',
  result jsonb,
  depends_on uuid[] DEFAULT '{}',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_node_id uuid REFERENCES public.plan_nodes(id),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES public."user"(id),
  action_type text NOT NULL,
  command text NOT NULL,
  cwd text,
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','running','completed','failed')),
  requires_approval boolean NOT NULL DEFAULT false,
  result jsonb,
  approved_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public."user"(id),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  ref_type text,
  ref_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.runtime_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES public."user"(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('public_cloud','user_local')),
  runtime_type text NOT NULL DEFAULT 'hosted',
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'unconfigured' CHECK (status IN ('available','offline','unconfigured')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.runtime_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  endpoint_id uuid REFERENCES public.runtime_endpoints(id) ON DELETE SET NULL,
  role_agent_id uuid REFERENCES public.role_agents(id) ON DELETE SET NULL,
  native_session_id text,
  cwd text,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','completed','failed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.runtime_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  runtime_session_id uuid NOT NULL REFERENCES public.runtime_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  seq integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.device_runtime_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  endpoint_id uuid REFERENCES public.runtime_endpoints(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected','disconnected')),
  connected_at timestamptz,
  last_heartbeat timestamptz
);

CREATE TABLE IF NOT EXISTS public.runtime_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.runtime_endpoints(id) ON DELETE CASCADE,
  capability text NOT NULL,
  value jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON public.messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_workspace_id ON public.sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_device_bindings_code ON public.device_bindings(bind_code) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_device_login_intents_code ON public.device_login_intents(code);
CREATE INDEX IF NOT EXISTS idx_plans_session ON public.plans(session_id);
CREATE INDEX IF NOT EXISTS idx_plan_nodes_plan ON public.plan_nodes(plan_id);
CREATE INDEX IF NOT EXISTS idx_actions_session ON public.actions(session_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_runtime_sessions_session ON public.runtime_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_runtime_logs_session ON public.runtime_logs(runtime_session_id, seq);
CREATE INDEX IF NOT EXISTS idx_runtime_endpoints_user ON public.runtime_endpoints(user_id);
CREATE INDEX IF NOT EXISTS idx_device_runtime_channels_device ON public.device_runtime_channels(device_id);
