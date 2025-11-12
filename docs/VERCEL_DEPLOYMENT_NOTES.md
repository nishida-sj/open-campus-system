# Vercel デプロイメント設定 - 重要な注意点

このドキュメントは、LINE Webhook連携を含むNext.jsアプリケーションをVercelにデプロイする際の**必須設定と注意点**をまとめたものです。

---

## 🚨 最重要：Deployment Protection の無効化

### 問題

Vercelはデフォルトで「**Deployment Protection（デプロイメント保護）**」を有効にする場合があります。これが有効になっていると：

- ✅ ブラウザアクセス → Vercelログインページにリダイレクト → 認証後にアクセス可能
- ❌ **外部API（LINE Webhook等）からのリクエスト → 401 Unauthorized エラー**

### 症状

- LINE Webhook検証が失敗（401 Unauthorized）
- ログが全く出力されない（リクエストがアプリケーションに到達していない）
- ブラウザでアクセスすると認証ページが表示される

### 解決方法

#### 1. Vercel Dashboardにアクセス

```
https://vercel.com/dashboard
```

#### 2. プロジェクトを選択

対象のプロジェクト（例：`open-campus-system`）をクリック

#### 3. Settings > Deployment Protection

1. 上部メニュー「**Settings**」をクリック
2. 左サイドバー「**Deployment Protection**」を選択

#### 4. 認証保護を無効化

以下のいずれかの設定に変更：

**オプション1: 完全に無効化（推奨）**
```
Protection Level: Standard Protection
→ すべての認証を無効化
```

**オプション2: 特定の環境のみ無効化**
```
Production: Disabled
Preview: Disabled または Enabled（お好みで）
Development: Disabled
```

#### 5. 保存して再デプロイ

設定を保存したら、**必ず再デプロイ**が必要です：

```bash
# 空コミットで再デプロイをトリガー
git commit --allow-empty -m "Apply Deployment Protection settings"
git push origin main
```

---

## 📋 環境変数の設定

### 必須環境変数

以下の環境変数を**すべての環境（Production, Preview, Development）**に設定してください。

#### Supabase

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

#### LINE Messaging API

```bash
LINE_CHANNEL_ACCESS_TOKEN=your-channel-access-token
LINE_CHANNEL_SECRET=your-channel-secret
LINE_BOT_BASIC_ID=@your-bot-id
```

#### Application

```bash
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
TOKEN_SECRET=your-random-secret-32-chars-or-more
NEXT_PUBLIC_ADMIN_PASSWORD=your-secure-password
```

### メール配信機能について（重要な変更）

**2025年11月12日更新**: メール配信機能は**データベースのSMTP設定を使用**するように変更されました。

#### 不要になった環境変数

以下の環境変数は**設定不要**です（設定されていても無視されます）：

```bash
# ❌ これらは不要になりました
RESEND_API_KEY=（不要）
EMAIL_FROM=（不要）
```

#### メール送信の設定方法

1. **管理画面のメール設定ページで設定**
   ```
   https://your-app.vercel.app/admin/email-settings
   ```

2. **必要な情報**
   - SMTP Host（例: smtp.gmail.com）
   - SMTP Port（例: 587 または 465）
   - SMTPユーザー名（メールアドレス）
   - SMTPパスワード（アプリパスワード推奨）
   - 送信元メールアドレス
   - 送信者名（オプション）

3. **メール配信機能が利用可能に**
   - メッセージ配信ページ（`/admin/broadcast`）で使用
   - 設定したSMTP情報で自動的に送信

#### Gmail使用時の注意点

Gmailを使用する場合：

1. **アプリパスワードの生成が必要**
   - Googleアカウント → セキュリティ → 2段階認証を有効化
   - アプリパスワードを生成
   - 生成されたパスワードをSMTPパスワードとして使用

2. **SMTP設定例**
   ```
   SMTP Host: smtp.gmail.com
   SMTP Port: 587
   TLS使用: ON
   ユーザー名: your-email@gmail.com
   パスワード: [生成したアプリパスワード]
   ```

