'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function SuccessContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const [isMobile, setIsMobile] = useState(false);
  const lineBotId = process.env.NEXT_PUBLIC_LINE_BOT_BASIC_ID || '@471ktpxz';

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'mobile'];
      const isMobileDevice = mobileKeywords.some(keyword => userAgent.includes(keyword));
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isMobileDevice || isSmallScreen);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const botIdWithoutAt = lineBotId.replace('@', '');
  const lineAddFriendUrl = `https://line.me/R/ti/p/%40${botIdWithoutAt}`;
  const lineMessageUrl = `https://line.me/R/oaMessage/${lineBotId}/?${encodeURIComponent(token || '')}`;

  useEffect(() => {
    console.log('LINE Bot ID:', lineBotId);
    console.log('LINE Add Friend URL:', lineAddFriendUrl);
    console.log('LINE Message URL (URL Scheme):', lineMessageUrl);
    console.log('Is Mobile:', isMobile);
  }, [lineBotId, lineAddFriendUrl, lineMessageUrl, isMobile]);

  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      alert('申込番号をコピーしました！LINEのトーク画面で貼り付けてください。');
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center px-4">
        <div className="bg-white border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">エラー</h1>
          <p className="text-gray-600 mb-6">トークンが見つかりません</p>
          <a
            href="/apply"
            className="inline-block bg-[#1a365d] hover:bg-[#0f2442] text-white font-bold py-2 px-6 transition duration-200"
          >
            申込ページに戻る
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* ヘッダーバー */}
      <div className="bg-[#1a365d] text-white py-3">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-sm">伊勢学園高等学校 オープンキャンパス</p>
        </div>
      </div>

      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* 成功メッセージ */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1a365d] mb-2">申込を受け付けました</h1>
            <p className="text-gray-600">ご登録ありがとうございます</p>
          </div>

          {/* メインカード */}
          <div className="bg-white border border-gray-200 mb-6">
            <div className="p-6 space-y-6">
              {/* ステップ表示 */}
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-bold text-yellow-800">重要：申込完了まであと1ステップ！</h3>
                    <p className="text-yellow-700 mt-1">
                      LINE公式アカウントを友達追加して、申込を完了させてください
                    </p>
                  </div>
                </div>
              </div>

              {/* 残り時間 */}
              <div className="text-center py-4 bg-[#f8f9fa] border border-gray-200">
                <p className="text-sm text-gray-600 mb-2">友達追加の有効期限</p>
                <div className="text-4xl font-bold text-[#1a365d]">{formatTime(timeLeft)}</div>
                <p className="text-xs text-gray-500 mt-1">時間内に友達追加をお願いします</p>
              </div>

              {/* LINE連携ボタン */}
              <div className="text-center space-y-4">
                {!lineBotId || lineBotId === '' ? (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4">
                    <p className="text-red-800 font-bold">設定エラー</p>
                    <p className="text-red-600 text-sm mt-2">
                      LINE Bot IDが設定されていません。管理者にお問い合わせください。
                    </p>
                  </div>
                ) : (
                  <>
                    {isMobile && (
                      <div className="space-y-3">
                        <a
                          href={lineMessageUrl}
                          className="inline-block bg-[#06C755] hover:bg-[#05a849] text-white font-bold text-lg py-4 px-8 transition duration-200 w-full"
                        >
                          <span className="flex items-center justify-center">
                            <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                            </svg>
                            LINEで開く（自動送信）
                          </span>
                        </a>
                        <p className="text-sm text-gray-600">
                          ワンタップで申込番号が自動送信されます
                        </p>
                      </div>
                    )}

                    {!isMobile && (
                      <div className="space-y-3">
                        <a
                          href={lineAddFriendUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-[#06C755] hover:bg-[#05a849] text-white font-bold text-lg py-4 px-8 transition duration-200"
                        >
                          <span className="flex items-center">
                            <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                            </svg>
                            LINE公式アカウントを友達追加
                          </span>
                        </a>
                        <p className="text-sm text-gray-600">
                          友達追加後、下記の申込番号を送信してください
                        </p>
                      </div>
                    )}
                  </>
                )}

                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs text-gray-500 mt-2 space-y-1">
                    <p>Bot ID: {lineBotId || '未設定'}</p>
                    <p>Add Friend URL: {lineAddFriendUrl}</p>
                    <p>Message URL: {lineMessageUrl}</p>
                    <p>Device: {isMobile ? 'Mobile' : 'PC'}</p>
                  </div>
                )}
              </div>

              {/* 手順説明 */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="font-bold text-[#1a365d] mb-4 flex items-center">
                  <span className="w-1 h-5 bg-[#1a365d] mr-3"></span>
                  {isMobile ? '利用手順（簡単2ステップ）' : '友達追加の手順'}
                </h3>

                {isMobile ? (
                  <ol className="space-y-3 text-sm text-gray-700">
                    <li className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#1a365d] text-white flex items-center justify-center text-xs font-bold mr-3">
                        1
                      </span>
                      <span>上の「LINEで開く」ボタンをタップ</span>
                    </li>
                    <li className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#1a365d] text-white flex items-center justify-center text-xs font-bold mr-3">
                        2
                      </span>
                      <span>LINEアプリが開いたら「追加」→「送信」をタップ</span>
                    </li>
                    <li className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white flex items-center justify-center text-xs font-bold mr-3">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <span className="font-bold text-green-700">申込完了！通知が届きます</span>
                    </li>
                  </ol>
                ) : (
                  <ol className="space-y-3 text-sm text-gray-700">
                    <li className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#1a365d] text-white flex items-center justify-center text-xs font-bold mr-3">
                        1
                      </span>
                      <span>上のボタンをクリックして、LINEアプリを開きます</span>
                    </li>
                    <li className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#1a365d] text-white flex items-center justify-center text-xs font-bold mr-3">
                        2
                      </span>
                      <span>「追加」ボタンをタップして、友達追加します</span>
                    </li>
                    <li className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#1a365d] text-white flex items-center justify-center text-xs font-bold mr-3">
                        3
                      </span>
                      <span>トーク画面で下記の申込番号を送信します</span>
                    </li>
                    <li className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white flex items-center justify-center text-xs font-bold mr-3">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <span className="font-bold text-green-700">申込完了の通知が届きます</span>
                    </li>
                  </ol>
                )}
              </div>

              {/* 申込番号 */}
              <div className="bg-[#f8f9fa] border border-gray-200 p-4">
                {isMobile ? (
                  <details className="cursor-pointer">
                    <summary className="text-sm font-bold text-gray-700 mb-2">
                      手動で送信する場合（タップして表示）
                    </summary>
                    <div className="mt-3 space-y-3">
                      <p className="text-xs text-gray-600">
                        自動送信がうまくいかない場合は、この番号を手動でLINEに送信してください
                      </p>
                      <div className="bg-white border border-gray-300 px-4 py-2 font-mono text-sm break-all">
                        {token}
                      </div>
                      <button
                        onClick={copyToken}
                        className="w-full bg-[#1a365d] hover:bg-[#0f2442] text-white font-bold py-2 px-4 transition duration-200"
                      >
                        申込番号をコピー
                      </button>
                    </div>
                  </details>
                ) : (
                  <>
                    <p className="text-sm font-bold text-gray-700 mb-2">申込番号（LINE送信時に使用）</p>
                    <div className="bg-white border border-gray-300 px-4 py-2 font-mono text-sm break-all">
                      {token}
                    </div>
                    <button
                      onClick={copyToken}
                      className="mt-3 w-full bg-[#1a365d] hover:bg-[#0f2442] text-white font-bold py-2 px-4 transition duration-200"
                    >
                      申込番号をコピー
                    </button>
                    <p className="text-xs text-gray-500 mt-2">
                      ※この番号をLINEのトーク画面で送信してください
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 注意事項 */}
          <div className="bg-white border border-gray-200 p-6 text-sm text-gray-600">
            <h3 className="font-bold text-[#1a365d] mb-3 flex items-center">
              <span className="w-1 h-5 bg-[#1a365d] mr-3"></span>
              ご注意
            </h3>
            <ul className="space-y-2 list-disc list-inside ml-2">
              <li>有効期限内に友達追加を完了してください</li>
              <li>期限切れの場合は、再度お申し込みが必要です</li>
              <li>開催日程や詳細情報はLINEで配信いたします</li>
              <li>キャンセルの場合もLINEでご連絡ください</li>
            </ul>
          </div>

          {/* フッター */}
          <div className="mt-8 text-center text-xs text-gray-500">
            <p>© 伊勢学園高等学校</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-[#1a365d] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
