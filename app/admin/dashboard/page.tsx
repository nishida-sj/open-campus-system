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
  is_active: boolean;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [dates, setDates] = useState<DateInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // 認証チェック
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('admin_authenticated');
    if (!isAuthenticated) {
      router.push('/admin/login');
    }
  }, [router]);

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [applicantsRes, datesRes] = await Promise.all([
          fetch('/api/admin/applicants'),
          fetch('/api/admin/dates'),
        ]);

        const applicantsData = await applicantsRes.json();
        const datesData = await datesRes.json();

        setApplicants(applicantsData);
        setDates(datesData);
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

    const rows = applicants.map((applicant) => {
      const dateInfo = dates.find((d) => d.id === applicant.visit_date_id);
      const visitDate = dateInfo
        ? new Date(dateInfo.date).toLocaleDateString('ja-JP')
        : '';
      const lineStatus = applicant.line_user_id ? '登録済み' : '未登録';
      const guardianAttendance = applicant.guardian_attendance ? 'あり' : 'なし';

      return [
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

    link.setAttribute('href', url);
    link.setAttribute('download', `applicants_${today}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ログアウト
  const handleLogout = () => {
    sessionStorage.removeItem('admin_authenticated');
    router.push('/admin/login');
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

  // 統計情報
  const totalApplicants = applicants.length;
  const completedApplicants = applicants.filter((a) => a.status === 'completed').length;
  const pendingApplicants = applicants.filter((a) => a.status === 'pending').length;
  const lineRegistered = applicants.filter((a) => a.line_user_id).length;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">管理ダッシュボード</h1>
            <button
              onClick={handleLogout}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition duration-200"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ナビゲーションメニュー */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin/events')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition duration-200"
          >
            イベント管理
          </button>
        </div>

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
            {dates.map((date) => (
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
                <div className="text-sm text-gray-600">
                  {date.current_count} / {date.capacity} 名
                </div>
                <div className="mt-2">
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

          {applicants.length === 0 ? (
            <div className="p-8 text-center text-gray-500">申込者がいません</div>
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
                  {applicants.map((applicant) => (
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
