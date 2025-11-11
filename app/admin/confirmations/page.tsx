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
  status: string;
  created_at: string;
  selected_dates: {
    date_id: string;
    date: string;
    course_id: string | null;
    course_name: string | null;
    priority: number;
  }[];
  confirmed_date_id: string | null;
  confirmed_course_id: string | null;
  confirmed_at: string | null;
}

interface Event {
  id: string;
  name: string;
}

export default function ConfirmationsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [pendingApplicants, setPendingApplicants] = useState<Applicant[]>([]);
  const [confirmedApplicants, setConfirmedApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<'name' | 'school_name' | 'created_at'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmingDateId, setConfirmingDateId] = useState<string>('');
  const [confirmingCourseId, setConfirmingCourseId] = useState<string>('');

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

  // 申込者データ取得
  useEffect(() => {
    if (!selectedEventId) return;

    const fetchApplicants = async () => {
      try {
        const response = await fetch(`/api/admin/confirmations?event_id=${selectedEventId}`);
        if (response.ok) {
          const data = await response.json();
          setPendingApplicants(data.pending || []);
          setConfirmedApplicants(data.confirmed || []);
        }
      } catch (error) {
        console.error('申込者取得エラー:', error);
      }
    };

    fetchApplicants();
  }, [selectedEventId]);

  // 並び替え
  const sortApplicants = (applicants: Applicant[]) => {
    return [...applicants].sort((a, b) => {
      let compareValue = 0;

      switch (sortField) {
        case 'name':
          compareValue = a.name.localeCompare(b.name, 'ja');
          break;
        case 'school_name':
          compareValue = a.school_name.localeCompare(b.school_name, 'ja');
          break;
        case 'created_at':
          compareValue = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });
  };

  // 同じイベントでの重複申込を検出
  const findDuplicateApplications = (applicant: Applicant) => {
    const allApplicants = [...pendingApplicants, ...confirmedApplicants];
    return allApplicants.filter(
      (a) => a.email === applicant.email && a.id !== applicant.id
    );
  };

  // 確定モーダルを開く
  const openConfirmModal = (applicant: Applicant) => {
    setSelectedApplicant(applicant);
    // デフォルトで最初の選択日程を設定
    if (applicant.selected_dates.length > 0) {
      setConfirmingDateId(applicant.selected_dates[0].date_id);
      setConfirmingCourseId(applicant.selected_dates[0].course_id || '');
    }
    setShowConfirmModal(true);
  };

  // 確定処理
  const handleConfirm = async () => {
    if (!selectedApplicant || !confirmingDateId) {
      alert('日程を選択してください');
      return;
    }

    try {
      const response = await fetch('/api/admin/confirmations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicant_id: selectedApplicant.id,
          confirmed_date_id: confirmingDateId,
          confirmed_course_id: confirmingCourseId || null,
        }),
      });

      if (response.ok) {
        alert('申込を確定しました');
        setShowConfirmModal(false);
        setSelectedApplicant(null);
        // データを再取得
        if (selectedEventId) {
          const res = await fetch(`/api/admin/confirmations?event_id=${selectedEventId}`);
          if (res.ok) {
            const data = await res.json();
            setPendingApplicants(data.pending || []);
            setConfirmedApplicants(data.confirmed || []);
          }
        }
      } else {
        const error = await response.json();
        alert(`エラー: ${error.message || '確定に失敗しました'}`);
      }
    } catch (error) {
      console.error('確定エラー:', error);
      alert('エラーが発生しました');
    }
  };

  // 確定解除
  const handleUnconfirm = async (applicantId: string) => {
    if (!confirm('確定を解除しますか？')) return;

    try {
      const response = await fetch('/api/admin/confirmations', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicant_id: applicantId,
        }),
      });

      if (response.ok) {
        alert('確定を解除しました');
        // データを再取得
        if (selectedEventId) {
          const res = await fetch(`/api/admin/confirmations?event_id=${selectedEventId}`);
          if (res.ok) {
            const data = await res.json();
            setPendingApplicants(data.pending || []);
            setConfirmedApplicants(data.confirmed || []);
          }
        }
      } else {
        const error = await response.json();
        alert(`エラー: ${error.message || '解除に失敗しました'}`);
      }
    } catch (error) {
      console.error('解除エラー:', error);
      alert('エラーが発生しました');
    }
  };

  // 並び替えハンドラ
  const handleSort = (field: 'name' | 'school_name' | 'created_at') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // 申込者カードコンポーネント
  const ApplicantCard = ({ applicant, isPending }: { applicant: Applicant; isPending: boolean }) => {
    const duplicates = findDuplicateApplications(applicant);
    const hasDuplicates = duplicates.length > 0;

    return (
      <div
        className={`border-2 rounded-lg p-4 mb-3 transition-all ${
          hasDuplicates ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white'
        } hover:shadow-md`}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">
              {applicant.name}
              {applicant.kana_name && (
                <span className="text-sm text-gray-500 ml-2">({applicant.kana_name})</span>
              )}
            </h3>
            <p className="text-sm text-gray-600">{applicant.school_name}</p>
            <p className="text-xs text-gray-500">
              {applicant.school_type} | {applicant.grade}
            </p>
          </div>
          {hasDuplicates && (
            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-200 text-orange-800">
              重複あり
            </span>
          )}
        </div>

        <div className="text-xs text-gray-600 mb-2">
          <p>📧 {applicant.email}</p>
          <p>📞 {applicant.phone}</p>
        </div>

        {/* 選択日程 */}
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-700 mb-1">希望日程:</p>
          <div className="space-y-1">
            {applicant.selected_dates.map((sd, index) => (
              <div
                key={sd.date_id}
                className="text-xs bg-blue-50 rounded px-2 py-1 text-gray-700"
              >
                {index + 1}. {new Date(sd.date).toLocaleDateString('ja-JP', {
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                })}
                {sd.course_name && ` - ${sd.course_name}`}
              </div>
            ))}
          </div>
        </div>

        {/* 確定情報 */}
        {!isPending && applicant.confirmed_date_id && (
          <div className="mb-3 p-2 bg-green-50 rounded border border-green-200">
            <p className="text-xs font-medium text-green-800 mb-1">確定日程:</p>
            <p className="text-xs text-green-700">
              {applicant.selected_dates.find((d) => d.date_id === applicant.confirmed_date_id)
                ? new Date(
                    applicant.selected_dates.find(
                      (d) => d.date_id === applicant.confirmed_date_id
                    )!.date
                  ).toLocaleDateString('ja-JP', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })
                : '不明'}
            </p>
            {applicant.confirmed_at && (
              <p className="text-xs text-gray-500 mt-1">
                確定日時: {new Date(applicant.confirmed_at).toLocaleString('ja-JP')}
              </p>
            )}
          </div>
        )}

        {/* 重複情報 */}
        {hasDuplicates && (
          <div className="mb-3 p-2 bg-orange-100 rounded border border-orange-300">
            <p className="text-xs font-medium text-orange-800 mb-1">
              ⚠️ 同じイベントで{duplicates.length}件の申込があります
            </p>
            {duplicates.map((dup) => (
              <p key={dup.id} className="text-xs text-orange-700">
                • {dup.selected_dates.map((d) =>
                  new Date(d.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
                ).join(', ')}
                {dup.status === 'confirmed' && ' (確定済み)'}
              </p>
            ))}
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex gap-2">
          {isPending ? (
            <button
              onClick={() => openConfirmModal(applicant)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-3 rounded transition duration-200"
            >
              確定する
            </button>
          ) : (
            <button
              onClick={() => handleUnconfirm(applicant.id)}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-sm py-2 px-3 rounded transition duration-200"
            >
              確定解除
            </button>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-2">
          申込日時: {new Date(applicant.created_at).toLocaleString('ja-JP')}
        </p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  const sortedPending = sortApplicants(pendingApplicants);
  const sortedConfirmed = sortApplicants(confirmedApplicants);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">申込確定管理</h1>
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
        {/* イベント選択と並び替え */}
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
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 並び替え */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                並び替え
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSort('school_name')}
                  className={`px-3 py-2 text-sm rounded border ${
                    sortField === 'school_name'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  学校名 {sortField === 'school_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleSort('name')}
                  className={`px-3 py-2 text-sm rounded border ${
                    sortField === 'name'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  氏名 {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleSort('created_at')}
                  className={`px-3 py-2 text-sm rounded border ${
                    sortField === 'created_at'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  申込日時 {sortField === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 統計情報 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">未確定</p>
            <p className="text-3xl font-bold text-orange-600">{pendingApplicants.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">確定済み</p>
            <p className="text-3xl font-bold text-green-600">{confirmedApplicants.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">合計</p>
            <p className="text-3xl font-bold text-gray-900">
              {pendingApplicants.length + confirmedApplicants.length}
            </p>
          </div>
        </div>

        {/* 申込者リスト */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 未確定リスト */}
          <div>
            <div className="bg-orange-100 border-2 border-orange-300 rounded-lg p-4 mb-4">
              <h2 className="text-lg font-semibold text-orange-900">
                未確定 ({pendingApplicants.length}件)
              </h2>
              <p className="text-sm text-orange-700 mt-1">
                日程を確定させてください
              </p>
            </div>
            <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
              {sortedPending.length === 0 ? (
                <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                  未確定の申込はありません
                </div>
              ) : (
                sortedPending.map((applicant) => (
                  <ApplicantCard key={applicant.id} applicant={applicant} isPending={true} />
                ))
              )}
            </div>
          </div>

          {/* 確定済みリスト */}
          <div>
            <div className="bg-green-100 border-2 border-green-300 rounded-lg p-4 mb-4">
              <h2 className="text-lg font-semibold text-green-900">
                確定済み ({confirmedApplicants.length}件)
              </h2>
              <p className="text-sm text-green-700 mt-1">
                参加日程が確定しています
              </p>
            </div>
            <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
              {sortedConfirmed.length === 0 ? (
                <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                  確定済みの申込はありません
                </div>
              ) : (
                sortedConfirmed.map((applicant) => (
                  <ApplicantCard key={applicant.id} applicant={applicant} isPending={false} />
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 確定モーダル */}
      {showConfirmModal && selectedApplicant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">申込を確定</h2>

            <div className="mb-4">
              <p className="font-semibold text-gray-900">{selectedApplicant.name}</p>
              <p className="text-sm text-gray-600">{selectedApplicant.school_name}</p>
            </div>

            {/* 日程選択 */}
            <div className="mb-4">
              <label htmlFor="confirm-date" className="block text-sm font-medium text-gray-700 mb-2">
                確定する日程 *
              </label>
              <select
                id="confirm-date"
                value={confirmingDateId}
                onChange={(e) => {
                  setConfirmingDateId(e.target.value);
                  const selectedDate = selectedApplicant.selected_dates.find(
                    (d) => d.date_id === e.target.value
                  );
                  setConfirmingCourseId(selectedDate?.course_id || '');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {selectedApplicant.selected_dates.map((sd) => (
                  <option key={sd.date_id} value={sd.date_id}>
                    {new Date(sd.date).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'long',
                    })}
                    {sd.course_name && ` - ${sd.course_name}`}
                  </option>
                ))}
              </select>
            </div>

            {/* ボタン */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setSelectedApplicant(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition duration-200"
              >
                確定する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
