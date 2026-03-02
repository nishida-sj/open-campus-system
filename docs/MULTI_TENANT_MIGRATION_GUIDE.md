# マルチテナント化移行ガイド

## 📋 概要

現在のオープンキャンパス申込管理システムを、複数の学校・組織（テナント）が利用できるマルチテナントシステムに拡張するための開発手順書です。

**対象読者**: 本システムを複数社に展開したい開発者・プロジェクトマネージャー

**前提条件**: 現行システム（シングルテナント版）が稼働していること

---

## 🎯 マルチテナント化の目的

### ビジネス目標
- 複数の学校・組織が同一システムを利用可能にする
- 運用コストの削減（1つのシステムで複数組織をサポート）
- 新規顧客の迅速なオンボーディング
- 各組織のデータを完全に分離して安全性を確保

### 技術目標
- データの完全分離（セキュリティ）
- 組織ごとのカスタマイズ対応
- スケーラビリティの確保
- 運用・保守の効率化

---

## 🏗️ アーキテクチャ設計

### マルチテナントアーキテクチャの選択肢

#### オプション1: スキーマ分離方式（推奨）
**概要**: 各テナントごとに独立したデータベーススキーマを作成

**メリット**:
- データの完全分離（セキュリティ最高）
- テナントごとのバックアップ・リストア容易
- 1テナントの障害が他に影響しない
- データ量に応じたスケーリング可能

**デメリット**:
- スキーマ管理が複雑
- データベース移行時の工数増
- テナント数に応じたリソース消費

**推奨ケース**: 高セキュリティが必要、テナント数が中規模（〜100社）

#### オプション2: テーブル分離方式（Tenant ID方式）
**概要**: 全テナントが同一スキーマを共有、各レコードにtenant_idカラムを追加

**メリット**:
- 実装がシンプル
- スキーマ変更が容易
- クロステナント分析が可能
- 少ないリソースで多数のテナントをサポート

**デメリット**:
- データ分離の実装ミスでリスク大
- 大規模化でパフォーマンス低下の可能性
- Row Level Security (RLS) の厳格な設定が必須

**推奨ケース**: テナント数が多い（100社以上）、予算・リソースが限られる

#### オプション3: データベース分離方式
**概要**: 各テナントごとに完全に独立したデータベースを作成

**メリット**:
- 最高レベルのデータ分離
- テナントごとの独立したスケーリング
- 完全な独立性（メンテナンス・障害対応）

**デメリット**:
- コスト増（データベース数に応じた課金）
- 運用管理が最も複雑
- システム全体のアップデートが困難

**推奨ケース**: エンタープライズ顧客、最高レベルのセキュリティ要件

---

## 📊 推奨アーキテクチャ: スキーマ分離方式

本ガイドでは、**スキーマ分離方式**を推奨し、以下の実装手順を示します。

### システム構成図

```
┌─────────────────────────────────────────┐
│          Application Layer              │
│     (Next.js + Tenant Resolution)       │
└─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ↓                       ↓
┌───────────────┐      ┌───────────────┐
│   Supabase    │      │   Supabase    │
│  公開スキーマ   │      │  テナント用DB  │
│  - tenants    │      │  (各組織専用)  │
│  - users      │      │               │
└───────────────┘      └───────────────┘
```

---

## 🗄️ データベース設計

### Phase 1: 共有スキーマ（公開情報）の作成

#### テーブル: tenants（テナント管理）

