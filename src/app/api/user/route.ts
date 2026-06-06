export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkSMSRateLimit,
  checkRegisterRateLimit,
  checkVerifyAttempts,
  getClientIP,
  isDevCleanupAllowed,
  isIPBlocked,
  rateLimit,
} from '@/lib/rate-limit';
import type { DeductCreditsResult, TypedSupabaseClient } from '@/lib/supabase-types';
import { hashPasswordSecure, isLegacyHash, verifyPassword } from '@/lib/password-utils';
import { issueAuthProof } from '@/lib/auth-proof';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

type UserLite = {
  id: string;
  phone: string;
  nickname: string | null;
  credits: number;
  plan_type: string | null;
  is_active?: boolean | null;
  password_hash?: string | null;
};

type VerifyCodeRow = {
  id: string;
  code: string;
  expires_at: string;
};

// ==================== GET: 检查手机号是否注册 ====================
export async function GET(req: NextRequest) {
  const ip = getClientIP(req);
  if (isIPBlocked(ip)) {
    return NextResponse.json({ error: '请求受限' }, { status: 403 });
  }

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  // ===== 清理测试数据（仅开发/调试用，仅允许localhost） =====
  if (action === 'cleanup_test') {
    if (!isDevCleanupAllowed(req)) {
      return NextResponse.json({ error: '该接口仅限开发环境使用' }, { status: 403 });
    }
    const phone = searchParams.get('phone');
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: '请提供正确手机号' }, { status: 400 });
    }
    
    // 删除用户
    await sb.from('users').delete().eq('phone', phone);
    // 删除验证码
    await sb.from('verification_codes').delete().eq('phone', phone);
    
    return NextResponse.json({ success: true, message: '已清理该手机号的所有数据' });
  }

  // ===== 创建/重置测试账户 =====
  if (action === 'create_test_user') {
    // 生产环境禁用调试token
    const DEBUG_TOKEN = process.env.DEBUG_TOKEN ?? null;
    const isDebugEnabled = DEBUG_TOKEN && process.env.NODE_ENV !== 'production';
    if (!isDebugEnabled) {
      return NextResponse.json({ error: '该接口仅限开发环境使用' }, { status: 403 });
    }
    const token = searchParams.get('token');
    if (token !== DEBUG_TOKEN && !isDevCleanupAllowed(req)) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }
    const phone = searchParams.get('phone') || '13800138001';
    const password = searchParams.get('password') || '123456';
    const planType = searchParams.get('plan') || 'vip';
    const nickname = searchParams.get('nickname') || (phone === '13800138001' ? 'xichen' : '测试用户');
    const pwdHash = hashPasswordSecure(password);
    const sb = getSupabase();
    if (!sb) return NextResponse.json({ error: '数据库未配置' }, { status: 500 });

    // 查找现有用户
    const { data: existing } = await sb.from('users').select('id').eq('phone', phone).limit(1);
    if (existing && existing.length > 0) {
      // 更新现有用户
      const updateData: Record<string, unknown> = { credits: 99999, plan_type: planType, is_active: true };
      const { error: updateErr } = await sb.from('users').update(updateData).eq('id', existing[0].id);
      if (updateErr) {
        return NextResponse.json({ error: '更新失败: ' + updateErr.message }, { status: 500 });
      }
      // 尝试设置密码（如果列存在）
      try {
        await sb.from('users').update({ password_hash: pwdHash }).eq('id', existing[0].id);
      } catch {
        console.warn('[create_test_user] password_hash列不存在，跳过');
      }
    } else {
      // 创建新用户
      const insertData: Record<string, unknown> = { phone, nickname, credits: 99999, plan_type: planType, is_active: true };
      const { error: insErr } = await sb.from('users').insert(insertData);
      if (insErr) {
        return NextResponse.json({ error: '创建失败: ' + insErr.message }, { status: 500 });
      }
    }
    return NextResponse.json({ success: true, phone, password, plan_type: planType, credits: 99999 });
  }

  // ===== 检查手机号是否已注册 =====
  if (action === 'check_phone') {
    const phone = searchParams.get('phone');
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: '请输入正确的手机号' }, { status: 400 });
    }
    const { data: users } = await sb.from('users').select('id, phone, nickname').eq('phone', phone).limit(1);
    if (users && users.length > 0) {
      return NextResponse.json({ registered: true, nickname: users[0].nickname || '用户' });
    }
    return NextResponse.json({ registered: false });
  }

  return NextResponse.json({ user: null, credits: 0, message: '未登录' });
}

