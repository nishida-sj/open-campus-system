'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function SuccessContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30分 = 1800秒
  const lineBotId = process.env.NEXT_PUBLIC_LINE_BOT_BASIC_ID || '';

  // カウントダウンタイマー
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 時間を分:秒形式に変換
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // LINE友達追加URL（@を除いた状態で%40を追加）
  const botIdWithoutAt = lineBotId.replace('@', '');
  const lineAddFriendUrl = `https://line.me/R/ti/p/%40${botIdWithoutAt}`;

  // トークンをクリップボードにコピーする関数
  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      alert('申込番号をコピーしました！LINEのトーク画面で貼り付けてください。');
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">エラー</h1>
          <p className="text-gray-600 mb-6">トークンが見つかりません</p>
          <a
            href="/apply"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition duration-200"
          >
            申込ページに戻る
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* 成功メッセージ */}
        <div className="text-center mb-8">
          <div className="text-green-500 text-7xl mb-4">✓</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">申込を受け付けました</h1>
          <p className="text-gray-600">ご登録ありがとうございます</p>
        </div>

        {/* メインカード */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="space-y-6">
            {/* ステップ表示 */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-yellow-800">重要：申込完了まであと1ステップ！</h3>
                  <p className="text-yellow-700 mt-1">
                    LINE公式アカウントを友達追加して、申込を完了させてください
                  </p>
                </div>
              </div>
            </div>

            {/* 残り時間 */}
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">友達追加の有効期限</p>
              <div className="text-4xl font-bold text-blue-600">{formatTime(timeLeft)}</div>
              <p className="text-xs text-gray-500 mt-1">時間内に友達追加をお願いします</p>
            </div>

            {/* LINE友達追加ボタン */}
            <div className="text-center">
              <a
                href={lineAddFriendUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-green-500 hover:bg-green-600 text-white font-bold text-lg py-4 px-8 rounded-lg transition duration-200 shadow-lg hover:shadow-xl"
              >
                <span className="flex items-center">
                  <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                  </svg>
                  LINE公式アカウントを友達追加
                </span>
              </a>
            </div>

            {/* 手順説明 */}
            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-4">友達追加の手順</h3>
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">
                    1
                  </span>
                  <span>上のボタンをクリックして、LINEアプリを開きます</span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">
                    2
                  </span>
                  <span>「追加」ボタンをタップして、友達追加します</span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">
                    3
                  </span>
                  <span>トーク画面で申込番号を送信します</span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">
                    4
                  </span>
                  <span>申込完了の通知が届きます</span>
                </li>
              </ol>
            </div>

            {/* 申込番号 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">申込番号（LINE送信時に使用）</p>
              <div className="bg-white border-2 border-gray-300 rounded px-4 py-2 font-mono text-sm break-all">
                {token}
              </div>
              <button
                onClick={copyToken}
                className="mt-3 w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                📋 申込番号をコピー
              </button>
              <p className="text-xs text-gray-500 mt-2">
                ※この番号をLINEのトーク画面で送信してください
              </p>
            </div>
          </div>
        </div>

        {/* 注意事項 */}
        <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-600">
          <h3 className="font-semibold text-gray-900 mb-3">ご注意</h3>
          <ul className="space-y-2 list-disc list-inside">
            <li>有効期限内に友達追加を完了してください</li>
            <li>期限切れの場合は、再度お申し込みが必要です</li>
            <li>開催日程や詳細情報はLINEで配信いたします</li>
            <li>キャンセルの場合もLINEでご連絡ください</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
