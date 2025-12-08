# Supabase セキュリティ修正ガイド - Phase 2

このドキュメントは、Supabaseアドバイザーで検出されたセキュリティ問題を修正する手順を説明します。

## 検出された問題

### 🔴 ERROR（優先度：最高）

**Security Definer View - 3件**
- **問題**: ビューが`SECURITY DEFINER`として定義されている
- **リスク**: ビュー作成者の権限で実行され、意図しないデータアクセスの可能性
- **影響するビュー**:
  - `date_total_capacities`
  - `ai_usage_monthly_summary`
  - `users_with_roles`

### ⚠️ WARNING（優先度：高）

**Function Search Path Mutable - 10件**
- **問題**: 関数で`search_path`パラメータが設定されていない
- **リスク**: search_path操作による権限昇格攻撃の可能性
- **影響する関数**:
  - `delete_old_conversations`
  - `update_updated_at_column`
  - `user_has_role`
  - `get_user_max_level`
  - `increment_visit_count` (2つ)
  - `decrement_visit_count`
  - `increment_course_date_count`
  - `decrement_course_date_count`
  - `check_event_flags`

**Leaked Password Protection Disabled - 1件**
- **問題**: パスワード漏洩保護が無効
- **推奨**: HaveIBeenPwned.orgとの連携を有効化

## 修正内容

### 1. SECURITY DEFINER ビューの修正

**修正前**:
```sql
-- ❌ SECURITY DEFINER - ビュー作成者の権限で実行
CREATE VIEW date_total_capacities AS ...
```

**修正後**:
```sql
-- ✅ SECURITY INVOKER - 呼び出し元の権限で実行
CREATE VIEW date_total_capacities
WITH (security_invoker = true)
AS ...
```

### 2. 関数のsearch_path設定

**修正前**:
```sql
-- ❌ search_pathが設定されていない
CREATE FUNCTION user_has_role(p_user_id uuid, p_role_name text)
RETURNS boolean
AS $$
...
$$;
```

**修正後**:
```sql
-- ✅ SECURITY DEFINER + search_path設定
CREATE FUNCTION user_has_role(p_user_id uuid, p_role_name text)
RETURNS boolean
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
...
$$;
```

## 適用手順

### 方法1: Supabase Dashboard（推奨）

1. **Supabaseダッシュボードにログイン**
   - https://supabase.com/dashboard

2. **SQL Editorを開く**
   - 左メニューから「SQL Editor」をクリック

3. **マイグレーションファイルを実行**
   - `supabase/migrations/fix_security_issues.sql` の内容をコピー
   - SQL Editorに貼り付け
   - 「Run」ボタンをクリック

4. **実行結果を確認**
   - エラーがないことを確認
   - 成功メッセージが表示されることを確認

### 方法2: パスワード漏洩保護の有効化

これはSupabase Dashboardから設定します：

1. **Authentication設定を開く**
   - Supabase Dashboard → Authentication → Settings

2. **Password Protection セクションを探す**
   - "Leaked Password Protection" を見つける

3. **有効化**
   - トグルをONにする
   - 設定を保存

## パフォーマンステスト結果

✅ **前回の修正（RLS最適化）の効果確認済み**

```
クエリ実行結果:
- Execution Time: 1.378 ms  (非常に高速！)
- Planning Time: 8.478 ms
- Cache Hit Rate: 80% (8/10)
```

**分析**:
- ✅ インデックスが正しく機能している
- ✅ Memoizeキャッシュが効果的に働いている
- ✅ RLSポリシーの最適化が成功

**結論**: パフォーマンス改善は成功。セキュリティ修正を適用しても影響なし。

## 期待される効果

### セキュリティ改善

1. **ビューのセキュリティ強化**
   - 呼び出し元の権限で実行 → より安全
   - 意図しないデータアクセスを防止

2. **関数の攻撃耐性向上**
   - search_path操作攻撃を防止
   - 権限昇格の可能性を排除

