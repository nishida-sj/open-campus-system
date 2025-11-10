# オープンキャンパス申込管理システム - セットアップ状況

## 📋 プロジェクト概要

**目的**: 高等学校・専門学校向けのオープンキャンパス申込管理システム
**技術スタック**: Next.js 16 + TypeScript + Supabase + LINE Messaging API + Vercel
**作業ディレクトリ**: `D:\LINE\open-campus-system`

---

## ✅ 完了した作業

### Phase 0: 初期セットアップ（Step 1-7）

#### Step 1: 開発環境の準備
- [x] Node.js v18以上 インストール確認済み
- [x] Git インストール確認済み
- [x] VS Code セットアップ完了

#### Step 2: プロジェクトの初期化
- [x] 作業ディレクトリ作成: `D:\LINE\open-campus-system`
- [x] Git リポジトリ初期化完了
- [x] Next.js 16 プロジェクト作成完了
  - TypeScript: 有効
  - Tailwind CSS v4: 有効
  - App Router: 使用
  - ESLint: 有効

#### Step 3: パッケージのインストール
- [x] `@supabase/supabase-js` v2.80.0
- [x] `@supabase/auth-helpers-nextjs` v0.10.0
- [x] `@line/bot-sdk` v10.5.0
- [x] `zod` v4.1.12
- [x] `date-fns` v4.1.0

#### Step 4-5: 基本ファイルの作成
- [x] `types/index.ts` - 型定義ファイル
- [x] `lib/supabase.ts` - Supabaseクライアント
- [x] `lib/validation.ts` - Zodバリデーションスキーマ

#### Step 6: 環境変数の設定
- [x] `.env.local` 作成済み
- [x] LINE認証情報設定済み
- [x] Supabase認証情報設定済み
- [x] `TOKEN_SECRET` 生成済み

#### Step 7: データベースセットアップ
- [x] Supabaseアカウント作成完了
- [x] データベーステーブル作成完了
  - open_campus_dates（開催日程）
  - courses（コース・学科）
  - applicants（申込者）
  - application_logs（申込ログ）
- [x] サンプルデータ投入完了

---

### Phase 2: 申込フォームの実装 ✅ **完了**

#### 2-1: APIエンドポイントの作成
- [x] `app/api/courses/route.ts` - コース一覧取得API
- [x] `app/api/open-campus-dates/route.ts` - 開催日程取得API
- [x] `app/api/apply/route.ts` - 申込処理API
  - バリデーション
  - 重複チェック
  - 定員チェック
  - トークン生成（32バイト16進数）
  - applicantsテーブルINSERT
  - application_logsログ記録
  - increment_visit_count RPC呼び出し

#### 2-2: APIテストページの作成
- [x] `app/test/page.tsx` - API動作確認ページ
  - コース一覧取得テスト
  - 開催日程取得テスト
  - 申込処理テスト

#### 2-3: 申込フォーム画面の作成
- [x] `app/apply/page.tsx` - ユーザー向け申込フォーム
  - レスポンシブデザイン
  - 13個の入力フィールド実装
  - リアルタイムバリデーション
  - API連携（コース・日程自動取得）
  - 残席数表示
  - 保護者情報の条件付き表示
- [x] `app/apply/success/page.tsx` - 申込完了ページ
  - 30分カウントダウンタイマー
  - LINE友達追加ボタン
  - 申込番号（token）表示
  - 友達追加手順説明

#### データベース改善
- [x] `visit_date` → `visit_date_id` (UUID)に変更
- [x] 外部キー制約とインデックス追加
- [x] `increment_visit_count` 関数作成
- [x] 移行SQLドキュメント作成
  - `docs/database_migration_visit_date.sql`
  - `docs/database_function_increment_visit_count.sql`
  - `docs/SUPABASE_MIGRATION_GUIDE.md`

---

### Phase 3: LINE連携の実装 ✅ **完了**

