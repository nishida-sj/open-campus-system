# Vercel統合型 完全実装ガイド
## オープンキャンパス申込 + AI自動応答の統合

---

## 📋 目次

1. [システム概要](#システム概要)
2. [前提条件](#前提条件)
3. [OpenAI APIキー取得](#openai-apiキー取得)
4. [環境変数設定](#環境変数設定)
5. [パッケージインストール](#パッケージインストール)
6. [データベース設計](#データベース設計)
7. [実装コード](#実装コード)
8. [デプロイ手順](#デプロイ手順)
9. [動作確認](#動作確認)
10. [トラブルシューティング](#トラブルシューティング)

---

## システム概要

### 機能

1. **オープンキャンパス申込連携**
   - Web申込フォームから申込
   - LINE友達追加で自動連携
   - 申込完了通知

2. **AI自動応答（ChatGPT）**
   - よくある質問に24時間自動回答
   - 学校情報を学習したAI
   - 自然な会話形式

### システム構成図

```
┌──────────────────────────────────────────┐
│      ユーザー（生徒・保護者）             │
└────────┬─────────────────────┬───────────┘
         │                     │
    【申込】                【質問】
         │                     │
         ▼                     ▼
┌─────────────────┐    ┌─────────────┐
│  申込フォーム    │    │ LINE トーク  │
│  (Next.js)      │    │             │
└────────┬─────────┘    └──────┬──────┘
         │                     │
         │    ┌────────────────┘
         │    │
         ▼    ▼
┌──────────────────────────────────────────┐
│         Vercel (Next.js App)              │
│                                           │
│  /api/line/webhook ← LINE Webhook        │
│         ↓                                 │
│   イベント振り分け                         │
│         ↓                                 │
│  ┌──────┴──────┐                        │
│  │             │                        │
│  ▼             ▼                        │
│ follow      message                     │
│  │             │                        │
│  ▼             ▼                        │
│ 申込連携    AI応答                       │
│  ↓             ↓                        │
│ Supabase   OpenAI API                   │
└──────────────────────────────────────────┘
```

---

## 前提条件

### 必要なアカウント

- ✅ Vercel アカウント
- ✅ Supabase アカウント
- ✅ LINE Developers アカウント
- ✅ OpenAI アカウント（新規）

### 既存の設定

- ✅ Next.jsプロジェクト作成済み
- ✅ Supabaseデータベース設定済み
- ✅ LINE公式アカウント作成済み
- ✅ 基本的なオープンキャンパス申込機能実装済み

---

## OpenAI APIキー取得

### ステップ1: OpenAIアカウント作成

1. https://platform.openai.com/signup にアクセス
2. メールアドレスで登録
3. 電話番号認証（SMS）

### ステップ2: APIキー作成

1. ログイン後、左メニューから「API keys」を選択
2. 「Create new secret key」をクリック
3. 名前を入力（例: opencampus-system）
4. 「Create secret key」をクリック
5. **表示されたキーを必ずコピーして保存**（再表示不可）

```
例: sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### ステップ3: 使用量制限設定（推奨）

1. 「Settings」→「Limits」
2. 「Usage limits」で月額上限を設定
   - 推奨: $10/月（約¥1,500）
   - これで月間数万回の利用が可能

### ステップ4: 支払い方法登録

1. 「Settings」→「Billing」
2. クレジットカード情報を登録
3. 最低$5（約¥750）のクレジット購入

**重要: 支払い方法を登録しないとAPIが使えません**

---

## 環境変数設定

### ローカル開発用（.env.local）

プロジェクトルートに `.env.local` ファイルを作成:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=your-channel-access-token
LINE_CHANNEL_SECRET=your-channel-secret

# OpenAI API（新規追加）
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.7

# アプリケーション設定
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 本番環境用（Vercel）

Vercelダッシュボードで設定:

1. プロジェクトを選択
2. 「Settings」→「Environment Variables」
3. 以下を追加:

| Name | Value | Environment |
|------|-------|-------------|
| NEXT_PUBLIC_SUPABASE_URL | https://xxxxx.supabase.co | Production |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | eyJhbGci... | Production |
| SUPABASE_SERVICE_ROLE_KEY | eyJhbGci... | Production |
| LINE_CHANNEL_ACCESS_TOKEN | your-token | Production |
| LINE_CHANNEL_SECRET | your-secret | Production |
| OPENAI_API_KEY | sk-proj-xxx... | Production |
| OPENAI_MODEL | gpt-4o-mini | Production |
| OPENAI_MAX_TOKENS | 500 | Production |
| OPENAI_TEMPERATURE | 0.7 | Production |
| NEXT_PUBLIC_APP_URL | https://your-app.vercel.app | Production |

---

## パッケージインストール

### 必要なパッケージ

```bash
# OpenAI SDK
npm install openai

# LINE Bot SDK（既存の場合はスキップ）
npm install @line/bot-sdk

# 既存パッケージ
npm install @supabase/supabase-js
npm install zod
```

### package.json 確認

```json
{
  "dependencies": {
    "@line/bot-sdk": "^9.5.0",
    "@supabase/supabase-js": "^2.39.0",
    "next": "14.x",
    "openai": "^4.70.0",
    "react": "^18.x",
    "zod": "^3.22.4"
  }
}
```

---

## データベース設計

### 新規テーブル作成（会話履歴用）

Supabaseダッシュボード → SQL Editor で実行:

```sql
-- 会話履歴テーブル
CREATE TABLE conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成（検索高速化）
CREATE INDEX idx_conversation_history_line_user_id 
ON conversation_history(line_user_id);

CREATE INDEX idx_conversation_history_created_at 
ON conversation_history(created_at DESC);

-- RLS（Row Level Security）設定
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;

-- サービスロールのみアクセス可能
CREATE POLICY "Service role only" 
ON conversation_history 
FOR ALL 
USING (auth.role() = 'service_role');

-- 古い会話履歴を自動削除する関数（オプション）
CREATE OR REPLACE FUNCTION delete_old_conversations()
RETURNS void AS $$
BEGIN
  DELETE FROM conversation_history
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 毎日実行するスケジュール設定（Supabase Cron）
-- Dashboard → Database → Cron Jobs から設定
```

### 既存テーブルの確認

`applicants` テーブルに必要なカラムがあるか確認:

```sql
-- 必要なカラム
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'applicants';

-- 不足している場合は追加
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS line_user_id VARCHAR(100);
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS token VARCHAR(100);
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
```

---

## 実装コード

### ディレクトリ構造

```
open-campus-system/
├── app/
│   ├── api/
│   │   ├── apply/
│   │   │   └── route.ts          # 申込API（既存）
│   │   └── line/
│   │       └── webhook/
│   │           └── route.ts       # LINE Webhook（統合版）
│   ├── apply/
│   │   └── page.tsx               # 申込フォーム（既存）
│   └── layout.tsx
├── lib/
│   ├── supabase.ts                # Supabaseクライアント（既存）
│   ├── ai-response.ts             # AI応答ロジック（新規）
│   ├── conversation-history.ts    # 会話履歴管理（新規）
│   ├── school-knowledge.ts        # 学校情報（新規）
│   └── line-client.ts             # LINEクライアント（既存）
├── .env.local
└── package.json
```

---

### 1. 学校情報の定義

`lib/school-knowledge.ts`:

```typescript
/**
 * 学校情報のマスターデータ
 * AI応答に使用される学校の基本情報
 */

export const schoolKnowledge = `
【学校基本情報】
学校名: ○○高等学校（または専門学校）
所在地: 〒123-4567 東京都○○区△△1-2-3
電話番号: 03-XXXX-XXXX
受付時間: 平日 9:00-17:00
公式サイト: https://www.example-school.jp

【アクセス】
最寄り駅:
- JR山手線「渋谷駅」から徒歩10分
- 東京メトロ銀座線「表参道駅」から徒歩8分
- 東急田園都市線「渋谷駅」から徒歩10分

バスでのアクセス:
- 都バス01系統「○○前」下車すぐ

駐車場: なし（公共交通機関をご利用ください）

【オープンキャンパス日程】
2025年12月:
- 12月15日（日）10:00-15:00
- 12月22日（日）10:00-15:00

2026年1月:
- 1月12日（日）10:00-15:00
- 1月19日（日）10:00-15:00

2026年2月:
- 2月9日（日）10:00-15:00
- 2月16日（日）10:00-15:00

【オープンキャンパス内容】
1. 学校説明会（10:00-11:00）
2. 体験授業（11:15-12:15）
3. 昼食・キャンパスツアー（12:15-13:15）
4. 個別相談会（13:30-15:00）

申込方法: 公式LINEまたはWebサイトから予約
参加費: 無料
持ち物: 筆記用具、上履き（体育館使用の場合）

【設置コース】
1. 普通科
   - 大学進学を目指す総合的なカリキュラム
   - 進路実績: GMARCH以上 70%
   
2. 美容科
   - 美容師国家試験受験資格取得
   - ヘアメイク、ネイル、エステの実践
   
3. 調理科
   - 調理師免許取得
   - 和洋中の幅広い調理技術
   
4. 情報処理科
   - ITパスポート、基本情報技術者試験対策
   - プログラミング、Web制作

【学費（年額）】
入学金: ¥200,000（初年度のみ）
授業料: ¥600,000
施設設備費: ¥100,000
実習費: ¥50,000（コースにより異なる）
---
合計: ¥950,000（初年度）
    ¥750,000（2年目以降）

【奨学金制度】
1. 特待生制度
   - 入試成績上位者は授業料50-100%免除
   
2. 兄弟姉妹割引
   - 入学金50%免除
   
3. 高等学校等就学支援金
   - 世帯年収に応じて支援

4. 学校独自の奨学金
   - 返済不要の給付型奨学金あり

【入試情報】
推薦入試:
- 出願期間: 2026年1月10日-20日
- 試験日: 2026年1月25日
- 試験科目: 面接、作文

一般入試:
- 出願期間: 2026年2月1日-10日
- 試験日: 2026年2月15日
- 試験科目: 国語、数学、英語、面接

【よくある質問】
Q: 見学は個別でも可能ですか？
A: はい、平日9:00-17:00で個別見学を受け付けています。事前にお電話でご予約ください。

Q: 制服はありますか？
A: はい、本校指定の制服があります。詳細はオープンキャンパスでご確認いただけます。

Q: 部活動はありますか？
A: 運動部10部、文化部8部があります。全国大会出場実績のある部活もあります。

Q: 留学制度はありますか？
A: 普通科では希望者対象の短期留学プログラム（2週間）があります。

Q: 就職率はどのくらいですか？
A: 専門科（美容科・調理科・情報処理科）の就職率は98%以上です。
`

// 緊急時の連絡先情報
export const emergencyContact = {
  phone: '03-XXXX-XXXX',
  hours: '平日 9:00-17:00',
  email: 'info@example-school.jp'
}

// 申込関連のキーワード
export const applicationKeywords = [
  '申込', '申し込み', '予約', '登録', 'エントリー',
  'キャンセル', '変更', '確認', '参加'
]

// よくある質問のキーワード
export const faqKeywords = {
  access: ['アクセス', '場所', '行き方', '最寄り駅', '駅から', '道順'],
  schedule: ['日程', 'いつ', '時間', '開催', '何時'],
  cost: ['学費', '費用', '料金', '値段', 'お金', '奨学金'],
  admission: ['入試', '試験', '受験', '合格', '倍率'],
  course: ['コース', '学科', '専攻', 'カリキュラム'],
  facility: ['施設', '設備', '校舎', '教室'],
  club: ['部活', 'クラブ', 'サークル'],
  uniform: ['制服', '服装', '私服']
}
```

---

### 2. AI応答ロジック

`lib/ai-response.ts`:

```typescript
import OpenAI from 'openai'
import { schoolKnowledge, faqKeywords, emergencyContact } from './school-knowledge'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

/**
 * AI応答を生成
 * @param userMessage ユーザーからのメッセージ
 * @param conversationHistory 会話履歴（オプション）
 * @returns AI応答テキスト
 */
export async function generateAIResponse(
  userMessage: string,
  conversationHistory?: { role: 'user' | 'assistant', content: string }[]
): Promise<string> {
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `あなたは学校の公式LINEアカウントのAIアシスタントです。

以下の学校情報に基づいて、正確かつ親切に回答してください：

${schoolKnowledge}

【応答ルール】
1. 常に丁寧で親しみやすい口調で話す
2. 絵文字を適度に使用（1-2個/メッセージ）
3. 長文は避け、簡潔に（200文字以内推奨）
4. 不確かな情報は提供しない
5. 質問の意図を理解して適切に回答

【対応できない質問への回答】
- 個人情報の変更 → 電話でお問い合わせいただくよう案内
- 複雑な相談 → 個別相談会の予約を提案
- 学校情報以外の質問 → 「学校に関する質問にお答えできます」

【緊急時の連絡先】
電話: ${emergencyContact.phone}
受付: ${emergencyContact.hours}
メール: ${emergencyContact.email}`
      }
    ]
    
    // 会話履歴を追加（最新10件のみ）
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-10)
      messages.push(...recentHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })))
    }
    
    // 現在のユーザーメッセージを追加
    messages.push({
      role: 'user',
      content: userMessage
    })
    
    // OpenAI API呼び出し
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: messages,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500'),
    })
    
    const response = completion.choices[0].message.content
    
    if (!response) {
      return getDefaultErrorMessage()
    }
    
    return response
    
  } catch (error) {
    console.error('OpenAI API error:', error)
    
    // エラーの種類に応じた応答
    if (error instanceof Error) {
      if (error.message.includes('rate_limit')) {
        return 'ただいま多くのお問い合わせをいただいており、少々お時間をいただいております。しばらくしてからもう一度お試しください🙇'
      } else if (error.message.includes('api_key')) {
        console.error('OpenAI API key error')
        return getDefaultErrorMessage()
      }
    }
    
    return getDefaultErrorMessage()
  }
}

