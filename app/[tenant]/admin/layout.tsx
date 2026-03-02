'use client';

import { usePathname, useRouter, useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState } from 'react';

// 権限レベル定義
const ROLE_LEVELS = {
  SUPER_ADMIN: 100,
  LINE_ADMIN: 50,
  EVENT_STAFF: 30,
} as const;

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string;
  max_role_level: number;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { tenant } = useParams<{ tenant: string }>();
  const [currentUser, setCurrentUser] = useState<UserWithRoles | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ユーザー情報取得
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/${tenant}/admin/me`);
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setLoading(false);
      }
    };

    if (pathname !== `/${tenant}/admin/login`) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [pathname, tenant]);

  // ログインページではサイドバーを表示しない
  if (pathname === `/${tenant}/admin/login`) {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push(`/${tenant}/admin/login`);
  };

  // テナント表示名（スラッグから生成）
  const tenantDisplayName = tenant
    ? tenant.charAt(0).toUpperCase() + tenant.slice(1)
    : '';

  // メニュー項目（権限レベル付き）
  const allMenuItems = [
    {
      name: 'ダッシュボード',
      icon: '📊',
      path: `/${tenant}/admin/dashboard`,
      requiredLevel: ROLE_LEVELS.EVENT_STAFF, // 30
    },
    {
      name: 'イベント管理',
      icon: '📅',
      path: `/${tenant}/admin/events`,
      requiredLevel: ROLE_LEVELS.EVENT_STAFF, // 30
    },
    {
      name: '申込確定管理',
      icon: '✅',
      path: `/${tenant}/admin/confirmations`,
      requiredLevel: ROLE_LEVELS.EVENT_STAFF, // 30
    },
    {
      name: '確定者管理',
      icon: '👥',
      path: `/${tenant}/admin/confirmed-list`,
      requiredLevel: ROLE_LEVELS.EVENT_STAFF, // 30
    },
    {
      name: 'メッセージ配信',
      icon: '📧',
      path: `/${tenant}/admin/broadcast`,
      requiredLevel: ROLE_LEVELS.LINE_ADMIN, // 50
    },
    {
      name: 'メール設定',
      icon: '⚙️',
      path: `/${tenant}/admin/email-settings`,
      requiredLevel: ROLE_LEVELS.LINE_ADMIN, // 50
    },
    {
      name: 'AI設定',
      icon: '🤖',
      path: `/${tenant}/admin/ai-settings`,
      requiredLevel: ROLE_LEVELS.LINE_ADMIN, // 50
    },
    {
      name: 'サイト設定',
      icon: '🏫',
      path: `/${tenant}/admin/site-settings`,
      requiredLevel: ROLE_LEVELS.LINE_ADMIN, // 50
    },
    {
      name: 'ユーザー管理',
      icon: '👤',
      path: `/${tenant}/admin/users`,
      requiredLevel: ROLE_LEVELS.SUPER_ADMIN, // 100
    },
    {
      name: 'ログイン履歴',
      icon: '📋',
      path: `/${tenant}/admin/login-logs`,
      requiredLevel: ROLE_LEVELS.SUPER_ADMIN, // 100
    },
    {
      name: 'テナント設定',
      icon: '🔧',
      path: `/${tenant}/admin/tenant-settings`,
      requiredLevel: ROLE_LEVELS.SUPER_ADMIN, // 100
    },
  ];

  // ユーザーの権限レベルに基づいてメニューをフィルタリング
  const menuItems = allMenuItems.filter((item) => {
    if (!currentUser) return false;
    return currentUser.max_role_level >= item.requiredLevel;
  });

  // ローディング中
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* サイドバー */}
      <aside className="w-64 bg-gradient-to-b from-gray-800 to-gray-900 text-white flex flex-col">
        {/* ロゴ・システム名 */}
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-bold">オープンキャンパス</h1>
          <h2 className="text-xl font-bold">管理システム</h2>
          <p className="text-sm text-gray-400 mt-1">{tenantDisplayName}</p>
        </div>

        {/* メニュー */}
        <nav className="flex-1 overflow-y-auto py-4">
          {menuItems.length === 0 ? (
            <div className="px-6 py-4 text-gray-400 text-sm">
              アクセス権限がありません
            </div>
          ) : (
            menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`w-full flex items-center px-6 py-3 text-left transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white border-l-4 border-blue-400'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <span className="mr-3 text-xl">{item.icon}</span>
                <span className="font-medium">{item.name}</span>
              </button>
            );
          })
          )}
        </nav>

        {/* ユーザー情報 */}
        {currentUser && (
          <div className="px-4 py-3 border-t border-gray-700">
            <div className="text-xs text-gray-400">ログイン中</div>
            <div className="text-sm font-medium text-white truncate">{currentUser.full_name}</div>
            <div className="text-xs text-gray-400 truncate">{currentUser.email}</div>
          </div>
        )}

        {/* フッター */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          <button
            onClick={() => window.open(`/${tenant}`, '_blank')}
            className="w-full flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded transition-colors"
          >
            <span className="mr-3 text-xl">🌐</span>
            <span className="font-medium">サイトを表示</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-2 text-gray-300 hover:bg-red-600 hover:text-white rounded transition-colors"
          >
            <span className="mr-3 text-xl">🚪</span>
            <span className="font-medium">ログアウト</span>
          </button>
        </div>
      </aside>

      {/* メインコンテンツエリア */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
