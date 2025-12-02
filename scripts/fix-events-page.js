const fs = require('fs');
const path = require('path');

// イベント管理ページの修正
const eventsPagePath = path.join(__dirname, '../app/admin/events/page.tsx');
let content = fs.readFileSync(eventsPagePath, 'utf8');

// 1. バリデーションに display_end_date 必須チェックを追加
const validationOld = `  // イベント作成
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.dates.length === 0) {`;

const validationNew = `  // イベント作成
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    // 必須項目チェック
    if (!formData.display_end_date) {
      alert('イベント一覧表示終了日を入力してください');
      return;
    }

    if (formData.dates.length === 0) {`;

content = content.replace(validationOld, validationNew);

// 2. 説明（管理用）の説明文を更新
const descOld = `説明（管理用）
                <span className="text-gray-500 text-xs ml-2">管理画面のみ表示</span>`;

const descNew = `説明（管理用）
                <span className="text-gray-500 text-xs ml-2">管理画面のみ表示・AIのプロンプトになります</span>`;

content = content.replace(descOld, descNew);

// 3. display_end_date を必須にする
const dateOld = `<label htmlFor="display_end_date" className="block text-sm font-medium text-gray-700 mb-2">
                イベント一覧表示終了日
                <span className="text-gray-500 text-xs ml-2">この日を過ぎるとイベント一覧に表示されなくなります</span>
              </label>
              <input
                type="date"
                id="display_end_date"
                value={formData.display_end_date}
                onChange={(e) => setFormData({ ...formData, display_end_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />`;

const dateNew = `<label htmlFor="display_end_date" className="block text-sm font-medium text-gray-700 mb-2">
                イベント一覧表示終了日
                <span className="text-red-600 ml-1">*</span>
                <span className="text-gray-500 text-xs ml-2">この日を過ぎるとイベント一覧に表示されなくなります</span>
              </label>
              <input
                type="date"
                id="display_end_date"
                value={formData.display_end_date}
                onChange={(e) => setFormData({ ...formData, display_end_date: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />`;

content = content.replace(dateOld, dateNew);

// ファイルを上書き保存
fs.writeFileSync(eventsPagePath, content, 'utf8');
console.log('✅ イベント管理ページの修正完了');
