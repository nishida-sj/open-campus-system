# Multi-Tenant Migration Details

## 完了状況: 全6Phase完了 (2026-03-02)

| Phase | 内容 | 状態 |
|-------|------|------|
| Phase 1 | DBマイグレーション (`20260302_multi_tenant.sql`) | 完了 |
| Phase 2 | テナント基盤 (lib/tenant.ts, middleware, auth, types) | 完了 |
| Phase 3 | 全27 APIルート → `/api/[tenant]/...` | 完了 |
| Phase 4 | 全17ページ → `/[tenant]/...` | 完了 |
| Phase 5 | LINE Webhook マルチテナント対応 | 完了 |
| Phase 6 | 旧ファイル削除・ビルド検証 | 完了 |

## テナント一覧
| slug | name | display_name |
|------|------|-------------|
| `ise-hoken` | 伊勢保健衛生専門学校 | 伊勢保健衛生専門学校 |
| `ise-gakuen` | 伊勢学園高等学校 | 伊勢学園高等学校 |

## ルート構造

### ページ (17)
```
app/page.tsx                              ← テナント選択画面
app/[tenant]/page.tsx                     ← イベント一覧
app/[tenant]/apply/page.tsx               ← 申込フォーム
app/[tenant]/apply/success/page.tsx       ← 申込完了
app/[tenant]/admin/layout.tsx             ← 管理画面レイアウト
app/[tenant]/admin/login/page.tsx
app/[tenant]/admin/dashboard/page.tsx
app/[tenant]/admin/events/page.tsx
app/[tenant]/admin/events/[id]/edit/page.tsx
app/[tenant]/admin/confirmations/page.tsx
app/[tenant]/admin/confirmed-list/page.tsx
app/[tenant]/admin/broadcast/page.tsx
app/[tenant]/admin/broadcast/history/page.tsx
app/[tenant]/admin/ai-settings/page.tsx
app/[tenant]/admin/email-settings/page.tsx
app/[tenant]/admin/site-settings/page.tsx
app/[tenant]/admin/users/page.tsx
app/[tenant]/admin/login-logs/page.tsx
```

### API Routes (28 + 1 webhook)
```
app/api/[tenant]/events/public/route.ts
app/api/[tenant]/events/[id]/route.ts
app/api/[tenant]/site-settings/route.ts
app/api/[tenant]/courses/route.ts
app/api/[tenant]/open-campus-dates/route.ts
app/api/[tenant]/apply/route.ts
app/api/[tenant]/auth/log-login/route.ts
app/api/[tenant]/admin/me/route.ts
app/api/[tenant]/admin/events/route.ts
app/api/[tenant]/admin/events/[id]/route.ts
app/api/[tenant]/admin/applicants/route.ts
app/api/[tenant]/admin/applicants/[id]/route.ts  ← 日程・コース変更
app/api/[tenant]/admin/confirmations/route.ts
app/api/[tenant]/admin/confirmations/bulk/route.ts
app/api/[tenant]/admin/confirmed-applicants/route.ts
app/api/[tenant]/admin/users/route.ts
app/api/[tenant]/admin/roles/route.ts
app/api/[tenant]/admin/dates/route.ts
app/api/[tenant]/admin/login-logs/route.ts
app/api/[tenant]/admin/ai-settings/route.ts
app/api/[tenant]/admin/ai-prompt/route.ts
app/api/[tenant]/admin/ai-usage/route.ts
app/api/[tenant]/admin/email-settings/route.ts
app/api/[tenant]/admin/site-settings/route.ts
app/api/[tenant]/admin/maintenance-invite/route.ts
app/api/[tenant]/admin/broadcast/send/route.ts
app/api/[tenant]/admin/broadcast/history/route.ts
app/api/[tenant]/admin/broadcast/applicants/route.ts
app/api/line/webhook/route.ts             ← テナント共通
```

## LINE Webhook テナント識別
1. リクエストボディに対して全テナントの `line_channel_secret` でHMAC-SHA256署名を検証
2. 一致したテナントでイベント処理
3. フォールバック: 環境変数 `LINE_CHANNEL_SECRET` で検証

## 削除済みファイル
- `app/admin/` (旧管理画面ページ)
- `app/apply/` (旧申込ページ)
- `app/api/admin/` (旧管理API)
- `app/api/events/`, `app/api/apply/`, `app/api/site-settings/`
- `app/api/courses/`, `app/api/open-campus-dates/`, `app/api/auth/`
- `app/test/`

