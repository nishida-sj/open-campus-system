-- ===================================================
-- AIモデルをgpt-4o-miniに変更
-- 実行日: 2025-12-01
-- ===================================================

-- ai_settings テーブルの model と max_tokens を更新
UPDATE ai_settings
SET setting_value = 'gpt-4o-mini', updated_at = NOW()
WHERE setting_key = 'model';

UPDATE ai_settings
SET setting_value = '500', updated_at = NOW()
WHERE setting_key = 'max_tokens';

-- 確認
SELECT setting_key, setting_value, updated_at
FROM ai_settings
WHERE setting_key IN ('model', 'max_tokens', 'temperature', 'monthly_limit_jpy', 'enabled')
ORDER BY setting_key;

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE 'AI model updated to gpt-4o-mini successfully';
  RAISE NOTICE 'Model: gpt-3.5-turbo -> gpt-4o-mini';
  RAISE NOTICE 'Max tokens: 300 -> 500';
  RAISE NOTICE 'Cost reduction: Input 70percent, Output 60percent';
END $$;
