# 外部サービスアカウント作成ガイド

## 🎯 アカウント作成のタイミング

### Supabase（データベース）
**作成タイミング**: ⚠️ **今すぐ（次のステップ）**

**理由**: 
- データベーステーブルを作成するために必要
- APIエンドポイント実装前に環境変数が必要
- ローカル開発でもSupabase接続が必要

---

### Vercel（デプロイ）
**作成タイミング**: ⏰ **本番デプロイ時（最後）**

**理由**:
- ローカル開発中は不要
- 申込フォームと管理画面が完成してから
- LINE Webhook URLを本番環境に設定する際に必要

---

## 📋 Supabaseアカウント作成 - 詳細手順

### Step 1: アカウント作成（5分）

1. **Supabase公式サイトにアクセス**
   - URL: https://supabase.com
   - 「Start your project」ボタンをクリック

2. **サインアップ方法を選択**
   - 推奨: 「Continue with GitHub」
   - または: メールアドレスでサインアップ

3. **GitHubアカウントで認証（推奨）**
   - GitHubにログイン
   - Supabaseへのアクセス許可
   - 自動的にSupabaseダッシュボードへ

4. **メール認証（メールアドレスの場合）**
   - 確認メールが届く
   - リンクをクリックして認証完了

---

### Step 2: プロジェクト作成（5分）

1. **ダッシュボードで「New Project」をクリック**

2. **Organization（組織）を選択または作成**
   - 初回の場合: 組織名を入力（例: "MySchool"）
   - 既存の場合: プルダウンから選択

3. **プロジェクト情報を入力**
   ```
   Project name: open-campus-system
   Database Password: [強力なパスワードを生成]
                     ※必ず安全な場所に保存！
   Region: Northeast Asia (Tokyo)
   Pricing Plan: Free
   ```

   **パスワード生成のコツ:**
   - 最低16文字以上
   - 大文字、小文字、数字、記号を含む
   - パスワードマネージャーに保存推奨
   - 例: `Kp9@mX#7nQ2$vL5w`

4. **「Create new project」をクリック**
   - プロジェクト作成に2-3分かかります
   - 「Setting up project...」と表示される
   - 完了まで待機

---

### Step 3: API キーの取得（3分）

1. **左サイドバーから「Project Settings」をクリック**
   - 歯車アイコン（⚙️）が目印

2. **「API」タブを選択**

3. **以下の情報をコピー**

   #### A. Project URL
   ```
   URL: https://xxxxxxxxxxxxx.supabase.co
   ```
   - `xxxxxxxxxxxxx` はランダムな文字列
   - これを `.env.local` の `NEXT_PUBLIC_SUPABASE_URL` に設定

   #### B. API Keys - anon public
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...（長い文字列）
   ```
   - これを `.env.local` の `NEXT_PUBLIC_SUPABASE_ANON_KEY` に設定
   - ⚠️ この鍵は公開可能（フロントエンドで使用）

   #### C. API Keys - service_role
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...（長い文字列）
   ```
   - 「Reveal」ボタンをクリックして表示
   - これを `.env.local` の `SUPABASE_SERVICE_ROLE_KEY` に設定
   - 🔴 **絶対に公開しない！** サーバーサイドのみで使用

---

### Step 4: .env.local ファイルの更新

`D:\LINE\open-campus-system\.env.local` を開いて以下を更新：

```bash
# Supabase - 取得した値に更新
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# LINE - すでに設定済み
LINE_CHANNEL_ACCESS_TOKEN=（既存の値）
LINE_CHANNEL_SECRET=（既存の値）
LINE_BOT_BASIC_ID=（既存の値）

# Application - すでに設定済み
NEXT_PUBLIC_APP_URL=http://localhost:3000
TOKEN_SECRET=（既存の値）
NEXT_PUBLIC_ADMIN_PASSWORD=admin123
```

**保存後、環境変数を反映:**
```bash
# 開発サーバーを再起動
# Ctrl+C で停止 → npm run dev で再起動
```

---

### Step 5: データベーステーブルの作成（10分）

1. **Supabaseダッシュボードで「SQL Editor」を選択**
   - 左サイドバーの「SQL Editor」をクリック

2. **「New query」をクリック**

3. **以下のSQLを貼り付けて実行**

