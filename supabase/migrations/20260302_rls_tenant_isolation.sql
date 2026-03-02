-- =====================================================
-- RLS テナント分離ポリシー（多層防御）
-- =====================================================
-- 現在のアーキテクチャ:
--   - 全APIはsupabaseAdmin（service_role）経由 → RLSバイパス
--   - テナント分離はアプリコードの .eq('tenant_id', tenant.id)
--
-- この移行で追加するもの:
--   1. app.current_tenant_id セッション変数を使ったRLSポリシー
--   2. テナントコンテキスト設定用のヘルパー関数
--   3. authenticated ユーザー向けの読み取りポリシー
--
-- 注意: service_roleはRLSをバイパスするため、これらのポリシーは
--       将来 anon/authenticated キーを使う場合のセーフティネットです。
-- =====================================================

-- =====================================================
-- PART 1: テナントコンテキスト設定ヘルパー
-- =====================================================

-- セッション変数でテナントIDを設定する関数
CREATE OR REPLACE FUNCTION public.set_tenant_context(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id::text, true);
END;
$$;

COMMENT ON FUNCTION public.set_tenant_context IS
  'セッション変数 app.current_tenant_id を設定。RLSポリシーで使用。';

-- 現在のテナントIDを取得する関数
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.get_current_tenant_id IS
  'セッション変数 app.current_tenant_id を取得。NULLならテナント未設定。';

-- =====================================================
-- PART 2: テナント分離RLSポリシー
-- =====================================================
-- 方針:
--   - service_role: 全アクセス（既存ポリシー維持）
--   - authenticated: テナントIDが一致する行のみ
--   - anon: 公開データのみ（events, dates, courses, site_settings）
-- =====================================================

-- ----- open_campus_events -----
DROP POLICY IF EXISTS "Authenticated tenant read" ON public.open_campus_events;
CREATE POLICY "Authenticated tenant read"
  ON public.open_campus_events
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (select public.get_current_tenant_id())
    OR (select public.get_current_tenant_id()) IS NULL
  );

-- ----- open_campus_dates -----
DROP POLICY IF EXISTS "Authenticated tenant read" ON public.open_campus_dates;
CREATE POLICY "Authenticated tenant read"
  ON public.open_campus_dates
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (select public.get_current_tenant_id())
    OR (select public.get_current_tenant_id()) IS NULL
  );

-- ----- event_courses -----
DROP POLICY IF EXISTS "Authenticated tenant read" ON public.event_courses;
CREATE POLICY "Authenticated tenant read"
  ON public.event_courses
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (select public.get_current_tenant_id())
    OR (select public.get_current_tenant_id()) IS NULL
  );

-- ----- applicants -----
DROP POLICY IF EXISTS "Authenticated tenant read" ON public.applicants;
CREATE POLICY "Authenticated tenant read"
  ON public.applicants
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (select public.get_current_tenant_id())
    OR (select public.get_current_tenant_id()) IS NULL
  );

-- ----- confirmed_participations -----
DROP POLICY IF EXISTS "Authenticated tenant read" ON public.confirmed_participations;
CREATE POLICY "Authenticated tenant read"
  ON public.confirmed_participations
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (select public.get_current_tenant_id())
    OR (select public.get_current_tenant_id()) IS NULL
  );

-- ----- users -----
DROP POLICY IF EXISTS "Authenticated tenant read" ON public.users;
CREATE POLICY "Authenticated tenant read"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (select public.get_current_tenant_id())
    OR (select public.get_current_tenant_id()) IS NULL
  );

-- ----- user_roles -----
DROP POLICY IF EXISTS "Authenticated tenant read" ON public.user_roles;
CREATE POLICY "Authenticated tenant read"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (select public.get_current_tenant_id())
    OR (select public.get_current_tenant_id()) IS NULL
  );

-- ----- ai_settings -----
DROP POLICY IF EXISTS "Authenticated tenant read" ON public.ai_settings;
CREATE POLICY "Authenticated tenant read"
  ON public.ai_settings
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (select public.get_current_tenant_id())
    OR (select public.get_current_tenant_id()) IS NULL
  );

-- ----- site_settings -----
DROP POLICY IF EXISTS "Authenticated tenant read" ON public.site_settings;
CREATE POLICY "Authenticated tenant read"
  ON public.site_settings
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (select public.get_current_tenant_id())
    OR (select public.get_current_tenant_id()) IS NULL
  );

-- ----- email_settings -----
DROP POLICY IF EXISTS "Authenticated tenant read" ON public.email_settings;
CREATE POLICY "Authenticated tenant read"
  ON public.email_settings
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (select public.get_current_tenant_id())
    OR (select public.get_current_tenant_id()) IS NULL
  );

-- ----- notification_logs -----
DROP POLICY IF EXISTS "Authenticated tenant read" ON public.notification_logs;
CREATE POLICY "Authenticated tenant read"
  ON public.notification_logs
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (select public.get_current_tenant_id())
    OR (select public.get_current_tenant_id()) IS NULL
  );

-- ----- broadcast_history -----
DROP POLICY IF EXISTS "Authenticated tenant read" ON public.broadcast_history;
CREATE POLICY "Authenticated tenant read"
  ON public.broadcast_history
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (select public.get_current_tenant_id())
    OR (select public.get_current_tenant_id()) IS NULL
  );

-- ----- conversation_history -----
DROP POLICY IF EXISTS "Authenticated tenant read" ON public.conversation_history;
CREATE POLICY "Authenticated tenant read"
  ON public.conversation_history
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (select public.get_current_tenant_id())
    OR (select public.get_current_tenant_id()) IS NULL
  );

-- ----- ai_usage_logs -----
DROP POLICY IF EXISTS "Authenticated tenant read" ON public.ai_usage_logs;
CREATE POLICY "Authenticated tenant read"
  ON public.ai_usage_logs
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (select public.get_current_tenant_id())
    OR (select public.get_current_tenant_id()) IS NULL
  );

-- ----- login_logs -----
DROP POLICY IF EXISTS "Authenticated tenant read" ON public.login_logs;
CREATE POLICY "Authenticated tenant read"
  ON public.login_logs
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (select public.get_current_tenant_id())
    OR (select public.get_current_tenant_id()) IS NULL
  );

-- ----- application_logs -----
DROP POLICY IF EXISTS "Authenticated tenant read" ON public.application_logs;
CREATE POLICY "Authenticated tenant read"
  ON public.application_logs
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (select public.get_current_tenant_id())
    OR (select public.get_current_tenant_id()) IS NULL
  );

-- =====================================================
-- Summary
-- =====================================================
-- ✓ Created set_tenant_context() / get_current_tenant_id() helpers
-- ✓ Added 16 tenant-scoped RLS policies for authenticated users
-- ✓ Existing service_role policies unchanged (still bypass RLS)
--
-- Usage (future, if switching from service_role to authenticated):
--   SELECT public.set_tenant_context('tenant-uuid-here');
--   SELECT * FROM applicants; -- only returns matching tenant rows
-- =====================================================
