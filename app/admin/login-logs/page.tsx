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

      console.log('[LOGIN LOGS] API Response:', {
        status: res.status,
        ok: res.ok,
        data: data,
        logsCount: data.logs?.length || 0,
      });

      if (res.ok) {
        setLogs(data.logs || []);
      } else {
        console.error('[LOGIN LOGS] API Error:', data);
      }
    } catch (error) {
      console.error('[LOGIN LOGS] Failed to fetch logs:', error);
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
