'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Applicant {
  id: string;
  name: string;
  email: string;
  line_user_id: string | null;
  school_name: string;
  grade: string;
  visit_date_id: string;
  selected_dates?: {
    date: string;
  }[];
}

interface Event {
  id: string;
  name: string;
  is_active: boolean;
}

type MessageType = 'email' | 'line';

export default function BroadcastPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [selectedApplicantIds, setSelectedApplicantIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageType, setMessageType] = useState<MessageType | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);

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
        }
      } catch (error) {
        console.error('イベント取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // 選択されたイベントの申込者を取得
  useEffect(() => {
    const fetchApplicants = async () => {
      if (selectedEventIds.length === 0) {
        setApplicants([]);
        return;
      }

      try {
        const response = await fetch('/api/admin/broadcast/applicants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_ids: selectedEventIds }),
        });

        if (response.ok) {
          const data = await response.json();
          setApplicants(data);
        }
      } catch (error) {
        console.error('申込者取得エラー:', error);
      }
    };

    fetchApplicants();
  }, [selectedEventIds]);

  // イベント選択トグル
  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId]
    );
    setSelectedApplicantIds([]); // イベント変更時に選択をリセット
  };

  // 申込者選択トグル
  const toggleApplicantSelection = (applicantId: string) => {
    setSelectedApplicantIds((prev) =>
      prev.includes(applicantId)
        ? prev.filter((id) => id !== applicantId)
        : [...prev, applicantId]
    );
  };

  // 全選択・全解除
  const toggleAllApplicants = () => {
    if (selectedApplicantIds.length === applicants.length) {
      setSelectedApplicantIds([]);
    } else {
      setSelectedApplicantIds(applicants.map((a) => a.id));
    }
  };

  // メッセージ作成ボタン
  const handleCreateMessage = (type: MessageType) => {
    if (selectedApplicantIds.length === 0) {
      alert('送信先の申込者を選択してください');
      return;
    }

    // バリデーション
    const selectedApplicants = applicants.filter((a) =>
      selectedApplicantIds.includes(a.id)
    );

    if (type === 'line') {
      const unlinkedUsers = selectedApplicants.filter((a) => !a.line_user_id);
      if (unlinkedUsers.length > 0) {
        alert(
          `LINE未連携のユーザーが${unlinkedUsers.length}名含まれています:\n${unlinkedUsers
            .map((u) => `- ${u.name}`)
            .join('\n')}`
        );
        return;
      }
    } else if (type === 'email') {
      const noEmailUsers = selectedApplicants.filter((a) => !a.email);
      if (noEmailUsers.length > 0) {
        alert(
          `メールアドレス未登録のユーザーが${noEmailUsers.length}名含まれています:\n${noEmailUsers
            .map((u) => `- ${u.name}`)
            .join('\n')}`
        );
        return;
      }
    }

    setMessageType(type);
    setShowMessageModal(true);
  };

  // メッセージ送信
  const handleSendMessage = async () => {
    if (!messageBody.trim()) {
      alert('メッセージ本文を入力してください');
      return;
    }

    if (messageType === 'email' && !emailSubject.trim()) {
      alert('件名を入力してください');
      return;
    }

    setSending(true);

    try {
      const response = await fetch('/api/admin/broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: messageType,
          applicant_ids: selectedApplicantIds,
          subject: messageType === 'email' ? emailSubject : undefined,
          message: messageBody,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(
          `${messageType === 'email' ? 'メール' : 'LINEメッセージ'}を${
            result.success_count
          }件送信しました`
        );
        setShowMessageModal(false);
        setEmailSubject('');
        setMessageBody('');
        setSelectedApplicantIds([]);
      } else {
        alert(`送信エラー: ${result.error}`);
      }
    } catch (error) {
      console.error('送信エラー:', error);
      alert('送信中にエラーが発生しました');
    } finally {
      setSending(false);
    }
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
            <h1 className="text-2xl font-bold text-gray-900">メッセージ配信</h1>
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
        {/* イベント選択 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            1. イベント選択（複数選択可）
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event) => (
              <div
                key={event.id}
                className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                  selectedEventIds.includes(event.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => toggleEventSelection(event.id)}
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedEventIds.includes(event.id)}
                    onChange={() => {}}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <div className="font-medium text-gray-900">{event.name}</div>
                    {!event.is_active && (
                      <span className="text-xs text-gray-500">（非公開）</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 申込者リスト */}
        {selectedEventIds.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                2. 送信先申込者選択（{applicants.length}名）
              </h2>
              <button
                onClick={toggleAllApplicants}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {selectedApplicantIds.length === applicants.length
                  ? '全解除'
                  : '全選択'}
              </button>
            </div>

            {applicants.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                選択されたイベントの申込者がいません
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        選択
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        氏名
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        学校名
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        学年
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        メール
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        LINE
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {applicants.map((applicant) => (
                      <tr
                        key={applicant.id}
                        className={`hover:bg-gray-50 cursor-pointer ${
                          selectedApplicantIds.includes(applicant.id)
                            ? 'bg-blue-50'
                            : ''
                        }`}
                        onClick={() => toggleApplicantSelection(applicant.id)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedApplicantIds.includes(applicant.id)}
                            onChange={() => {}}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {applicant.name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {applicant.school_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {applicant.grade}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {applicant.email ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-red-600">✗</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {applicant.line_user_id ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-red-600">✗</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* メッセージ作成ボタン */}
        {selectedApplicantIds.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              3. メッセージ作成（{selectedApplicantIds.length}名に送信）
            </h2>
            <div className="flex gap-4">
              <button
                onClick={() => handleCreateMessage('email')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg font-semibold text-lg transition duration-200"
              >
                メール作成
              </button>
              <button
                onClick={() => handleCreateMessage('line')}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-lg font-semibold text-lg transition duration-200"
              >
                LINE作成
              </button>
            </div>
          </div>
        )}
      </main>

      {/* メッセージ作成モーダル */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {messageType === 'email' ? 'メール作成' : 'LINEメッセージ作成'}
            </h2>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-900">
                送信先: {selectedApplicantIds.length}名
              </p>
            </div>

            {messageType === 'email' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  件名 *
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="件名を入力してください"
                />
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メッセージ本文 *
              </label>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={10}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="メッセージを入力してください"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowMessageModal(false);
                  setEmailSubject('');
                  setMessageBody('');
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200"
                disabled={sending}
              >
                キャンセル
              </button>
              <button
                onClick={handleSendMessage}
                disabled={sending}
                className={`px-6 py-2 rounded-lg font-semibold text-white transition duration-200 ${
                  messageType === 'email'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-green-600 hover:bg-green-700'
                } ${sending ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {sending ? '送信中...' : '送信する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
