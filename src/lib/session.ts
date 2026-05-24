import { SessionOptions } from 'iron-session';

export interface SessionData {
  sessionId?: string;
  name?: string;
  avatarUrl?: string | null;
  color?: string;
  isLoggedIn?: boolean;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'tensinen-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24時間
  },
};
