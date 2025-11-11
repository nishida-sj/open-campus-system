-- イベントテーブルに確定者案内メッセージカラムを追加
ALTER TABLE open_campus_events
ADD COLUMN IF NOT EXISTS confirmation_message TEXT;

-- カラムにコメントを追加
COMMENT ON COLUMN open_campus_events.confirmation_message IS '確定者への案内メッセージ（LINE/メール通知時に使用）';
