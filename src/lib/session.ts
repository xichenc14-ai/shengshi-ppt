import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  user?: {
    id: string;
    phone: string;
    nickname: string;
    credits: number;
    plan_type: string;
  };
  isLoggedIn?: boolean;
}

export const sessionOptions = {
  password: process.env.SESSION_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'dev_only_password_change_in_production'),
  cookieName: 'shengxin_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
