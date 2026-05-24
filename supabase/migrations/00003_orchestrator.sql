-- M8: Orchestrator + Action + Permission + Notifications
-- Plans (DAG)
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_confirm','running','completed','failed','cancelled')),
  dag jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_owner" ON public.plans FOR ALL USING (owner_id = auth.uid());

-- Plan Nodes (individual tasks in the DAG)
CREATE TABLE public.plan_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  label text NOT NULL,
  agent_id uuid REFERENCES public.role_agents(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','running','completed','failed','skipped')),
  action_type text, -- 'runtime_invoke' | 'action_exec' | 'human_confirm'
  action_payload jsonb DEFAULT '{}',
  result jsonb,
  depends_on uuid[] DEFAULT '{}',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_nodes_via_plan" ON public.plan_nodes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.plans WHERE plans.id = plan_nodes.plan_id AND plans.owner_id = auth.uid()));

-- Actions (executed commands with approval tracking)
CREATE TABLE public.actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_node_id uuid REFERENCES public.plan_nodes(id),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  action_type text NOT NULL, -- 'shell' | 'file_write' | 'git_push' | 'deploy'
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

ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "actions_owner" ON public.actions FOR ALL USING (owner_id = auth.uid());

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  type text NOT NULL, -- 'approval_required' | 'plan_completed' | 'action_failed' | 'info'
  title text NOT NULL,
  body text,
  ref_type text, -- 'plan' | 'action' | 'plan_node'
  ref_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_owner" ON public.notifications FOR ALL USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_plans_session ON public.plans(session_id);
CREATE INDEX idx_plan_nodes_plan ON public.plan_nodes(plan_id);
CREATE INDEX idx_actions_session ON public.actions(session_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id) WHERE read = false;
