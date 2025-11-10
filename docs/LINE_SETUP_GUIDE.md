# LINE Messaging API 設定ガイド

## 📋 現在の状況
- ✅ LINEビジネスアカウント作成済み
- ❌ Messaging APIチャネル未作成
- ❌ 環境変数未設定

---

## 🎯 この設定で必要なもの

LINEビジネスアカウントから以下の3つの情報を取得します：

1. **Channel Access Token** (長期) - LINE APIを呼び出すための認証トークン
2. **Channel Secret** - Webhookの署名検証用
3. **Basic ID** - LINE公式アカウントのID（@から始まる）

これらを `.env.local` に設定します。

---

## 📝 詳細手順

### Step 1: LINE Developersコンソールにアクセス（2分）

1. **LINE Developers Console を開く**
   - URL: https://developers.line.biz/console/
   - ブラウザで新しいタブで開く

2. **ログイン**
   - LINEビジネスアカウントでログイン
   - メールアドレスとパスワードを入力
   - または、LINEアプリでQRコードスキャン

3. **初回ログイン時の設定**
   - 開発者名（任意）を入力
   - メールアドレスを確認
   - 利用規約に同意

---

### Step 2: プロバイダーの作成または選択（3分）

**プロバイダーとは？**
- 複数のLINEチャネルをグループ化する単位
- 学校名や組織名で作成するのが一般的

#### 既存のプロバイダーがない場合：

1. **「Create」または「作成」ボタンをクリック**

2. **プロバイダー情報を入力**
   ```
   プロバイダー名: あなたの学校名または組織名
   例: ○○高等学校、△△専門学校
   ```

3. **「Create」をクリック**

#### 既存のプロバイダーがある場合：

1. 使用するプロバイダーを選択
2. そのままStep 3へ進む

---

### Step 3: Messaging APIチャネルの作成（5分）

1. **プロバイダーの画面で「Create a new channel」をクリック**

2. **チャネルタイプを選択**
   - 「Messaging API」を選択
   - （注意: LINE Loginではなく、Messaging API）

3. **チャネル情報を入力**

   ```
   【必須項目】
   
   Channel name（チャネル名）:
   → オープンキャンパス申込システム
   
   Channel description（チャネル説明）:
   → オープンキャンパスの申込受付と情報配信を行うシステムです
   
   Category（大業種）:
   → 教育
   
   Subcategory（小業種）:
   → 学校教育
   
   Email address（メールアドレス）:
   → あなたのメールアドレス
   （通知を受け取るアドレス）
   ```

4. **任意項目（スキップ可能）**
   ```
   Privacy policy URL（プライバシーポリシーURL）:
   → 後で設定可能（今は空欄でOK）
   
   Terms of use URL（利用規約URL）:
   → 後で設定可能（今は空欄でOK）
   ```

5. **利用規約への同意**
   - LINE Official Account Terms of Use: ✅ チェック
   - LINE Official Account API Terms of Use: ✅ チェック

6. **「Create」ボタンをクリック**
   - チャネルが作成されます（数秒）

---

### Step 4: Channel Access Token（長期）の発行（3分）

1. **作成したチャネルをクリック**
   - チャネル一覧から「オープンキャンパス申込システム」を選択

2. **「Messaging API」タブを選択**
   - 上部のタブから選択

3. **画面を下にスクロール**
   - "Channel access token (long-lived)" セクションを探す

4. **「Issue」ボタンをクリック**
   - トークンが生成されます
   - ⚠️ このトークンは一度しか表示されません！

5. **トークンをコピー**
   ```
   表示されたトークン例:
   eyJhbGciOiJIUzI1NiJ9.abcdefghijklmnopqrstuvwxyz...（長い文字列）
   ```
   - 「Copy」ボタンでコピー
   - メモ帳などに一時保存

6. **⚠️ 重要な注意事項**
   ```
   このトークンは：
   - 絶対に他人に見せない
   - GitHubにコミットしない
   - 安全な場所に保管
   - 漏洩した場合は再発行が必要
   ```