## RLS セキュリティモデル
- 全APIは `supabaseAdmin` (service_role) → RLSバイパス
- テナント分離はアプリコードの `.eq('tenant_id', tenant.id)` が担う
- 多層防御: `set_tenant_context()` / `get_current_tenant_id()` ヘルパー + 16テーブルにauthenticated用RLSポリシー追加済み
- マイグレーション: `20260302_rls_tenant_isolation.sql`

## DB マイグレーション実行状況 (全完了 2026-03-02)
| ファイル | 内容 | 実行 |
|---------|------|------|
| `20260302_multi_tenant.sql` | tenants作成、全テーブルtenant_id追加、インデックス | ✅ |
| `20260302_seed_ise_gakuen.sql` | ise-gakuenシードデータ | ✅ |
| `20260302_rls_tenant_isolation.sql` | RLSポリシー16テーブル | ✅ |

## ise-gakuen シードデータ
- 管理者: `admin@ise-gakuen.ac.jp` (super_admin, must_change_password)
- Supabase Auth登録: ✅完了
- site_settings: 緑テーマ (#2d5a27)
- ai_settings: 10キー (AI無効状態)

## テナント管理UI (実装済み)
- ページ: `app/[tenant]/admin/tenant-settings/page.tsx`
- API: `app/api/[tenant]/admin/tenant-settings/route.ts` (GET/PATCH)
- SUPER_ADMINのみアクセス可
- 機密情報はマスク表示、変更時のみ送信、"CLEAR"で明示削除
- サイドバーに追加済み（layout.tsx）

## 環境変数 (整理済み)
- **必須**: SUPABASE_*, NEXT_PUBLIC_APP_URL
- **フォールバック**: LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET, OPENAI_API_KEY
  - テナントDBに設定がない場合のみ使用
- **廃止予定**: NEXT_PUBLIC_LINE_BOT_BASIC_ID, ADMIN_PASSWORD, TOKEN_SECRET, OPENAI_MODEL/MAX_TOKENS/TEMPERATURE
  - DB (tenants / ai_settings) に移行済み

## デプロイ状況 (2026-03-05)
- ビルド検証: ✅ 成功（18ページ + 30 APIルート、エラー・警告なし）
- コードスキャン: ✅ 旧ルート参照なし、ハードコード値なし、廃止環境変数使用なし、TODO/FIXMEなし
- リモートpush: ✅ 8コミットpush済み → Vercel自動デプロイ

## Gitコミット履歴 (マルチテナント関連)
```
0b4ce02 Fix: Add table existence checks to all migration steps
097f35b Fix: Remove invalid setting_key constraint for site_settings
525a177 Fix: Make multi-tenant migration idempotent
a57ecd7 Refactor: Remove hardcoded LINE Bot ID, update env documentation
ad04fc0 Feature: Add tenant settings management UI
12c66e0 Security: Add tenant-scoped RLS policies for defense-in-depth
62c0f7b DB: Add ise-gakuen tenant seed data
98560ca Feature: Multi-tenant architecture migration
```

## 今後の作業（推奨順）

### 1. ise-gakuen LINE Bot設定（優先度：高）
- LINE Developers コンソールで ise-gakuen 用チャネル作成
- `/ise-gakuen/admin/tenant-settings` から設定：
  - LINE Channel Access Token
  - LINE Channel Secret
  - LINE Bot Basic ID（`@xxx` 形式）
- LINE Developers の Webhook URL: `https://{domain}/api/line/webhook`

### 2. ise-gakuen 動作テスト（優先度：高）
- `/ise-gakuen` イベント一覧表示確認
- `/ise-gakuen/admin/login` で `admin@ise-gakuen.ac.jp` ログイン確認
- イベント作成 → 申込フォーム → 申込テスト
- LINE Bot 友達追加 → メッセージ送受信テスト

### 3. ise-hoken キーのDB移行（優先度：中）
- `/ise-hoken/admin/tenant-settings` から LINE/OpenAI キー設定
- 設定後は `.env.local` のフォールバック値は不要
- 現状は環境変数フォールバックで問題なく動作中

### 4. ise-gakuen イベント・コンテンツ作成（優先度：中）
- 管理画面からオープンキャンパスイベント作成
- 日程・コース設定
- サイト設定（ヘッダー・フッター）
- AI設定（OpenAI APIキー設定）

### 5. 本番運用準備（優先度：低）
- メール通知設定（SMTP）
- AI自動応答の有効化・プロンプト調整
- メンテナンスモード解除
