-- ================================================
-- データベースマイグレーション: イベント表示終了日
-- ================================================
-- 目的: イベント一覧での表示期間を管理するため
-- 実行日: 2025-11-11
-- ================================================

-- イベントテーブルに表示終了日カラムを追加
ALTER TABLE open_campus_events
ADD COLUMN IF NOT EXISTS display_end_date DATE;

COMMENT ON COLUMN open_campus_events.display_end_date IS 'イベント一覧での表示終了日（この日を過ぎると一覧に表示されなくなる）';

-- ================================================
-- 確認クエリ
-- ================================================
-- SELECT id, name, display_end_date, is_active, created_at
-- FROM open_campus_events
-- ORDER BY created_at DESC;