/**
 * よくある質問かどうか判定
 */
export function isFrequentQuestion(message: string): boolean {
  const allKeywords = Object.values(faqKeywords).flat()
  return allKeywords.some(keyword => message.includes(keyword))
}

/**
 * 申込関連の質問かどうか判定
 */
export function isApplicationRelated(message: string): boolean {
  const keywords = [
    '申込', '申し込み', '予約', '登録', 'エントリー',
    'キャンセル', '変更', '確認', '参加'
  ]
  
  return keywords.some(keyword => message.includes(keyword))
}

/**
 * 緊急対応が必要な質問かどうか判定
 */
export function isUrgentQuestion(message: string): boolean {
  const keywords = [
    '緊急', '急ぎ', 'すぐ', '今日', '本日',
    '困って', 'トラブル', '問題'
  ]
  
  return keywords.some(keyword => message.includes(keyword))
}

/**
 * デフォルトエラーメッセージ
 */
function getDefaultErrorMessage(): string {
  return `申し訳ございません。一時的にシステムエラーが発生しております。

お急ぎの場合は、お電話でお問い合わせください。
📞 ${emergencyContact.phone}
⏰ ${emergencyContact.hours}`
}

/**
 * トークン使用量の概算計算
 */
export function estimateTokens(text: string): number {
  // 日本語の場合、おおよそ1文字=2トークン
  return text.length * 2
}
```

---

### 3. 会話履歴管理

`lib/conversation-history.ts`:

```typescript
import { supabaseAdmin } from './supabase'

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at?: string
}