---

### Step 5: Channel Secret の取得（2分）

1. **「Basic settings」タブを選択**
   - 上部のタブから選択

2. **"Channel secret" セクションを探す**
   - ページ上部にあります

3. **Channel Secretをコピー**
   ```
   表示例:
   a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
   ```
   - 32文字の英数字
   - そのままコピー

---

### Step 6: Basic ID の確認（1分）

1. **「Messaging API」タブに戻る**

2. **"Bot information" セクションを探す**
   - ページ上部にあります

3. **Basic ID を確認**
   ```
   表示例:
   @123abcde
   ```
   - @から始まる9文字程度の文字列
   - これをコピー

---

### Step 7: .env.local ファイルの更新（3分）

`D:\LINE\open-campus-system\.env.local` を開いて更新：

```bash
# Supabase - 後で設定（Supabaseアカウント作成後）
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# LINE - ✅ ここを設定
LINE_CHANNEL_ACCESS_TOKEN=取得したChannel Access Tokenをここに貼り付け
LINE_CHANNEL_SECRET=取得したChannel Secretをここに貼り付け
LINE_BOT_BASIC_ID=取得したBasic IDをここに貼り付け（@を含む）

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
TOKEN_SECRET=既存の値をそのまま
NEXT_PUBLIC_ADMIN_PASSWORD=admin123
```

**記入例:**
```bash
LINE_CHANNEL_ACCESS_TOKEN=eyJhbGciOiJIUzI1NiJ9.abcdefghijklmnopqrstuvwxyz1234567890...
LINE_CHANNEL_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
LINE_BOT_BASIC_ID=@123abcde
```

**保存して閉じる**

---

### Step 8: LINE Bot の基本設定（5分）

#### 8-1. 応答メッセージの設定

1. **「Messaging API」タブの中の「LINE Official Account features」を確認**

2. **以下のように設定:**
   ```
   Auto-reply messages（自動応答メッセージ）:
   → Disabled（無効）
   
   Greeting messages（あいさつメッセージ）:
   → Enabled（有効）※カスタマイズ可能
   ```

3. **「Edit」リンクをクリック**
   - LINE Official Account Manager が新しいタブで開く

#### 8-2. LINE Official Account Manager での設定

1. **左サイドバーから「応答設定」を選択**

2. **以下のように設定:**
   ```
   応答メッセージ: オフ（❌）
   → Webhookで制御するため
   
   あいさつメッセージ: オン（✅）
   → 任意でカスタマイズ可能
   
   Webhook: オフのまま（❌）
   → ⚠️ Webhook URLを設定するまでオンにできません
   → Step 9で設定します
   ```

3. **設定を保存**

**注意:** 
- Webhookの設定は後で行います（Step 9）
- 現時点ではオフのままで問題ありません

#### 8-3. あいさつメッセージのカスタマイズ（任意）

1. **「あいさつメッセージ」の「編集」をクリック**

2. **メッセージ内容を編集:**
   ```
   推奨メッセージ例:
   
   ご登録ありがとうございます！
   
   こちらは○○高等学校（または専門学校）のオープンキャンパス申込アカウントです。
   
   申込完了の通知や、イベント情報をお届けします。
   
   ご不明な点がございましたら、お気軽にメッセージをお送りください。
   ```

3. **「保存」をクリック**

---

### Step 9: Webhook設定（ローカル開発時または本番デプロイ後）

⚠️ **この設定は2つのタイミングで実施可能です:**

#### パターンA: ローカル開発時（ngrok使用）- 今すぐテストしたい場合

1. **開発サーバーを起動**
   ```bash
   cd D:\LINE\open-campus-system
   npm run dev
   ```

2. **ngrokをインストール（初回のみ）**
   - URL: https://ngrok.com/
   - アカウント作成（無料）
   - ダウンロードして任意の場所に配置

3. **ngrokを起動（新しいターミナル）**
   ```bash
   ngrok http 3000
   ```

