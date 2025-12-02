# LINE AI自動応答システム 実装完了レポート

**作成日:** 2025年12月2日
**プロジェクト:** オープンキャンパス管理システム
**実装者:** Claude Code
**ステータス:** デプロイ完了 / システムプロンプト設定待ち

---

## 📋 実装概要

### 目的
既存のLINEオープンキャンパス申込システムに、OpenAI GPT-4o-miniを使用したAI自動応答機能を追加し、24時間対応の学校案内を実現する。

### 主要機能
1. **AI自動応答** - 学校情報に基づいた質問応答
2. **会話履歴管理** - 文脈を考慮した応答
3. **使用量監視** - コスト管理と自動制限
4. **管理画面** - リアルタイム設定変更

---

## ✅ 実装完了項目

### 1. データベース設計・構築
**実施日:** 2025年12月1日

#### 作成テーブル

**`conversation_history`** - 会話履歴
```sql
CREATE TABLE conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**`ai_usage_logs`** - 使用量ログ
```sql
CREATE TABLE ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost_usd DECIMAL(10, 6) NOT NULL,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**`ai_settings`** - AI設定
```sql
CREATE TABLE ai_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 初期データ投入
```sql
INSERT INTO ai_settings (setting_key, setting_value) VALUES
  ('enabled', 'true'),
  ('model', 'gpt-4o-mini'),
  ('temperature', '0.7'),
  ('max_tokens', '500'),
  ('system_prompt', ''),
  ('monthly_limit_jpy', '500'),
  ('usd_to_jpy_rate', '150');
```

---

### 2. バックエンド実装

#### ライブラリファイル作成

**`lib/usage-monitor.ts`** - 使用量監視
- OpenAI API使用量の追跡
- 月間上限チェック（95%で自動停止）
- コスト計算（USD → JPY換算）

**`lib/school-knowledge.ts`** - 学校情報マスターデータ
- 学校基本情報
- アクセス情報
- オープンキャンパス日程
- コース・学費情報
- FAQ

**`lib/conversation-history.ts`** - 会話履歴管理
- メッセージ保存
- 履歴取得（最新10件）
- 会話リセット
- 自動クリーンアップ（30日以上前）

**`lib/ai-response.ts`** - OpenAI API統合
- GPT-4o-mini API呼び出し
- システムプロンプト管理
- エラーハンドリング
- 使用量ログ記録

---

### 3. API実装

**`app/api/admin/ai-settings/route.ts`**
- GET: AI設定取得
- POST: AI設定更新

**`app/api/admin/ai-usage/route.ts`**
- GET: 今月の使用量統計取得

**`app/api/line/webhook/route.ts`** - 拡張
- トークン検証処理（既存）
- AI自動応答処理（新規）
- 特殊コマンド処理（リセット、緊急質問）
- 申込関連質問の自動振り分け

---

### 4. フロントエンド実装

**`app/admin/ai-settings/page.tsx`** - 管理画面
- 使用量ダッシュボード（リアルタイム更新）
- AI機能ON/OFF切り替え
- システムプロンプト編集
- 詳細設定（Temperature、Max Tokens、月間上限）
- 保存・検証機能

---

### 5. デプロイ実施

#### Vercel環境変数設定
```env
OPENAI_API_KEY=sk-proj-***（設定済み）
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.7
```

#### Git管理
- 初回コミット: `717a9c7` - Feature: Add AI auto-response with GPT-4o-mini
- 修正1: `000d39c` - Fix: Add missing userId variable
- 修正2: `8e94024` - Fix: Update ConversationMessage type
- 修正3: `3a190c6` - Fix: Remove SQL alias from Supabase query
- デバッグ: `a835ff7` - Debug: Add detailed logging

#### Webhook URL設定
- 変更前: `https://open-campus-system-aswgcf43d-***.vercel.app/api/line/webhook`
- 変更後: `https://open-campus-system.vercel.app/api/line/webhook` ✅

---

## 🐛 発生した問題と解決策