```sql
CREATE TABLE public.tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 基本情報
  slug VARCHAR(50) UNIQUE NOT NULL,           -- URLスラッグ (例: abc-high-school)
  name VARCHAR(255) NOT NULL,                 -- 組織名
  display_name VARCHAR(255),                  -- 表示名

  -- 組織情報
  organization_type VARCHAR(50),              -- 学校種別 (高校/専門学校/大学)
  postal_code VARCHAR(10),
  prefecture VARCHAR(20),
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  website_url VARCHAR(500),

  -- システム設定
  database_name VARCHAR(100) UNIQUE,          -- Supabaseプロジェクト識別子
  database_url TEXT,                          -- 専用DBのURL
  database_anon_key TEXT,                     -- 匿名キー（暗号化推奨）

  -- カスタマイズ設定
  logo_url TEXT,                              -- ロゴ画像URL
  primary_color VARCHAR(7),                   -- プライマリカラー (#RRGGBB)
  secondary_color VARCHAR(7),                 -- セカンダリカラー
  custom_domain VARCHAR(255),                 -- カスタムドメイン (例: apply.abc-school.jp)

  -- LINE連携設定（テナントごと）
  line_channel_access_token TEXT,             -- 暗号化必須
  line_channel_secret TEXT,                   -- 暗号化必須
  line_bot_basic_id VARCHAR(100),

  -- メール設定
  smtp_host VARCHAR(255),
  smtp_port INTEGER,
  smtp_user VARCHAR(255),
  smtp_password TEXT,                         -- 暗号化必須
  from_email VARCHAR(255),
  from_name VARCHAR(255),
  use_tls BOOLEAN DEFAULT TRUE,

  -- AI機能設定
  openai_api_key TEXT,                        -- 暗号化必須
  ai_features_enabled BOOLEAN DEFAULT FALSE,

  -- サブスクリプション情報
  plan VARCHAR(50) DEFAULT 'free',            -- free/basic/premium/enterprise
  max_events INTEGER DEFAULT 5,               -- 最大イベント数
  max_applicants_per_event INTEGER DEFAULT 100,
  features JSONB,                             -- 有効な機能リスト

  -- ステータス
  status VARCHAR(20) DEFAULT 'active',        -- active/suspended/trial/closed
  trial_ends_at TIMESTAMP,                    -- トライアル期限
  subscription_starts_at TIMESTAMP,
  subscription_ends_at TIMESTAMP,

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_accessed_at TIMESTAMP
);

-- インデックス
CREATE INDEX idx_tenants_slug ON public.tenants(slug);
CREATE INDEX idx_tenants_status ON public.tenants(status);
CREATE INDEX idx_tenants_database_name ON public.tenants(database_name);
```

#### テーブル: tenant_users（テナント管理者）

```sql
CREATE TABLE public.tenant_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- 認証情報（Supabase Authと連携）
  auth_user_id UUID,                          -- Supabase Auth User ID

  -- 基本情報
  email VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),

  -- 権限
  role VARCHAR(20) DEFAULT 'admin',           -- owner/admin/staff/viewer
  permissions JSONB,                          -- 詳細権限設定

  -- ステータス
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP,

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- 複合ユニーク制約
  UNIQUE(tenant_id, email)
);

-- インデックス
CREATE INDEX idx_tenant_users_tenant_id ON public.tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_email ON public.tenant_users(email);
CREATE INDEX idx_tenant_users_auth_user_id ON public.tenant_users(auth_user_id);
```

#### テーブル: audit_logs（監査ログ）

```sql
CREATE TABLE public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.tenant_users(id) ON DELETE SET NULL,

  -- ログ情報
  action VARCHAR(100) NOT NULL,               -- イベント種別
  resource_type VARCHAR(50),                  -- 対象リソース種別
  resource_id UUID,                           -- 対象リソースID
  details JSONB,                              -- 詳細情報
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
```

---

### Phase 2: テナント専用スキーマの作成

各テナントの専用データベースには、現行システムのテーブル構造をそのまま使用します。

#### テナント専用テーブル（現行システムと同じ）

```
- open_campus_events
- open_campus_dates
- event_courses
- course_date_associations
- applicants
- applicant_visit_dates
- applicant_courses
- notification_logs
- email_settings (公開スキーマに移動も検討)
- ai_prompts
- broadcast_history
```

**変更点**:
- `tenant_id`カラムは不要（スキーマ分離のため）
- 各テーブルにRow Level Security (RLS)を設定（多層防御）

---

## 🔧 実装手順

### Step 1: 環境変数の拡張

#### `.env.local` の更新

