-- Device Login Intent: Desktop 未登录发起 intent，Web 登录后绑定 user
-- FR-DEVICE-001: device_login_intents

CREATE TABLE public.device_login_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(36) UNIQUE NOT NULL,
  user_id TEXT REFERENCES public."user"(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  bound_at TIMESTAMPTZ
);

CREATE INDEX idx_device_login_intents_code ON public.device_login_intents(code);
