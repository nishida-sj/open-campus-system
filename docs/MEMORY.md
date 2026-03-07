# Open Campus System - Project Memory

## Overview
オープンキャンパス申込管理システム（高等学校・専門学校向け）。
申込フォーム、LINE連携、AI自動応答、管理ダッシュボードを備えたマルチテナントWebアプリ。

## Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Backend**: Next.js API Routes, Supabase (PostgreSQL)
- **Auth**: Supabase Auth + LINE Messaging API
- **AI**: OpenAI GPT-4o mini (LINE自動応答オプション)
- **Email**: Nodemailer (SMTP)
- **Deploy**: Vercel
- **Validation**: Zod 4

## Architecture: Multi-Tenant (実装済み)
- **方式**: tenant_id カラム方式（1つのSupabaseプロジェクト内）
- **テナント**: `ise-hoken`（伊勢保健衛生専門学校）, `ise-gakuen`（伊勢学園高等学校）
- **ルーティング**: パスベース `/[tenant]/...`
- **LINE Webhook**: 単一エンドポイント `/api/line/webhook`、HMAC-SHA256署名でテナント識別
- **DB**: `tenants`テーブル + 全テーブルに`tenant_id`カラム
- **詳細**: [multi-tenant.md](multi-tenant.md) 参照

## Key Directories
- `app/[tenant]/` - テナントスコープのページ（公開・管理画面）
- `app/[tenant]/admin/` - 管理画面 (dashboard, events, confirmations, ai-settings, etc.)
- `app/[tenant]/apply/` - 申込フォーム
- `app/api/[tenant]/` - テナントスコープのAPIエンドポイント (29ルート)
- `app/api/line/webhook/` - LINE Webhook（テナント共通、署名で振り分け）
- `lib/` - Utilities (tenant, supabase, auth, ai-response, validation, usage-monitor, etc.)
- `types/` - TypeScript type definitions
- `supabase/` - Supabase config & migrations

## Key Files
- `lib/tenant.ts` - テナント解決ロジック（5分キャッシュ）
- `lib/auth.ts` - 認証（tenant_id対応）
- `lib/ai-response.ts` - AI応答生成（テナント別OpenAIクライアント）
- `lib/usage-monitor.ts` - AI使用量管理（テナント別）
- `lib/conversation-history.ts` - 会話履歴（テナント別）
- `lib/school-knowledge.ts` - キーワード判定（ハードコードなし）
- `middleware.ts` - テナントslug抽出、x-tenant-slugヘッダー設定
- `supabase/migrations/20260302_multi_tenant.sql` - マルチテナントDB移行

## Key Features
1. **申込フォーム**: イベント選択、複数日程、コース選択
2. **LINE連携**: Webhook, 友達追加, トークン認証, 通知送信
3. **AI自動応答**: OpenAI連携、動的プロンプト(DB管理)、メンテナンスモード、自動追記ルール、期間限定ルール → **詳細: [ai-features.md](ai-features.md)**
4. **管理画面**: イベント管理、申込確定、確定者管理、CSV一括確定/出力
5. **メール通知**: SMTP設定、HTML/テキスト両対応
6. **マルチテナント**: テナント別データ隔離、テナント別LINE/OpenAI設定
7. **メンテナンスモード**: テスター招待コード(ON時のみ表示)、テスターリスト管理

## Database Tables (Supabase) - 全テーブルtenant_id付き
- `tenants` - テナントマスタ（slug, LINE/OpenAI credentials）
- `open_campus_events` - イベントマスタ
- `open_campus_dates` - 開催日程
- `event_courses` - コースマスタ
- `course_date_associations` - コース・日程関連
- `applicants` - 申込者
- `applicant_visit_dates` - 申込者・希望日程
- `applicant_courses` - 申込者・希望コース
- `confirmed_participations` - 確定参加者
- `notification_logs` - 通知履歴
- `broadcast_history` - 一斉送信履歴
- `email_settings` - メールサーバー設定
- `site_settings` - サイト設定（電話番号・営業時間等）
- `ai_settings` - AI設定（key-value、テナント+キーでユニーク）
- `ai_usage_logs` - AI使用量ログ
- `ai_prompts` - AIプロンプト管理
- `conversation_history` - 会話履歴
- `application_logs` - 申込ログ
- `login_logs` - ログインログ
- `users` / `user_roles` / `roles` - ユーザー管理

## API Pattern (全ルート共通)
```typescript
const { tenant: slug } = await params;
const tenant = await getTenantBySlug(slug);
// 全クエリに .eq('tenant_id', tenant.id)
```

## Page Pattern (全ページ共通)
```typescript
const { tenant } = useParams<{ tenant: string }>();
// fetchは /api/${tenant}/admin/... を使用
// ナビゲーションは /${tenant}/admin/... を使用
```

## Current Status (2026-03-06)
- マルチテナント移行: ✅ 全完了（コード・DB・RLS・デプロイ）
- ise-gakuen Auth登録: ✅ admin@ise-gakuen.ac.jp
- AI期間限定ルール機能: ✅ 追加済み（2026-03-06）
- ビルド・コードスキャン: ✅ 問題なし
- 次の作業: [multi-tenant.md](multi-tenant.md) の「今後の作業」参照

## Author
Mikio (M-NISHIDA)
