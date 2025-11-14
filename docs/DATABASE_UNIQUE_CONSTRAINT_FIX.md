# データベースユニーク制約の修正

## 問題

`applicants`テーブルの`line_user_id`フィールドにユニーク制約がかかっているため、同じLINEユーザーが複数のオープンキャンパスに申し込むことができません。

## エラー例

```
コード: '23505'
詳細: 'キー (line_user_id)=(U3163f01fb44c000dda49effadbcb3079) が既に存在します。'
メッセージ: '重複したキー値は一意制約 "applicants_line_user_id_key" に違反しています。'
```

## 現在の対応（一時的な回避策）

webhookコードを修正し、既に同じLINEユーザーIDが登録されている場合は：
- `line_user_id`を更新せず（NULLまたは既存値のまま）
- `status`のみを`completed`に更新
- ユーザーには正常に登録完了メッセージを送信

これにより、エラーは発生しなくなりますが、2回目以降の申込には`line_user_id`が設定されません。

## 恒久的な解決策（推奨）

データベースのユニーク制約を削除し、同じLINEユーザーが複数回申し込めるようにします。

### Supabase SQL Editorで実行するSQL

```sql
-- ユニーク制約を削除
ALTER TABLE applicants DROP CONSTRAINT IF EXISTS applicants_line_user_id_key;

-- インデックスは残す（検索パフォーマンスのため）
CREATE INDEX IF NOT EXISTS idx_applicants_line_user_id ON applicants(line_user_id);
```

### 実行手順

1. Supabaseダッシュボードにログイン
2. 左メニューから「SQL Editor」を選択
3. 上記のSQLをコピー&ペースト
4. 「Run」ボタンをクリック

### 実行後の確認

```sql
-- 制約が削除されたことを確認
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'applicants'::regclass
AND conname = 'applicants_line_user_id_key';

-- 結果が0件であればOK（制約が削除されている）
```

## 制約削除後のメリット

1. **複数回申込可能**: 同じLINEユーザーが複数のオープンキャンパスに申し込める
2. **LINE連携の確実性**: すべての申込に`line_user_id`が正しく設定される
3. **一括メッセージ配信**: 同じユーザーの複数申込に対して、それぞれ適切な通知を送信できる

## 制約削除後の注意点

- 同じLINEユーザーが複数の申込を持つことが可能になります
- 管理画面で同じLINEユーザーの申込を区別できるよう、申込ID、日程、コース名などで識別してください
- 一括メッセージ配信時は、同じユーザーに重複してメッセージが送信される可能性があります（必要に応じて送信前に重複排除）

## データ整合性の確認

制約削除後、既存データに問題がないか確認：

```sql
-- 同じLINEユーザーが複数申込を持っているケースを確認
SELECT
  line_user_id,
  COUNT(*) as application_count,
  STRING_AGG(name, ', ') as names
FROM applicants
WHERE line_user_id IS NOT NULL
GROUP BY line_user_id
HAVING COUNT(*) > 1
ORDER BY application_count DESC;
```

---

**最終更新**: 2025年11月15日
**対応状況**: 一時的な回避策実装済み、ユニーク制約削除は任意
