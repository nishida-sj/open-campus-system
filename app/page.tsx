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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            オープンキャンパス イベント一覧
          </h1>
          <p className="text-lg text-gray-600">
            参加したいイベントを選択してお申し込みください
          </p>
        </div>

        {/* イベント一覧 */}
        {events.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📅</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
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
                className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden cursor-pointer"
                onClick={() => handleEventClick(event.id)}
              >
                {/* イベントカード */}
                <div className="p-6">
                  {/* イベント名 */}
                  <h2 className="text-xl font-bold text-gray-900 mb-3">
                    {event.name}
                  </h2>

                  {/* 説明 */}
                  {event.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {event.description}
                    </p>
                  )}

                  {/* 概要 */}
                  {event.overview && (
                    <div className="bg-blue-50 rounded-lg p-3 mb-4">
                      <p className="text-sm text-gray-700 line-clamp-3">
                        {event.overview}
                      </p>
                    </div>
                  )}

                  {/* イベント情報 */}
                  <div className="space-y-2 mb-4">
                    {/* 開催日程一覧 */}
                    <div className="space-y-2">
                      <div className="flex items-center text-sm font-semibold text-gray-700">
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
                      <div className="flex items-center text-sm text-green-600 bg-green-50 px-3 py-2 rounded">
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
                        <span>複数日参加可能</span>
                      </div>
                    )}
                  </div>

                  {/* 申込ボタン */}
                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 flex items-center justify-center">
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
      </div>
    </div>
  );
}