```bash
# 既存の環境変数に追加

# マルチテナント設定
MULTI_TENANT_MODE=true                      # マルチテナント機能の有効化

# 公開データベース（テナント管理用）
PUBLIC_SUPABASE_URL=https://public-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your-public-service-role-key

# 暗号化キー（機密情報の暗号化用）
ENCRYPTION_KEY=your-32-byte-encryption-key  # 32バイト以上

# テナント識別方式
TENANT_RESOLUTION_MODE=subdomain            # subdomain/path/header

# セッション設定
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret

# デフォルトテナント（開発用）
DEFAULT_TENANT_SLUG=demo-school
```

---

### Step 2: テナント識別機能の実装

#### `lib/tenant-resolver.ts` - テナント識別ロジック

```typescript
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase-public';

export type TenantResolutionMode = 'subdomain' | 'path' | 'header';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  database_url: string;
  database_anon_key: string;
  // その他の設定
}

/**
 * リクエストからテナントを識別
 */
export async function resolveTenant(): Promise<Tenant | null> {
  const mode = process.env.TENANT_RESOLUTION_MODE as TenantResolutionMode || 'subdomain';

  let tenantSlug: string | null = null;

  switch (mode) {
    case 'subdomain':
      tenantSlug = await resolveBySubdomain();
      break;
    case 'path':
      tenantSlug = await resolveByPath();
      break;
    case 'header':
      tenantSlug = await resolveByHeader();
      break;
  }

  if (!tenantSlug) {
    // デフォルトテナント（開発用）
    tenantSlug = process.env.DEFAULT_TENANT_SLUG || null;
  }

  if (!tenantSlug) return null;

  // 公開データベースからテナント情報を取得
  return await fetchTenantBySlug(tenantSlug);
}

/**
 * サブドメインからテナントを識別
 * 例: abc-school.yourdomain.com → abc-school
 */
async function resolveBySubdomain(): Promise<string | null> {
  const headersList = headers();
  const host = headersList.get('host') || '';

  // ローカル開発環境
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return process.env.DEFAULT_TENANT_SLUG || null;
  }

  // サブドメイン抽出
  const parts = host.split('.');
  if (parts.length >= 3) {
    return parts[0]; // 最初の部分がテナントslug
  }

  return null;
}

/**
 * パスからテナントを識別
 * 例: /tenants/abc-school/apply → abc-school
 */
async function resolveByPath(): Promise<string | null> {
  const headersList = headers();
  const pathname = headersList.get('x-pathname') || '';

  const match = pathname.match(/^\/tenants\/([^\/]+)/);
  return match ? match[1] : null;
}

/**
 * HTTPヘッダーからテナントを識別
 * 例: X-Tenant: abc-school
 */
async function resolveByHeader(): Promise<string | null> {
  const headersList = headers();
  return headersList.get('x-tenant') || null;
}

/**
 * 公開データベースからテナント情報を取得
 */
async function fetchTenantBySlug(slug: string): Promise<Tenant | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (error || !data) {
    console.error('Tenant not found:', slug, error);
    return null;
  }

  return data as Tenant;
}

/**
 * テナント用のSupabaseクライアントを作成
 */
export function createTenantClient(tenant: Tenant) {
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js');

  return createSupabaseClient(
    tenant.database_url,
    tenant.database_anon_key
  );
}
```

---

### Step 3: 認証システムの拡張

#### `lib/auth.ts` - マルチテナント認証

```typescript
import { createClient } from '@/lib/supabase-public';
import { resolveTenant } from '@/lib/tenant-resolver';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthSession {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  permissions: any;
}

/**
 * ログイン処理（マルチテナント対応）
 */
export async function login(credentials: LoginCredentials): Promise<AuthSession | null> {
  const tenant = await resolveTenant();
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const supabase = createClient();

  // ユーザー検証
  const { data: user, error } = await supabase
    .from('tenant_users')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('email', credentials.email)
    .eq('is_active', true)
    .single();

  if (error || !user) {
    return null;
  }

  // パスワード検証（Supabase Authまたは独自実装）
  // ここでは簡易的な例
  const passwordMatch = await bcrypt.compare(credentials.password, user.password_hash);
  if (!passwordMatch) {
    return null;
  }

  // セッション作成
  const session: AuthSession = {
    userId: user.id,
    tenantId: tenant.id,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: user.permissions
  };

  // 最終ログイン時刻更新
  await supabase
    .from('tenant_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  return session;
}

/**
 * JWTトークン生成
 */
export function generateToken(session: AuthSession): string {
  return jwt.sign(session, process.env.JWT_SECRET!, {
    expiresIn: '7d'
  });
}

/**
 * トークン検証
 */
export function verifyToken(token: string): AuthSession | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as AuthSession;
  } catch {
    return null;
  }
}
```

