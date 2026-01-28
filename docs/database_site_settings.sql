-- サイト設定テーブル
-- Supabase SQL Editor で実行してください

CREATE TABLE IF NOT EXISTS site_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_name VARCHAR(255) NOT NULL DEFAULT 'オープンキャンパス',
  header_text VARCHAR(255) DEFAULT 'オープンキャンパス',
  footer_text VARCHAR(255) DEFAULT NULL,
  primary_color VARCHAR(7) DEFAULT '#1a365d',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 初期データ挿入
INSERT INTO site_settings (school_name, header_text, footer_text, primary_color, is_active)
VALUES ('伊勢学園高等学校', '伊勢学園高等学校 オープンキャンパス', '© 伊勢学園高等学校', '#1a365d', true)
ON CONFLICT DO NOTHING;

-- 更新日時自動更新トリガー
CREATE OR REPLACE FUNCTION update_site_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_site_settings_updated_at ON site_settings;
CREATE TRIGGER trigger_update_site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_site_settings_updated_at();

-- RLS設定（必要に応じて）
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- 全ユーザー読み取り可能（公開ページで使用するため）
CREATE POLICY "Allow public read access to site_settings"
  ON site_settings
  FOR SELECT
  USING (true);

-- サービスロールのみ更新可能
CREATE POLICY "Allow service role to manage site_settings"
  ON site_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);
