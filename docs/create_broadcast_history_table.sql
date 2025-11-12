-- メッセージ配信履歴テーブル
CREATE TABLE IF NOT EXISTS broadcast_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(10) NOT NULL CHECK (type IN ('email', 'line')),
  subject TEXT,
  message TEXT NOT NULL,
  recipient_count INTEGER NOT NULL,
  success_count INTEGER NOT NULL,
  failed_count INTEGER NOT NULL,
  recipients JSONB NOT NULL,
  errors JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_broadcast_history_created_at ON broadcast_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_history_type ON broadcast_history(type);

-- コメント追加
COMMENT ON TABLE broadcast_history IS 'メッセージ配信履歴';
COMMENT ON COLUMN broadcast_history.type IS '配信タイプ (email/line)';
COMMENT ON COLUMN broadcast_history.subject IS 'メール件名（emailの場合のみ）';
COMMENT ON COLUMN broadcast_history.message IS '配信メッセージ本文';
COMMENT ON COLUMN broadcast_history.recipient_count IS '送信対象者数';
COMMENT ON COLUMN broadcast_history.success_count IS '送信成功数';
COMMENT ON COLUMN broadcast_history.failed_count IS '送信失敗数';
COMMENT ON COLUMN broadcast_history.recipients IS '送信対象者情報（JSON配列）';
COMMENT ON COLUMN broadcast_history.errors IS 'エラー情報（JSON配列）';
