# Supabaseデータベース移行ガイド

## 📋 概要
このガイドでは、`visit_date` カラムを日付型からUUID型（`visit_date_id`）に変更する手順を説明します。

---

## 🎯 変更内容

### 変更前
- `applicants.visit_date`: DATE型（日付文字列を保存）

### 変更後
- `applicants.visit_date_id`: UUID型（open_campus_dates.idを参照）

### メリット
- データ整合性の向上（外部キー制約）
- 日程の詳細情報を簡単に取得可能
- 同じ日付で複数の開催日程を設定可能
- 統計情報の集計が容易

---

## 📝 実行手順

### ステップ1: Supabaseダッシュボードにログイン
https://app.supabase.com にアクセスし、プロジェクトを選択

### ステップ2: SQL Editorを開く
左サイドバーから「SQL Editor」を選択

### ステップ3: テーブル構造を変更
以下のSQLを実行：

```sql
-- ファイル: docs/database_migration_visit_date.sql の内容をコピー＆ペースト
-- または以下を直接実行：

-- visit_dateカラムを削除
ALTER TABLE applicants DROP COLUMN IF EXISTS visit_date;

-- visit_date_id カラムを追加（UUID型、NOT NULL、外部キー制約）
ALTER TABLE applicants
ADD COLUMN visit_date_id UUID NOT NULL REFERENCES open_campus_dates(id) ON DELETE RESTRICT;

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_applicants_visit_date_id ON applicants(visit_date_id);

-- 重複チェック用の複合インデックス作成
CREATE INDEX IF NOT EXISTS idx_applicants_email_visit_date ON applicants(email, visit_date_id);
```

### ステップ4: increment_visit_count関数を作成
以下のSQLを実行：

```sql
-- ファイル: docs/database_function_increment_visit_count.sql の内容をコピー＆ペースト
-- または以下を直接実行：

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

### ステップ5: 変更を確認
以下のSQLで確認：

```sql
-- カラム構造の確認
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'applicants'
ORDER BY ordinal_position;

-- 関数の確認
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'increment_visit_count';
```

---

## ✅ 動作確認

### 1. 開発サーバーを再起動
既に起動している場合は一度停止して再起動：

```bash
# Ctrl+C で停止後
npm run dev
```

### 2. テストページでAPIテスト
http://localhost:3000/test にアクセス

1. **開催日程取得テスト**を実行
2. 表示されたUUIDをコピー
3. **申込処理テスト**の「参加希望日ID」にペースト
4. **POST /api/apply を実行**ボタンをクリック

### 期待される結果
```json
{
  "success": true,
  "token": "a1b2c3d4e5f6...",
  "applicant_id": "uuid"
}
```

---

## 🔄 ロールバック手順（問題が発生した場合）

```sql
-- visit_date_id カラムを削除
ALTER TABLE applicants DROP COLUMN IF EXISTS visit_date_id;

-- visit_date カラムを再作成（DATE型）
ALTER TABLE applicants ADD COLUMN visit_date DATE NOT NULL;

-- 関数を削除
DROP FUNCTION IF EXISTS increment_visit_count(UUID);
```

---

## 📊 変更されたファイル一覧

### コードファイル
- `types/index.ts` - `visit_date` → `visit_date_id`
- `lib/validation.ts` - バリデーションスキーマ更新
- `app/api/apply/route.ts` - API処理の修正
- `app/test/page.tsx` - テストページの修正

### ドキュメント
- `docs/database_migration_visit_date.sql` - テーブル変更SQL
- `docs/database_function_increment_visit_count.sql` - 関数作成SQL
- `docs/SUPABASE_MIGRATION_GUIDE.md` - このガイド

---

## ⚠️ 注意事項

1. **既存データがある場合**
   - テーブル変更前に必ずバックアップを取得してください
   - 既存のapplicantsレコードがある場合、visit_dateカラムの削除前にデータ移行が必要です

2. **外部キー制約**
   - `visit_date_id` は `open_campus_dates.id` を参照します
   - 存在しないUUIDを指定するとエラーになります

3. **NOT NULL制約**
   - `visit_date_id` は必須フィールドです
   - 申込時に必ず有効な日程IDを指定する必要があります

---

作成日: 2025年11月10日
最終更新: 2025年11月10日
