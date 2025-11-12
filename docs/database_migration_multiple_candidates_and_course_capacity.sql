-- 複数候補入力機能とコース別定員管理の追加

-- 1. イベントテーブルに複数候補入力フラグを追加
ALTER TABLE open_campus_events
ADD COLUMN IF NOT EXISTS allow_multiple_candidates BOOLEAN DEFAULT false;

COMMENT ON COLUMN open_campus_events.allow_multiple_candidates IS '複数候補入力を許可（allow_multiple_datesと排他）';

-- 2. コース×日程の定員管理テーブルを作成
CREATE TABLE IF NOT EXISTS course_date_capacities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES event_courses(id) ON DELETE CASCADE,
  date_id UUID NOT NULL REFERENCES open_campus_dates(id) ON DELETE CASCADE,
  capacity INTEGER NOT NULL DEFAULT 0,
  current_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, date_id)
);

CREATE INDEX IF NOT EXISTS idx_course_date_capacities_course
  ON course_date_capacities(course_id);

CREATE INDEX IF NOT EXISTS idx_course_date_capacities_date
  ON course_date_capacities(date_id);

COMMENT ON TABLE course_date_capacities IS 'コース×日程別の定員管理';
COMMENT ON COLUMN course_date_capacities.course_id IS 'コースID';
COMMENT ON COLUMN course_date_capacities.date_id IS '日程ID';
COMMENT ON COLUMN course_date_capacities.capacity IS '定員数';
COMMENT ON COLUMN course_date_capacities.current_count IS '現在の確定数';

-- 3. 日程定員を自動計算するビューを作成
CREATE OR REPLACE VIEW date_total_capacities AS
SELECT
  d.id AS date_id,
  d.event_id,
  d.date,
  COALESCE(SUM(cdc.capacity), 0) AS total_capacity,
  COALESCE(SUM(cdc.current_count), 0) AS total_current_count
FROM open_campus_dates d
LEFT JOIN course_date_capacities cdc ON d.id = cdc.date_id
GROUP BY d.id, d.event_id, d.date;

COMMENT ON VIEW date_total_capacities IS '日程別の合計定員（全コース定員の合計）';

-- 4. コース×日程の定員カウントを増減する関数
CREATE OR REPLACE FUNCTION increment_course_date_count(
  p_course_id UUID,
  p_date_id UUID
)
RETURNS void AS $$
BEGIN
  UPDATE course_date_capacities
  SET current_count = current_count + 1,
      updated_at = NOW()
  WHERE course_id = p_course_id
    AND date_id = p_date_id;

  -- レコードが存在しない場合は作成
  IF NOT FOUND THEN
    INSERT INTO course_date_capacities (course_id, date_id, capacity, current_count)
    VALUES (p_course_id, p_date_id, 0, 1);
  END IF;

  -- 日程の合計カウントも更新
  UPDATE open_campus_dates
  SET current_count = (
    SELECT COALESCE(SUM(current_count), 0)
    FROM course_date_capacities
    WHERE date_id = p_date_id
  ),
  updated_at = NOW()
  WHERE id = p_date_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_course_date_count(
  p_course_id UUID,
  p_date_id UUID
)
RETURNS void AS $$
BEGIN
  UPDATE course_date_capacities
  SET current_count = GREATEST(current_count - 1, 0),
      updated_at = NOW()
  WHERE course_id = p_course_id
    AND date_id = p_date_id;

  -- 日程の合計カウントも更新
  UPDATE open_campus_dates
  SET current_count = (
    SELECT COALESCE(SUM(current_count), 0)
    FROM course_date_capacities
    WHERE date_id = p_date_id
  ),
  updated_at = NOW()
  WHERE id = p_date_id;
END;
$$ LANGUAGE plpgsql;

-- 5. 既存データの移行
-- 既存のコースと日程の組み合わせに対してcapacityレコードを作成
INSERT INTO course_date_capacities (course_id, date_id, capacity, current_count)
SELECT
  cda.course_id,
  cda.date_id,
  0 as capacity,  -- デフォルト値、後で管理画面から設定
  0 as current_count
FROM course_date_associations cda
ON CONFLICT (course_id, date_id) DO NOTHING;

-- 6. 制約チェック関数を追加（allow_multiple_datesとallow_multiple_candidatesの排他制御）
CREATE OR REPLACE FUNCTION check_event_flags()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.allow_multiple_dates = true AND NEW.allow_multiple_candidates = true THEN
    RAISE EXCEPTION '複数日参加と複数候補入力は同時に許可できません';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーを作成
DROP TRIGGER IF EXISTS check_event_flags_trigger ON open_campus_events;
CREATE TRIGGER check_event_flags_trigger
  BEFORE INSERT OR UPDATE ON open_campus_events
  FOR EACH ROW
  EXECUTE FUNCTION check_event_flags();

-- 7. 既存のallow_multiple_datesがtrueのイベントはallow_multiple_candidatesをfalseに設定
UPDATE open_campus_events
SET allow_multiple_candidates = false
WHERE allow_multiple_dates = true;

-- 注意事項のコメント
COMMENT ON FUNCTION increment_course_date_count IS 'コース×日程の確定数を1増やし、日程の合計も更新';
COMMENT ON FUNCTION decrement_course_date_count IS 'コース×日程の確定数を1減らし、日程の合計も更新';
COMMENT ON FUNCTION check_event_flags IS 'allow_multiple_datesとallow_multiple_candidatesの排他制御';
