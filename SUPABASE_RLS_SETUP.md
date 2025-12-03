# Supabase RLS（Row Level Security）セットアップ手順

## 📋 概要

このドキュメントは、Supabaseセキュリティ警告に対応するためのRLS設定手順を説明します。

## 🔴 対応するセキュリティ警告

- **18件のERRORレベル警告**
  - RLS無効のテーブル: 16件
  - Security Definer View: 2件

## 🎯 実施内容

### 優先度1: 個人情報を含むテーブル
- `applicants` - 申込者情報（氏名、メールアドレス等）
- `email_settings` - メール設定情報

### 優先度2: その他のテーブル（全16テーブル）
- イベント関連: `open_campus_events`, `open_campus_dates`, `event_courses`
- コース関連: `courses`, `course_date_associations`, `course_date_capacities`
- 申込関連: `applicant_visit_dates`, `application_logs`, `confirmed_participations`
- 通知関連: `broadcast_history`, `notification_logs`
- バックアップ: `applicants_backup`, `open_campus_dates_backup`

## 📝 実行手順

### ステップ1: Supabase Dashboardにアクセス

1. ブラウザで Supabase Dashboard を開く
2. プロジェクト `srhacgwkpfirjvykhrct` を選択
3. 左サイドバーから **SQL Editor** をクリック

### ステップ2: SQLスクリプトを実行

1. SQL Editorで **New query** をクリック
2. `supabase-rls-setup.sql` ファイルの内容をコピー
3. エディタにペースト
4. **Run** ボタンをクリック
5. 「Success. No rows returned」と表示されれば成功

### ステップ3: 設定の確認

以下のSQLを実行して、RLSが有効化されていることを確認：

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**確認項目:**
- `rowsecurity` 列が `true` になっていること
- 対象の18テーブルすべてが含まれていること

## ⚙️ 設定内容の説明

### RLSポリシー

各テーブルに以下のポリシーを適用：

```sql
CREATE POLICY "Service role only access" ON public.{table_name}
  FOR ALL
  USING (auth.role() = 'service_role');
```

**意味:**
- `service_role` キー（サーバーサイド用）でのみアクセス可能
- 外部からの直接アクセスを完全にブロック
- 既存のアプリケーション（supabaseAdminクライアント使用）は影響を受けない

## ✅ 既存アプリケーションへの影響

### 影響なし

現在のアプリケーションは以下の理由で引き続き正常動作します：

1. **サーバーサイドでのみアクセス**
   - すべてのデータベース操作はAPIルート経由
   - `lib/supabase.ts` の `supabaseAdmin` を使用
   - `service_role` キーで認証されているため全アクセス可能

2. **フロントエンドから直接アクセスしていない**
   - ブラウザから直接Supabaseにアクセスしていない
   - RLSポリシーの対象外

### 保護される部分

1. **Supabase Studio**
   - 管理画面からのテーブルの直接閲覧・編集が制限される
   - service_roleでログインすれば引き続きアクセス可能

2. **PostgREST API**
   - 外部からの直接APIアクセスを防止
   - 不正なデータアクセスを完全にブロック

## 🔧 トラブルシューティング

### エラー: "permission denied for table"

**原因:**
既存のポリシーと競合している可能性があります。

**対処法:**
```sql
-- 既存のポリシーを確認
SELECT * FROM pg_policies WHERE tablename = '{テーブル名}';

-- 必要に応じて削除
DROP POLICY "{ポリシー名}" ON public.{テーブル名};
```

### エラー: "table does not exist"

**原因:**
テーブル名が間違っているか、テーブルが削除されています。

**対処法:**
該当するテーブルのALTER TABLE文とCREATE POLICY文をコメントアウトして再実行してください。

## 📚 参考リンク

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Linter - Security Definer View](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)
- [Database Linter - RLS Disabled](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public)

## 🔄 今後の対応（参考）

### Security Definer Viewの対処

現時点では影響がありませんが、将来的に以下のViewを見直すことを推奨：
- `public.date_total_capacities`
- `public.ai_usage_monthly_summary`

**対処方法:**
1. 現在のView定義を確認
2. `SECURITY INVOKER` オプションで再作成
3. 必要に応じて適切な権限を設定

### より細かい権限設定

現在は `service_role` のみアクセス可能にしていますが、将来的に以下のような細かい設定も可能：

```sql
-- 例: イベント情報は誰でも読み取り可能
CREATE POLICY "Public read access" ON public.open_campus_events
  FOR SELECT
  USING (true);

-- 例: 管理者のみ書き込み可能
CREATE POLICY "Admin write access" ON public.open_campus_events
  FOR INSERT
  USING (auth.role() = 'authenticated' AND auth.jwt()->>'role' = 'admin');
```

## ✨ 完了

このセットアップにより、Supabaseセキュリティ警告のうち16件（RLS関連）が解決されます。

残りの2件（Security Definer View）は将来的な改善項目として記録されています。
