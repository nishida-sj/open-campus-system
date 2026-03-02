-- =====================================================
-- マルチテナント化マイグレーション
-- =====================================================
-- 1. tenantsテーブル新規作成
-- 2. 全既存テーブルにtenant_idカラム追加
-- 3. インデックス・一意制約更新
-- 4. ビュー更新
-- 5. シードデータ投入
-- =====================================================

-- =====================================================
-- PART 1: tenantsテーブル作成
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  line_channel_access_token TEXT,
  line_channel_secret TEXT,
  line_bot_basic_id TEXT,
  openai_api_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLSポリシー
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only access" ON public.tenants;
CREATE POLICY "Service role only access"
  ON public.tenants
  FOR ALL
  TO public
  USING ((select auth.role()) = 'service_role'::text);

-- updated_at自動更新関数（存在しない場合のみ作成）
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- updated_atトリガー
DROP TRIGGER IF EXISTS update_tenants_updated_at ON public.tenants;
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.tenants IS 'テナント（学校）マスタ';
COMMENT ON COLUMN public.tenants.slug IS 'URL識別子（例: ise-hoken, ise-gakuen）';

-- =====================================================
-- PART 2: シードデータ投入
-- =====================================================
INSERT INTO public.tenants (slug, name, display_name) VALUES
  ('ise-hoken', '伊勢保健衛生専門学校', '伊勢保健衛生専門学校'),
  ('ise-gakuen', '伊勢学園高等学校', '伊勢学園高等学校')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- PART 3: 既存テーブルにtenant_idカラムを追加
-- =====================================================

-- デフォルトテナント（ise-hoken）のIDを取得
DO $$
DECLARE
  default_tenant_id UUID;
BEGIN
  SELECT id INTO default_tenant_id FROM public.tenants WHERE slug = 'ise-hoken';

  -- 3-1. open_campus_events
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'open_campus_events' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.open_campus_events ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.open_campus_events SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.open_campus_events ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-2. open_campus_dates
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'open_campus_dates' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.open_campus_dates ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.open_campus_dates SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.open_campus_dates ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-3. event_courses
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_courses' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.event_courses ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.event_courses SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.event_courses ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-4. course_date_associations
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'course_date_associations' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.course_date_associations ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.course_date_associations SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.course_date_associations ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-5. course_date_capacities
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'course_date_capacities' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.course_date_capacities ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.course_date_capacities SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.course_date_capacities ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-6. applicants
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'applicants' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.applicants ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.applicants SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.applicants ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-7. applicant_visit_dates
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'applicant_visit_dates' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.applicant_visit_dates ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.applicant_visit_dates SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.applicant_visit_dates ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-8. confirmed_participations
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'confirmed_participations' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.confirmed_participations ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.confirmed_participations SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.confirmed_participations ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-9. email_settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_settings' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.email_settings ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.email_settings SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.email_settings ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-10. ai_settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_settings' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.ai_settings ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.ai_settings SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.ai_settings ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-11. ai_usage_logs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_usage_logs' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.ai_usage_logs ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.ai_usage_logs SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.ai_usage_logs ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-12. conversation_history
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversation_history' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.conversation_history ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.conversation_history SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.conversation_history ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-13. notification_logs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_logs' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.notification_logs ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.notification_logs SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.notification_logs ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-14. broadcast_history
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'broadcast_history' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.broadcast_history ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.broadcast_history SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.broadcast_history ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-15. application_logs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'application_logs' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.application_logs ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.application_logs SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.application_logs ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-16. login_logs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'login_logs' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.login_logs ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.login_logs SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.login_logs ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-17. users
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.users ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.users SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.users ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-18. user_roles
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.user_roles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    UPDATE public.user_roles SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE public.user_roles ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  -- 3-19. site_settings（テーブルが存在する場合）
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'site_settings') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'tenant_id') THEN
      ALTER TABLE public.site_settings ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
      UPDATE public.site_settings SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
      ALTER TABLE public.site_settings ALTER COLUMN tenant_id SET NOT NULL;
    END IF;
  END IF;

  -- 3-20. ai_prompts（テーブルが存在する場合）
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_prompts') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_prompts' AND column_name = 'tenant_id') THEN
      ALTER TABLE public.ai_prompts ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
      UPDATE public.ai_prompts SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
      ALTER TABLE public.ai_prompts ALTER COLUMN tenant_id SET NOT NULL;
    END IF;
  END IF;
END $$;

