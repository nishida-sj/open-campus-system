'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Course {
  id: string;
  name: string;
  category: string;
  description: string;
}

interface OpenCampusDate {
  id: string;
  date: string;
  capacity: number;
  current_count: number;
  remaining: number;
}

export default function ApplyPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [dates, setDates] = useState<OpenCampusDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [guardianAttendance, setGuardianAttendance] = useState(false);
  const [schoolType, setSchoolType] = useState<string>('');

  // 学校種別に応じた学年選択肢を取得
  const getGradeOptions = () => {
    switch (schoolType) {
      case '中学校':
        return [
          { value: '中学1年生', label: '中学1年生' },
          { value: '中学2年生', label: '中学2年生' },
          { value: '中学3年生', label: '中学3年生' },
        ];
      case '高校':
        return [
          { value: '高校1年生', label: '高校1年生' },
          { value: '高校2年生', label: '高校2年生' },
          { value: '高校3年生', label: '高校3年生' },
        ];
      case '既卒':
        return [
          { value: '既卒', label: '既卒' },
        ];
      default:
        // 学校種別が未選択、またはその他の場合はすべて表示
        return [
          { value: '中学1年生', label: '中学1年生' },
          { value: '中学2年生', label: '中学2年生' },
          { value: '中学3年生', label: '中学3年生' },
          { value: '高校1年生', label: '高校1年生' },
          { value: '高校2年生', label: '高校2年生' },
          { value: '高校3年生', label: '高校3年生' },
          { value: '既卒', label: '既卒' },
        ];
    }
  };

  // コースと開催日程を取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [coursesRes, datesRes] = await Promise.all([
          fetch('/api/courses'),
          fetch('/api/open-campus-dates'),
        ]);

        const coursesData = await coursesRes.json();
        const datesData = await datesRes.json();

        setCourses(coursesData);
        // 残席がある日程のみ表示
        setDates(datesData.filter((d: OpenCampusDate) => d.remaining > 0));
      } catch (error) {
        console.error('データ取得エラー:', error);
      }
    };

    fetchData();
  }, []);

  // フォーム送信処理
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      kana_name: formData.get('kana_name') as string || undefined,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      school_name: formData.get('school_name') as string,
      school_type: formData.get('school_type') as string || undefined,
      grade: formData.get('grade') as string,
      interested_course_id: formData.get('interested_course_id') as string || undefined,
      visit_date_id: formData.get('visit_date_id') as string,
      guardian_attendance: guardianAttendance,
      guardian_name: guardianAttendance ? (formData.get('guardian_name') as string) : undefined,
      guardian_phone: guardianAttendance ? (formData.get('guardian_phone') as string) : undefined,
      remarks: formData.get('remarks') as string || undefined,
    };

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        // 成功時は成功ページへリダイレクト（tokenをクエリパラメータで渡す）
        router.push(`/apply/success?token=${result.token}`);
      } else {
        // エラーメッセージを表示
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
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">オープンキャンパス申込</h1>
          <p className="text-gray-600">必要事項を入力してお申し込みください</p>
        </div>

        {/* メインフォーム */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 全体エラーメッセージ */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {errors.general}
              </div>
            )}

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
              <label htmlFor="kana_name" className="block text-sm font-medium text-gray-700 mb-1">
                ふりがな
              </label>
              <input
                type="text"
                id="kana_name"
                name="kana_name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="やまだ たろう"
              />
              {errors.kana_name && <p className="mt-1 text-sm text-red-600">{errors.kana_name}</p>}
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
              <label htmlFor="school_name" className="block text-sm font-medium text-gray-700 mb-1">
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
              {errors.school_name && <p className="mt-1 text-sm text-red-600">{errors.school_name}</p>}
            </div>

            {/* 学校種別 */}
            <div>
              <label htmlFor="school_type" className="block text-sm font-medium text-gray-700 mb-1">
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
              {errors.school_type && <p className="mt-1 text-sm text-red-600">{errors.school_type}</p>}
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
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.grade && <p className="mt-1 text-sm text-red-600">{errors.grade}</p>}
            </div>

            {/* 希望コース */}
            <div>
              <label htmlFor="interested_course_id" className="block text-sm font-medium text-gray-700 mb-1">
                希望コース
              </label>
              {courses.length > 0 ? (
                <select
                  id="interested_course_id"
                  name="interested_course_id"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">選択してください</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name} {course.description && `- ${course.description}`}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-500">コース情報を読み込み中...</p>
              )}
              {errors.interested_course_id && (
                <p className="mt-1 text-sm text-red-600">{errors.interested_course_id}</p>
              )}
            </div>

            {/* 参加希望日 */}
            <div>
              <label htmlFor="visit_date_id" className="block text-sm font-medium text-gray-700 mb-1">
                参加希望日 <span className="text-red-500">*</span>
              </label>
              {dates.length > 0 ? (
                <select
                  id="visit_date_id"
                  name="visit_date_id"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">選択してください</option>
                  {dates.map((date) => (
                    <option key={date.id} value={date.id}>
                      {new Date(date.date).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'short',
                      })}{' '}
                      （残り{date.remaining}名）
                    </option>
                  ))}
                </select>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
                  現在、受付中の日程はありません
                </div>
              )}
              {errors.visit_date_id && <p className="mt-1 text-sm text-red-600">{errors.visit_date_id}</p>}
            </div>

            {/* 保護者同伴 */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="guardian_attendance"
                checked={guardianAttendance}
                onChange={(e) => setGuardianAttendance(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="guardian_attendance" className="ml-2 text-sm text-gray-700">
                保護者同伴
              </label>
            </div>

            {/* 保護者情報（条件付き表示） */}
            {guardianAttendance && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                <h3 className="font-medium text-gray-900">保護者情報</h3>

                {/* 保護者氏名 */}
                <div>
                  <label htmlFor="guardian_name" className="block text-sm font-medium text-gray-700 mb-1">
                    保護者氏名
                  </label>
                  <input
                    type="text"
                    id="guardian_name"
                    name="guardian_name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="山田 花子"
                  />
                  {errors.guardian_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.guardian_name}</p>
                  )}
                </div>

                {/* 保護者電話番号 */}
                <div>
                  <label htmlFor="guardian_phone" className="block text-sm font-medium text-gray-700 mb-1">
                    保護者電話番号
                  </label>
                  <input
                    type="tel"
                    id="guardian_phone"
                    name="guardian_phone"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="090-1234-5678"
                  />
                  {errors.guardian_phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.guardian_phone}</p>
                  )}
                </div>
              </div>
            )}

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
              {errors.remarks && <p className="mt-1 text-sm text-red-600">{errors.remarks}</p>}
            </div>

            {/* 送信ボタン */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || dates.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '送信中...' : '申込を送信'}
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
