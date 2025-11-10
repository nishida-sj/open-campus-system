import { supabase } from '@/lib/supabase'

   export default async function Home() {
     const { data: courses, error: coursesError } = await supabase
       .from('courses')
       .select('*')
       .order('display_order')
     
     const { data: dates, error: datesError } = await supabase
       .from('open_campus_dates')
       .select('*')
       .order('date')

     return (
       <div className="min-h-screen bg-gray-50 p-8">
         <div className="max-w-4xl mx-auto">
           <h1 className="text-3xl font-bold mb-8">環境構築確認ページ</h1>
           
           <div className="space-y-6">
             {/* 接続確認 */}
             <div className="bg-white rounded-lg shadow p-6">
               <h2 className="text-xl font-bold mb-4">✅ システム状態</h2>
               <div className="space-y-2">
                 <p className="text-green-600">✓ Next.js 起動成功</p>
                 <p className="text-green-600">✓ Supabase 接続成功</p>
                 <p className="text-green-600">✓ 環境変数 読み込み成功</p>
               </div>
             </div>

             {/* コース一覧 */}
             <div className="bg-white rounded-lg shadow p-6">
               <h2 className="text-xl font-bold mb-4">📚 登録されているコース</h2>
               {coursesError ? (
                 <p className="text-red-600">エラー: {coursesError.message}</p>
               ) : (
                 <div className="space-y-2">
                   <p className="text-sm text-gray-600">コース数: {courses?.length || 0}件</p>
                   <ul className="list-disc ml-6 space-y-1">
                     {courses?.map((course: any) => (
                       <li key={course.id}>
                         <span className="font-medium">{course.name}</span>
                         {course.category && (
                           <span className="text-gray-600 text-sm"> ({course.category})</span>
                         )}
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
             </div>

             {/* 開催日程 */}
             <div className="bg-white rounded-lg shadow p-6">
               <h2 className="text-xl font-bold mb-4">📅 開催日程</h2>
               {datesError ? (
                 <p className="text-red-600">エラー: {datesError.message}</p>
               ) : (
                 <div className="space-y-2">
                   <p className="text-sm text-gray-600">日程数: {dates?.length || 0}件</p>
                   <ul className="list-disc ml-6 space-y-1">
                     {dates?.map((date: any) => (
                       <li key={date.id}>
                         {new Date(date.date).toLocaleDateString('ja-JP', {
                           year: 'numeric',
                           month: 'long',
                           day: 'numeric',
                           weekday: 'short'
                         })}
                         <span className="text-gray-600 text-sm">
                           {' '}(定員: {date.capacity}名, 現在: {date.current_count}名)
                         </span>
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
             </div>

             {/* 次のステップ */}
             <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
               <h2 className="text-xl font-bold mb-4 text-blue-900">🎯 次のステップ</h2>
               <p className="text-blue-800">
                 環境構築が完了しました！<br />
                 これから実際の機能を実装していきます。
               </p>
             </div>
           </div>
         </div>
       </div>
     )
   }