---

### Step 4: APIルートの更新

#### ミドルウェアの作成: `middleware.ts`

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;

  // テナント識別のためのヘッダーを追加
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);
  requestHeaders.set('x-host', host);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

#### APIルートの例: `app/api/apply/route.ts`（更新版）

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { resolveTenant, createTenantClient } from '@/lib/tenant-resolver';

export async function POST(request: NextRequest) {
  try {
    // テナント識別
    const tenant = await resolveTenant();
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // テナント専用のSupabaseクライアント作成
    const supabase = createTenantClient(tenant);

    // 以降は既存のロジックと同じ（supabaseクライアントを使用）
    const body = await request.json();

    // 申込処理...
    const { data, error } = await supabase
      .from('applicants')
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('Apply error:', error);
    return NextResponse.json(
      { error: 'Application failed' },
      { status: 500 }
    );
  }
}
```

---

### Step 5: 管理画面の拡張

#### スーパー管理画面の作成

**新規ページ**: `app/super-admin/tenants/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';

export default function SuperAdminTenants() {
  const [tenants, setTenants] = useState([]);

  useEffect(() => {
    fetchTenants();
  }, []);

  async function fetchTenants() {
    const res = await fetch('/api/super-admin/tenants');
    const data = await res.json();
    setTenants(data.tenants);
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">テナント管理</h1>

      <button
        onClick={() => window.location.href = '/super-admin/tenants/new'}
        className="bg-blue-600 text-white px-4 py-2 rounded mb-4"
      >
        新規テナント追加
      </button>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">組織名</th>
            <th className="p-2 border">スラッグ</th>
            <th className="p-2 border">プラン</th>
            <th className="p-2 border">ステータス</th>
            <th className="p-2 border">作成日</th>
            <th className="p-2 border">操作</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant: any) => (
            <tr key={tenant.id}>
              <td className="p-2 border">{tenant.name}</td>
              <td className="p-2 border">{tenant.slug}</td>
              <td className="p-2 border">{tenant.plan}</td>
              <td className="p-2 border">{tenant.status}</td>
              <td className="p-2 border">
                {new Date(tenant.created_at).toLocaleDateString('ja-JP')}
              </td>
              <td className="p-2 border">
                <button className="text-blue-600 mr-2">編集</button>
                <button className="text-red-600">停止</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

#### テナント作成ページ: `app/super-admin/tenants/new/page.tsx`

```typescript
'use client';

import { useState } from 'react';

export default function NewTenant() {
  const [formData, setFormData] = useState({
    slug: '',
    name: '',
    display_name: '',
    organization_type: 'high_school',
    email: '',
    phone: '',
    plan: 'trial',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch('/api/super-admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (res.ok) {
      alert('テナントを作成しました');
      window.location.href = '/super-admin/tenants';
    } else {
      alert('エラーが発生しました');
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">新規テナント作成</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-semibold mb-1">スラッグ（URL識別子）*</label>
          <input
            type="text"
            value={formData.slug}
            onChange={(e) => setFormData({...formData, slug: e.target.value})}
            className="w-full border p-2 rounded"
            pattern="[a-z0-9-]+"
            required
          />
          <p className="text-sm text-gray-500">
            例: abc-high-school （半角英数字とハイフンのみ）
          </p>
        </div>

        <div>
          <label className="block font-semibold mb-1">組織名*</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">表示名</label>
          <input
            type="text"
            value={formData.display_name}
            onChange={(e) => setFormData({...formData, display_name: e.target.value})}
            className="w-full border p-2 rounded"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">組織種別*</label>
          <select
            value={formData.organization_type}
            onChange={(e) => setFormData({...formData, organization_type: e.target.value})}
            className="w-full border p-2 rounded"
            required
          >
            <option value="high_school">高等学校</option>
            <option value="vocational_school">専門学校</option>
            <option value="university">大学</option>
            <option value="other">その他</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold mb-1">メールアドレス*</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">電話番号</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            className="w-full border p-2 rounded"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">プラン*</label>
          <select
            value={formData.plan}
            onChange={(e) => setFormData({...formData, plan: e.target.value})}
            className="w-full border p-2 rounded"
            required
          >
            <option value="trial">トライアル（30日間）</option>
            <option value="basic">ベーシック</option>
            <option value="premium">プレミアム</option>
            <option value="enterprise">エンタープライズ</option>
          </select>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded"
          >
            作成
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="bg-gray-300 px-6 py-2 rounded"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}
```

---

### Step 6: テナントオンボーディング自動化

#### APIルート: `app/api/super-admin/tenants/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-public';

/**
 * 新規テナント作成
 *
 * 処理フロー:
 * 1. Supabase新規プロジェクト作成（または専用スキーマ作成）
 * 2. テーブル・関数の初期化
 * 3. tenantsテーブルに登録
 * 4. 初期管理者アカウント作成
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, name, display_name, organization_type, email, phone, plan } = body;

    // バリデーション
    if (!slug || !name || !email) {
      return NextResponse.json(
        { error: 'Required fields missing' },
        { status: 400 }
      );
    }

    // スラッグの重複チェック
    const supabase = createClient();
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Slug already exists' },
        { status: 409 }
      );
    }

    // 1. 新規Supabaseプロジェクト作成（手動 or Supabase Management API）
    // ここでは簡略化のため、手動作成を想定
    const databaseName = `tenant_${slug.replace(/-/g, '_')}`;

    // 2. tenantsテーブルに登録
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        slug,
        name,
        display_name,
        organization_type,
        email,
        phone,
        database_name: databaseName,
        plan,
        status: plan === 'trial' ? 'trial' : 'active',
        trial_ends_at: plan === 'trial'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : null,
        subscription_starts_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

    // 3. 初期管理者アカウント作成
    const initialPassword = generateRandomPassword();
    const { data: adminUser, error: userError } = await supabase
      .from('tenant_users')
      .insert({
        tenant_id: tenant.id,
        email,
        name: '管理者',
        role: 'owner',
        is_active: true,
      })
      .select()
      .single();

    if (userError) throw userError;

    // 4. ウェルカムメール送信（実装省略）
    // await sendWelcomeEmail(email, slug, initialPassword);

    // 5. 監査ログ記録
    await supabase.from('audit_logs').insert({
      tenant_id: tenant.id,
      action: 'tenant_created',
      details: { slug, name, plan },
    });

    return NextResponse.json({
      success: true,
      tenant,
      adminUser,
      credentials: {
        email,
        temporaryPassword: initialPassword,
      }
    });

  } catch (error) {
    console.error('Tenant creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create tenant' },
      { status: 500 }
    );
  }
}

function generateRandomPassword(length: number = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
```

---

### Step 7: フロントエンドのカスタマイズ対応

#### `lib/tenant-theme.ts` - テーマカスタマイズ

```typescript
import { resolveTenant } from '@/lib/tenant-resolver';

export interface TenantTheme {
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily?: string;
}

export async function getTenantTheme(): Promise<TenantTheme> {
  const tenant = await resolveTenant();

  if (!tenant) {
    // デフォルトテーマ
    return {
      primaryColor: '#3B82F6',
      secondaryColor: '#10B981',
    };
  }

  return {
    logoUrl: tenant.logo_url,
    primaryColor: tenant.primary_color || '#3B82F6',
    secondaryColor: tenant.secondary_color || '#10B981',
  };
}

/**
 * CSS変数として適用
 */
export function applyTheme(theme: TenantTheme) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.style.setProperty('--color-primary', theme.primaryColor);
  root.style.setProperty('--color-secondary', theme.secondaryColor);

  if (theme.fontFamily) {
    root.style.setProperty('--font-family', theme.fontFamily);
  }
}
```

#### `app/layout.tsx` の更新

```typescript
import { getTenantTheme } from '@/lib/tenant-theme';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = await getTenantTheme();

  return (
    <html lang="ja">
      <head>
        <style>{`
          :root {
            --color-primary: ${theme.primaryColor};
            --color-secondary: ${theme.secondaryColor};
          }
        `}</style>
      </head>
      <body>
        {theme.logoUrl && (
          <header className="p-4 border-b">
            <img src={theme.logoUrl} alt="Logo" className="h-12" />
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
```

---

### Step 8: セキュリティ強化

#### データ暗号化: `lib/encryption.ts`

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

/**
 * 暗号化
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * 復号化
 */
export function decrypt(encrypted: string): string {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

#### Row Level Security (RLS) 設定例

```sql
-- applicantsテーブルのRLS設定例
ALTER TABLE applicants ENABLE ROW LEVEL SECURITY;

-- 読み取りポリシー（認証済みユーザーのみ）
CREATE POLICY "Allow authenticated read access"
  ON applicants
  FOR SELECT
  TO authenticated
  USING (true);

-- 書き込みポリシー（APIキー経由のみ）
CREATE POLICY "Allow service role write access"
  ON applicants
  FOR INSERT
  TO service_role
  WITH CHECK (true);
```

---

## 🚀 デプロイ・移行手順

### Phase 1: 準備（1-2週間）

1. **開発環境の構築**
   - マルチテナント機能を別ブランチで開発
   - ローカルでの動作確認

2. **公開データベースの準備**
   - Supabaseで新規プロジェクト作成（公開スキーマ用）
   - `tenants`, `tenant_users`, `audit_logs`テーブル作成

3. **テナント作成フローのテスト**
   - スーパー管理画面の実装・テスト
   - テナント作成の自動化確認

### Phase 2: パイロット運用（2-4週間）

1. **既存データの移行**
   - 現行システムを最初のテナントとして登録
   - データ移行スクリプトの実行・検証

2. **新規テナント1社での試験運用**
   - テスト顧客を1社選定
   - オンボーディングフローの検証
   - フィードバック収集・改善

### Phase 3: 本番展開（4週間〜）

1. **段階的なテナント追加**
   - 週1-2社のペースでテナント追加
   - 各社のオンボーディングサポート
   - システムの安定性監視

2. **ドキュメント整備**
   - テナント向けセットアップガイド作成
   - 管理者向けマニュアル作成
   - API仕様書の更新

---

## 📊 プラン・料金設計の考慮事項

### プラン例

| プラン | 月額料金 | イベント数 | 申込者数/イベント | LINE連携 | AI機能 | カスタムドメイン |
|-------|---------|-----------|----------------|---------|--------|---------------|
| トライアル | 無料（30日） | 3 | 50 | ○ | × | × |
| ベーシック | ¥9,800 | 10 | 200 | ○ | × | × |
| プレミアム | ¥29,800 | 無制限 | 500 | ○ | ○ | ○ |
| エンタープライズ | 要相談 | 無制限 | 無制限 | ○ | ○ | ○ |

### 実装のポイント

- `tenants`テーブルの`plan`, `max_events`, `max_applicants_per_event`で制限管理
- APIレベルで制限チェックを実装
- 超過時は明確なエラーメッセージを表示

---

## 🔍 パフォーマンス・スケーラビリティ

### キャッシング戦略

```typescript
// Redis等でテナント情報をキャッシュ
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getCachedTenant(slug: string) {
  const cacheKey = `tenant:${slug}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const tenant = await fetchTenantBySlug(slug);
  if (tenant) {
    await redis.setex(cacheKey, 3600, JSON.stringify(tenant)); // 1時間キャッシュ
  }

  return tenant;
}
```

### データベース接続プーリング

- Supabaseの接続プーリング機能を活用
- テナント数が増えてもコネクション数を抑制

### CDN活用

- 静的アセット（CSS, JS, 画像）はCDNで配信
- テナントごとのロゴ等はS3 + CloudFront

---

## 🛡️ セキュリティチェックリスト

### データ分離

- [ ] テナント間のデータ漏洩防止策の実装
- [ ] Row Level Security (RLS) の全テーブル適用
- [ ] APIレベルでのテナント検証

### 認証・認可

- [ ] 強固なパスワードポリシー
- [ ] 2要素認証 (2FA) の実装
- [ ] セッション管理の強化
- [ ] ロール・権限管理の実装

### 機密情報の保護

- [ ] LINE/メール認証情報の暗号化
- [ ] OpenAI APIキーの暗号化
- [ ] 環境変数の適切な管理

### 監査ログ

- [ ] 全重要操作のログ記録
- [ ] ログの改ざん防止
- [ ] ログの定期的なレビュー

---

## 📈 監視・運用

### モニタリング指標

- テナント数
- テナントごとのアクティブユーザー数
- APIレスポンスタイム
- エラー率
- データベース接続数
- ストレージ使用量

### アラート設定

- システムダウン検知
- エラー率の急増
- データベース接続数の上限到達
- ストレージ使用率90%超

### バックアップ戦略

- データベース: 日次自動バックアップ
- テナントごとの個別バックアップオプション
- Point-in-Time Recovery (PITR) の有効化

---

## 🔄 今後の拡張可能性

### 追加検討事項

1. **Webhook機能**
   - テナントが独自のWebhookエンドポイントを登録
   - イベント発生時に通知

2. **APIの外部公開**
   - テナント向けREST API/GraphQLの提供
   - APIキー管理機能

3. **ホワイトラベル機能**
   - 完全なカスタムドメイン対応
   - テーマのより高度なカスタマイズ

4. **分析・レポート機能**
   - テナントごとのダッシュボード
   - 申込データの詳細分析

5. **モバイルアプリ対応**
   - ネイティブアプリでのマルチテナント対応

---

## 📚 参考リソース

### 技術ドキュメント
- [Supabase Multi-tenancy Guide](https://supabase.com/docs/guides/database/multi-tenancy)
- [Next.js Middleware Documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

### ベストプラクティス
- [AWS Multi-tenant SaaS Architecture](https://aws.amazon.com/solutions/multi-tenant-saas/)
- [Stripe's approach to multi-tenancy](https://stripe.com/blog/payment-api-design)

---

## ✅ 実装チェックリスト

### データベース
- [ ] 公開スキーマ（tenants, tenant_users, audit_logs）作成
- [ ] テナント専用スキーマのテンプレート作成
- [ ] RLSポリシーの設定
- [ ] インデックスの最適化

### バックエンド
- [ ] テナント識別ロジックの実装
- [ ] マルチテナント認証システムの実装
- [ ] APIルートの更新（全エンドポイント）
- [ ] データ暗号化機能の実装

### フロントエンド
- [ ] スーパー管理画面の実装
- [ ] テナント作成フローの実装
- [ ] テーマカスタマイズ機能の実装
- [ ] 既存ページのマルチテナント対応

### セキュリティ
- [ ] データ暗号化の実装
- [ ] RLSの全テーブル適用
- [ ] 監査ログの実装
- [ ] セキュリティテストの実施

### テスト
- [ ] ユニットテストの追加
- [ ] 統合テストの実施
- [ ] セキュリティテスト
- [ ] パフォーマンステスト

### ドキュメント
- [ ] API仕様書の更新
- [ ] テナント向けオンボーディングガイド作成
- [ ] 管理者向けマニュアル作成
- [ ] トラブルシューティングガイド作成

### デプロイ
- [ ] ステージング環境でのテスト
- [ ] 本番環境へのデプロイ
- [ ] モニタリング設定
- [ ] バックアップ設定

---

## 📞 サポート・問い合わせ

マルチテナント化の実装に関する質問や相談は、プロジェクト管理者までお問い合わせください。

---

**作成日**: 2025年12月15日
**対象バージョン**: v2.0.0 (Multi-tenant)
**前提システム**: v1.0.0 (Single-tenant)
**想定実装期間**: 2-3ヶ月
**推奨開発体制**: 2-3名
