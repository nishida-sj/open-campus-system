'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface TenantSettings {
  id: string;
  slug: string;
  name: string;
  display_name: string;
  line_channel_access_token: string;
  line_channel_secret: string;
  line_bot_basic_id: string;
  openai_api_key: string;
  has_line_config: boolean;
  has_openai_config: boolean;
}

export default function TenantSettingsPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 編集用フォーム値（機密フィールドは空で初期化、変更時のみ送信）
  const [form, setForm] = useState({
    name: '',
    display_name: '',
    line_channel_access_token: '',
    line_channel_secret: '',
    line_bot_basic_id: '',
    openai_api_key: '',
  });

  useEffect(() => {
    fetchSettings();
  }, [tenant]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`/api/${tenant}/admin/tenant-settings`);
      if (res.status === 403) {
        setMessage({ type: 'error', text: 'この機能にはスーパー管理者権限が必要です' });
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data && !data.error) {
        setSettings(data);
        setForm({
          name: data.name || '',
          display_name: data.display_name || '',
          line_channel_access_token: '',
          line_channel_secret: '',
          line_bot_basic_id: data.line_bot_basic_id || '',
          openai_api_key: '',
        });
      }
    } catch (error) {
      console.error('テナント設定取得エラー:', error);
      setMessage({ type: 'error', text: '設定の取得に失敗しました' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      // 空文字のフィールドは送信しない（既存値を維持）
      const payload: Record<string, string> = {};
      if (form.name !== settings?.name) payload.name = form.name;
      if (form.display_name !== settings?.display_name) payload.display_name = form.display_name;
      if (form.line_channel_access_token) payload.line_channel_access_token = form.line_channel_access_token;
      if (form.line_channel_secret) payload.line_channel_secret = form.line_channel_secret;
      if (form.line_bot_basic_id !== (settings?.line_bot_basic_id || '')) payload.line_bot_basic_id = form.line_bot_basic_id;
      if (form.openai_api_key) payload.openai_api_key = form.openai_api_key;

      if (Object.keys(payload).length === 0) {
        setMessage({ type: 'error', text: '変更する項目がありません' });
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/${tenant}/admin/tenant-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: `設定を保存しました（${data.updated_fields.join(', ')}）` });
        // 機密フィールドをクリア＆再取得
        setForm(prev => ({
          ...prev,
          line_channel_access_token: '',
          line_channel_secret: '',
          openai_api_key: '',
        }));
        fetchSettings();
      } else {
        setMessage({ type: 'error', text: data.error || '保存に失敗しました' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'サーバーエラーが発生しました' });
    } finally {
      setSaving(false);
    }
  };

  const handleClearField = async (field: string, label: string) => {
    if (!confirm(`${label}を削除してもよろしいですか？`)) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/${tenant}/admin/tenant-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: 'CLEAR' }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: `${label}を削除しました` });
        fetchSettings();
      }
    } catch {
      setMessage({ type: 'error', text: '削除に失敗しました' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8">
        {message && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
            {message.text}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">テナント設定</h1>
        <p className="text-gray-600 mt-1">
          LINE連携・OpenAI APIキーなどのテナント固有設定を管理します
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 基本情報セクション */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">基本情報</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                テナントスラッグ
              </label>
              <input
                type="text"
                value={settings.slug}
                disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">URLパスに使用される識別子（変更不可）</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                テナント名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                表示名
              </label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => setForm(prev => ({ ...prev, display_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* LINE連携セクション */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">LINE連携設定</h2>
            <span className={`px-2 py-1 text-xs rounded-full ${
              settings.has_line_config
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {settings.has_line_config ? '設定済み' : '未設定'}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Channel Access Token
              </label>
              {settings.line_channel_access_token && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
                    現在: {settings.line_channel_access_token}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleClearField('line_channel_access_token', 'Channel Access Token')}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    削除
                  </button>
                </div>
              )}
              <input
                type="password"
                value={form.line_channel_access_token}
                onChange={(e) => setForm(prev => ({ ...prev, line_channel_access_token: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={settings.has_line_config ? '変更する場合のみ入力' : 'LINE Developers Consoleから取得'}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Channel Secret
              </label>
              {settings.line_channel_secret && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
                    現在: {settings.line_channel_secret}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleClearField('line_channel_secret', 'Channel Secret')}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    削除
                  </button>
                </div>
              )}
              <input
                type="password"
                value={form.line_channel_secret}
                onChange={(e) => setForm(prev => ({ ...prev, line_channel_secret: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={settings.has_line_config ? '変更する場合のみ入力' : 'LINE Developers Consoleから取得'}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bot Basic ID
              </label>
              <input
                type="text"
                value={form.line_bot_basic_id}
                onChange={(e) => setForm(prev => ({ ...prev, line_bot_basic_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="例: @471ktpxz"
              />
              <p className="text-xs text-gray-500 mt-1">友だち追加用のBot Basic ID（@から始まる）</p>
            </div>
          </div>
        </div>

        {/* OpenAI設定セクション */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">OpenAI設定</h2>
            <span className={`px-2 py-1 text-xs rounded-full ${
              settings.has_openai_config
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {settings.has_openai_config ? '設定済み' : '未設定'}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OpenAI API Key
            </label>
            {settings.openai_api_key && (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
                  現在: {settings.openai_api_key}
                </span>
                <button
                  type="button"
                  onClick={() => handleClearField('openai_api_key', 'OpenAI API Key')}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  削除
                </button>
              </div>
            )}
            <input
              type="password"
              value={form.openai_api_key}
              onChange={(e) => setForm(prev => ({ ...prev, openai_api_key: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={settings.has_openai_config ? '変更する場合のみ入力' : 'sk-proj-... の形式'}
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1">
              AI自動応答に使用。未設定の場合はシステム共通のAPIキーが使用されます
            </p>
          </div>
        </div>

        {/* 保存ボタン */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '保存中...' : '設定を保存'}
          </button>
        </div>
      </form>

      {/* 注意事項 */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="font-semibold text-amber-800 mb-2">注意事項</h3>
        <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
          <li>APIキーなどの機密情報は保存後にマスク表示されます</li>
          <li>変更する場合のみ新しい値を入力してください（空欄は既存値を維持）</li>
          <li>LINE設定を変更した場合、Webhookの署名検証に影響します</li>
          <li>設定変更は即時反映されます</li>
        </ul>
      </div>
    </div>
  );
}