/**
 * 会話履歴を保存
 */
export async function saveMessage(
  lineUserId: string,
  role: 'user' | 'assistant',
  message: string
): Promise<void> {
  try {
    await supabaseAdmin
      .from('conversation_history')
      .insert({
        line_user_id: lineUserId,
        role: role,
        message: message
      })
  } catch (error) {
    console.error('Error saving message:', error)
    // エラーでも処理は継続（会話履歴保存失敗は致命的ではない）
  }
}

/**
 * 会話履歴を取得
 */
export async function getConversationHistory(
  lineUserId: string,
  limit: number = 10
): Promise<ConversationMessage[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('conversation_history')
      .select('role, message as content, created_at')
      .eq('line_user_id', lineUserId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    
    // 時系列順に並び替え（古い→新しい）
    return (data || [])
      .reverse()
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))
    
  } catch (error) {
    console.error('Error getting conversation history:', error)
    return []
  }
}

/**
 * 会話履歴を削除（ユーザーの要望時）
 */
export async function clearConversationHistory(
  lineUserId: string
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('conversation_history')
      .delete()
      .eq('line_user_id', lineUserId)
    
    if (error) throw error
    return true
    
  } catch (error) {
    console.error('Error clearing conversation history:', error)
    return false
  }
}

/**
 * 古い会話履歴を削除（メンテナンス用）
 */
