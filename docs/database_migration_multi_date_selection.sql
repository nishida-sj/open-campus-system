-- ================================================
-- データベース移行SQL: 複数日程選択対応
-- ================================================
-- 目的: オープンキャンパスイベント管理と複数日程選択機能の追加
-- 実行日: 2025-11-11
-- ================================================

-- ステップ1: オープンキャンパスイベントテーブルを作成
CREATE TABLE IF NOT EXISTS open_campus_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  max_date_selections INTEGER DEFAULT 1 CHECK (max_date_selections > 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ステップ2: open_campus_datesテーブルにevent_idカラムを追加
ALTER TABLE open_campus_dates
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES open_campus_events(id) ON DELETE CASCADE;

-- ステップ3: インデックスを作成
CREATE INDEX IF NOT EXISTS idx_open_campus_dates_event_id ON open_campus_dates(event_id);

-- ステップ4: 申込者と参加日程の中間テーブルを作成
CREATE TABLE IF NOT EXISTS applicant_visit_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  applicant_id UUID NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  visit_date_id UUID NOT NULL REFERENCES open_campus_dates(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 1 CHECK (priority > 0),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(applicant_id, visit_date_id)
);

-- ステップ5: インデックスを作成
CREATE INDEX IF NOT EXISTS idx_applicant_visit_dates_applicant_id ON applicant_visit_dates(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applicant_visit_dates_visit_date_id ON applicant_visit_dates(visit_date_id);

-- ================================================
-- 既存データの移行（visit_date_id → applicant_visit_dates）
-- ================================================
-- 既存の申込者データを中間テーブルに移行
INSERT INTO applicant_visit_dates (applicant_id, visit_date_id, priority)
SELECT id, visit_date_id, 1
FROM applicants
WHERE visit_date_id IS NOT NULL
ON CONFLICT (applicant_id, visit_date_id) DO NOTHING;

-- ================================================
-- 既存データへのデフォルトイベント作成
-- ================================================
-- 既存の日程に対してデフォルトイベントを作成
INSERT INTO open_campus_events (name, description, max_date_selections, is_active)
VALUES ('デフォルトイベント', '既存の日程用のデフォルトイベント', 1, true)
ON CONFLICT DO NOTHING;

-- 既存の日程にデフォルトイベントを紐付け
UPDATE open_campus_dates
SET event_id = (SELECT id FROM open_campus_events WHERE name = 'デフォルトイベント' LIMIT 1)
WHERE event_id IS NULL;

-- ================================================
-- 今後の方針: visit_date_idカラムは残すか削除するか
-- ================================================
-- オプション1: visit_date_id を残す（後方互換性）
-- - 既存のコードを大きく変更しなくて済む
-- - 単一日程選択の場合はこのカラムを使用
-- - 複数日程選択の場合は applicant_visit_dates を使用

-- オプション2: visit_date_id を削除（推奨）
-- - データの正規化が進む
-- - すべての日程選択を applicant_visit_dates で管理
-- - 以下のコマンドで削除（慎重に実行）
-- ALTER TABLE applicants DROP COLUMN IF EXISTS visit_date_id;

-- ================================================
-- 確認クエリ
-- ================================================
-- イベント一覧
-- SELECT * FROM open_campus_events;

-- イベントに紐づく日程
-- SELECT e.name, d.date
-- FROM open_campus_events e
-- JOIN open_campus_dates d ON e.id = d.event_id
-- ORDER BY e.created_at DESC, d.date;

-- 申込者の選択日程
-- SELECT a.name, a.email, d.date, avd.priority
-- FROM applicants a
-- JOIN applicant_visit_dates avd ON a.id = avd.applicant_id
-- JOIN open_campus_dates d ON avd.visit_date_id = d.id
-- ORDER BY a.created_at DESC, avd.priority;

-- ================================================
-- ロールバック用SQL（必要な場合）
-- ================================================
-- DROP TABLE IF EXISTS applicant_visit_dates CASCADE;
-- ALTER TABLE open_campus_dates DROP COLUMN IF EXISTS event_id;
-- DROP TABLE IF EXISTS open_campus_events CASCADE;
