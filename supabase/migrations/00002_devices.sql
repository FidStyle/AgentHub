-- AgentHub 设备管理 Schema
-- FR-DEVICE-001: devices, device_bindings

-- ============================================================
-- DEVICES
-- ============================================================
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '桌面连接器',
  type TEXT NOT NULL DEFAULT 'desktop',
  online BOOLEAN NOT NULL DEFAULT false,
  last_heartbeat TIMESTAMPTZ,
  device_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可查看自己的设备" ON public.devices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "用户可创建设备" ON public.devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户可更新自己的设备" ON public.devices
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "用户可删除自己的设备" ON public.devices
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- DEVICE BINDINGS (绑定码)
-- ============================================================
CREATE TABLE public.device_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bind_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.device_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可查看自己的绑定码" ON public.device_bindings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "用户可创建绑定码" ON public.device_bindings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户可更新自己的绑定码" ON public.device_bindings
  FOR UPDATE USING (auth.uid() = user_id);

-- 绑定码索引
CREATE INDEX idx_device_bindings_code ON public.device_bindings(bind_code) WHERE used = false;
CREATE INDEX idx_devices_user_id ON public.devices(user_id);

-- updated_at trigger
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
