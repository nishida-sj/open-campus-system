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

interface DateInfo {
  id: string;
  date: string;
}

export default function ConfirmationsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [allPendingApplicants, setAllPendingApplicants] = useState<Applicant[]>([]);
  const [allConfirmedApplicants, setAllConfirmedApplicants] = useState<Applicant[]>([]);
  const [availableDates, setAvailableDates] = useState<DateInfo[]>([]);
  const [selectedDateId, setSelectedDateId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [draggedApplicants, setDraggedApplicants] = useState<string[]>([]);
  const [selectedApplicants, setSelectedApplicants] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'confirm' | 'unconfirm' | null>(null);
  const [targetApplicants, setTargetApplicants] = useState<Applicant[]>([]);

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

  // 申込者データと日程一覧を取得
  useEffect(() => {
    if (!selectedEventId) return;

    const fetchData = async () => {
      try {
        // 申込者データ取得
        const applicantsRes = await fetch(`/api/admin/confirmations?event_id=${selectedEventId}`);
        if (applicantsRes.ok) {
          const data = await applicantsRes.json();
          setAllPendingApplicants(data.pending || []);
          setAllConfirmedApplicants(data.confirmed || []);
        }

        // 日程一覧取得
        const datesRes = await fetch('/api/admin/dates');
        if (datesRes.ok) {
          const allDates = await datesRes.json();
          const eventDates = allDates.filter((d: any) => d.event_id === selectedEventId);
          setAvailableDates(eventDates);
        }
      } catch (error) {
        console.error('データ取得エラー:', error);
      }
    };

    fetchData();
  }, [selectedEventId]);

  // 日程フィルター適用
  const filterByDate = (applicants: Applicant[]) => {
    if (selectedDateId === 'all') return applicants;
    return applicants.filter((a) =>
      a.selected_dates.some((d) => d.date_id === selectedDateId)
    );
  };

  const pendingApplicants = filterByDate(allPendingApplicants);
  const confirmedApplicants = filterByDate(allConfirmedApplicants);

  // チェックボックスのトグル
  const toggleSelection = (applicantId: string) => {
    setSelectedApplicants((prev) =>
      prev.includes(applicantId)
        ? prev.filter((id) => id !== applicantId)
        : [...prev, applicantId]
    );
  };

  // ドラッグ開始
  const handleDragStart = (e: React.DragEvent, applicantId: string) => {
    const selected = selectedApplicants.includes(applicantId)
      ? selectedApplicants
      : [applicantId];
    setDraggedApplicants(selected);
    e.dataTransfer.effectAllowed = 'move';
  };

  // ドロップ処理
  const handleDrop = (e: React.DragEvent, targetStatus: 'confirm' | 'unconfirm') => {
    e.preventDefault();

    if (draggedApplicants.length === 0) return;

    // ドロップされた申込者を取得
    const allApplicants = [...allPendingApplicants, ...allConfirmedApplicants];
    const targets = draggedApplicants
      .map((id) => allApplicants.find((a) => a.id === id))
      .filter((a): a is Applicant => a !== undefined);

    setTargetApplicants(targets);
    setConfirmAction(targetStatus);
    setShowConfirmDialog(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // 確定処理を実行
  const executeConfirm = async () => {
    if (!confirmAction || targetApplicants.length === 0) return;

    try {
      if (confirmAction === 'confirm') {
        // 確定処理
        for (const applicant of targetApplicants) {
          // 最初の選択日程を確定日程として使用
          const firstDate = applicant.selected_dates[0];
          if (!firstDate) continue;

          const response = await fetch('/api/admin/confirmations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              applicant_id: applicant.id,
              confirmed_date_id: firstDate.date_id,
              confirmed_course_id: firstDate.course_id || null,
            }),
          });

          if (!response.ok) {
            console.error(`確定失敗: ${applicant.name}`);
          }
        }
      } else {
        // 確定解除処理
        for (const applicant of targetApplicants) {
          const response = await fetch('/api/admin/confirmations', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicant_id: applicant.id }),
          });

          if (!response.ok) {
            console.error(`解除失敗: ${applicant.name}`);
          }
        }
      }

      // データを再取得
      if (selectedEventId) {
        const res = await fetch(`/api/admin/confirmations?event_id=${selectedEventId}`);
        if (res.ok) {
          const data = await res.json();
          setAllPendingApplicants(data.pending || []);
          setAllConfirmedApplicants(data.confirmed || []);
        }
      }

      setShowConfirmDialog(false);
      setDraggedApplicants([]);
      setSelectedApplicants([]);
      setTargetApplicants([]);
      setConfirmAction(null);
    } catch (error) {
      console.error('処理エラー:', error);
      alert('エラーが発生しました');
    }
  };

  // 申込者カードコンポーネント（簡素化版）
  const ApplicantCard = ({ applicant, isPending }: { applicant: Applicant; isPending: boolean }) => {
    const isSelected = selectedApplicants.includes(applicant.id);

    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, applicant.id)}
        className={`border-2 rounded-lg p-3 mb-2 cursor-move transition-all ${
          isSelected
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelection(applicant.id)}
            className="mt-1 w-4 h-4"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-sm">
              {applicant.name}
              {applicant.kana_name && (
                <span className="text-xs text-gray-500 ml-2">（{applicant.kana_name}）</span>
              )}
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">{applicant.school_name}</p>
            <div className="mt-2 space-y-0.5">
              <p className="text-xs font-medium text-gray-700">希望日程:</p>
              {applicant.selected_dates.map((sd, index) => (
                <div key={sd.date_id} className="text-xs text-gray-600 pl-2">
                  {index + 1}. {new Date(sd.date).toLocaleDateString('ja-JP', {
                    month: 'short',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                  {sd.course_name && ` - ${sd.course_name}`}
                </div>
              ))}
            </div>
            {!isPending && applicant.confirmed_date_id && (
              <div className="mt-2 text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                ✓ 確定日: {applicant.selected_dates.find((d) => d.date_id === applicant.confirmed_date_id)
                  ? new Date(
                      applicant.selected_dates.find((d) => d.date_id === applicant.confirmed_date_id)!.date
                    ).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
                  : '不明'}
              </div>
            )}
          </div>
        </div>
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
                  setSelectedDateId('all');
                  setSelectedApplicants([]);
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
                value={selectedDateId}
                onChange={(e) => setSelectedDateId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">すべての日程</option>
                {availableDates.map((date) => (
                  <option key={date.id} value={date.id}>
                    {new Date(date.date).toLocaleDateString('ja-JP', {
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

        {/* 操作説明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>操作方法:</strong> 申込者をチェックして選択し、反対側のエリアにドラッグ&ドロップしてください。
            複数選択も可能です。
          </p>
        </div>

        {/* 統計情報 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">未確定（フィルター適用）</p>
            <p className="text-3xl font-bold text-orange-600">{pendingApplicants.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">確定済み（フィルター適用）</p>
            <p className="text-3xl font-bold text-green-600">{confirmedApplicants.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">選択中</p>
            <p className="text-3xl font-bold text-blue-600">{selectedApplicants.length}</p>
          </div>
        </div>

        {/* 申込者リスト */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 未確定リスト */}
          <div
            onDrop={(e) => handleDrop(e, 'unconfirm')}
            onDragOver={handleDragOver}
            className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 min-h-[500px]"
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-orange-900">
                未確定 ({pendingApplicants.length}件)
              </h2>
              <p className="text-sm text-orange-700 mt-1">
                右側にドロップして確定
              </p>
            </div>
            <div className="space-y-2 max-h-[calc(100vh-500px)] overflow-y-auto">
              {pendingApplicants.length === 0 ? (
                <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                  該当する未確定の申込はありません
                </div>
              ) : (
                pendingApplicants.map((applicant) => (
                  <ApplicantCard key={applicant.id} applicant={applicant} isPending={true} />
                ))
              )}
            </div>
          </div>

          {/* 確定済みリスト */}
          <div
            onDrop={(e) => handleDrop(e, 'confirm')}
            onDragOver={handleDragOver}
            className="bg-green-50 border-2 border-green-300 rounded-lg p-4 min-h-[500px]"
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-green-900">
                確定済み ({confirmedApplicants.length}件)
              </h2>
              <p className="text-sm text-green-700 mt-1">
                左側にドロップして確定解除
              </p>
            </div>
            <div className="space-y-2 max-h-[calc(100vh-500px)] overflow-y-auto">
              {confirmedApplicants.length === 0 ? (
                <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                  該当する確定済みの申込はありません
                </div>
              ) : (
                confirmedApplicants.map((applicant) => (
                  <ApplicantCard key={applicant.id} applicant={applicant} isPending={false} />
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 確認ダイアログ */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {confirmAction === 'confirm' ? '確定' : '確定解除'}の確認
            </h2>

            <p className="text-sm text-gray-700 mb-3">
              以下の{targetApplicants.length}名を
              <strong className={confirmAction === 'confirm' ? 'text-green-600' : 'text-orange-600'}>
                {confirmAction === 'confirm' ? '確定' : '未確定に戻す'}
              </strong>
              してもよろしいですか？
            </p>

            <div className="max-h-60 overflow-y-auto mb-4 border border-gray-200 rounded p-3 bg-gray-50">
              {targetApplicants.map((applicant, index) => (
                <div key={applicant.id} className="text-sm py-1">
                  {index + 1}. {applicant.name} ({applicant.school_name})
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setDraggedApplicants([]);
                  setTargetApplicants([]);
                  setConfirmAction(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200"
              >
                キャンセル
              </button>
              <button
                onClick={executeConfirm}
                className={`px-4 py-2 rounded-lg font-semibold text-white transition duration-200 ${
                  confirmAction === 'confirm'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {confirmAction === 'confirm' ? '確定する' : '確定解除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
