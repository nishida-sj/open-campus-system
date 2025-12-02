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

interface AISettings {
  system_prompt: string;
  model: string;
  temperature: string;
  max_tokens: string;
  monthly_limit_jpy: string;
  enabled: string;
  usd_to_jpy_rate: string;
}

interface UsageStats {
  totalCostJPY: number;
  totalCostUSD: number;
  requestCount: number;
  limitJPY: number;
  remainingJPY: number;
  percentageUsed: number;
}

export default function AISettingsPage() {
  // 基本設定
  const [basicSettings, setBasicSettings] = useState<AISettings | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);

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

  // タブ管理
  const [activeTab, setActiveTab] = useState<'basic' | 'fixed' | 'custom' | 'preview'>('basic');

  // 状態管理
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchBasicSettings();
    fetchUsage();
    fetchPromptSettings();
    fetchPromptPreview();

    // 10秒ごとに使用量を更新
    const interval = setInterval(fetchUsage, 10000);
    return () => clearInterval(interval);
  }, []);

  // 基本設定を取得
  const fetchBasicSettings = async () => {
    try {
      const res = await fetch('/api/admin/ai-settings');
      const data = await res.json();

      if (data.success) {
        setBasicSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to fetch basic settings:', error);
    }
  };

  // 使用量を取得
  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/admin/ai-usage');
      const data = await res.json();

      if (data.success) {
        setUsage(data.usage);
      }
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    }
  };

  // プロンプト設定を取得
  const fetchPromptSettings = async () => {
    try {
      const res = await fetch('/api/admin/ai-prompt');
      const data = await res.json();

      if (data.success && data.parts) {
        setSchoolInfo(data.parts.school_info || '');
        setAccess(data.parts.access || '');
        setUnableResponse(data.parts.unable_response || '');
        setClosingMessage(data.parts.closing_message || '');
        setCustomItems(data.parts.custom_items || []);
      }
    } catch (error) {
      console.error('Failed to fetch prompt settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // プレビューを取得
  const fetchPromptPreview = async () => {
    try {
      const res = await fetch('/api/admin/ai-prompt');
      const data = await res.json();

      if (data.success) {
        setFinalPrompt(data.prompt || '');
        setPromptParts(data.parts || null);
      }
    } catch (error) {
      console.error('Failed to fetch prompt preview:', error);
    }
  };

  // 基本設定を保存
  const saveBasicSettings = async () => {
    if (!basicSettings) return;

    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/admin/ai-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: basicSettings }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage('基本設定を保存しました ✅');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('保存に失敗しました ❌');
      }
    } catch (error) {
      setMessage('エラーが発生しました ❌');
    } finally {
      setSaving(false);
    }
  };

  // 固定項目を保存
  const saveFixedItem = async (key: string, value: string) => {
    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/admin/ai-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting_key: key, setting_value: value }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage('保存しました ✅');
        setTimeout(() => setMessage(''), 3000);
        fetchPromptPreview();
      } else {
        setMessage('保存に失敗しました ❌');
      }
    } catch (error) {
      setMessage('エラーが発生しました ❌');
    } finally {
      setSaving(false);
    }
  };

  // カスタム項目を保存
  const saveCustomItems = async () => {
    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/admin/ai-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting_key: 'prompt_custom_items',
          setting_value: JSON.stringify(customItems),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage('カスタム項目を保存しました ✅');
        setTimeout(() => setMessage(''), 3000);
        fetchPromptPreview();
      } else {
        setMessage('保存に失敗しました ❌');
      }
    } catch (error) {
      setMessage('エラーが発生しました ❌');
    } finally {
      setSaving(false);
    }
  };

  // カスタム項目を追加
  const addCustomItem = () => {
    if (!newItemName.trim() || !newItemContent.trim()) {
      alert('項目名とコンテンツを入力してください');
      return;
    }

    const newItem: CustomItem = {
      id: `custom_${Date.now()}`,
      name: newItemName.trim(),
      content: newItemContent.trim(),
      order: customItems.length,
    };

    setCustomItems([...customItems, newItem]);
    setNewItemName('');
    setNewItemContent('');
    setShowAddForm(false);
  };

  // カスタム項目を編集
  const updateCustomItem = () => {
    if (!editingItem) return;

    setCustomItems(
      customItems.map((item) =>
        item.id === editingItem.id ? editingItem : item
      )
    );
    setEditingItem(null);
  };

  // カスタム項目を削除
  const deleteCustomItem = (id: string) => {
    if (!confirm('この項目を削除しますか？')) return;
    setCustomItems(customItems.filter((item) => item.id !== id));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">AI自動応答設定</h1>
          <p className="text-sm text-gray-600 mt-1">GPT-4o-mini を使用した自動応答システムの管理</p>
        </div>

        {/* メッセージ表示 */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message}
          </div>
        )}

        {/* 使用量ダッシュボード */}
        {usage && (
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 mb-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center">
                <span className="mr-2">💰</span>
                今月の使用状況
              </h2>
              <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                リアルタイム更新
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <p className="text-sm text-white/80 mb-1">使用額</p>
                <p className="text-2xl font-bold">¥{usage.totalCostJPY.toFixed(2)}</p>
                <p className="text-xs text-white/60 mt-1">${usage.totalCostUSD.toFixed(4)} USD</p>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <p className="text-sm text-white/80 mb-1">上限</p>
                <p className="text-2xl font-bold">¥{usage.limitJPY}</p>
                <p className="text-xs text-white/60 mt-1">月間上限額</p>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <p className="text-sm text-white/80 mb-1">残り</p>
                <p className="text-2xl font-bold text-green-300">
                  ¥{usage.remainingJPY.toFixed(2)}
                </p>
                <p className="text-xs text-white/60 mt-1">利用可能額</p>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <p className="text-sm text-white/80 mb-1">リクエスト数</p>
                <p className="text-2xl font-bold text-purple-300">{usage.requestCount}回</p>
                <p className="text-xs text-white/60 mt-1">今月の合計</p>
              </div>
            </div>

            {/* プログレスバー */}
            <div className="bg-white/20 rounded-full h-3 overflow-hidden mb-2">
              <div
                className={`h-full transition-all duration-500 ${
                  usage.percentageUsed >= 90
                    ? 'bg-red-400'
                    : usage.percentageUsed >= 75
                    ? 'bg-yellow-400'
                    : 'bg-green-400'
                }`}
                style={{ width: `${Math.min(usage.percentageUsed, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span>{usage.percentageUsed.toFixed(1)}% 使用中</span>
              <span>
                {usage.percentageUsed >= 90 && '⚠️ 上限間近！'}
                {usage.percentageUsed < 90 && usage.percentageUsed >= 75 && '⚡ 75%到達'}
              </span>
            </div>

            {usage.percentageUsed >= 90 && (
              <div className="mt-4 bg-red-500/20 border border-red-300 rounded-lg p-3 text-sm">
                <p className="font-bold">⚠️ 警告: 使用量が90%を超えています</p>
                <p className="mt-1">95%に達すると自動的に機能が無効化されます</p>
              </div>
            )}
          </div>
        )}

        {/* タブナビゲーション */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('basic')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'basic'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                ⚙️ 基本設定
              </button>
              <button
                onClick={() => setActiveTab('fixed')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'fixed'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                📝 固定項目
              </button>
              <button
                onClick={() => setActiveTab('custom')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'custom'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                ✨ カスタム項目
              </button>
              <button
                onClick={() => {
                  setActiveTab('preview');
                  fetchPromptPreview();
                }}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'preview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                👁️ プレビュー
              </button>
            </nav>
          </div>

          {/* 基本設定タブ */}
          {activeTab === 'basic' && basicSettings && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">基本設定</h2>

              {/* AI機能ON/OFF */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-medium text-gray-900">AI自動応答機能</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {basicSettings.enabled === 'true' ? '有効' : '無効'} - LINE連携ユーザーへの自動応答
                    </p>
                  </div>
                  <div className="relative inline-block w-16 h-8">
                    <input
                      type="checkbox"
                      checked={basicSettings.enabled === 'true'}
                      onChange={(e) =>
                        setBasicSettings({
                          ...basicSettings,
                          enabled: e.target.checked ? 'true' : 'false',
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-16 h-8 bg-gray-300 peer-checked:bg-blue-600 rounded-full transition-colors peer-focus:ring-2 peer-focus:ring-blue-300"></div>
                    <div className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform peer-checked:translate-x-8"></div>
                  </div>
                </label>
              </div>

              {/* Temperature設定 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temperature（創造性）
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={basicSettings.temperature}
                  onChange={(e) =>
                    setBasicSettings({ ...basicSettings, temperature: e.target.value })
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>正確（0.0）</span>
                  <span className="font-bold">現在: {basicSettings.temperature}</span>
                  <span>創造的（2.0）</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  推奨値: 0.7（バランス型）。学校情報は正確性を重視して0.3-0.7を推奨
                </p>
              </div>

              {/* Max Tokens設定 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Tokens（回答の最大長）
                </label>
                <input
                  type="number"
                  min="100"
                  max="4000"
                  step="50"
                  value={basicSettings.max_tokens}
                  onChange={(e) =>
                    setBasicSettings({ ...basicSettings, max_tokens: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  現在: {basicSettings.max_tokens} tokens（日本語で約{Math.floor(parseInt(basicSettings.max_tokens) / 2)}文字）
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  推奨値: 500-1000。短めの回答は費用削減に効果的
                </p>
              </div>

              {/* 月間利用制限 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  月間利用上限（円）
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={basicSettings.monthly_limit_jpy}
                  onChange={(e) =>
                    setBasicSettings({ ...basicSettings, monthly_limit_jpy: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  現在の上限: ¥{basicSettings.monthly_limit_jpy} / 月
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ⚠️ 95%に達すると自動的にAI機能が無効化されます
                </p>
              </div>

              {/* 為替レート */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  USD/JPY 為替レート
                </label>
                <input
                  type="number"
                  min="100"
                  max="200"
                  step="1"
                  value={basicSettings.usd_to_jpy_rate}
                  onChange={(e) =>
                    setBasicSettings({ ...basicSettings, usd_to_jpy_rate: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  現在: 1 USD = {basicSettings.usd_to_jpy_rate} 円（コスト計算に使用）
                </p>
              </div>

              {/* 保存ボタン */}
              <button
                onClick={saveBasicSettings}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? '保存中...' : '基本設定を保存'}
              </button>
            </div>
          )}

          {/* 固定項目タブ */}
          {activeTab === 'fixed' && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">固定項目の設定</h2>

              {/* 学校情報 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  学校情報
                </label>
                <textarea
                  value={schoolInfo}
                  onChange={(e) => setSchoolInfo(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="学校名、所在地、特徴、コース情報など"
                />
                <button
                  onClick={() => saveFixedItem('prompt_school_info', schoolInfo)}
                  disabled={saving}
                  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>

              {/* アクセス */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  アクセス
                </label>
                <textarea
                  value={access}
                  onChange={(e) => setAccess(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="最寄り駅、バス、駐車場情報など"
                />
                <button
                  onClick={() => saveFixedItem('prompt_access', access)}
                  disabled={saving}
                  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>

              {/* 回答できない場合 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  回答が出来なかった際に記述する内容
                </label>
                <textarea
                  value={unableResponse}
                  onChange={(e) => setUnableResponse(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="AIが回答できない質問への対応メッセージ"
                />
                <button
                  onClick={() => saveFixedItem('prompt_unable_response', unableResponse)}
                  disabled={saving}
                  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>

              {/* 締めメッセージ */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  必ず最後に記述する内容
                </label>
                <textarea
                  value={closingMessage}
                  onChange={(e) => setClosingMessage(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="すべての回答の最後に追加されるメッセージ"
                />
                <button
                  onClick={() => saveFixedItem('prompt_closing_message', closingMessage)}
                  disabled={saving}
                  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          )}

          {/* カスタム項目タブ */}
          {activeTab === 'custom' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">カスタム項目の管理</h2>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {showAddForm ? '✕ キャンセル' : '+ 新規追加'}
                </button>
              </div>

              {/* 新規追加フォーム */}
              {showAddForm && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="font-bold text-gray-900 mb-4">新しいカスタム項目を追加</h3>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      項目名
                    </label>
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="例: 入試情報"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      コンテンツ
                    </label>
                    <textarea
                      value={newItemContent}
                      onChange={(e) => setNewItemContent(e.target.value)}
                      rows={6}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="この項目の詳細な内容を記述してください"
                    />
                  </div>
                  <button
                    onClick={addCustomItem}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                  >
                    追加
                  </button>
                </div>
              )}

              {/* カスタム項目リスト */}
              {customItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg mb-2">カスタム項目がありません</p>
                  <p className="text-sm">「新規追加」ボタンから項目を追加してください</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {customItems
                    .sort((a, b) => a.order - b.order)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        {editingItem?.id === item.id ? (
                          // 編集モード
                          <div>
                            <input
                              type="text"
                              value={editingItem.name}
                              onChange={(e) =>
                                setEditingItem({ ...editingItem, name: e.target.value })
                              }
                              className="w-full mb-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <textarea
                              value={editingItem.content}
                              onChange={(e) =>
                                setEditingItem({ ...editingItem, content: e.target.value })
                              }
                              rows={6}
                              className="w-full mb-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={updateCustomItem}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                              >
                                更新
                              </button>
                              <button
                                onClick={() => setEditingItem(null)}
                                className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
                              >
                                キャンセル
                              </button>
                            </div>
                          </div>
                        ) : (
                          // 表示モード
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-bold text-gray-900">{item.name}</h3>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditingItem(item)}
                                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                >
                                  編集
                                </button>
                                <button
                                  onClick={() => deleteCustomItem(item.id)}
                                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                                >
                                  削除
                                </button>
                              </div>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap">{item.content}</p>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}

              {/* 保存ボタン */}
              {customItems.length > 0 && (
                <button
                  onClick={saveCustomItems}
                  disabled={saving}
                  className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {saving ? '保存中...' : 'カスタム項目を保存'}
                </button>
              )}
            </div>
          )}

          {/* プレビュータブ */}
          {activeTab === 'preview' && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">最終プロンプトのプレビュー</h2>

              {/* イベント情報 */}
              {promptParts && promptParts.events.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-bold text-gray-900 mb-3">
                    📅 開催予定のイベント（{promptParts.events.length}件）
                  </h3>
                  <div className="space-y-3">
                    {promptParts.events.map((event: any) => (
                      <div key={event.id} className="bg-white p-3 rounded-lg border border-blue-100">
                        <p className="font-bold text-gray-900">{event.name}</p>
                        {event.description && (
                          <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          日程: {event.dates?.length || 0}件 | コース: {event.courses?.length || 0}件
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 最終プロンプト */}
              <div className="mb-4">
                <h3 className="font-bold text-gray-900 mb-3">🤖 AIに送信される最終プロンプト</h3>
                <div className="bg-gray-900 text-gray-100 p-6 rounded-lg font-mono text-sm overflow-x-auto max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap">{finalPrompt}</pre>
                </div>
              </div>

              <button
                onClick={fetchPromptPreview}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
              >
                🔄 再読み込み
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
