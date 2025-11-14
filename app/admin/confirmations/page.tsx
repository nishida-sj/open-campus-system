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
  allow_multiple_candidates: boolean;
  max_date_selections: number;
}

interface DateInfo {
  id: string;
  date: string;
  capacity: number;
  current_count: number;
  event_id: string;
  course_capacities?: {
    course_id: string;
    course_name: string;
    capacity: number;
    current_count: number;
  }[];
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

  // チェックボックス選択状態（applicant_id + date_id をキーとする）
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<{ applicant: Applicant; dateId: string } | null>(null);

  // ソート状態
  const [pendingSortOrder, setPendingSortOrder] = useState<'asc' | 'desc'>('asc');
  const [confirmedSortOrder, setConfirmedSortOrder] = useState<'asc' | 'desc'>('asc');

  // CSV一括確定関連
  const [showCSVDialog, setShowCSVDialog] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvResults, setCsvResults] = useState<any>(null);
  const [isProcessingCSV, setIsProcessingCSV] = useState(false);
  const [showCSVGuideDialog, setShowCSVGuideDialog] = useState(false);

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

  // ソート適用
  const sortApplicants = (applicants: Applicant[], order: 'asc' | 'desc') => {
    return [...applicants].sort((a, b) => {
      const comparison = a.school_name.localeCompare(b.school_name, 'ja');
      return order === 'asc' ? comparison : -comparison;
    });
  };

  const pendingApplicants = sortApplicants(filterByDate(allPendingApplicants), pendingSortOrder);
  const confirmedApplicants = sortApplicants(filterByDate(allConfirmedApplicants), confirmedSortOrder);

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

  // チェックボックスのトグル
  const toggleCourseSelection = (applicantId: string, dateId: string) => {
    const key = `${applicantId}_${dateId}`;
    const newSelected = new Set(selectedCourses);

    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      // 複数候補入力モードの場合、同じ申込者の他の選択を解除
      if (selectedEvent?.allow_multiple_candidates) {
        // 同じ申込者IDを含むキーを削除
        Array.from(newSelected).forEach((k) => {
          if (k.startsWith(`${applicantId}_`)) {
            newSelected.delete(k);
          }
        });
      }
      newSelected.add(key);
    }

    setSelectedCourses(newSelected);
  };

  // 選択されたコースを確定
  const handleBulkConfirm = async () => {
    if (selectedCourses.size === 0) {
      alert('確定する日程を選択してください');
      return;
    }

    // 複数候補入力モードのバリデーション
    if (selectedEvent?.allow_multiple_candidates) {
      const applicantIds = new Set<string>();
      Array.from(selectedCourses).forEach((key) => {
        const [applicantId] = key.split('_');
        if (applicantIds.has(applicantId)) {
          alert('複数候補入力モードでは、1人につき1つの日程のみ確定できます');
          return;
        }
        applicantIds.add(applicantId);
      });
    }

    const confirmationMessage = `選択した${selectedCourses.size}件を確定しますか？`;
    if (!confirm(confirmationMessage)) return;

    try {
      for (const key of Array.from(selectedCourses)) {
        const [applicantId, dateId] = key.split('_');

        // 申込者とコース情報を取得
        const applicant = allPendingApplicants.find((a) => a.id === applicantId);
        if (!applicant) continue;

        const selectedDateInfo = applicant.selected_dates.find((d) => d.date_id === dateId);
        if (!selectedDateInfo) continue;

        const response = await fetch('/api/admin/confirmations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicant_id: applicantId,
            confirmed_date_id: dateId,
            confirmed_course_id: selectedDateInfo.course_id || null,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          alert(`確定に失敗しました: ${error.error || '不明なエラー'}`);
          break;
        }
      }

      // データ再取得
      await fetchData();
      setSelectedCourses(new Set());
    } catch (error) {
      console.error('一括確定エラー:', error);
      alert('エラーが発生しました');
    }
  };

  // 選択されたコースを解除
  const handleBulkUnconfirm = async () => {
    if (selectedCourses.size === 0) {
      alert('解除する日程を選択してください');
      return;
    }

    const confirmationMessage = `選択した${selectedCourses.size}件の確定を解除しますか？`;
    if (!confirm(confirmationMessage)) return;

    try {
      for (const key of Array.from(selectedCourses)) {
        const [applicantId, dateId] = key.split('_');

        const response = await fetch('/api/admin/confirmations', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicant_id: applicantId,
            confirmed_date_id: dateId,
          }),
        });

        if (!response.ok) {
          console.error('解除失敗');
        }
      }

      // データ再取得
      await fetchData();
      setSelectedCourses(new Set());
    } catch (error) {
      console.error('一括解除エラー:', error);
      alert('エラーが発生しました');
    }
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

  // CSVテンプレートダウンロード
  const handleDownloadCSVTemplate = () => {
    if (!selectedEventId) return;

    // BOM付きUTF-8
    const BOM = '\uFEFF';

    // ヘッダー行
    const headers = [
      '申込者ID',
      '氏名',
      'ふりがな',
      '学校名',
      '学年',
      'メールアドレス',
      '候補',
      '確定日程',
      '確定コース',
      '確定'
    ];

    // データ行を作成
    const rows = allPendingApplicants.map((applicant) => {
      // 第1希望の日程を取得
      const firstDate = applicant.selected_dates[0];
      const dateStr = firstDate
        ? new Date(firstDate.date).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })
        : '';

      // 候補順序を取得（第1候補、第2候補など）
      const priorityText = firstDate?.priority
        ? `第${firstDate.priority}候補`
        : '';

      return [
        applicant.id,
        applicant.name,
        applicant.kana_name || '',
        applicant.school_name || '',
        applicant.grade || '',
        applicant.email,
        priorityText,
        dateStr,
        firstDate?.course_name || '',
        '', // 確定列（空欄、ユーザーが○を入力）
      ];
    });

    // CSV文字列を作成
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    // ダウンロード
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);

    const eventName = events.find((e) => e.id === selectedEventId)?.name || 'イベント';
    const fileName = `確定用テンプレート_${eventName}_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '')}.csv`;
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSVファイル選択
  const handleCSVFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCsvFile(file);
      setCsvResults(null);
    }
  };

  // CSVアップロード処理
  const handleCSVUpload = async () => {
    if (!csvFile || !selectedEventId) return;

    setIsProcessingCSV(true);

    try {
      // CSVファイルを読み込み
      const text = await csvFile.text();

      // APIに送信
      const response = await fetch('/api/admin/confirmations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv_data: text,
          event_id: selectedEventId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`エラー: ${error.error || '不明なエラー'}`);
        setIsProcessingCSV(false);
        return;
      }

      const results = await response.json();
      setCsvResults(results);

      // データを再取得
      await fetchData();
    } catch (error) {
      console.error('CSVアップロードエラー:', error);
      alert('CSVアップロードに失敗しました');
    } finally {
      setIsProcessingCSV(false);
    }
  };

  // 申込者カードコンポーネント
  const ApplicantCard = ({ applicant, isPending }: { applicant: Applicant; isPending: boolean }) => {
    const allowMultiple = selectedEvent?.allow_multiple_dates || false;
    const allowCandidates = selectedEvent?.allow_multiple_candidates || false;
    const hasConfirmed = applicant.confirmed_dates && applicant.confirmed_dates.length > 0;

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
            {allowMultiple ? '選択日程（複数日参加可）:' : allowCandidates ? '希望日程（候補）:' : '希望日程:'}
          </p>
          {allowCandidates && (
            <p className="text-xs text-blue-600 mb-2">
              ※ 複数候補入力モード：1つの日程のみ確定できます
            </p>
          )}
          {applicant.selected_dates
            .sort((a, b) => (a.priority || 0) - (b.priority || 0))
            .map((sd, index) => {
            const isConfirmed = applicant.confirmed_dates?.some((cd) => cd.date_id === sd.date_id);
            const canConfirm = !allowCandidates || !hasConfirmed || isConfirmed;
            const checkKey = `${applicant.id}_${sd.date_id}`;
            const isChecked = selectedCourses.has(checkKey);

            return (
              <div
                key={sd.date_id}
                className={`p-3 rounded-lg ${
                  isConfirmed ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                } ${isChecked ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-2 flex-1">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCourseSelection(applicant.id, sd.date_id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900">
                          {allowMultiple ? `日程${index + 1}` : allowCandidates && sd.priority ? `第${sd.priority}候補` : `第${index + 1}希望`}:
                          {' '}
                          {new Date(sd.date).toLocaleDateString('ja-JP', {
                            month: 'long',
                            day: 'numeric',
                            weekday: 'short',
                          })}
                        </div>
                        {allowCandidates && sd.priority && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            優先{sd.priority}
                          </span>
                        )}
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

        {/* 操作説明 & CSV一括確定 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* 操作説明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>操作方法:</strong> 各申込者の日程ごとに「確定」ボタンをクリックして確定してください。
              {selectedEvent?.allow_multiple_dates
                ? ' 複数の日程を確定できます。'
                : ' 1つの日程のみ確定できます。'}
            </p>
          </div>

          {/* CSV一括確定 */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-sm font-semibold text-green-900 mb-1">
                    📊 CSV一括確定
                  </p>
                  <p className="text-xs text-green-700">
                    Excelで編集して複数名を一括確定
                  </p>
                </div>
                <button
                  onClick={() => setShowCSVGuideDialog(true)}
                  className="w-6 h-6 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-full text-xs font-bold transition duration-200"
                  title="使い方を見る"
                >
                  ?
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadCSVTemplate}
                  disabled={allPendingApplicants.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition duration-200"
                >
                  テンプレートDL
                </button>
                <button
                  onClick={() => setShowCSVDialog(true)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition duration-200"
                >
                  CSVアップロード
                </button>
              </div>
            </div>
          </div>
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
            <div className="bg-white rounded-lg shadow p-4 md:col-span-2">
              <p className="text-sm text-gray-600 mb-2">選択日程の定員</p>
              <div className="mb-2">
                <p className="text-2xl font-bold text-gray-900">
                  合計: {selectedDate.current_count}/{selectedDate.capacity}名
                </p>
                <p className="text-xs text-gray-500">
                  残り {selectedDate.capacity - selectedDate.current_count}名
                </p>
              </div>
              {selectedDate.course_capacities && selectedDate.course_capacities.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 mb-2">コース別定員:</p>
                  <div className="space-y-1">
                    {selectedDate.course_capacities.map((course) => (
                      <div key={course.course_id} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">{course.course_name}</span>
                        <span className="font-medium text-gray-900">
                          {course.current_count}/{course.capacity}名
                          <span className="text-xs text-gray-500 ml-1">
                            (残り{course.capacity - course.current_count})
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 一括操作ボタン - 画面下部に固定 */}
        {selectedCourses.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-lg p-4 z-40">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {selectedCourses.size}件選択中
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  チェックした日程を一括で確定または解除できます
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleBulkConfirm}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition duration-200"
                >
                  選択した日程を確定
                </button>
                <button
                  onClick={handleBulkUnconfirm}
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition duration-200"
                >
                  選択した日程を解除
                </button>
                <button
                  onClick={() => setSelectedCourses(new Set())}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition duration-200"
                >
                  選択解除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 申込者リスト */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 未確定リスト */}
          <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 min-h-[500px]">
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-orange-900">
                    未確定 ({pendingApplicants.length}件)
                  </h2>
                  <p className="text-sm text-orange-700 mt-1">
                    チェックして一括操作、または個別に確定できます
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPendingSortOrder(pendingSortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-1 bg-orange-200 hover:bg-orange-300 text-orange-900 rounded text-sm font-medium transition duration-200"
                  >
                    学校名 {pendingSortOrder === 'asc' ? '▲' : '▼'}
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-3">
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-green-900">
                    確定済み ({confirmedApplicants.length}件)
                  </h2>
                  <p className="text-sm text-green-700 mt-1">
                    チェックして一括操作、または個別に解除できます
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmedSortOrder(confirmedSortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-1 bg-green-200 hover:bg-green-300 text-green-900 rounded text-sm font-medium transition duration-200"
                  >
                    学校名 {confirmedSortOrder === 'asc' ? '▲' : '▼'}
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-3">
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

      {/* CSV使い方ガイドダイアログ */}
      {showCSVGuideDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">📚 CSV一括確定の使い方</h2>
              <button
                onClick={() => setShowCSVGuideDialog(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* 概要 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">💡 この機能について</h3>
              <p className="text-sm text-blue-800">
                CSVファイルを使って、複数の申込者を一括で確定できる機能です。
                100名規模の申込者でも、Excelの強力な検索・フィルター機能を活用して効率的に管理・確定できます。
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white rounded p-2">
                  <span className="font-semibold text-red-600">従来の方法:</span> 100名 → 約10〜15分
                </div>
                <div className="bg-white rounded p-2">
                  <span className="font-semibold text-green-600">CSV一括確定:</span> 100名 → 約2〜3分
                </div>
              </div>
            </div>

            {/* ステップバイステップガイド */}
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 flex items-center justify-center bg-blue-500 text-white rounded-full font-bold">1</span>
                  <h3 className="text-lg font-semibold text-gray-900">CSVテンプレートをダウンロード</h3>
                </div>
                <p className="text-sm text-gray-700 mb-2">
                  「テンプレートDL」ボタンをクリックして、未確定申込者のCSVファイルをダウンロードします。
                </p>
                <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                  <div className="font-semibold mb-1">ダウンロードされるCSV例:</div>
                  <div className="whitespace-nowrap">申込者ID,氏名,ふりがな,学校名,学年,メールアドレス,候補,確定日程,確定コース,確定</div>
                  <div className="text-gray-600 whitespace-nowrap">abc-123,田中太郎,たなかたろう,〇〇高等学校,3年,tanaka@example.com,第1候補,2025-12-15,工学部体験,</div>
                  <div className="text-gray-600 whitespace-nowrap">def-456,佐藤花子,さとうはなこ,△△高等学校,2年,sato@example.com,第2候補,2025-12-22,医学部体験,</div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="border-l-4 border-green-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 flex items-center justify-center bg-green-500 text-white rounded-full font-bold">2</span>
                  <h3 className="text-lg font-semibold text-gray-900">Excelで編集</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>①</strong> ダウンロードしたCSVファイルをExcelで開きます
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>②</strong> 「確定」列に <span className="bg-yellow-200 px-2 py-1 rounded font-bold">○</span> を入力（確定したい申込者のみ）
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs">
                      <strong>⚠️ 重要:</strong> 全角の「○」を入力してください。半角や他の文字は無効です。
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>③</strong> 必要に応じて「確定日程」「確定コース」を編集
                    </p>
                    <ul className="text-xs text-gray-600 list-disc list-inside ml-4 space-y-1">
                      <li>申込者が選択した日程のみ確定できます</li>
                      <li>日付形式: 2025-12-15、2025/12/15、2025年12月15日 など</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm text-gray-700">
                      <strong>④</strong> ファイルを保存（CSV形式のまま）
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="border-l-4 border-purple-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 flex items-center justify-center bg-purple-500 text-white rounded-full font-bold">3</span>
                  <h3 className="text-lg font-semibold text-gray-900">CSVアップロード</h3>
                </div>
                <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
                  <li>「CSVアップロード」ボタンをクリック</li>
                  <li>ダイアログで「CSVファイルを選択」から編集したファイルを選択</li>
                  <li>「アップロードして確定」ボタンをクリック</li>
                </ol>
              </div>

              {/* Step 4 */}
              <div className="border-l-4 border-orange-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 flex items-center justify-center bg-orange-500 text-white rounded-full font-bold">4</span>
                  <h3 className="text-lg font-semibold text-gray-900">処理結果を確認</h3>
                </div>
                <p className="text-sm text-gray-700 mb-2">
                  処理完了後、以下が表示されます:
                </p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="bg-green-50 border border-green-200 rounded p-2 text-center">
                    <div className="text-2xl font-bold text-green-600">✓</div>
                    <div className="text-xs text-gray-600">成功</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded p-2 text-center">
                    <div className="text-2xl font-bold text-red-600">✗</div>
                    <div className="text-xs text-gray-600">失敗</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded p-2 text-center">
                    <div className="text-2xl font-bold text-gray-600">⊘</div>
                    <div className="text-xs text-gray-600">スキップ</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Excelの便利な機能 */}
            <div className="mt-6 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">💡 Excelの便利な機能を活用</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="bg-white rounded p-3">
                  <div className="font-semibold text-blue-900 mb-1">🔍 フィルター機能</div>
                  <div className="text-xs text-gray-600">
                    学校名、学年、日程でフィルターして、該当行のみ「確定」列に○を入力
                  </div>
                </div>
                <div className="bg-white rounded p-3">
                  <div className="font-semibold text-blue-900 mb-1">🎨 条件付き書式</div>
                  <div className="text-xs text-gray-600">
                    ○がある行を色分けして、入力漏れを防止
                  </div>
                </div>
                <div className="bg-white rounded p-3">
                  <div className="font-semibold text-blue-900 mb-1">📝 複数回処理</div>
                  <div className="text-xs text-gray-600">
                    1回目: 第1希望で確定 → 2回目: 第2希望で確定
                  </div>
                </div>
                <div className="bg-white rounded p-3">
                  <div className="font-semibold text-blue-900 mb-1">💾 バックアップ</div>
                  <div className="text-xs text-gray-600">
                    編集前のCSVを別名保存して、万が一に備える
                  </div>
                </div>
              </div>
            </div>

            {/* 注意事項 */}
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">⚠️ 注意事項</h3>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>「申込者ID」「氏名」「ふりがな」「学校名」「学年」「メールアドレス」「候補」列は<strong>参照用</strong>のため編集しないでください</li>
                <li>「確定」列には全角の「○」のみ有効です（半角×、その他の文字は無効）</li>
                <li>申込者が選択していない日程は確定できません</li>
                <li>CSVのヘッダー行（1行目）は削除・変更しないでください</li>
              </ul>
            </div>

            {/* 閉じるボタン */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowCSVGuideDialog(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition duration-200"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSVアップロードダイアログ */}
      {showCSVDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">CSV一括確定</h2>

            {/* 使い方説明 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">📖 使い方</p>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>「テンプレートDL」ボタンでCSVをダウンロード</li>
                <li>Excelで開き、「確定」列に○を入力（確定したい申込者のみ）</li>
                <li>「確定日程」「確定コース」を必要に応じて編集</li>
                <li>ファイルを保存してアップロード</li>
              </ol>
            </div>

            {/* ファイル選択 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CSVファイルを選択
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVFileSelect}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {csvFile && (
                <p className="text-sm text-gray-600 mt-2">
                  選択ファイル: {csvFile.name}
                </p>
              )}
            </div>

            {/* 処理結果 */}
            {csvResults && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-semibold text-gray-900 mb-2">処理結果</p>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{csvResults.succeeded}</p>
                    <p className="text-xs text-gray-600">成功</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{csvResults.failed}</p>
                    <p className="text-xs text-gray-600">失敗</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-600">{csvResults.skipped}</p>
                    <p className="text-xs text-gray-600">スキップ</p>
                  </div>
                </div>

                {/* エラー詳細 */}
                {csvResults.results.error.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-red-900 mb-2">エラー詳細:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {csvResults.results.error.map((err: any, index: number) => (
                        <div key={index} className="text-xs text-red-700 bg-red-50 p-2 rounded">
                          行{err.row}: {err.message} ({err.data.name})
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 成功詳細 */}
                {csvResults.results.success.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-green-900 mb-2">成功:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {csvResults.results.success.slice(0, 10).map((success: any, index: number) => (
                        <div key={index} className="text-xs text-green-700 bg-green-50 p-2 rounded">
                          行{success.row}: {success.data.name} - {success.message}
                        </div>
                      ))}
                      {csvResults.results.success.length > 10 && (
                        <div className="text-xs text-gray-600 text-center">
                          他 {csvResults.results.success.length - 10}件
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ボタン */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCSVDialog(false);
                  setCsvFile(null);
                  setCsvResults(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200"
              >
                閉じる
              </button>
              {csvFile && !csvResults && (
                <button
                  onClick={handleCSVUpload}
                  disabled={isProcessingCSV}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition duration-200"
                >
                  {isProcessingCSV ? '処理中...' : 'アップロードして確定'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 確認ダイアログ */}
      {showConfirmDialog && targetApplicant && selectedDateForConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
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