export async function cleanupOldHistory(daysOld: number = 30): Promise<void> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)
    
    await supabaseAdmin
      .from('conversation_history')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
    
    console.log(`Cleaned up conversation history older than ${daysOld} days`)
    
  } catch (error) {
    console.error('Error cleaning up old history:', error)
  }
}

/**
 * ユーザーの会話統計を取得
 */
export async function getUserConversationStats(
  lineUserId: string
): Promise<{
  totalMessages: number
  firstMessageDate: string | null
  lastMessageDate: string | null
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('conversation_history')
      .select('created_at')
      .eq('line_user_id', lineUserId)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    
    return {
      totalMessages: data?.length || 0,
      firstMessageDate: data?.[0]?.created_at || null,
      lastMessageDate: data?.[data.length - 1]?.created_at || null
    }
    
  } catch (error) {
    console.error('Error getting conversation stats:', error)
    return {
      totalMessages: 0,
      firstMessageDate: null,
      lastMessageDate: null
    }
  }
}
```

---

### 4. 統合Webhook処理

`app/api/line/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { Client, WebhookEvent, validateSignature, TextMessage } from '@line/bot-sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { 
  generateAIResponse, 
  isApplicationRelated, 
  isUrgentQuestion 
} from '@/lib/ai-response'
import {
  saveMessage,
  getConversationHistory,
  clearConversationHistory
} from '@/lib/conversation-history'

