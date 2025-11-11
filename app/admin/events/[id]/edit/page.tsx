'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Event {
  id: string;
  name: string;
  description: string | null;
  overview: string | null;
  confirmation_message: string | null;
  max_date_selections: number;
  is_active: boolean;
  allow_multiple_dates: boolean;
  created_at: string;
}

interface DateInfo {
  id: string;
  date: string;
  capacity: number;
  current_count: number;
  is_active: boolean;
  has_applicants: boolean;
}

interface Course {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  display_order: number;
  applicable_date_ids: string[];
}

export default function EventEditPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [dates, setDates] = useState<DateInfo[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [totalApplicants, setTotalApplicants] = useState(0);

  // 編集用の日程とコース（申込者0件の場合のみ使用）
  const [editableDates, setEditableDates] = useState<Array<{date: string; capacity: number}>>([]);
  const [editableCourses, setEditableCourses] = useState<Array<{
    name: string;
    description: string;
    capacity: number | null;
    display_order: number;
    applicable_date_indices: number[];
  }>>([]);

  // フォーム状態
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    overview: '',
    confirmation_message: '',
    display_end_date: '',
    is_active: true,
    allow_multiple_dates: false,
    max_date_selections: 1,
  });

  // 認証チェック
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('admin_authenticated');
    if (!isAuthenticated) {
      router.push('/admin/login');
    }
  }, [router]);

  // イベントデータ取得
  useEffect(() => {
    const fetchEventData = async () => {
      try {
        // イベント基本情報
        const eventRes = await fetch(`/api/admin/events/${eventId}`);
        if (!eventRes.ok) {
          throw new Error('イベントの取得に失敗しました');
        }
        const eventData = await eventRes.json();
        setEvent(eventData.event);
        setDates(eventData.dates || []);
        setCourses(eventData.courses || []);
        setTotalApplicants(eventData.total_applicants || 0);

        // 編集用の日程とコースを初期化（申込者0件の場合）
        if ((eventData.total_applicants || 0) === 0) {
          setEditableDates((eventData.dates || []).map((d: DateInfo) => ({
            date: d.date,
            capacity: d.capacity,
          })));
          setEditableCourses((eventData.courses || []).map((c: Course) => ({
            name: c.name,
            description: c.description || '',
            capacity: c.capacity,
            display_order: c.display_order,
            applicable_date_indices: c.applicable_date_ids.map((dateId: string) =>
              (eventData.dates || []).findIndex((d: DateInfo) => d.id === dateId)
            ),
          })));
        }

        // フォームに初期値をセット
        setFormData({
          name: eventData.event.name,
          description: eventData.event.description || '',
          overview: eventData.event.overview || '',
          confirmation_message: eventData.event.confirmation_message || '',
          display_end_date: eventData.event.display_end_date || '',
          is_active: eventData.event.is_active,
          allow_multiple_dates: eventData.event.allow_multiple_dates,
          max_date_selections: eventData.event.max_date_selections,
        });
      } catch (error) {
        console.error('データ取得エラー:', error);
        alert('イベントデータの取得に失敗しました');
        router.push('/admin/events');
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId, router]);

  // 日程管理関数（申込者0件の場合のみ）
  const addDate = () => {
    setEditableDates([...editableDates, { date: '', capacity: 30 }]);
  };

  const removeDate = (index: number) => {
    setEditableDates(editableDates.filter((_, i) => i !== index));
    // コースの適用日程インデックスも更新
    setEditableCourses(
      editableCourses.map((c) => ({
        ...c,
        applicable_date_indices: c.applicable_date_indices
          .filter((idx) => idx !== index)
          .map((idx) => (idx > index ? idx - 1 : idx)),
      }))
    );
  };

  const updateDate = (index: number, field: 'date' | 'capacity', value: string | number) => {
    setEditableDates(
      editableDates.map((d, i) =>
        i === index ? { ...d, [field]: field === 'capacity' ? Number(value) : value } : d
      )
    );
  };

  // コース管理関数（申込者0件の場合のみ）
  const addCourse = () => {
    setEditableCourses([
      ...editableCourses,
      {
        name: '',
        description: '',
        capacity: null,
        display_order: editableCourses.length,
        applicable_date_indices: [],
      },
    ]);
  };

  const removeCourse = (index: number) => {
    setEditableCourses(editableCourses.filter((_, i) => i !== index));
  };

  const updateCourse = (index: number, field: string, value: any) => {
    setEditableCourses(
      editableCourses.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const toggleCourseDateApplicability = (courseIndex: number, dateIndex: number) => {
    setEditableCourses(
      editableCourses.map((c, i) => {
        if (i !== courseIndex) return c;
        const indices = c.applicable_date_indices.includes(dateIndex)
          ? c.applicable_date_indices.filter((idx) => idx !== dateIndex)
          : [...c.applicable_date_indices, dateIndex];
        return { ...c, applicable_date_indices: indices };
      })
    );
  };

  // 保存処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // 申込者が0件の場合は、日程とコースも含めて保存
      const dataToSave = totalApplicants === 0
        ? {
            ...formData,
            dates: editableDates,
            courses: editableCourses,
          }
        : formData;

      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSave),
      });

      if (response.ok) {
        alert('イベント情報を更新しました');
        router.push('/admin/events');
      } else {
        const error = await response.json();
        alert(`エラー: ${error.message || '更新に失敗しました'}`);
      }
    } catch (error) {
      console.error('更新エラー:', error);
      alert('エラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">イベントが見つかりません</p>
          <button
            onClick={() => router.push('/admin/events')}
            className="text-blue-600 hover:text-blue-700 underline"
          >
            イベント管理に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">イベント編集</h1>
            <button
              onClick={() => router.push('/admin/events')}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition duration-200"
            >
              イベント管理に戻る
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 編集フォーム */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">基本情報の編集</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
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
              />
            </div>

            {/* 説明（管理用） */}
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

            {/* 概要（申込者向け） */}
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

            {/* 確定者案内メッセージ */}
            <div>
              <label htmlFor="confirmation_message" className="block text-sm font-medium text-gray-700 mb-2">
                確定者案内メッセージ（LINE・メール通知用）
              </label>
              <textarea
                id="confirmation_message"
                rows={5}
                value={formData.confirmation_message}
                onChange={(e) => setFormData({ ...formData, confirmation_message: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="参加確定者に送信する追加メッセージを入力してください（持ち物、集合場所、注意事項など）"
              />
              <p className="text-xs text-gray-500 mt-1">
                この内容は確定者管理画面からLINE・メール通知を送信する際に、基本メッセージに追加されます
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
                onClick={() => router.push('/admin/events')}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition duration-200 disabled:opacity-50"
              >
                {saving ? '保存中...' : '変更を保存'}
              </button>
            </div>
          </form>
        </div>

        {/* イベント設定情報 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            イベント設定{totalApplicants > 0 && '（変更不可）'}
          </h2>

          {totalApplicants === 0 ? (
            // 申込者0件の場合は編集可能
            <div className="space-y-4">
              {/* 複数日参加許可 */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allow_multiple_dates"
                  checked={formData.allow_multiple_dates}
                  onChange={(e) => setFormData({ ...formData, allow_multiple_dates: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="allow_multiple_dates" className="ml-2 text-sm font-medium text-gray-700">
                  複数日参加を許可する
                </label>
              </div>

              {/* 最大選択可能日程数 */}
              <div>
                <label htmlFor="max_date_selections" className="block text-sm font-medium text-gray-700 mb-2">
                  最大選択可能日程数
                </label>
                <input
                  type="number"
                  id="max_date_selections"
                  min="1"
                  value={formData.max_date_selections}
                  onChange={(e) => setFormData({ ...formData, max_date_selections: parseInt(e.target.value) || 1 })}
                  disabled={!formData.allow_multiple_dates}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  複数日参加を許可する場合に適用されます
                </p>
              </div>

              <p className="text-xs text-blue-600 mt-4">
                ✓ 申込者が0件のため、これらの設定を変更できます
              </p>
            </div>
          ) : (
            // 申込者がいる場合は読み取り専用
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600">複数日参加:</span>
                <span className="font-medium">
                  {event.allow_multiple_dates ? '許可する' : '許可しない'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600">最大選択可能日程数:</span>
                <span className="font-medium">
                  {event.max_date_selections === 999
                    ? '制限なし'
                    : `${event.max_date_selections}日程`}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600">作成日:</span>
                <span className="font-medium">
                  {new Date(event.created_at).toLocaleDateString('ja-JP')}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                ※ 申込者がいるため、これらの設定は変更できません
              </p>
            </div>
          )}
        </div>

        {/* コース情報（読み取り専用） */}
        {courses.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              登録済みコース（変更不可）
            </h2>
            <div className="space-y-3">
              {courses.map((course, index) => (
                <div key={course.id} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    コース {index + 1}: {course.name}
                  </h3>
                  {course.description && (
                    <p className="text-sm text-gray-600 mb-2">{course.description}</p>
                  )}
                  <div className="text-xs text-gray-500">
                    定員: {course.capacity ? `${course.capacity}名` : '無制限'} | 適用日程:{' '}
                    {course.applicable_date_ids.length}日程
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              ※ コース情報は申込に影響するため、イベント作成後は変更できません
            </p>
          </div>
        )}

        {/* 日程・コース編集セクション（申込者がいない場合のみ表示） */}
        {totalApplicants === 0 && (
          <>
            {/* 開催日程編集 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">開催日程の編集</h2>
              <div className="space-y-4">
                {editableDates.map((date, index) => (
                  <div key={index} className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                    <div className="flex gap-4 items-start">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          開催日
                        </label>
                        <input
                          type="date"
                          value={date.date}
                          onChange={(e) => updateDate(index, 'date', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div className="w-32">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          定員
                        </label>
                        <input
                          type="number"
                          value={date.capacity}
                          onChange={(e) => updateDate(index, 'capacity', parseInt(e.target.value))}
                          min="1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeDate(index)}
                          className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition duration-200"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addDate}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200 flex items-center"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                日程を追加
              </button>
            </div>

            {/* コース編集 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">コースの編集</h2>
              <div className="space-y-4">
                {editableCourses.map((course, courseIndex) => (
                  <div key={courseIndex} className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                    <div className="space-y-3">
                      <div className="flex gap-4 items-start">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            コース名
                          </label>
                          <input
                            type="text"
                            value={course.name}
                            onChange={(e) => updateCourse(courseIndex, 'name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                            required
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            定員
                          </label>
                          <input
                            type="number"
                            value={course.capacity || ''}
                            onChange={(e) =>
                              updateCourse(
                                courseIndex,
                                'capacity',
                                e.target.value ? parseInt(e.target.value) : null
                              )
                            }
                            min="1"
                            placeholder="無制限"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => removeCourse(courseIndex)}
                            className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition duration-200"
                          >
                            削除
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          コース説明
                        </label>
                        <textarea
                          value={course.description}
                          onChange={(e) => updateCourse(courseIndex, 'description', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          適用日程
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {editableDates.map((date, dateIndex) => (
                            <label
                              key={dateIndex}
                              className="inline-flex items-center px-3 py-2 border-2 rounded-md cursor-pointer transition-colors duration-200"
                              style={{
                                borderColor: course.applicable_date_indices.includes(dateIndex)
                                  ? '#10b981'
                                  : '#d1d5db',
                                backgroundColor: course.applicable_date_indices.includes(dateIndex)
                                  ? '#d1fae5'
                                  : '#ffffff',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={course.applicable_date_indices.includes(dateIndex)}
                                onChange={() =>
                                  toggleCourseDateApplicability(courseIndex, dateIndex)
                                }
                                className="mr-2"
                              />
                              <span className="text-sm">
                                {date.date
                                  ? new Date(date.date).toLocaleDateString('ja-JP', {
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : '日程未設定'}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addCourse}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition duration-200 flex items-center"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                コースを追加
              </button>
            </div>
          </>
        )}

        {/* 開催日程情報 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">開催日程</h2>
          <div className="space-y-3">
            {dates.map((date) => (
              <div
                key={date.id}
                className={`border-2 rounded-lg p-4 ${
                  date.has_applicants ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      {new Date(date.date).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'long',
                      })}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      定員: {date.capacity}名 | 申込数: {date.current_count}名
                      {date.has_applicants && (
                        <span className="ml-2 text-orange-600 font-medium">（申込者あり）</span>
                      )}
                    </div>
                  </div>
                  <div>
                    {date.is_active ? (
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
          <div className={`mt-4 p-4 border rounded-lg ${totalApplicants === 0 ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className="flex">
              <svg
                className={`w-5 h-5 mr-2 flex-shrink-0 ${totalApplicants === 0 ? 'text-blue-600' : 'text-yellow-600'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div className={`text-sm ${totalApplicants === 0 ? 'text-blue-800' : 'text-yellow-800'}`}>
                <p className="font-medium mb-1">日程・コースの変更について</p>
                {totalApplicants === 0 ? (
                  <p>
                    このイベントにはまだ申込者がいません。
                    <br />
                    イベント管理ページから日程とコースの追加・編集・削除が可能です。
                    <br />
                    申込者が1件でも発生すると、日程とコースの変更はできなくなります。
                  </p>
                ) : (
                  <p>
                    このイベントには{totalApplicants}件の申込があります。
                    <br />
                    申込に影響するため、日程とコースの変更はできません。
                    <br />
                    日程の追加・変更が必要な場合は、新しいイベントを作成することをお勧めします。
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