```sql
-- 開催日程マスタ
CREATE TABLE open_campus_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    capacity INTEGER NOT NULL DEFAULT 50,
    current_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- コース・学科マスタ
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    capacity_per_day INTEGER,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 申込者情報テーブル
CREATE TABLE applicants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 基本情報
    name VARCHAR(100) NOT NULL,
    kana_name VARCHAR(100),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    
    -- 学校情報
    school_name VARCHAR(200) NOT NULL,
    school_type VARCHAR(20),
    grade VARCHAR(50) NOT NULL,
    graduation_year INTEGER,
    
    -- 住所情報
    postal_code VARCHAR(10),
    prefecture VARCHAR(20),
    address TEXT,
    
    -- 保護者情報
    guardian_name VARCHAR(100),
    guardian_phone VARCHAR(20),
    guardian_attendance BOOLEAN DEFAULT false,
    
    -- 希望・興味
    interested_course_id UUID REFERENCES courses(id),
    visit_date DATE NOT NULL REFERENCES open_campus_dates(date),
    
    -- LINE連携
    token VARCHAR(64) UNIQUE,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    line_user_id VARCHAR(100) UNIQUE,
    
    -- ステータス
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    
    -- その他
    remarks TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 申込ログ
CREATE TABLE application_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_id UUID REFERENCES applicants(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX idx_applicants_email ON applicants(email);
CREATE INDEX idx_applicants_token ON applicants(token);
CREATE INDEX idx_applicants_line_user_id ON applicants(line_user_id);
CREATE INDEX idx_applicants_visit_date ON applicants(visit_date);
CREATE INDEX idx_applicants_status ON applicants(status);

-- カウント増加関数
CREATE OR REPLACE FUNCTION increment_visit_count(visit_date DATE)
RETURNS void AS $$
BEGIN
  UPDATE open_campus_dates
  SET current_count = current_count + 1,
      updated_at = NOW()
  WHERE date = visit_date;
END;
$$ LANGUAGE plpgsql;

-- サンプルデータ挿入
INSERT INTO courses (name, category, description, display_order) VALUES
    ('普通科', '普通科', '大学進学を目指す総合的なカリキュラム', 1),
    ('美容科', '専門科', 'ヘアメイク・ネイル・エステの実践技術', 2),
    ('調理科', '専門科', '和洋中の調理技術と食品衛生', 3),
    ('情報処理科', '専門科', 'プログラミング・Web制作・システム開発', 4);

INSERT INTO open_campus_dates (date, capacity, is_active) VALUES
    ('2025-12-15', 100, true),
    ('2025-12-22', 100, true),
    ('2026-01-12', 100, true),
    ('2026-01-26', 100, true);
```

4. **「Run」ボタンをクリック（または Ctrl+Enter）**
   - 「Success. No rows returned」と表示されればOK

5. **テーブルが作成されたか確認**
   - 左サイドバーの「Table Editor」をクリック
   - 4つのテーブルが表示される:
     - open_campus_dates
     - courses
     - applicants
     - application_logs

---

### Step 6: データの確認（2分）

1. **Table Editorで各テーブルを確認**

   **coursesテーブル:**
   - 4件のレコードが挿入されている
   - 普通科、美容科、調理科、情報処理科

   **open_campus_datesテーブル:**
   - 4件のレコードが挿入されている
   - 2025年12月〜2026年1月の日程

2. **SQLでクエリ実行テスト**
   ```sql
   -- コース一覧を確認
   SELECT * FROM courses ORDER BY display_order;

   -- 開催日程を確認
   SELECT * FROM open_campus_dates ORDER BY date;
   ```

---

### ✅ Supabaseセットアップ完了チェックリスト

```
□ Supabaseアカウント作成完了
□ プロジェクト作成完了
□ API キー取得完了
□ .env.local に環境変数設定完了
□ データベーステーブル作成完了
□ サンプルデータ挿入確認完了
□ 開発サーバー再起動完了
```

---

## 📋 Vercelアカウント作成 - 詳細手順（本番デプロイ時）

### ⏰ 実施タイミング
以下がすべて完成してから:
- ✅ 申込フォーム実装完了
- ✅ LINE連携実装完了
- ✅ 管理画面実装完了
- ✅ ローカルでの動作確認完了

---

### Step 1: アカウント作成（3分）

1. **Vercel公式サイトにアクセス**
   - URL: https://vercel.com

2. **「Sign Up」をクリック**

3. **GitHubアカウントで認証**
   - 「Continue with GitHub」を選択
   - GitHubにログイン
   - Vercelへのアクセス許可

4. **ダッシュボードに到達**
   - 自動的にVercelダッシュボードが表示される

---

### Step 2: GitHubリポジトリの準備（5分）

1. **GitHub に未プッシュの場合**
   ```bash
   # D:\LINE\open-campus-system で実行
   git add .
   git commit -m "Initial implementation complete"
   
   # GitHubで新規リポジトリ作成後
   git remote add origin https://github.com/ユーザー名/open-campus-system.git
   git branch -M main
   git push -u origin main
   ```

2. **リポジトリの公開設定**
   - Private推奨（個人情報を扱うため）
   - Vercelは Privateリポジトリもサポート

---

### Step 3: プロジェクトのインポート（5分）

1. **Vercelダッシュボードで「Add New...」→「Project」**

