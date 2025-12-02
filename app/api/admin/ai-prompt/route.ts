import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * プロンプト生成API
 * GET /api/admin/ai-prompt
 * - 固定項目、カスタム項目、イベント情報を組み合わせて最終的なシステムプロンプトを生成
 */
export async function GET() {
  try {
    console.log('[AI Prompt GET] Starting prompt generation...');

    // デフォルト値を設定
    let settingsMap: Record<string, string> = {
      prompt_school_info: '',
      prompt_access: '',
      prompt_unable_response: '',
      prompt_closing_message: '',
      prompt_custom_items: '[]',
    };

    // 1. 固定項目を取得
    try {
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

      if (settingsError) {
        console.error('[AI Prompt GET] Settings fetch error:', settingsError);
      } else if (settings && settings.length > 0) {
        // 取得した設定で上書き
        settings.forEach((item) => {
          settingsMap[item.setting_key] = item.setting_value || '';
        });
        console.log('[AI Prompt GET] Settings loaded:', Object.keys(settingsMap));
      } else {
        console.log('[AI Prompt GET] No settings found, using defaults');
      }
    } catch (settingsError) {
      console.error('[AI Prompt GET] Exception fetching settings:', settingsError);
    }

    // 2. 有効なイベント情報を取得（display_end_date >= 今日）
    let eventsWithDetails: any[] = [];
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: events, error: eventsError } = await supabaseAdmin
        .from('open_campus_events')
        .select(`
          id,
          name,
          description,
          overview,
          is_active,
          display_end_date
        `)
        .gte('display_end_date', today)
        .eq('is_active', true)
        .order('display_end_date', { ascending: true });

      if (eventsError) {
        console.error('[AI Prompt GET] Events fetch error:', eventsError);
      } else if (events && events.length > 0) {
        console.log(`[AI Prompt GET] Found ${events.length} active events`);

        // 3. 各イベントの開催日程とコース情報を取得
        eventsWithDetails = await Promise.all(
          events.map(async (event) => {
            try {
              // 開催日程を取得
              const { data: dates } = await supabaseAdmin
                .from('open_campus_dates')
                .select('date, capacity, current_count')
                .eq('event_id', event.id)
                .eq('is_active', true)
                .order('date', { ascending: true });

              // コース情報を取得（このイベントに紐づくコースのみ）
              const { data: courses } = await supabaseAdmin
                .from('event_courses')
                .select('name, description')
                .eq('event_id', event.id)
                .order('display_order', { ascending: true });

              return {
                ...event,
                dates: dates || [],
                courses: courses || [],
              };
            } catch (eventDetailError) {
              console.error(`[AI Prompt GET] Error fetching details for event ${event.id}:`, eventDetailError);
              return {
                ...event,
                dates: [],
                courses: [],
              };
            }
          })
        );
      } else {
        console.log('[AI Prompt GET] No active events found');
      }
    } catch (eventsError) {
      console.error('[AI Prompt GET] Exception fetching events:', eventsError);
    }

    // 4. イベントプロンプトを生成
    let eventPrompts = '';
    try {
      eventPrompts = eventsWithDetails
        .map((event) => {
          let prompt = `\n【${event.name}】\n`;

          if (event.overview) {
            prompt += `${event.overview}\n\n`;
          }

          if (event.dates && event.dates.length > 0) {
            prompt += `開催日程:\n`;
            event.dates.forEach((date: any) => {
              try {
                const dateStr = new Date(date.date).toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                });
                const remaining = (date.capacity || 0) - (date.current_count || 0);
                prompt += `- ${dateStr}: 定員${date.capacity || 0}名（残り${remaining}名）\n`;
              } catch (dateError) {
                console.error('[AI Prompt GET] Error formatting date:', dateError);
              }
            });
            prompt += '\n';
          }

          if (event.courses && event.courses.length > 0) {
            prompt += `コース情報:\n`;
            event.courses.forEach((course: any) => {
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
    } catch (promptError) {
      console.error('[AI Prompt GET] Error generating event prompts:', promptError);
    }

    // 5. カスタム項目を取得
    let customItems: any[] = [];
    try {
      const customItemsStr = settingsMap.prompt_custom_items || '[]';
      customItems = JSON.parse(customItemsStr);
      if (!Array.isArray(customItems)) {
        console.warn('[AI Prompt GET] Custom items is not an array, resetting to empty');
        customItems = [];
      }
    } catch (parseError) {
      console.error('[AI Prompt GET] Failed to parse custom items:', parseError);
      customItems = [];
    }

    let customPrompts = '';
    try {
      customPrompts = customItems
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
        .map((item: any) => `\n【${item.name || ''}】\n${item.content || ''}`)
        .join('\n');
    } catch (customError) {
      console.error('[AI Prompt GET] Error generating custom prompts:', customError);
    }

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

    console.log('[AI Prompt GET] Successfully generated prompt');

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
    console.error('[AI Prompt GET] Fatal error:', error);
    console.error('[AI Prompt GET] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
    });

    // エラーが発生しても最低限のプロンプトを返す
    const fallbackPrompt = `あなたは学校の公式LINEアカウントのAIアシスタントです。
以下のルールに従って回答してください：

【回答ルール】
- 常に丁寧で親しみやすい口調で話す
- 絵文字を適度に使用（1-2個/メッセージ）
- 長文は避け、簡潔に（200文字以内推奨）
- 不確かな情報は提供しない
- 質問の意図を理解して適切に回答

【回答できない場合】
申し訳ございませんが、その質問にはお答えできません。
お電話でお問い合わせください。`;

    return NextResponse.json(
      {
        success: false,
        error: 'プロンプト生成に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error',
        prompt: fallbackPrompt,
        parts: {
          school_info: '',
          access: '',
          unable_response: '',
          closing_message: '',
          custom_items: [],
          events: [],
          event_prompts: '',
        },
      },
      { status: 200 } // 200で返してフロントエンドでは動作できるようにする
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

    console.log(`[AI Prompt POST] Updating setting: ${setting_key}`);

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
      console.error('[AI Prompt POST] Error upserting AI setting:', error);
      throw error;
    }

    console.log(`[AI Prompt POST] Successfully updated: ${setting_key}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AI Prompt POST] Error updating AI setting:', error);
    return NextResponse.json(
      { success: false, error: '設定の更新に失敗しました' },
      { status: 500 }
    );
  }
}
