-- ===================================================
-- AI自動応答機能のためのデータベーステーブル
-- 作成日: 2025-12-01
-- ===================================================

-- ---------------------------------------------------
-- 1. 会話履歴テーブル
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成（検索高速化）
CREATE INDEX IF NOT EXISTS idx_conversation_history_line_user_id
ON conversation_history(line_user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_history_created_at
ON conversation_history(created_at DESC);

-- RLS（Row Level Security）設定
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;

-- サービスロールのみアクセス可能
DROP POLICY IF EXISTS "Service role only" ON conversation_history;
CREATE POLICY "Service role only"
ON conversation_history
FOR ALL
USING (auth.role() = 'service_role');

-- コメント追加
COMMENT ON TABLE conversation_history IS 'LINE AI自動応答の会話履歴';
COMMENT ON COLUMN conversation_history.line_user_id IS 'LINE User ID';
COMMENT ON COLUMN conversation_history.role IS 'メッセージの役割: user, assistant, system';
COMMENT ON COLUMN conversation_history.message IS '会話内容';

-- ---------------------------------------------------
-- 2. AI使用量ログテーブル
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id VARCHAR(100),
  request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  model VARCHAR(50) DEFAULT 'gpt-3.5-turbo',
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost_usd DECIMAL(10, 6) NOT NULL,
  cost_jpy DECIMAL(10, 2) NOT NULL,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_ai_usage_timestamp
ON ai_usage_logs(request_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user
ON ai_usage_logs(line_user_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at
ON ai_usage_logs(created_at DESC);

-- RLS設定
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON ai_usage_logs;
CREATE POLICY "Service role only"
ON ai_usage_logs
FOR ALL
USING (auth.role() = 'service_role');

-- コメント追加
COMMENT ON TABLE ai_usage_logs IS 'OpenAI API使用量ログ';
COMMENT ON COLUMN ai_usage_logs.line_user_id IS 'LINE User ID';
COMMENT ON COLUMN ai_usage_logs.model IS '使用したOpenAIモデル';
COMMENT ON COLUMN ai_usage_logs.prompt_tokens IS '入力トークン数';
COMMENT ON COLUMN ai_usage_logs.completion_tokens IS '出力トークン数';
COMMENT ON COLUMN ai_usage_logs.total_tokens IS '合計トークン数';
COMMENT ON COLUMN ai_usage_logs.cost_usd IS 'コスト(USD)';
COMMENT ON COLUMN ai_usage_logs.cost_jpy IS 'コスト(JPY)';
COMMENT ON COLUMN ai_usage_logs.success IS 'API呼び出し成功フラグ';
COMMENT ON COLUMN ai_usage_logs.error_message IS 'エラーメッセージ（失敗時）';

-- ---------------------------------------------------
-- 3. AI設定テーブル
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS設定
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON ai_settings;
CREATE POLICY "Service role only"
ON ai_settings
FOR ALL
USING (auth.role() = 'service_role');

-- コメント追加
COMMENT ON TABLE ai_settings IS 'AI機能の設定';
COMMENT ON COLUMN ai_settings.setting_key IS '設定キー';
COMMENT ON COLUMN ai_settings.setting_value IS '設定値';
COMMENT ON COLUMN ai_settings.description IS '設定の説明';

-- ---------------------------------------------------
-- 4. 初期設定値の投入
-- ---------------------------------------------------
INSERT INTO ai_settings (setting_key, setting_value, description)
VALUES
  ('system_prompt', 'あなたはオープンキャンパス案内アシスタントです。丁寧に質問に答えてください。', 'システムプロンプト'),
  ('model', 'gpt-3.5-turbo', '使用するOpenAIモデル'),
  ('temperature', '0.7', '生成の多様性 (0-2)'),
  ('max_tokens', '300', '最大出力トークン数'),
  ('monthly_limit_jpy', '500', '月間使用量上限（円）'),
  ('enabled', 'true', 'AI機能の有効/無効'),
  ('usd_to_jpy_rate', '150', 'USD→JPY換算レート')
ON CONFLICT (setting_key) DO NOTHING;

-- ---------------------------------------------------
-- 5. 古い会話履歴を自動削除する関数
-- ---------------------------------------------------
CREATE OR REPLACE FUNCTION delete_old_conversations()
RETURNS void AS $$
BEGIN
  DELETE FROM conversation_history
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION delete_old_conversations IS '30日以上前の会話履歴を削除';

-- ---------------------------------------------------
-- 6. 使用量集計ビュー（オプション）
-- ---------------------------------------------------
CREATE OR REPLACE VIEW ai_usage_monthly_summary AS
SELECT
  DATE_TRUNC('month', request_timestamp) AS month,
  COUNT(*) AS request_count,
  SUM(total_tokens) AS total_tokens,
  SUM(cost_usd) AS total_cost_usd,
  SUM(cost_jpy) AS total_cost_jpy,
  AVG(total_tokens) AS avg_tokens_per_request,
  COUNT(CASE WHEN success = false THEN 1 END) AS error_count
FROM ai_usage_logs
GROUP BY DATE_TRUNC('month', request_timestamp)
ORDER BY month DESC;

COMMENT ON VIEW ai_usage_monthly_summary IS 'AI使用量の月次サマリー';

-- ---------------------------------------------------
-- 完了メッセージ
-- ---------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '✅ AI機能のデータベーステーブル作成が完了しました';
  RAISE NOTICE '📋 作成されたテーブル:';
  RAISE NOTICE '  - conversation_history (会話履歴)';
  RAISE NOTICE '  - ai_usage_logs (使用量ログ)';
  RAISE NOTICE '  - ai_settings (設定)';
  RAISE NOTICE '📊 作成されたビュー:';
  RAISE NOTICE '  - ai_usage_monthly_summary (月次サマリー)';
  RAISE NOTICE '';
  RAISE NOTICE '次のステップ:';
  RAISE NOTICE '1. OpenAI APIキーを取得してください';
  RAISE NOTICE '2. .env.localのOPENAI_API_KEYを設定してください';
  RAISE NOTICE '3. アプリケーションコードの実装を進めてください';
END $$;