### 設定方法

1. Vercel Dashboard > プロジェクト > **Settings** > **Environment Variables**
2. 各変数を追加し、**Environment** で `Production`, `Preview`, `Development` をすべて選択
3. **Save** をクリック
4. 環境変数追加後は**必ず再デプロイ**

```bash
git commit --allow-empty -m "Update environment variables"
git push origin main
```

---

## 🔧 Next.js Route Handler の設定

### Webhook エンドポイントに必要な設定

`app/api/line/webhook/route.ts` のような外部APIからリクエストを受けるエンドポイントには、以下の設定が必要です：

```typescript
// Node.js Runtimeを使用（console.logとcryptoモジュールのため）
export const runtime = 'nodejs';

// キャッシュを無効化（Webhookは常に最新のレスポンスを返す必要がある）
export const dynamic = 'force-dynamic';

// 常に最新のレスポンスを返す
export const revalidate = 0;
```

### 理由

- **`runtime = 'nodejs'`**: Edge Runtimeではなく、Node.js環境で実行（crypto, console.logなどが必要なため）
- **`dynamic = 'force-dynamic'`**: Vercelのキャッシュを無効化（Webhookは毎回異なるリクエスト）
- **`revalidate = 0`**: レスポンスを常に最新に保つ

---

## 🌐 Webhook URL の管理

### URLの形式

Vercelは各デプロイメントに一意のURLを割り当てます：

```
https://your-app-xxxxx-your-team.vercel.app
                ↑
            デプロイメントごとに変わる
```

### 固定URLを使用する方法

**方法1: Production Domain を使用（推奨）**

Vercelは自動的にプロダクションドメインを割り当てます：

```
https://your-app.vercel.app （変わらない）
```

LINE Webhook URLには**このプロダクションドメイン**を設定することを推奨します。

**設定手順：**
1. Vercel Dashboard > プロジェクト > **Settings** > **Domains**
2. プロダクションドメイン（`.vercel.app`）を確認
3. LINE Developers ConsoleのWebhook URLに設定：
   ```
   https://your-app.vercel.app/api/line/webhook
   ```

**方法2: カスタムドメインを設定**

独自ドメインを使用する場合：

1. Vercel Dashboard > プロジェクト > **Settings** > **Domains**
2. **Add Domain** をクリック
3. 独自ドメイン（例：`api.example.com`）を追加
4. DNS設定を行う（Vercelの指示に従う）
5. SSL証明書が自動発行される（数分）
6. LINE Webhook URLに設定：
   ```
   https://api.example.com/api/line/webhook
   ```

---

## ⚠️ トラブルシューティング

### 1. Webhook検証が401エラーになる

**原因：**
- Deployment Protectionが有効になっている
- 環境変数が設定されていない
- 署名検証に失敗している

**確認方法：**

```bash
# curlでPOSTリクエストをテスト
curl -X POST "https://your-app.vercel.app/api/line/webhook" \
  -H "Content-Type: application/json" \
  -H "x-line-signature: test" \
  -d '{"events":[]}'
```

**期待される結果：**
- Deployment Protectionが有効 → HTMLページ（認証要求）が返る
- Deployment Protectionが無効 → JSONレスポンスが返る

### 2. ログが表示されない

**原因：**
- Deployment Protectionでリクエストがブロックされている
- `runtime = 'nodejs'` が設定されていない
- Edge Runtimeで実行されている

**確認方法：**

Vercel Dashboard > プロジェクト > **Logs** または **Functions** タブでログを確認

### 3. 環境変数が読み込めない

**原因：**
- 環境変数の設定後に再デプロイしていない
- 環境変数名が間違っている（大文字小文字を区別）

**解決方法：**

```bash
# Vercelの環境変数を確認
npx vercel env ls

# ローカルに環境変数をダウンロード（確認用）
npx vercel env pull .env.vercel

# 環境変数設定後は必ず再デプロイ
git commit --allow-empty -m "Update environment variables"
git push origin main
```