#### 3-1: LINE Webhook API作成
- [x] `app/api/line/webhook/route.ts` - LINE Webhookエンドポイント
  - LINE署名検証
  - followイベント処理（友達追加時）
  - messageイベント処理（トークン検証）
  - トークン有効期限チェック
  - ステータス更新（pending → completed）
  - LINE User ID保存
  - 申込完了メッセージ送信

### Phase 4: 管理画面の実装 ✅ **完了**

#### 4-1: ログインページ作成
- [x] `app/admin/login/page.tsx` - 簡易パスワード認証
  - sessionStorage認証状態管理
  - ダッシュボードへリダイレクト

#### 4-2: 管理API作成
- [x] `app/api/admin/applicants/route.ts` - 申込者一覧取得
- [x] `app/api/admin/dates/route.ts` - 開催日程一覧取得

#### 4-3: 管理ダッシュボード作成
- [x] `app/admin/dashboard/page.tsx` - 管理ダッシュボード
  - 統計情報表示（4カード）
  - 開催日程一覧（プログレスバー付き）
  - 申込者一覧テーブル
  - CSVエクスポート機能（BOM付きUTF-8）
  - ログアウト機能

---

## ⏳ 次の作業（Phase 5）

### Phase 5: 本番デプロイ準備 🔄 **次のステップ**

#### 予定項目:
1. .env.example ファイル作成
2. README.md 更新
3. セキュリティチェック
4. パフォーマンス最適化
5. Vercelデプロイ
6. LINE Webhook URL本番設定

---

## 📂 現在のプロジェクト構造

```
D:\LINE\open-campus-system\
├── app/
│   ├── api/
│   │   ├── apply/
│   │   │   └── route.ts          ✅ 申込処理API
│   │   ├── courses/
│   │   │   └── route.ts          ✅ コース一覧API
│   │   ├── open-campus-dates/
│   │   │   └── route.ts          ✅ 開催日程API
│   │   ├── line/
│   │   │   └── webhook/          ⏳ 次に実装
│   │   └── admin/                ⏸️  Phase 4
│   ├── apply/
│   │   ├── page.tsx              ✅ 申込フォーム
│   │   └── success/
│   │       └── page.tsx          ✅ 申込完了ページ
│   ├── test/
│   │   └── page.tsx              ✅ APIテストページ
│   ├── admin/                    ⏸️  Phase 4
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   ├── supabase.ts               ✅ Supabaseクライアント
│   └── validation.ts             ✅ Zodバリデーション
├── types/
│   └── index.ts                  ✅ 型定義
├── docs/
│   ├── SETUP_STATUS.md           ✅ このファイル
│   ├── SUPABASE_MIGRATION_GUIDE.md  ✅ DB移行ガイド
│   ├── database_migration_visit_date.sql  ✅
│   └── database_function_increment_visit_count.sql  ✅
├── .env.local                    ✅ 環境変数
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## 🗄️ データベーステーブル構造

### applicants（申込者）
```sql
- id: UUID (PRIMARY KEY)
- name: VARCHAR(100) NOT NULL
- kana_name: VARCHAR(100)
- email: VARCHAR(255) NOT NULL
- phone: VARCHAR(20) NOT NULL
- school_name: VARCHAR(200) NOT NULL
- school_type: VARCHAR(50)
- grade: VARCHAR(50) NOT NULL
- graduation_year: INTEGER
- postal_code: VARCHAR(10)
- prefecture: VARCHAR(20)
- address: TEXT
- guardian_name: VARCHAR(100)
- guardian_phone: VARCHAR(20)
- guardian_attendance: BOOLEAN DEFAULT FALSE
- interested_course_id: UUID (FK: courses.id)
- visit_date_id: UUID NOT NULL (FK: open_campus_dates.id)  ✅ 改善済み
- remarks: TEXT
- token: VARCHAR(64)
- token_expires_at: TIMESTAMP
- line_user_id: VARCHAR(100)
- status: VARCHAR(20) DEFAULT 'pending'
- created_at: TIMESTAMP DEFAULT NOW()
- updated_at: TIMESTAMP DEFAULT NOW()
```

### open_campus_dates（開催日程）
```sql
- id: UUID (PRIMARY KEY)
- date: DATE NOT NULL
- capacity: INTEGER NOT NULL
- current_count: INTEGER DEFAULT 0
- is_active: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP DEFAULT NOW()
- updated_at: TIMESTAMP DEFAULT NOW()
```

### courses（コース・学科）
```sql
- id: UUID (PRIMARY KEY)
- name: VARCHAR(100) NOT NULL
- category: VARCHAR(50)
- description: TEXT
- capacity_per_day: INTEGER
- is_active: BOOLEAN DEFAULT TRUE
- display_order: INTEGER
- created_at: TIMESTAMP DEFAULT NOW()
```

### application_logs（申込ログ）
```sql
- id: UUID (PRIMARY KEY)
- applicant_id: UUID (FK: applicants.id)
- action: VARCHAR(50) NOT NULL
- ip_address: VARCHAR(45)
- user_agent: TEXT
- created_at: TIMESTAMP DEFAULT NOW()
```

### Supabase関数
- `increment_visit_count(date_id UUID)` - 申込数インクリメント

---

## 📊 環境変数の状態

`.env.local` ファイル:

```bash
# Supabase - ✅ 設定済み
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# LINE - ✅ 設定済み
LINE_CHANNEL_ACCESS_TOKEN=xxx
LINE_CHANNEL_SECRET=xxx
NEXT_PUBLIC_LINE_BOT_BASIC_ID=@xxx

