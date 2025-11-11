-- 通知履歴テーブル（LINE/メール送信履歴を記録）
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  applicant_id UUID NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  notification_type VARCHAR(20) NOT NULL, -- 'line' or 'email'
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'success', -- 'success' or 'failed'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_notification_logs_applicant_id ON notification_logs(applicant_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);

-- メールサーバ設定テーブル
CREATE TABLE IF NOT EXISTS email_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  smtp_host VARCHAR(255) NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_user VARCHAR(255) NOT NULL,
  smtp_password TEXT NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  use_tls BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- コメント追加
COMMENT ON TABLE notification_logs IS 'LINE/メール通知の送信履歴';
COMMENT ON COLUMN notification_logs.notification_type IS '通知タイプ: line または email';
COMMENT ON COLUMN notification_logs.status IS '送信ステータス: success または failed';

COMMENT ON TABLE email_settings IS 'メールサーバ設定（SMTPサーバ情報）';
COMMENT ON COLUMN email_settings.use_tls IS 'TLS/STARTTLS使用の有無';
COMMENT ON COLUMN email_settings.is_active IS 'この設定を使用するかどうか';
