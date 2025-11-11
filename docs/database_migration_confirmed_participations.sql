-- 確定参加テーブルの作成
-- 複数日参加対応：1人の申込者が複数の日程・コースを確定できるようにする

-- 新しい確定参加テーブルを作成
CREATE TABLE IF NOT EXISTS confirmed_participations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  applicant_id UUID NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  confirmed_date_id UUID NOT NULL REFERENCES open_campus_dates(id) ON DELETE CASCADE,
  confirmed_course_id UUID REFERENCES event_courses(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  confirmed_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- インデックスの作成（パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_confirmed_participations_applicant
  ON confirmed_participations(applicant_id);

CREATE INDEX IF NOT EXISTS idx_confirmed_participations_date
  ON confirmed_participations(confirmed_date_id);

-- ユニーク制約：同じ申込者が同じ日程を重複して確定できないようにする
CREATE UNIQUE INDEX IF NOT EXISTS idx_confirmed_participations_unique
  ON confirmed_participations(applicant_id, confirmed_date_id);

-- テーブルコメント
COMMENT ON TABLE confirmed_participations IS '確定参加テーブル：申込者の確定した参加日程・コース情報';
COMMENT ON COLUMN confirmed_participations.id IS '確定参加ID';
COMMENT ON COLUMN confirmed_participations.applicant_id IS '申込者ID';
COMMENT ON COLUMN confirmed_participations.confirmed_date_id IS '確定した参加日程ID';
COMMENT ON COLUMN confirmed_participations.confirmed_course_id IS '確定したコースID';
COMMENT ON COLUMN confirmed_participations.confirmed_at IS '確定日時';
COMMENT ON COLUMN confirmed_participations.confirmed_by IS '確定者（admin等）';
COMMENT ON COLUMN confirmed_participations.created_at IS '作成日時';
COMMENT ON COLUMN confirmed_participations.updated_at IS '更新日時';

-- 既存データの移行
-- applicantsテーブルのconfirmed_date_idとconfirmed_course_idが設定されている場合、
-- confirmed_participationsテーブルに移行する
INSERT INTO confirmed_participations (
  applicant_id,
  confirmed_date_id,
  confirmed_course_id,
  confirmed_at,
  confirmed_by,
  created_at,
  updated_at
)
SELECT
  id,
  confirmed_date_id,
  confirmed_course_id,
  COALESCE(confirmed_at, NOW()),
  COALESCE(confirmed_by, 'admin'),
  NOW(),
  NOW()
FROM applicants
WHERE confirmed_date_id IS NOT NULL
  AND status = 'confirmed'
  AND NOT EXISTS (
    SELECT 1 FROM confirmed_participations cp
    WHERE cp.applicant_id = applicants.id
      AND cp.confirmed_date_id = applicants.confirmed_date_id
  );

-- 注意：applicantsテーブルのconfirmed_date_id、confirmed_course_id、confirmed_at、confirmed_byカラムは
-- 後方互換性のため残しますが、今後は confirmed_participations テーブルを使用してください。
-- 将来的にこれらのカラムを削除する場合は、以下のコメントを外してください：

-- ALTER TABLE applicants DROP COLUMN IF EXISTS confirmed_date_id;
-- ALTER TABLE applicants DROP COLUMN IF EXISTS confirmed_course_id;
-- ALTER TABLE applicants DROP COLUMN IF EXISTS confirmed_at;
-- ALTER TABLE applicants DROP COLUMN IF EXISTS confirmed_by;
