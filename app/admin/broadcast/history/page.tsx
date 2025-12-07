'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface BroadcastHistory {
  id: string;
  type: 'email' | 'line';
  subject: string | null;
  message: string;
  recipient_count: number;
  success_count: number;
  failed_count: number;
  recipients: any[];
  errors: string[] | null;
  created_at: string;
}

export default function BroadcastHistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<BroadcastHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHistory, setSelectedHistory] = useState<BroadcastHistory | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);


  // 履歴取得
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/admin/broadcast/history');
        if (response.ok) {
          const data = await response.json();
          setHistory(data);
        }
      } catch (error) {
        console.error('履歴取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const handleViewDetail = (item: BroadcastHistory) => {
    setSelectedHistory(item);
    setShowDetailModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">配信履歴</h1>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/admin/broadcast')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition duration-200"
              >
                配信ページ
              </button>
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition duration-200"
              >
                ダッシュボード
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {history.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            配信履歴がありません
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    配信日時
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    タイプ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    件名/内容
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    送信数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    成功
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    失敗
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(item.created_at).toLocaleString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          item.type === 'email'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {item.type === 'email' ? 'メール' : 'LINE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs">
                        {item.subject && (
                          <div className="font-medium truncate">{item.subject}</div>
                        )}
                        <div className="text-gray-500 truncate">{item.message}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.recipient_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="text-green-600 font-semibold">
                        {item.success_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`font-semibold ${
                          item.failed_count > 0 ? 'text-red-600' : 'text-gray-400'
                        }`}
                      >
                        {item.failed_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleViewDetail(item)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        詳細
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* 詳細モーダル */}
      {showDetailModal && selectedHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-gray-900">配信詳細</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* 基本情報 */}
              <div className="border-b border-gray-200 pb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">配信日時</p>
                    <p className="font-medium">
                      {new Date(selectedHistory.created_at).toLocaleString('ja-JP')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">配信タイプ</p>
                    <p className="font-medium">
                      {selectedHistory.type === 'email' ? 'メール' : 'LINE'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 件名（メールの場合） */}
              {selectedHistory.subject && (
                <div className="border-b border-gray-200 pb-4">
                  <p className="text-sm text-gray-600 mb-2">件名</p>
                  <p className="font-medium">{selectedHistory.subject}</p>
                </div>
              )}

              {/* メッセージ本文 */}
              <div className="border-b border-gray-200 pb-4">
                <p className="text-sm text-gray-600 mb-2">メッセージ本文</p>
                <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                  {selectedHistory.message}
                </div>
              </div>

              {/* 送信結果 */}
              <div className="border-b border-gray-200 pb-4">
                <p className="text-sm text-gray-600 mb-2">送信結果</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-600">送信対象</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {selectedHistory.recipient_count}
                    </p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-sm text-green-600">成功</p>
                    <p className="text-2xl font-bold text-green-900">
                      {selectedHistory.success_count}
                    </p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <p className="text-sm text-red-600">失敗</p>
                    <p className="text-2xl font-bold text-red-900">
                      {selectedHistory.failed_count}
                    </p>
                  </div>
                </div>
              </div>

              {/* 送信先リスト */}
              <div className="border-b border-gray-200 pb-4">
                <p className="text-sm text-gray-600 mb-2">送信先リスト</p>
                <div className="max-h-60 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                          氏名
                        </th>
                        {selectedHistory.type === 'email' && (
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                            メールアドレス
                          </th>
                        )}
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                          ステータス
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedHistory.recipients.map((recipient, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {recipient.name}
                          </td>
                          {selectedHistory.type === 'email' && (
                            <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                              {recipient.email || '-'}
                            </td>
                          )}
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                recipient.status === 'success'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {recipient.status === 'success' ? '成功' : '失敗'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* エラー情報 */}
              {selectedHistory.errors && selectedHistory.errors.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">エラー情報</p>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                      {selectedHistory.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition duration-200"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
