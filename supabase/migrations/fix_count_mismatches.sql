-- カウント不整合を修正するSQL
-- 削除された確定者によって生じたカウントのずれを修正します

-- 1. 日程別の確定数を実際の件数に合わせる
UPDATE open_campus_dates ocd
SET current_count = (
  SELECT COUNT(*)
  FROM confirmed_participations cp
  WHERE cp.confirmed_date_id = ocd.id
),
updated_at = NOW()
WHERE ocd.current_count != (
  SELECT COUNT(*)
  FROM confirmed_participations cp
  WHERE cp.confirmed_date_id = ocd.id
);

-- 2. コース×日程別の確定数を実際の件数に合わせる
UPDATE course_date_capacities cdc
SET current_count = (
  SELECT COUNT(*)
  FROM confirmed_participations cp
  WHERE cp.confirmed_date_id = cdc.date_id
    AND cp.confirmed_course_id = cdc.course_id
),
updated_at = NOW()
WHERE cdc.current_count != (
  SELECT COUNT(*)
  FROM confirmed_participations cp
  WHERE cp.confirmed_date_id = cdc.date_id
    AND cp.confirmed_course_id = cdc.course_id
);

-- 3. 日程別の確定数を全コースの合計で再計算（念のため）
UPDATE open_campus_dates ocd
SET current_count = (
  SELECT COALESCE(SUM(cdc.current_count), 0)
  FROM course_date_capacities cdc
  WHERE cdc.date_id = ocd.id
),
updated_at = NOW()
WHERE EXISTS (
  SELECT 1
  FROM course_date_capacities cdc
  WHERE cdc.date_id = ocd.id
);

-- 確認用クエリ（実行後に確認してください）
-- 日程別の確定数とconfirmed_participationsの実際の件数を比較
SELECT
  ocd.id,
  oce.name as event_name,
  ocd.date,
  ocd.capacity as "定員",
  ocd.current_count as "カウント",
  (SELECT COUNT(*) FROM confirmed_participations cp WHERE cp.confirmed_date_id = ocd.id) as "実際の確定数",
  ocd.current_count - (SELECT COUNT(*) FROM confirmed_participations cp WHERE cp.confirmed_date_id = ocd.id) as "差分"
FROM open_campus_dates ocd
JOIN open_campus_events oce ON ocd.event_id = oce.id
ORDER BY ocd.date DESC;

-- コース別の確定数とconfirmed_participationsの実際の件数を比較
SELECT
  cdc.date_id,
  ocd.date,
  ec.name as course_name,
  cdc.capacity as "コース定員",
  cdc.current_count as "カウント",
  (SELECT COUNT(*) FROM confirmed_participations cp
   WHERE cp.confirmed_date_id = cdc.date_id
   AND cp.confirmed_course_id = cdc.course_id) as "実際の確定数",
  cdc.current_count - (SELECT COUNT(*) FROM confirmed_participations cp
   WHERE cp.confirmed_date_id = cdc.date_id
   AND cp.confirmed_course_id = cdc.course_id) as "差分"
FROM course_date_capacities cdc
JOIN event_courses ec ON cdc.course_id = ec.id
JOIN open_campus_dates ocd ON cdc.date_id = ocd.id
ORDER BY ocd.date DESC, ec.name;
