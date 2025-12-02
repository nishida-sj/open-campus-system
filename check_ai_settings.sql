-- ai_settingsテーブルの構造とデータを確認
SELECT setting_key, 
       CASE 
         WHEN LENGTH(setting_value) > 50 
         THEN SUBSTRING(setting_value, 1, 50) || '...' 
         ELSE setting_value 
       END as setting_value_preview,
       updated_at
FROM ai_settings
ORDER BY setting_key;