// LINE Client初期化
const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
})

/**
 * LINE Webhook エンドポイント
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-line-signature')

    // 署名検証
    if (!signature) {
      console.error('No signature provided')
      return NextResponse.json({ error: 'No signature' }, { status: 401 })
    }

    const isValid = validateSignature(
      body,
      process.env.LINE_CHANNEL_SECRET!,
      signature
    )

    if (!isValid) {
      console.error('Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const events: WebhookEvent[] = JSON.parse(body).events

    // 各イベントを処理
    await Promise.all(events.map(event => handleEvent(event)))

    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('LINE webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * イベント振り分け
 */
async function handleEvent(event: WebhookEvent): Promise<void> {
  try {
    switch (event.type) {
      case 'follow':
        await handleFollow(event)
        break
      
      case 'message':
        if (event.message.type === 'text') {
          await handleTextMessage(event)
        }
        break
      
      case 'unfollow':
        await handleUnfollow(event)
        break
      
      default:
        console.log('Unhandled event type:', event.type)
    }
  } catch (error) {
    console.error('Error handling event:', error)
  }
}

/**
 * 友達追加時の処理（申込連携）
 */
async function handleFollow(event: any): Promise<void> {
  const userId = event.source.userId
  const timestamp = event.timestamp
  
  // LIFFのstateパラメータからトークンを取得
  const token = event.follow?.params?.liff?.state
  
  try {
    if (!token) {
      // トークンがない場合は通常のウェルカムメッセージ
      await sendWelcomeMessage(event.replyToken, userId)
      return
    }

    // 申込情報を検索
    const { data: applicant, error: fetchError } = await supabaseAdmin
      .from('applicants')
      .select('*')
      .eq('token', token)
      .single()

    if (fetchError || !applicant) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '申込情報が見つかりませんでした。\nお手数ですが、再度申込フォームからお申し込みください。'
      })
      return
    }

    // トークン有効期限チェック
    const now = new Date()
    const expiresAt = new Date(applicant.token_expires_at)
    
    if (now > expiresAt) {
      await supabaseAdmin
        .from('applicants')
        .update({ status: 'expired' })
        .eq('id', applicant.id)

      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '申込URLの有効期限が切れています。\nお手数ですが、再度申込フォームからお申し込みください。'
      })
      return
    }

    // LINE ID紐付け
    const { error: updateError } = await supabaseAdmin
      .from('applicants')
      .update({
        line_user_id: userId,
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', applicant.id)

    if (updateError) {
      throw updateError
    }

    // ログ記録
    await supabaseAdmin.from('application_logs').insert({
      applicant_id: applicant.id,
      action: 'line_linked',
      timestamp: new Date().toISOString()
    })

    // 申込完了メッセージ送信
    await sendApplicationCompleteMessage(event.replyToken, applicant)

  } catch (error) {
    console.error('Error in handleFollow:', error)
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '申込処理中にエラーが発生しました。\nお手数ですが、お電話でお問い合わせください。\n📞 03-XXXX-XXXX'
    })
  }
}

/**
 * テキストメッセージ受信時の処理（AI応答）
 */
