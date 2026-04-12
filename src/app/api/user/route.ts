import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function hashPassword(password: string): string {
  return createHash('sha256').update(password + '_sxPPT_salt_2026').digest('hex');
}

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ==================== GET: 检查手机号是否注册 ====================
export async function GET(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'check_phone') {
    const phone = searchParams.get('phone');
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: '请输入正确的手机号' }, { status: 400 });
    }
    const { data: users } = await sb.from('users').select('id, phone, nickname, username').eq('phone', phone).limit(1);
    if (users && users.length > 0) {
      return NextResponse.json({ registered: true, nickname: (users[0] as any).nickname || (users[0] as any).username });
    }
    return NextResponse.json({ registered: false });
  }

  return NextResponse.json({ user: null, credits: 0, message: '未登录' });
}

// ==================== POST: 多动作路由 ====================
export async function POST(req: NextRequest) {
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

      // 60秒频率限制
      const sixtySecAgo = new Date(Date.now() - 60000).toISOString();
      const { data: recent } = await sb.from('verification_codes').select('id').eq('phone', phone).gt('created_at', sixtySecAgo).limit(1);
      if (recent && recent.length > 0) {
        return NextResponse.json({ error: '发送太频繁，请60秒后重试' }, { status: 429 });
      }

      // 清理过期验证码
      await sb.from('verification_codes').delete().eq('phone', phone).lt('expires_at', new Date().toISOString());

      // 调用短信服务（阿里云模式下 API 自动生成验证码）
      let finalCode = '';
      try {
        const { sendSMS } = await import('@/lib/sms-client');
        const result = await sendSMS(phone);
        if (!result.success) {
          console.error('[SMS] 发送失败:', result.error);
          if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: '短信发送失败，请稍后重试' }, { status: 500 });
          }
          // 开发模式降级：自己生成验证码
          finalCode = genCode();
        } else {
          finalCode = result.code || genCode();
        }
      } catch (e) {
        console.error('[SMS] 模块异常:', e);
        finalCode = genCode();
      }

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await sb.from('verification_codes').insert({ phone, code: finalCode, expires_at: expiresAt });

      const isDev = process.env.NODE_ENV !== 'production';
      return NextResponse.json({ success: true, ...(isDev && { code: finalCode }), message: '验证码已发送' });
    }

    // ===== 验证验证码（内部复用） =====
    async function verifyCode(phone: string, code: string): Promise<{ valid: boolean; error?: string; recordId?: string }> {
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

      await sb.from('verification_codes').update({ verified: true }).eq('id', records[0].id);
      return { valid: true, recordId: records[0].id };
    }

    // ===== 注册（手机号验证码 + 用户名 + 密码） =====
    if (action === 'register') {
      const { phone, code, username, password } = body;
      if (!phone || !code || !username || !password) {
        return NextResponse.json({ error: '请填写完整信息' }, { status: 400 });
      }
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        return NextResponse.json({ error: '手机号格式不正确' }, { status: 400 });
      }
      if (username.trim().length < 2 || username.trim().length > 20) {
        return NextResponse.json({ error: '用户名需要2-20个字符' }, { status: 400 });
      }
      if (password.length < 6) {
        return NextResponse.json({ error: '密码至少6位' }, { status: 400 });
      }

      // 验证码校验
      const vResult = await verifyCode(phone, code);
      if (!vResult.valid) return NextResponse.json({ error: vResult.error }, { status: 400 });

      // 检查手机号是否已注册
      const { data: existing } = await sb.from('users').select('id').eq('phone', phone).limit(1);
      if (existing && existing.length > 0) {
        return NextResponse.json({ error: '该手机号已注册，请直接登录' }, { status: 409 });
      }

      // 检查用户名是否已存在
      const { data: nameExists } = await sb.from('users').select('id').eq('username', username.trim()).limit(1);
      if (nameExists && nameExists.length > 0) {
        return NextResponse.json({ error: '该用户名已被使用' }, { status: 409 });
      }

      const pwdHash = hashPassword(password);

      // 插入用户（password_hash 可能不存在，try-catch 兼容）
      const { data: newUser, error: insErr } = await sb
        .from('users')
        .insert({
          phone,
          username: username.trim(),
          nickname: username.trim(),
          password_hash: pwdHash,
          credits: 50,
          plan_type: 'free',
          is_active: true,
        })
        .select()
        .single();

      if (insErr) {
        console.error('[Register] Insert error:', insErr);
        // 如果是 password_hash 列不存在的错误，重试不带该字段
        if (String(insErr.message || insErr).includes('password_hash')) {
          console.warn('[Register] password_hash 列不存在，重试不带密码字段');
          const { data: newUser2, error: insErr2 } = await sb
            .from('users')
            .insert({
              phone,
              username: username.trim(),
              nickname: username.trim(),
              credits: 50,
              plan_type: 'free',
              is_active: true,
            })
            .select()
            .single();
          if (insErr2 || !newUser2) return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
          await sb.from('credit_transactions').insert({
            user_id: newUser2.id, amount: 50, balance_after: 50,
            type: 'signup_gift', description: '注册赠送50积分',
          });
          return NextResponse.json({
            user: { id: newUser2.id, phone: newUser2.phone, nickname: newUser2.nickname || username.trim(), username: username.trim(), credits: 50, plan_type: 'free', is_new: true },
          });
        }
        return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
      }

      await sb.from('credit_transactions').insert({
        user_id: newUser.id, amount: 50, balance_after: 50,
        type: 'signup_gift', description: '注册赠送50积分',
      });

      return NextResponse.json({
        user: { id: newUser.id, phone: newUser.phone, nickname: newUser.nickname || username.trim(), username: username.trim(), credits: 50, plan_type: newUser.plan_type, is_new: true },
      });
    }

    // ===== 验证码登录 =====
    if (action === 'verify_code') {
      const { phone, code } = body;
      if (!phone || !code) return NextResponse.json({ error: '参数错误' }, { status: 400 });

      const vResult = await verifyCode(phone, code);
      if (!vResult.valid) return NextResponse.json({ error: vResult.error }, { status: 400 });

      // 查找用户
      const { data: users } = await sb.from('users').select('id,phone,nickname,username,credits,plan_type,is_active').eq('phone', phone);
      if (users && users.length > 0) {
        const u = users[0];
        await sb.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', u.id);
        return NextResponse.json({
          user: { id: u.id, phone: u.phone, nickname: u.nickname || (u as any).username || '用户', credits: u.credits, plan_type: u.plan_type, has_subscription: u.plan_type !== 'free', is_new: false },
        });
      }

      // 手机号未注册 → 提示前端走注册流程
      return NextResponse.json({ error: 'NOT_REGISTERED', needRegister: true }, { status: 404 });
    }

    // ===== 账号密码登录 =====
    if (action === 'password_login') {
      const { account, password } = body;
      if (!account || !password) return NextResponse.json({ error: '请输入账号和密码' }, { status: 400 });
      if (password.length < 6) return NextResponse.json({ error: '密码格式不正确' }, { status: 400 });

      const pwdHash = hashPassword(password);

      // 手机号或用户名登录
      const isPhone = /^1[3-9]\d{9}$/.test(account);
      let query;
      if (isPhone) {
        query = sb.from('users').select('id,phone,nickname,username,credits,plan_type,is_active,password_hash').eq('phone', account);
      } else {
        query = sb.from('users').select('id,phone,nickname,username,credits,plan_type,is_active,password_hash').eq('username', account);
      }

      const { data: users, error: qErr } = await query.limit(1);
      if (qErr) {
        console.error('[PasswordLogin] Query error:', qErr);
        return NextResponse.json({ error: '登录失败' }, { status: 500 });
      }
      if (!users || users.length === 0) {
        return NextResponse.json({ error: '账号不存在' }, { status: 404 });
      }

      const u = users[0] as any;

      // 检查 password_hash 列是否存在
      if (u.password_hash === undefined || u.password_hash === null) {
        return NextResponse.json({ error: '该账号未设置密码，请使用手机验证码登录' }, { status: 400 });
      }

      if (u.password_hash !== pwdHash) {
        return NextResponse.json({ error: '密码错误' }, { status: 401 });
      }

      await sb.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', u.id);
      return NextResponse.json({
        user: { id: u.id, phone: u.phone, nickname: u.nickname || u.username || '用户', credits: u.credits, plan_type: u.plan_type, has_subscription: u.plan_type !== 'free', is_new: false },
      });
    }

    // ===== 更新用户资料 =====
    if (action === 'update_profile') {
      const { userId, nickname } = body;
      if (!userId) return NextResponse.json({ error: '参数错误' }, { status: 400 });

      const updates: Record<string, any> = { last_login_at: new Date().toISOString() };
      if (nickname) updates.nickname = nickname;

      const { data: updated, error: updErr } = await sb.from('users').update(updates).eq('id', userId).select('id,phone,nickname,credits,plan_type').single();
      if (updErr || !updated) return NextResponse.json({ error: '更新失败' }, { status: 500 });
      return NextResponse.json({ user: updated });
    }

    // ===== 扣积分 =====
    if (action === 'deduct') {
      const { userId, numPages = 10, imageSource = 'noImages', imageModel, estimatedImages = 0 } = body;
      if (!userId) return NextResponse.json({ error: '参数错误' }, { status: 400 });

      const BASE_CREDIT_PER_PAGE = 1;
      let totalCredit = numPages * BASE_CREDIT_PER_PAGE;

      let imageCreditsPerImage = 0;
      if (imageSource === 'aiGenerated') {
        const HIGH_END_MODELS = ['flux-kontext-pro', 'imagen-4-pro', 'ideogram-v3', 'dall-e-3', 'gpt-image-1-high'];
        if (imageModel && HIGH_END_MODELS.includes(imageModel)) {
          imageCreditsPerImage = 20;
        } else {
          imageCreditsPerImage = 2;
        }
      }

      const estimatedImageCount = estimatedImages > 0 ? estimatedImages : Math.ceil(numPages / 2.5);
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
        const { data: rpcResult, error: rpcErr } = await sb.rpc('deduct_credits_atomic', {
          p_user_id: userId,
          p_amount: totalCredit,
          p_description: `生成PPT-${numPages}页-${imageSource}${imageCreditsPerImage > 0 ? `-${imageCreditsPerImage}积分/图×${estimatedImageCount}张` : ''}-共${totalCredit}积分`,
        }).single();
        if (rpcErr) { useFallback = true; } else { newBalance = (rpcResult as any)?.new_balance ?? null; }
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

      return NextResponse.json({ success: true, creditsUsed: totalCredit, balance: newBalance });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '操作失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
