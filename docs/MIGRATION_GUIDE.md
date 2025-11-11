# データベースマイグレーションガイド

このドキュメントは、複数日程選択機能を有効にするためのデータベースマイグレーション手順を説明します。

---

## ⚠️ 重要な注意事項

- **本番環境での実行前に、必ずデータベースのバックアップを取得してください**
- マイグレーションは不可逆的な変更を含むため、慎重に実行してください
- 既存の申込データは自動的に新しいスキーマに移行されます

---

## 📋 マイグレーション手順

### ステップ1: Supabase ダッシュボードにログイン

1. https://supabase.com にアクセス
2. プロジェクトを選択
3. 左サイドバーの「SQL Editor」をクリック

### ステップ2: バックアップの作成（推奨）

マイグレーション前に、現在のデータをバックアップします。

```sql
-- 申込者データのバックアップ
CREATE TABLE applicants_backup AS SELECT * FROM applicants;

-- 日程データのバックアップ
CREATE TABLE open_campus_dates_backup AS SELECT * FROM open_campus_dates;
```

実行後、以下で確認：
```sql
SELECT COUNT(*) FROM applicants_backup;
SELECT COUNT(*) FROM open_campus_dates_backup;
```

### ステップ3: マイグレーションSQLの実行

`docs/database_migration_multi_date_selection.sql` ファイルの内容をSQL Editorにコピー&ペーストして実行します。

**実行内容:**
1. `open_campus_events` テーブル作成
2. `open_campus_dates` に `event_id` カラム追加
3. `applicant_visit_dates` 中間テーブル作成
4. 既存データの移行
5. デフォルトイベントの作成

### ステップ4: マイグレーション結果の確認

以下のSQLで、マイグレーションが正しく実行されたか確認します。

```sql
-- 1. テーブルの存在確認
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('open_campus_events', 'applicant_visit_dates');

-- 2. イベントテーブルの確認
SELECT * FROM open_campus_events;

-- 3. 既存データが移行されているか確認
SELECT COUNT(*) FROM applicant_visit_dates;

-- 4. 申込者の日程データが正しく移行されているか
SELECT a.name, a.email, d.date
FROM applicants a
JOIN applicant_visit_dates avd ON a.id = avd.applicant_id
JOIN open_campus_dates d ON avd.visit_date_id = d.id
LIMIT 10;
```

**期待される結果:**
- `open_campus_events` に「デフォルトイベント」が1件作成されている
- `applicant_visit_dates` のレコード数が `applicants` のレコード数と一致
- すべての申込者の日程が正しく関連付けられている

---

## 🔄 今後の運用方針

### オプション1: visit_date_id を残す（推奨：段階的移行）

既存の `visit_date_id` カラムを残し、段階的に新しいスキーマに移行します。

**メリット:**
- 既存コードの変更が最小限
- 単一日程選択の場合はそのまま動作
- 複数日程選択は新しい中間テーブルを使用

**デメリット:**
- データの重複が発生する可能性
- 将来的には削除が必要

**この方針を選択する場合の追加作業:**
なし（現在のコードはそのまま動作します）

---

### オプション2: visit_date_id を削除（推奨：完全移行）

`visit_date_id` カラムを削除し、すべての日程選択を `applicant_visit_dates` で管理します。

**メリット:**
- データの正規化が進む
- シンプルで一貫したデータモデル
- 保守性が向上

**デメリット:**
- 既存コードの大幅な変更が必要
- 申込フォーム、LINE Webhook、管理画面すべてを更新

**この方針を選択する場合の追加SQL:**

```sql
-- visit_date_id カラムを削除
ALTER TABLE applicants DROP COLUMN IF EXISTS visit_date_id;

-- visit_date_id を使用していたインデックスも削除
DROP INDEX IF EXISTS idx_applicants_visit_date_id;
DROP INDEX IF EXISTS idx_applicants_email_visit_date;
```

**⚠️ 警告:** このSQLを実行する前に、すべてのアプリケーションコードを新しいスキーマに対応させてください。

---

## 📝 コード変更が必要なファイル（オプション2を選択した場合）

