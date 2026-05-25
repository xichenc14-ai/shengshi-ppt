import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  user?: {
    id: string;
    phone: string;
    nickname: string;
    avatar?: string;
    credits: number;
    plan_type: string;
    plan_expires_at?: string | null;
    is_admin?: boolean;
  };
  isLoggedIn?: boolean;
}

function resolveSessionPassword(): string {
  const pwd = process.env.SESSION_PASSWORD || '';
  if (process.env.NODE_ENV === 'production' && (!pwd || pwd.length < 32)) {
    throw new Error('SESSION_PASSWORD 未配置或长度不足（生产环境至少32字符）');
  }
  return pwd || 'dev_only_password_change_in_production';
}

export const sessionOptions = {
  password: resolveSessionPassword(),
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
