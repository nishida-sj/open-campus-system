-- AIメンテナンスモード設定
-- Supabase SQL Editor で実行してください

-- メンテナンスモード設定を追加
INSERT INTO ai_settings (setting_key, setting_value, description)
VALUES
  ('maintenance_mode', 'false', 'メンテナンスモード（true: 有効、false: 無効）'),
  ('maintenance_tester_ids', '[]', 'メンテナンスモード中にAI機能を使用できるLINE User IDのリスト（JSON配列形式）'),
  ('maintenance_invite_code', '', 'テスター招待コード'),
  ('maintenance_invite_expires', '', 'テスター招待コードの有効期限（ISO形式）')
ON CONFLICT (setting_key) DO NOTHING;
