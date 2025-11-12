-- 孤立した日程レコードをクリーンアップ
-- イベントが存在しない日程を削除

DELETE FROM open_campus_dates
WHERE event_id NOT IN (SELECT id FROM open_campus_events);

-- 確認用クエリ（削除後に実行して0件であることを確認）
SELECT * FROM open_campus_dates
WHERE event_id NOT IN (SELECT id FROM open_campus_events);
