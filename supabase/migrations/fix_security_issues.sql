-- =====================================================
-- Supabase Security Fixes - Phase 2
-- =====================================================
-- This migration fixes security issues identified by Supabase Advisor:
-- 1. SECURITY DEFINER views (3 errors)
-- 2. Function search_path settings (10 warnings)
-- =====================================================

-- =====================================================
-- PART 1: Fix SECURITY DEFINER Views
-- Remove SECURITY DEFINER and recreate as SECURITY INVOKER
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

-- 2. ai_usage_monthly_summary view
DROP VIEW IF EXISTS public.ai_usage_monthly_summary;
CREATE OR REPLACE VIEW public.ai_usage_monthly_summary
WITH (security_invoker = true)
AS
SELECT
  DATE_TRUNC('month', timestamp) as month,
  user_id,
  COUNT(*) as request_count,
  SUM(prompt_tokens) as total_prompt_tokens,
  SUM(completion_tokens) as total_completion_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(estimated_cost) as total_cost
FROM ai_usage_logs
GROUP BY DATE_TRUNC('month', timestamp), user_id;

-- 3. users_with_roles view
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
  ARRAY_AGG(r.name) as roles,
  MAX(r.level) as max_role_level
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
GROUP BY u.id, u.username, u.email, u.is_active, u.created_at, u.updated_at;

-- =====================================================
-- PART 2: Fix Function search_path
-- Add SECURITY DEFINER and SET search_path to all functions
-- =====================================================

-- 1. delete_old_conversations
CREATE OR REPLACE FUNCTION public.delete_old_conversations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM conversation_history
  WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$;

-- 2. update_updated_at_column (trigger function)
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

-- 3. user_has_role
CREATE OR REPLACE FUNCTION public.user_has_role(p_user_id uuid, p_role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
      AND r.name = p_role_name
  );
END;
$$;

-- 4. get_user_max_level
CREATE OR REPLACE FUNCTION public.get_user_max_level(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  max_level integer;
BEGIN
  SELECT COALESCE(MAX(r.level), 0)
  INTO max_level
  FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id;

  RETURN max_level;
END;
$$;

-- 5. increment_visit_count (for open_campus_dates)
CREATE OR REPLACE FUNCTION public.increment_visit_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE open_campus_dates
  SET current_count = current_count + 1
  WHERE id = NEW.visit_date_id;
  RETURN NEW;
END;
$$;

-- 6. decrement_visit_count
CREATE OR REPLACE FUNCTION public.decrement_visit_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE open_campus_dates
  SET current_count = GREATEST(0, current_count - 1)
  WHERE id = OLD.visit_date_id;
  RETURN OLD;
END;
$$;

-- 7. increment_course_date_count
CREATE OR REPLACE FUNCTION public.increment_course_date_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE course_date_capacities
  SET current_count = current_count + 1
  WHERE date_id = NEW.confirmed_date_id
    AND course_id = NEW.confirmed_course_id;
  RETURN NEW;
END;
$$;

-- 8. decrement_course_date_count
CREATE OR REPLACE FUNCTION public.decrement_course_date_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE course_date_capacities
  SET current_count = GREATEST(0, current_count - 1)
  WHERE date_id = OLD.confirmed_date_id
    AND course_id = OLD.confirmed_course_id;
  RETURN OLD;
END;
$$;

-- 9. check_event_flags
CREATE OR REPLACE FUNCTION public.check_event_flags(p_event_id uuid)
RETURNS TABLE (
  allow_multiple_dates boolean,
  allow_multiple_candidates boolean,
  max_date_selections integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.allow_multiple_dates,
    e.allow_multiple_candidates,
    e.max_date_selections
  FROM open_campus_events e
  WHERE e.id = p_event_id;
END;
$$;

-- =====================================================
-- Summary of Changes
-- =====================================================
-- ✓ Fixed 3 SECURITY DEFINER views → SECURITY INVOKER with security_invoker = true
-- ✓ Added search_path = public, pg_temp to 9 functions
-- ✓ All functions now use SECURITY DEFINER with proper search_path
--
-- Security Improvements:
-- - Views now execute with caller's permissions (more secure)
-- - Functions are protected against search_path manipulation attacks
-- - Reduced attack surface for privilege escalation
-- =====================================================