4. **ngrokのURLをコピー**
   ```
   表示例:
   Forwarding: https://abc123.ngrok-free.app -> http://localhost:3000
                ↑このURLをコピー
   ```

5. **LINE Developersコンソールに戻る**
   - 「Messaging API」タブを開く
   - "Webhook settings" セクションを探す

6. **Webhook URL を設定**
   ```
   Webhook URL: https://abc123.ngrok-free.app/api/line/webhook
   ```
   - ngrokのURL + `/api/line/webhook`
   - 「Update」をクリック

7. **「Verify」ボタンをクリック**
   - ⚠️ まだAPIエンドポイントを実装していない場合はエラーになります
   - エラーが出ても問題ありません（後で実装します）

8. **「Use webhook」をオンに設定**
   - トグルスイッチをオン（✅）に変更

9. **LINE Official Account Managerでも確認**
   - 「応答設定」を開く
   - Webhookが「オン」になっていることを確認

**ngrok使用時の注意:**
- ngrokは無料版だとセッション終了でURLが変わります
- 開発のたびにWebhook URLを更新する必要があります
- あくまでローカル開発時のテスト用です

---

#### パターンB: 本番デプロイ後 - 推奨

**このタイミング:**
- Vercelへのデプロイが完了した後
- 本番URLが確定してから

**設定手順:**

1. **LINE Developersコンソールで「Messaging API」タブを開く**

2. **"Webhook settings" セクションを確認**

3. **Webhook URL を設定**
   ```
   Webhook URL: https://your-app.vercel.app/api/line/webhook
   ```
   - Vercelの本番URL + `/api/line/webhook`
   - 「Update」をクリック

4. **「Verify」ボタンでテスト**
   - 「Success」と表示されればOK

5. **「Use webhook」をオンに設定**
   - トグルスイッチをオン（✅）に変更

---

#### どちらを選ぶべきか？

**パターンA（ngrok）を選ぶ場合:**
- ✅ すぐにLINE連携をテストしたい
- ✅ ローカルでデバッグしながら開発したい
- ❌ 毎回URL更新が面倒

**パターンB（Vercel後）を選ぶ場合:** ← **推奨**
- ✅ 手間が少ない（一度設定すれば終わり）
- ✅ 本番環境で確実に動作確認できる
- ❌ 最初のテストまで時間がかかる

**推奨:** 
まずはWebhook設定をスキップして開発を進め、
Vercelデプロイ後に設定するのが効率的です。

---

### Step 10: 動作確認（2分）

1. **QRコードを表示**
   - LINE Official Account Manager の画面上部
   - 「友だち追加」→「QRコード」

2. **自分のLINEアプリでQRコードをスキャン**
   - 友だち追加画面が表示される
   - 「追加」をタップ

3. **あいさつメッセージが届くか確認**
   - カスタマイズしたメッセージが表示される
   - これで基本設定は完了！

---

## ✅ LINE設定完了チェックリスト

```
【必須項目】
□ LINE Developersコンソールにログイン完了
□ プロバイダー作成完了
□ Messaging APIチャネル作成完了
□ Channel Access Token（長期）取得完了
□ Channel Secret 取得完了
□ Basic ID 確認完了
□ .env.local に3つの情報を設定完了
□ 応答メッセージを無効化
□ あいさつメッセージを有効化（任意でカスタマイズ）
□ 自分のLINEアプリで友だち追加テスト完了

【任意項目 - 後で設定可能】
□ Webhook URL設定（ローカル開発時: ngrok使用）
□ Webhook URL設定（本番環境: Vercelデプロイ後）
□ Webhookを「オン」に設定
```

---

## 🎯 次のステップ

LINE設定が完了したら：

1. **Supabaseアカウントの作成**
   - `ACCOUNT_SETUP_GUIDE.md` を参照
   - データベーステーブルを作成
   - 環境変数を設定