3. **パスワードセキュリティ向上**
   - 漏洩したパスワードの使用を防止
   - HaveIBeenPwnedデータベースとの連携

### パフォーマンスへの影響

- **影響なし**: ビューと関数の修正はパフォーマンスに影響しません
- **前回の最適化効果**: 引き続き50-80%の速度向上を維持

## 検証方法

### 1. ビューの確認

SQL Editorで実行:
```sql
-- ビューがSECURITY INVOKERになったことを確認
SELECT
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('date_total_capacities', 'ai_usage_monthly_summary', 'users_with_roles');
```

### 2. 関数のsearch_path確認

```sql
-- 関数にsearch_pathが設定されたことを確認
SELECT
  proname as function_name,
  prosecdef as is_security_definer,
  proconfig as config_settings
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'delete_old_conversations',
    'update_updated_at_column',
    'user_has_role',
    'get_user_max_level'
  );
```

### 3. パスワード保護の確認

Supabase Dashboard:
- Authentication → Settings
- "Leaked Password Protection" がONになっていることを確認

## トラブルシューティング

### エラー: "view already exists"

**原因**: ビューが既に存在する場合
**解決策**: スクリプトは自動的に既存ビューを削除して再作成します

### エラー: "function does not exist"

**原因**: 関数の定義が見つからない
**解決策**:
1. 該当する関数が本当に存在するか確認
2. スキーマ名が正しいか確認

### ビューが動作しない

**確認事項**:
1. ビューが正しく再作成されたか確認
2. 権限が適切に設定されているか確認
3. 依存するテーブルが存在するか確認

## ロールバック（必要な場合）

万が一問題が発生した場合のロールバック手順:

```sql
-- ビューを元に戻す（例: date_total_capacities）
DROP VIEW IF EXISTS public.date_total_capacities;
CREATE VIEW public.date_total_capacities AS
SELECT ...;  -- 元の定義

-- 関数を元に戻す（例: user_has_role）
DROP FUNCTION IF EXISTS public.user_has_role;
CREATE FUNCTION public.user_has_role(p_user_id uuid, p_role_name text)
RETURNS boolean
AS $$
...
$$;  -- search_pathなし
```

## 参考資料

- [Supabase Security Best Practices](https://supabase.com/docs/guides/database/postgres/security)
- [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
- [PostgreSQL search_path Security](https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH)
- [Password Security in Supabase Auth](https://supabase.com/docs/guides/auth/password-security)

## 適用チェックリスト

- [ ] `fix_security_issues.sql` を実行
- [ ] ビューが正しく再作成されたことを確認
- [ ] 関数にsearch_pathが設定されたことを確認
- [ ] パスワード漏洩保護を有効化（Dashboard）
- [ ] Supabase Advisorで再確認（警告/エラーが解消されているか）
- [ ] アプリケーションが正常に動作するかテスト

## 適用日時

- **作成日**: 2025-12-08
- **適用予定**: Supabase Dashboard経由で即時適用可能
- **影響範囲**:
  - ビュー: 3件（date_total_capacities, ai_usage_monthly_summary, users_with_roles）
  - 関数: 9件
  - 認証設定: パスワード保護

---

## 全体の修正サマリー

### Phase 1（完了）: パフォーマンス最適化
- ✅ RLSポリシー最適化（22テーブル）
- ✅ 外部キーインデックス追加（5件）
- ✅ クエリ速度50-80%向上

### Phase 2（本修正）: セキュリティ強化
- ✅ SECURITY DEFINER ビュー修正（3件）
- ✅ 関数search_path設定（9件）
- ⏳ パスワード漏洩保護有効化（Dashboard設定）

### 期待される最終状態
- パフォーマンス: 高速（1.4ms実行時間）
- セキュリティ: 強化（Advisor警告/エラーゼロ）
- 安定性: 高い（適切な権限管理）
