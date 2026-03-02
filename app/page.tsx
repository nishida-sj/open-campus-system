'use client';

import { useRouter } from 'next/navigation';

const tenants = [
  {
    slug: 'ise-hoken',
    name: '伊勢保健衛生専門学校',
    description: '看護学科・歯科衛生学科',
    color: '#1a365d',
  },
  {
    slug: 'ise-gakuen',
    name: '伊勢学園高等学校',
    description: '高等学校',
    color: '#2d5016',
  },
];

export default function TenantSelectPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            オープンキャンパス申込管理システム
          </h1>
          <p className="text-gray-600">学校を選択してください</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tenants.map((tenant) => (
            <button
              key={tenant.slug}
              onClick={() => router.push(`/${tenant.slug}`)}
              className="bg-white border border-gray-200 hover:shadow-lg transition-shadow duration-200 text-left"
            >
              <div className="text-white px-5 py-4" style={{ backgroundColor: tenant.color }}>
                <h2 className="text-lg font-bold">{tenant.name}</h2>
              </div>
              <div className="p-5">
                <p className="text-gray-600 text-sm mb-4">{tenant.description}</p>
                <div className="flex items-center text-sm font-bold" style={{ color: tenant.color }}>
                  <span>イベント一覧を見る</span>
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
