# AI自動応答機能 セットアップガイド

## ✅ 完了した作業

1. ✅ **パッケージインストール** - `openai` パッケージ
2. ✅ **環境変数設定** - `.env.local` に OpenAI 設定追加
3. ✅ **データベーステーブル作成** - Supabase に3つのテーブル作成
4. ✅ **ライブラリ実装**
   - `lib/usage-monitor.ts` - 使用量監視（500円制限）
   - `lib/school-knowledge.ts` - 学校情報マスターデータ
   - `lib/conversation-history.ts` - 会話履歴管理
   - `lib/ai-response.ts` - OpenAI API統合
5. ✅ **LINE Webhook拡張** - AI自動応答機能を統合
6. ✅ **管理画面実装**
   - API: `/api/admin/ai-settings`, `/api/admin/ai-usage`
   - UI: `/admin/ai-settings`

---

## 📋 次に行うこと（重要！）

### Step 1: OpenAI APIキーを取得

1. https://platform.openai.com にアクセス
2. アカウント作成（まだの場合）
3. 左メニュー「API keys」→「Create new secret key」
4. 生成されたキーをコピー（例: `sk-proj-xxxxx...`）
   ⚠️ **一度しか表示されないので必ず保存してください**

### Step 2: 支払い方法の登録

1. https://platform.openai.com → 「Settings」→「Billing」
2. クレジットカード情報を登録
3. 最低 $5 のクレジットを購入
4. **使用量上限を設定**（推奨: $10/月）
   - 「Settings」→「Limits」→「Usage limits」

### Step 3: 環境変数にAPIキーを設定

`.env.local` ファイルを開いて、APIキーを設定：

