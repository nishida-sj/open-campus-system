# デプロイ後の確認チェックリスト

## デプロイ完了後の必須作業

### 1. データベース関数の実行 ⚠️ **必須**
Supabaseの管理画面で以下のSQLを実行してください：
- ファイル: `docs/database_function_decrement_count.sql`
- 場所: Supabase Dashboard → SQL Editor
- 内容: `decrement_visit_count`関数の作成

```sql
-- 以下の内容をSupabase SQL Editorで実行
CREATE OR REPLACE FUNCTION decrement_visit_count(date_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE open_campus_dates
  SET current_count = GREATEST(current_count - 1, 0)
  WHERE id = date_id;
END;
$$;
```

## 実装された機能の確認

### Phase 1: イベント一覧ページ ✅
- **URL**: https://open-campus-system.vercel.app/
- **確認項目**:
  - [ ] 公開中のイベントのみが表示される
  - [ ] イベント概要(overview)が表示される
  - [ ] 開催日程数が表示される
  - [ ] 複数日参加可能な場合のバッジが表示される
  - [ ] イベントカードをクリックすると申込ページに遷移する

### Phase 2: イベント作成機能の拡張 ✅
- **URL**: https://open-campus-system.vercel.app/admin/events
- **確認項目**:
  - [ ] イベント概要(overview)フィールドが追加されている
  - [ ] 複数日参加可能トグルが機能する
  - [ ] コース管理セクションが表示される
  - [ ] コースを追加・削除できる
  - [ ] コースごとに適用日程を選択できる
  - [ ] イベント作成時にコースと日程の関連付けが保存される

### Phase 3: 申込ページの改修 ✅
- **URL**: https://open-campus-system.vercel.app/apply?event=[イベントID]
- **確認項目**:
  - [ ] イベント一覧からクエリパラメータ付きで遷移する
  - [ ] 選択したイベント情報が表示される
  - [ ] 複数日参加が許可されている場合、複数日程を選択できる
  - [ ] 選択した日程ごとにコースを選べる
  - [ ] 日程に紐づいたコースのみが表示される
  - [ ] 最大選択可能日程数の制限が機能する
  - [ ] 申込完了後、選択した全日程が保存される

### Phase 4: イベント編集機能 ✅
- **URL**: https://open-campus-system.vercel.app/admin/events/[イベントID]/edit
- **確認項目**:
  - [ ] イベント管理ページから「編集」ボタンで遷移できる
  - [ ] イベント名、説明、概要、公開状態を編集できる
  - [ ] 申込者がいる日程にオレンジ色のハイライトが表示される
  - [ ] 複数日参加設定、最大選択日程数は変更不可（表示のみ）
  - [ ] コース情報は変更不可（表示のみ）
  - [ ] 日程情報は変更不可（表示のみ）
  - [ ] 変更を保存するとイベント管理ページに戻る

### Phase 5: 申込確定管理 ✅
- **URL**: https://open-campus-system.vercel.app/admin/confirmations
- **確認項目**:
  - [ ] ダッシュボードから「申込確定管理」ボタンで遷移できる
  - [ ] イベント選択でフィルタリングできる
  - [ ] 未確定申込者リストと確定済み申込者リストが表示される
  - [ ] 学校名、氏名、申込日時でソートできる
  - [ ] 同一イベント内の重複申込がオレンジ色でハイライトされる
  - [ ] 申込者をクリックすると詳細情報が表示される
  - [ ] 選択した日程とコースで確定できる
  - [ ] 確定後、申込者が「確定済み」リストに移動する
  - [ ] 確定解除ができる
  - [ ] 確定時に`current_count`が増加する
  - [ ] 確定解除時に`current_count`が減少する

### 既存機能の動作確認
- **ダッシュボード**: https://open-campus-system.vercel.app/admin/dashboard
  - [ ] イベントごとに統計情報が表示される
  - [ ] 開催日程の申込状況が表示される
  - [ ] 申込者一覧が表示される
  - [ ] CSVエクスポートが機能する

## データベース確認

### 新規テーブル
1. **event_courses** - コース情報
   - [ ] レコードが正しく作成される
   - [ ] イベント削除時にカスケード削除される

2. **course_date_associations** - コース日程関連付け
   - [ ] コースと日程の関連付けが保存される
   - [ ] コース削除時にカスケード削除される

3. **applicant_visit_dates** - 申込者選択日程
   - [ ] 複数日程選択時に複数レコードが作成される
   - [ ] 優先順位(priority)が保存される
   - [ ] コース選択(selected_course_id)が保存される

### 拡張カラム
1. **open_campus_events**
   - [ ] `overview` - イベント概要
   - [ ] `allow_multiple_dates` - 複数日参加可能フラグ

2. **applicants**
   - [ ] `confirmed_date_id` - 確定日程ID
   - [ ] `confirmed_course_id` - 確定コースID
   - [ ] `confirmed_at` - 確定日時
   - [ ] `confirmed_by` - 確定者
   - [ ] `status` - ステータス(ENUM型)

### データベース関数
- [ ] `increment_visit_count` - 確定時のカウント増加
- [ ] `decrement_visit_count` - 確定解除時のカウント減少 ⚠️ **要実行**

## 完了した修正

### Next.js 15対応
- ✅ 動的ルートのparamsをPromise型に変更
  - `app/api/admin/events/[id]/route.ts`
  - `app/api/events/[id]/route.ts`
  - `app/admin/events/[id]/edit/page.tsx`

### TypeScript型エラー修正
- ✅ Supabaseクエリ結果の型推論エラーを修正
  - `app/api/admin/confirmations/route.ts`

## トラブルシューティング

### デプロイが失敗する場合
1. Vercelダッシュボードでビルドログを確認
2. GitHubに最新のコミットがプッシュされているか確認
3. 環境変数が正しく設定されているか確認

### 確定機能が動作しない場合
- **原因**: `decrement_visit_count`関数が作成されていない
- **対処**: `docs/database_function_decrement_count.sql`をSupabaseで実行

### 日程の申込数が正しく表示されない
- **原因**: 既存データとの整合性の問題
- **対処**: 以下のSQLで再計算
```sql
UPDATE open_campus_dates d
SET current_count = (
  SELECT COUNT(DISTINCT a.id)
  FROM applicants a
  WHERE a.confirmed_date_id = d.id
  AND a.status = 'confirmed'
);
```

## 注意事項

### イベント編集の制限
- 申込者がいる日程がある場合、以下は編集不可:
  - 日程の追加・削除・変更
  - コースの追加・削除・変更
  - 複数日参加設定の変更
  - 最大選択日程数の変更

### 容量管理の変更
- **旧**: 申込時に自動的に`current_count`が増加
- **新**: 管理者が確定したときのみ`current_count`が増加
- これにより、申込者数と実参加者数を分離管理できる

### データ移行について
- 既存の申込データは保持されます
- 既存申込者は`applicant_visit_dates`テーブルに自動的にマイグレーションされません
- 必要に応じて以下のSQLでマイグレーション:
```sql
INSERT INTO applicant_visit_dates (applicant_id, visit_date_id, priority)
SELECT id, visit_date_id, 1
FROM applicants
WHERE visit_date_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

## 最終確認リスト

- [ ] データベース関数の実行完了
- [ ] 全ページが正常に表示される
- [ ] イベント作成から申込、確定までの一連の流れが動作する
- [ ] 既存データとの互換性が保たれている
- [ ] LINE連携機能が正常に動作する

---

**デプロイ完了日**: [日付を記入]
**確認者**: [名前を記入]
**問題点**: [あれば記入]
