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

// ===== 安全检查：确保 SESSION_PASSWORD 已配置且足够强 =====
// 使用延迟验证，避免构建时检查（构建时 NODE_ENV 可能是 production）
let sessionPassword: string | null = null;
let passwordValidated = false;

function getSessionPassword(): string {
  if (passwordValidated && sessionPassword) {
    return sessionPassword;
  }

  const password = process.env.SESSION_PASSWORD;
  
  // 生产环境强制要求
  if (process.env.NODE_ENV === 'production') {
    if (!password || password.trim() === '') {
      throw new Error(
        '[FATAL] SESSION_PASSWORD environment variable is required in production. ' +
        'Generate a secure password with: openssl rand -base64 32'
      );
    }
    if (password.length < 32) {
      throw new Error(
        '[FATAL] SESSION_PASSWORD must be at least 32 characters long for security. ' +
        'Current length: ' + password.length + '. ' +
        'Generate a secure password with: openssl rand -base64 32'
      );
    }
    // 检查是否使用默认密码
    const defaultPasswords = ['dev_only_password_change_in_production', 'password', 'secret', 'changeme'];
    if (defaultPasswords.includes(password)) {
      throw new Error(
        '[FATAL] SESSION_PASSWORD cannot be a default/weak password in production. ' +
        'Generate a secure password with: openssl rand -base64 32'
      );
    }
    sessionPassword = password;
  } else {
    // 开发模式：允许默认密码但给出警告
    if (!password || password.trim() === '') {
      console.warn('[Session] SESSION_PASSWORD not set, using development default. DO NOT use in production!');
      sessionPassword = 'dev_only_password_change_in_production';
    } else {
      if (password.length < 32) {
        console.warn('[Session] SESSION_PASSWORD is shorter than 32 characters. Use a longer password in production.');
      }
      sessionPassword = password;
    }
  }
  
  passwordValidated = true;
  return sessionPassword;
}

// 延迟获取 session options，避免构建时验证
function getSessionOptions() {
  return {
    password: getSessionPassword(),
    cookieName: 'shengxin_session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  const options = getSessionOptions();
  return getIronSession<SessionData>(cookieStore, options);
}