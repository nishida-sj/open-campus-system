'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Event {
  id: string;
  name: string;
  description: string | null;
  overview: string | null;
  max_date_selections: number;
  is_active: boolean;
  allow_multiple_dates: boolean;
  created_at: string;
}

interface DateOption {
  date: string;
  capacity: number;
}

interface Course {
  name: string;
  description: string;
  capacity: number | null;
  display_order: number;
  applicable_date_indices: number[]; // どの日程に適用するか（インデックス）
}

export default function AdminEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // フォーム状態
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    overview: '',
    display_end_date: '',
    max_date_selections: 1,
    is_active: true,
    allow_multiple_dates: false,
    dates: [] as DateOption[],
    courses: [] as Course[],
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
      const response = await fetch('/api/admin/events');
      if (response.ok) {
        const eventsData = await response.json();
        setEvents(eventsData);
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

    if (formData.dates.length === 0) {
      alert('少なくとも1つの開催日を追加してください');
      return;
    }

    // コースの検証（コースがある場合）
    if (formData.courses.length > 0) {
      for (const course of formData.courses) {
        if (!course.name.trim()) {
          alert('コース名を入力してください');
          return;
        }
        if (course.applicable_date_indices.length === 0) {
          alert(`コース「${course.name}」に適用する日程を選択してください`);
          return;
        }
      }
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
          overview: '',
          display_end_date: '',
          max_date_selections: 1,
          is_active: true,
          allow_multiple_dates: false,
          dates: [],
          courses: [],
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

  // 開催日を追加
  const addDate = () => {
    setFormData((prev) => ({
      ...prev,
      dates: [...prev.dates, { date: '', capacity: 30 }],
    }));
  };

  // 開催日を削除
  const removeDate = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      dates: prev.dates.filter((_, i) => i !== index),
    }));
  };

  // 開催日の日付を変更
  const updateDateValue = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      dates: prev.dates.map((d, i) => (i === index ? { ...d, date: value } : d)),
    }));
  };

  // 開催日の定員を変更
  const updateDateCapacity = (index: number, value: number) => {
    setFormData((prev) => ({
      ...prev,
      dates: prev.dates.map((d, i) => (i === index ? { ...d, capacity: value } : d)),
    }));
  };

  // コースを追加
  const addCourse = () => {
    setFormData((prev) => ({
      ...prev,
      courses: [
        ...prev.courses,
        {
          name: '',
          description: '',
          capacity: null,
          display_order: prev.courses.length,
          applicable_date_indices: [],
        },
      ],
    }));
  };

  // コースを削除
  const removeCourse = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      courses: prev.courses.filter((_, i) => i !== index),
    }));
  };

  // コース名を変更
  const updateCourseName = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      courses: prev.courses.map((c, i) => (i === index ? { ...c, name: value } : c)),
    }));
  };

  // コース説明を変更
  const updateCourseDescription = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      courses: prev.courses.map((c, i) => (i === index ? { ...c, description: value } : c)),
    }));
  };

  // コース定員を変更
  const updateCourseCapacity = (index: number, value: string) => {
    const capacity = value === '' ? null : parseInt(value);
    setFormData((prev) => ({
      ...prev,
      courses: prev.courses.map((c, i) => (i === index ? { ...c, capacity } : c)),
    }));
  };

  // コースの適用日程を変更
  const toggleCourseDateApplicability = (courseIndex: number, dateIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      courses: prev.courses.map((c, i) => {
        if (i !== courseIndex) return c;
        const indices = c.applicable_date_indices.includes(dateIndex)
          ? c.applicable_date_indices.filter((idx) => idx !== dateIndex)
          : [...c.applicable_date_indices, dateIndex];
        return { ...c, applicable_date_indices: indices };
      }),
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
                  説明（管理用）
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="管理用のメモを入力してください"
                />
              </div>

              {/* 概要 */}
              <div>
                <label htmlFor="overview" className="block text-sm font-medium text-gray-700 mb-2">
                  イベント概要（申込者向け）
                </label>
                <textarea
                  id="overview"
                  rows={5}
                  value={formData.overview}
                  onChange={(e) => setFormData({ ...formData, overview: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="申込者に表示されるイベントの詳細説明を入力してください"
                />
                <p className="text-xs text-gray-500 mt-1">
                  この内容は申込者向けのイベント一覧ページと申込ページに表示されます
                </p>
              </div>

              {/* 表示終了日 */}
              <div>
                <label htmlFor="display_end_date" className="block text-sm font-medium text-gray-700 mb-2">
                  イベント一覧表示終了日
                </label>
                <input
                  type="date"
                  id="display_end_date"
                  value={formData.display_end_date}
                  onChange={(e) => setFormData({ ...formData, display_end_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  この日を過ぎると申込者向けイベント一覧に表示されなくなります（空欄の場合は常に表示）
                </p>
              </div>

              {/* 複数日参加設定 */}
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    id="allow_multiple_dates"
                    checked={formData.allow_multiple_dates}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        allow_multiple_dates: e.target.checked,
                        max_date_selections: e.target.checked ? formData.max_date_selections : 1,
                      })
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label
                    htmlFor="allow_multiple_dates"
                    className="ml-2 text-sm font-medium text-gray-900"
                  >
                    複数日参加を許可する
                  </label>
                </div>

                {formData.allow_multiple_dates && (
                  <div>
                    <label
                      htmlFor="max_selections"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
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
                      <option value={2}>2つまで</option>
                      <option value={3}>3つまで</option>
                      <option value={4}>4つまで</option>
                      <option value={5}>5つまで</option>
                      <option value={999}>制限なし</option>
                    </select>
                  </div>
                )}

                <p className="text-xs text-gray-600 mt-2">
                  {formData.allow_multiple_dates
                    ? '参加者は複数の日程を選択できます'
                    : '参加者は1つの日程のみ選択できます'}
                </p>
              </div>

              {/* コース管理 */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    コース設定（オプション）
                  </label>
                  <button
                    type="button"
                    onClick={addCourse}
                    className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded transition duration-200"
                  >
                    + コースを追加
                  </button>
                </div>

                {formData.courses.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
                    <p className="text-gray-500 mb-2 text-sm">
                      コースは登録されていません
                    </p>
                    <p className="text-xs text-gray-400 mb-3">
                      コースを追加すると、申込者が日程ごとにコースを選択できるようになります
                    </p>
                    <button
                      type="button"
                      onClick={addCourse}
                      className="text-purple-600 hover:text-purple-700 font-medium text-sm"
                    >
                      最初のコースを追加
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 border border-gray-200 rounded-lg p-4">
                    {formData.courses.map((course, courseIndex) => (
                      <div
                        key={courseIndex}
                        className="border border-purple-200 bg-purple-50 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-sm font-semibold text-gray-900">
                            コース {courseIndex + 1}
                          </h4>
                          <button
                            type="button"
                            onClick={() => removeCourse(courseIndex)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            削除
                          </button>
                        </div>

                        <div className="space-y-3">
                          {/* コース名 */}
                          <div>
                            <label className="block text-xs text-gray-700 mb-1">
                              コース名 *
                            </label>
                            <input
                              type="text"
                              required={formData.courses.length > 0}
                              value={course.name}
                              onChange={(e) => updateCourseName(courseIndex, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="例: Aコース（体験授業中心）"
                            />
                          </div>

                          {/* コース説明 */}
                          <div>
                            <label className="block text-xs text-gray-700 mb-1">
                              コース説明
                            </label>
                            <textarea
                              rows={2}
                              value={course.description}
                              onChange={(e) =>
                                updateCourseDescription(courseIndex, e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="コースの内容を説明してください"
                            />
                          </div>

                          {/* コース定員 */}
                          <div>
                            <label className="block text-xs text-gray-700 mb-1">
                              コース定員（空欄で無制限）
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={course.capacity === null ? '' : course.capacity}
                              onChange={(e) => updateCourseCapacity(courseIndex, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="無制限"
                            />
                          </div>

                          {/* 適用日程選択 */}
                          {formData.dates.length > 0 && (
                            <div>
                              <label className="block text-xs text-gray-700 mb-2">
                                このコースを適用する日程 *
                              </label>
                              <div className="space-y-2 bg-white rounded p-3 max-h-40 overflow-y-auto">
                                {formData.dates.map((date, dateIndex) => (
                                  <label
                                    key={dateIndex}
                                    className="flex items-center space-x-2 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={course.applicable_date_indices.includes(dateIndex)}
                                      onChange={() =>
                                        toggleCourseDateApplicability(courseIndex, dateIndex)
                                      }
                                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {date.date
                                        ? new Date(date.date).toLocaleDateString('ja-JP', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            weekday: 'short',
                                          })
                                        : `日程 ${dateIndex + 1}（未設定）`}
                                    </span>
                                  </label>
                                ))}
                              </div>
                              {course.applicable_date_indices.length === 0 && (
                                <p className="text-xs text-red-600 mt-1">
                                  少なくとも1つの日程を選択してください
                                </p>
                              )}
                            </div>
                          )}

                          {formData.dates.length === 0 && (
                            <p className="text-xs text-orange-600">
                              ⚠️ 先に開催日程を追加してから、適用日程を選択してください
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-sm text-gray-500 mt-2">
                  登録コース数: {formData.courses.length}件
                </p>
              </div>

              {/* 開催日程 */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    開催日程 *
                  </label>
                  <button
                    type="button"
                    onClick={addDate}
                    className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition duration-200"
                  >
                    + 日程を追加
                  </button>
                </div>

                {formData.dates.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <p className="text-gray-500 mb-2">開催日程が登録されていません</p>
                    <button
                      type="button"
                      onClick={addDate}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      最初の日程を追加
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                    {formData.dates.map((dateItem, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              開催日 *
                            </label>
                            <input
                              type="date"
                              required
                              value={dateItem.date}
                              onChange={(e) => updateDateValue(index, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              定員 *
                            </label>
                            <input
                              type="number"
                              required
                              min="1"
                              value={dateItem.capacity}
                              onChange={(e) =>
                                updateDateCapacity(index, parseInt(e.target.value) || 0)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDate(index)}
                          className="text-red-600 hover:text-red-700 p-2"
                          title="削除"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-sm text-gray-500 mt-2">
                  登録日程数: {formData.dates.length}件
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
                        <p className="text-gray-600 text-sm mt-1">管理メモ: {event.description}</p>
                      )}
                      {event.overview && (
                        <p className="text-gray-700 mt-2 text-sm bg-blue-50 p-2 rounded">
                          概要: {event.overview.substring(0, 100)}
                          {event.overview.length > 100 ? '...' : ''}
                        </p>
                      )}
                      <div className="mt-3 flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-gray-500">
                        <span>
                          最大選択: {event.max_date_selections === 999 ? '制限なし' : `${event.max_date_selections}日程`}
                        </span>
                        <span>•</span>
                        {event.allow_multiple_dates && (
                          <>
                            <span className="text-green-600 font-medium">複数日参加可</span>
                            <span>•</span>
                          </>
                        )}
                        <span>
                          作成日: {new Date(event.created_at).toLocaleDateString('ja-JP')}
                        </span>
                      </div>

                      {/* 編集ボタン */}
                      <div className="mt-4">
                        <button
                          onClick={() => router.push(`/admin/events/${event.id}/edit`)}
                          className="text-sm bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition duration-200"
                        >
                          編集
                        </button>
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
