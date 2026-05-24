import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /room 以下は認証必須
  if (pathname.startsWith('/room')) {
    const res = NextResponse.next();
    const session = await getIronSession<SessionData>(request, res, sessionOptions);

    if (!session.isLoggedIn) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // ログイン済みで / にアクセスしたら /room にリダイレクト
  if (pathname === '/') {
    const res = NextResponse.next();
    const session = await getIronSession<SessionData>(request, res, sessionOptions);

    if (session.isLoggedIn) {
      return NextResponse.redirect(new URL('/room', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/room/:path*'],
};
