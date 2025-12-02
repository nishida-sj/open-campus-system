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

---

## 📦 本番デプロイ手順（詳細版）

### Step 1: Vercel環境変数設定

1. Vercelダッシュボードを開く: https://vercel.com/dashboard
2. プロジェクト → Settings → Environment Variables
3. 以下の環境変数を追加：

| Name | Value | Environment |
|------|-------|-------------|
| `OPENAI_API_KEY` | `sk-proj-xxxxx...` | Production |
| `OPENAI_MODEL` | `gpt-4o-mini` | Production |
| `OPENAI_MAX_TOKENS` | `500` | Production |
| `OPENAI_TEMPERATURE` | `0.7` | Production |

### Step 2: Git コミット & プッシュ

```bash
git add .
git commit -m "Feature: Add AI auto-response system"
git push origin main
```

### Step 3: Vercel自動デプロイ

1. GitHubへのプッシュ後、Vercelが自動的にデプロイを開始
2. Vercel Dashboard → Deployments タブで進行状況を確認
3. ビルドが完了するまで待つ（通常2-5分）

**重要:** デプロイメント固有URL（例: `open-campus-system-xxx-xxx.vercel.app`）ではなく、本番URL（例: `open-campus-system.vercel.app`）を使用すること

### Step 4: LINE Webhook URL更新

1. LINE Developers Console を開く: https://developers.line.biz/console/
2. プロバイダー → チャネルを選択
3. Messaging API タブ → Webhook URL を以下に変更：
   ```
   https://open-campus-system.vercel.app/api/line/webhook
   ```
   ⚠️ **注意:** デプロイメント固有URLではなく、本番URLを使用
4. 「更新」ボタンをクリック
5. 「検証」ボタンをクリックして接続確認

### Step 5: システムプロンプト設定

1. 管理画面にアクセス: `https://your-domain.vercel.app/admin/ai-settings`
2. 「システムプロンプト」欄に学校情報を含むプロンプトを入力
3. 例：

```
あなたは[学校名]の公式LINEアカウントのAIアシスタントです。

以下の学校情報に基づいて、正確かつ親切に回答してください。

【学校基本情報】
学校名: [学校名]
所在地: [住所]
電話番号: [電話番号]
受付時間: [受付時間]

【アクセス】
最寄り駅: [駅名]

【オープンキャンパス日程】
[日程情報]

【設置コース】
[コース情報]

【学費】
[学費情報]

【応答ルール】
1. 常に丁寧で親しみやすい口調で話す
2. 絵文字を適度に使用（1-2個/メッセージ）
3. 長文は避け、簡潔に（200文字以内推奨）
4. 不確かな情報は提供しない
```

4. 「設定を保存」をクリック

---

## 🔧 トラブルシューティング（実デプロイで発生した問題と解決策）

### 問題1: TypeScript型エラー - `userId` が見つからない

**エラーメッセージ:**
```
Type error: Cannot find name 'userId'.
app/api/line/webhook/route.ts:282:25
```

**原因:**
`handleTokenVerification` 関数内で `userId` 変数が定義されていない

**解決策:**
関数の最初に以下を追加：
```typescript
async function handleTokenVerification(
  event: WebhookEvent & { type: 'message' },
  token: string
) {
  const userId = event.source.userId;

  if (!userId) {
    console.error('No userId in token verification event');
    return;
  }
  // ... 残りの処理
}
```

**コミット:** `Fix: Add missing userId variable in handleTokenVerification function`

---

### 問題2: 型の不一致 - ConversationMessage型

**エラーメッセージ:**
```
Type error: Type '"user" | "assistant" | "system"' is not assignable to type '"user" | "assistant"'.
```

**原因:**
`ConversationMessage` インターフェースに `'system'` が含まれているが、実際には使用していない

**解決策:**
`lib/conversation-history.ts` の型定義を修正：
```typescript
export interface ConversationMessage {
  role: 'user' | 'assistant'; // 'system' を削除
  content: string;
  created_at?: string;
}
```

**コミット:** `Fix: Update ConversationMessage type to match actual usage`

---

### 問題3: Supabaseクエリ構文エラー

**エラーメッセージ:**
```
Property 'role' does not exist on type 'ParserError<"Unexpected input: as content, created_at">'.
```

**原因:**
Supabase v2のクエリでは `message as content` のようなSQL構文が使えない

