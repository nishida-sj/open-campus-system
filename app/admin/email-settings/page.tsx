'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface EmailSettings {
  id: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  from_email: string;
  from_name: string | null;
  use_tls: boolean;
  is_active: boolean;
}

export default function EmailSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [formData, setFormData] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    from_email: '',
    from_name: '',
    use_tls: true,
  });
  const [testEmail, setTestEmail] = useState('');

  // 認証チェック
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('admin_authenticated');
    if (!isAuthenticated) {
      router.push('/admin/login');
    }
  }, [router]);

  // 設定読み込み
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/admin/email-settings');
        if (response.ok) {
          const data = await response.json();
          if (data) {
            setSettings(data);
            setFormData({
              smtp_host: data.smtp_host,
              smtp_port: data.smtp_port,
              smtp_user: data.smtp_user,
              smtp_password: data.smtp_password,
              from_email: data.from_email,
              from_name: data.from_name || '',
              use_tls: data.use_tls,
            });
          }
        }
      } catch (error) {
        console.error('設定取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // 保存
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.smtp_host || !formData.smtp_user || !formData.smtp_password || !formData.from_email) {
      alert('必須項目を入力してください');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/admin/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert('設定を保存しました');
        const data = await response.json();
        setSettings(data);
      } else {
        const error = await response.json();
        alert(`エラー: ${error.error || '保存に失敗しました'}`);
      }
    } catch (error) {
      console.error('保存エラー:', error);
      alert('エラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  // テストメール送信
  const handleTestEmail = async () => {
    if (!testEmail) {
      alert('テスト送信先メールアドレスを入力してください');
      return;
    }

    if (!settings) {
      alert('先に設定を保存してください');
      return;
    }

    setTesting(true);

    try {
      const response = await fetch('/api/admin/email-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_email: testEmail }),
      });

      if (response.ok) {
        alert(`テストメールを ${testEmail} に送信しました`);
      } else {
        const error = await response.json();
        alert(`送信失敗: ${error.error}`);
      }
    } catch (error) {
      console.error('テスト送信エラー:', error);
      alert('エラーが発生しました');
    } finally {
      setTesting(false);
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
            <h1 className="text-2xl font-bold text-gray-900">メールサーバ設定</h1>
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition duration-200"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 説明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>メール通知機能を使用するには、SMTPサーバの情報を設定してください。</strong>
            <br />
            Gmailの場合: smtp.gmail.com、ポート587、アプリパスワードが必要です。
          </p>
        </div>

        {/* 設定フォーム */}
        <form onSubmit={handleSave} className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">SMTP設定</h2>

          <div className="space-y-4">
            {/* SMTPホスト */}
            <div>
              <label htmlFor="smtp_host" className="block text-sm font-medium text-gray-700 mb-1">
                SMTPホスト *
              </label>
              <input
                type="text"
                id="smtp_host"
                value={formData.smtp_host}
                onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                placeholder="smtp.gmail.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* SMTPポート */}
            <div>
              <label htmlFor="smtp_port" className="block text-sm font-medium text-gray-700 mb-1">
                SMTPポート *
              </label>
              <input
                type="number"
                id="smtp_port"
                value={formData.smtp_port}
                onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">一般的: 587 (TLS) または 465 (SSL)</p>
            </div>

            {/* SMTPユーザー */}
            <div>
              <label htmlFor="smtp_user" className="block text-sm font-medium text-gray-700 mb-1">
                SMTPユーザー名 *
              </label>
              <input
                type="text"
                id="smtp_user"
                value={formData.smtp_user}
                onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
                placeholder="your-email@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* SMTPパスワード */}
            <div>
              <label htmlFor="smtp_password" className="block text-sm font-medium text-gray-700 mb-1">
                SMTPパスワード *
              </label>
              <input
                type="password"
                id="smtp_password"
                value={formData.smtp_password}
                onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                placeholder="アプリパスワードまたはSMTPパスワード"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Gmailの場合はアプリパスワードを使用してください</p>
            </div>

            {/* 送信元メールアドレス */}
            <div>
              <label htmlFor="from_email" className="block text-sm font-medium text-gray-700 mb-1">
                送信元メールアドレス *
              </label>
              <input
                type="email"
                id="from_email"
                value={formData.from_email}
                onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                placeholder="noreply@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* 送信元名 */}
            <div>
              <label htmlFor="from_name" className="block text-sm font-medium text-gray-700 mb-1">
                送信元名（任意）
              </label>
              <input
                type="text"
                id="from_name"
                value={formData.from_name}
                onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                placeholder="オープンキャンパス事務局"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* TLS使用 */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="use_tls"
                checked={formData.use_tls}
                onChange={(e) => setFormData({ ...formData, use_tls: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="use_tls" className="ml-2 text-sm text-gray-700">
                TLS/STARTTLSを使用する（推奨）
              </label>
            </div>
          </div>

          {/* 保存ボタン */}
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-semibold transition duration-200"
            >
              {saving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </form>

        {/* テストメール送信 */}
        {settings && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">テストメール送信</h2>
            <p className="text-sm text-gray-600 mb-4">
              設定が正しいか確認するため、テストメールを送信できます。
            </p>

            <div className="flex gap-3">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleTestEmail}
                disabled={testing}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-semibold transition duration-200"
              >
                {testing ? '送信中...' : 'テスト送信'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
