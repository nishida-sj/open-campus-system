-- open_campus_dates の date カラムにユニーク制約がある場合、それを削除
-- 同じ日付で複数のイベントを開催できるようにする

-- まず制約を確認
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'open_campus_dates'::regclass
  AND conname LIKE '%date%';

-- ユニーク制約を削除（制約名が見つかった場合）
ALTER TABLE open_campus_dates
DROP CONSTRAINT IF EXISTS open_campus_dates_date_key;

-- インデックスも削除（存在する場合）
DROP INDEX IF EXISTS open_campus_dates_date_key;

-- 確認：制約が削除されたことを確認
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'open_campus_dates'::regclass;
