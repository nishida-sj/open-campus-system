'use client';

import { useState } from 'react';

export default function TestPage() {
  const [coursesResult, setCoursesResult] = useState<any>(null);
  const [datesResult, setDatesResult] = useState<any>(null);
  const [applyResult, setApplyResult] = useState<any>(null);
  const [loading, setLoading] = useState({ courses: false, dates: false, apply: false });
  const [error, setError] = useState({ courses: '', dates: '', apply: '' });

  // コース一覧取得テスト
  const testCourses = async () => {
    setLoading({ ...loading, courses: true });
    setError({ ...error, courses: '' });
    try {
      const res = await fetch('/api/courses');
      const data = await res.json();
      setCoursesResult(data);
    } catch (err) {
      setError({ ...error, courses: String(err) });
    } finally {
      setLoading({ ...loading, courses: false });
    }
  };

  // 開催日程取得テスト
  const testDates = async () => {
    setLoading({ ...loading, dates: true });
    setError({ ...error, dates: '' });
    try {
      const res = await fetch('/api/open-campus-dates');
      const data = await res.json();
      setDatesResult(data);
    } catch (err) {
      setError({ ...error, dates: String(err) });
    } finally {
      setLoading({ ...loading, dates: false });
    }
  };

  // 申込処理テスト
  const testApply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading({ ...loading, apply: true });
    setError({ ...error, apply: '' });

    const formData = new FormData(e.currentTarget);
    const testData = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      school_name: formData.get('school_name'),
      grade: formData.get('grade'),
      visit_date_id: formData.get('visit_date_id'),
      guardian_attendance: formData.get('guardian_attendance') === 'on',
    };

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData),
      });
      const data = await res.json();
      setApplyResult(data);
    } catch (err) {
      setError({ ...error, apply: String(err) });
    } finally {
      setLoading({ ...loading, apply: false });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">API動作確認テストページ</h1>

        {/* セクション1: コース一覧取得テスト */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">1. コース一覧取得テスト</h2>
          <button
            onClick={testCourses}
            disabled={loading.courses}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading.courses ? '取得中...' : 'GET /api/courses を実行'}
          </button>

          {error.courses && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              エラー: {error.courses}
            </div>
          )}

          {coursesResult && (
            <div className="mt-4">
              <h3 className="font-semibold text-gray-700 mb-2">結果:</h3>
              <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto">
                {JSON.stringify(coursesResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* セクション2: 開催日程取得テスト */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">2. 開催日程取得テスト</h2>
          <button
            onClick={testDates}
            disabled={loading.dates}
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading.dates ? '取得中...' : 'GET /api/open-campus-dates を実行'}
          </button>

          {error.dates && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              エラー: {error.dates}
            </div>
          )}

          {datesResult && (
            <div className="mt-4">
              <h3 className="font-semibold text-gray-700 mb-2">結果:</h3>
              <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto">
                {JSON.stringify(datesResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* セクション3: 申込処理テスト */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">3. 申込処理テスト</h2>
          <form onSubmit={testApply} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">氏名</label>
              <input
                type="text"
                name="name"
                defaultValue="テスト太郎"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
              <input
                type="email"
                name="email"
                defaultValue="test@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
              <input
                type="tel"
                name="phone"
                defaultValue="090-1234-5678"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学校名</label>
              <input
                type="text"
                name="school_name"
                defaultValue="テスト高等学校"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学年</label>
              <select
                name="grade"
                defaultValue="高校3年生"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option>中学3年生</option>
                <option>高校1年生</option>
                <option>高校2年生</option>
                <option>高校3年生</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">参加希望日ID（UUID）</label>
              <input
                type="text"
                name="visit_date_id"
                placeholder="開催日程のUUIDを入力"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">※上の「開催日程取得テスト」でUUIDを確認してください</p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="guardian_attendance"
                id="guardian_attendance"
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="guardian_attendance" className="ml-2 text-sm text-gray-700">
                保護者同伴
              </label>
            </div>

            <button
              type="submit"
              disabled={loading.apply}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading.apply ? '送信中...' : 'POST /api/apply を実行'}
            </button>
          </form>

          {error.apply && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              エラー: {error.apply}
            </div>
          )}

          {applyResult && (
            <div className="mt-4">
              <h3 className="font-semibold text-gray-700 mb-2">結果:</h3>
              <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto">
                {JSON.stringify(applyResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-semibold mb-2">💡 使い方:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>まず「開催日程取得テスト」を実行して、UUIDを確認</li>
            <li>取得したUUIDを「参加希望日」フィールドにコピー</li>
            <li>「申込処理テスト」を実行して動作確認</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
