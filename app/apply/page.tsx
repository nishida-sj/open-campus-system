'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface EventData {
  id: string;
  name: string;
  description: string | null;
  overview: string | null;
  max_date_selections: number;
  allow_multiple_dates: boolean;
  is_active: boolean;
}

interface DateData {
  id: string;
  date: string;
  capacity: number;
  current_count: number;
  remaining: number;
  is_active: boolean;
}

interface CourseData {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  display_order: number;
  applicable_date_ids: string[];
}

interface DateSelection {
  date_id: string;
  course_id: string | null;
}

function ApplyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event');

  const [event, setEvent] = useState<EventData | null>(null);
  const [dates, setDates] = useState<DateData[]>([]);
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // フォーム状態
  const [guardianAttendance, setGuardianAttendance] = useState(false);
  const [schoolType, setSchoolType] = useState<string>('');
  const [selectedDates, setSelectedDates] = useState<DateSelection[]>([]);

  // 学校種別に応じた学年選択肢
  const getGradeOptions = () => {
    switch (schoolType) {
      case '中学校':
        return ['中学1年生', '中学2年生', '中学3年生'];
      case '高校':
        return ['高校1年生', '高校2年生', '高校3年生'];
      case '既卒':
        return ['既卒'];
      default:
        return [
          '中学1年生',
          '中学2年生',
          '中学3年生',
          '高校1年生',
          '高校2年生',
          '高校3年生',
          '既卒',
        ];
    }
  };

  // イベントデータを取得
  useEffect(() => {
    if (!eventId) {
      router.push('/');
      return;
    }

    const fetchEventData = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}`);
        if (!response.ok) {
          throw new Error('イベントの取得に失敗しました');
        }

        const data = await response.json();
        setEvent(data.event);
        setDates(data.dates || []);
        setCourses(data.courses || []);

        // 単一選択の場合、最初の日程を自動選択（残席がある場合）
        if (!data.event.allow_multiple_dates && data.dates.length > 0) {
          const firstAvailableDate = data.dates.find((d: DateData) => d.remaining > 0);
          if (firstAvailableDate) {
            setSelectedDates([{ date_id: firstAvailableDate.id, course_id: null }]);
          }
        }
      } catch (error) {
        console.error('イベント取得エラー:', error);
        setErrors({ general: 'イベント情報の取得に失敗しました' });
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId, router]);

  // 日程選択の変更
  const handleDateSelection = (dateId: string, checked: boolean) => {
    if (!event) return;

    if (!event.allow_multiple_dates) {
      // 単一選択の場合
      if (checked) {
        setSelectedDates([{ date_id: dateId, course_id: null }]);
      } else {
        setSelectedDates([]);
      }
    } else {
      // 複数選択の場合
      if (checked) {
        // 最大選択数チェック
        if (
          event.max_date_selections !== 999 &&
          selectedDates.length >= event.max_date_selections
        ) {
          alert(
            `最大${event.max_date_selections}日程まで選択できます`
          );
          return;
        }
        setSelectedDates([...selectedDates, { date_id: dateId, course_id: null }]);
      } else {
        setSelectedDates(selectedDates.filter((s) => s.date_id !== dateId));
      }
    }
  };

  // コース選択の変更
  const handleCourseSelection = (dateId: string, courseId: string | null) => {
    setSelectedDates(
      selectedDates.map((s) =>
        s.date_id === dateId ? { ...s, course_id: courseId } : s
      )
    );
  };

  // 指定日程で選択可能なコースを取得
  const getCoursesForDate = (dateId: string): CourseData[] => {
    return courses.filter((c) => c.applicable_date_ids.includes(dateId));
  };

  // フォーム送信
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    // 日程選択チェック
    if (selectedDates.length === 0) {
      setErrors({ general: '参加日程を選択してください' });
      setSubmitting(false);
      return;
    }

    // コース選択必須チェック（コースがある日程の場合）
    for (const selection of selectedDates) {
      const availableCourses = getCoursesForDate(selection.date_id);
      if (availableCourses.length > 0 && !selection.course_id) {
        const date = dates.find((d) => d.id === selection.date_id);
        const dateStr = date
          ? new Date(date.date).toLocaleDateString('ja-JP', {
              month: 'long',
              day: 'numeric',
            })
          : '選択した日程';
        setErrors({ general: `${dateStr}のコースを選択してください` });
        setSubmitting(false);
        return;
      }
    }

    const formData = new FormData(e.currentTarget);
    const data = {
      event_id: eventId,
      name: formData.get('name') as string,
      kana_name: (formData.get('kana_name') as string) || undefined,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      school_name: formData.get('school_name') as string,
      school_type: (formData.get('school_type') as string) || undefined,
      grade: formData.get('grade') as string,
      selected_dates: selectedDates,
      guardian_attendance: guardianAttendance,
      guardian_name: guardianAttendance
        ? (formData.get('guardian_name') as string)
        : undefined,
      guardian_phone: guardianAttendance
        ? (formData.get('guardian_phone') as string)
        : undefined,
      remarks: (formData.get('remarks') as string) || undefined,
    };

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        router.push(`/apply/success?token=${result.token}`);
      } else {
        if (result.details) {
          const newErrors: Record<string, string> = {};
          result.details.forEach((detail: any) => {
            newErrors[detail.path[0]] = detail.message;
          });
          setErrors(newErrors);
        } else {
          setErrors({ general: result.error || '申込に失敗しました' });
        }
      }
    } catch (error) {
      setErrors({ general: 'サーバーエラーが発生しました' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">イベントが見つかりません</p>
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:text-blue-700 underline"
          >
            イベント一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:text-blue-700 text-sm mb-4 inline-flex items-center"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            イベント一覧に戻る
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{event.name}</h1>
          <p className="text-gray-600">必要事項を入力してお申し込みください</p>
        </div>

        {/* イベント概要 */}
        {event.overview && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">イベント概要</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{event.overview}</p>
          </div>
        )}

        {/* メインフォーム */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* 全体エラーメッセージ */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {errors.general}
              </div>
            )}

            {/* 参加日程選択 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                参加日程選択 <span className="text-red-500">*</span>
              </h3>
              {event.allow_multiple_dates && (
                <p className="text-sm text-gray-600 mb-3">
                  {event.max_date_selections === 999
                    ? '複数の日程を選択できます'
                    : `最大${event.max_date_selections}日程まで選択できます`}
                </p>
              )}

              <div className="space-y-3">
                {dates.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
                    現在、受付中の日程はありません
                  </div>
                ) : (
                  dates.map((date) => {
                    const isSelected = selectedDates.some((s) => s.date_id === date.id);
                    const availableCourses = getCoursesForDate(date.id);
                    const selectedCourse = selectedDates.find((s) => s.date_id === date.id)
                      ?.course_id;

                    return (
                      <div
                        key={date.id}
                        className={`border-2 rounded-lg p-4 transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        } ${date.remaining === 0 ? 'opacity-50' : ''}`}
                      >
                        <label className="flex items-start cursor-pointer">
                          <input
                            type={event.allow_multiple_dates ? 'checkbox' : 'radio'}
                            name="date_selection"
                            checked={isSelected}
                            onChange={(e) =>
                              handleDateSelection(date.id, e.target.checked)
                            }
                            disabled={date.remaining === 0}
                            className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="ml-3 flex-1">
                            <div className="font-semibold text-gray-900">
                              {new Date(date.date).toLocaleDateString('ja-JP', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                weekday: 'long',
                              })}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {date.remaining > 0 ? (
                                <span>残り {date.remaining}名</span>
                              ) : (
                                <span className="text-red-600 font-semibold">満席</span>
                              )}
                            </div>

                            {/* コース選択（この日程が選択されている場合） */}
                            {isSelected && availableCourses.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-blue-200">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  コース選択 <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={selectedCourse || ''}
                                  onChange={(e) =>
                                    handleCourseSelection(
                                      date.id,
                                      e.target.value || null
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                >
                                  <option value="">コースを選択してください</option>
                                  {availableCourses.map((course) => (
                                    <option key={course.id} value={course.id}>
                                      {course.name}
                                      {course.description && ` - ${course.description}`}
                                      {course.capacity && ` (定員: ${course.capacity}名)`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 申込者情報 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">申込者情報</h3>
              <div className="space-y-4">
                {/* 氏名 */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    氏名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="山田 太郎"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                </div>

                {/* ふりがな */}
                <div>
                  <label
                    htmlFor="kana_name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    ふりがな
                  </label>
                  <input
                    type="text"
                    id="kana_name"
                    name="kana_name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="やまだ たろう"
                  />
                </div>

                {/* メールアドレス */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    メールアドレス <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="example@example.com"
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>

                {/* 電話番号 */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    電話番号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="090-1234-5678"
                  />
                  {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
                </div>

                {/* 学校名 */}
                <div>
                  <label
                    htmlFor="school_name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    学校名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="school_name"
                    name="school_name"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="○○高等学校"
                  />
                  {errors.school_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.school_name}</p>
                  )}
                </div>

                {/* 学校種別 */}
                <div>
                  <label
                    htmlFor="school_type"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    学校種別
                  </label>
                  <select
                    id="school_type"
                    name="school_type"
                    value={schoolType}
                    onChange={(e) => setSchoolType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">選択してください</option>
                    <option value="中学校">中学校</option>
                    <option value="高校">高校</option>
                    <option value="既卒">既卒</option>
                    <option value="その他">その他</option>
                  </select>
                </div>

                {/* 学年 */}
                <div>
                  <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-1">
                    学年 <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="grade"
                    name="grade"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">選択してください</option>
                    {getGradeOptions().map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {errors.grade && <p className="mt-1 text-sm text-red-600">{errors.grade}</p>}
                </div>
              </div>
            </div>

            {/* 保護者情報 */}
            <div>
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="guardian_attendance"
                  checked={guardianAttendance}
                  onChange={(e) => setGuardianAttendance(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="guardian_attendance" className="ml-2 text-sm font-medium text-gray-700">
                  保護者同伴
                </label>
              </div>

              {guardianAttendance && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                  <h4 className="font-medium text-gray-900">保護者情報</h4>

                  <div>
                    <label
                      htmlFor="guardian_name"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      保護者氏名
                    </label>
                    <input
                      type="text"
                      id="guardian_name"
                      name="guardian_name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="山田 花子"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="guardian_phone"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      保護者電話番号
                    </label>
                    <input
                      type="tel"
                      id="guardian_phone"
                      name="guardian_phone"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="090-1234-5678"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 備考 */}
            <div>
              <label htmlFor="remarks" className="block text-sm font-medium text-gray-700 mb-1">
                備考・ご質問など
              </label>
              <textarea
                id="remarks"
                name="remarks"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="ご質問やご要望があればご記入ください"
              />
            </div>

            {/* 送信ボタン */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting || dates.length === 0 || selectedDates.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '送信中...' : '申込を送信'}
              </button>
            </div>

            {/* 注意事項 */}
            <div className="text-xs text-gray-500 text-center space-y-1">
              <p>※送信後、LINE公式アカウントへの友達追加をお願いします</p>
              <p>※友達追加後、申込が完了します</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    }>
      <ApplyPageContent />
    </Suspense>
  );
}
