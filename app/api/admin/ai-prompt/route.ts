import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * プロンプト生成API
 * GET /api/admin/ai-prompt
 * - 固定項目、カスタム項目、イベント情報を組み合わせて最終的なシステムプロンプトを生成
 */
export async function GET() {
  try {
    // 1. 固定項目を取得
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'prompt_school_info',
        'prompt_access',
        'prompt_unable_response',
        'prompt_closing_message',
        'prompt_custom_items',
      ]);

    if (settingsError) throw settingsError;

    // 設定をオブジェクトに変換
    const settingsMap = settings.reduce((acc, item) => {
      acc[item.setting_key] = item.setting_value;
      return acc;
    }, {} as Record<string, string>);

    // 2. 有効なイベント情報を取得（display_end_date >= 今日）
    const today = new Date().toISOString().split('T')[0];

    const { data: events, error: eventsError } = await supabaseAdmin
      .from('events')
      .select(`
        id,
        name,
        description,
        is_active,
        display_end_date
      `)
      .gte('display_end_date', today)
      .eq('is_active', true)
      .order('display_end_date', { ascending: true });

    if (eventsError) throw eventsError;

    // 3. 各イベントの開催日程とコース情報を取得
    const eventsWithDetails = await Promise.all(
      events.map(async (event) => {
        // 開催日程を取得
        const { data: dates } = await supabaseAdmin
          .from('open_campus_dates')
          .select('date, capacity, current_count')
          .eq('event_id', event.id)
          .eq('is_active', true)
          .order('date', { ascending: true });

        // コース情報を取得
        const { data: courses } = await supabaseAdmin
          .from('courses')
          .select('name, description')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        return {
          ...event,
          dates: dates || [],
          courses: courses || [],
        };
      })
    );

    // 4. イベントプロンプトを生成
    const eventPrompts = eventsWithDetails
      .map((event) => {
        let prompt = `\n【${event.name}】\n`;

        if (event.description) {
          prompt += `${event.description}\n\n`;
        }

        if (event.dates.length > 0) {
          prompt += `開催日程:\n`;
          event.dates.forEach((date) => {
            const dateStr = new Date(date.date).toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            });
            const remaining = date.capacity - date.current_count;
            prompt += `- ${dateStr}: 定員${date.capacity}名（残り${remaining}名）\n`;
          });
          prompt += '\n';
        }

        if (event.courses.length > 0) {
          prompt += `コース情報:\n`;
          event.courses.forEach((course) => {
            prompt += `- ${course.name}`;
            if (course.description) {
              prompt += `: ${course.description}`;
            }
            prompt += '\n';
          });
        }

        return prompt;
      })
      .join('\n');

    // 5. カスタム項目を取得
    const customItems = JSON.parse(settingsMap.prompt_custom_items || '[]');
    const customPrompts = customItems
      .sort((a: any, b: any) => a.order - b.order)
      .map((item: any) => `\n【${item.name}】\n${item.content}`)
      .join('\n');

    // 6. 最終的なシステムプロンプトを組み立て
    const finalPrompt = `あなたは学校の公式LINEアカウントのAIアシスタントです。
以下の情報に基づいて、正確かつ親切に回答してください。

【学校情報】
${settingsMap.prompt_school_info || '（未設定）'}

【アクセス】
${settingsMap.prompt_access || '（未設定）'}
${customPrompts}
${eventPrompts ? '\n【開催予定のイベント】' + eventPrompts : ''}

【回答ルール】
- 常に丁寧で親しみやすい口調で話す
- 絵文字を適度に使用（1-2個/メッセージ）
- 長文は避け、簡潔に（200文字以内推奨）
- 不確かな情報は提供しない
- 質問の意図を理解して適切に回答

【回答できない場合】
${settingsMap.prompt_unable_response || '申し訳ございませんが、その質問にはお答えできません。'}

【すべての回答の最後に必ず追加する内容】
${settingsMap.prompt_closing_message || ''}`;

    return NextResponse.json({
      success: true,
      prompt: finalPrompt,
      parts: {
        school_info: settingsMap.prompt_school_info || '',
        access: settingsMap.prompt_access || '',
        unable_response: settingsMap.prompt_unable_response || '',
        closing_message: settingsMap.prompt_closing_message || '',
        custom_items: customItems,
        events: eventsWithDetails,
        event_prompts: eventPrompts,
      },
    });
  } catch (error) {
    console.error('Error generating AI prompt:', error);
    return NextResponse.json(
      { success: false, error: 'プロンプト生成に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * AI設定を更新
 * POST /api/admin/ai-prompt
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { setting_key, setting_value } = body;

    if (!setting_key) {
      return NextResponse.json(
        { success: false, error: 'setting_keyが必要です' },
        { status: 400 }
      );
    }

    // 設定を更新（UPSERT: 存在しない場合は挿入、存在する場合は更新）
    const { error } = await supabaseAdmin
      .from('ai_settings')
      .upsert(
        {
          setting_key: setting_key,
          setting_value: setting_value || '',
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'setting_key',
        }
      );

    if (error) {
      console.error('Error upserting AI setting:', error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating AI setting:', error);
    return NextResponse.json(
      { success: false, error: '設定の更新に失敗しました' },
      { status: 500 }
    );
  }
}
