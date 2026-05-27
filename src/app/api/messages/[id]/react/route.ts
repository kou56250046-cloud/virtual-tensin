import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/server';

const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '🙏', '😮'];

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

  const body = await request.json() as { emoji: string };
  const { emoji } = body;

  if (!ALLOWED_REACTIONS.includes(emoji)) {
    return NextResponse.json({ error: '無効な絵文字です' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 現在の reactions を取得
  const { data: msg } = await supabase
    .from('messages')
    .select('reactions')
    .eq('id', id)
    .single();

  if (!msg) return NextResponse.json({ error: 'メッセージが見つかりません' }, { status: 404 });

  const reactions: Record<string, string[]> = (msg.reactions as Record<string, string[]>) ?? {};
  const current = reactions[emoji] ?? [];

  // トグル: 自分がすでにリアクション済みなら削除、未リアクションなら追加
  if (current.includes(session.sessionId)) {
    const updated = current.filter((sid) => sid !== session.sessionId);
    if (updated.length === 0) {
      delete reactions[emoji];
    } else {
      reactions[emoji] = updated;
    }
  } else {
    reactions[emoji] = [...current, session.sessionId];
  }

  await supabase
    .from('messages')
    .update({ reactions })
    .eq('id', id);

  return NextResponse.json({ ok: true, reactions });
}
