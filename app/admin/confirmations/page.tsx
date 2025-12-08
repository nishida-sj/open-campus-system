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
  guardian_attendance: boolean;
  guardian_name: string | null;
  guardian_phone: string | null;
  status: string;
  created_at: string;
  is_modified: boolean;
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
  confirmed_count: number;
  applicant_count: number;
  event_id?: string;
  course_capacities?: {
    course_id: string;
    course_name: string;
    capacity: number;
    current_count: number;
    applicant_count: number;
    confirmed_count: number;
  }[];
}

// テーブル表示用のデータ型
interface TableRow {
  applicant_id: string;
  name: string;
  kana_name: string | null;
  school_name: string;
  grade: string;
  guardian_attendance: boolean;
  guardian_name: string | null;
  guardian_phone: string | null;
  date_id: string;
  date: string;
  course_name: string | null;
  course_id: string | null;
  priority: number;
  is_confirmed: boolean;
  is_modified: boolean;
  confirmed_at?: string;
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed'>('all');

  // 定員統計情報
  const [overallStats, setOverallStats] = useState<{
    total_capacity: number;
    total_applicants: number;
    total_confirmed: number;
  } | null>(null);

  // チェックボックス選択状態（applicant_id + date_id をキーとする）
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // ソート関連
  type SortField = 'name' | 'kana_name' | 'school_name' | 'grade' | 'date' | 'course_name' | 'status';
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // 検索
  const [searchQuery, setSearchQuery] = useState('');