-- =====================================================
-- PART 4: インデックス追加
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_open_campus_events_tenant_id ON public.open_campus_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_open_campus_dates_tenant_id ON public.open_campus_dates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_courses_tenant_id ON public.event_courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_course_date_associations_tenant_id ON public.course_date_associations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_course_date_capacities_tenant_id ON public.course_date_capacities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_applicants_tenant_id ON public.applicants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_applicant_visit_dates_tenant_id ON public.applicant_visit_dates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_confirmed_participations_tenant_id ON public.confirmed_participations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_settings_tenant_id ON public.email_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_settings_tenant_id ON public.ai_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tenant_id ON public.ai_usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_tenant_id ON public.conversation_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant_id ON public.notification_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_history_tenant_id ON public.broadcast_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_application_logs_tenant_id ON public.application_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_tenant_id ON public.login_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_id ON public.user_roles(tenant_id);

-- =====================================================
-- PART 5: 一意制約の更新（テナントスコープ）
-- =====================================================

-- ai_settings: setting_keyの一意性をテナントスコープに変更
-- 既存のユニーク制約を削除（名前は環境により異なるため、条件付き）
DO $$
BEGIN
  -- ai_settings の setting_key ユニーク制約をテナントスコープに変更
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_settings_setting_key_key') THEN
    ALTER TABLE public.ai_settings DROP CONSTRAINT ai_settings_setting_key_key;
  END IF;
  -- 新しいテナントスコープの一意制約
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_settings_tenant_setting_key_unique') THEN
    ALTER TABLE public.ai_settings ADD CONSTRAINT ai_settings_tenant_setting_key_unique UNIQUE (tenant_id, setting_key);
  END IF;

  -- site_settings は直接カラム形式（school_name等）のためsetting_key制約は不要
END $$;

-- =====================================================
-- PART 6: ビューの更新（tenant_id を含める）
-- =====================================================

-- users_with_roles ビューを再作成
DROP VIEW IF EXISTS public.users_with_roles;
CREATE OR REPLACE VIEW public.users_with_roles
WITH (security_invoker = true)
AS
SELECT
  u.id,
  u.tenant_id,
  u.full_name,
  u.email,
  u.is_active,
  u.must_change_password,
  u.last_login_at,
  u.created_at,
  u.updated_at,
  COALESCE(
    json_agg(
      json_build_object(
        'role_id', r.id,
        'role_name', r.name,
        'display_name', r.display_name,
        'level', r.level,
        'assigned_at', ur.assigned_at
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  ) as roles,
  COALESCE(MAX(r.level), 0) as max_role_level
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
GROUP BY u.id, u.tenant_id, u.full_name, u.email, u.is_active, u.must_change_password, u.last_login_at, u.created_at, u.updated_at;

-- ai_usage_monthly_summary ビューを再作成（tenant_id含む）
DROP VIEW IF EXISTS public.ai_usage_monthly_summary;
CREATE OR REPLACE VIEW public.ai_usage_monthly_summary
WITH (security_invoker = true)
AS
SELECT
  tenant_id,
  DATE_TRUNC('month', created_at) as month,
  line_user_id as user_id,
  COUNT(*) as request_count,
  SUM(prompt_tokens) as total_prompt_tokens,
  SUM(completion_tokens) as total_completion_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(cost_jpy) as total_cost_jpy,
  SUM(cost_usd) as total_cost_usd
FROM ai_usage_logs
GROUP BY tenant_id, DATE_TRUNC('month', created_at), line_user_id;

-- date_total_capacities ビューを再作成（tenant_id含む）
DROP VIEW IF EXISTS public.date_total_capacities;
CREATE OR REPLACE VIEW public.date_total_capacities
WITH (security_invoker = true)
AS
SELECT
  d.tenant_id,
  d.id as date_id,
  d.event_id,
  d.date,
  d.capacity as date_capacity,
  d.current_count as date_current_count,
  COALESCE(SUM(cdc.capacity), 0) as total_course_capacity,
  COALESCE(SUM(cdc.current_count), 0) as total_course_current_count
FROM open_campus_dates d
LEFT JOIN course_date_capacities cdc ON d.id = cdc.date_id
GROUP BY d.tenant_id, d.id, d.event_id, d.date, d.capacity, d.current_count;

-- =====================================================
-- Summary
-- =====================================================
-- ✓ Created tenants table with 2 seed tenants
-- ✓ Added tenant_id to 20 tables
-- ✓ Created indexes on all tenant_id columns
-- ✓ Updated unique constraints to tenant scope
-- ✓ Updated 3 views to include tenant_id
-- =====================================================
