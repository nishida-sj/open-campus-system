# Supabase AI設定マイグレーション手順

## 手順

1. Supabaseダッシュボードにログイン
2. プロジェクトを選択
3. 左メニューから「SQL Editor」を選択
4. 「New query」をクリック
5. 以下のSQLを貼り付けて実行

## SQL

```sql
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

-- 確認用クエリ（実行後に確認）
SELECT setting_key,
       CASE
         WHEN LENGTH(setting_value) > 50 THEN SUBSTRING(setting_value, 1, 50) || '...'
         ELSE setting_value
       END as setting_value_preview,
       updated_at
FROM ai_settings
WHERE setting_key LIKE 'prompt_%' OR setting_key = 'system_prompt'
ORDER BY setting_key;
```

## 実行後の確認

以下の設定キーが表示されることを確認してください：

- `prompt_access`
- `prompt_closing_message`
- `prompt_custom_items`
- `prompt_school_info`
- `prompt_unable_response`
- `system_prompt`（既存）

すべて表示されていればマイグレーション成功です。
