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
    CREATE TYPE message_type AS ENUM ('text', 'plan_card', 'result_card', 'approval', 'system_event', 'role_acknowledgement');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'message_type'::regtype
      AND enumlabel = 'role_acknowledgement'
  ) THEN
    ALTER TYPE message_type ADD VALUE 'role_acknowledgement';
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
  chat_kind text NOT NULL DEFAULT 'group' CHECK (chat_kind IN ('group','direct')),
  direct_role_agent_id uuid,
  participant_role_agent_ids jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_pinned boolean NOT NULL DEFAULT false,
  pinned_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  role_type text NOT NULL DEFAULT 'engineer',
  system_prompt text DEFAULT '',
  capability_tags jsonb DEFAULT '[]'::jsonb,
  runtime_type text NOT NULL DEFAULT 'claude_code' CHECK (runtime_type IN ('claude_code','codex')),
  is_orchestrator boolean NOT NULL DEFAULT false,
  enabled_tool_ids jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS chat_kind text NOT NULL DEFAULT 'group',
  ADD COLUMN IF NOT EXISTS direct_role_agent_id uuid,
  ADD COLUMN IF NOT EXISTS participant_role_agent_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_chat_kind_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_chat_kind_check CHECK (chat_kind IN ('group','direct'));

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_direct_role_agent_id_fkey;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_direct_role_agent_id_fkey
  FOREIGN KEY (direct_role_agent_id) REFERENCES public.role_agents(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.session_participants (
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  role_agent_id uuid NOT NULL REFERENCES public.role_agents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, role_agent_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS role_agents_workspace_name_uidx
  ON public.role_agents(workspace_id, name);

ALTER TABLE public.role_agents
  ADD COLUMN IF NOT EXISTS runtime_type text NOT NULL DEFAULT 'claude_code';

ALTER TABLE public.role_agents
  ADD COLUMN IF NOT EXISTS capability_tags jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.role_agents
  ADD COLUMN IF NOT EXISTS enabled_tool_ids jsonb DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'role_agents'
      AND column_name = 'capabilities'
  ) THEN
    EXECUTE $migrate_capability_tags$
      UPDATE public.role_agents
      SET capability_tags = capabilities
      WHERE jsonb_typeof(capabilities) = 'array'
        AND (capability_tags IS NULL OR capability_tags = '[]'::jsonb)
    $migrate_capability_tags$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'role_agents'
      AND column_name = 'toolset_ids'
  ) THEN
    EXECUTE $migrate_enabled_tool_ids$
      UPDATE public.role_agents
      SET enabled_tool_ids = (
        SELECT COALESCE(jsonb_agg(DISTINCT mapped.tool_id), '[]'::jsonb)
        FROM jsonb_array_elements_text(toolset_ids) AS old(toolset_id)
        CROSS JOIN LATERAL (
          SELECT unnest(CASE old.toolset_id
            WHEN 'file_read' THEN ARRAY['file_read']
            WHEN 'file_write' THEN ARRAY['file_write']
            WHEN 'shell' THEN ARRAY['shell']
            WHEN 'git' THEN ARRAY['git_cli']
            WHEN 'artifact' THEN ARRAY['artifact_store']
            WHEN 'publish' THEN ARRAY['publish_service']
            WHEN 'web_fetch' THEN ARRAY['web_fetch']
            WHEN 'ppt_generation' THEN ARRAY['ppt_master']
            ELSE ARRAY[]::text[]
          END) AS tool_id
        ) AS mapped
      )
      WHERE jsonb_typeof(toolset_ids) = 'array'
        AND (enabled_tool_ids IS NULL OR enabled_tool_ids = '[]'::jsonb)
    $migrate_enabled_tool_ids$;
  END IF;
END $$;

ALTER TABLE public.role_agents
  DROP COLUMN IF EXISTS capabilities;

ALTER TABLE public.role_agents
  DROP COLUMN IF EXISTS toolset_ids;

UPDATE public.role_agents
SET
  name = '架构师',
  role_type = 'orchestrator',
  system_prompt = '你是 AgentHub 架构师。负责判断是否直接回答，或协调前端工程师、后端工程师等专门角色。面向用户使用简体中文，不暴露内部权限预设。',
  capability_tags = '["规划", "路由", "协调"]'::jsonb,
  enabled_tool_ids = '["file_read", "web_search", "web_fetch", "artifact_store"]'::jsonb,
  runtime_type = 'claude_code',
  is_orchestrator = true
WHERE name = 'Orchestrator';

UPDATE public.role_agents
SET
  name = '前端工程师',
  role_type = 'engineer',
  system_prompt = '你是资深前端工程师。重点关注 UI 行为、React/Next.js 实现、可访问性、布局稳定性、Markdown 渲染和真实浏览器验收证据。使用简体中文回答。',
  capability_tags = '["前端", "React", "UI", "E2E"]'::jsonb,
  enabled_tool_ids = '["file_read", "file_write", "shell", "git_cli", "web_fetch", "browser_preview", "diff_apply", "artifact_store", "publish_service"]'::jsonb,
  runtime_type = 'claude_code',
  is_orchestrator = false
WHERE name = 'Frontend Engineer';

UPDATE public.role_agents
SET
  name = '后端工程师',
  role_type = 'engineer',
  system_prompt = '你是资深后端工程师。重点关注 API 契约、数据库持久化、runtime worker、鉴权和可持久化产物。使用简体中文回答。',
  capability_tags = '["后端", "数据库", "Runtime", "API"]'::jsonb,
  enabled_tool_ids = '["file_read", "file_write", "shell", "git_cli", "web_fetch", "browser_preview", "diff_apply", "artifact_store", "publish_service", "ppt_master"]'::jsonb,
  runtime_type = 'codex',
  is_orchestrator = false
