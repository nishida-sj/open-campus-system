'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ConfirmedApplicant {
  id: string;
  name: string;
  kana_name: string | null;
  email: string;
  phone: string;
  school_name: string;
  school_type: string | null;
  grade: string;
  confirmed_date_id: string;
  confirmed_course_id: string | null;
  confirmed_at: string;
  line_user_id: string | null;
  confirmed_date: string;
  confirmed_course_name: string | null;
}

interface Event {
  id: string;
  name: string;
}

export default function ConfirmedListPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<ConfirmedApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApplicants, setSelectedApplicants] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>('all');

  // 認証チェック
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('admin_authenticated');
    if (!isAuthenticated) {
      router.push('/admin/login');
    }
  }, [router]);

  // イベント一覧取得
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('/api/admin/events');
        if (response.ok) {
          const data = await response.json();
          setEvents(data);
          if (data.length > 0) {
            setSelectedEventId(data[0].id);
          }
        }
      } catch (error) {
        console.error('イベント取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // 確定者データ取得
  useEffect(() => {
    if (!selectedEventId) return;

    const fetchApplicants = async () => {
      try {
        const response = await fetch(`/api/admin/confirmed-applicants?event_id=${selectedEventId}`);
        if (response.ok) {
          const data = await response.json();
          setApplicants(data);
        }
      } catch (error) {
        console.error('確定者取得エラー:', error);
      }
    };

    fetchApplicants();
    setSelectedApplicants([]);
  }, [selectedEventId]);

  // 日程でフィルター
  const filteredApplicants = dateFilter === 'all'
    ? applicants
    : applicants.filter((a) => a.confirmed_date === dateFilter);

  // ユニークな日程リストを取得
  const uniqueDates = Array.from(new Set(applicants.map((a) => a.confirmed_date))).sort();

  // チェックボックスのトグル
  const toggleSelection = (applicantId: string) => {
    setSelectedApplicants((prev) =>
      prev.includes(applicantId)
        ? prev.filter((id) => id !== applicantId)
        : [...prev, applicantId]
    );
  };

  // 全選択/全解除
  const toggleSelectAll = () => {
    if (selectedApplicants.length === filteredApplicants.length) {
      setSelectedApplicants([]);
    } else {
      setSelectedApplicants(filteredApplicants.map((a) => a.id));
    }
  };

  // LINE通知送信
  const handleSendNotifications = async () => {
    if (selectedApplicants.length === 0) {
      alert('送信対象を選択してください');
      return;
    }

    const selectedNames = applicants
      .filter((a) => selectedApplicants.includes(a.id))
      .map((a) => a.name)
      .join('、');

    if (!confirm(`以下の${selectedApplicants.length}名に確定通知を送信しますか？\n\n${selectedNames}`)) {
      return;
    }

    setSending(true);

    try {
      const response = await fetch('/api/admin/confirmed-applicants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicant_ids: selectedApplicants }),
      });

      if (response.ok) {
        const data = await response.json();
        const successCount = data.results.filter((r: any) => r.success).length;
        const failCount = data.results.filter((r: any) => !r.success).length;

        alert(`送信完了\n成功: ${successCount}件\n失敗: ${failCount}件`);
        setSelectedApplicants([]);
      } else {
        const error = await response.json();
        alert(`エラー: ${error.error || '送信に失敗しました'}`);
      }
    } catch (error) {
      console.error('送信エラー:', error);
      alert('エラーが発生しました');
    } finally {
      setSending(false);
    }
  };

  // CSV出力
  const handleExportCSV = () => {
    if (filteredApplicants.length === 0) {
      alert('出力するデータがありません');
      return;
    }

    // CSV ヘッダー
    const headers = [
      '氏名',
      'よみがな',
      '学校名',
      '学校種別',
      '学年',
      '参加日',
      'コース',
      'メールアドレス',
      '電話番号',
      '確定日時',
    ];

    // CSV データ
    const rows = filteredApplicants.map((a) => [
      a.name,
      a.kana_name || '',
      a.school_name,
      a.school_type || '',
      a.grade,
      new Date(a.confirmed_date).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }),
      a.confirmed_course_name || 'なし',
      a.email,
      a.phone,
      new Date(a.confirmed_at).toLocaleString('ja-JP'),
    ]);

    // CSV 文字列を作成
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    // BOM付きUTF-8でエンコード
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

    // ダウンロード
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const eventName = events.find((e) => e.id === selectedEventId)?.name || 'event';
    const dateStr = dateFilter === 'all' ? 'all' : new Date(dateFilter).toLocaleDateString('ja-JP').replace(/\//g, '-');
    link.setAttribute('href', url);
    link.setAttribute('download', `確定者一覧_${eventName}_${dateStr}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <h1 className="text-2xl font-bold text-gray-900">確定者管理</h1>
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition duration-200"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* フィルター */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* イベント選択 */}
            <div>
              <label htmlFor="event-select" className="block text-sm font-medium text-gray-700 mb-2">
                イベント選択
              </label>
              <select
                id="event-select"
                value={selectedEventId || ''}
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  setDateFilter('all');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 日程フィルター */}
            <div>
              <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700 mb-2">
                日程フィルター
              </label>
              <select
                id="date-filter"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">すべての日程</option>
                {uniqueDates.map((date) => (
                  <option key={date} value={date}>
                    {new Date(date).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'long',
                    })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 統計情報とアクション */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-6">
              <div>
                <p className="text-sm text-gray-600">確定者数</p>
                <p className="text-2xl font-bold text-green-600">{filteredApplicants.length}名</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">選択中</p>
                <p className="text-2xl font-bold text-blue-600">{selectedApplicants.length}名</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleExportCSV}
                disabled={filteredApplicants.length === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-semibold transition duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSV出力
              </button>
              <button
                onClick={handleSendNotifications}
                disabled={selectedApplicants.length === 0 || sending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-semibold transition duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {sending ? '送信中...' : 'LINE通知送信'}
              </button>
            </div>
          </div>
        </div>

        {/* テーブル */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedApplicants.length === filteredApplicants.length && filteredApplicants.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    氏名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    学校名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    学年
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    参加日
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    コース
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    LINE
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredApplicants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      該当する確定者はいません
                    </td>
                  </tr>
                ) : (
                  filteredApplicants.map((applicant) => (
                    <tr key={applicant.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedApplicants.includes(applicant.id)}
                          onChange={() => toggleSelection(applicant.id)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{applicant.name}</div>
                        {applicant.kana_name && (
                          <div className="text-xs text-gray-500">{applicant.kana_name}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{applicant.school_name}</div>
                        {applicant.school_type && (
                          <div className="text-xs text-gray-500">{applicant.school_type}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {applicant.grade}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(applicant.confirmed_date).toLocaleDateString('ja-JP', {
                          month: 'short',
                          day: 'numeric',
                          weekday: 'short',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {applicant.confirmed_course_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {applicant.line_user_id ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            連携済み
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            未連携
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
