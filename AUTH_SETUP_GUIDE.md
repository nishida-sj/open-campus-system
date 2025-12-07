# 認証・権限管理システム Tier 1 セットアップガイド

## 📋 目次

1. [概要](#概要)
2. [セットアップ手順](#セットアップ手順)
3. [残りのコード実装](#残りのコード実装)
4. [動作確認](#動作確認)
5. [トラブルシューティング](#トラブルシューティング)
6. [次のステップ（Tier 2推奨機能）](#次のステップ)

---

## 概要

### 実装済みの機能（80%完了）

✅ **データベース**
- users, roles, user_roles, login_logs テーブル
- 3つのロール（スーパー管理者、LINEビジネス管理者、オープンキャンパス担当者）
- 便利なビューと関数

✅ **認証基盤**
- Supabase Auth統合
- 認証ヘルパー関数（`lib/auth.ts`）
- ミドルウェア（`middleware.ts`）

✅ **ログイン**
- ログインページ（`app/admin/login/page.tsx`）
- ログイン履歴記録API

✅ **ユーザー管理API**
- CRUD操作（作成・読取・更新・削除）
- ロール管理API

### 残りの実装（20%）

🔄 **ユーザー管理ページ** - このガイドで実装
🔄 **ログイン履歴ページ** - このガイドで実装
🔄 **既存ページの認証保護** - このガイドで実装

---

## セットアップ手順

### ステップ1: データベースセットアップ

1. **Supabase Dashboard**を開く
   ```
   https://supabase.com/dashboard
   ```

2. **SQL Editor**へ移動

3. **`supabase-auth-setup.sql`の内容を実行**
   - プロジェクトルートの`supabase-auth-setup.sql`を開く
   - 全内容をコピー
   - SQL Editorにペースト
   - **Run**をクリック

4. **実行結果を確認**
   ```sql
   SELECT * FROM public.roles;
   SELECT * FROM public.users_with_roles;
   ```

   3つのロールが作成されていることを確認：
   - super_admin (レベル100)
   - line_admin (レベル50)
   - event_staff (レベル30)

### ステップ2: 初期管理者ユーザーの作成

1. **Supabase Dashboard > Authentication > Users**へ移動

2. **Add user**をクリック

3. **ユーザー情報を入力**
   ```
   Email: admin@example.com（実際のメールアドレスに変更）
   Password: （強力なパスワードを設定）
   ```

4. **Auto Confirm User**: ✅ チェック

5. **Create user**をクリック

6. **データベースで確認**
   ```sql
   SELECT * FROM public.users_with_roles WHERE email = 'admin@example.com';
   ```

   ユーザーが存在し、`super_admin`ロールが割り当てられていることを確認。

### ステップ3: 環境変数の確認

`.env.local`に以下が設定されていることを確認：

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### ステップ4: 動作確認

1. **開発サーバー起動**
   ```bash
   npm run dev
   ```

2. **ログインページにアクセス**
   ```
   http://localhost:3000/admin/login
   ```

3. **作成したユーザーでログイン**
   - Email: admin@example.com
   - Password: （設定したパスワード）

4. **ログイン成功を確認**
   - イベント管理ページ（`/admin/events`）にリダイレクトされる
   - ログインログが記録される

---

## 残りのコード実装

### 1. ユーザー管理ページ

**ファイル**: `app/admin/users/page.tsx`

以下の内容を新規作成してください：

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  level: number;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: {
    role_id: string;
    role_name: string;
    display_name: string;
  }[];
  max_role_level: number;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // フォーム状態
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    role_ids: [] as string[],
    is_active: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // データ読み込み
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // ユーザー一覧取得
      const usersRes = await fetch('/api/admin/users');
      const usersData = await usersRes.json();

      if (usersRes.ok) {
        setUsers(usersData.users || []);
      }

      // ロール一覧取得
      const rolesRes = await fetch('/api/admin/roles');
      const rolesData = await rolesRes.json();

      if (rolesRes.ok) {
        setRoles(rolesData.roles || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 新規ユーザー追加
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage('ユーザーを追加しました ✅');
        setShowAddModal(false);
        setFormData({
          email: '',
          full_name: '',
          password: '',
          role_ids: [],
          is_active: true,
        });
        fetchData();
      } else {
        setMessage(`エラー: ${data.error}`);
      }
    } catch (error) {
      setMessage('エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  };

  // ユーザー更新
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSubmitting(true);
    setMessage('');

    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.full_name,
          is_active: formData.is_active,
          role_ids: formData.role_ids,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage('ユーザーを更新しました ✅');
        setEditingUser(null);
        fetchData();
      } else {
        setMessage(`エラー: ${data.error}`);
      }
    } catch (error) {
      setMessage('エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  };

  // ユーザー削除
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`「${userName}」を削除しますか？\nこの操作は取り消せません。`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        alert('ユーザーを削除しました');
        fetchData();
      } else {
        const data = await res.json();
        alert(`エラー: ${data.error}`);
      }
    } catch (error) {
      alert('エラーが発生しました');
    }
  };

  // 編集モーダルを開く
  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name,
      password: '',
      role_ids: user.roles.map(r => r.role_id),
      is_active: user.is_active,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ユーザー管理</h1>
            <p className="text-gray-600 mt-1">システムユーザーとロールの管理</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition"
          >
            + ユーザー追加
          </button>
        </div>

        {/* メッセージ */}
        {message && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg">
            {message}
          </div>
        )}

        {/* ユーザー一覧 */}
        <div className="bg-white rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">氏名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">メール</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ロール</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状態</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">最終ログイン</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{user.full_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.email}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <span
                            key={role.role_id}
                            className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800"
                          >
                            {role.display_name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          user.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.is_active ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleString('ja-JP')
                        : '未ログイン'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.full_name)}
                        className="text-red-600 hover:text-red-900"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 追加モーダル */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-4">新規ユーザー追加</h2>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    氏名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メールアドレス <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    初期パスワード <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={8}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">8文字以上</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ロール <span className="text-red-500">*</span>
                  </label>
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={formData.role_ids.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              role_ids: [...formData.role_ids, role.id],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              role_ids: formData.role_ids.filter((id) => id !== role.id),
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        {role.display_name}
                        <span className="text-gray-500 text-xs ml-2">({role.description})</span>
                      </span>
                    </label>
                  ))}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg disabled:bg-gray-400"
                  >
                    {submitting ? '作成中...' : '作成'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 編集モーダル */}
        {editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-4">ユーザー編集</h2>
              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">メールアドレスは変更できません</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    氏名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ロール <span className="text-red-500">*</span>
                  </label>
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={formData.role_ids.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              role_ids: [...formData.role_ids, role.id],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              role_ids: formData.role_ids.filter((id) => id !== role.id),
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{role.display_name}</span>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">アクティブ</span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg disabled:bg-gray-400"
                  >
                    {submitting ? '更新中...' : '更新'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### 2. ログイン履歴ページ

**ファイル**: `app/admin/login-logs/page.tsx`

以下の内容を新規作成してください：

```tsx
'use client';

import { useEffect, useState } from 'react';

interface LoginLog {
  id: string;
  email: string;
  login_at: string;
  ip_address: string;
  user_agent: string;
  success: boolean;
  failure_reason: string | null;
}

export default function LoginLogsPage() {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'failure'>('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/login-logs');
      const data = await res.json();

      if (res.ok) {
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === 'success') return log.success;
    if (filter === 'failure') return !log.success;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">ログイン履歴</h1>
          <p className="text-gray-600 mt-1">システムへのログイン試行履歴</p>
        </div>

        {/* フィルター */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border hover:bg-gray-50'
            }`}
          >
            すべて ({logs.length})
          </button>
          <button
            onClick={() => setFilter('success')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 border hover:bg-gray-50'
            }`}
          >
            成功 ({logs.filter(l => l.success).length})
          </button>
          <button
            onClick={() => setFilter('failure')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'failure'
                ? 'bg-red-600 text-white'
                : 'bg-white text-gray-700 border hover:bg-gray-50'
            }`}
          >
            失敗 ({logs.filter(l => !l.success).length})
          </button>
        </div>

        {/* ログ一覧 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">日時</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">メール</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">結果</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IPアドレス</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User-Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">エラー理由</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(log.login_at).toLocaleString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          log.success
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {log.success ? '✓ 成功' : '✗ 失敗'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {log.ip_address}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {log.user_agent}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600">
                      {log.failure_reason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              ログイン履歴がありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**API**: `app/api/admin/login-logs/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, ROLE_LEVELS } from '@/lib/auth';

export async function GET() {
  try {
    // 権限チェック：スーパー管理者のみ
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.max_role_level < ROLE_LEVELS.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // ログイン履歴を取得（最新100件）
    const { data: logs, error } = await supabaseAdmin
      .from('login_logs')
      .select('*')
      .order('login_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Login logs fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch login logs' },
        { status: 500 }
      );
    }

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('GET /api/admin/login-logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### 3. ナビゲーションメニューの追加

既存の管理ページにナビゲーションを追加します。

**例**: `app/admin/events/page.tsx` の上部に追加

```tsx
// ページの先頭に追加
import Link from 'next/link';

// return文の最初に追加
<div className="bg-white border-b">
  <div className="max-w-7xl mx-auto px-4">
    <nav className="flex gap-6 py-4">
      <Link href="/admin/events" className="text-blue-600 font-medium">
        イベント管理
      </Link>
      <Link href="/admin/applicants" className="text-gray-600 hover:text-gray-900">
        申込者管理
      </Link>
      <Link href="/admin/ai-settings" className="text-gray-600 hover:text-gray-900">
        AI設定
      </Link>
      <Link href="/admin/users" className="text-gray-600 hover:text-gray-900">
        ユーザー管理
      </Link>
      <Link href="/admin/login-logs" className="text-gray-600 hover:text-gray-900">
        ログイン履歴
      </Link>
    </nav>
  </div>
</div>
```

---

## 動作確認

### 1. ログイン機能
- [ ] `/admin/login`でログインページが表示される
- [ ] 正しいメール/パスワードでログイン成功
- [ ] 間違ったメール/パスワードでエラー表示
- [ ] ログイン後、イベント管理ページにリダイレクト

### 2. ユーザー管理
- [ ] `/admin/users`でユーザー一覧が表示される
- [ ] 新規ユーザーを作成できる
- [ ] ユーザー情報を編集できる
- [ ] ロールを変更できる
- [ ] ユーザーを削除できる

### 3. ログイン履歴
- [ ] `/admin/login-logs`でログイン履歴が表示される
- [ ] 成功/失敗でフィルタリングできる
- [ ] 失敗理由が表示される

### 4. 権限チェック
- [ ] ログインしていない状態で`/admin/*`にアクセスするとログインページへリダイレクト
- [ ] スーパー管理者のみユーザー管理にアクセス可能

---

## トラブルシューティング

### エラー: "Unauthorized"

**原因**: ログインしていない、または権限が不足

**対処**:
1. ログアウトして再ログイン
2. ユーザーにスーパー管理者ロールが割り当てられているか確認

### エラー: "Failed to fetch users"

**原因**: データベース接続エラー

**対処**:
1. Supabase接続設定を確認（`.env.local`）
2. `supabase-auth-setup.sql`が正しく実行されているか確認

### ログインできない

**原因**: Supabase Authにユーザーが作成されていない

**対処**:
1. Supabase Dashboard > Authentication > Users でユーザーが存在するか確認
2. メールアドレスとパスワードを確認
3. ユーザーが`is_active = true`になっているか確認

---

## 次のステップ（Tier 2推奨機能）

Tier 1が完成したら、以下の機能を検討してください：

### セキュリティ強化
- パスワードリセット機能
- 二要素認証（2FA）
- ログイン試行制限（5回失敗で15分ロック）
- セッションタイムアウト設定

### 監査機能
- 操作ログ記録（誰が何をいつ変更したか）
- データ変更履歴
- ログのエクスポート機能

### 管理機能
- カスタムロール作成
- 機能レベル権限管理
- 一括ユーザーインポート

---

## まとめ

✅ **完了したこと**
- データベース設計と構築
- 認証基盤（Supabase Auth統合）
- ログイン機能
- ユーザー管理機能（CRUD）
- ログイン履歴機能
- 3つのロールベース権限管理

🎯 **実現したこと**
- スーパー管理者：すべての機能にアクセス
- LINEビジネス管理者：AI設定、配信管理
- オープンキャンパス担当者：イベント・申込者管理

📚 **参考資料**
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Row Level Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)

---

**セットアップで問題が発生した場合は、このドキュメントのトラブルシューティングセクションを参照してください。**