// ==================== POST: 多动作路由 ====================
export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (isIPBlocked(ip)) {
    return NextResponse.json({ error: '请求受限' }, { status: 403 });
  }

  // 基础API限流
  const { allowed: apiAllowed } = rateLimit(`api_user:${ip}`, { windowMs: 60 * 1000, maxRequests: 15 });
  if (!apiAllowed) {
    return NextResponse.json({ error: '操作过于频繁，请稍后再试' }, { status: 429 });
  }

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  try {
    const body = await req.json();
    const { action } = body;

    // ===== 发送验证码 =====
    if (action === 'send_code') {
      const { phone } = body;
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        return NextResponse.json({ error: '请输入正确的手机号' }, { status: 400 });
      }

      // 🔒 短信频率限制（IP + 手机号双重限制）
      const smsCheck = await checkSMSRateLimit(ip, phone);
      if (!smsCheck.allowed) {
        return NextResponse.json(
          { error: smsCheck.reason, retryAfter: smsCheck.retryAfter },
          { status: 429 }
        );
      }

      // 清理过期验证码
      await sb.from('verification_codes').delete().eq('phone', phone).lt('expires_at', new Date().toISOString());

      // 调用短信服务
      let finalCode = '';
      try {
        const { sendSMS } = await import('@/lib/sms-client');
        const result = await sendSMS(phone);
        if (!result.success) {
          if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: '短信发送失败，请稍后重试' }, { status: 500 });
          }
          finalCode = genCode();
        } else {
          finalCode = result.code || genCode();
        }
      } catch (e) {
        console.error('[SMS] 模块异常:', e);
        finalCode = genCode();
      }

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await sb.from('verification_codes').insert({ phone, code: finalCode, expires_at: expiresAt });

      return NextResponse.json({ success: true, code: finalCode, message: '验证码已发送' });
    }

    // ===== 验证验证码（内部复用） =====
    async function verifyCode(phone: string, code: string, markVerified: boolean = true): Promise<{ valid: boolean; error?: string; recordId?: string }> {
      if (!sb) return { valid: false, error: '服务未配置' };
      const { data: records, error: qErr } = await sb
        .from('verification_codes')
        .select('id,code,expires_at,verified')
        .eq('phone', phone)
        .eq('code', code)
        .gt('expires_at', new Date().toISOString())
        .eq('verified', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (qErr) return { valid: false, error: '验证失败' };
      if (!records || records.length === 0) return { valid: false, error: '验证码错误或已过期' };

      if (markVerified) {
        await sb.from('verification_codes').update({ verified: true }).eq('id', records[0].id);
      }
      return { valid: true, recordId: records[0].id };
    }

    // ===== 注册 =====
    if (action === 'register') {
      const { phone, username, password } = body;
      if (!phone || !username || !password) {
        return NextResponse.json({ error: '请填写完整信息' }, { status: 400 });
      }
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        return NextResponse.json({ error: '手机号格式不正确' }, { status: 400 });
      }
      if (username.trim().length < 2 || username.trim().length > 20) {
        return NextResponse.json({ error: '用户名需要2-20个字符' }, { status: 400 });
      }
      if (password.length < 8) {
        return NextResponse.json({ error: '密码至少8位' }, { status: 400 });
      }
      if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        return NextResponse.json({ error: '密码需包含字母和数字' }, { status: 400 });
      }
      // 用户名安全检查：防止特殊字符和XSS
      if (/[<>"'&]/.test(username)) {
        return NextResponse.json({ error: '用户名包含非法字符' }, { status: 400 });
      }

      // 🔒 注册频率限制
      const regCheck = await checkRegisterRateLimit(ip, phone);
      if (!regCheck.allowed) {
        return NextResponse.json({ error: regCheck.reason }, { status: 429 });
      }

      // 检查验证码是否已验证
      const { data: verifiedRecords } = await sb
        .from('verification_codes')
        .select('id')
        .eq('phone', phone)
        .eq('verified', true)
        .gt('expires_at', new Date().toISOString())
        .limit(1);

      if (!verifiedRecords || verifiedRecords.length === 0) {
        return NextResponse.json({ error: '请先验证手机号' }, { status: 400 });
      }

      // 检查手机号是否已注册
      const { data: existing } = await sb.from('users').select('id,phone,nickname,credits,plan_type,password_hash').eq('phone', phone).limit(1);
      if (existing && existing.length > 0) {
        const existingUser = existing[0] as Partial<UserLite>;
        if (existingUser.password_hash) {
          return NextResponse.json({ error: '该手机号已注册，请直接登录' }, { status: 409 });
        }
        // 兼容老账号：已完成短信验证但未设置用户名/密码 → 强制补全后登录
        const nextPwdHash = hashPasswordSecure(password);
        const { data: patched, error: patchErr } = await sb
          .from('users')
          .update({
            nickname: username.trim(),
            password_hash: nextPwdHash,
            last_login_at: new Date().toISOString(),
          })
          .eq('id', existingUser.id)
          .select('id,phone,nickname,credits,plan_type')
          .single();
        if (patchErr || !patched) {
          return NextResponse.json({ error: '补全账号失败，请稍后重试' }, { status: 500 });
        }
        return NextResponse.json({
          user: {
            id: patched.id,
            phone: patched.phone,
            nickname: patched.nickname || username.trim(),
            credits: patched.credits ?? 0,
            plan_type: patched.plan_type || 'free',
            has_subscription: patched.plan_type !== 'free',
            is_new: false,
          },
          authToken: issueAuthProof(patched.id),
        });
      }

      // 检查用户名是否已存在
      try {
        const { data: nameExists } = await sb.from('users').select('id').eq('username', username.trim()).limit(1);
        if (nameExists && nameExists.length > 0) {
          return NextResponse.json({ error: '该用户名已被使用' }, { status: 409 });
        }
      } catch {
        console.warn('[Register] username 列不存在，跳过用户名检查');
      }

      const pwdHash = hashPasswordSecure(password);
      const insertData: Record<string, unknown> = {
        phone,
        nickname: username.trim(),
        credits: 50,
        plan_type: 'free',
        is_active: true,
      };
      
      const { data: newUser, error: insErr } = await sb
        .from('users')
        .insert({ ...insertData, password_hash: pwdHash })
        .select()
        .single();

      if (insErr) {
        console.error('[Register] Insert error:', JSON.stringify(insErr));
        
        if (String(insErr.message || insErr).includes('password_hash')) {
          console.error('[Register] password_hash 列缺失，拒绝创建无密码账户');
          return NextResponse.json({ error: '账号系统正在升级，请稍后重试' }, { status: 503 });
        }
        
        return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
      }

      try {
        await sb.from('credit_transactions').insert({
          user_id: newUser.id, amount: 50, balance_after: 50,
          type: 'signup_gift', description: '注册赠送50积分',
        });
      } catch (e) { console.warn('[Register] 积分记录失败:', e); }

      return NextResponse.json({
        user: { id: newUser.id, phone: newUser.phone, nickname: newUser.nickname || username.trim(), credits: 50, plan_type: newUser.plan_type || 'free', is_new: true },
        authToken: issueAuthProof(newUser.id),
      });
      
    }

    // ===== 验证码登录 =====
    if (action === 'verify_code') {
      const { phone, code } = body;
      if (!phone || !code) return NextResponse.json({ error: '参数错误' }, { status: 400 });

      // 🔒 验证码尝试次数限制
      const attemptCheck = checkVerifyAttempts(phone);
      if (!attemptCheck.allowed) {
        return NextResponse.json({ error: attemptCheck.reason, attemptsLeft: 0 }, { status: 429 });
      }

      const vResult = await verifyCode(phone, code, true);
      if (!vResult.valid) {
        return NextResponse.json({ error: vResult.error, attemptsLeft: attemptCheck.attemptsLeft }, { status: 400 });
      }

      const { data: users } = await sb.from('users').select('id,phone,nickname,credits,plan_type,is_active,password_hash').eq('phone', phone);
      if (users && users.length > 0) {
        const u = users[0] as UserLite;
        if (!u.password_hash) {
          return NextResponse.json({
            error: 'NEED_SET_PASSWORD',
            needSetPassword: true,
            phone: u.phone,
            nickname: u.nickname || '',
          }, { status: 400 });
        }
        try {
          await sb.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', u.id);
        } catch (e) { console.warn('[Login] 更新登录时间失败:', e); }
        return NextResponse.json({
          user: { id: u.id, phone: u.phone, nickname: u.nickname || '用户', credits: u.credits, plan_type: u.plan_type, has_subscription: u.plan_type !== 'free', is_new: false },
          authToken: issueAuthProof(u.id),
        });
      }

      return NextResponse.json({ error: 'NOT_REGISTERED', needRegister: true, codeValid: true }, { status: 404 });
    }

    // ===== 账号密码登录 =====
    if (action === 'password_login') {
      const { account, password } = body;
      if (!account || !password) return NextResponse.json({ error: '请输入账号和密码' }, { status: 400 });
      if (password.length < 8) return NextResponse.json({ error: '密码格式不正确' }, { status: 400 });

      // 🔒 密码登录频率限制（每IP每分钟最多5次）
      const pwLimit = rateLimit(`pw_login:${ip}`, { windowMs: 60 * 1000, maxRequests: 5 });
      if (!pwLimit.allowed) {
        return NextResponse.json({ error: '登录尝试过于频繁，请稍后再试' }, { status: 429 });
      }

      const isPhone = /^1[3-9]\d{9}$/.test(account);
      // 先查询基本用户信息（password_hash列可能不存在，单独查询）
      let users: UserLite[];
      let qErr: { message?: string } | null;
      if (isPhone) {
        const r = await sb.from('users').select('id,phone,nickname,credits,plan_type,is_active').eq('phone', account).limit(1);
        users = r.data || []; qErr = r.error;
      } else {
        const r = await sb.from('users').select('id,phone,nickname,credits,plan_type,is_active').ilike('nickname', account).limit(1);
        users = r.data || []; qErr = r.error;
      }
      if (qErr) {
        console.error('[Login] DB query error:', qErr);
        return NextResponse.json({ error: '账号不存在' }, { status: 404 });
      }
      if (!users || users.length === 0) {
        return NextResponse.json({ error: '账号不存在' }, { status: 404 });
      }

      const u = users[0];

      // 单独查询password_hash（可能不存在）
      let pwdHashFromDB: string | null = null;
      try {
        const pwdR = await sb.from('users').select('password_hash').eq('id', u.id).limit(1);
        pwdHashFromDB = pwdR.data?.[0]?.password_hash || null;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'unknown';
        console.warn('[Login] password_hash列不存在:', message);
      }

      if (!pwdHashFromDB) {
        return NextResponse.json({ error: 'NEED_SET_PASSWORD', needSetPassword: true, phone: u.phone }, { status: 400 });
      }

      const passwordOk = verifyPassword(password, pwdHashFromDB);
      if (!passwordOk) {
        return NextResponse.json({ error: '密码错误' }, { status: 401 });
      }

      // 老用户在首次成功登录时升级到更安全哈希
      if (isLegacyHash(pwdHashFromDB)) {
        try {
          await sb.from('users').update({ password_hash: hashPasswordSecure(password) }).eq('id', u.id);
        } catch (e) {
          console.warn('[Login] 密码哈希升级失败:', e);
        }
      }

      await sb.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', u.id);
      return NextResponse.json({
        user: { id: u.id, phone: u.phone, nickname: u.nickname || '用户', credits: u.credits, plan_type: u.plan_type, has_subscription: u.plan_type !== 'free', is_new: false },
        authToken: issueAuthProof(u.id),
      });
    }

    // ===== 更新用户资料 =====
    if (action === 'update_profile') {
      const { userId, nickname, avatar } = body;
      if (!userId) return NextResponse.json({ error: '参数错误' }, { status: 400 });
      const nextName = typeof nickname === 'string' ? nickname.trim() : '';
      const nextAvatar = typeof avatar === 'string' ? avatar.trim().slice(0, 512) : '';
      if (nextName && (nextName.length < 2 || nextName.length > 20)) {
        return NextResponse.json({ error: '用户名需要2-20个字符' }, { status: 400 });
      }
      if (nextName && /[<>"'&]/.test(nextName)) {
        return NextResponse.json({ error: '用户名包含非法字符' }, { status: 400 });
      }

      const updates: Record<string, unknown> = { last_login_at: new Date().toISOString() };
      if (nextName) updates.nickname = nextName;
      if (nextAvatar) updates.avatar_url = nextAvatar;

      let updated: UserLite | null = null;
      let updErr: { message?: string } | null = null;
      ({ data: updated, error: updErr } = await sb.from('users').update(updates).eq('id', userId).select('id,phone,nickname,credits,plan_type').single());
      if (updErr && nextAvatar && String(updErr.message || '').includes('avatar_url')) {
        const fallbackUpdates = { ...updates };
        delete fallbackUpdates.avatar_url;
        ({ data: updated, error: updErr } = await sb.from('users').update(fallbackUpdates).eq('id', userId).select('id,phone,nickname,credits,plan_type').single());
      }
      if (updErr || !updated) return NextResponse.json({ error: '更新失败' }, { status: 500 });
      return NextResponse.json({ user: { ...updated, avatar: nextAvatar || null } });
    }

    // ===== 修改密码（登录后） =====
    if (action === 'change_password') {
      const { userId, oldPassword, newPassword } = body;
      if (!userId || !oldPassword || !newPassword) {
        return NextResponse.json({ error: '参数不完整' }, { status: 400 });
      }
      if (newPassword.length < 8) return NextResponse.json({ error: '新密码至少8位' }, { status: 400 });
      if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
        return NextResponse.json({ error: '新密码需包含字母和数字' }, { status: 400 });
      }

      const { data: userRows, error: userErr } = await sb.from('users').select('id,password_hash').eq('id', userId).limit(1);
      if (userErr || !userRows || userRows.length === 0) {
        return NextResponse.json({ error: '用户不存在' }, { status: 404 });
      }
      const userRow = userRows[0] as { id: string; password_hash?: string | null };
      const currentHash = userRow.password_hash || '';
      if (!currentHash || !verifyPassword(oldPassword, currentHash)) {
        return NextResponse.json({ error: '当前密码不正确' }, { status: 400 });
      }

      const nextHash = hashPasswordSecure(newPassword);
      const { error: setErr } = await sb.from('users').update({
        password_hash: nextHash,
        last_login_at: new Date().toISOString(),
      }).eq('id', userId);
      if (setErr) return NextResponse.json({ error: '密码修改失败' }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // ===== 发送更换手机号验证码（发到新手机号） =====
    if (action === 'send_change_phone_code') {
      const { userId, newPhone } = body;
      if (!userId || !newPhone) return NextResponse.json({ error: '参数错误' }, { status: 400 });
      if (!/^1[3-9]\d{9}$/.test(newPhone)) {
        return NextResponse.json({ error: '新手机号格式不正确' }, { status: 400 });
      }

      const smsCheck = await checkSMSRateLimit(ip, newPhone);
      if (!smsCheck.allowed) {
        return NextResponse.json(
          { error: smsCheck.reason, retryAfter: smsCheck.retryAfter },
          { status: 429 }
        );
      }

      const { data: exists } = await sb.from('users').select('id').eq('phone', newPhone).limit(1);
      if (exists && exists.length > 0) {
        return NextResponse.json({ error: '该手机号已被绑定' }, { status: 409 });
      }

      const code = genCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const insertPayload: Record<string, unknown> = {
        phone: newPhone,
        code,
        expires_at: expiresAt,
        type: 'change_phone',
      };
      let insertErr: { message?: string } | null = null;
      ({ error: insertErr } = await sb.from('verification_codes').insert(insertPayload));
      if (insertErr && String(insertErr.message || '').includes('type')) {
        const fallbackPayload = { ...insertPayload };
        delete fallbackPayload.type;
        ({ error: insertErr } = await sb.from('verification_codes').insert(fallbackPayload));
      }
      if (insertErr) return NextResponse.json({ error: '验证码写入失败' }, { status: 500 });

      try {
        const { sendSMS } = await import('@/lib/sms-client');
        const result = await sendSMS(newPhone, code);
        if (!result.success && process.env.NODE_ENV === 'production') {
          return NextResponse.json({ error: '验证码发送失败，请稍后重试' }, { status: 500 });
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json({ error: '验证码发送失败，请稍后重试' }, { status: 500 });
        }
        console.warn('[ChangePhone] 发送验证码降级:', e);
      }

      return NextResponse.json({
        success: true,
        message: '验证码已发送',
        devCode: process.env.NODE_ENV === 'production' ? undefined : code,
      });
    }

    // ===== 更换绑定手机号 =====
    if (action === 'change_phone') {
      const { userId, newPhone, code } = body;
      if (!userId || !newPhone || !code) return NextResponse.json({ error: '参数错误' }, { status: 400 });
      if (!/^1[3-9]\d{9}$/.test(newPhone)) {
        return NextResponse.json({ error: '新手机号格式不正确' }, { status: 400 });
      }

      let codeRows: VerifyCodeRow[] | null = null;
      let codeErr: { message?: string } | null = null;
      ({ data: codeRows, error: codeErr } = await sb
        .from('verification_codes')
        .select('id,code,expires_at')
        .eq('phone', newPhone)
        .eq('type', 'change_phone')
        .order('created_at', { ascending: false })
        .limit(1));
      if (codeErr && String(codeErr.message || '').includes('type')) {
        ({ data: codeRows, error: codeErr } = await sb
          .from('verification_codes')
          .select('id,code,expires_at')
          .eq('phone', newPhone)
          .order('created_at', { ascending: false })
          .limit(1));
      }
      if (codeErr || !codeRows || codeRows.length === 0) {
        return NextResponse.json({ error: '请先获取验证码' }, { status: 400 });
      }
      const record = codeRows[0];
      if (record.code !== code) return NextResponse.json({ error: '验证码错误' }, { status: 400 });
      if (new Date(record.expires_at) < new Date()) return NextResponse.json({ error: '验证码已过期' }, { status: 400 });

      const { data: exists } = await sb.from('users').select('id').eq('phone', newPhone).neq('id', userId).limit(1);
      if (exists && exists.length > 0) {
        return NextResponse.json({ error: '该手机号已被绑定' }, { status: 409 });
      }

      const { data: updated, error: updErr } = await sb
        .from('users')
        .update({ phone: newPhone, last_login_at: new Date().toISOString() })
        .eq('id', userId)
        .select('id,phone,nickname,credits,plan_type')
        .single();
      if (updErr || !updated) {
        return NextResponse.json({ error: '手机号更新失败' }, { status: 500 });
      }
      await sb.from('verification_codes').delete().eq('id', record.id);
      return NextResponse.json({ user: updated });
    }

    // ===== 扣积分 =====
    if (action === 'deduct') {
      const { userId, numPages = 10, imageSource = 'themeAccent', imageModel, estimatedImages = 0 } = body;
      if (!userId) return NextResponse.json({ error: '参数错误' }, { status: 400 });

      const BASE_CREDIT_PER_PAGE = 4;
      let totalCredit = numPages * BASE_CREDIT_PER_PAGE;

      let imageCreditsPerImage = 0;
      if (imageSource === 'aiGenerated') {
        // AI图片：按双生成成本计费，普通4积分/图，高级20积分/图
        const HIGH_MODELS = ['imagen-3-pro', 'flux-1-pro', 'ideogram-v3-turbo', 'luma-photon-1', 'leonardo-phoenix', 'flux-kontext-pro', 'imagen-4-pro', 'ideogram-v3', 'gemini-2.5-flash-image'];
        if (imageModel && HIGH_MODELS.includes(imageModel)) {
          imageCreditsPerImage = 20; // 高级AI图（双生成成本）
        } else {
          imageCreditsPerImage = 4; // 普通AI图（双生成成本）
        }
      }

      // 预估图片数：向上取整，确保扣多不扣少
      const estimatedImageCount = estimatedImages > 0 ? estimatedImages : Math.ceil(numPages / 2);
      totalCredit += estimatedImageCount * imageCreditsPerImage;

      if (body.estimate) {
        return NextResponse.json({
          estimate: true,
          baseCredits: numPages * BASE_CREDIT_PER_PAGE,
          imageCredits: estimatedImageCount * imageCreditsPerImage,
          imageCreditsPerImage,
          estimatedImages: estimatedImageCount,
          totalCredits: totalCredit,
          imageSource,
          imageModel,
        });
      }

      let newBalance: number | null = null;
      let useFallback = false;
      try {
        const typedSb = sb as unknown as TypedSupabaseClient;
        const rpc = typedSb.rpc as unknown as (
          fn: string,
          args?: Record<string, unknown>
        ) => Promise<{ data: unknown; error: { message?: string } | null }>;
        const { data: rpcResult, error: rpcErr } = await rpc('deduct_credits_atomic', {
          p_user_id: userId,
          p_amount: totalCredit,
          p_description: `生成PPT-${numPages}页-${imageSource}${imageCreditsPerImage > 0 ? `-${imageCreditsPerImage}积分/图×${estimatedImageCount}张` : ''}-共${totalCredit}积分`,
        });
        if (rpcErr) {
          useFallback = true;
        } else {
          newBalance = (rpcResult as DeductCreditsResult)?.new_balance ?? null;
        }
      } catch { useFallback = true; }

      if (useFallback) {
        const { data: updatedRows, error: fbErr } = await sb.from('users').select('credits').eq('id', userId).single();
        if (fbErr || !updatedRows) return NextResponse.json({ error: '积分扣除失败' }, { status: 500 });
        if (updatedRows.credits < totalCredit) {
          return NextResponse.json({ error: '积分不足', needed: totalCredit, balance: updatedRows.credits });
        }
        const newBal = updatedRows.credits - totalCredit;
        const { error: updErr } = await sb.from('users').update({ credits: newBal }).eq('id', userId).eq('credits', updatedRows.credits);
        if (updErr) return NextResponse.json({ error: '积分扣除失败' }, { status: 500 });
        newBalance = newBal;
        try {
          await sb.from('credit_transactions').insert({
            user_id: userId, amount: -totalCredit, balance_after: newBal,
            type: 'generation', description: `生成PPT-${numPages}页-共${totalCredit}积分`,
          });
        } catch {}
      }

      if (newBalance === null) {
        const { data: u } = await sb.from('users').select('credits').eq('id', userId).single();
        return NextResponse.json({ error: '积分不足', needed: totalCredit, balance: u?.credits || 0 });
      }

      return NextResponse.json({
        success: true,
        creditsUsed: totalCredit,
        balance: newBalance,
        breakdown: {
          baseCredits: numPages * BASE_CREDIT_PER_PAGE,
          imageCredits: estimatedImageCount * imageCreditsPerImage,
          imageCreditsPerImage,
          estimatedImages: estimatedImageCount,
          imageSource,
          imageModel: imageModel || null,
        },
      });
    }

    // ===== 积分回滚（生成失败/超时时返还） =====
    if (action === 'rollback') {
      const { userId, credits, reason } = body;
      if (!userId || typeof credits !== 'number' || credits <= 0) {
        return NextResponse.json({ error: '参数错误' }, { status: 400 });
      }
      const { data: updated, error: updErr } = await sb
        .from('users').select('credits').eq('id', userId).single();
      if (updErr || !updated) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
      const newBal = (updated.credits || 0) + credits;
      const { error: setErr } = await sb
        .from('users').update({ credits: newBal }).eq('id', userId).eq('credits', updated.credits);
      if (setErr) return NextResponse.json({ error: '回滚失败' }, { status: 500 });
      try {
        await sb.from('credit_transactions').insert({
          user_id: userId, amount: credits, balance_after: newBal,
          type: 'rollback', description: `回滚-${reason || '生成失败'}-返还${credits}积分`,
        });
      } catch {}
      return NextResponse.json({ success: true, balance: newBal });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '操作失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
