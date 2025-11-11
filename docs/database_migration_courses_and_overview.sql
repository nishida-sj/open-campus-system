-- ================================================
-- データベース移行SQL: コース管理と概要機能追加
-- ================================================
-- 目的: イベントにコース管理と概要フィールドを追加
-- 実行日: 2025-11-11
-- 変更内容:
--   - イベントテーブルに概要フィールドを追加
--   - イベントテーブルに複数日参加許可フラグを追加
--   - コース管理テーブルの作成
--   - コースと日程の関連テーブル作成
--   - 申込者の確定ステータス管理
-- ================================================

-- ================================================
-- ステップ1: open_campus_eventsテーブルに新しいカラムを追加
-- ================================================
ALTER TABLE open_campus_events
ADD COLUMN IF NOT EXISTS overview TEXT,
ADD COLUMN IF NOT EXISTS allow_multiple_dates BOOLEAN DEFAULT false;

COMMENT ON COLUMN open_campus_events.overview IS 'イベント概要（申込者向けの詳細説明）';
COMMENT ON COLUMN open_campus_events.allow_multiple_dates IS '複数日参加を許可するか';

-- ================================================
-- ステップ2: コース管理テーブルを作成
-- ================================================
CREATE TABLE IF NOT EXISTS event_courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES open_campus_events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  capacity INTEGER,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE event_courses IS 'イベントのコース管理テーブル';
COMMENT ON COLUMN event_courses.event_id IS '所属するイベントID';
COMMENT ON COLUMN event_courses.name IS 'コース名';
COMMENT ON COLUMN event_courses.description IS 'コース説明';
COMMENT ON COLUMN event_courses.capacity IS 'コース定員（NULL=無制限）';
COMMENT ON COLUMN event_courses.display_order IS '表示順序';

CREATE INDEX IF NOT EXISTS idx_event_courses_event_id ON event_courses(event_id);

-- ================================================
-- ステップ3: コースと日程の関連テーブルを作成
-- ================================================
CREATE TABLE IF NOT EXISTS course_date_associations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES event_courses(id) ON DELETE CASCADE,
  date_id UUID NOT NULL REFERENCES open_campus_dates(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(course_id, date_id)
);

COMMENT ON TABLE course_date_associations IS 'コースと開催日の関連テーブル';
COMMENT ON COLUMN course_date_associations.course_id IS 'コースID';
COMMENT ON COLUMN course_date_associations.date_id IS '開催日ID';

CREATE INDEX IF NOT EXISTS idx_course_date_associations_course_id ON course_date_associations(course_id);
CREATE INDEX IF NOT EXISTS idx_course_date_associations_date_id ON course_date_associations(date_id);

-- ================================================
-- ステップ4: applicantsテーブルに確定関連のカラムを追加
-- ================================================
ALTER TABLE applicants
ADD COLUMN IF NOT EXISTS confirmed_date_id UUID REFERENCES open_campus_dates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS confirmed_course_id UUID REFERENCES event_courses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS confirmed_by VARCHAR(100);

COMMENT ON COLUMN applicants.confirmed_date_id IS '確定された参加日';
COMMENT ON COLUMN applicants.confirmed_course_id IS '確定されたコース';
COMMENT ON COLUMN applicants.confirmed_at IS '確定日時';
COMMENT ON COLUMN applicants.confirmed_by IS '確定処理を行った管理者';

CREATE INDEX IF NOT EXISTS idx_applicants_confirmed_date_id ON applicants(confirmed_date_id);
CREATE INDEX IF NOT EXISTS idx_applicants_confirmed_course_id ON applicants(confirmed_course_id);

-- ================================================
-- ステップ5: applicant_visit_datesテーブルにコース選択を追加
-- ================================================
ALTER TABLE applicant_visit_dates
ADD COLUMN IF NOT EXISTS selected_course_id UUID REFERENCES event_courses(id) ON DELETE SET NULL;

COMMENT ON COLUMN applicant_visit_dates.selected_course_id IS '申込時に選択したコースID';

