# AI自動応答機能 詳細

## 概要
LINE公式アカウントにメッセージが送信された際、OpenAI GPT-4o-miniを使って自動応答する機能。
テナント別にOpenAI APIキー・設定を持ち、動的に組み立てたシステムプロンプトで回答を生成する。

## アーキテクチャ

### ファイル構成
| ファイル | 役割 |
|---------|------|
| `lib/ai-response.ts` | AI応答生成のコアロジック。OpenAIクライアント管理、プロンプト組み立て（5分キャッシュ）、API呼び出し |
| `lib/usage-monitor.ts` | 使用量管理。月間上限チェック、使用量ログ記録、95%で自動停止 |
| `lib/conversation-history.ts` | 会話履歴管理。直近10件をコンテキストとして送信 |
| `lib/school-knowledge.ts` | キーワード判定（申込関連・緊急質問の判定） |
| `app/api/[tenant]/admin/ai-prompt/route.ts` | プロンプト生成・設定保存API（GET/POST） |
| `app/api/[tenant]/admin/ai-settings/route.ts` | 基本設定API（enabled, temperature等） |
| `app/api/[tenant]/admin/ai-usage/route.ts` | 使用量統計API |
| `app/[tenant]/admin/ai-settings/page.tsx` | 管理画面（6タブ構成） |

### データフロー
```
LINE Webhook → ai-response.ts:generateAIResponse()
  → checkUsageLimit() ... 月間上限チェック
  → fetchSystemPrompt() ... プロンプト動的組み立て（キャッシュ5分）
  → OpenAI API呼び出し (gpt-4o-mini)
  → logUsage() ... 使用量記録
  → LINE Reply
```

## プロンプト構造

システムプロンプトは以下の順序で動的に組み立てられる:

```
あなたは学校の公式LINEアカウントのAIアシスタントです。
以下の情報に基づいて、正確かつ親切に回答してください。

【学校情報】          ← prompt_school_info
【アクセス】          ← prompt_access
【カスタム項目1】     ← prompt_custom_items (JSON配列)
【カスタム項目2】     ← ...
【学科別情報 - 重要】 ← prompt_department_sections (JSON配列) ★2026-03-06追加
【開催予定のイベント】 ← DBから自動取得（display_end_date >= 今日）
【自動追記ルール】     ← prompt_auto_append_rules (JSON配列)
【追加指示】          ← prompt_additional_instructions
【期間限定のお知らせ】 ← prompt_period_rules (JSON配列) ★2026-03-06追加
【回答ルール - 最重要】← 固定テンプレート
【回答できない場合】   ← prompt_unable_response
【締めメッセージ】     ← prompt_closing_message
```

**重要**: `ai-response.ts` の `fetchSystemPrompt()` と `route.ts` の GET ハンドラは同じロジックで組み立てる。変更時は両方を同期させること。

## ai_settings テーブル（プロンプト関連キー）

| setting_key | 型 | 説明 |
|------------|-----|------|
| `prompt_school_info` | text | 学校情報テキスト |
| `prompt_access` | text | アクセス情報テキスト |
| `prompt_unable_response` | text | 回答不可時のメッセージ |
| `prompt_closing_message` | text | 全回答の最後に追加するメッセージ |
| `prompt_additional_instructions` | text | AI追加指示（自由記述） |
| `prompt_custom_items` | JSON | カスタム項目配列 `CustomItem[]` |
| `prompt_auto_append_rules` | JSON | 自動追記ルール配列 `AutoAppendRule[]` |
| `prompt_period_rules` | JSON | 期間限定ルール配列 `PeriodRule[]` |
| `prompt_department_sections` | JSON | 学科別情報配列 `DepartmentSection[]` |

### ai_settings テーブル（基本設定キー）
| setting_key | デフォルト | 説明 |
|------------|-----------|------|
| `enabled` | `'false'` | AI機能ON/OFF |
| `temperature` | `'0.7'` | 創造性パラメータ (0-2) |
| `max_tokens` | `'500'` | 最大トークン数 |
| `monthly_limit_jpy` | `'500'` | 月間上限（円） |
| `usd_to_jpy_rate` | `'150'` | 為替レート |
| `maintenance_mode` | `'false'` | メンテナンスモードON/OFF |
| `maintenance_tester_ids` | `'[]'` | テスターLINE User ID一覧(JSON) |

## データ型定義

### CustomItem
```typescript
interface CustomItem {
  id: string;
  name: string;      // 項目名（プロンプト内の【見出し】になる）
  content: string;    // 内容テキスト
  order: number;      // 表示順
}
```

