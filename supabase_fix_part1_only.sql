-- =====================================================
-- Supabase Security Fixes - PART 1 ONLY (修正版)
-- =====================================================
-- SECURITY DEFINER ビューをSECURITY INVOKERに修正
-- =====================================================

-- 1. date_total_capacities view
DROP VIEW IF EXISTS public.date_total_capacities;
CREATE OR REPLACE VIEW public.date_total_capacities
WITH (security_invoker = true)
AS
SELECT
  d.id as date_id,
  d.event_id,
  d.date,
  d.capacity as date_capacity,
  d.current_count as date_current_count,
  COALESCE(SUM(cdc.capacity), 0) as total_course_capacity,
  COALESCE(SUM(cdc.current_count), 0) as total_course_current_count
FROM open_campus_dates d
LEFT JOIN course_date_capacities cdc ON d.id = cdc.date_id
GROUP BY d.id, d.event_id, d.date, d.capacity, d.current_count;

-- 2. ai_usage_monthly_summary view (修正: timestamp → created_at, user_id → line_user_id, estimated_cost → cost_jpy)
DROP VIEW IF EXISTS public.ai_usage_monthly_summary;
CREATE OR REPLACE VIEW public.ai_usage_monthly_summary
WITH (security_invoker = true)
AS
SELECT
  DATE_TRUNC('month', created_at) as month,
  line_user_id as user_id,
  COUNT(*) as request_count,
  SUM(prompt_tokens) as total_prompt_tokens,
  SUM(completion_tokens) as total_completion_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(cost_jpy) as total_cost_jpy,
  SUM(cost_usd) as total_cost_usd
FROM ai_usage_logs
GROUP BY DATE_TRUNC('month', created_at), line_user_id;

-- 3. users_with_roles view (修正: ARRAY_AGGにFILTER句を追加)
DROP VIEW IF EXISTS public.users_with_roles;
CREATE OR REPLACE VIEW public.users_with_roles
WITH (security_invoker = true)
AS
SELECT
  u.id,
  u.username,
  u.email,
  u.is_active,
  u.created_at,
  u.updated_at,
  COALESCE(ARRAY_AGG(r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY[]::text[]) as roles,
  COALESCE(MAX(r.level), 0) as max_role_level
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
GROUP BY u.id, u.username, u.email, u.is_active, u.created_at, u.updated_at;

-- =====================================================
-- 修正内容:
-- - ai_usage_logs.timestamp → created_at
-- - ai_usage_logs.user_id → line_user_id
-- - users_with_roles: ARRAY_AGGにFILTER句を追加してNULL値を除外
-- - roles配列とmax_role_levelにCOALESCEを追加
-- =====================================================