async function handleTextMessage(event: any): Promise<void> {
  const userMessage = event.message.text
  const userId = event.source.userId
  
  try {
    // 特殊コマンドの処理
    if (userMessage === 'リセット' || userMessage === 'reset') {
      await clearConversationHistory(userId)
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '会話履歴をリセットしました。\n新しく質問をどうぞ！😊'
      })
      return
    }
    
    // 申込関連の質問の場合
    if (isApplicationRelated(userMessage)) {
      await handleApplicationQuery(event.replyToken, userId, userMessage)
      return
    }
    
    // 緊急の質問の場合
    if (isUrgentQuestion(userMessage)) {
      await handleUrgentQuery(event.replyToken, userMessage)
      return
    }
    
    // 通常のAI応答
    // 会話履歴を取得
    const history = await getConversationHistory(userId, 10)
    
    // AI応答生成
    const aiResponse = await generateAIResponse(userMessage, history)
    
    // 応答を送信
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: aiResponse
    })
    
    // 会話履歴を保存
    await saveMessage(userId, 'user', userMessage)
    await saveMessage(userId, 'assistant', aiResponse)
    
  } catch (error) {
    console.error('Error in handleTextMessage:', error)
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '申し訳ございません。一時的にエラーが発生しました。\nしばらくしてからもう一度お試しください。'
    })
  }
}

/**
 * フォロー解除時の処理
 */
async function handleUnfollow(event: any): Promise<void> {
  const userId = event.source.userId
  
  try {
    // LINE ID紐付けを解除（オプション）
    await supabaseAdmin
      .from('applicants')
      .update({ line_user_id: null })
      .eq('line_user_id', userId)
    
    // 会話履歴を削除（オプション）
    // await clearConversationHistory(userId)
    
    console.log(`User ${userId} unfollowed`)
    
  } catch (error) {
    console.error('Error in handleUnfollow:', error)
  }
}

/**
 * ウェルカムメッセージ送信
 */
async function sendWelcomeMessage(replyToken: string, userId: string): Promise<void> {
  const message: TextMessage = {
    type: 'text',
    text: `ご登録ありがとうございます！🎉

○○高等学校の公式LINEアカウントです。

【できること】
✅ オープンキャンパスの申込
✅ イベント情報のお知らせ
✅ 学校に関する質問への自動回答

質問があればお気軽にメッセージしてください。
AIが24時間対応いたします🤖

例）
「アクセスを教えて」
「オープンキャンパスはいつ？」
「学費について知りたい」`
  }
  
  await client.replyMessage(replyToken, message)
}

/**
 * 申込完了メッセージ送信
 */
async function sendApplicationCompleteMessage(
  replyToken: string, 
  applicant: any
): Promise<void> {
  const visitDate = new Date(applicant.visit_date)
  const formattedDate = visitDate.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })
  
  const message: TextMessage = {
    type: 'text',
    text: `${applicant.name}さん、お申し込みありがとうございます！✨

【申込内容】
📅 参加日: ${formattedDate}
🏫 出身校: ${applicant.school_name}
👤 学年: ${applicant.grade}
👥 同伴者: ${applicant.companion_count}名

【当日のスケジュール】
10:00-11:00 学校説明会
11:15-12:15 体験授業
12:15-13:15 昼食・キャンパスツアー
13:30-15:00 個別相談会

【持ち物】
・筆記用具
・上履き（体育館使用の場合）

前日にリマインドメッセージをお送りします。
当日お会いできることを楽しみにしています！

ご質問があれば、このLINEでお気軽にメッセージしてください。
AIが自動でお答えします🤖`
  }
  
  await client.replyMessage(replyToken, message)
}

/**
 * 申込関連の質問への応答
 */
async function handleApplicationQuery(
  replyToken: string,
  userId: string,
  userMessage: string
): Promise<void> {
  // ユーザーの申込情報を確認
  const { data: applicant } = await supabaseAdmin
    .from('applicants')
    .select('*')
    .eq('line_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  if (applicant) {
    const visitDate = new Date(applicant.visit_date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    })
    
    await client.replyMessage(replyToken, {
      type: 'text',
      text: `【現在のお申し込み状況】

📅 参加予定日: ${visitDate}
✅ 受付完了しています

【キャンセル・変更について】
お手数ですが、お電話でお問い合わせください。
📞 TEL: 03-XXXX-XXXX
⏰ 受付時間: 平日 9:00-17:00`
    })
  } else {
    await client.replyMessage(replyToken, {
      type: 'text',
      text: `オープンキャンパスのお申し込みは、
こちらのLINEまたは公式サイトから可能です。

【申込方法】
1. LINEでの申込
   → メッセージで「申し込みたい」とお送りください
   
2. Webサイトでの申込
   → https://example-school.jp/opencampus

【次回開催日程】
・12月15日（日）
・12月22日（日）
・1月12日（日）

どの日程をご希望ですか？😊`
    })
  }
}

