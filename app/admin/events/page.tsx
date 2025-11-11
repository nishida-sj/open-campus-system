'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Event {
  id: string;
  name: string;
  description: string | null;
  max_date_selections: number;
  is_active: boolean;
  created_at: string;
}

interface DateOption {
  id: string;
  date: string;
  capacity: number;
  current_count: number;
  is_active: boolean;
}

export default function AdminEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [dates, setDates] = useState<DateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // フォーム状態
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    max_date_selections: 1,
    is_active: true,
    selectedDates: [] as string[],
  });

  // 認証チェック
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('admin_authenticated');
    if (!isAuthenticated) {
      router.push('/admin/login');
    }
  }, [router]);

  // データ取得
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [eventsRes, datesRes] = await Promise.all([
        fetch('/api/admin/events'),
        fetch('/api/admin/dates'),
      ]);

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData);
      }

      if (datesRes.ok) {
        const datesData = await datesRes.json();
        setDates(datesData);
      }
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // イベント作成
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.selectedDates.length === 0) {
      alert('少なくとも1つの日程を選択してください');
      return;
    }

    try {
      const response = await fetch('/api/admin/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert('イベントを作成しました');
        setShowCreateForm(false);
        setFormData({
          name: '',
          description: '',
          max_date_selections: 1,
          is_active: true,
          selectedDates: [],
        });
        fetchData();
      } else {
        const error = await response.json();
        alert(`エラー: ${error.message || '作成に失敗しました'}`);
      }
    } catch (error) {
      console.error('イベント作成エラー:', error);
      alert('エラーが発生しました');
    }
  };

  // 日程選択トグル
  const toggleDateSelection = (dateId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedDates: prev.selectedDates.includes(dateId)
        ? prev.selectedDates.filter((id) => id !== dateId)
        : [...prev.selectedDates, dateId],
    }));
  };

  // ダッシュボードに戻る
  const handleBackToDashboard = () => {
    router.push('/admin/dashboard');
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
            <h1 className="text-2xl font-bold text-gray-900">イベント管理</h1>
            <button
              onClick={handleBackToDashboard}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition duration-200"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* イベント作成ボタン */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition duration-200"
          >
            {showCreateForm ? '作成フォームを閉じる' : '新規イベント作成'}
          </button>
        </div>

        {/* イベント作成フォーム */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">新規イベント作成</h2>
            <form onSubmit={handleCreateEvent} className="space-y-6">
              {/* イベント名 */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  イベント名 *
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例: 2025年夏のオープンキャンパス"
                />
              </div>

              {/* 説明 */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  説明
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="イベントの説明を入力してください"
                />
              </div>

              {/* 最大選択可能日程数 */}
              <div>
                <label htmlFor="max_selections" className="block text-sm font-medium text-gray-700 mb-2">
                  参加者が選択できる日程数 *
                </label>
                <select
                  id="max_selections"
                  value={formData.max_date_selections}
                  onChange={(e) =>
                    setFormData({ ...formData, max_date_selections: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={1}>1つまで（単一選択）</option>
                  <option value={2}>2つまで</option>
                  <option value={3}>3つまで</option>
                  <option value={4}>4つまで</option>
                  <option value={5}>5つまで</option>
                  <option value={999}>制限なし</option>
                </select>
              </div>

              {/* 日程選択 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  開催日程を選択 *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {dates.length === 0 ? (
                    <p className="text-gray-500 col-span-full">利用可能な日程がありません</p>
                  ) : (
                    dates.map((date) => (
                      <div
                        key={date.id}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                          formData.selectedDates.includes(date.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                        onClick={() => toggleDateSelection(date.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-gray-900">
                              {new Date(date.date).toLocaleDateString('ja-JP', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                weekday: 'short',
                              })}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              定員: {date.capacity}名
                            </div>
                          </div>
                          <div>
                            {formData.selectedDates.includes(date.id) && (
                              <svg
                                className="w-6 h-6 text-blue-600"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  選択中: {formData.selectedDates.length}件
                </p>
              </div>

              {/* 公開状態 */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="ml-2 text-sm font-medium text-gray-700">
                  イベントを公開する
                </label>
              </div>

              {/* ボタン */}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition duration-200"
                >
                  イベントを作成
                </button>
              </div>
            </form>
          </div>
        )}

        {/* イベント一覧 */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">イベント一覧</h2>
          </div>

          {events.length === 0 ? (
            <div className="p-8 text-center text-gray-500">イベントがありません</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {events.map((event) => (
                <div key={event.id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{event.name}</h3>
                      {event.description && (
                        <p className="text-gray-600 mt-1">{event.description}</p>
                      )}
                      <div className="mt-3 flex items-center space-x-4 text-sm text-gray-500">
                        <span>最大選択可能: {event.max_date_selections === 999 ? '制限なし' : `${event.max_date_selections}日程`}</span>
                        <span>•</span>
                        <span>
                          作成日: {new Date(event.created_at).toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                    </div>
                    <div>
                      {event.is_active ? (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          公開中
                        </span>
                      ) : (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          非公開
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