WHERE name = 'Backend Engineer';

ALTER TABLE public.role_agents
  DROP CONSTRAINT IF EXISTS role_agents_runtime_type_check;

ALTER TABLE public.role_agents
  ADD CONSTRAINT role_agents_runtime_type_check CHECK (runtime_type IN ('claude_code','codex'));

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
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','waiting','running','completed','failed','skipped','cancelled','blocked')),
  action_type text,
  action_payload jsonb DEFAULT '{}',
  result jsonb,
  depends_on uuid[] DEFAULT '{}',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_nodes
  DROP CONSTRAINT IF EXISTS plan_nodes_status_check;

ALTER TABLE public.plan_nodes
  ADD CONSTRAINT plan_nodes_status_check CHECK (status IN ('pending','ready','waiting','running','completed','failed','skipped','cancelled','blocked'));

CREATE TABLE IF NOT EXISTS public.plan_node_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_node_id uuid NOT NULL REFERENCES public.plan_nodes(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  control text NOT NULL DEFAULT 'initial' CHECK (control IN ('initial','retry','resume','cancel','requeue')),
  previous_attempt_id uuid REFERENCES public.plan_node_attempts(id) ON DELETE SET NULL,
  runtime_session_id uuid,
  mailbox_item_id uuid,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','waiting','completed','failed','cancelled','dead_letter')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_node_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS public.agent_mailbox_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE,
  plan_node_id uuid REFERENCES public.plan_nodes(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('outbound','inbound','reply')),
  from_role_agent_id uuid REFERENCES public.role_agents(id) ON DELETE SET NULL,
  to_role_agent_id uuid NOT NULL REFERENCES public.role_agents(id) ON DELETE CASCADE,
  attempt_id uuid REFERENCES public.plan_node_attempts(id) ON DELETE SET NULL,
  parent_attempt_id uuid REFERENCES public.plan_node_attempts(id) ON DELETE SET NULL,
  lineage_root_id uuid NOT NULL,
  runtime_type text NOT NULL CHECK (runtime_type IN ('claude_code','codex')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','waiting','completed','failed','cancelled','dead_letter')),
  context_package jsonb NOT NULL DEFAULT '{}'::jsonb,
  reply_to_mailbox_item_id uuid REFERENCES public.agent_mailbox_items(id) ON DELETE SET NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_node_attempts
  DROP CONSTRAINT IF EXISTS plan_node_attempts_status_check;

ALTER TABLE public.plan_node_attempts
  ADD CONSTRAINT plan_node_attempts_status_check CHECK (status IN ('queued','running','waiting','completed','failed','cancelled','dead_letter'));

ALTER TABLE public.agent_mailbox_items
  DROP CONSTRAINT IF EXISTS agent_mailbox_items_status_check;

ALTER TABLE public.agent_mailbox_items
  ADD CONSTRAINT agent_mailbox_items_status_check CHECK (status IN ('queued','running','waiting','completed','failed','cancelled','dead_letter'));

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
  runtime_type text NOT NULL DEFAULT 'claude_code' CHECK (runtime_type IN ('claude_code','codex')),
  native_session_id text,
  cwd text,
  capability_snapshot jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','completed','failed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.runtime_sessions
  ADD COLUMN IF NOT EXISTS role_agent_id uuid REFERENCES public.role_agents(id) ON DELETE SET NULL;

ALTER TABLE public.runtime_sessions
  ADD COLUMN IF NOT EXISTS runtime_type text NOT NULL DEFAULT 'claude_code';

ALTER TABLE public.runtime_sessions
  ADD COLUMN IF NOT EXISTS capability_snapshot jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.runtime_sessions
  DROP CONSTRAINT IF EXISTS runtime_sessions_runtime_type_check;

ALTER TABLE public.runtime_sessions
  ADD CONSTRAINT runtime_sessions_runtime_type_check CHECK (runtime_type IN ('claude_code','codex'));

CREATE TABLE IF NOT EXISTS public.artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  source_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  source_run_id uuid REFERENCES public.runtime_sessions(id) ON DELETE SET NULL,
  source_path text,
  artifact_type text NOT NULL DEFAULT 'generic_file' CHECK (artifact_type IN ('html','markdown','code','image','diff','folder','document','presentation','generic_file')),
  title text NOT NULL,
  content text,
  content_ref text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text NOT NULL REFERENCES public."user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
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
CREATE INDEX IF NOT EXISTS idx_plan_node_attempts_node ON public.plan_node_attempts(plan_node_id, attempt_number DESC);
CREATE INDEX IF NOT EXISTS idx_plan_node_attempts_runtime ON public.plan_node_attempts(runtime_session_id);
CREATE INDEX IF NOT EXISTS idx_agent_mailbox_session ON public.agent_mailbox_items(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_mailbox_plan ON public.agent_mailbox_items(plan_id, plan_node_id);
CREATE INDEX IF NOT EXISTS idx_agent_mailbox_inbound ON public.agent_mailbox_items(to_role_agent_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_mailbox_lineage ON public.agent_mailbox_items(lineage_root_id);
CREATE INDEX IF NOT EXISTS idx_actions_session ON public.actions(session_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_workspace ON public.artifacts(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_session ON public.artifacts(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_runtime_sessions_session ON public.runtime_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_runtime_sessions_native_scope ON public.runtime_sessions(session_id, role_agent_id, runtime_type, cwd, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_logs_session ON public.runtime_logs(runtime_session_id, seq);
CREATE INDEX IF NOT EXISTS idx_runtime_endpoints_user ON public.runtime_endpoints(user_id);
CREATE INDEX IF NOT EXISTS idx_device_runtime_channels_device ON public.device_runtime_channels(device_id);
