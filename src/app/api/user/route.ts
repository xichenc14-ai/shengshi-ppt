import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ==================== POST: 多动作路由 ====================
export async function POST(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  try {
    const body = await req.json();
    const { action } = body;

    // ===== 手机号直接登录/注册（MVP，待接入短信验证码） =====
    if (action === 'login') {
      const { phone } = body;
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        return NextResponse.json({ error: '请输入正确的手机号' }, { status: 400 });
      }

      const { data: users } = await sb
        .from('users')
        .select('id,phone,nickname,credits,plan_type,is_active')
        .eq('phone', phone);

      if (users && users.length > 0) {
        const u = users[0];
        await sb.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', u.id);
        return NextResponse.json({
          user: { id: u.id, phone: u.phone, nickname: u.nickname || '用户', credits: u.credits, plan_type: u.plan_type, has_subscription: u.plan_type !== 'free', is_new: false },
        });
      }

      const { data: newUser, error: insErr } = await sb
        .from('users')
        .insert({ phone, credits: 100, plan_type: 'free', nickname: '用户', is_active: true })
        .select()
        .single();

      if (insErr || !newUser) {
        console.error('Insert error:', insErr);
        return NextResponse.json({ error: '注册失败' }, { status: 500 });
      }

      await sb.from('credit_transactions').insert({
        user_id: newUser.id, amount: 100, balance_after: 100,
        type: 'signup_gift', description: '注册赠送100积分',
      });

      return NextResponse.json({
        user: { id: newUser.id, phone: newUser.phone, nickname: newUser.nickname, credits: newUser.credits, plan_type: newUser.plan_type, is_active: true, has_subscription: false, is_new: true },
      });
    }

    // ===== 发送验证码（待接入短信） =====
    if (action === 'send_code') {
      const { phone } = body;
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        return NextResponse.json({ error: '请输入正确的手机号' }, { status: 400 });
      }

      // 检查发送频率（60秒内不能重复发送）
      const thirtySecAgo = new Date(Date.now() - 30000).toISOString();
      const { data: recent } = await sb
        .from('verification_codes')
        .select('id')
        .eq('phone', phone)
        .gt('created_at', thirtySecAgo)
        .limit(1);

      if (recent && recent.length > 0) {
        return NextResponse.json({ error: '发送太频繁，请60秒后重试' }, { status: 429 });
      }

      // 清理该手机号的旧过期验证码
      await sb.from('verification_codes').delete().eq('phone', phone).lt('expires_at', new Date().toISOString());

      const code = genCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      await sb.from('verification_codes').insert({
        phone,
        code,
        expires_at: expiresAt,
      });

      // TODO: 接入短信服务商（阿里云/腾讯云短信）后取消这行
      // MVP 阶段：直接返回验证码给前端展示
      console.log(`[SMS] 验证码 ${phone}: ${code}`);

      return NextResponse.json({ success: true, code, message: '验证码已发送' });
    }

    // ===== 验证码登录/注册 =====
    if (action === 'verify_code') {
      const { phone, code } = body;
      if (!phone || !code) return NextResponse.json({ error: '参数错误' }, { status: 400 });

      // 查询最新有效验证码
      const { data: records, error: qErr } = await sb
        .from('verification_codes')
        .select('id,code,expires_at,verified')
        .eq('phone', phone)
        .eq('code', code)
        .gt('expires_at', new Date().toISOString())
        .eq('verified', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (qErr) return NextResponse.json({ error: '验证失败' }, { status: 500 });
      if (!records || records.length === 0) {
        return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 });
      }

      // 标记已验证
      await sb.from('verification_codes').update({ verified: true }).eq('id', records[0].id);

      // 查询/创建用户
      const { data: users } = await sb
        .from('users')
        .select('id,phone,nickname,credits,plan_type,is_active')
        .eq('phone', phone);

      if (users && users.length > 0) {
        const u = users[0];
        await sb.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', u.id);
        return NextResponse.json({
          user: { id: u.id, phone: u.phone, nickname: u.nickname || '用户', credits: u.credits, plan_type: u.plan_type, has_subscription: u.plan_type !== 'free', is_new: false },
        });
      }

      // 新用户注册 + 赠送100积分
      const { data: newUser, error: insErr } = await sb
        .from('users')
        .insert({ phone, credits: 100, plan_type: 'free', nickname: '用户', is_active: true })
        .select()
        .single();

      if (insErr || !newUser) {
        console.error('Insert error:', insErr);
        return NextResponse.json({ error: '注册失败' }, { status: 500 });
      }

      await sb.from('credit_transactions').insert({
        user_id: newUser.id, amount: 100, balance_after: 100,
        type: 'signup_gift', description: '注册赠送100积分',
      });

      return NextResponse.json({
        user: { id: newUser.id, phone: newUser.phone, nickname: newUser.nickname, credits: newUser.credits, plan_type: newUser.plan_type, is_active: true, has_subscription: false, is_new: true },
      });
    }

    // ===== 账号密码登录（测试用） =====
    if (action === 'password_login') {
      const { username, password } = body;
      if (!username || !password) {
        return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
      }
      // 硬编码测试账号
      if (username !== 'xichen' || password !== '123456') {
        return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
      }

      // 查询 supabase users 表中 phone='xichen' 的用户
      const { data: users } = await sb
        .from('users')
        .select('id,phone,nickname,credits,plan_type,is_active')
        .eq('phone', 'xichen');

      if (users && users.length > 0) {
        const u = users[0];
        await sb.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', u.id);
        return NextResponse.json({
          user: { id: u.id, phone: u.phone, nickname: u.nickname || 'xichen', credits: u.credits, plan_type: u.plan_type, has_subscription: u.plan_type !== 'free', is_new: false },
        });
      }

      // 不存在则创建
      const { data: newUser, error: insErr } = await sb
        .from('users')
        .insert({ phone: 'xichen', credits: 9999, plan_type: 'pro', nickname: 'xichen', is_active: true })
        .select()
        .single();

      if (insErr || !newUser) {
        console.error('Insert error:', insErr);
        return NextResponse.json({ error: '创建用户失败' }, { status: 500 });
      }

      await sb.from('credit_transactions').insert({
        user_id: newUser.id, amount: 9999, balance_after: 9999,
        type: 'signup_gift', description: '测试账号赠送9999积分',
      });

      return NextResponse.json({
        user: { id: newUser.id, phone: newUser.phone, nickname: newUser.nickname, credits: newUser.credits, plan_type: newUser.plan_type, is_active: true, has_subscription: true, is_new: true },
      });
    }

    // ===== 更新用户资料 =====
    if (action === 'update_profile') {
      const { userId, nickname } = body;
      if (!userId) return NextResponse.json({ error: '参数错误' }, { status: 400 });

      const updates: Record<string, any> = { last_login_at: new Date().toISOString() };
      if (nickname) updates.nickname = nickname;

      const { data: updated, error: updErr } = await sb
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select('id,phone,nickname,credits,plan_type')
        .single();

      if (updErr || !updated) return NextResponse.json({ error: '更新失败' }, { status: 500 });
      return NextResponse.json({ user: updated });
    }

    // ===== 扣积分 =====
    if (action === 'deduct') {
      const { userId, mode, numPages } = body;
      if (!userId || !mode) return NextResponse.json({ error: '参数错误' }, { status: 400 });

      const CREDIT_RULES: Record<string, number> = { generate: 30, condense: 24, preserve: 15 };
      const baseCredit = CREDIT_RULES[mode] || 30;
      let totalCredit = baseCredit;
      if (numPages && numPages > 15) totalCredit += Math.ceil((numPages - 15) / 5) * 6;

      const { data: u } = await sb.from('users').select('id,credits,total_credits_used').eq('id', userId).single();
      if (!u) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
      if (u.credits < totalCredit) return NextResponse.json({ error: '积分不足', needed: totalCredit, balance: u.credits });

      const newBalance = u.credits - totalCredit;
      await sb.from('users').update({ credits: newBalance, total_credits_used: (u.total_credits_used || 0) + totalCredit }).eq('id', userId);
      await sb.from('credit_transactions').insert({
        user_id: userId, amount: -totalCredit, balance_after: newBalance,
        type: 'generation', description: `${mode === 'generate' ? 'AI创作' : mode === 'condense' ? '智能摘要' : '原文排版'}-${numPages || 10}页`,
      });

      return NextResponse.json({ success: true, creditsUsed: totalCredit, balance: newBalance });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '操作失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ user: null, credits: 0, message: '未登录' });
}
