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
  confirmed_dates: {
    date_id: string;
    course_id: string | null;
    confirmed_at: string;
  }[];
}

interface Event {
  id: string;
  name: string;
  allow_multiple_dates: boolean;
  max_date_selections: number;
}

interface DateInfo {
  id: string;
  date: string;
  capacity: number;
  current_count: number;
  event_id: string;
}

export default function ConfirmationsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [allPendingApplicants, setAllPendingApplicants] = useState<Applicant[]>([]);
  const [allConfirmedApplicants, setAllConfirmedApplicants] = useState<Applicant[]>([]);
  const [availableDates, setAvailableDates] = useState<DateInfo[]>([]);
  const [selectedDateId, setSelectedDateId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [selectedDateForConfirm, setSelectedDateForConfirm] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'confirm' | 'unconfirm' | null>(null);
  const [targetApplicant, setTargetApplicant] = useState<Applicant | null>(null);

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
  const fetchData = async () => {
    if (!selectedEventId) return;

    try {
      // 選択されたイベント情報を保存
      const event = events.find((e) => e.id === selectedEventId);
      setSelectedEvent(event || null);

      // 申込者データ取得
      const applicantsRes = await fetch(`/api/admin/confirmations?event_id=${selectedEventId}`);
      if (applicantsRes.ok) {
        const data = await applicantsRes.json();
        setAllPendingApplicants(data.pending || []);
        setAllConfirmedApplicants(data.confirmed || []);
      }

      // 日程一覧取得（定員情報を含む）
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

  useEffect(() => {
    fetchData();
  }, [selectedEventId, events]);

  // 日程フィルター適用
  const filterByDate = (applicants: Applicant[]) => {
    if (selectedDateId === 'all') return applicants;
    return applicants.filter((a) =>
      a.selected_dates.some((d) => d.date_id === selectedDateId)
    );
  };

  const pendingApplicants = filterByDate(allPendingApplicants);
  const confirmedApplicants = filterByDate(allConfirmedApplicants);

  // 選択された日程の情報を取得
  const selectedDate = availableDates.find((d) => d.id === selectedDateId);

  // 確定ボタンがクリックされた時
  const handleConfirmClick = (applicant: Applicant, dateId: string) => {
    setTargetApplicant(applicant);
    setSelectedApplicantId(applicant.id);
    setSelectedDateForConfirm(dateId);
    setConfirmAction('confirm');
    setShowConfirmDialog(true);
  };

  // 確定解除ボタンがクリックされた時
  const handleUnconfirmClick = (applicant: Applicant, dateId: string) => {
    setTargetApplicant(applicant);
    setSelectedApplicantId(applicant.id);
    setSelectedDateForConfirm(dateId);
    setConfirmAction('unconfirm');
    setShowConfirmDialog(true);
  };

  // 確定処理を実行
  const executeConfirm = async () => {
    if (!confirmAction || !targetApplicant || !selectedDateForConfirm) return;

    try {
      if (confirmAction === 'confirm') {
        // 確定処理
        const selectedDateInfo = targetApplicant.selected_dates.find(
          (d) => d.date_id === selectedDateForConfirm
        );

        const response = await fetch('/api/admin/confirmations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicant_id: targetApplicant.id,
            confirmed_date_id: selectedDateForConfirm,
            confirmed_course_id: selectedDateInfo?.course_id || null,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          alert(error.error || '確定に失敗しました');
          setShowConfirmDialog(false);
          return;
        }
      } else {
        // 確定解除処理
        const response = await fetch('/api/admin/confirmations', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicant_id: targetApplicant.id,
            confirmed_date_id: selectedDateForConfirm,
          }),
        });

        if (!response.ok) {
          console.error('解除失敗');
        }
      }

      // データを再取得（申込者データと日程データの両方）
      await fetchData();

      setShowConfirmDialog(false);
      setSelectedApplicantId(null);
      setSelectedDateForConfirm(null);
      setTargetApplicant(null);
      setConfirmAction(null);
    } catch (error) {
      console.error('処理エラー:', error);
      alert('エラーが発生しました');
    }
  };

  // 申込者カードコンポーネント
  const ApplicantCard = ({ applicant, isPending }: { applicant: Applicant; isPending: boolean }) => {
    const allowMultiple = selectedEvent?.allow_multiple_dates || false;

    return (
      <div className="border-2 border-gray-200 bg-white rounded-lg p-4 mb-3">
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900 text-base">
            {applicant.name}
            {applicant.kana_name && (
              <span className="text-sm text-gray-500 ml-2">（{applicant.kana_name}）</span>
            )}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{applicant.school_name}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            {allowMultiple ? '選択日程（複数日参加可）:' : '希望日程:'}
          </p>
          {applicant.selected_dates.map((sd, index) => {
            const isConfirmed = applicant.confirmed_dates?.some((cd) => cd.date_id === sd.date_id);

            return (
              <div
                key={sd.date_id}
                className={`p-3 rounded-lg ${
                  isConfirmed ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {allowMultiple ? `日程${index + 1}` : `第${index + 1}希望`}:
                      {' '}
                      {new Date(sd.date).toLocaleDateString('ja-JP', {
                        month: 'long',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                    </div>
                    {sd.course_name && (
                      <div className="text-sm text-gray-600 mt-1">
                        コース: {sd.course_name}
                      </div>
                    )}
                    {isConfirmed && (
                      <div className="text-xs text-green-700 font-semibold mt-1">
                        ✓ 確定済み
                      </div>
                    )}
                  </div>
                  <div>
                    {isConfirmed ? (
                      <button
                        onClick={() => handleUnconfirmClick(applicant, sd.date_id)}
                        className="px-3 py-1 text-sm bg-orange-600 hover:bg-orange-700 text-white rounded transition duration-200"
                      >
                        解除
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConfirmClick(applicant, sd.date_id)}
                        className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition duration-200"
                      >
                        確定
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                    {event.allow_multiple_dates ? '（複数日参加可）' : '（単一日のみ）'}
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
                    })} - 定員{date.capacity}名 (現在{date.current_count}名)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* イベント設定情報の表示 */}
          {selectedEvent && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>イベント設定:</strong>
                {selectedEvent.allow_multiple_dates
                  ? ` 複数日参加が許可されています。各日程ごとに確定できます。`
                  : ` 単一日のみ参加可能です。1つの日程のみ確定できます。`}
              </p>
            </div>
          )}
        </div>

        {/* 操作説明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>操作方法:</strong> 各申込者の日程ごとに「確定」ボタンをクリックして確定してください。
            {selectedEvent?.allow_multiple_dates
              ? ' 複数の日程を確定できます。'
              : ' 1つの日程のみ確定できます。'}
          </p>
        </div>

        {/* 統計情報 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">未確定（フィルター適用）</p>
            <p className="text-3xl font-bold text-orange-600">{pendingApplicants.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">確定済み（フィルター適用）</p>
            <p className="text-3xl font-bold text-green-600">{confirmedApplicants.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">全申込者数</p>
            <p className="text-3xl font-bold text-blue-600">
              {allPendingApplicants.length + allConfirmedApplicants.length}
            </p>
          </div>
          {selectedDate && (
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">選択日程の定員</p>
              <p className="text-3xl font-bold text-gray-900">
                {selectedDate.current_count}/{selectedDate.capacity}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                残り {selectedDate.capacity - selectedDate.current_count}名
              </p>
            </div>
          )}
        </div>

        {/* 申込者リスト */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 未確定リスト */}
          <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 min-h-[500px]">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-orange-900">
                未確定 ({pendingApplicants.length}件)
              </h2>
              <p className="text-sm text-orange-700 mt-1">
                確定ボタンで日程ごとに確定できます
              </p>
            </div>
            <div className="space-y-3 max-h-[calc(100vh-500px)] overflow-y-auto">
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
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 min-h-[500px]">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-green-900">
                確定済み ({confirmedApplicants.length}件)
              </h2>
              <p className="text-sm text-green-700 mt-1">
                解除ボタンで確定を取り消せます
              </p>
            </div>
            <div className="space-y-3 max-h-[calc(100vh-500px)] overflow-y-auto">
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
      {showConfirmDialog && targetApplicant && selectedDateForConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {confirmAction === 'confirm' ? '確定' : '確定解除'}の確認
            </h2>

            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-2">
                <strong>申込者:</strong> {targetApplicant.name}
              </p>
              <p className="text-sm text-gray-700 mb-2">
                <strong>学校名:</strong> {targetApplicant.school_name}
              </p>
              <p className="text-sm text-gray-700">
                <strong>日程:</strong>{' '}
                {(() => {
                  const selectedDateInfo = targetApplicant.selected_dates.find(
                    (d) => d.date_id === selectedDateForConfirm
                  );
                  return selectedDateInfo
                    ? new Date(selectedDateInfo.date).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'long',
                      })
                    : '不明';
                })()}
                {(() => {
                  const selectedDateInfo = targetApplicant.selected_dates.find(
                    (d) => d.date_id === selectedDateForConfirm
                  );
                  return selectedDateInfo?.course_name ? ` - ${selectedDateInfo.course_name}` : '';
                })()}
              </p>
            </div>

            <p className="text-sm text-gray-700 mb-4">
              この日程を
              <strong className={confirmAction === 'confirm' ? 'text-green-600' : 'text-orange-600'}>
                {confirmAction === 'confirm' ? '確定' : '確定解除'}
              </strong>
              してもよろしいですか？
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setSelectedApplicantId(null);
                  setSelectedDateForConfirm(null);
                  setTargetApplicant(null);
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