### 問題1: TypeScript型エラー（userId未定義）
**エラー:** `Cannot find name 'userId'`
**解決:** `handleTokenVerification` 関数内に `userId` 変数定義を追加

### 問題2: 型の不一致（ConversationMessage）
**エラー:** `Type '"system"' is not assignable to type '"user" | "assistant"'`
**解決:** `ConversationMessage` インターフェースから `'system'` を削除

### 問題3: Supabaseクエリ構文エラー
**エラー:** `Unexpected input: as content`
**解決:** SQL aliasを削除し、JavaScriptでマッピング

### 問題4: OpenAI APIクォータ不足
**エラー:** `429 You exceeded your current quota`
**解決:** OpenAI Platformで支払い情報登録とクレジット購入（$5）

### 問題5: 古いデプロイが動作
**原因:** LINE Webhook URLがデプロイメント固有URLになっていた
**解決:** 本番URLに変更

### 問題6: AI応答が学校情報を使用していない（現在対応中）
**原因:** データベースのシステムプロンプトが空白
**解決策:** 管理画面からシステムプロンプトを設定（ユーザー対応待ち）

---

## 📊 技術スタック

### フロントエンド
- Next.js 16.0.1 (App Router)
- TypeScript 5.x
- Tailwind CSS 3.x
- React 19

### バックエンド
- Next.js API Routes
- Supabase (PostgreSQL)
- OpenAI API (GPT-4o-mini)
- LINE Messaging API (Reply API使用)

### インフラ
- Vercel (ホスティング)
- GitHub (バージョン管理)

### 外部サービス
- Supabase (Database as a Service)
- OpenAI Platform (AI API)
- LINE Developers (Messaging API)

---

## 💰 コスト分析

### 初期費用
- **開発費用:** 0円（AI実装のみ）
- **Vercel Hobby プラン:** 0円
- **Supabase Free プラン:** 0円
- **LINE公式アカウント:** 0円（Reply API使用）
- **OpenAI初期クレジット:** $5（約¥750）

### 月額運用コスト

#### OpenAI API（GPT-4o-mini）料金
- Input: $0.150 / 1M tokens
- Output: $0.600 / 1M tokens

#### 会話数別コスト試算
| 月間会話数 | 総トークン | 月額費用（USD） | 月額費用（JPY） |
|-----------|----------|---------------|---------------|
| 100回 | 60,000 | $0.21 | 約¥30 |
| 500回 | 300,000 | $1.05 | 約¥150 |
| 2,000回 | 1,200,000 | $4.20 | 約¥630 |
| 5,000回 | 3,000,000 | $10.50 | 約¥1,575 |

※ 1回の会話 = 600トークン（入力400 + 出力200）と仮定
※ 為替レート: $1 = ¥150 で計算

### コスト最適化施策
1. **自動使用量制限** - 95%到達で自動停止
2. **会話履歴最適化** - 最新10件のみ使用
3. **トークン数制限** - Max Tokens = 500
4. **月間上限設定** - デフォルト¥500、管理画面で変更可能

---

## 🔐 セキュリティ対策

### データプライバシー
- ✅ OpenAI APIはデータを学習に使用しない（2023年3月1日以降）
- ✅ 会話履歴は30日後に自動削除
- ✅ LINE User IDのみ保存（個人情報は保存しない）
- ✅ ユーザー自身が会話履歴をリセット可能（「リセット」コマンド）

### アクセス制御
- 管理画面はパスワード認証（`NEXT_PUBLIC_ADMIN_PASSWORD`）
- Supabase Service Role Keyは環境変数で管理
- OpenAI API Keyは環境変数で管理

### エラーハンドリング
- APIエラー時の適切なフォールバック
- ユーザーに技術的な詳細を見せない
- エラーログは開発者のみ閲覧可能

---

## 📈 今後の拡張可能性

### 短期的改善（1-3ヶ月）
1. **多言語対応** - 英語・中国語などの自動検出と応答
2. **画像送信** - オープンキャンパスの写真を自動送信
3. **リッチメニュー** - よくある質問へのクイックアクセス
4. **分析ダッシュボード** - 質問の傾向分析

