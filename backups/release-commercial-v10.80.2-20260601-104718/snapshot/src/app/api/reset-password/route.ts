import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientIP, rateLimit } from '@/lib/rate-limit';
import { hashPasswordSecure } from '@/lib/password-utils';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// 发送重置验证码
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed } = rateLimit(`reset:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 5 });
  if (!allowed) return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  try {
    const { action, phone, code, newPassword } = await request.json();

    if (action === 'send_reset_code') {
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        return NextResponse.json({ error: '请输入正确的手机号' }, { status: 400 });
      }

      // 检查手机号是否已注册
      const { data: users } = await sb.from('users').select('id').eq('phone', phone).limit(1);
      if (!users || users.length === 0) {
        return NextResponse.json({ error: '该手机号未注册，请先注册' }, { status: 400 });
      }

      // 检查限流
      const { allowed: smsAllowed, retryAfter } = await checkResetRateLimit(ip, phone);
      if (!smsAllowed) {
        return NextResponse.json({ error: '发送过于频繁', retryAfter }, { status: 429 });
      }

      // 生成验证码（6位）
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // 存储验证码
      await sb.from('verification_codes').upsert({
        phone,
        code,
        type: 'reset_password',
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      });

      // 短信发送（与登录注册保持一致）
      try {
        const { sendSMS } = await import('@/lib/sms-client');
        const result = await sendSMS(phone, code);
        if (!result.success && process.env.NODE_ENV === 'production') {
          return NextResponse.json({ error: '短信发送失败，请稍后重试' }, { status: 500 });
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json({ error: '短信发送失败，请稍后重试' }, { status: 500 });
        }
        console.warn('[ResetPassword] 短信发送失败，开发模式降级:', e);
      }

      // 在开发环境直接返回验证码方便测试
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({ 
          success: true, 
          message: '验证码已发送（开发模式：验证码将打印在控制台）',
          devCode: code // 仅开发环境
        });
      }

      return NextResponse.json({ success: true, message: '验证码已发送' });
    }

    if (action === 'reset_password') {
      if (!phone || !code || !newPassword) {
        return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
      }

      if (newPassword.length < 8) {
        return NextResponse.json({ error: '密码至少8位' }, { status: 400 });
      }
      if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
        return NextResponse.json({ error: '密码需包含字母和数字' }, { status: 400 });
      }

      // 验证验证码
      const { data: codeRecord } = await sb
        .from('verification_codes')
        .select('*')
        .eq('phone', phone)
        .eq('type', 'reset_password')
        .single();

      if (!codeRecord) {
        return NextResponse.json({ error: '请先获取验证码' }, { status: 400 });
      }

      if (codeRecord.code !== code) {
        return NextResponse.json({ error: '验证码错误' }, { status: 400 });
      }

      if (new Date(codeRecord.expires_at) < new Date()) {
        return NextResponse.json({ error: '验证码已过期，请重新获取' }, { status: 400 });
      }

      // 更新密码（写入 password_hash）
      const hashedPwd = hashPasswordSecure(newPassword);
      const { error: updateErr } = await sb.from('users').update({ password_hash: hashedPwd }).eq('phone', phone);
      if (updateErr) {
        console.error('[ResetPassword] 更新密码失败:', updateErr.message);
        return NextResponse.json({ error: '密码重置失败，请稍后重试' }, { status: 500 });
      }

      // 删除验证码
      await sb.from('verification_codes').delete().eq('phone', phone).eq('type', 'reset_password');

      return NextResponse.json({ success: true, message: '密码重置成功，请使用新密码登录' });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '服务异常';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function checkResetRateLimit(ip: string, phone: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const sb = getSupabase();
  if (!sb) return { allowed: true };

  // 每小时每个IP最多5次
  const { allowed: ipAllowed, resetAt: ipReset } = rateLimit(`reset_ip:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 5 });
  if (!ipAllowed) return { allowed: false, retryAfter: Math.ceil((ipReset - Date.now()) / 1000) };

  // 每小时每个手机号最多3次
  const { allowed: phoneAllowed, resetAt: phoneReset } = rateLimit(`reset_phone:${phone}`, { windowMs: 60 * 60 * 1000, maxRequests: 3 });
  if (!phoneAllowed) return { allowed: false, retryAfter: Math.ceil((phoneReset - Date.now()) / 1000) };

  return { allowed: true };
}
