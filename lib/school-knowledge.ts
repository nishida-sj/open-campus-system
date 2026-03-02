/**
 * 学校情報ヘルパー関数
 * AI応答に使用されるキーワード判定ロジック
 *
 * 注: 学校固有の情報（schoolKnowledge, emergencyContact）はDB管理に移行済み。
 * テナントごとの学校情報は ai_settings / site_settings テーブルから取得。
 */

/**
 * 申込関連のキーワード
 */
export const applicationKeywords = [
  '申込',
  '申し込み',
  '予約',
  '登録',
  'エントリー',
  'キャンセル',
  '変更',
  '確認',
  '参加',
];

/**
 * よくある質問のキーワードマップ
 */
export const faqKeywords = {
  access: ['アクセス', '場所', '行き方', '最寄り駅', '駅から', '道順'],
  schedule: ['日程', 'いつ', '時間', '開催', '何時'],
  cost: ['学費', '費用', '料金', '値段', 'お金', '奨学金'],
  admission: ['入試', '試験', '受験', '合格', '倍率'],
  course: ['コース', '学科', '専攻', 'カリキュラム'],
  facility: ['施設', '設備', '校舎', '教室'],
  club: ['部活', 'クラブ', 'サークル'],
  uniform: ['制服', '服装', '私服'],
};

/**
 * キーワードに基づいて質問のカテゴリを判定
 */
export function detectQuestionCategory(message: string): string | null {
  for (const [category, keywords] of Object.entries(faqKeywords)) {
    if (keywords.some((keyword) => message.includes(keyword))) {
      return category;
    }
  }
  return null;
}

/**
 * 申込関連の質問かどうか判定
 */
export function isApplicationRelated(message: string): boolean {
  return applicationKeywords.some((keyword) => message.includes(keyword));
}

/**
 * 緊急対応が必要な質問かどうか判定
 */
export function isUrgentQuestion(message: string): boolean {
  const keywords = ['緊急', '急ぎ', 'すぐ', '今日', '本日', '困って', 'トラブル', '問題'];
  return keywords.some((keyword) => message.includes(keyword));
}