### AutoAppendRule（キーワードトリガー型）
```typescript
interface AutoAppendRule {
  id: string;
  name: string;           // ルール名
  keywords: string[];     // トリガーキーワード配列
  message: string;        // 追記メッセージ
  position: 'end' | 'start'; // 挿入位置
  is_active: boolean;     // 手動ON/OFF
  order: number;          // 表示順
}
```
- **動作**: ユーザーの質問に `keywords` のいずれかが含まれる場合、`message` を回答の最初or最後に追加
- **保存先**: `ai_settings` テーブル, `setting_key: 'prompt_auto_append_rules'`

### DepartmentSection（学科別情報）★2026-03-06追加
```typescript
interface DepartmentSection {
  id: string;
  name: string;        // 学科名（例: "看護学科"）
  keywords: string[];  // 判定キーワード（例: ["看護", "ナース"]）
  content: string;     // 学科固有の情報テキスト
  order: number;       // 表示順
}
```
- **動作**: AIが質問内容からキーワードで学科を判定し回答。判定不可時は「どちらの学科についてのお問い合わせでしょうか？」と確認
- **保存先**: `ai_settings` テーブル, `setting_key: 'prompt_department_sections'`
- **プロンプト位置**: カスタム項目の後、イベント情報の前

### PeriodRule（期間トリガー型）★2026-03-06追加
```typescript
interface PeriodRule {
  id: string;
  name: string;        // ルール名（例: "OC申込案内"）
  message: string;     // 追記するメッセージ
  start_date: string;  // 開始日 YYYY-MM-DD
  end_date: string;    // 終了日 YYYY-MM-DD
  is_active: boolean;  // 手動ON/OFF
  order: number;       // 表示順
}
```
- **動作**: `start_date <= 今日 <= end_date` かつ `is_active` の場合、**全回答**にメッセージを追記
- **保存先**: `ai_settings` テーブル, `setting_key: 'prompt_period_rules'`
- **判定ロジック**: `ai-response.ts` と `route.ts` の両方で `new Date().toISOString().split('T')[0]` で今日の日付を取得し比較

## 管理画面タブ構成

`app/[tenant]/admin/ai-settings/page.tsx` - 7タブ構成:

| タブ | アイコン | 内容 |
|-----|---------|------|
| 基本設定 | ⚙️ | AI ON/OFF、メンテナンスモード、Temperature、Max Tokens、月間上限、為替、テスター管理、招待コード |
| 固定項目 | 📝 | 学校情報、アクセス、回答不可メッセージ、締めメッセージ、追加指示 |
| カスタム項目 | ✨ | 自由に追加できる情報項目（追加・編集・削除）。保存は手動ボタン |
| 学科別情報 | 🏫 | 学科ごとの情報登録。判定キーワード付き。CRUD。自動保存 |
| 自動追記ルール | 🎯 | キーワードトリガー型。CRUD + 有効/無効切替。自動保存 |
| 期間限定ルール | 📅 | 期間トリガー型。CRUD + 有効/無効切替。自動保存。期間内/外バッジ表示 |
| プレビュー | 👁️ | イベント・カスタム項目・自動追記・期間限定ルールの各プレビュー + 最終プロンプト表示 |

### 保存方式の違い
- **固定項目**: 各フィールドごとに個別保存ボタン
- **カスタム項目**: 追加/編集/削除後に「カスタム項目を保存」ボタンで一括保存
- **学科別情報 / 自動追記ルール / 期間限定ルール**: 追加/編集/削除/トグル操作時に**自動保存**

## イベント情報の自動取得

プロンプトにはDBから有効なイベント情報が自動的に含まれる:
- 条件: `is_active = true` かつ `display_end_date >= 今日`
- 含まれる情報: イベント名、概要(overview)、補足(description)、開催日程（日付・定員・残り）、コース情報
- テーブル: `open_campus_events` → `open_campus_dates` → `event_courses`

## プロンプトキャッシュ
- `lib/ai-response.ts` 内の `promptCache` (Map)
- テナントIDをキーに5分間キャッシュ
- 設定変更時は `clearPromptCache()` で即座にクリア（POST APIから呼び出し）

## メンテナンスモード
- ON時: テスター以外のユーザーには「メンテナンス中」メッセージを返す
- テスター登録方法:
  1. 管理画面で直接LINE User IDを入力
  2. 招待コード発行 → LINEで「テスター登録 [コード]」送信で自動登録
- 招待コード: 10分間有効、API: `/api/[tenant]/admin/maintenance-invite`

## 使用量管理
- OpenAI APIの使用量を `ai_usage_logs` テーブルに記録
- 月間上限（円）を設定可能
- 95%到達で自動停止
- 管理画面にリアルタイムダッシュボード表示（10秒更新）
