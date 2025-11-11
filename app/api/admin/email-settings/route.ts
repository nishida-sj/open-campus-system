import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// メールサーバ設定取得
export async function GET() {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('email_settings')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = データが見つからない場合のエラーコード
      console.error('設定取得エラー:', error);
      return NextResponse.json({ error: '設定の取得に失敗しました' }, { status: 500 });
    }

    return NextResponse.json(settings || null);
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// メールサーバ設定作成・更新
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_password,
      from_email,
      from_name,
      use_tls,
    } = body;

    // バリデーション
    if (!smtp_host || !smtp_port || !smtp_user || !smtp_password || !from_email) {
      return NextResponse.json(
        { error: '必須項目が不足しています' },
        { status: 400 }
      );
    }

    // 既存の設定をすべて無効化
    await supabaseAdmin
      .from('email_settings')
      .update({ is_active: false })
      .eq('is_active', true);

    // 新しい設定を作成
    const { data: newSettings, error: insertError } = await supabaseAdmin
      .from('email_settings')
      .insert({
        smtp_host,
        smtp_port: parseInt(smtp_port),
        smtp_user,
        smtp_password,
        from_email,
        from_name: from_name || null,
        use_tls: use_tls !== undefined ? use_tls : true,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('設定保存エラー:', insertError);
      return NextResponse.json(
        { error: '設定の保存に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(newSettings);
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// テストメール送信
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { test_email } = body;

    if (!test_email) {
      return NextResponse.json(
        { error: 'テスト送信先メールアドレスが必要です' },
        { status: 400 }
      );
    }

    // 現在のメール設定を取得
    const { data: settings } = await supabaseAdmin
      .from('email_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (!settings) {
      return NextResponse.json(
        { error: 'メール設定が登録されていません' },
        { status: 400 }
      );
    }

    // nodemailer を使用してテストメール送信
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_port === 465,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_password,
      },
      tls: {
        rejectUnauthorized: false, // 自己署名証明書対応
      },
    });

    await transporter.sendMail({
      from: settings.from_name
        ? `"${settings.from_name}" <${settings.from_email}>`
        : settings.from_email,
      to: test_email,
      subject: 'テストメール - オープンキャンパスシステム',
      text: 'これはテストメールです。メール送信設定が正しく動作しています。',
      html: `
        <h2>テストメール</h2>
        <p>これはテストメールです。</p>
        <p>メール送信設定が正しく動作しています。</p>
        <hr>
        <p style="color: #666; font-size: 12px;">オープンキャンパス管理システム</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('テストメール送信エラー:', error);
    return NextResponse.json(
      { error: `送信失敗: ${error.message}` },
      { status: 500 }
    );
  }
}
