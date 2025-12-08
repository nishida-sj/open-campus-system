-- RPC関数: コース×日程の確定数を増やす
CREATE OR REPLACE FUNCTION increment_course_date_count(
  p_date_id UUID,
  p_course_id UUID
)
RETURNS void AS $$
BEGIN
  -- コース×日程のカウントを増やす
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- RPC関数: コース×日程の確定数を減らす
CREATE OR REPLACE FUNCTION decrement_course_date_count(
  p_date_id UUID,
  p_course_id UUID
)
RETURNS void AS $$
BEGIN
  -- コース×日程のカウントを減らす
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION increment_course_date_count IS 'コース×日程の確定数を1増やし、日程の合計も更新';
COMMENT ON FUNCTION decrement_course_date_count IS 'コース×日程の確定数を1減らし、日程の合計も更新';
