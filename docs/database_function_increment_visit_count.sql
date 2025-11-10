-- ================================================
-- Supabase関数: increment_visit_count
-- ================================================
-- 目的: 開催日程の申込数をインクリメント
-- 実行日: 2025-11-10
-- ================================================

CREATE OR REPLACE FUNCTION increment_visit_count(date_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE open_campus_dates
  SET current_count = current_count + 1,
      updated_at = NOW()
  WHERE id = date_id;
END;
$$;

-- ================================================
-- 使用例
-- ================================================
-- SELECT increment_visit_count('uuid-here');

-- ================================================
-- 確認クエリ
-- ================================================
-- SELECT id, date, current_count, capacity
-- FROM open_campus_dates
-- ORDER BY date;
