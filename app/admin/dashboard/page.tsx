'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Applicant {
  id: string;
  name: string;
  kana_name: string | null;
  email: string;
  phone: string;
  school_name: string;
  school_type: string | null;
  grade: string;
  interested_course_id: string | null;
  visit_date_id: string;
  guardian_attendance: boolean;
  guardian_name: string | null;
  guardian_phone: string | null;
  remarks: string | null;
  line_user_id: string | null;
  status: string;
  created_at: string;
}

interface DateInfo {
  id: string;
  date: string;
  capacity: number;
  current_count: number;
  applicant_count: number;
  is_active: boolean;
  event_id: string | null;
  course_capacities?: {
    course_id: string;
    course_name: string;
    capacity: number;
    current_count: number;
  }[];
}

interface Event {
  id: string;
  name: string;
  description: string | null;
  max_date_selections: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [dates, setDates] = useState<DateInfo[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [applicantsRes, datesRes, eventsRes] = await Promise.all([
          fetch('/api/admin/applicants'),
          fetch('/api/admin/dates'),
          fetch('/api/admin/events'),
        ]);

        const applicantsData = await applicantsRes.json();
        const datesData = await datesRes.json();
        const eventsData = await eventsRes.json();

        setApplicants(applicantsData);
        setDates(datesData);
        setEvents(eventsData);

        console.log('Dashboard Data:', {
          applicants: applicantsData.length,
          dates: datesData.length,
          events: eventsData.length,
        });

        // デフォルトで最初のイベントを選択
        if (eventsData.length > 0) {
          setSelectedEventId(eventsData[0].id);
          console.log('Selected Event ID:', eventsData[0].id);
        }
      } catch (error) {
        console.error('データ取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // CSVエクスポート
  const exportCSV = () => {
    // BOM付きUTF-8（Excelで文字化けしない）
    const bom = '\uFEFF';
    const headers = [
      'イベント名',
      '氏名',
      'ふりがな',
      'メールアドレス',
      '電話番号',
      '学校名',
      '学校種別',
      '学年',
      '参加日',
      'LINE登録',
      '保護者同伴',
      '保護者氏名',
      '保護者電話番号',
      '備考',
      '申込日時',
    ];

    const rows = filteredApplicants.map((applicant) => {
      const dateInfo = dates.find((d) => d.id === applicant.visit_date_id);
      const visitDate = dateInfo
        ? new Date(dateInfo.date).toLocaleDateString('ja-JP')
        : '';
      const lineStatus = applicant.line_user_id ? '登録済み' : '未登録';
      const guardianAttendance = applicant.guardian_attendance ? 'あり' : 'なし';

      return [
        selectedEvent?.name || '',
        applicant.name,
        applicant.kana_name || '',
        applicant.email,
        applicant.phone,
        applicant.school_name,
        applicant.school_type || '',
        applicant.grade,
        visitDate,
        lineStatus,
        guardianAttendance,
        applicant.guardian_name || '',
        applicant.guardian_phone || '',
        applicant.remarks || '',
        new Date(applicant.created_at).toLocaleString('ja-JP'),
      ];
    });

    const csvContent =
      bom +
      [headers, ...rows]
        .map((row) =>
          row
            .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\n');

    // ダウンロード
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().split('T')[0];
    const eventName = selectedEvent?.name.replace(/[\\/:*?"<>|]/g, '_') || 'all_events';

    link.setAttribute('href', url);
    link.setAttribute('download', `applicants_${eventName}_${today}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 日程情報を取得
  const getDateInfo = (dateId: string) => {
    const dateInfo = dates.find((d) => d.id === dateId);
    if (!dateInfo) return '不明';
    return new Date(dateInfo.date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  // 選択されたイベントの日程IDリスト
  const selectedEventDates = dates.filter((d) => d.event_id === selectedEventId);
  const selectedEventDateIds = selectedEventDates.map((d) => d.id);

  // デバッグ用
  console.log('Filter Debug:', {
    selectedEventId,
    totalDates: dates.length,
    selectedEventDates: selectedEventDates.length,
    selectedEventDateIds,
    totalApplicants: applicants.length,
  });

  // 選択されたイベントの申込者のみフィルタリング
  const filteredApplicants = selectedEventId
    ? applicants.filter((a) => selectedEventDateIds.includes(a.visit_date_id))
    : applicants;

  // 統計情報（選択されたイベントのみ）
  const totalApplicants = filteredApplicants.length;
  const completedApplicants = filteredApplicants.filter((a) => a.status === 'completed').length;
  const pendingApplicants = filteredApplicants.filter((a) => a.status === 'pending').length;
  const lineRegistered = filteredApplicants.filter((a) => a.line_user_id).length;

  // 選択されたイベント情報
  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="h-full bg-gray-100">
      {/* ページヘッダー */}
      <div className="bg-white shadow">
        <div className="px-8 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>

            {/* イベント選択 */}
            {events.length > 0 && (
              <div className="flex items-center space-x-4">
                <label htmlFor="event-select" className="text-sm font-medium text-gray-700">
                  表示するイベント:
                </label>
                <select
                  id="event-select"
                  value={selectedEventId || ''}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="p-8">

        {/* イベント情報 */}
        {selectedEvent && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{selectedEvent.name}</h2>
            {selectedEvent.description && (
              <p className="text-gray-600 mb-4">{selectedEvent.description}</p>
            )}
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>最大選択可能: {selectedEvent.max_date_selections === 999 ? '制限なし' : `${selectedEvent.max_date_selections}日程`}</span>
              <span>•</span>
              <span>開催日程数: {selectedEventDates.length}件</span>
              <span>•</span>
              <span>
                {selectedEvent.is_active ? (
                  <span className="text-green-600 font-semibold">公開中</span>
                ) : (
                  <span className="text-gray-600">非公開</span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">総申込数</div>
            <div className="text-3xl font-bold text-gray-900">{totalApplicants}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">完了</div>
            <div className="text-3xl font-bold text-green-600">{completedApplicants}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">保留中</div>
            <div className="text-3xl font-bold text-orange-600">{pendingApplicants}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">LINE登録</div>
            <div className="text-3xl font-bold text-blue-600">{lineRegistered}</div>
          </div>
        </div>

        {/* 開催日程一覧 */}
        <div className="bg-white rounded-lg shadow mb-8 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">開催日程</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {selectedEventDates.map((date) => (
              <div
                key={date.id}
                className={`p-4 rounded-lg border-2 ${
                  date.current_count >= date.capacity
                    ? 'bg-red-50 border-red-200'
                    : 'bg-green-50 border-green-200'
                }`}
              >
                <div className="font-semibold text-gray-900 mb-2">
                  {new Date(date.date).toLocaleDateString('ja-JP', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>申込数: {date.applicant_count || 0} 名</div>
                  <div>確定数: {date.current_count} 名</div>
                  <div>定員: {date.capacity} 名</div>
                </div>
                {date.course_capacities && date.course_capacities.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <div className="text-xs font-semibold text-gray-700 mb-1">コース別:</div>
                    <div className="space-y-1">
                      {date.course_capacities.map((course) => (
                        <div key={course.course_id} className="text-xs text-gray-600">
                          <div className="font-medium">{course.course_name}</div>
                          <div className="text-gray-500">
                            {course.current_count}/{course.capacity}名
                            (残り{course.capacity - course.current_count})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-2">
                  <div className="text-xs text-gray-500 mb-1">確定率</div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        date.current_count >= date.capacity ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min((date.current_count / date.capacity) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 申込者一覧 */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">申込者一覧</h2>
            <button
              onClick={exportCSV}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition duration-200"
            >
              CSVエクスポート
            </button>
          </div>

          {filteredApplicants.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {selectedEvent ? `${selectedEvent.name}への申込者がいません` : '申込者がいません'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
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
                      LINE
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      申込日時
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredApplicants.map((applicant) => (
                    <tr key={applicant.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{applicant.name}</div>
                        <div className="text-sm text-gray-500">{applicant.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {applicant.school_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {applicant.grade}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getDateInfo(applicant.visit_date_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {applicant.line_user_id ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            登録済み
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                            未登録
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(applicant.created_at).toLocaleDateString('ja-JP')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
