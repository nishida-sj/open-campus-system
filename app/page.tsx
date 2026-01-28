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

interface SiteSettings {
  school_name: string;
  header_text: string;
  footer_text: string;
  primary_color: string;
}

const defaultSettings: SiteSettings = {
  school_name: 'オープンキャンパス',
  header_text: 'オープンキャンパス',
  footer_text: '',
  primary_color: '#1a365d',
};

export default function EventListPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // イベントとサイト設定を並列取得
        const [eventsRes, settingsRes] = await Promise.all([
          fetch('/api/events/public'),
          fetch('/api/site-settings'),
        ]);

        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          setEvents(eventsData);
        }

        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setSettings({ ...defaultSettings, ...settingsData });
        }
      } catch (error) {
        console.error('データ取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEventClick = (eventId: string) => {
    router.push(`/apply?event=${eventId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div
            className="inline-block w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mb-4"
            style={{ borderColor: `${settings.primary_color} transparent transparent transparent` }}
          ></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* ヘッダーバー */}
      <div className="text-white py-3" style={{ backgroundColor: settings.primary_color }}>
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-sm">{settings.header_text}</p>
        </div>
      </div>

      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* ヘッダー */}
          <div className="mb-8">
            <h1
              className="text-2xl sm:text-3xl font-bold border-b-2 pb-3"
              style={{ color: settings.primary_color, borderColor: settings.primary_color }}
            >
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
                  className="bg-white border border-gray-200 hover:border-current transition-colors duration-200 cursor-pointer"
                  style={{ ['--tw-border-opacity' as string]: 1 }}
                  onClick={() => handleEventClick(event.id)}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = settings.primary_color)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                >
                  {/* イベントカードヘッダー */}
                  <div className="text-white px-5 py-3" style={{ backgroundColor: settings.primary_color }}>
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
                      <div
                        className="bg-[#f8f9fa] border-l-2 p-3 mb-4"
                        style={{ borderColor: settings.primary_color }}
                      >
                        <p className="text-sm text-gray-700 line-clamp-3">
                          {event.overview}
                        </p>
                      </div>
                    )}

                    {/* イベント情報 */}
                    <div className="space-y-3 mb-5">
                      {/* 開催日程一覧 */}
                      <div>
                        <div
                          className="flex items-center text-sm font-bold mb-2"
                          style={{ color: settings.primary_color }}
                        >
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
                        <div
                          className="flex items-center text-sm px-3 py-2"
                          style={{ backgroundColor: `${settings.primary_color}10`, color: settings.primary_color }}
                        >
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
                    <button
                      className="w-full text-white font-bold py-3 px-6 transition duration-200 flex items-center justify-center"
                      style={{ backgroundColor: settings.primary_color }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    >
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
          {settings.footer_text && (
            <div className="mt-12 text-center text-xs text-gray-500">
              <p>{settings.footer_text}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