/**
 * 緊急の質問への応答
 */
async function handleUrgentQuery(
  replyToken: string,
  userMessage: string
): Promise<void> {
  await client.replyMessage(replyToken, {
    type: 'text',
    text: `お急ぎのご用件ですね。
恐れ入りますが、直接お電話でお問い合わせいただけますでしょうか。

📞 TEL: 03-XXXX-XXXX
⏰ 受付時間: 平日 9:00-17:00

担当者が直接対応させていただきます。`
  })
}
```

---

## デプロイ手順

### ステップ1: ローカルテスト

```bash
# 開発サーバー起動
npm run dev

# 別ターミナルでngrok起動（Webhook受信用）
ngrok http 3000

# ngrokのURLをコピー
# 例: https://xxxx-xx-xx-xx-xx.ngrok-free.app
```

### ステップ2: LINE Webhook設定（テスト用）

1. LINE Developers Console を開く
2. チャネル設定 → Messaging API
3. Webhook URL を設定:
   ```
   https://xxxx-xx-xx-xx-xx.ngrok-free.app/api/line/webhook
   ```
4. 「検証」ボタンをクリック
5. 成功したら「Webhookの利用」をONにする

### ステップ3: ローカルテスト実行

1. LINE公式アカウントを友達追加
2. メッセージを送信
3. AI応答が返ってくるか確認

```
テストメッセージ例:
- 「こんにちは」
- 「アクセスを教えて」
- 「オープンキャンパスの日程は？」
- 「学費について知りたい」
```

### ステップ4: Vercelにデプロイ

```bash
# Gitにコミット
git add .
git commit -m "Add AI auto-response feature"
git push origin main

# Vercelが自動デプロイ
```

### ステップ5: LINE Webhook設定（本番用）

1. LINE Developers Console を開く
2. Webhook URL を変更:
   ```
   https://your-app.vercel.app/api/line/webhook
   ```
3. 「検証」ボタンをクリック
4. 成功を確認

### ステップ6: 本番テスト

1. 別のLINEアカウントで友達追加
2. 各種メッセージをテスト
3. 申込フローもテスト

---

## 動作確認

### テストチェックリスト

#### 1. 友達追加（申込連携なし）

- [ ] ウェルカムメッセージが届く
- [ ] メッセージ内容が適切

#### 2. 友達追加（申込連携あり）

- [ ] 申込完了メッセージが届く
- [ ] Supabaseにline_user_idが保存される
- [ ] statusが'completed'になる

#### 3. AI応答（基本）

- [ ] 「こんにちは」に適切に応答
- [ ] 「ありがとう」に適切に応答

#### 4. AI応答（学校情報）

- [ ] 「アクセスを教えて」に正確な情報で応答
- [ ] 「日程は？」にオープンキャンパス日程で応答
- [ ] 「学費は？」に学費情報で応答
- [ ] 「入試について」に入試情報で応答

#### 5. AI応答（会話継続）

- [ ] 複数の質問をしても文脈を理解している
- [ ] 前の質問を覚えている

#### 6. 申込関連の質問

- [ ] 「申込状況を確認したい」に適切に応答
- [ ] 申込者には現在の状況を表示
- [ ] 未申込者には申込方法を案内

#### 7. 特殊コマンド

- [ ] 「リセット」で会話履歴がクリアされる

#### 8. エラーハンドリング

- [ ] OpenAI APIエラー時も適切なメッセージを返す
- [ ] Supabaseエラー時もクラッシュしない

---

## トラブルシューティング

### 1. AI応答が返ってこない

**原因1: OpenAI APIキーが無効**

```bash
# 環境変数を確認
echo $OPENAI_API_KEY

