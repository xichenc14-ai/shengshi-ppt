export const runtime = 'nodejs';
export const preferredRegion = 'hnd1';
export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { distributedRateLimit, getClientIP, releaseRateLimitReservation } from '@/lib/rate-limit';
import { hashPasswordSecure } from '@/lib/password-utils';
import { getRequestId } from '@/lib/observability';
import { createSMSAttempt, recordSMSAttempt } from '@/lib/sms-attempts';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// 发送重置验证码
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const requestId = getRequestId(request);
  const { allowed } = await distributedRateLimit(`reset:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 5 });
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

      const localCode = String(randomInt(100000, 1000000));
      const { getStorableSMSCode, sendSMS } = await import('@/lib/sms-client');
      const finalCode = getStorableSMSCode({ success: true, code: localCode }, localCode, phone);
      const smsAttempt = createSMSAttempt(phone, 'reset_password', requestId);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      // 先保存挑战记录，避免供应商已受理但应用超时后用户收到无法验证的验证码。
      await sb.from('verification_codes').delete().eq('phone', phone).eq('type', 'reset_password');
      const { error: insertErr } = await sb.from('verification_codes').insert({
        phone,
        code: finalCode,
        type: 'reset_password',
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      });
      if (insertErr) {
        console.error('[ResetPassword] 验证码写入失败:', insertErr.message);
        await rollbackResetRateLimit(ip, phone);
        return NextResponse.json({ error: '验证码服务暂时不可用，请稍后重试' }, { status: 503 });
      }

      await recordSMSAttempt(sb, smsAttempt, { state: 'pending' });

      const deletePendingCode = async () => {
        await sb.from('verification_codes').delete().eq('phone', phone).eq('code', finalCode).eq('type', 'reset_password');
      };

      // 短信发送（与登录注册保持一致）
      try {
        const result = await sendSMS(phone, localCode, { outId: smsAttempt.outId });
        if (!result.success && process.env.NODE_ENV === 'production') {
          if (Number(result.retryAfter) > 0) {
            await recordSMSAttempt(sb, smsAttempt, { state: 'failed', errorCode: result.errorCode });
            await deletePendingCode();
            await rollbackResetRateLimit(ip, phone);
            return NextResponse.json(
              { error: '请60秒后再试', retryAfter: Math.ceil(Number(result.retryAfter)) },
              { status: 429 }
            );
          }
          if (result.errorCode === 'PROVIDER_TRANSPORT_ERROR') {
            await recordSMSAttempt(sb, smsAttempt, { state: 'unknown', errorCode: result.errorCode });
            return NextResponse.json({
              success: true,
              deliveryState: 'unknown',
              retryAfter: 60,
              message: '短信提交状态暂未确认，请查看手机；如已收到验证码可直接使用，请勿重复发送。',
            }, { status: 202 });
          }
          await recordSMSAttempt(sb, smsAttempt, { state: 'failed', errorCode: result.errorCode });
          await deletePendingCode();
          await rollbackResetRateLimit(ip, phone);
          return NextResponse.json({ error: '短信发送失败，请稍后重试' }, { status: 500 });
        }
        if (!result.success) {
          await recordSMSAttempt(sb, smsAttempt, { state: 'failed', errorCode: result.errorCode });
          console.warn('[ResetPassword] 短信发送失败，开发模式降级:', result.error);
        } else {
          await recordSMSAttempt(sb, smsAttempt, {
            state: 'accepted',
            providerRequestId: result.providerRequestId,
            providerMessageId: result.messageId,
          });
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'production') {
          await recordSMSAttempt(sb, smsAttempt, { state: 'unknown', errorCode: 'CLIENT_EXCEPTION' });
          return NextResponse.json({
            success: true,
            deliveryState: 'unknown',
            retryAfter: 60,
            message: '短信提交状态暂未确认，请查看手机；如已收到验证码可直接使用，请勿重复发送。',
          }, { status: 202 });
        }
        console.warn('[ResetPassword] 短信发送失败，开发模式降级:', e);
      }

      // 在开发环境直接返回验证码方便测试
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({ 
          success: true, 
          message: '验证码已发送（开发模式：验证码将打印在控制台）',
          devCode: localCode // 仅开发环境
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
        .order('created_at', { ascending: false })
        .limit(1);

      const latestCodeRecord = Array.isArray(codeRecord) ? codeRecord[0] : null;
      if (!latestCodeRecord) {
        return NextResponse.json({ error: '请先获取验证码' }, { status: 400 });
      }

      if (new Date(latestCodeRecord.expires_at) < new Date()) {
        return NextResponse.json({ error: '验证码已过期，请重新获取' }, { status: 400 });
      }

      const { verifyStoredSMSCode } = await import('@/lib/sms-client');
      const verifyResult = await verifyStoredSMSCode(phone, latestCodeRecord.code, code);
      if (!verifyResult.valid) {
        return NextResponse.json({ error: verifyResult.error || '验证码错误' }, { status: 400 });
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
  const { allowed: ipAllowed, resetAt: ipReset } = await distributedRateLimit(`reset_ip:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 5 });
  if (!ipAllowed) return { allowed: false, retryAfter: Math.ceil((ipReset - Date.now()) / 1000) };

  // 每小时每个手机号最多3次
  const { allowed: phoneAllowed, resetAt: phoneReset } = await distributedRateLimit(`reset_phone:${phone}`, { windowMs: 60 * 60 * 1000, maxRequests: 3 });
  if (!phoneAllowed) {
    await releaseRateLimitReservation(`reset_ip:${ip}`);
    return { allowed: false, retryAfter: Math.ceil((phoneReset - Date.now()) / 1000) };
  }

  return { allowed: true };
}

async function rollbackResetRateLimit(ip: string, phone: string): Promise<void> {
  await Promise.all([
    releaseRateLimitReservation(`reset_ip:${ip}`),
    releaseRateLimitReservation(`reset_phone:${phone}`),
  ]);
}
