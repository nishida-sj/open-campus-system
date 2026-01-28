'use client';

import { useState, useEffect } from 'react';

interface SiteSettings {
  id?: string;
  school_name: string;
  header_text: string;
  footer_text: string;
  primary_color: string;
}

export default function SiteSettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>({
    school_name: '',
    header_text: '',
    footer_text: '',
    primary_color: '#1a365d',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/site-settings');
      const data = await res.json();
      if (data && !data.error) {
        setSettings({
          id: data.id,
          school_name: data.school_name || '',
          header_text: data.header_text || '',
          footer_text: data.footer_text || '',
          primary_color: data.primary_color || '#1a365d',
        });
      }
    } catch (error) {
      console.error('設定取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: '設定を保存しました' });
        setSettings(prev => ({ ...prev, id: data.id }));
      } else {
        setMessage({ type: 'error', text: data.error || '保存に失敗しました' });
        if (data.hint) {
          setMessage({ type: 'error', text: `${data.error}\n${data.hint}` });
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'サーバーエラーが発生しました' });
    } finally {
      setSaving(false);
    }
  };

  const handleSchoolNameChange = (value: string) => {
    setSettings(prev => ({
      ...prev,
      school_name: value,
      // ヘッダーとフッターも自動更新（既存値が空または前回の自動生成値の場合）
      header_text: prev.header_text === '' || prev.header_text === prev.school_name + ' オープンキャンパス'
        ? value + ' オープンキャンパス'
        : prev.header_text,
      footer_text: prev.footer_text === '' || prev.footer_text === '© ' + prev.school_name
        ? '© ' + value
        : prev.footer_text,
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">サイト設定</h1>
        <p className="text-gray-600 mt-1">公開ページに表示される学校名やヘッダー・フッターのテキストを設定します</p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <pre className="whitespace-pre-wrap font-sans">{message.text}</pre>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
        {/* 学校名 */}
        <div>
          <label htmlFor="school_name" className="block text-sm font-medium text-gray-700 mb-1">
            学校名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="school_name"
            value={settings.school_name}
            onChange={(e) => handleSchoolNameChange(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="例: 伊勢学園高等学校"
          />
          <p className="text-xs text-gray-500 mt-1">コピーライトやタイトルに使用されます</p>
        </div>

        {/* ヘッダーテキスト */}
        <div>
          <label htmlFor="header_text" className="block text-sm font-medium text-gray-700 mb-1">
            ヘッダーテキスト
          </label>
          <input
            type="text"
            id="header_text"
            value={settings.header_text}
            onChange={(e) => setSettings(prev => ({ ...prev, header_text: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="例: 伊勢学園高等学校 オープンキャンパス"
          />
          <p className="text-xs text-gray-500 mt-1">ページ上部のヘッダーバーに表示されるテキスト</p>
        </div>

        {/* フッターテキスト（コピーライト） */}
        <div>
          <label htmlFor="footer_text" className="block text-sm font-medium text-gray-700 mb-1">
            フッターテキスト（コピーライト）
          </label>
          <input
            type="text"
            id="footer_text"
            value={settings.footer_text}
            onChange={(e) => setSettings(prev => ({ ...prev, footer_text: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="例: © 伊勢学園高等学校"
          />
          <p className="text-xs text-gray-500 mt-1">ページ下部に表示されるコピーライト表記</p>
        </div>

        {/* メインカラー */}
        <div>
          <label htmlFor="primary_color" className="block text-sm font-medium text-gray-700 mb-1">
            メインカラー
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              id="primary_color"
              value={settings.primary_color}
              onChange={(e) => setSettings(prev => ({ ...prev, primary_color: e.target.value }))}
              className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={settings.primary_color}
              onChange={(e) => setSettings(prev => ({ ...prev, primary_color: e.target.value }))}
              className="w-28 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="#1a365d"
              pattern="^#[0-9A-Fa-f]{6}$"
            />
            <div
              className="px-4 py-2 text-white text-sm rounded"
              style={{ backgroundColor: settings.primary_color }}
            >
              プレビュー
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">ヘッダーやボタンの色に使用されます</p>
        </div>

        {/* プレビュー */}
        <div className="border-t pt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">プレビュー</h3>
          <div className="border rounded-lg overflow-hidden">
            {/* ヘッダープレビュー */}
            <div
              className="text-white py-3 px-4 text-sm"
              style={{ backgroundColor: settings.primary_color }}
            >
              {settings.header_text || '（ヘッダーテキスト）'}
            </div>
            {/* コンテンツ */}
            <div className="bg-gray-50 py-8 px-4 text-center text-gray-400">
              （ページコンテンツ）
            </div>
            {/* フッタープレビュー */}
            <div className="bg-white py-4 px-4 text-center text-xs text-gray-500 border-t">
              {settings.footer_text || '（フッターテキスト）'}
            </div>
          </div>
        </div>

        {/* 保存ボタン */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '保存中...' : '設定を保存'}
          </button>
        </div>
      </form>

      {/* 使い方 */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">初回セットアップ</h3>
        <p className="text-sm text-blue-700">
          この設定を使用するには、Supabaseで以下のSQLを実行してテーブルを作成する必要があります：
        </p>
        <code className="block mt-2 text-xs bg-blue-100 p-2 rounded font-mono">
          docs/database_site_settings.sql
        </code>
      </div>
    </div>
  );
}