---

## 📊 デプロイメントの確認

### 最新のデプロイメントURL確認

```bash
# 最新のデプロイメント一覧
npx vercel ls

# プロダクションデプロイメントのみ
npx vercel ls --prod
```

### デプロイメント状態の確認

Vercel Dashboard > プロジェクト > **Deployments**

- ✅ **Ready**: デプロイメント成功
- ❌ **Error**: デプロイメント失敗（ログを確認）
- 🔄 **Building**: ビルド中

---

## 🔒 セキュリティ設定

### 本番環境での推奨設定

#### 1. 環境変数の管理

- `.env.local` は絶対にGitにコミットしない
- 本番環境の環境変数はVercelで管理
- `TOKEN_SECRET` は必ず32文字以上のランダムな文字列

```bash
# TOKEN_SECRETの生成方法
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 2. HTTPS必須

Vercelは自動的にHTTPSを提供しますが、以下を確認：

- Webhook URLは必ず `https://` で始まる
- カスタムドメインを使用する場合もHTTPS必須

#### 3. CORS設定（必要に応じて）

APIエンドポイントで特定のドメインからのみアクセスを許可する場合：

```typescript
// app/api/your-endpoint/route.ts
export async function POST(request: Request) {
  const origin = request.headers.get('origin');

  // 許可するドメインのリスト
  const allowedOrigins = ['https://your-frontend.vercel.app'];

  if (origin && !allowedOrigins.includes(origin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 処理を続ける...
}
```

---

## 📝 デプロイ前チェックリスト

デプロイ前に以下を確認してください：

- [ ] **Deployment Protection** が無効化されている
- [ ] すべての**環境変数**が設定されている（Production, Preview, Development）
  - Supabase（URL, ANON_KEY, SERVICE_ROLE_KEY）
  - LINE（ACCESS_TOKEN, SECRET, BASIC_ID）
  - Application（APP_URL, TOKEN_SECRET, ADMIN_PASSWORD）
  - ❌ RESEND_API_KEY, EMAIL_FROM は不要（削除してOK）
- [ ] `.env.local` が `.gitignore` に含まれている
- [ ] ローカルで `npm run build` が成功する
- [ ] Webhook エンドポイントに `runtime = 'nodejs'` が設定されている
- [ ] Webhook エンドポイントに `dynamic = 'force-dynamic'` が設定されている
- [ ] LINE Webhook URLが**プロダクションドメイン**を使用している

---

## 🎯 デプロイ後チェックリスト

デプロイ後に以下を確認してください：

- [ ] デプロイメントが **Ready** 状態になっている
- [ ] ブラウザで各ページにアクセスできる（認証ページが表示されない）
- [ ] Vercel Logs でログが表示される
- [ ] LINE Webhook検証が成功する
- [ ] 実際に申込フォームから申込ができる
- [ ] LINE連携が動作する（友達追加 → トークン送信 → 完了メッセージ）
- [ ] 管理画面にログインできる
- [ ] CSVエクスポートが動作する
- [ ] **メール設定ページ**（`/admin/email-settings`）でSMTP設定を登録
- [ ] テストメール送信が成功する
- [ ] メッセージ配信機能でメール送信が成功する

---

## 🔗 参考リンク

- [Vercel Deployment Protection ドキュメント](https://vercel.com/docs/security/deployment-protection)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [LINE Messaging API Webhook](https://developers.line.biz/ja/docs/messaging-api/receiving-messages/)

---

## 📞 トラブル時の連絡先

問題が発生した場合：

1. Vercelのログを確認（Dashboard > Logs）
2. LINE Developers Consoleのエラーメッセージを確認
3. このドキュメントのトラブルシューティングセクションを参照

---

**最終更新**: 2025年11月12日
**作成者**: Claude Code
**バージョン**: 1.1.0
**ステータス**: メール配信機能追加・SMTP統合完了 ✅
