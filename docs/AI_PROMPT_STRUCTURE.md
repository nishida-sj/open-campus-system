# AI プロンプト構造設計書

## 概要

AI設定のシステムプロンプトを細分化し、固定項目・追加項目・イベントプロンプトで構成できるようにする。

## データ構造

### ai_settings テーブルの拡張

既存の`ai_settings`テーブルに新しいキーを追加：

```sql
-- 固定項目
INSERT INTO ai_settings (setting_key, setting_value) VALUES
  ('prompt_school_info', '学校情報の内容'),
  ('prompt_access', 'アクセス情報'),
  ('prompt_unable_response', '回答不可時の内容'),
  ('prompt_closing_message', '最後に必ず付ける内容');

-- カスタム項目（JSON配列）
INSERT INTO ai_settings (setting_key, setting_value) VALUES
  ('prompt_custom_items', '[]');
```

### カスタム項目のJSON構造

```json
[
  {
    "id": "uuid-1",
    "name": "学費について",
    "content": "学費は年間XX円です...",
    "order": 1
  },
  {
    "id": "uuid-2",
    "name": "奨学金制度",
    "content": "本校では以下の奨学金制度があります...",
    "order": 2
  }
]
```

## プロンプト生成ロジック

### 最終的なシステムプロンプト構成

```
[固定項目: 学校情報]
{prompt_school_info}

[固定項目: アクセス]
{prompt_access}

[カスタム項目1]
{custom_item_1.name}
{custom_item_1.content}

[カスタム項目2]
{custom_item_2.name}
{custom_item_2.content}

[イベント情報（自動生成）]
{active_events_prompt}

[回答ルール]
{prompt_unable_response}

[必ず最後に記述する内容]
{prompt_closing_message}
```

### イベントプロンプト自動生成

表示終了日が来ていないイベント（`display_end_date >= TODAY()`）について：

```
イベント名: {event.name}
説明: {event.description}

開催日程:
- {date1}: 定員{capacity1}名
- {date2}: 定員{capacity2}名

コース情報:
- {course1.name}: {course1.description}
- {course2.name}: {course2.description}
```

## UI設計

### AI設定画面の構成

1. **固定項目セクション**
   - 学校情報（テキストエリア）
   - アクセス（テキストエリア）
   - 回答不可時の内容（テキストエリア）
   - 最後に必ず付ける内容（テキストエリア）

2. **カスタム項目セクション**
   - 項目一覧（ドラッグ&ドロップで並び替え）
   - 各項目：項目名 + 内容 + 編集・削除ボタン
   - 新規追加ボタン

3. **イベントプロンプトプレビュー**
   - 現在有効なイベント一覧
   - 自動生成されるプロンプトのプレビュー

4. **最終プロンプトプレビュー**
   - 全体を組み合わせた最終的なシステムプロンプト
   - コピーボタン

## 実装手順

1. ✅ イベント管理画面の修正（display_end_date必須化）
2. データベースマイグレーション
3. AI設定画面UI の再設計
4. イベントプロンプト自動生成APIの実装
5. プロンプト結合ロジックの実装
6. OpenAI API呼び出し部分の修正