\`\`\`bash
# 以下の行を実際のAPIキーに置き換える
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

保存したら、**開発サーバーを再起動**してください：

\`\`\`bash
# サーバーを停止（Ctrl+C）してから再起動
npm run dev
\`\`\`

### Step 4: 学校情報を編集

`lib/school-knowledge.ts` を開いて、実際の学校情報に書き換えてください：

- 学校名
- 所在地・アクセス
- オープンキャンパス日程
- コース情報
- 学費
- 入試情報
- よくある質問

### Step 5: 管理画面でプロンプトを設定

1. ブラウザで http://localhost:3000/admin/ai-settings にアクセス
2. 「システムプロンプト」欄に学校の情報を含めたプロンプトを記入
3. 必要に応じて以下を調整：
   - Temperature（推奨: 0.7）
   - 最大トークン数（推奨: 500）
   - **月間使用量上限**（好きな金額に変更可能、初期値: 500円）
4. 「設定を保存」をクリック

---

## 🧪 テスト方法

### ローカルテスト

1. **開発サーバー起動**
   \`\`\`bash
   npm run dev
   \`\`\`

2. **ngrok起動**（別のターミナルで）
   \`\`\`bash
   ngrok http 3000
   \`\`\`

3. **LINE Webhook設定**
   - LINE Developers Console を開く
   - Messaging API → Webhook URL に設定:
     \`\`\`
     https://xxxx-xx-xx.ngrok-free.app/api/line/webhook
     \`\`\`
   - 「検証」→「Webhookの利用」をON

4. **LINE公式アカウントで友達追加してテスト**
   - 友達追加 → ウェルカムメッセージ確認
   - 「こんにちは」と送信 → AI応答確認
   - 「アクセスを教えて」と送信 → 学校情報応答確認

### テストシナリオ

| テスト項目 | 期待される動作 |
|-----------|--------------|
| 友達追加 | AI機能の説明を含むウェルカムメッセージ |
| 「こんにちは」 | AI応答（挨拶） |
| 「学費は？」 | 学校情報に基づいた学費の説明 |
| 「アクセス教えて」 | アクセス情報を返答 |
| 「リセット」 | 会話履歴削除メッセージ |
| 64文字のトークン | 既存の申込完了処理（AI応答しない） |

---

## 🚀 本番デプロイ

### Vercel環境変数設定

1. Vercelダッシュボードを開く
2. プロジェクト → Settings → Environment Variables
3. 以下を追加：

| Name | Value |
|------|-------|
| `OPENAI_API_KEY` | `sk-proj-xxxxx...` |
| `OPENAI_MODEL` | `gpt-4o-mini` |
| `OPENAI_MAX_TOKENS` | `500` |
| `OPENAI_TEMPERATURE` | `0.7` |

4. Redeploy（再デプロイ）

### LINE Webhook更新

LINE Developers Console で Webhook URL を本番URLに変更：
\`\`\`
https://your-app.vercel.app/api/line/webhook
\`\`\`

---

## 💰 使用量上限の調整方法

管理画面（`/admin/ai-settings`）から、いつでも変更可能です：

1. 管理画面にアクセス
2. 「月間使用量上限（円）」欄に希望の金額を入力
3. 「設定を保存」をクリック

**例:**
- テスト期間: 500円
- 本運用開始: 2,000円
- 大規模運用: 5,000円

### gpt-4o-miniの利用可能量（参考）

| 月間予算 | 概算会話回数 |
|---------|------------|
| ¥500 | 約10,000回 |
| ¥1,000 | 約20,000回 |
| ¥2,000 | 約40,000回 |
| ¥5,000 | 約100,000回 |

※ 1回あたり600トークン（入力400 + 出力200）と仮定

---

## 🛡️ データ学習について

### OpenAI APIのデータ利用ポリシー

✅ **2023年3月1日以降、OpenAI APIを通じて送信されたデータは、デフォルトでモデルの学習に使用されません。**

- データ保持期間: 30日間（セキュリティ監視目的）
- 学習への使用: なし（デフォルト）
- 明示的な同意なし: 学習データとして使用されることはない

参考: https://openai.com/policies/api-data-usage-policies

---

## 📊 管理画面の使い方

### アクセス

\`\`\`
http://localhost:3000/admin/ai-settings
\`\`\`

### 機能

1. **使用量ダッシュボード**（リアルタイム更新）
   - 今月の使用額（円・ドル）
   - 月間上限との比較
   - リクエスト数
   - プログレスバー

2. **AI機能のON/OFF**
   - トグルスイッチで即座に有効/無効化

3. **システムプロンプト編集**
   - AIの振る舞いを定義
   - 学校情報を記述

4. **詳細設定**
   - Temperature（0-2）: 応答の多様性
   - 最大トークン数（50-1000）: 応答の長さ
   - **月間使用量上限**: 好きな金額に変更可能
   - USD/JPY換算レート: 為替レート設定

---

## ⚠️ トラブルシューティング

### AI応答が返ってこない

**原因1: OpenAI APIキーが未設定**
- `.env.local` の `OPENAI_API_KEY` を確認
- 開発サーバーを再起動

**原因2: 支払い方法未登録**
- OpenAI Platform → Billing で確認
- クレジットカード登録 + $5チャージ

**原因3: 使用量上限に達している**
- 管理画面で使用量を確認
- 必要に応じて上限を増やす

### エラーログの確認

開発サーバーのターミナルでログを確認：
\`\`\`bash
# エラーが表示されます
npm run dev
\`\`\`

Vercelの場合:
\`\`\`
Dashboard → Deployments → [最新] → Runtime Logs
\`\`\`

---

## 📞 サポート

問題が解決しない場合は、以下を確認してください：

1. `docs/VERCEL_INTEGRATION_IMPLEMENTATION_GUIDE.md`
2. OpenAI Platform ドキュメント: https://platform.openai.com/docs
3. LINE Messaging API ドキュメント: https://developers.line.biz/ja/docs/

---

## 🎉 完成！

お疲れ様でした！これで以下の機能が利用可能になりました：

✅ オープンキャンパス申込連携（既存機能）
✅ LINE AI自動応答（新機能）
✅ 会話履歴管理
✅ 使用量制限・監視
✅ 管理画面でのリアルタイム設定変更

ご質問があればいつでもお聞きください！