### 中期的改善（3-6ヶ月）
1. **音声メッセージ対応** - LINE音声メッセージの文字起こし＋応答
2. **予約機能統合** - AIで日程確認→直接予約へ誘導
3. **パーソナライゼーション** - ユーザーの興味に応じた情報提供
4. **プッシュ通知** - 重要なお知らせの自動配信

### 長期的改善（6-12ヶ月）
1. **他チャネル展開** - Web チャットボット、Facebook Messenger
2. **AI Agent化** - 複数ステップのタスク自動実行
3. **音声通話統合** - LINE音声通話でのAI応答
4. **感情分析** - ユーザーの感情を検出して対応を調整

---

## 🎯 成功指標（KPI）

### 定量指標
- **応答時間:** 平均2-5秒以内
- **応答精度:** ユーザー満足度80%以上（アンケート）
- **使用量:** 月間¥500以内（初期設定）
- **稼働率:** 99%以上

### 定性指標
- ユーザーからの問い合わせ電話数の削減
- オープンキャンパス申込数の増加
- LINE友達数の増加
- ポジティブなフィードバック

---

## 📝 運用チェックリスト

### デプロイ前
- [x] データベースマイグレーション実行
- [x] OpenAI APIキー設定
- [x] Vercel環境変数設定
- [x] LINE Webhook URL更新
- [ ] 管理画面でシステムプロンプト設定 ⚠️ **要対応**
- [ ] 全テストケース実行

### デプロイ後
- [x] 友達追加テスト
- [ ] AI応答テスト（システムプロンプト設定後）
- [ ] 使用量監視確認
- [ ] エラーログ確認

### 運用中
- [ ] 週次使用量レビュー
- [ ] 月次コストレビュー
- [ ] ユーザーフィードバック収集
- [ ] システムプロンプト最適化

---

## 🚀 企業パッケージ提案資料

### システムの特長
1. **低コスト** - 月額数百円から運用可能
2. **スケーラブル** - 会話数に応じた従量課金
3. **カスタマイズ容易** - 学校情報は管理画面から変更可能
4. **24時間対応** - 人件費なしで24時間質問対応
5. **Reply API使用** - LINE料金は完全無料

### 導入メリット
- 電話問い合わせ対応工数の削減
- 夜間・休日の問い合わせにも対応
- 一貫した情報提供
- オープンキャンパス申込率の向上

### カスタマイズ対応
- 学校情報のカスタマイズ（学校名、日程、コースなど）
- ブランディング（管理画面のデザイン、ウェルカムメッセージ）
- 使用量上限の調整
- AI応答パラメータの調整

### サポート内容
- セットアップサポート
- カスタマイズ支援
- 運用マニュアル提供
- トラブルシューティング

---

## 📚 ドキュメント一覧

1. **AI_SETUP_GUIDE.md** - セットアップ手順書
2. **AI_IMPLEMENTATION_REPORT.md** - 本ドキュメント
3. **VERCEL_INTEGRATION_IMPLEMENTATION_GUIDE.md** - Vercel統合ガイド
4. **database_migration_ai_features.sql** - データベースマイグレーション
5. **update_ai_model_to_gpt4o_mini.sql** - モデル更新SQL

---

## 📞 次のアクション

### 即座に対応が必要
1. **管理画面でシステムプロンプトを設定**
   - URL: `https://open-campus-system.vercel.app/admin/ai-settings`
   - `lib/school-knowledge.ts` の情報を含むプロンプトを入力
   - 保存後、LINEで「アクセスを教えて」とテスト

### PC再起動後に実施
1. 管理画面にアクセス
2. システムプロンプトを設定
3. LINEで全テストシナリオを実行
4. 使用量監視ダッシュボードを確認

---

**作成者:** Claude Code
**最終更新:** 2025年12月2日 00:00
**バージョン:** 1.0
**ステータス:** システムプロンプト設定待ち
