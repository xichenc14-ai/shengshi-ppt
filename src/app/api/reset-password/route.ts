import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientIP, rateLimit } from '@/lib/rate-limit';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function hashPassword(password: string): string {
  const { createHash } = require('crypto');
  return createHash('sha256').update(password + '_sxPPT_salt_2026').digest('hex');
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

      // TODO: 调用短信接口发送验证码
      // 这里先用日志输出，实际使用时替换为真实短信发送
      console.log(`[重置密码验证码] 手机号: ${phone}, 验证码: ${code}`);

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

      if (newPassword.length < 6) {
        return NextResponse.json({ error: '密码至少6位' }, { status: 400 });
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

      // 更新密码
      const hashedPwd = hashPassword(newPassword);
      // 🚨 修复：更新 password_hash 而非 password
      await sb.from('users').update({ password_hash: hashedPwd }).eq('phone', phone);

      // 删除验证码
      await sb.from('verification_codes').delete().eq('phone', phone).eq('type', 'reset_password');

      return NextResponse.json({ success: true, message: '密码重置成功，请使用新密码登录' });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
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