2. **開発サーバーの起動**
   ```bash
   cd D:\LINE\open-campus-system
   npm run dev
   ```

3. **Claude Codeで実装開始**
   - `CLAUDE_CODE_PROMPTS.txt` のPhase 1から実行

4. **Webhook設定（任意・後回しでOK）**
   - ローカル開発時: ngrok使用（Step 9 パターンA参照）
   - 本番デプロイ後: Vercel URL使用（Step 9 パターンB参照）
   - 推奨: Vercelデプロイ後に設定する方が効率的

---

## 🔧 ローカル開発時のWebhookテスト方法

### ngrokを使った方法（推奨）

1. **ngrokのインストール**
   - URL: https://ngrok.com/
   - アカウント作成（無料）
   - ダウンロード＆インストール

2. **開発サーバーを起動**
   ```bash
   npm run dev
   ```

3. **別のターミナルでngrokを起動**
   ```bash
   ngrok http 3000
   ```

4. **表示されたURLをコピー**
   ```
   Forwarding: https://abc123.ngrok.io -> http://localhost:3000
   ```

5. **LINE DevelopersでWebhook URLを設定**
   ```
   Webhook URL: https://abc123.ngrok.io/api/line/webhook
   ```

6. **「Verify」ボタンでテスト**
   - Successと表示されればOK

7. **テスト方法**
   - LINEアプリで友だち追加
   - メッセージを送信
   - 応答が返ってくるか確認

**注意:**
- ngrokの無料版はURL期限あり（セッション終了で無効）
- 開発のたびにURLが変わる
- 本番はVercel URLを使用

---

## 🚨 トラブルシューティング

### 問題1: Channel Access Tokenが発行できない

**原因:**
- チャネル作成直後は発行できない場合がある

**解決策:**
- 数分待ってから再試行
- ページをリロード
- ブラウザのキャッシュをクリア

---

### 問題2: Webhook URLのVerifyが失敗する

**原因:**
- エンドポイントが存在しない
- 署名検証でエラー
- タイムアウト

**解決策:**
- APIエンドポイントが実装されているか確認
- 開発サーバーが起動しているか確認
- ngrokが正常に動作しているか確認
- Vercelログでエラーを確認

---

### 問題3: メッセージが送信できない

**原因:**
- Channel Access Tokenが間違っている
- トークンの権限不足

**解決策:**
- `.env.local` のトークンを再確認
- 開発サーバーを再起動
- トークンを再発行

---

### 問題4: 友だち追加時のパラメータが取得できない

**原因:**
- URLパラメータの形式が間違っている

**正しい形式:**
```
https://line.me/R/ti/p/@123abcde?liff.state=token_here
```

**確認ポイント:**
- Basic IDが正しいか（@を含む）
- トークンが正しく生成されているか

---

## 📞 参考リンク

- **LINE Developers Console**: https://developers.line.biz/console/
- **Messaging APIリファレンス**: https://developers.line.biz/ja/reference/messaging-api/
- **LINE Official Account Manager**: https://manager.line.biz/
- **よくある質問**: https://developers.line.biz/ja/faq/

---

## 💡 ベストプラクティス

### セキュリティ
```
✅ DO:
- Channel Access Tokenは環境変数に保存
- .env.localはGitにコミットしない
- トークンは定期的に再発行を検討

❌ DON'T:
- トークンをソースコードに直接記述
- トークンをスクリーンショットで共有
- 公開リポジトリにトークンをプッシュ
```

### 運用
```
✅ DO:
- 本番環境とテスト環境で別のチャネルを使用
- エラーログを定期的にチェック
- Webhookのタイムアウトを監視

❌ DON'T:
- 同じチャネルを複数の環境で共有
- エラーを放置
- Webhookを無効化したまま運用
```

---

## 📝 メモ欄

### 取得した情報（記入用）

```
Channel Access Token:


Channel Secret:


Basic ID:


発行日: ____年__月__日
```

---

作成日: 2025年11月9日
最終更新: 2025年11月9日