**解決策:**
`lib/conversation-history.ts` のクエリを修正：
```typescript
// 修正前
.select('role, message as content, created_at')

// 修正後
.select('role, message, created_at')

// mapで変換
.map((msg) => ({
  role: msg.role as 'user' | 'assistant',
  content: msg.message, // messageをcontentに変換
}))
```

**コミット:** `Fix: Remove SQL alias from Supabase query and map field in code`

---

### 問題4: OpenAI APIクォータ不足

**エラーメッセージ:**
```
429 You exceeded your current quota, please check your plan and billing details.
```

**原因:**
OpenAI Platformで支払い情報が未登録、またはクレジット残高不足

**解決策:**
1. https://platform.openai.com → Settings → Billing
2. クレジットカード情報を登録
3. 最低 $5 のクレジットを購入
4. 使用量上限を設定（推奨: $10/月）

---

### 問題5: 古いデプロイが動作している

**症状:**
- コードを修正してプッシュしても、LINEの応答が変わらない
- ログに古いコードの出力が表示される

**原因:**
LINE Webhook URLがデプロイメント固有URL（例: `open-campus-system-aswgcf43d-xxx.vercel.app`）になっている

**解決策:**
1. LINE Developers Console を開く
2. Webhook URL を本番URL（例: `open-campus-system.vercel.app`）に変更
3. Vercelの最新デプロイが「Ready」になっていることを確認

**確認方法:**
- Vercel Dashboard → Deployments
- 最新のコミットメッセージが表示されているか確認
- ステータスが「Ready」になっているか確認

---

### 問題6: AI応答が学校情報を使用していない

**症状:**
「アクセスを教えて」と送信しても、一般的な回答が返ってくる

**原因:**
データベースの `ai_settings` テーブルに空のシステムプロンプトが保存されている

**解決策:**
1. 管理画面にアクセス: `https://your-domain.vercel.app/admin/ai-settings`
2. 「システムプロンプト」欄を確認
3. 空白の場合、学校情報を含むプロンプトを入力して保存
4. LINEで再度テスト

**デバッグ方法:**
Vercelのログで以下を確認：
```
Regular message detected, processing AI response...
```
この後、OpenAI APIエラーが出ていなければ、システムプロンプトが問題

---

## 🎯 テスト手順（品質保証）

### 基本機能テスト

| テスト項目 | 入力 | 期待される結果 | 確認 |
|-----------|------|---------------|------|
| 友達追加 | （友達追加操作） | ウェルカムメッセージ送信 | ☐ |
| AI応答（挨拶） | 「こんにちは」 | 学校の案内が返答される | ☐ |
| AI応答（アクセス） | 「アクセスを教えて」 | 最寄り駅・住所情報が返答される | ☐ |
| AI応答（学費） | 「学費はいくらですか？」 | 学費情報が返答される | ☐ |
| AI応答（日程） | 「オープンキャンパスはいつですか？」 | 日程情報が返答される | ☐ |
| リセットコマンド | 「リセット」 | 会話履歴リセット確認メッセージ | ☐ |
| 緊急質問 | 「急ぎで相談したいです」 | 電話番号案内 | ☐ |
| トークン検証 | （64文字トークン） | 申込完了処理（AI応答なし） | ☐ |

### 使用量監視テスト

| テスト項目 | 操作 | 期待される結果 | 確認 |
|-----------|------|---------------|------|
| 使用量表示 | 管理画面アクセス | 今月の使用額が表示される | ☐ |
| リアルタイム更新 | 10秒待機 | 使用量が自動更新される | ☐ |
| 上限設定変更 | 月間上限を変更して保存 | 保存成功メッセージ | ☐ |

---

## 💼 企業向けパッケージ化ガイド

### システム構成

このLINE AI自動応答システムは以下の技術スタックで構築されています：

**フロントエンド:**
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS

**バックエンド:**
- Next.js API Routes
- Supabase (PostgreSQL)
- OpenAI API (GPT-4o-mini)
- LINE Messaging API

**インフラ:**
- Vercel (ホスティング)
- GitHub (バージョン管理)

### 他企業への提案時のカスタマイズポイント

#### 1. 学校情報のカスタマイズ

**ファイル:** `lib/school-knowledge.ts`

```typescript
export const schoolKnowledge = `
【学校基本情報】
学校名: [顧客の学校名]
所在地: [顧客の住所]
電話番号: [顧客の電話番号]
...
`;

export const emergencyContact = {
  phone: '[顧客の電話番号]',
  hours: '[顧客の受付時間]',
  email: '[顧客のメールアドレス]',
};
```

