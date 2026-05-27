import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = NextResponse.json({});
  const session = await getIronSession<SessionData>(request, res, sessionOptions);

  if (!session.isLoggedIn || !session.sessionId) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 現在の read_by を取得して自分が未読なら追加
  const { data: msg } = await supabase
    .from('messages')
    .select('read_by')
    .eq('id', id)
    .single();

  if (!msg) return NextResponse.json({ ok: true });

  const readBy: string[] = msg.read_by ?? [];
  if (readBy.includes(session.sessionId)) {
    return NextResponse.json({ ok: true }); // 既に既読済み
  }

  await supabase
    .from('messages')
    .update({ read_by: [...readBy, session.sessionId] })
    .eq('id', id);

  return NextResponse.json({ ok: true });
}
