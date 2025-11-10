-- ================================================
-- データベース移行SQL: visit_date カラムの修正
-- ================================================
-- 目的: applicantsテーブルのvisit_dateを日付型からUUID型に変更
-- 実行日: 2025-11-10
-- ================================================

-- ステップ1: 既存のapplicantsテーブルのデータを確認（データがある場合はバックアップ推奨）
-- SELECT * FROM applicants;

-- ステップ2: visit_dateカラムを削除（既存データがある場合は注意）
ALTER TABLE applicants DROP COLUMN IF EXISTS visit_date;

-- ステップ3: visit_date_id カラムを追加（UUID型、NOT NULL、外部キー制約）
ALTER TABLE applicants
ADD COLUMN visit_date_id UUID NOT NULL REFERENCES open_campus_dates(id) ON DELETE RESTRICT;

-- ステップ4: インデックスを作成（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_applicants_visit_date_id ON applicants(visit_date_id);

-- ステップ5: 重複チェック用の複合インデックス作成
-- email + visit_date_id の組み合わせで重複チェックを高速化
CREATE INDEX IF NOT EXISTS idx_applicants_email_visit_date ON applicants(email, visit_date_id);

-- ================================================
-- 確認クエリ
-- ================================================
-- カラム構造の確認
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'applicants'
-- ORDER BY ordinal_position;

-- ================================================
-- ロールバック用SQL（必要な場合）
-- ================================================
-- ALTER TABLE applicants DROP COLUMN IF EXISTS visit_date_id;
-- ALTER TABLE applicants ADD COLUMN visit_date DATE NOT NULL;