2. **「Import Git Repository」セクション**
   - GitHubリポジトリ一覧が表示される
   - `open-campus-system` を選択
   - 「Import」をクリック

3. **プロジェクト設定**
   ```
   Project Name: open-campus-system
   Framework Preset: Next.js （自動検出）
   Root Directory: ./ （デフォルト）
   Build Command: npm run build （デフォルト）
   Output Directory: .next （デフォルト）
   Install Command: npm install （デフォルト）
   ```

4. **環境変数の設定**
   - 「Environment Variables」セクションを展開
   - `.env.local` の内容をすべて追加:

   ```
   Name: NEXT_PUBLIC_SUPABASE_URL
   Value: https://xxxxxxxxxxxxx.supabase.co
   
   Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   
   Name: SUPABASE_SERVICE_ROLE_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   
   Name: LINE_CHANNEL_ACCESS_TOKEN
   Value: （あなたのトークン）
   
   Name: LINE_CHANNEL_SECRET
   Value: （あなたのシークレット）
   
   Name: LINE_BOT_BASIC_ID
   Value: @xxxxx
   
   Name: TOKEN_SECRET
   Value: （あなたのトークンシークレット）
   
   Name: NEXT_PUBLIC_ADMIN_PASSWORD
   Value: （管理画面のパスワード - 本番用に変更）
   ```

   ⚠️ **重要**: `NEXT_PUBLIC_APP_URL` は設定しない
   （Vercelが自動的に本番URLを使用）

5. **「Deploy」をクリック**
   - ビルドプロセスが開始
   - 2-3分でデプロイ完了

---

### Step 4: デプロイ完了後の確認（5分）

1. **デプロイ成功メッセージを確認**
   - 「Congratulations!」と表示
   - 本番URL: `https://open-campus-system.vercel.app`
   - または: `https://プロジェクト名-ユーザー名.vercel.app`

2. **本番サイトにアクセス**
   - 「Visit」ボタンをクリック
   - サイトが正常に表示されるか確認

3. **動作確認**
   - 申込フォームが表示される
   - コース一覧が取得できる
   - 開催日程が表示される
   - 管理画面にログインできる

---

### Step 5: LINE Webhook URLの更新（3分）

1. **LINE Developers Console にアクセス**
   - https://developers.line.biz/console/

2. **チャネルを選択**
   - オープンキャンパス用のチャネルを選択

3. **「Messaging API設定」タブを開く**

4. **Webhook URL を更新**
   ```
   旧: http://localhost:3000/api/line/webhook
   新: https://open-campus-system.vercel.app/api/line/webhook
   ```

5. **「Update」→「Verify」でテスト**
   - 「Success」と表示されればOK

6. **Webhook の利用を「オン」に設定**

---

### Step 6: 本番環境のテスト（10分）

1. **申込フォームのテスト**
   - 実際に申込を実行
   - データがSupabaseに保存されるか確認

2. **LINE連携のテスト**
   - LINE友達登録URLをクリック
   - Webhookが正常に動作するか確認
   - 申込完了メッセージが届くか確認

3. **管理画面のテスト**
   - ログインできるか
   - 申込者一覧が表示されるか
   - CSVエクスポートが動作するか

---

### ✅ Vercelデプロイ完了チェックリスト

```
□ Vercelアカウント作成完了
□ GitHubリポジトリとの連携完了
□ 環境変数設定完了
□ デプロイ成功
□ 本番サイトアクセス確認
□ LINE Webhook URL更新完了
□ 申込フォーム動作確認
□ LINE連携動作確認
□ 管理画面動作確認
```

---

## 🚨 トラブルシューティング

### Supabase関連

**問題: 「Connection error」が表示される**
→ `.env.local` の環境変数を確認
→ 開発サーバーを再起動

**問題: テーブルが作成できない**
→ SQLエラーメッセージを確認
→ 既存のテーブルを削除してから再実行

**問題: API キーが表示されない**
→ プロジェクト作成が完了するまで待機（2-3分）
→ ページをリロード

---

### Vercel関連

**問題: ビルドエラーが発生**
→ ビルドログを確認
→ ローカルで `npm run build` が成功するか確認
→ 環境変数の設定漏れを確認

**問題: 環境変数が反映されない**
→ Vercelダッシュボードで再度設定を確認
→ 再デプロイを実行

**問題: LINE Webhookが動作しない**
→ Webhook URLが正しいか確認
→ Vercelのログを確認（Function Logs）
→ LINE Developersでエラーログを確認

---

## 📞 サポートリンク

- **Supabase ドキュメント**: https://supabase.com/docs
- **Vercel ドキュメント**: https://vercel.com/docs
- **LINE Messaging API**: https://developers.line.biz/ja/docs/messaging-api/

---

作成日: 2025年11月9日
最終更新: 2025年11月9日
