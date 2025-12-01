/**
 * 会話履歴管理ライブラリ
 * LINE User IDごとの会話履歴をSupabaseに保存・取得
 */

import { supabaseAdmin } from './supabase';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

/**
 * 会話履歴を保存
 * @param lineUserId LINE User ID
 * @param role メッセージの役割 (user, assistant)
 * @param message メッセージ内容
 */
export async function saveMessage(
  lineUserId: string,
  role: 'user' | 'assistant',
  message: string
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('conversation_history').insert({
      line_user_id: lineUserId,
      role: role,
      message: message,
    });

    if (error) {
      console.error('Error saving message:', error);
    }
  } catch (error) {
    console.error('Exception in saveMessage:', error);
    // エラーでも処理は継続（会話履歴保存失敗は致命的ではない）
  }
}

/**
 * 会話履歴を取得
 * @param lineUserId LINE User ID
 * @param limit 取得件数（デフォルト: 10件）
 * @returns 会話履歴の配列（古い順）
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
      .limit(limit);

    if (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // 時系列順に並び替え（古い→新しい）
    return data
      .reverse()
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));
  } catch (error) {
    console.error('Exception in getConversationHistory:', error);
    return [];
  }
}

/**
 * 会話履歴を削除（ユーザーの要望時）
 * @param lineUserId LINE User ID
 * @returns 削除成功: true、失敗: false
 */
export async function clearConversationHistory(lineUserId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('conversation_history')
      .delete()
      .eq('line_user_id', lineUserId);

    if (error) {
      console.error('Error clearing conversation history:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception in clearConversationHistory:', error);
    return false;
  }
}

/**
 * 古い会話履歴を削除（メンテナンス用）
 * @param daysOld 何日以上前のデータを削除するか（デフォルト: 30日）
 */
export async function cleanupOldHistory(daysOld: number = 30): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { error } = await supabaseAdmin
      .from('conversation_history')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      console.error('Error cleaning up old history:', error);
    } else {
      console.log(`Cleaned up conversation history older than ${daysOld} days`);
    }
  } catch (error) {
    console.error('Exception in cleanupOldHistory:', error);
  }
}

/**
 * ユーザーの会話統計を取得
 * @param lineUserId LINE User ID
 * @returns 統計情報
 */
export async function getUserConversationStats(lineUserId: string): Promise<{
  totalMessages: number;
  firstMessageDate: string | null;
  lastMessageDate: string | null;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('conversation_history')
      .select('created_at')
      .eq('line_user_id', lineUserId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error getting conversation stats:', error);
      return {
        totalMessages: 0,
        firstMessageDate: null,
        lastMessageDate: null,
      };
    }

    if (!data || data.length === 0) {
      return {
        totalMessages: 0,
        firstMessageDate: null,
        lastMessageDate: null,
      };
    }

    return {
      totalMessages: data.length,
      firstMessageDate: data[0]?.created_at || null,
      lastMessageDate: data[data.length - 1]?.created_at || null,
    };
  } catch (error) {
    console.error('Exception in getUserConversationStats:', error);
    return {
      totalMessages: 0,
      firstMessageDate: null,
      lastMessageDate: null,
    };
  }
}
