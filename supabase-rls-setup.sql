-- =============================================
-- Supabase RLS (Row Level Security) Setup
-- セキュリティ警告対応: すべてのテーブルにRLSを有効化
-- =============================================
--
-- 実行方法:
-- 1. Supabase Dashboard > SQL Editor を開く
-- 2. このファイルの内容をコピー＆ペースト
-- 3. 「Run」ボタンをクリック
--
-- 注意: このスクリプトは既存のアプリケーションに影響を与えません
--      supabaseAdminクライアント（service_role）は引き続き全アクセス可能
-- =============================================

-- =============================================
-- 優先度1: 個人情報を含むテーブル
-- =============================================

-- 申込者情報テーブル
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.applicants
  FOR ALL
  USING (auth.role() = 'service_role');

-- メール設定テーブル
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.email_settings
  FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- 優先度2: その他のすべてのテーブル
-- =============================================

-- イベント情報
ALTER TABLE public.open_campus_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.open_campus_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- 開催日程
ALTER TABLE public.open_campus_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.open_campus_dates
  FOR ALL
  USING (auth.role() = 'service_role');

-- イベントコース
ALTER TABLE public.event_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.event_courses
  FOR ALL
  USING (auth.role() = 'service_role');

-- コース情報（旧テーブル）
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.courses
  FOR ALL
  USING (auth.role() = 'service_role');

-- コース×日程の関連
ALTER TABLE public.course_date_associations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.course_date_associations
  FOR ALL
  USING (auth.role() = 'service_role');

-- コース×日程の定員
ALTER TABLE public.course_date_capacities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.course_date_capacities
  FOR ALL
  USING (auth.role() = 'service_role');

-- 申込者×訪問日
ALTER TABLE public.applicant_visit_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.applicant_visit_dates
  FOR ALL
  USING (auth.role() = 'service_role');

-- 申込ログ
ALTER TABLE public.application_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.application_logs
  FOR ALL
  USING (auth.role() = 'service_role');

-- 配信履歴
ALTER TABLE public.broadcast_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.broadcast_history
  FOR ALL
  USING (auth.role() = 'service_role');

-- 通知ログ
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.notification_logs
  FOR ALL
  USING (auth.role() = 'service_role');

-- 参加確定情報
ALTER TABLE public.confirmed_participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.confirmed_participations
  FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- バックアップテーブル
-- =============================================

-- 申込者バックアップ
ALTER TABLE public.applicants_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.applicants_backup
  FOR ALL
  USING (auth.role() = 'service_role');

-- 開催日バックアップ
ALTER TABLE public.open_campus_dates_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.open_campus_dates_backup
  FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- Security Definer Viewの対処
-- =============================================
--
-- 注意: Viewの再作成が必要な場合は、以下のコマンドを使用
-- 現在のViewの定義を確認してから実行してください
--
-- DROP VIEW IF EXISTS public.date_total_capacities;
-- DROP VIEW IF EXISTS public.ai_usage_monthly_summary;
--
-- その後、SECURITY INVOKERオプションで再作成してください
-- CREATE VIEW ... WITH (security_invoker = true);
--
-- 現時点では、アプリケーションがsupabaseAdminを使用しているため
-- 即座の脆弱性にはなっていません。
-- 将来的にフロントエンドから直接Viewにアクセスする場合は対処が必要です。
-- =============================================

-- =============================================
-- 完了確認
-- =============================================
--
-- 以下のクエリで有効化されたRLSを確認できます:
--
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- rowsecurity = true となっていればRLSが有効です
-- =============================================
