import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(request, res, sessionOptions);

  if (session.sessionId) {
    // Supabase からセッション行を削除
    const supabase = createAdminClient();
    await supabase.from('sessions').delete().eq('id', session.sessionId);
  }

  session.destroy();
  return res;
}
