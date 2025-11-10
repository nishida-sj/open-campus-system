# オープンキャンパス申込管理システム

高等学校・専門学校向けのオープンキャンパス申込管理システムです。
申込フォーム、LINE連携、管理ダッシュボードを備えた完全なWebアプリケーションです。

## 🎯 主要機能

### ユーザー向け機能
- **申込フォーム**: レスポンシブデザインの13フィールド入力フォーム
- **LINE連携**: 友達追加による申込完了通知
- **申込完了ページ**: 30分タイマー付きLINE登録導線

### 管理者向け機能
- **統計ダッシュボード**: 申込状況の可視化
- **申込者一覧**: 詳細な申込情報の表示
- **CSVエクスポート**: Excel対応のBOM付きUTF-8形式
- **開催日程管理**: プログレスバー付き日程一覧

## 🛠️ 技術スタック

- **フロントエンド**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **バックエンド**: Next.js API Routes
- **データベース**: Supabase (PostgreSQL)
- **認証・通知**: LINE Messaging API
- **デプロイ**: Vercel
- **バリデーション**: Zod
- **日付処理**: date-fns

## 📋 必要な環境・アカウント

1. **Node.js** v18以上
2. **Supabaseアカウント** (https://supabase.com)
3. **LINE Developersアカウント** (https://developers.line.biz)
4. **Vercelアカウント** (https://vercel.com) - デプロイ用

## 🚀 セットアップ手順

### 1. リポジトリのクローン

```bash
git clone <your-repository-url>
cd open-campus-system
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. Supabaseプロジェクトの作成

1. https://app.supabase.com にアクセス
2. 新しいプロジェクトを作成
3. プロジェクトのURLとAPIキーを取得

### 4. データベーステーブルの作成

Supabaseの「SQL Editor」で以下のSQLを実行：

#### テーブル作成SQL

```sql
-- 開催日程テーブル
CREATE TABLE open_campus_dates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  capacity INTEGER NOT NULL,
  current_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- コース・学科テーブル
CREATE TABLE courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  description TEXT,
  capacity_per_day INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 申込者テーブル
CREATE TABLE applicants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  kana_name VARCHAR(100),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  school_name VARCHAR(200) NOT NULL,
  school_type VARCHAR(50),
  grade VARCHAR(50) NOT NULL,
  graduation_year INTEGER,
  postal_code VARCHAR(10),
  prefecture VARCHAR(20),
  address TEXT,
  guardian_name VARCHAR(100),
  guardian_phone VARCHAR(20),
  guardian_attendance BOOLEAN DEFAULT FALSE,
  interested_course_id UUID REFERENCES courses(id),
  visit_date_id UUID NOT NULL REFERENCES open_campus_dates(id),
  remarks TEXT,
  token VARCHAR(64),
  token_expires_at TIMESTAMP,
  line_user_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 申込ログテーブル
CREATE TABLE application_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  applicant_id UUID REFERENCES applicants(id),
  action VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX idx_applicants_visit_date_id ON applicants(visit_date_id);
CREATE INDEX idx_applicants_email_visit_date ON applicants(email, visit_date_id);

-- RPC関数作成
CREATE OR REPLACE FUNCTION increment_visit_count(date_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE open_campus_dates
  SET current_count = current_count + 1,
      updated_at = NOW()
  WHERE id = date_id;
END;
$$;
```

#### サンプルデータ投入（オプション）

```sql
-- コースのサンプルデータ
INSERT INTO courses (name, category, description, display_order, is_active)
VALUES
  ('普通科', '普通科', '大学進学を目指す総合的なカリキュラム', 1, true),
  ('美容科', '専門科', 'ヘアメイク・ネイル・エステの実践技術', 2, true),
  ('調理科', '専門科', '和洋中の調理技術と食品衛生', 3, true),
  ('情報処理科', '専門科', 'プログラミング・Web制作・システム開発', 4, true);

-- 開催日程のサンプルデータ
INSERT INTO open_campus_dates (date, capacity, current_count, is_active)
VALUES
  ('2025-12-15', 100, 0, true),
  ('2025-12-22', 100, 0, true),
  ('2026-01-12', 100, 0, true),
  ('2026-01-26', 100, 0, true);
```

### 5. LINE Messaging APIの設定

1. https://developers.line.biz/console/ にアクセス
2. 新しいプロバイダーとチャネル（Messaging API）を作成
3. 以下の情報を取得：
   - Channel Access Token
   - Channel Secret
   - Bot Basic ID

### 6. 環境変数の設定

`.env.local` ファイルを作成し、以下の環境変数を設定：

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=your-channel-access-token
LINE_CHANNEL_SECRET=your-channel-secret
NEXT_PUBLIC_LINE_BOT_BASIC_ID=@your-bot-id

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
TOKEN_SECRET=your-random-secret-key-32-chars-or-more
NEXT_PUBLIC_ADMIN_PASSWORD=your-secure-password
```

**TOKEN_SECRETの生成方法:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 7. ローカル開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 にアクセスして動作確認

## 📱 LINE Webhook設定（本番環境）

### ngrokを使用する場合（開発・テスト）

1. ngrokのインストール: https://ngrok.com/download
2. ngrokの起動:
```bash
ngrok http 3000
```
3. 表示されたHTTPS URLをコピー（例: https://xxxx.ngrok.io）
4. LINE Developers Console > Webhook設定 > Webhook URLに設定:
   ```
   https://xxxx.ngrok.io/api/line/webhook
   ```
5. Webhookの利用を「オン」にする

### Vercel使用時（本番環境）

1. デプロイ後のVercel URLを使用
2. LINE Developers Console > Webhook設定:
   ```
   https://your-app.vercel.app/api/line/webhook
   ```

## 🚢 Vercelへのデプロイ

### 1. GitHubリポジトリの作成

```bash
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Vercelでのデプロイ

1. https://vercel.com にアクセスしてログイン
2. 「New Project」をクリック
3. GitHubリポジトリを選択
4. 環境変数を設定（.env.localの内容をコピー）
   - `NEXT_PUBLIC_APP_URL` は Vercel URL に変更
5. 「Deploy」をクリック

### 3. デプロイ後の設定

1. Vercelから割り当てられたURLを確認
2. LINE Developers ConsoleのWebhook URLを更新
3. Supabase等の設定でVercel URLを許可

## 📂 プロジェクト構造

```
open-campus-system/
├── app/
│   ├── api/              # APIエンドポイント
│   ├── admin/            # 管理画面
│   ├── apply/            # 申込フォーム
│   └── test/             # テストページ
├── lib/                  # ユーティリティ
├── types/                # TypeScript型定義
├── docs/                 # ドキュメント
└── public/               # 静的ファイル
```

## 🔒 セキュリティ注意事項

### 本番環境での推奨事項

1. **認証システムの強化**
   - 現在の管理画面認証は簡易版
   - NextAuth.js等の本格的な認証システムへの移行を推奨

2. **環境変数の管理**
   - `.env.local`を絶対にGitにコミットしない
   - 本番環境ではVercelの環境変数機能を使用

3. **HTTPS必須**
   - 本番環境では必ずHTTPSを使用

4. **定期的なセキュリティアップデート**
   ```bash
   npm audit
   npm audit fix
   ```

## 🔧 管理画面の使用方法

### ログイン
- URL: `/admin/login`
- パスワード: `.env.local`の`NEXT_PUBLIC_ADMIN_PASSWORD`

### ダッシュボード
- URL: `/admin/dashboard`
- 統計情報、申込者一覧、CSVエクスポートが利用可能

### 開催日程の追加

現在はSupabaseダッシュボードから直接追加：

1. Supabase > Table Editor > `open_campus_dates`
2. 「Insert row」で新規追加

または、SQL Editorで実行：
```sql
INSERT INTO open_campus_dates (date, capacity, current_count, is_active)
VALUES ('2026-03-15', 100, 0, true);
```

## 🧪 テスト

### APIテストページ
- URL: `/test`
- 各APIエンドポイントの動作確認が可能

## 📊 データベース管理

### 申込者データのエクスポート
管理ダッシュボードから「CSVエクスポート」ボタンでダウンロード

### バックアップ
Supabaseの自動バックアップ機能を有効化推奨

## 🐛 トラブルシューティング

### ビルドエラー
```bash
npm run build
```
でエラーがないか確認

### 環境変数が読み込めない
- `.env.local`のファイル名を確認
- 開発サーバーを再起動

### LINEメッセージが届かない
- Webhook URLが正しく設定されているか確認
- LINE Developers ConsoleでWebhookが「オン」になっているか確認
- サーバーログでエラーを確認

## 📚 ドキュメント

詳細なドキュメントは`docs/`ディレクトリを参照：

- `SETUP_STATUS.md` - セットアップ状況
- `PROJECT_COMPLETION_SUMMARY.md` - プロジェクト完成サマリー
- `SUPABASE_MIGRATION_GUIDE.md` - データベース移行ガイド
- `PHASE2_COMPLETION_SUMMARY.md` - 実装詳細

## 🤝 コントリビューション

バグ報告や機能提案は、GitHubのIssuesでお願いします。

## 📄 ライセンス

MIT License

## 👨‍💻 作成者

Mikio

## 🔗 関連リンク

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [LINE Messaging API Documentation](https://developers.line.biz/ja/docs/messaging-api/)
- [Vercel Documentation](https://vercel.com/docs)

---

**最終更新**: 2025年11月10日
**バージョン**: 1.0.0
**ステータス**: 本番デプロイ準備完了 ✅
t r i g g e r   r e d e p l o y  
 t r i g g e r   v e r c e l   b u i l d  
 