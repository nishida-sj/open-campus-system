-- =====================================================
-- 伊勢学園高等学校 (ise-gakuen) シードデータ
-- =====================================================
-- 前提: 20260302_multi_tenant.sql が適用済み
-- 内容:
--   1. 管理者ユーザー (users + user_roles)
--   2. site_settings
--   3. ai_settings (基本設定)
-- =====================================================

DO $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_super_admin_role_id UUID;
BEGIN
  -- テナントID取得
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'ise-gakuen';
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ise-gakuen not found. Run 20260302_multi_tenant.sql first.';
  END IF;

  -- =====================================================
  -- 1. 管理者ユーザー
  -- =====================================================
  -- ※ Supabase Auth側にも同じメールで登録が必要
  -- ※ パスワードはSupabase Auth Dashboard から設定

  -- 管理者が既に存在しない場合のみ作成
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE email = 'admin@ise-gakuen.ac.jp' AND tenant_id = v_tenant_id
  ) THEN
    INSERT INTO public.users (tenant_id, full_name, email, is_active, must_change_password)
    VALUES (v_tenant_id, '伊勢学園管理者', 'admin@ise-gakuen.ac.jp', true, true)
    RETURNING id INTO v_user_id;

    -- super_adminロールを付与
    SELECT id INTO v_super_admin_role_id FROM public.roles WHERE name = 'super_admin';
    IF v_super_admin_role_id IS NOT NULL AND v_user_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id, tenant_id)
      VALUES (v_user_id, v_super_admin_role_id, v_tenant_id);
    END IF;

    RAISE NOTICE 'Created admin user for ise-gakuen: admin@ise-gakuen.ac.jp';
  ELSE
    RAISE NOTICE 'Admin user already exists for ise-gakuen';
  END IF;

  -- =====================================================
  -- 2. site_settings
  -- =====================================================
  IF NOT EXISTS (
    SELECT 1 FROM public.site_settings
    WHERE tenant_id = v_tenant_id AND is_active = true
  ) THEN
    INSERT INTO public.site_settings (
      tenant_id, school_name, header_text, footer_text, primary_color, is_active
    ) VALUES (
      v_tenant_id,
      '伊勢学園高等学校',
      '伊勢学園高等学校 オープンキャンパス',
      '© 伊勢学園高等学校',
      '#2d5a27',  -- 伊勢学園のスクールカラー（緑系）
      true
    );
    RAISE NOTICE 'Created site_settings for ise-gakuen';
  ELSE
    RAISE NOTICE 'site_settings already exists for ise-gakuen';
  END IF;

  -- =====================================================
  -- 3. ai_settings (基本設定)
  -- =====================================================
  -- AI機能はデフォルト無効で作成

  -- enabled
  INSERT INTO public.ai_settings (tenant_id, setting_key, setting_value)
  VALUES (v_tenant_id, 'enabled', 'false')
  ON CONFLICT (tenant_id, setting_key) DO NOTHING;

  -- model
  INSERT INTO public.ai_settings (tenant_id, setting_key, setting_value)
  VALUES (v_tenant_id, 'model', 'gpt-4o-mini')
  ON CONFLICT (tenant_id, setting_key) DO NOTHING;

  -- temperature
  INSERT INTO public.ai_settings (tenant_id, setting_key, setting_value)
  VALUES (v_tenant_id, 'temperature', '0.7')
  ON CONFLICT (tenant_id, setting_key) DO NOTHING;

  -- max_tokens
  INSERT INTO public.ai_settings (tenant_id, setting_key, setting_value)
  VALUES (v_tenant_id, 'max_tokens', '500')
  ON CONFLICT (tenant_id, setting_key) DO NOTHING;

  -- monthly_limit_jpy
  INSERT INTO public.ai_settings (tenant_id, setting_key, setting_value)
  VALUES (v_tenant_id, 'monthly_limit_jpy', '500')
  ON CONFLICT (tenant_id, setting_key) DO NOTHING;

  -- usd_to_jpy_rate
  INSERT INTO public.ai_settings (tenant_id, setting_key, setting_value)
  VALUES (v_tenant_id, 'usd_to_jpy_rate', '150')
  ON CONFLICT (tenant_id, setting_key) DO NOTHING;

  -- maintenance_mode (OFF)
  INSERT INTO public.ai_settings (tenant_id, setting_key, setting_value)
  VALUES (v_tenant_id, 'maintenance_mode', 'false')
  ON CONFLICT (tenant_id, setting_key) DO NOTHING;

  -- prompt_school_info
  INSERT INTO public.ai_settings (tenant_id, setting_key, setting_value)
  VALUES (v_tenant_id, 'prompt_school_info', '伊勢学園高等学校は三重県伊勢市にある私立高等学校です。')
  ON CONFLICT (tenant_id, setting_key) DO NOTHING;

  -- prompt_unable_response
  INSERT INTO public.ai_settings (tenant_id, setting_key, setting_value)
  VALUES (v_tenant_id, 'prompt_unable_response', '申し訳ございません。お問い合わせの内容について、正確な情報をお伝えすることができません。詳しくは学校までお問い合わせください。')
  ON CONFLICT (tenant_id, setting_key) DO NOTHING;

  -- prompt_closing_message
  INSERT INTO public.ai_settings (tenant_id, setting_key, setting_value)
  VALUES (v_tenant_id, 'prompt_closing_message', 'ご質問ありがとうございます。他にもご不明な点がございましたらお気軽にお問い合わせください。')
  ON CONFLICT (tenant_id, setting_key) DO NOTHING;

  RAISE NOTICE 'AI settings seeded for ise-gakuen';

END $$;

-- =====================================================
-- Summary
-- =====================================================
-- ✓ Admin user: admin@ise-gakuen.ac.jp (super_admin)
-- ✓ site_settings: school_name, header, footer, color
-- ✓ ai_settings: 10 default settings (AI disabled)
--
-- Next steps:
-- 1. Register admin@ise-gakuen.ac.jp in Supabase Auth
-- 2. Set LINE credentials in tenants table:
--    UPDATE tenants SET
--      line_channel_access_token = '...',
--      line_channel_secret = '...',
--      line_bot_basic_id = '...'
--    WHERE slug = 'ise-gakuen';
-- 3. (Optional) Set OpenAI API key:
--    UPDATE tenants SET openai_api_key = '...'
--    WHERE slug = 'ise-gakuen';
-- =====================================================
