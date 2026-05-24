-- AgentHub 核心 Schema
-- FR-AUTH-001: profiles
-- FR-WS-001: workspaces, sessions
-- FR-CHAT-001: messages
-- FR-AGENT-001: role_agents

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_username TEXT,
  avatar_url TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可查看自己的资料" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "用户可更新自己的资料" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "用户可插入自己的资料" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 自动创建 profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, github_username, avatar_url, display_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'user_name')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- WORKSPACES
-- ============================================================
CREATE TYPE public.execution_domain AS ENUM ('cloud', 'local_desktop');

CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  execution_domain public.execution_domain NOT NULL,
  cloud_project_dir TEXT,
  local_root_display TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可查看自己的工作区" ON public.workspaces
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "用户可创建工作区" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "用户可更新自己的工作区" ON public.workspaces
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "用户可删除自己的工作区" ON public.workspaces
  FOR DELETE USING (auth.uid() = owner_id);

-- 执行域不可变约束
CREATE OR REPLACE FUNCTION public.prevent_execution_domain_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.execution_domain IS DISTINCT FROM NEW.execution_domain THEN
    RAISE EXCEPTION '执行域创建后不可变更';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_execution_domain_immutable
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.prevent_execution_domain_change();

-- ============================================================
-- SESSIONS
-- ============================================================
CREATE TYPE public.session_status AS ENUM ('active', 'archived');
CREATE TYPE public.routing_mode AS ENUM ('orchestrated', 'direct');

CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '新会话',
  status public.session_status NOT NULL DEFAULT 'active',
  routing_mode public.routing_mode NOT NULL DEFAULT 'orchestrated',
  auto_advance BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可查看自己工作区的会话" ON public.sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid())
  );

CREATE POLICY "用户可创建会话" ON public.sessions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid())
  );

CREATE POLICY "用户可更新会话" ON public.sessions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid())
  );

-- ============================================================
-- ROLE AGENTS
-- ============================================================
CREATE TABLE public.role_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role_type TEXT NOT NULL DEFAULT 'engineer',
  system_prompt TEXT DEFAULT '',
  capabilities JSONB DEFAULT '[]'::jsonb,
  is_orchestrator BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.role_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可查看自己工作区的角色" ON public.role_agents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid())
  );

CREATE POLICY "用户可管理自己工作区的角色" ON public.role_agents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid())
  );

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TYPE public.sender_type AS ENUM ('user', 'agent', 'system');
CREATE TYPE public.message_type AS ENUM ('text', 'plan_card', 'result_card', 'approval', 'system_event');
CREATE TYPE public.streaming_status AS ENUM ('idle', 'streaming', 'complete');

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  sender_type public.sender_type NOT NULL,
  sender_id UUID,
  role_agent_id UUID REFERENCES public.role_agents(id) ON DELETE SET NULL,
  content TEXT NOT NULL DEFAULT '',
  message_type public.message_type NOT NULL DEFAULT 'text',
  streaming_status public.streaming_status NOT NULL DEFAULT 'complete',
  metadata JSONB DEFAULT '{}'::jsonb,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可查看自己会话的消息" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.workspaces w ON s.workspace_id = w.id
      WHERE s.id = session_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "用户可发送消息" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.workspaces w ON s.workspace_id = w.id
      WHERE s.id = session_id AND w.owner_id = auth.uid()
    )
  );

-- 消息索引
CREATE INDEX idx_messages_session_id ON public.messages(session_id, created_at DESC);
CREATE INDEX idx_sessions_workspace_id ON public.sessions(workspace_id);

-- ============================================================
-- updated_at 自动更新
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_role_agents_updated_at BEFORE UPDATE ON public.role_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- Supabase Realtime 启用
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
