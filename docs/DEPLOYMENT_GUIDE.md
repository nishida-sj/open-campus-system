# デプロイガイド - Vercel本番環境

このガイドでは、オープンキャンパス申込管理システムをVercelにデプロイする手順を説明します。

## 📋 前提条件

以下のアカウントとサービスが準備済みであること：
- ✅ Supabaseプロジェクト（データベース構築済み）
- ✅ LINE Messaging APIチャネル（設定済み）
- ✅ GitHubアカウント
- ⏳ Vercelアカウント（これから作成）

---

## 🚀 デプロイ手順

### Step 1: GitHubリポジトリの作成

#### 1-1. GitHubで新しいリポジトリを作成

1. https://github.com にアクセス
2. 右上の「+」→「New repository」をクリック
3. リポジトリ情報を入力：
   - **Repository name**: `open-campus-system`（任意）
   - **Description**: `オープンキャンパス申込管理システム`
   - **Public/Private**: Privateを推奨（機密情報保護のため）
   - **Initialize this repository with**: チェックなし
4. 「Create repository」をクリック

#### 1-2. ローカルリポジトリをGitHubにプッシュ

プロジェクトディレクトリで以下のコマンドを実行：

```bash
# 現在のGit状態を確認
git status

# 全ファイルをステージング
git add .

# コミット
git commit -m "Initial commit: Complete open campus application system"

# メインブランチに変更（必要な場合）
git branch -M main

# GitHubリポジトリをリモートに追加
git remote add origin https://github.com/YOUR_USERNAME/open-campus-system.git

# プッシュ
git push -u origin main
```

**⚠️ 重要**: .env.localがGitにコミットされていないことを確認
```bash
# .env.localが含まれていないことを確認
git ls-files | grep .env.local
# 何も表示されなければOK
```

---

### Step 2: Vercelアカウントの作成とプロジェクトインポート

#### 2-1. Vercelアカウント作成

1. https://vercel.com にアクセス
2. 「Sign Up」をクリック
3. **GitHubアカウントで連携**を選択（推奨）
4. GitHubとの連携を許可

#### 2-2. 新しいプロジェクトをインポート

1. Vercelダッシュボードで「Add New」→「Project」をクリック
2. 「Import Git Repository」セクションで、先ほど作成したGitHubリポジトリを選択
3. 「Import」をクリック

#### 2-3. プロジェクト設定

**Configure Project画面で以下を設定：**

1. **Framework Preset**: Next.js（自動検出されるはず）
2. **Root Directory**: ./ （デフォルト）
3. **Build and Output Settings**: デフォルトのまま
4. **Environment Variables（環境変数）**: 後で設定

一旦「Deploy」をクリック（環境変数は後から追加可能）

---

### Step 3: 環境変数の設定

#### 3-1. デプロイ後の環境変数追加

1. Vercelダッシュボード > プロジェクト > 「Settings」タブ
2. 左サイドバーから「Environment Variables」を選択
3. 以下の環境変数を1つずつ追加：

#### 追加する環境変数

**Supabase:**
```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://your-project.supabase.co
Environment: Production, Preview, Development
```

```
Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: your-anon-key
Environment: Production, Preview, Development
```

```
Name: SUPABASE_SERVICE_ROLE_KEY
Value: your-service-role-key
Environment: Production, Preview, Development
```

**LINE Messaging API:**
```
Name: LINE_CHANNEL_ACCESS_TOKEN
Value: your-channel-access-token
Environment: Production, Preview, Development
```

```
Name: LINE_CHANNEL_SECRET
Value: your-channel-secret
Environment: Production, Preview, Development
```

```
Name: NEXT_PUBLIC_LINE_BOT_BASIC_ID
Value: @your-bot-id
Environment: Production, Preview, Development
```

**Application:**
```
Name: NEXT_PUBLIC_APP_URL
Value: https://your-app.vercel.app （VercelのURL）
Environment: Production, Preview, Development
```

```
Name: TOKEN_SECRET
Value: your-random-secret-key（.env.localと同じもの）
Environment: Production, Preview, Development
```

```
Name: NEXT_PUBLIC_ADMIN_PASSWORD
Value: your-secure-password（本番用に変更推奨）
Environment: Production, Preview, Development
```

#### 3-2. 再デプロイ

環境変数を追加したら、再デプロイが必要です：

1. Vercelダッシュボード > プロジェクト > 「Deployments」タブ
2. 最新のデプロイメントの「...」メニュー > 「Redeploy」をクリック
3. 「Redeploy」を確認

---

### Step 4: Vercel URLの確認と設定更新

#### 4-1. Vercel URLを確認

デプロイ完了後、以下のようなURLが割り当てられます：
```
https://your-app.vercel.app
```

または

```
https://your-app-xxxx.vercel.app
```

#### 4-2. NEXT_PUBLIC_APP_URLの更新

1. Vercel > Settings > Environment Variables
2. `NEXT_PUBLIC_APP_URL` の値を実際のVercel URLに更新
3. 再度「Redeploy」を実行

---

### Step 5: LINE Webhook URLの設定

#### 5-1. LINE Developers Consoleでの設定

1. https://developers.line.biz/console/ にログイン
2. 対象のプロバイダー > チャネルを選択
3. 「Messaging API設定」タブを開く
4. **Webhook URL**を設定：
   ```
   https://your-app.vercel.app/api/line/webhook
   ```
