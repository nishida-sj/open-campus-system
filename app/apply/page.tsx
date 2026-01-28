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
  allow_multiple_candidates: boolean;
  allow_multiple_courses_same_date: boolean;
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
  course_ids?: string[];
  priority?: number;
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

  const [guardianAttendance, setGuardianAttendance] = useState(false);
  const [schoolType, setSchoolType] = useState<string>('');
  const [selectedDates, setSelectedDates] = useState<DateSelection[]>([]);

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

        if (!data.event.allow_multiple_dates && !data.event.allow_multiple_candidates && data.dates.length > 0) {
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

  const handleDateSelection = (dateId: string, checked: boolean) => {
    if (!event) return;

    if (!event.allow_multiple_dates && !event.allow_multiple_candidates) {
      if (checked) {
        setSelectedDates([{ date_id: dateId, course_id: null }]);
      } else {
        setSelectedDates([]);
      }
    } else {
      if (checked) {
        if (
          event.max_date_selections !== 999 &&
          selectedDates.length >= event.max_date_selections
        ) {
          const label = event.allow_multiple_candidates ? '候補' : '日程';
          alert(
            `最大${event.max_date_selections}${label}まで選択できます`
          );
          return;
        }
        const priority = event.allow_multiple_candidates ? selectedDates.length + 1 : undefined;
        setSelectedDates([...selectedDates, { date_id: dateId, course_id: null, priority }]);
      } else {
        const removed = selectedDates.filter((s) => s.date_id !== dateId);
        if (event.allow_multiple_candidates) {
          const reordered = removed.map((s, index) => ({ ...s, priority: index + 1 }));
          setSelectedDates(reordered);
        } else {
          setSelectedDates(removed);
        }
      }
    }
  };

  const handleCourseSelection = (dateId: string, courseId: string | null) => {
    setSelectedDates(
      selectedDates.map((s) =>
        s.date_id === dateId ? { ...s, course_id: courseId } : s
      )
    );
  };

  const handleMultipleCourseSelection = (dateId: string, courseId: string, checked: boolean) => {
    setSelectedDates(
      selectedDates.map((s) => {
        if (s.date_id !== dateId) return s;

        const currentCourseIds = s.course_ids || [];
        const newCourseIds = checked
          ? [...currentCourseIds, courseId]
          : currentCourseIds.filter((id) => id !== courseId);

        return { ...s, course_id: null, course_ids: newCourseIds };
      })
    );
  };

  const getCoursesForDate = (dateId: string): CourseData[] => {
    return courses.filter((c) => c.applicable_date_ids.includes(dateId));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    if (selectedDates.length === 0) {
      setErrors({ general: '参加日程を選択してください' });
      setSubmitting(false);
      return;
    }

    for (const selection of selectedDates) {
      const availableCourses = getCoursesForDate(selection.date_id);
      if (availableCourses.length > 0) {
        const date = dates.find((d) => d.id === selection.date_id);
        const dateStr = date
          ? new Date(date.date).toLocaleDateString('ja-JP', {
              month: 'long',
              day: 'numeric',
            })
          : '選択した日程';

        if (event?.allow_multiple_courses_same_date) {
          if (!selection.course_ids || selection.course_ids.length === 0) {
            setErrors({ general: `${dateStr}で少なくとも1つのコースを選択してください` });
            setSubmitting(false);
            return;
          }
        } else {
          if (!selection.course_id) {
            setErrors({ general: `${dateStr}のコースを選択してください` });
            setSubmitting(false);
            return;
          }
        }
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-[#1a365d] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">イベントが見つかりません</p>
          <button
            onClick={() => router.push('/')}
            className="text-[#1a365d] hover:text-[#2c5282] underline"
          >
            イベント一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* ヘッダーバー */}
      <div className="bg-[#1a365d] text-white py-3">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-sm">伊勢学園高等学校 オープンキャンパス</p>
        </div>
      </div>

      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* 戻るリンク */}
          <button
            onClick={() => router.push('/')}
            className="text-[#1a365d] hover:text-[#2c5282] text-sm mb-6 inline-flex items-center transition-colors"
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

          {/* ページタイトル */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1a365d] mb-2 border-b-2 border-[#1a365d] pb-3">
              {event.name}
            </h1>
            <p className="text-gray-600 mt-3">必要事項を入力してお申し込みください</p>
          </div>

          {/* イベント概要 */}
          {event.overview && (
            <div className="bg-white border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-bold text-[#1a365d] mb-3 flex items-center">
                <span className="w-1 h-5 bg-[#1a365d] mr-3"></span>
                イベント概要
              </h2>
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{event.overview}</p>
            </div>
          )}

          {/* メインフォーム */}
          <div className="bg-white border border-gray-200">
            <form onSubmit={handleSubmit}>
              {/* エラーメッセージ */}
              {errors.general && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 m-6">
                  {errors.general}
                </div>
              )}

              {/* 参加日程選択セクション */}
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-bold text-[#1a365d] mb-4 flex items-center">
                  <span className="w-1 h-5 bg-[#1a365d] mr-3"></span>
                  参加日程選択
                  <span className="text-red-500 ml-1 text-sm">*</span>
                </h3>

                {event.allow_multiple_dates && (
                  <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 border-l-2 border-gray-300">
                    {event.max_date_selections === 999
                      ? '複数の日程を選択できます（選択した日程すべてに参加できます）'
                      : `最大${event.max_date_selections}日程まで選択できます`}
                  </p>
                )}

                {event.allow_multiple_candidates && (
                  <div className="bg-[#f0f4f8] border-l-4 border-[#1a365d] p-4 mb-4">
                    <p className="text-sm font-bold text-[#1a365d]">複数候補入力モード</p>
                    <p className="text-sm text-gray-700 mt-1">
                      {event.max_date_selections === 999
                        ? '複数の候補を選択できます。選択順に優先順位が付けられ、後ほど管理者が1つの日程を確定します。'
                        : `最大${event.max_date_selections}候補まで選択できます。選択順に優先順位が付けられます。`}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {dates.length === 0 ? (
                    <div className="bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 px-4 py-3">
                      現在、受付中の日程はありません
                    </div>
                  ) : (
                    dates.map((date) => {
                      const isSelected = selectedDates.some((s) => s.date_id === date.id);
                      const availableCourses = getCoursesForDate(date.id);
                      const selection = selectedDates.find((s) => s.date_id === date.id);
                      const selectedCourse = selection?.course_id;
                      const priority = selection?.priority;

                      return (
                        <div
                          key={date.id}
                          className={`border p-4 transition-all ${
                            isSelected
                              ? 'border-[#1a365d] bg-[#f0f4f8]'
                              : 'border-gray-200 hover:border-gray-400'
                          } ${date.remaining === 0 ? 'opacity-50' : ''}`}
                        >
                          <label className="flex items-start cursor-pointer">
                            <input
                              type={event.allow_multiple_dates || event.allow_multiple_candidates ? 'checkbox' : 'radio'}
                              name="date_selection"
                              checked={isSelected}
                              onChange={(e) =>
                                handleDateSelection(date.id, e.target.checked)
                              }
                              disabled={date.remaining === 0}
                              className="mt-1 w-5 h-5 text-[#1a365d] border-gray-300 focus:ring-[#1a365d]"
                            />
                            <div className="ml-3 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-bold text-gray-900">
                                  {new Date(date.date).toLocaleDateString('ja-JP', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    weekday: 'long',
                                  })}
                                </div>
                                {event.allow_multiple_candidates && priority && (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold bg-[#1a365d] text-white">
                                    第{priority}候補
                                  </span>
                                )}
                              </div>
                              <div className="text-sm mt-1">
                                {date.remaining > 0 ? (
                                  <span className="text-gray-600">残り <strong>{date.remaining}</strong>名</span>
                                ) : (
                                  <span className="text-red-600 font-bold">満席</span>
                                )}
                              </div>

                              {/* コース選択 */}
                              {isSelected && availableCourses.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-300">
                                  <label className="block text-sm font-bold text-gray-700 mb-2">
                                    コース選択 <span className="text-red-500">*</span>
                                  </label>

                                  {event.allow_multiple_courses_same_date ? (
                                    <div className="space-y-2">
                                      <p className="text-xs text-gray-600 mb-2">
                                        複数のコースを選択できます
                                      </p>
                                      {availableCourses.map((course) => {
                                        const selection = selectedDates.find((s) => s.date_id === date.id);
                                        const isChecked = selection?.course_ids?.includes(course.id) || false;

                                        return (
                                          <label
                                            key={course.id}
                                            className="flex items-start gap-2 p-3 border border-gray-200 hover:bg-gray-50 cursor-pointer"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={(e) =>
                                                handleMultipleCourseSelection(
                                                  date.id,
                                                  course.id,
                                                  e.target.checked
                                                )
                                              }
                                              className="mt-1 w-4 h-4 text-[#1a365d] border-gray-300 focus:ring-[#1a365d]"
                                            />
                                            <div className="flex-1">
                                              <div className="font-medium text-gray-900">{course.name}</div>
                                              {course.description && (
                                                <div className="text-sm text-gray-600">{course.description}</div>
                                              )}
                                              {course.capacity && (
                                                <div className="text-xs text-gray-500 mt-1">定員: {course.capacity}名</div>
                                              )}
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <select
                                      value={selectedCourse || ''}
                                      onChange={(e) =>
                                        handleCourseSelection(
                                          date.id,
                                          e.target.value || null
                                        )
                                      }
                                      className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-[#1a365d] focus:border-[#1a365d] bg-white"
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
                                  )}
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

              {/* 申込者情報セクション */}
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-bold text-[#1a365d] mb-4 flex items-center">
                  <span className="w-1 h-5 bg-[#1a365d] mr-3"></span>
                  申込者情報
                </h3>
                <div className="space-y-4">
                  {/* 氏名 */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-bold text-gray-700 mb-1">
                      氏名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-[#1a365d] focus:border-[#1a365d]"
                      placeholder="山田 太郎"
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                  </div>

                  {/* ふりがな */}
                  <div>
                    <label htmlFor="kana_name" className="block text-sm font-bold text-gray-700 mb-1">
                      ふりがな
                    </label>
                    <input
                      type="text"
                      id="kana_name"
                      name="kana_name"
                      className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-[#1a365d] focus:border-[#1a365d]"
                      placeholder="やまだ たろう"
                    />
                  </div>

                  {/* メールアドレス */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-1">
                      メールアドレス <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-[#1a365d] focus:border-[#1a365d]"
                      placeholder="example@example.com"
                    />
                    {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                  </div>

                  {/* 電話番号 */}
                  <div>
                    <label htmlFor="phone" className="block text-sm font-bold text-gray-700 mb-1">
                      電話番号 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      required
                      className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-[#1a365d] focus:border-[#1a365d]"
                      placeholder="090-1234-5678"
                    />
                    {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
                  </div>

                  {/* 学校名 */}
                  <div>
                    <label htmlFor="school_name" className="block text-sm font-bold text-gray-700 mb-1">
                      学校名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="school_name"
                      name="school_name"
                      required
                      className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-[#1a365d] focus:border-[#1a365d]"
                      placeholder="○○中学校"
                    />
                    {errors.school_name && (
                      <p className="mt-1 text-sm text-red-600">{errors.school_name}</p>
                    )}
                  </div>

                  {/* 学校種別と学年を横並びに */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 学校種別 */}
                    <div>
                      <label htmlFor="school_type" className="block text-sm font-bold text-gray-700 mb-1">
                        学校種別
                      </label>
                      <select
                        id="school_type"
                        name="school_type"
                        value={schoolType}
                        onChange={(e) => setSchoolType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-[#1a365d] focus:border-[#1a365d] bg-white"
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
                      <label htmlFor="grade" className="block text-sm font-bold text-gray-700 mb-1">
                        学年 <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="grade"
                        name="grade"
                        required
                        className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-[#1a365d] focus:border-[#1a365d] bg-white"
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
              </div>

              {/* 保護者情報セクション */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="guardian_attendance"
                    checked={guardianAttendance}
                    onChange={(e) => setGuardianAttendance(e.target.checked)}
                    className="w-4 h-4 text-[#1a365d] border-gray-300 focus:ring-[#1a365d]"
                  />
                  <label htmlFor="guardian_attendance" className="ml-2 text-sm font-bold text-gray-700">
                    保護者同伴
                  </label>
                </div>

                {guardianAttendance && (
                  <div className="bg-[#f8f9fa] border border-gray-200 p-4 space-y-4">
                    <h4 className="font-bold text-gray-900 text-sm">保護者情報</h4>

                    <div>
                      <label htmlFor="guardian_name" className="block text-sm font-bold text-gray-700 mb-1">
                        保護者氏名
                      </label>
                      <input
                        type="text"
                        id="guardian_name"
                        name="guardian_name"
                        className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-[#1a365d] focus:border-[#1a365d] bg-white"
                        placeholder="山田 花子"
                      />
                    </div>

                    <div>
                      <label htmlFor="guardian_phone" className="block text-sm font-bold text-gray-700 mb-1">
                        保護者電話番号
                      </label>
                      <input
                        type="tel"
                        id="guardian_phone"
                        name="guardian_phone"
                        className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-[#1a365d] focus:border-[#1a365d] bg-white"
                        placeholder="090-1234-5678"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 備考セクション */}
              <div className="p-6 border-b border-gray-200">
                <label htmlFor="remarks" className="block text-sm font-bold text-gray-700 mb-1">
                  備考・ご質問など
                </label>
                <textarea
                  id="remarks"
                  name="remarks"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-[#1a365d] focus:border-[#1a365d]"
                  placeholder="ご質問やご要望があればご記入ください"
                />
              </div>

              {/* 送信ボタン */}
              <div className="p-6">
                <button
                  type="submit"
                  disabled={submitting || dates.length === 0 || selectedDates.length === 0}
                  className="w-full bg-[#1a365d] hover:bg-[#0f2442] text-white font-bold py-4 px-6 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? '送信中...' : '申込を送信'}
                </button>

                {/* 注意事項 */}
                <div className="mt-4 text-xs text-gray-500 text-center space-y-1 bg-gray-50 p-3">
                  <p>※送信後、LINE公式アカウントへの友達追加をお願いします</p>
                  <p>※友達追加後、申込が完了します</p>
                </div>
              </div>
            </form>
          </div>

          {/* フッター */}
          <div className="mt-8 text-center text-xs text-gray-500">
            <p>© 伊勢学園高等学校</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-[#1a365d] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    }>
      <ApplyPageContent />
    </Suspense>
  );
}