#### 2. 使用量上限のカスタマイズ

**デフォルト値:** 500円/月

**変更方法:**
- 管理画面から変更可能
- またはSQLで初期値を変更：

```sql
UPDATE ai_settings
SET setting_value = '2000'
WHERE setting_key = 'monthly_limit_jpy';
```

#### 3. AI応答パラメータのカスタマイズ

**Temperature（応答の多様性）:**
- デフォルト: 0.7
- 推奨範囲: 0.5-1.0
- 低い値: 一貫性重視
- 高い値: 創造性重視

**Max Tokens（応答の長さ）:**
- デフォルト: 500
- 推奨範囲: 300-800
- 短い応答: 200-300
- 詳細な応答: 600-800

#### 4. ブランディングのカスタマイズ

**管理画面タイトル:**
`app/admin/ai-settings/page.tsx`

```typescript
<h1 className="text-3xl font-bold">
  [顧客名] AI自動応答設定
</h1>
```

**ウェルカムメッセージ:**
`app/api/line/webhook/route.ts`

```typescript
const welcomeMessage: TextMessage = {
  type: 'text',
  text: `ご登録ありがとうございます！🎉\n\n【できること】\n...`,
};
```

### コスト試算

#### 初期費用
- **開発費用:** 0円（このシステムを使用）
- **Vercel Hobby プラン:** 0円
- **Supabase Free プラン:** 0円
- **LINE公式アカウント:** 0円（Reply API使用）

#### 月額費用（運用コスト）

**OpenAI API（GPT-4o-mini）:**
- Input: $0.150 / 1M tokens
- Output: $0.600 / 1M tokens

**概算:**
| 月間会話数 | 月額費用（円） | 備考 |
|-----------|---------------|------|
| 100回 | 約30円 | テスト運用 |
| 500回 | 約150円 | 小規模運用 |
| 2,000回 | 約600円 | 中規模運用 |
| 5,000回 | 約1,500円 | 大規模運用 |

※ 1回の会話 = 600トークン（入力400 + 出力200）と仮定
※ 為替レート: $1 = ¥150 で計算

### セキュリティとプライバシー

#### データ学習について
✅ **OpenAI APIは2023年3月1日以降、デフォルトでAPIデータを学習に使用しません**

参考: https://openai.com/policies/api-data-usage-policies

#### データ保持期間
- **会話履歴:** 30日間（自動削除）
- **使用量ログ:** 永続保存（監査用）
- **OpenAI側:** 30日間（セキュリティ監視目的のみ）

#### 個人情報保護
- LINE User IDのみ保存（氏名・メールアドレスは保存しない）
- 会話内容は暗号化して保存
- リセットコマンドでユーザー自身が会話履歴を削除可能

---

## 📊 運用監視

### 管理画面での監視項目

1. **使用量ダッシュボード**
   - 今月の使用額（円・ドル）
   - 月間上限との比較
   - リクエスト数
   - プログレスバー

2. **アラート機能**
   - 使用量が75%に達したら警告表示
   - 使用量が90%に達したら警告メッセージ
   - 使用量が95%に達したら自動停止

3. **リアルタイム更新**
   - 10秒ごとに使用量を自動更新
   - ページを開いたままで監視可能

### Vercelログの確認

**アクセス方法:**
1. Vercel Dashboard → プロジェクト選択
2. 「Logs」タブをクリック
3. リアルタイムでログを確認

**確認すべきログ:**
- `Received message from user:` - メッセージ受信
- `Regular message detected` - AI処理開始
- `OpenAI API error:` - APIエラー
- `All events processed successfully` - 処理完了

---

## 🎉 完成！

お疲れ様でした！これで以下の機能が利用可能になりました：

✅ オープンキャンパス申込連携（既存機能）
✅ LINE AI自動応答（新機能）
✅ 会話履歴管理
✅ 使用量制限・監視
✅ 管理画面でのリアルタイム設定変更

### 本番運用チェックリスト

- [ ] OpenAI APIキー設定完了
- [ ] OpenAI支払い情報登録完了
- [ ] Vercel環境変数設定完了
- [ ] LINE Webhook URL更新完了（本番URLに変更）
- [ ] 管理画面でシステムプロンプト設定完了
- [ ] 月間使用量上限設定完了
- [ ] 全テストケース実行完了
- [ ] 使用量監視ダッシュボード確認完了

ご質問があればいつでもお聞きください！
