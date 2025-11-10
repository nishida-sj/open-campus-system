'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // パスワードチェック
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      // sessionStorageに認証情報を保存
      sessionStorage.setItem('admin_authenticated', 'true');
      // ダッシュボードへリダイレクト
      router.push('/admin/dashboard');
    } else {
      setError('パスワードが正しくありません');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* ログインカード */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* ヘッダー */}
          <div className="text-center mb-8">
            <div className="inline-block p-3 bg-blue-100 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">管理画面ログイン</h1>
            <p className="text-gray-600 mt-2">パスワードを入力してください</p>
          </div>

          {/* ログインフォーム */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* エラーメッセージ */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* パスワード入力 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                パスワード
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                autoFocus
              />
            </div>

            {/* ログインボタン */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          {/* 注意事項 */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              ⚠️ 本番環境では適切な認証システム（NextAuth.js等）の使用を推奨します
            </p>
          </div>
        </div>

        {/* フッター */}
        <div className="text-center mt-6">
          <a
            href="/"
            className="text-gray-400 hover:text-gray-300 text-sm transition duration-200"
          >
            ← トップページに戻る
          </a>
        </div>
      </div>
    </div>
  );
}
