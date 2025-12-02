'use client';

import { useState, useEffect } from 'react';

interface CustomItem {
  id: string;
  name: string;
  content: string;
  order: number;
}

interface PromptParts {
  school_info: string;
  access: string;
  unable_response: string;
  closing_message: string;
  custom_items: CustomItem[];
  events: any[];
  event_prompts: string;
}

export default function AISettingsPage() {
  // 固定項目
  const [schoolInfo, setSchoolInfo] = useState('');
  const [access, setAccess] = useState('');
  const [unableResponse, setUnableResponse] = useState('');
  const [closingMessage, setClosingMessage] = useState('');

  // カスタム項目
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [editingItem, setEditingItem] = useState<CustomItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemContent, setNewItemContent] = useState('');

  // プレビュー
  const [finalPrompt, setFinalPrompt] = useState('');
  const [promptParts, setPromptParts] = useState<PromptParts | null>(null);
  const [activeTab, setActiveTab] = useState<'fixed' | 'custom' | 'preview'>('fixed');

  // 状態管理
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchPromptPreview();
  }, []);

  // 設定を取得
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/ai-settings');
      const data = await res.json();

      if (data.success) {
        const settings = data.settings;
        setSchoolInfo(settings.prompt_school_info || '');
        setAccess(settings.prompt_access || '');
        setUnableResponse(settings.prompt_unable_response || '');
        setClosingMessage(settings.prompt_closing_message || '');

        // カスタム項目を取得
        const customItemsData = JSON.parse(settings.prompt_custom_items || '[]');
        setCustomItems(customItemsData);
      }
    } catch (error) {
      console.error('設定取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // プロンプトプレビューを取得
  const fetchPromptPreview = async () => {
    try {
      const res = await fetch('/api/admin/ai-prompt');
      const data = await res.json();

      if (data.success) {
        setFinalPrompt(data.prompt);
        setPromptParts(data.parts);
      }
    } catch (error) {
      console.error('プレビュー取得エラー:', error);
    }
  };

  // 固定項目を保存
  const saveFixedItem = async (key: string, value: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting_key: key,
          setting_value: value,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage('保存しました');
        setTimeout(() => setMessage(''), 3000);
        await fetchPromptPreview();
      }
    } catch (error) {
      console.error('保存エラー:', error);
      setMessage('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // カスタム項目を追加
  const addCustomItem = async () => {
    if (!newItemName.trim() || !newItemContent.trim()) {
      alert('項目名と内容を入力してください');
      return;
    }

    const newItem: CustomItem = {
      id: Date.now().toString(),
      name: newItemName,
      content: newItemContent,
      order: customItems.length + 1,
    };

    const updatedItems = [...customItems, newItem];
    await saveCustomItems(updatedItems);

    setNewItemName('');
    setNewItemContent('');
    setShowAddForm(false);
  };

  // カスタム項目を更新
  const updateCustomItem = async (item: CustomItem) => {
    const updatedItems = customItems.map((i) => (i.id === item.id ? item : i));
    await saveCustomItems(updatedItems);
    setEditingItem(null);
  };

  // カスタム項目を削除
  const deleteCustomItem = async (id: string) => {
    if (!confirm('この項目を削除しますか？')) return;

    const updatedItems = customItems.filter((i) => i.id !== id);
    await saveCustomItems(updatedItems);
  };

  // カスタム項目を保存
  const saveCustomItems = async (items: CustomItem[]) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting_key: 'prompt_custom_items',
          setting_value: JSON.stringify(items),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCustomItems(items);
        setMessage('保存しました');
        setTimeout(() => setMessage(''), 3000);
        await fetchPromptPreview();
      }
    } catch (error) {
      console.error('保存エラー:', error);
      setMessage('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-100">
      {/* ページヘッダー */}
      <div className="bg-white shadow">
        <div className="px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">AI設定</h1>
          <p className="text-sm text-gray-600 mt-1">
            LINEでのAI自動応答のプロンプトを設定します
          </p>
        </div>
      </div>

      <main className="p-8">
        {/* メッセージ */}
        {message && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            {message}
          </div>
        )}

        {/* タブ */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('fixed')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'fixed'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              固定項目
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'custom'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              カスタム項目
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'preview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              プレビュー
            </button>
          </nav>
        </div>

        {/* 固定項目タブ */}
        {activeTab === 'fixed' && (
          <div className="space-y-6">
            {/* 学校情報 */}
            <div className="bg-white rounded-lg shadow p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                学校情報
              </label>
              <textarea
                value={schoolInfo}
                onChange={(e) => setSchoolInfo(e.target.value)}
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="学校名、所在地、連絡先などの基本情報を入力..."
              />
              <button
                onClick={() => saveFixedItem('prompt_school_info', schoolInfo)}
                disabled={saving}
                className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                保存
              </button>
            </div>

            {/* アクセス */}
            <div className="bg-white rounded-lg shadow p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                アクセス
              </label>
              <textarea
                value={access}
                onChange={(e) => setAccess(e.target.value)}
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="最寄り駅、バス、駐車場などのアクセス情報を入力..."
              />
              <button
                onClick={() => saveFixedItem('prompt_access', access)}
                disabled={saving}
                className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                保存
              </button>
            </div>

            {/* 回答不可時の内容 */}
            <div className="bg-white rounded-lg shadow p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                回答できない場合の応答
              </label>
              <textarea
                value={unableResponse}
                onChange={(e) => setUnableResponse(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="AIが回答できない質問を受けた時の応答を入力..."
              />
              <button
                onClick={() => saveFixedItem('prompt_unable_response', unableResponse)}
                disabled={saving}
                className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                保存
              </button>
            </div>

            {/* 最後に必ず付ける内容 */}
            <div className="bg-white rounded-lg shadow p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                すべての回答の最後に必ず付ける内容
              </label>
              <textarea
                value={closingMessage}
                onChange={(e) => setClosingMessage(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="例: 「他にご質問がありましたらお気軽にお聞きください」"
              />
              <button
                onClick={() => saveFixedItem('prompt_closing_message', closingMessage)}
                disabled={saving}
                className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        )}

        {/* カスタム項目タブ */}
        {activeTab === 'custom' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">カスタム項目一覧</h2>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  ＋ 新規追加
                </button>
              </div>

              {/* 新規追加フォーム */}
              {showAddForm && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-3">新しい項目を追加</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        項目名
                      </label>
                      <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="例: 学費について"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        内容
                      </label>
                      <textarea
                        value={newItemContent}
                        onChange={(e) => setNewItemContent(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="この項目についての説明を入力..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={addCustomItem}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                      >
                        追加
                      </button>
                      <button
                        onClick={() => {
                          setShowAddForm(false);
                          setNewItemName('');
                          setNewItemContent('');
                        }}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 項目一覧 */}
              {customItems.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  カスタム項目がありません。「新規追加」ボタンから追加してください。
                </p>
              ) : (
                <div className="space-y-4">
                  {customItems.map((item) => (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                      {editingItem?.id === item.id ? (
                        // 編集モード
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              項目名
                            </label>
                            <input
                              type="text"
                              value={editingItem.name}
                              onChange={(e) =>
                                setEditingItem({ ...editingItem, name: e.target.value })
                              }
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              内容
                            </label>
                            <textarea
                              value={editingItem.content}
                              onChange={(e) =>
                                setEditingItem({ ...editingItem, content: e.target.value })
                              }
                              rows={4}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateCustomItem(editingItem)}
                              disabled={saving}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingItem(null)}
                              className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg"
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      ) : (
                        // 表示モード
                        <>
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold text-gray-900">{item.name}</h3>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingItem(item)}
                                className="text-blue-600 hover:text-blue-700 text-sm"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => deleteCustomItem(item.id)}
                                className="text-red-600 hover:text-red-700 text-sm"
                              >
                                削除
                              </button>
                            </div>
                          </div>
                          <p className="text-gray-600 whitespace-pre-wrap">{item.content}</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* プレビュータブ */}
        {activeTab === 'preview' && (
          <div className="space-y-6">
            {/* イベント情報 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                開催予定のイベント（自動生成）
              </h2>
              {promptParts?.events && promptParts.events.length > 0 ? (
                <div className="space-y-4">
                  {promptParts.events.map((event: any) => (
                    <div key={event.id} className="border-l-4 border-blue-500 pl-4">
                      <h3 className="font-semibold text-gray-900">{event.name}</h3>
                      {event.description && (
                        <p className="text-gray-600 text-sm mt-1">{event.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        表示終了日: {event.display_end_date}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">
                  表示終了日が有効なイベントがありません
                </p>
              )}
            </div>

            {/* 最終プロンプト */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  最終的なシステムプロンプト
                </h2>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(finalPrompt);
                    setMessage('クリップボードにコピーしました');
                    setTimeout(() => setMessage(''), 3000);
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm"
                >
                  コピー
                </button>
              </div>
              <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto max-h-96 whitespace-pre-wrap">
                {finalPrompt}
              </pre>
            </div>

            <div className="flex justify-center">
              <button
                onClick={fetchPromptPreview}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
              >
                プレビューを更新
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