  // 処理中状態
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  // CSV一括確定関連
  const [showCSVDialog, setShowCSVDialog] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvResults, setCsvResults] = useState<any>(null);
  const [isProcessingCSV, setIsProcessingCSV] = useState(false);

  // 編集ダイアログ関連
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingApplicant, setEditingApplicant] = useState<TableRow | null>(null);
  const [editDateId, setEditDateId] = useState<string>('');
  const [editCourseId, setEditCourseId] = useState<string>('');

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
      const event = events.find((e) => e.id === selectedEventId);
      setSelectedEvent(event || null);

      const applicantsRes = await fetch(`/api/admin/confirmations?event_id=${selectedEventId}`);
      if (applicantsRes.ok) {
        const data = await applicantsRes.json();
        setAllPendingApplicants(data.pending || []);
        setAllConfirmedApplicants(data.confirmed || []);

        // 定員統計情報を設定
        setAvailableDates(data.dates || []);
        setOverallStats(data.overall_stats || null);
      }
    } catch (error) {
      console.error('データ取得エラー:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedEventId, events]);

  // テーブル用データを生成
  const generateTableRows = (): TableRow[] => {
    const rows: TableRow[] = [];

    // 未確定申込者
    allPendingApplicants.forEach((applicant) => {
      applicant.selected_dates.forEach((selectedDate) => {
        const isConfirmed = applicant.confirmed_dates?.some((cd) => cd.date_id === selectedDate.date_id);
        const confirmedDate = applicant.confirmed_dates?.find((cd) => cd.date_id === selectedDate.date_id);

        rows.push({
          applicant_id: applicant.id,
          name: applicant.name,
          kana_name: applicant.kana_name,
          school_name: applicant.school_name,
          grade: applicant.grade,
          guardian_attendance: applicant.guardian_attendance,
          guardian_name: applicant.guardian_name,
          guardian_phone: applicant.guardian_phone,
          date_id: selectedDate.date_id,
          date: selectedDate.date,
          course_name: selectedDate.course_name,
          course_id: selectedDate.course_id,
          priority: selectedDate.priority,
          is_confirmed: isConfirmed,
          is_modified: applicant.is_modified || false,
          confirmed_at: confirmedDate?.confirmed_at,
        });
      });
    });

    // 確定済み申込者
    allConfirmedApplicants.forEach((applicant) => {
      applicant.selected_dates.forEach((selectedDate) => {
        const isConfirmed = applicant.confirmed_dates?.some((cd) => cd.date_id === selectedDate.date_id);
        const confirmedDate = applicant.confirmed_dates?.find((cd) => cd.date_id === selectedDate.date_id);

        rows.push({
          applicant_id: applicant.id,
          name: applicant.name,
          kana_name: applicant.kana_name,
          school_name: applicant.school_name,
          grade: applicant.grade,
          guardian_attendance: applicant.guardian_attendance,
          guardian_name: applicant.guardian_name,
          guardian_phone: applicant.guardian_phone,
          date_id: selectedDate.date_id,
          date: selectedDate.date,
          course_name: selectedDate.course_name,
          course_id: selectedDate.course_id,
          priority: selectedDate.priority,
          is_confirmed: isConfirmed,
          is_modified: applicant.is_modified || false,
          confirmed_at: confirmedDate?.confirmed_at,
        });
      });
    });

    return rows;
  };

  // フィルター適用
  const filterTableRows = (rows: TableRow[]): TableRow[] => {
    let filtered = rows;

    // 日程フィルター
    if (selectedDateId !== 'all') {
      filtered = filtered.filter((row) => row.date_id === selectedDateId);
    }

    // ステータスフィルター
    if (statusFilter === 'pending') {
      filtered = filtered.filter((row) => !row.is_confirmed);
    } else if (statusFilter === 'confirmed') {
      filtered = filtered.filter((row) => row.is_confirmed);
    }

    // 検索フィルター
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((row) => {
        return (
          row.name.toLowerCase().includes(query) ||
          (row.kana_name && row.kana_name.toLowerCase().includes(query)) ||
          row.school_name.toLowerCase().includes(query) ||
          row.grade.toLowerCase().includes(query) ||
          (row.course_name && row.course_name.toLowerCase().includes(query))
        );
      });
    }

    return filtered;
  };

  // ソート適用
  const sortTableRows = (rows: TableRow[]): TableRow[] => {
    return [...rows].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'kana_name':
          aValue = a.kana_name || '';
          bValue = b.kana_name || '';
          break;
        case 'school_name':
          aValue = a.school_name;
          bValue = b.school_name;
          break;
        case 'grade':
          aValue = a.grade;
          bValue = b.grade;
          break;
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'course_name':
          aValue = a.course_name || '';
          bValue = b.course_name || '';
          break;
        case 'status':
          aValue = a.is_confirmed ? 1 : 0;
          bValue = b.is_confirmed ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue, 'ja');
        return sortOrder === 'asc' ? comparison : -comparison;
      } else {
        const comparison = aValue - bValue;
        return sortOrder === 'asc' ? comparison : -comparison;
      }
    });
  };

  const tableRows = sortTableRows(filterTableRows(generateTableRows()));

  // ソート変更ハンドラー
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // 同じフィールドをクリックした場合は昇順/降順を切り替え
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // 別のフィールドをクリックした場合は昇順でソート
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // ソートアイコン表示
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-400 ml-1">⇅</span>;
    }
    return sortOrder === 'asc' ? (
      <span className="text-blue-600 ml-1">▲</span>
    ) : (
      <span className="text-blue-600 ml-1">▼</span>
    );
  };

  // 候補の優先度に応じた色を取得
  const getPriorityBadgeColor = (priority: number): string => {
    switch (priority) {
      case 1:
        return 'bg-yellow-100 text-yellow-800 border border-yellow-300'; // 第1候補 - 金色
      case 2:
        return 'bg-green-100 text-green-800 border border-green-300'; // 第2候補 - 緑色
      case 3:
        return 'bg-blue-100 text-blue-800 border border-blue-300'; // 第3候補 - 青色
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-300'; // それ以降 - グレー
    }
  };

  // チェックボックスのトグル
  const toggleRowSelection = (applicantId: string, dateId: string) => {
    const key = `${applicantId}_${dateId}`;
    const newSelected = new Set(selectedRows);

    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }

    setSelectedRows(newSelected);
  };

  // 全選択/全解除
  const toggleAllSelection = () => {
    if (selectedRows.size === tableRows.length) {
      setSelectedRows(new Set());
    } else {
      const allKeys = tableRows.map((row) => `${row.applicant_id}_${row.date_id}`);
      setSelectedRows(new Set(allKeys));
    }
  };

  // 選択された行を確定
  const handleBulkConfirm = async () => {
    if (selectedRows.size === 0) {
      alert('確定する申込を選択してください');
      return;
    }

    const confirmationMessage = `選択した${selectedRows.size}件を確定しますか？`;
    if (!confirm(confirmationMessage)) return;

    setIsProcessing(true);
    setProcessingMessage(`${selectedRows.size}件の申込を確定しています...`);

    try {
      let processed = 0;
      for (const key of Array.from(selectedRows)) {
        const [applicantId, dateId] = key.split('_');

        // 既に確定済みの場合はスキップ
        const row = tableRows.find((r) => r.applicant_id === applicantId && r.date_id === dateId);
        if (row?.is_confirmed) continue;

        const response = await fetch('/api/admin/confirmations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicant_id: applicantId,
            confirmed_date_id: dateId,
            confirmed_course_id: row?.course_id || null,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          setIsProcessing(false);
          alert(`確定に失敗しました: ${error.error || '不明なエラー'}`);
          break;
        }

        processed++;
        setProcessingMessage(`${processed}/${selectedRows.size}件を処理中...`);
      }

      setProcessingMessage('データを更新しています...');
      await fetchData();
      setSelectedRows(new Set());
    } catch (error) {
      console.error('一括確定エラー:', error);
      alert('エラーが発生しました');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // 選択された行を解除
  const handleBulkUnconfirm = async () => {
    if (selectedRows.size === 0) {
      alert('解除する申込を選択してください');
      return;
    }

    const confirmationMessage = `選択した${selectedRows.size}件の確定を解除しますか？`;
    if (!confirm(confirmationMessage)) return;

    setIsProcessing(true);
    setProcessingMessage(`${selectedRows.size}件の確定を解除しています...`);

    try {
      let processed = 0;
      for (const key of Array.from(selectedRows)) {
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

        processed++;
        setProcessingMessage(`${processed}/${selectedRows.size}件を処理中...`);
      }

      setProcessingMessage('データを更新しています...');
      await fetchData();
      setSelectedRows(new Set());
    } catch (error) {
      console.error('一括解除エラー:', error);
      alert('エラーが発生しました');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // 申込者の一括削除
  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) {
      alert('削除する申込を選択してください');
      return;
    }

    // 選択された申込者IDを取得（重複を除く）
    const selectedApplicantIds = Array.from(new Set(
      Array.from(selectedRows).map((key) => key.split('_')[0])
    ));

    const confirmationMessage = `選択した${selectedApplicantIds.length}名の申込者を完全に削除しますか？\n\n※この操作は取り消せません`;
    if (!confirm(confirmationMessage)) return;

    setIsProcessing(true);
    setProcessingMessage(`${selectedApplicantIds.length}名の申込者を削除しています...`);

    try {
      const response = await fetch('/api/admin/applicants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicant_ids: selectedApplicantIds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`削除に失敗しました: ${error.error || '不明なエラー'}`);
      } else {
        const result = await response.json();
        alert(`${result.deleted_count}名の申込者を削除しました`);
      }

      setProcessingMessage('データを更新しています...');
      await fetchData();
      setSelectedRows(new Set());
    } catch (error) {
      console.error('削除エラー:', error);
      alert('エラーが発生しました');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // 編集ダイアログを開く
  const handleOpenEditDialog = (row: TableRow) => {
    // 確定済みの申込者は編集できない
    if (row.is_confirmed) {
      alert('確定済みの申込者は編集できません。先に確定を解除してください。');
      return;
    }

    setEditingApplicant(row);
    setEditDateId(row.date_id);
    setEditCourseId(row.course_id || '');
    setShowEditDialog(true);
  };

  // 編集を保存
  const handleSaveEdit = async () => {
    if (!editingApplicant) return;

    setIsProcessing(true);
    setProcessingMessage('変更を保存しています...');

    try {
      const response = await fetch(`/api/admin/applicants/${editingApplicant.applicant_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visit_date_id: editDateId,
          selected_course_id: editCourseId || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`更新に失敗しました: ${error.error || '不明なエラー'}`);
      } else {
        alert('申込者情報を更新しました');
        setShowEditDialog(false);
        await fetchData();
      }
    } catch (error) {
      console.error('更新エラー:', error);
      alert('エラーが発生しました');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // CSVテンプレートダウンロード
  const handleDownloadCSVTemplate = () => {
    if (!selectedEventId) return;

    const BOM = '\uFEFF';
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

    const rows = allPendingApplicants.flatMap((applicant) => {
      return applicant.selected_dates.map((selectedDate) => {
        const dateStr = selectedDate
          ? new Date(selectedDate.date).toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            })
          : '';

        const priorityText = selectedDate?.priority
          ? `第${selectedDate.priority}候補`
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
          selectedDate?.course_name || '',
          '',
        ];
      });
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

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
      const text = await csvFile.text();

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

      await fetchData();
    } catch (error) {
      console.error('CSVアップロードエラー:', error);
      alert('CSVアップロードに失敗しました');
    } finally {
      setIsProcessingCSV(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  const pendingCount = tableRows.filter((r) => !r.is_confirmed).length;
  const confirmedCount = tableRows.filter((r) => r.is_confirmed).length;

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            {/* ステータスフィルター */}
            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">
                ステータスフィルター
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'confirmed')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">すべて</option>
                <option value="pending">未確定のみ</option>
                <option value="confirmed">確定済みのみ</option>
              </select>
            </div>
          </div>

          {/* イベント設定情報 */}
          {selectedEvent && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>イベント設定:</strong>
                {selectedEvent.allow_multiple_dates
                  ? ' 複数日参加が許可されています。'
                  : ' 単一日のみ参加可能です。'}
                {selectedEvent.allow_multiple_candidates
                  ? ' 複数候補入力モードです。1つの日程のみ確定できます。'
                  : ''}
              </p>
            </div>
          )}

          {/* 定員統計情報 */}
          {overallStats && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-sm font-semibold text-green-900 mb-2">定員情報</h3>

              {/* 全体統計（日程フィルター=allの場合のみ） */}
              {selectedDateId === 'all' && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-white p-2 rounded text-center">
                    <div className="text-xs text-gray-500">全体定員</div>
                    <div className="text-lg font-bold text-gray-900">{overallStats.total_capacity}</div>
                  </div>
                  <div className="bg-white p-2 rounded text-center">
                    <div className="text-xs text-gray-500">申込数</div>
                    <div className="text-lg font-bold text-blue-600">{overallStats.total_applicants}</div>
                  </div>
                  <div className="bg-white p-2 rounded text-center">
                    <div className="text-xs text-gray-500">確定数</div>
                    <div className="text-lg font-bold text-green-600">{overallStats.total_confirmed}</div>
                  </div>
                </div>
              )}

              {/* 日程別統計（フィルタリング対応） */}
              <div className="space-y-2">
                {availableDates
                  .filter((dateInfo) => selectedDateId === 'all' || dateInfo.id === selectedDateId)
                  .map((dateInfo) => (
                    <div key={dateInfo.id} className="bg-white p-2 rounded">
                      <div className="flex justify-between items-center">
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(dateInfo.date).toLocaleDateString('ja-JP', {
                            month: 'short',
                            day: 'numeric',
                            weekday: 'short',
                          })}
                        </div>
                        <div className="flex gap-3 text-xs">
                          <span className="text-gray-600">定員:{dateInfo.capacity}</span>
                          <span className="text-blue-600">申込:{dateInfo.applicant_count}</span>
                          <span className="text-green-600">確定:{dateInfo.confirmed_count}</span>
                          <span className="text-orange-600">残:{dateInfo.capacity - dateInfo.confirmed_count}</span>
                        </div>
                      </div>

                      {/* コース別統計（コンパクト表示） */}
                      {dateInfo.course_capacities && dateInfo.course_capacities.length > 0 && (
                        <div className="mt-1 pl-2 border-l-2 border-gray-200">
                          {dateInfo.course_capacities.map((course: any) => (
                            <div key={course.course_id} className="flex justify-between items-center py-1">
                              <div className="text-xs text-gray-700">{course.course_name}</div>
                              <div className="flex gap-2 text-xs">
                                <span className="text-gray-500">定員:{course.capacity}</span>
                                <span className="text-blue-500">申込:{course.applicant_count}</span>
                                <span className="text-green-500">確定:{course.confirmed_count}</span>
                                <span className="text-orange-500">残:{course.capacity - course.confirmed_count}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* 統計情報 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">未確定（フィルター適用）</p>
            <p className="text-3xl font-bold text-orange-600">{pendingCount}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">確定済み（フィルター適用）</p>
            <p className="text-3xl font-bold text-green-600">{confirmedCount}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">全申込者数</p>
            <p className="text-3xl font-bold text-blue-600">
              {allPendingApplicants.length + allConfirmedApplicants.length}
            </p>
          </div>
        </div>

        {/* 検索ボックス */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                検索
              </label>
              <input
                type="text"
                id="search"
                placeholder="氏名、ふりがな、学校名、学年、コースで検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-7 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm transition duration-200"
              >
                クリア
              </button>
            )}
          </div>
        </div>

        {/* CSV一括確定 */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-900 mb-1">📊 CSV一括確定</p>
              <p className="text-xs text-green-700">Excelで編集して複数名を一括確定</p>
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

        {/* 操作ボタン */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              {selectedRows.size > 0 ? (
                <span className="font-semibold text-blue-600">{selectedRows.size}件選択中</span>
              ) : (
                <span>チェックボックスで申込を選択してください</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleBulkConfirm}
                disabled={selectedRows.size === 0 || isProcessing}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition duration-200"
              >
                選択を確定
              </button>
              <button
                onClick={handleBulkUnconfirm}
                disabled={selectedRows.size === 0 || isProcessing}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition duration-200"
              >
                選択を解除
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedRows.size === 0 || isProcessing}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition duration-200"
              >
                選択を削除
              </button>
              <button
                onClick={() => setSelectedRows(new Set())}
                disabled={selectedRows.size === 0 || isProcessing}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-700 rounded-lg transition duration-200"
              >
                選択クリア
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
                  <th className="px-3 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === tableRows.length && tableRows.length > 0}
                      onChange={toggleAllSelection}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th
                    onClick={() => handleSort('name')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center">
                      氏名
                      <SortIcon field="name" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('kana_name')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center">
                      ふりがな
                      <SortIcon field="kana_name" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('school_name')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center">
                      学校名
                      <SortIcon field="school_name" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('grade')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center">
                      学年
                      <SortIcon field="grade" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    保護者同伴
                  </th>
                  <th
                    onClick={() => handleSort('date')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center">
                      希望日程
                      <SortIcon field="date" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('course_name')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center">
                      コース
                      <SortIcon field="course_name" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center">
                      ステータス
                      <SortIcon field="status" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                      該当する申込はありません
                    </td>
                  </tr>
                ) : (
                  tableRows.map((row) => {
                    const key = `${row.applicant_id}_${row.date_id}`;
                    const isSelected = selectedRows.has(key);
                    const rowBgColor = row.is_modified ? 'bg-yellow-50' : '';

                    return (
                      <tr
                        key={key}
                        className={`${isSelected ? 'bg-blue-50' : rowBgColor} hover:bg-gray-50 transition`}
                      >
                        <td className="px-3 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRowSelection(row.applicant_id, row.date_id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {row.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.kana_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.school_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.grade}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {row.guardian_attendance ? (
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                あり
                              </span>
                              {row.guardian_name && (
                                <div className="text-xs text-gray-600 mt-1">
                                  {row.guardian_name}
                                </div>
                              )}
                              {row.guardian_phone && (
                                <div className="text-xs text-gray-600">
                                  {row.guardian_phone}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              なし
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(row.date).toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'short',
                          })}
                          {row.priority && (
                            <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadgeColor(row.priority)}`}>
                              第{row.priority}候補
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.course_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {row.is_confirmed ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ 確定済み
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              未確定
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {row.is_confirmed ? (
                            <button
                              disabled
                              className="text-gray-400 cursor-not-allowed font-medium"
                              title="確定済みは編集不可"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenEditDialog(row)}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                              title="編集"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 編集ダイアログ */}
      {showEditDialog && editingApplicant && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">申込者情報の編集</h2>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">申込者情報</p>
              <p className="text-sm text-blue-800">
                氏名: {editingApplicant.name}
                {editingApplicant.kana_name && ` (${editingApplicant.kana_name})`}
              </p>
              <p className="text-sm text-blue-800">
                学校: {editingApplicant.school_name} / {editingApplicant.grade}
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  参加日程 <span className="text-red-500">*</span>
                </label>
                <select
                  value={editDateId}
                  onChange={(e) => setEditDateId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  コース
                </label>
                <select
                  value={editCourseId}
                  onChange={(e) => setEditCourseId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">コースを選択しない</option>
                  {availableDates
                    .find((d) => d.id === editDateId)
                    ?.course_capacities?.map((course) => (
                      <option key={course.course_id} value={course.course_id}>
                        {course.course_name}
                        {course.capacity && ` (定員: ${course.capacity}名)`}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowEditDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editDateId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition duration-200"
              >
                保存
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

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">📖 使い方</p>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>「テンプレートDL」ボタンでCSVをダウンロード</li>
                <li>Excelで開き、「確定」列に○を入力（確定したい申込者のみ）</li>
                <li>「確定日程」「確定コース」を必要に応じて編集</li>
                <li>ファイルを保存してアップロード</li>
              </ol>
            </div>

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

      {/* ローディングオーバーレイ */}
      {isProcessing && (
        <div className="fixed inset-0 bg-gray-200 bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl border-2 border-gray-300 p-8 max-w-md w-full mx-4">
            <div className="flex flex-col items-center">
              {/* スピナー */}
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>

              {/* メッセージ */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">処理中</h3>
              <p className="text-sm text-gray-600 text-center">{processingMessage}</p>

              {/* 注意書き */}
              <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800 text-center">
                  画面を閉じずにお待ちください
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
