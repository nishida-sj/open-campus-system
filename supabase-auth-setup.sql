-- =============================================
-- 認証・権限管理システム Tier 1
-- 1-5人の小規模運用向け基本セキュリティ
-- =============================================
--
-- 実行方法:
-- 1. Supabase Dashboard > SQL Editor を開く
-- 2. このファイルの内容をコピー＆ペースト
-- 3. 「Run」ボタンをクリック
-- =============================================

-- =============================================
-- 1. ロールマスタテーブル（固定3ロール）
-- =============================================

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  level INTEGER NOT NULL, -- 権限レベル（数字が大きいほど強い権限）
  is_system_role BOOLEAN DEFAULT true, -- システムロール（削除不可）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS有効化
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.roles
  FOR ALL
  USING (auth.role() = 'service_role');

-- 固定ロールを挿入
INSERT INTO public.roles (name, display_name, description, level, is_system_role) VALUES
  ('super_admin', 'スーパー管理者', 'システム全体の管理者。すべての機能にアクセス可能。ユーザー管理、システム設定が可能。', 100, true),
  ('line_admin', 'LINEビジネス管理者', 'AI設定、LINE配信、メール設定を管理。イベントと申込者は閲覧のみ可能。', 50, true),
  ('event_staff', 'オープンキャンパス担当者', 'イベント管理と申込者管理のみ可能。AI設定やユーザー管理は不可。', 30, true)
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 2. ユーザーテーブル
-- =============================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  must_change_password BOOLEAN DEFAULT true, -- 初回ログイン時に強制変更
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

-- RLS有効化
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.users
  FOR ALL
  USING (auth.role() = 'service_role');

-- ユーザー更新時にupdated_atを自動更新
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 3. ユーザー×ロール関連テーブル
-- =============================================

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES public.users(id),
  UNIQUE(user_id, role_id) -- 同じユーザーに同じロールを複数回割り当てない
);

-- RLS有効化
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.user_roles
  FOR ALL
  USING (auth.role() = 'service_role');

-- インデックス作成（検索高速化）
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

-- =============================================
-- 4. ログイン履歴テーブル
-- =============================================

CREATE TABLE IF NOT EXISTS public.login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL, -- ユーザー削除後も記録を残すため
  login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address VARCHAR(45), -- IPv6対応
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason VARCHAR(255),
  session_id VARCHAR(255) -- セッション追跡用
);

-- RLS有効化
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON public.login_logs
  FOR ALL
  USING (auth.role() = 'service_role');

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON public.login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_login_at ON public.login_logs(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_logs_success ON public.login_logs(success);

-- =============================================
-- 5. 便利なビュー: ユーザー情報とロールを結合
-- =============================================

CREATE OR REPLACE VIEW public.users_with_roles AS
SELECT
  u.id,
  u.email,
  u.full_name,
  u.is_active,
  u.must_change_password,
  u.last_login_at,
  u.created_at,
  u.updated_at,
  COALESCE(
    json_agg(
      json_build_object(
        'role_id', r.id,
        'role_name', r.name,
        'display_name', r.display_name,
        'level', r.level,
        'assigned_at', ur.assigned_at
      ) ORDER BY r.level DESC
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  ) as roles,
  MAX(r.level) as max_role_level -- 最高権限レベル
FROM public.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
GROUP BY u.id;

-- =============================================
-- 6. 便利な関数: ユーザーの権限チェック
-- =============================================

-- ユーザーが指定したロールを持っているかチェック
CREATE OR REPLACE FUNCTION public.user_has_role(
  p_user_id UUID,
  p_role_name VARCHAR
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
      AND r.name = p_role_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ユーザーの最高権限レベルを取得
CREATE OR REPLACE FUNCTION public.get_user_max_level(
  p_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  max_level INTEGER;
BEGIN
  SELECT COALESCE(MAX(r.level), 0) INTO max_level
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id;

  RETURN max_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 7. 初期管理者ユーザー作成（要変更）
-- =============================================

-- 注意: 実際のメールアドレスに変更してください
-- このユーザーでSupabase Authにもサインアップが必要です

DO $$
DECLARE
  v_user_id UUID;
  v_super_admin_role_id UUID;
BEGIN
  -- スーパー管理者ロールIDを取得
  SELECT id INTO v_super_admin_role_id
  FROM public.roles
  WHERE name = 'super_admin';

  -- 初期管理者ユーザーを作成（既に存在する場合はスキップ）
  INSERT INTO public.users (email, full_name, is_active, must_change_password)
  VALUES ('admin@example.com', '初期管理者', true, true)
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO v_user_id;

  -- ユーザーが新規作成された場合のみロールを割り当て
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_user_id, v_super_admin_role_id);

    RAISE NOTICE '初期管理者ユーザーを作成しました: admin@example.com';
  ELSE
    RAISE NOTICE '初期管理者ユーザーは既に存在します';
  END IF;
END $$;

-- =============================================
-- 完了メッセージ
-- =============================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE '認証・権限管理システム Tier 1 のセットアップが完了しました！';
  RAISE NOTICE '';
  RAISE NOTICE '次のステップ:';
  RAISE NOTICE '1. Supabase Auth でユーザーを作成';
  RAISE NOTICE '   - Email: admin@example.com';
  RAISE NOTICE '   - Password: （お好きなパスワード）';
  RAISE NOTICE '';
  RAISE NOTICE '2. 作成したユーザーの情報を確認:';
  RAISE NOTICE '   SELECT * FROM public.users_with_roles;';
  RAISE NOTICE '';
  RAISE NOTICE '3. ログインページを実装して動作確認';
  RAISE NOTICE '==============================================';
END $$;
