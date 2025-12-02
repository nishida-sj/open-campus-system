'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 認証チェック
  useEffect(() => {
    const auth = sessionStorage.getItem('admin_authenticated');
    if (!auth && pathname !== '/admin/login') {
      router.push('/admin/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [pathname, router]);

  // ログインページではサイドバーを表示しない
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // 認証チェック中は何も表示しない
  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = () => {
    sessionStorage.removeItem('admin_authenticated');
    router.push('/admin/login');
  };

  const menuItems = [
    {
      name: 'ダッシュボード',
      icon: '📊',
      path: '/admin/dashboard',
    },
    {
      name: 'イベント管理',
      icon: '📅',
      path: '/admin/events',
    },
    {
      name: '申込確定管理',
      icon: '✅',
      path: '/admin/confirmations',
    },
    {
      name: '確定者管理',
      icon: '👥',
      path: '/admin/confirmed-list',
    },
    {
      name: 'メッセージ配信',
      icon: '📧',
      path: '/admin/broadcast',
    },
    {
      name: 'メール設定',
      icon: '⚙️',
      path: '/admin/email-settings',
    },
    {
      name: 'AI設定',
      icon: '🤖',
      path: '/admin/ai-settings',
    },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* サイドバー */}
      <aside className="w-64 bg-gradient-to-b from-gray-800 to-gray-900 text-white flex flex-col">
        {/* ロゴ・システム名 */}
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-bold">オープンキャンパス</h1>
          <h2 className="text-xl font-bold">管理システム</h2>
        </div>

        {/* メニュー */}
        <nav className="flex-1 overflow-y-auto py-4">
          {menuItems.map((item) => {
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
          })}
        </nav>

        {/* フッター */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          <button
            onClick={() => window.open('/', '_blank')}
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
