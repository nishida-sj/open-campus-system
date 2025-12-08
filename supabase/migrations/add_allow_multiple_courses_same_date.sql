-- 同日の複数コース申込を許可するフラグを追加
ALTER TABLE open_campus_events
ADD COLUMN IF NOT EXISTS allow_multiple_courses_same_date BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN open_campus_events.allow_multiple_courses_same_date IS '同じ日程で複数のコースへの申込を許可するかどうか';

-- 既存のイベントはデフォルトでfalse（許可しない）
UPDATE open_campus_events
SET allow_multiple_courses_same_date = FALSE
WHERE allow_multiple_courses_same_date IS NULL;
