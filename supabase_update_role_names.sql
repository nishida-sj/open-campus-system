-- ロール表示名を更新
-- Supabase SQL Editorで実行してください

UPDATE roles
SET display_name = 'administrator'
WHERE name = 'super_admin';

-- 確認クエリ
SELECT * FROM roles ORDER BY level DESC;
