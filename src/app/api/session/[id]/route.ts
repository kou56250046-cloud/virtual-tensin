import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/server';

// アバター位置・avatar_url・seat_id の更新
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

  const body = await request.json() as Record<string, unknown>;

  const updateData: Record<string, unknown> = {
    last_seen: new Date().toISOString(),
  };

  if ('x' in body && body.x !== undefined) updateData.x = body.x;
  if ('y' in body && body.y !== undefined) updateData.y = body.y;
  if ('avatar_url' in body) updateData.avatar_url = body.avatar_url;
  if ('seat_id' in body) updateData.seat_id = body.seat_id;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('sessions')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('session update error:', error);
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
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