5. 「Webhookの利用」を**オン**にする
6. 「検証」ボタンをクリックして接続確認

#### 5-2. Webhook検証

検証が成功すれば、LINE連携の準備完了です。

---

### Step 6: 動作確認

#### 6-1. 申込フォームのテスト

1. ブラウザで `https://your-app.vercel.app/apply` にアクセス
2. テスト申込を実行
3. 申込完了ページが表示されることを確認

#### 6-2. LINE連携のテスト

1. LINE公式アカウントを友達追加
2. ウェルカムメッセージが届くことを確認
3. 申込番号（token）を送信
4. 申込完了メッセージが届くことを確認

#### 6-3. 管理画面のテスト

1. `https://your-app.vercel.app/admin/login` にアクセス
2. パスワードでログイン
3. ダッシュボードで申込者が表示されることを確認
4. CSVエクスポートが動作することを確認

---

## 🔧 トラブルシューティング

### デプロイが失敗する

**確認事項:**
- ビルドエラーがないか確認: `npm run build`
- package.jsonの記述が正しいか確認
- Next.jsのバージョンが16以上か確認

**解決方法:**
- Vercelのビルドログを確認
- ローカルで `npm run build` が成功するか確認

### 環境変数が読み込めない

**確認事項:**
- 環境変数名が正確か（大文字小文字区別）
- `NEXT_PUBLIC_`プレフィックスが必要な変数か確認
- 再デプロイを実行したか

**解決方法:**
- Vercel Settings > Environment Variables で再確認
- 再デプロイを実行

### LINE Webhookが動作しない

**確認事項:**
- Webhook URLが正確か（/api/line/webhook まで含む）
- Webhookの利用が「オン」になっているか
- HTTPSで接続されているか

**解決方法:**
- LINE Developers ConsoleでWebhook検証を実行
- Vercelのファンクションログを確認

### データベース接続エラー

**確認事項:**
- Supabaseの環境変数が正確か
- SupabaseプロジェクトがアクティブかSupabase

### 管理画面にログインできない

**確認事項:**
- `NEXT_PUBLIC_ADMIN_PASSWORD`が正しく設定されているか
- ブラウザのキャッシュをクリア

---

## 🎯 デプロイ後のチェックリスト

デプロイ完了後、以下を確認してください：

- [ ] Vercelデプロイ成功
- [ ] すべての環境変数が設定済み
- [ ] `NEXT_PUBLIC_APP_URL`がVercel URLに更新済み
- [ ] LINE Webhook URL設定完了
- [ ] LINE Webhook検証成功
- [ ] 申込フォーム動作確認
- [ ] LINE連携動作確認（友達追加→トークン送信→完了メッセージ）
- [ ] 管理画面ログイン確認
- [ ] 統計情報表示確認
- [ ] CSVエクスポート確認
- [ ] 本番用パスワードに変更（推奨）

---

## 🔐 セキュリティ強化（本番運用時の推奨事項）

### 1. 管理画面パスワードの変更

開発時の`admin123`から強固なパスワードに変更：

```bash
NEXT_PUBLIC_ADMIN_PASSWORD=your-very-secure-password-here
```

### 2. Supabase Row Level Security (RLS)の有効化

Supabaseダッシュボードで各テーブルのRLSを有効化し、適切なポリシーを設定。

### 3. CORS設定の確認

必要に応じて、APIエンドポイントにCORS設定を追加。

### 4. レート制限の実装

大量リクエスト対策として、Vercelのレート制限機能を検討。

---

## 📊 カスタムドメインの設定（オプション）

### 独自ドメインを使用する場合

1. Vercel > プロジェクト > Settings > Domains
2. 「Add Domain」をクリック
3. 所有するドメインを入力（例: open-campus.example.com）
4. DNS設定を行う（Vercelの指示に従う）
5. SSL証明書が自動発行される（数分）

カスタムドメイン設定後：
- `NEXT_PUBLIC_APP_URL`を独自ドメインに更新
- LINE Webhook URLも独自ドメインに更新

---

## 🔄 継続的なデプロイ（CI/CD）

Vercelは自動的にGitHubと連携しており、以下の動作をします：

- **mainブランチへのpush**: 本番環境に自動デプロイ
- **Pull Requestの作成**: プレビュー環境を自動作成
- **コミット毎**: ビルドとテストを実行

### デプロイフロー

```bash
# ローカルで開発
npm run dev

# 変更をコミット
git add .
git commit -m "Add new feature"

# GitHubにプッシュ
git push origin main

# Vercelが自動的にデプロイ開始
# 数分後、本番環境に反映
```

---

## 📞 サポート

### Vercelサポート
- ドキュメント: https://vercel.com/docs
- コミュニティ: https://github.com/vercel/vercel/discussions

### Supabaseサポート
- ドキュメント: https://supabase.com/docs
- Discord: https://discord.supabase.com

### LINEサポート
- ドキュメント: https://developers.line.biz/ja/docs/
- FAQ: https://developers.line.biz/ja/faq/

---

**作成日**: 2025年11月10日
**最終更新**: 2025年11月10日
**ステータス**: 本番デプロイ準備完了 ✅
