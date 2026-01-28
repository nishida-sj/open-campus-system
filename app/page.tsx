'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface EventDate {
  id: string;
  date: string;
}

interface Event {
  id: string;
  name: string;
  description: string | null;
  overview: string | null;
  is_active: boolean;
  allow_multiple_dates: boolean;
  max_date_selections: number;
  created_at: string;
  dates: EventDate[];
}

export default function EventListPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('/api/events/public');
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

  const handleEventClick = (eventId: string) => {
    router.push(`/apply?event=${eventId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-[#1a365d] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* ヘッダーバー */}
      <div className="bg-[#1a365d] text-white py-3">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-sm">伊勢学園高等学校 オープンキャンパス</p>
        </div>
      </div>

      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* ヘッダー */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1a365d] border-b-2 border-[#1a365d] pb-3">
              オープンキャンパス イベント一覧
            </h1>
            <p className="text-gray-600 mt-3">
              参加したいイベントを選択してお申し込みください
            </p>
          </div>

          {/* イベント一覧 */}
          {events.length === 0 ? (
            <div className="bg-white border border-gray-200 p-12 text-center">
              <div className="text-gray-400 text-5xl mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                現在募集中のイベントはありません
              </h2>
              <p className="text-gray-600">
                新しいイベントが公開されるまでお待ちください
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="bg-white border border-gray-200 hover:border-[#1a365d] transition-colors duration-200 cursor-pointer"
                  onClick={() => handleEventClick(event.id)}
                >
                  {/* イベントカードヘッダー */}
                  <div className="bg-[#1a365d] text-white px-5 py-3">
                    <h2 className="text-lg font-bold">
                      {event.name}
                    </h2>
                  </div>

                  {/* イベントカード本体 */}
                  <div className="p-5">
                    {/* 説明 */}
                    {event.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    {/* 概要 */}
                    {event.overview && (
                      <div className="bg-[#f8f9fa] border-l-2 border-[#1a365d] p-3 mb-4">
                        <p className="text-sm text-gray-700 line-clamp-3">
                          {event.overview}
                        </p>
                      </div>
                    )}

                    {/* イベント情報 */}
                    <div className="space-y-3 mb-5">
                      {/* 開催日程一覧 */}
                      <div>
                        <div className="flex items-center text-sm font-bold text-[#1a365d] mb-2">
                          <svg
                            className="w-4 h-4 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <span>開催日程</span>
                        </div>
                        <div className="ml-6 space-y-1">
                          {event.dates && event.dates.length > 0 ? (
                            event.dates.map((date) => (
                              <div key={date.id} className="text-sm text-gray-700">
                                {new Date(date.date).toLocaleDateString('ja-JP', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  weekday: 'short',
                                })}
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-gray-500">日程未設定</div>
                          )}
                        </div>
                      </div>

                      {event.allow_multiple_dates && (
                        <div className="flex items-center text-sm text-[#1a365d] bg-[#f0f4f8] px-3 py-2">
                          <svg
                            className="w-4 h-4 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="font-bold">複数日参加可能</span>
                        </div>
                      )}
                    </div>

                    {/* 申込ボタン */}
                    <button className="w-full bg-[#1a365d] hover:bg-[#0f2442] text-white font-bold py-3 px-6 transition duration-200 flex items-center justify-center">
                      <span>このイベントに申し込む</span>
                      <svg
                        className="w-5 h-5 ml-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* フッター */}
          <div className="mt-12 text-center text-xs text-gray-500">
            <p>© 伊勢学園高等学校</p>
          </div>
        </div>
      </div>
    </div>
  );
}
