import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/server';

// アバター位置の更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = NextResponse.json({});
  const session = await getIronSession<SessionData>(request, res, sessionOptions);

  if (!session.isLoggedIn || session.sessionId !== id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const body = await request.json();
  const { x, y } = body as { x: number; y: number };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('sessions')
    .update({ x, y, last_seen: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: '位置の更新に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// last_seen のハートビート更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = NextResponse.json({});
  const session = await getIronSession<SessionData>(request, res, sessionOptions);

  if (!session.isLoggedIn || session.sessionId !== id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const supabase = createAdminClient();
  await supabase
    .from('sessions')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json({ ok: true });
}
