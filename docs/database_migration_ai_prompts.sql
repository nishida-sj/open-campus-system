-- AI設定の新しいプロンプト構造マイグレーション
-- 実行日: 2025-12-02

-- 固定項目を追加
INSERT INTO ai_settings (setting_key, setting_value)
VALUES
  ('prompt_school_info', '')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO ai_settings (setting_key, setting_value)
VALUES
  ('prompt_access', '')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO ai_settings (setting_key, setting_value)
VALUES
  ('prompt_unable_response', '')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO ai_settings (setting_key, setting_value)
VALUES
  ('prompt_closing_message', '')
ON CONFLICT (setting_key) DO NOTHING;

-- カスタム項目（JSON配列）
INSERT INTO ai_settings (setting_key, setting_value)
VALUES
  ('prompt_custom_items', '[]')
ON CONFLICT (setting_key) DO NOTHING;

-- 既存のsystem_promptは残しておく（後方互換性のため）
-- 新しい構造に移行後、削除可能

-- 確認用クエリ
SELECT setting_key,
       CASE
         WHEN LENGTH(setting_value) > 50 THEN SUBSTRING(setting_value, 1, 50) || '...'
         ELSE setting_value
       END as setting_value_preview
FROM ai_settings
WHERE setting_key LIKE 'prompt_%'
ORDER BY setting_key;
