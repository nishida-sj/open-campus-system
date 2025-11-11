-- ================================================
-- データベース関数: カウント減少
-- ================================================
-- 目的: 確定解除時に定員カウントを減少させる
-- 実行日: 2025-11-11
-- ================================================

-- カウント減少関数を作成
CREATE OR REPLACE FUNCTION decrement_visit_count(date_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- current_countを1減らす（0未満にはならないようにする）
  UPDATE open_campus_dates
  SET current_count = GREATEST(current_count - 1, 0)
  WHERE id = date_id;
END;
$$;

COMMENT ON FUNCTION decrement_visit_count IS '確定解除時に開催日の参加者数を1減らす（0未満にはならない）';

-- ================================================
-- 確認クエリ
-- ================================================
-- SELECT * FROM open_campus_dates ORDER BY date;

-- ================================================
-- テスト（必要に応じて実行）
-- ================================================
-- 特定の日程のカウントを確認
-- SELECT id, date, current_count, capacity FROM open_campus_dates WHERE id = 'your-date-id';

-- カウント減少をテスト
-- SELECT decrement_visit_count('your-date-id');

-- 結果を確認
-- SELECT id, date, current_count, capacity FROM open_campus_dates WHERE id = 'your-date-id';
