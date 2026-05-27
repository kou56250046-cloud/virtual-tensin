import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET(request: NextRequest) {
  const res = NextResponse.json({});
  const session = await getIronSession<SessionData>(request, res, sessionOptions);

  if (!session.isLoggedIn) {
    return NextResponse.json({ isLoggedIn: false }, { status: 401 });
  }

  return NextResponse.json({
    isLoggedIn: true,
    sessionId: session.sessionId,
    name: session.name,
    avatarUrl: session.avatarUrl ?? null,
    color: session.color,
    sessionCreatedAt: session.sessionCreatedAt ?? null,
  });
}