CREATE INDEX IF NOT EXISTS idx_applicant_visit_dates_selected_course_id ON applicant_visit_dates(selected_course_id);

-- ================================================
-- ステップ6: 新しいステータス管理用のENUM型を作成
-- ================================================
DO $$
BEGIN
  -- applicant_statusという型が存在しない場合のみ作成
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'applicant_status') THEN
    CREATE TYPE applicant_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
  END IF;
END $$;

-- 既存のstatusカラムの型を変更（データ保持）
DO $$
BEGIN
  -- 現在の型を確認
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applicants'
    AND column_name = 'status'
    AND data_type = 'character varying'
  ) THEN
    -- VARCHAR型からENUM型に変換
    ALTER TABLE applicants ALTER COLUMN status TYPE applicant_status USING status::applicant_status;
  END IF;
END $$;

COMMENT ON COLUMN applicants.status IS 'ステータス: pending(申込中), confirmed(確定), completed(LINE連携完了), cancelled(キャンセル)';

-- ================================================
-- 確認クエリ（コメントを外して実行）
-- ================================================

-- イベントとコースの関連
-- SELECT
--   e.name AS イベント名,
--   e.allow_multiple_dates AS 複数日参加可,
--   c.name AS コース名,
--   COUNT(DISTINCT cda.date_id) AS 適用日数
-- FROM open_campus_events e
-- LEFT JOIN event_courses c ON e.id = c.event_id
-- LEFT JOIN course_date_associations cda ON c.id = cda.course_id
-- GROUP BY e.id, e.name, e.allow_multiple_dates, c.id, c.name
-- ORDER BY e.created_at DESC, c.display_order;

-- 申込状況（確定/未確定）
-- SELECT
--   e.name AS イベント名,
--   COUNT(CASE WHEN a.confirmed_date_id IS NULL THEN 1 END) AS 未確定,
--   COUNT(CASE WHEN a.confirmed_date_id IS NOT NULL THEN 1 END) AS 確定済
-- FROM applicants a
-- JOIN open_campus_dates d ON a.visit_date_id = d.id
-- JOIN open_campus_events e ON d.event_id = e.id
-- GROUP BY e.id, e.name
-- ORDER BY e.created_at DESC;

-- ================================================
-- ロールバック用SQL（問題が発生した場合）
-- ================================================
-- 注意: 以下を実行すると、すべての変更が元に戻ります

-- -- ステータスENUM型を元に戻す
-- ALTER TABLE applicants ALTER COLUMN status TYPE VARCHAR(50);
-- DROP TYPE IF EXISTS applicant_status;

-- -- applicantsテーブルの追加カラムを削除
-- ALTER TABLE applicants
--   DROP COLUMN IF EXISTS confirmed_date_id,
--   DROP COLUMN IF EXISTS confirmed_course_id,
--   DROP COLUMN IF EXISTS confirmed_at,
--   DROP COLUMN IF EXISTS confirmed_by;

-- -- applicant_visit_datesテーブルの追加カラムを削除
-- ALTER TABLE applicant_visit_dates
--   DROP COLUMN IF EXISTS selected_course_id;

-- -- 関連テーブルを削除
-- DROP TABLE IF EXISTS course_date_associations CASCADE;
-- DROP TABLE IF EXISTS event_courses CASCADE;

-- -- open_campus_eventsテーブルの追加カラムを削除
-- ALTER TABLE open_campus_events
--   DROP COLUMN IF EXISTS overview,
--   DROP COLUMN IF EXISTS allow_multiple_dates;

-- ================================================
-- マイグレーション完了確認
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'マイグレーション完了！';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '追加された機能:';
  RAISE NOTICE '1. イベントに概要フィールドを追加';
  RAISE NOTICE '2. イベントに複数日参加許可フラグを追加';
  RAISE NOTICE '3. コース管理機能を追加';
  RAISE NOTICE '4. コースと日程の関連付け機能を追加';
  RAISE NOTICE '5. 申込確定管理機能を追加';
  RAISE NOTICE '===========================================';
END $$;