# Vercelの環境変数を確認
# Dashboard → Settings → Environment Variables
```

**解決策:**
- APIキーを再発行
- 環境変数を再設定
- Vercelを再デプロイ

**原因2: 支払い方法未登録**

```
OpenAI Platform → Settings → Billing
```

**解決策:**
- クレジットカード登録
- 最低$5チャージ

---

### 2. 会話履歴が保存されない

**原因: Supabaseテーブルが未作成**

```sql
-- テーブル存在確認
SELECT * FROM conversation_history LIMIT 1;
```

**解決策:**
- テーブル作成SQLを実行
- RLSポリシーを確認

---

### 3. レスポンスが遅い

**原因: モデルが重い**

```bash
# 環境変数を確認
OPENAI_MODEL=gpt-4o-mini  # ← これが推奨
```

**高速化の方法:**
1. `gpt-4o-mini`を使用（最速）
2. `max_tokens`を減らす（500推奨）
3. 会話履歴の取得件数を減らす（10件推奨）

---

### 4. コストが高い

**原因: 大量のリクエスト**

**確認方法:**
```
OpenAI Platform → Usage
```

**コスト削減策:**
1. よくある質問は固定応答にする
2. `temperature`を下げる（0.5-0.7）
3. `max_tokens`を減らす
4. 月額上限を設定

---

### 5. 署名検証エラー

**エラーメッセージ:**
```
Invalid signature
```

**原因: LINE_CHANNEL_SECRETが間違っている**

**解決策:**
```bash
# LINE Developers Consoleから正しい値をコピー
# Messaging API → Channel Secret

# 環境変数を更新
LINE_CHANNEL_SECRET=正しい値
```

---

### 6. Webhookが届かない

**確認項目:**
1. Webhook URLが正しいか
2. Webhookが「利用する」になっているか
3. LINE公式アカウントが友達追加されているか
4. Vercelのログを確認

**Vercelログ確認:**
```
Vercel Dashboard → Deployments → [最新] → Runtime Logs
```

---

### 7. デバッグ方法

**ログ出力:**

```typescript
// webhook/route.ts に追加
console.log('Event received:', JSON.stringify(event, null, 2))
console.log('User message:', userMessage)
console.log('AI response:', aiResponse)
```

**Vercelでログ確認:**
```
Dashboard → Deployments → Functions → View logs
```

---

## 💰 コスト試算（再掲）

### OpenAI API（gpt-4o-mini）

| 利用回数/月 | トークン数 | コスト（円） |
|-----------|----------|------------|
| 100回 | 50,000 | ¥3 |
| 1,000回 | 500,000 | ¥32 |
| 5,000回 | 2,500,000 | ¥158 |
| 10,000回 | 5,000,000 | ¥315 |

**結論: 非常に安価（月間10,000回でも¥315）**

---

## 📚 参考リンク

### OpenAI
- ドキュメント: https://platform.openai.com/docs
- 料金: https://openai.com/pricing
- 使用量確認: https://platform.openai.com/usage

### LINE Messaging API
- ドキュメント: https://developers.line.biz/ja/docs/messaging-api/
- Node.js SDK: https://github.com/line/line-bot-sdk-nodejs

### Vercel
- ドキュメント: https://vercel.com/docs
- 環境変数: https://vercel.com/docs/environment-variables

### Supabase
- ドキュメント: https://supabase.com/docs
- SQL Editor: Dashboard → SQL Editor

---

## ✅ 完了チェックリスト

### 事前準備
- [ ] OpenAI アカウント作成
- [ ] OpenAI APIキー取得
- [ ] OpenAI 支払い方法登録
- [ ] 使用量上限設定

### 実装
- [ ] パッケージインストール
- [ ] 環境変数設定（ローカル）
- [ ] 環境変数設定（Vercel）
- [ ] Supabaseテーブル作成
- [ ] コード実装完了

### テスト
- [ ] ローカルテスト成功
- [ ] Vercelデプロイ成功
- [ ] LINE Webhook設定完了
- [ ] 本番テスト成功

### 確認
- [ ] 友達追加が動作する
- [ ] AI応答が動作する
- [ ] 申込連携が動作する
- [ ] エラーハンドリングが適切

---

## 🎉 完成！

お疲れ様でした！
これで1つのLINEアカウントで「オープンキャンパス申込」と「AI自動応答」の両方が実現できました。

**次のステップ:**
1. 実際に運用開始
2. ユーザーの質問を収集
3. AI応答の改善
4. 学校情報の更新

**さらなる改善案:**
- リッチメニューの追加
- プッシュメッセージの自動送信
- 統計ダッシュボードの作成
- 画像・動画対応

何か質問があれば、いつでもお聞きください！🚀

---

作成日: 2025年11月18日
バージョン: 1.0
