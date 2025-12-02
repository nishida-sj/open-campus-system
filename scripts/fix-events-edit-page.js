const fs = require('fs');
const path = require('path');

// イベント編集ページの修正
const eventsEditPagePath = path.join(__dirname, '../app/admin/events/[id]/edit/page.tsx');
let content = fs.readFileSync(eventsEditPagePath, 'utf8');

// 1. 説明（管理用）の説明文を更新
const descOld = `説明（管理用）
              <span className="text-gray-500 text-xs ml-2">管理画面のみ表示</span>`;

const descNew = `説明（管理用）
              <span className="text-gray-500 text-xs ml-2">管理画面のみ表示・AIのプロンプトになります</span>`;

content = content.replace(descOld, descNew);

// 2. display_end_date を必須にする
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
fs.writeFileSync(eventsEditPagePath, content, 'utf8');
console.log('✅ イベント編集ページの修正完了');
