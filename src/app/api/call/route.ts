import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/server';

function generateRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// 通話リクエスト作成
export async function POST(request: NextRequest) {
  const res = NextResponse.json({});
  const session = await getIronSession<SessionData>(request, res, sessionOptions);

  if (!session.isLoggedIn) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const body = await request.json();
  const { toSessionId } = body as { toSessionId: string };

  // 環境変数に固定リンクがあればそれを使用、なければランダム生成
  const meetLink = process.env.FIXED_MEET_LINK ?? `https://meet.jit.si/tensinen-${generateRoomId()}`;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('call_requests')
    .insert({
      from_session_id: session.sessionId,
      to_session_id: toSessionId,
      meet_link: meetLink,
      status: 'pending',
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: '通話リクエストの作成に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, callRequest: data, meetLink });
}

// 通話リクエストへの応答（承諾・拒否）
export async function PATCH(request: NextRequest) {
  const res = NextResponse.json({});
  const session = await getIronSession<SessionData>(request, res, sessionOptions);

  if (!session.isLoggedIn) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const body = await request.json();
  const { callRequestId, action } = body as {
    callRequestId: string;
    action: 'accepted' | 'rejected';
  };

  const supabase = createAdminClient();

  // 自分宛てのリクエストのみ更新可
  const { data, error } = await supabase
    .from('call_requests')
    .update({ status: action })
    .eq('id', callRequestId)
    .eq('to_session_id', session.sessionId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, callRequest: data });
}