# Application - ✅ 設定済み
NEXT_PUBLIC_APP_URL=http://localhost:3000
TOKEN_SECRET=xxx
NEXT_PUBLIC_ADMIN_PASSWORD=admin123
```

---

## 🧪 動作確認済み機能

### APIエンドポイント
- ✅ GET `/api/courses` - コース一覧取得
- ✅ GET `/api/open-campus-dates` - 開催日程取得（残席計算）
- ✅ POST `/api/apply` - 申込処理（完全動作確認済み）

### フロントエンド
- ✅ `/apply` - 申込フォーム
  - コース・日程の動的取得
  - バリデーション
  - 保護者情報の条件付き表示
  - 残席数表示
  - 申込送信成功
- ✅ `/apply/success` - 申込完了ページ
  - カウントダウンタイマー動作
  - LINE友達追加導線
  - トークン表示
- ✅ `/test` - APIテストページ

---

## 🎯 次の実装予定（Phase 3）

### LINE Webhook実装
1. `app/api/line/webhook/route.ts` の作成
   - LINE署名検証
   - followイベント（友達追加）処理
   - トークン検証とステータス更新
   - 申込完了メッセージ送信
2. LINE Developers Console設定
   - Webhook URL設定
   - Messaging API有効化

---

## 📝 メモ

### 開発サーバーの起動
```bash
npm run dev
```
→ http://localhost:3000

### ビルド確認
```bash
npm run build
```

### Git操作
```bash
# Phase 2完了コミット
git add .
git commit -m "Phase 2: Implement application form and APIs"
git push origin main
```

---

## 🚨 注意事項

1. **外付けSSDの取り扱い**
   - 開発サーバー停止後に取り外し
   - 定期的にGitHubへバックアップ

2. **環境変数の管理**
   - `.env.local` は絶対にGitにコミットしない
   - Supabase Service Role Keyは厳重管理

3. **LINEトークンの管理**
   - Channel Access Tokenは公開しない
   - Webhookは本番URLのみに設定（開発時はngrok等使用）

---

## ✅ 進捗チェックリスト

- [x] Phase 0: 初期セットアップ
- [x] Phase 1: データベースセットアップ
- [x] Phase 2: 申込フォーム実装
- [x] Phase 3: LINE連携実装
- [x] Phase 4: 管理画面実装
- [ ] Phase 5: 本番デプロイ ← **次のステップ**

---

## Supabase情報
- プロジェクトURL: https://app.supabase.com
- パスワード: ErhaZHZr8Q9A56q4

最終更新: 2025年11月10日
作成者: Mikio
進捗: Phase 4完了 ✅ / Phase 5準備中