### 1. 申込フォーム (`app/apply/page.tsx`)
- 日程選択を単一から複数選択に変更
- チェックボックスまたは複数選択可能なリストUIに変更
- 送信時に複数の日程IDを配列で送信

### 2. 申込API (`app/api/apply/route.ts`)
- `visit_date_id` → `visit_date_ids` (配列)
- `applicant_visit_dates` テーブルへの挿入処理を追加
- トランザクション処理で整合性を保証

### 3. LINE Webhook (`app/api/line/webhook/route.ts`)
- 申込者情報取得時に `applicant_visit_dates` をJOIN
- 複数日程を含む完了メッセージを送信

### 4. 管理画面ダッシュボード (`app/admin/dashboard/page.tsx`)
- 申込者の日程表示を複数対応に変更
- CSVエクスポート時に複数日程を列挙

---

## 🧪 テスト手順

マイグレーション後、以下の機能が正常に動作することを確認してください。

### 1. イベント作成
- [ ] 管理画面でイベント作成ページにアクセスできる
- [ ] イベント名、説明、最大選択可能日程数を入力できる
- [ ] 複数の日程を選択できる
- [ ] イベント作成が成功する
- [ ] イベント一覧に作成したイベントが表示される

### 2. 申込フォーム（現状：単一選択のまま）
- [ ] 申込フォームが表示される
- [ ] 日程を選択して申込できる
- [ ] 申込完了ページが表示される
- [ ] データベースに申込データが保存される
- [ ] `applicant_visit_dates` にデータが保存される

### 3. LINE連携
- [ ] 友達追加ができる
- [ ] トークンを送信すると申込完了メッセージが届く
- [ ] メッセージに参加日程が表示される

### 4. 管理画面
- [ ] 申込者一覧が表示される
- [ ] 申込者の日程が正しく表示される
- [ ] CSVエクスポートが動作する

---

## 🔧 トラブルシューティング

### エラー: relation "open_campus_events" already exists
**原因**: テーブルが既に存在する
**解決方法**:
```sql
DROP TABLE IF EXISTS open_campus_events CASCADE;
DROP TABLE IF EXISTS applicant_visit_dates CASCADE;
-- その後、マイグレーションSQLを再実行
```

### エラー: column "event_id" of relation "open_campus_dates" does not exist
**原因**: カラムが追加されていない
**解決方法**:
```sql
ALTER TABLE open_campus_dates
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES open_campus_events(id) ON DELETE CASCADE;
```

### エラー: duplicate key value violates unique constraint
**原因**: データの重複
**解決方法**:
```sql
-- 重複データを確認
SELECT applicant_id, visit_date_id, COUNT(*)
FROM applicant_visit_dates
GROUP BY applicant_id, visit_date_id
HAVING COUNT(*) > 1;

-- 重複を削除
DELETE FROM applicant_visit_dates a
WHERE a.ctid NOT IN (
  SELECT MIN(ctid)
  FROM applicant_visit_dates b
  WHERE a.applicant_id = b.applicant_id
    AND a.visit_date_id = b.visit_date_id
);
```

---

## ♻️ ロールバック手順

マイグレーションを元に戻す必要がある場合:

```sql
-- ステップ1: 中間テーブルを削除
DROP TABLE IF EXISTS applicant_visit_dates CASCADE;

-- ステップ2: event_id カラムを削除
ALTER TABLE open_campus_dates DROP COLUMN IF EXISTS event_id;

-- ステップ3: イベントテーブルを削除
DROP TABLE IF EXISTS open_campus_events CASCADE;

-- ステップ4: バックアップから復元（必要な場合）
-- INSERT INTO applicants SELECT * FROM applicants_backup;
-- INSERT INTO open_campus_dates SELECT * FROM open_campus_dates_backup;
```

---

## 📞 サポート

問題が発生した場合:
1. Supabase のログを確認
2. このドキュメントのトラブルシューティングを参照
3. データベースのバックアップから復元を検討

---

**最終更新**: 2025年11月11日
**作成者**: Mikio
**バージョン**: 1.0.0
**ステータス**: マイグレーション準備完了 ✅
