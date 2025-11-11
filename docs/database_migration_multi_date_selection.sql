-- ================================================
-- データベース移行SQL: イベント管理機能追加
-- ================================================
-- 目的: オープンキャンパスイベント管理と複数日程選択機能の追加
-- 実行日: 2025-11-11
-- 変更内容:
--   - イベント管理テーブルの追加
--   - 開催日程にイベントIDを紐付け
--   - 複数日程選択のための中間テーブル追加
-- ================================================

-- ================================================
-- ステップ1: オープンキャンパスイベントテーブルを作成
-- ================================================
CREATE TABLE IF NOT EXISTS open_campus_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  max_date_selections INTEGER DEFAULT 1 CHECK (max_date_selections > 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE open_campus_events IS 'オープンキャンパスイベント管理テーブル';
COMMENT ON COLUMN open_campus_events.name IS 'イベント名';
COMMENT ON COLUMN open_campus_events.description IS 'イベント説明';
COMMENT ON COLUMN open_campus_events.max_date_selections IS '参加者が選択できる最大日程数';
COMMENT ON COLUMN open_campus_events.is_active IS '公開状態';

-- ================================================
-- ステップ2: open_campus_datesテーブルにevent_idカラムを追加
-- ================================================
ALTER TABLE open_campus_dates
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES open_campus_events(id) ON DELETE CASCADE;

COMMENT ON COLUMN open_campus_dates.event_id IS '所属するイベントID';

-- インデックスを作成（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_open_campus_dates_event_id ON open_campus_dates(event_id);

-- ================================================
-- ステップ3: 申込者と参加日程の中間テーブルを作成
-- ================================================
CREATE TABLE IF NOT EXISTS applicant_visit_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  applicant_id UUID NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  visit_date_id UUID NOT NULL REFERENCES open_campus_dates(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 1 CHECK (priority > 0),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(applicant_id, visit_date_id)
);

COMMENT ON TABLE applicant_visit_dates IS '申込者と参加日程の中間テーブル（複数日程選択対応）';
COMMENT ON COLUMN applicant_visit_dates.applicant_id IS '申込者ID';
COMMENT ON COLUMN applicant_visit_dates.visit_date_id IS '参加日程ID';
COMMENT ON COLUMN applicant_visit_dates.priority IS '優先順位（第1希望、第2希望など）';

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_applicant_visit_dates_applicant_id ON applicant_visit_dates(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applicant_visit_dates_visit_date_id ON applicant_visit_dates(visit_date_id);

-- ================================================
-- ステップ4: 既存データの移行（重要）
-- ================================================
-- 既存の申込者データがある場合、中間テーブルに移行
INSERT INTO applicant_visit_dates (applicant_id, visit_date_id, priority)
SELECT id, visit_date_id, 1
FROM applicants
WHERE visit_date_id IS NOT NULL
ON CONFLICT (applicant_id, visit_date_id) DO NOTHING;

-- 既存の開催日程がある場合、デフォルトイベントを作成して紐付け
DO $$
DECLARE
  default_event_id UUID;
  dates_count INTEGER;
BEGIN
  -- 既存の日程があるかチェック
  SELECT COUNT(*) INTO dates_count FROM open_campus_dates WHERE event_id IS NULL;

  -- 既存の日程がある場合のみデフォルトイベントを作成
  IF dates_count > 0 THEN
    -- デフォルトイベントを作成
    INSERT INTO open_campus_events (name, description, max_date_selections, is_active)
    VALUES ('既存の開催日程', '移行前から存在していた開催日程', 1, true)
    RETURNING id INTO default_event_id;

    -- 既存の日程にデフォルトイベントを紐付け
    UPDATE open_campus_dates
    SET event_id = default_event_id
    WHERE event_id IS NULL;

    RAISE NOTICE 'デフォルトイベントを作成しました: %件の日程を紐付け', dates_count;
  ELSE
    RAISE NOTICE '既存の日程がないため、デフォルトイベントは作成しませんでした';
  END IF;
END $$;

-- ================================================
-- ステップ5: データ整合性の確認
-- ================================================
-- event_idがNULLの日程がないことを確認
DO $$
DECLARE
  null_event_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_event_count FROM open_campus_dates WHERE event_id IS NULL;

  IF null_event_count > 0 THEN
    RAISE WARNING 'event_idがNULLの日程が%件あります。手動で確認してください。', null_event_count;
  ELSE
    RAISE NOTICE 'すべての日程にイベントが紐付けられています';
  END IF;
END $$;

-- ================================================
-- 確認クエリ（コメントを外して実行）
-- ================================================

-- イベント一覧
-- SELECT * FROM open_campus_events ORDER BY created_at DESC;

-- イベントと日程の関連
-- SELECT
--   e.name AS イベント名,
--   e.is_active AS 公開中,
--   COUNT(d.id) AS 日程数
-- FROM open_campus_events e
-- LEFT JOIN open_campus_dates d ON e.id = d.event_id
-- GROUP BY e.id, e.name, e.is_active
-- ORDER BY e.created_at DESC;

-- 申込者の日程選択状況
-- SELECT
--   a.name AS 申込者名,
--   e.name AS イベント名,
--   d.date AS 参加日,
--   avd.priority AS 優先順位
-- FROM applicants a
-- JOIN applicant_visit_dates avd ON a.id = avd.applicant_id
-- JOIN open_campus_dates d ON avd.visit_date_id = d.id
-- JOIN open_campus_events e ON d.event_id = e.id
-- ORDER BY a.created_at DESC, avd.priority;

-- ================================================
-- ロールバック用SQL（問題が発生した場合）
-- ================================================
-- 注意: 以下を実行すると、すべての変更が元に戻ります

-- -- 中間テーブルを削除
-- DROP TABLE IF EXISTS applicant_visit_dates CASCADE;

-- -- event_idカラムを削除
-- ALTER TABLE open_campus_dates DROP COLUMN IF EXISTS event_id;

-- -- イベントテーブルを削除
-- DROP TABLE IF EXISTS open_campus_events CASCADE;

-- ================================================
-- マイグレーション完了確認
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'マイグレーション完了！';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '次の手順:';
  RAISE NOTICE '1. 管理画面でイベントを作成してください';
  RAISE NOTICE '2. イベント作成時に開催日を追加できます';
  RAISE NOTICE '3. ダッシュボードでイベント単位で確認できます';
  RAISE NOTICE '===========================================';
END $$;
