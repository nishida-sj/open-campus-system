'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // 設定と使用量を取得
  useEffect(() => {
    fetchSettings();
    fetchUsage();

    // 10秒ごとに使用量を更新
    const interval = setInterval(fetchUsage, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/ai-settings');
      const data = await res.json();

      if (data.success) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/admin/ai-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage('保存しました ✅');
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
      <div className="max-w-5xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI自動応答設定</h1>
            <p className="text-sm text-gray-600 mt-1">GPT-4o-mini を使用した自動応答システムの管理</p>
          </div>
          <Link
            href="/admin/dashboard"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            ← ダッシュボードに戻る
          </Link>
        </div>

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

        {/* 機能ON/OFF */}
        {settings && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <h3 className="text-lg font-bold text-gray-900">AI自動応答機能</h3>
                <p className="text-sm text-gray-600 mt-1">
                  無効にすると、すべてのAI応答が停止します
                </p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.enabled === 'true'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      enabled: e.target.checked ? 'true' : 'false',
                    })
                  }
                />
                <div className="w-16 h-8 bg-gray-300 peer-checked:bg-blue-600 rounded-full peer transition-all"></div>
                <div className="absolute left-1 top-1 bg-white w-6 h-6 rounded-full peer-checked:translate-x-8 transition-all"></div>
              </div>
            </label>
          </div>
        )}

        {/* システムプロンプト */}
        {settings && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">システムプロンプト</h3>
            <p className="text-sm text-gray-600 mb-3">
              AIの振る舞いを定義するプロンプトです。学校情報や応答ルールを記述してください。
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-4 h-64 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={settings.system_prompt}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  system_prompt: e.target.value,
                })
              }
              placeholder="あなたは○○学校の公式LINEアカウントのAIアシスタントです..."
            />
            <p className="text-xs text-gray-500 mt-2">文字数: {settings.system_prompt.length}</p>
          </div>
        )}

        {/* 詳細設定 */}
        {settings && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">詳細設定</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Temperature */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temperature (0-2)
                  <span className="ml-2 text-gray-500 font-normal">
                    現在: {settings.temperature}
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  className="w-full"
                  value={settings.temperature}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      temperature: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  低い値: 一貫性のある応答 / 高い値: 創造的な応答
                </p>
              </div>

              {/* Max Tokens */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最大トークン数
                </label>
                <input
                  type="number"
                  step="50"
                  min="50"
                  max="1000"
                  className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={settings.max_tokens}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      max_tokens: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">応答の最大長（推奨: 300-500）</p>
              </div>

              {/* 月間上限 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  月間使用量上限（円）
                </label>
                <input
                  type="number"
                  step="100"
                  min="100"
                  className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={settings.monthly_limit_jpy}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      monthly_limit_jpy: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  この金額に達すると自動停止します
                </p>
              </div>

              {/* USD/JPY換算レート */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  USD/JPY 換算レート
                </label>
                <input
                  type="number"
                  step="1"
                  min="100"
                  max="200"
                  className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={settings.usd_to_jpy_rate}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      usd_to_jpy_rate: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  OpenAI APIはUSD請求のため、円換算に使用
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 保存ボタン */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-md p-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '保存中...' : '設定を保存'}
          </button>

          {message && (
            <p
              className={`font-bold ${
                message.includes('失敗') || message.includes('エラー')
                  ? 'text-red-600'
                  : 'text-green-600'
              }`}
            >
              {message}
            </p>
          )}
        </div>

        {/* 注意事項 */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h4 className="font-bold text-yellow-800 mb-2">⚠️ 注意事項</h4>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• システムプロンプトを変更すると、AI応答の質が変わります</li>
            <li>• 使用量が95%に達すると、自動的に機能が無効化されます</li>
            <li>• OpenAI APIのデータは学習に使用されません（デフォルト）</li>
            <li>• 現在のモデル: gpt-4o-mini（高性能・低コスト）</li>
            <li>
              • 料金: Input $0.150/1M tokens, Output $0.600/1M tokens
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
