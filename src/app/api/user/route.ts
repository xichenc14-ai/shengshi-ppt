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

      // TODO: 接入短信服务商（阿里云/腾讯云短信）后启用
      // MVP 阶段：开发环境返回验证码，生产环境不返回
      const isDev = process.env.NODE_ENV !== 'production';
      return NextResponse.json({
        success: true,
        ...(isDev && { code }), // 仅开发环境返回验证码
        message: '验证码已发送',
      });
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

    // ===== 账号密码登录（测试用，商用前移除） =====
    if (action === 'password_login') {
      // ⚠️ 仅限开发环境使用，生产环境应通过 SUPABASE_DISABLE_TEST_LOGIN 禁用
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: '生产环境不支持密码登录' }, { status: 403 });
      }
      const { username, password } = body;
      if (!username || !password) {
        return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
      }
      // 测试账号（仅开发环境）
      const TEST_USERS: Record<string, string> = {
        'admin': process.env.TEST_ADMIN_PWD || 'changeme',
        'xichen': process.env.TEST_XICHEN_PWD || 'changeme',
      };
      if (!TEST_USERS[username] || TEST_USERS[username] !== password) {
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

    // ===== 扣积分（按Gamma API实际扣费1:1） =====
    if (action === 'deduct') {
      const { userId, numPages = 10, imageSource = 'noImages', imageModel, estimatedImages = 0 } = body;
      if (!userId) return NextResponse.json({ error: '参数错误' }, { status: 400 });

      // 基础积分：每页约1积分（Gamma API实际消耗）
      const BASE_CREDIT_PER_PAGE = 1;
      let totalCredit = numPages * BASE_CREDIT_PER_PAGE;

      // 图片积分：按实际选择的图片方案计算
      let imageCreditsPerImage = 0;
      if (imageSource === 'aiGenerated') {
        // 高级模型20积分/图，普通模型2积分/图
        const HIGH_END_MODELS = ['flux-kontext-pro', 'imagen-4-pro', 'ideogram-v3', 'dall-e-3', 'gpt-image-1-high'];
        if (imageModel && HIGH_END_MODELS.includes(imageModel)) {
          imageCreditsPerImage = 20;
        } else {
          imageCreditsPerImage = 2; // imagen-3-flash, flux-kontext-fast 等
        }
      }
      // 免费图片渠道0积分
      // noImages, pictographic, pexels, webFreeToUseCommercially, giphy 等

      // 估算图片数量（Gamma平均每2-3页一张图）
      const estimatedImageCount = estimatedImages > 0 ? estimatedImages : Math.ceil(numPages / 2.5);
      totalCredit += estimatedImageCount * imageCreditsPerImage;

      // 返回预估积分（让前端确认）
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

      // 原子性扣除：使用条件更新防止并发超扣
      // UPDATE users SET credits = credits - X WHERE id = Y AND credits >= X
      const { data: updated, error: updErr } = await sb.rpc('deduct_credits_atomic', {
        p_user_id: userId,
        p_amount: totalCredit,
        p_description: `生成PPT-${numPages}页-${imageSource}${imageCreditsPerImage > 0 ? `-${imageCreditsPerImage}积分/图×${estimatedImageCount}张` : ''}-共${totalCredit}积分`,
      }).single();

      if (updErr) {
        console.error('Deduct credits error:', updErr);
        return NextResponse.json({ error: '积分扣除失败' }, { status: 500 });
      }

      const result = updated as { new_balance: number } | null;
      // RPC 返回 null 表示余额不足
      if (!result) {
        const { data: u } = await sb.from('users').select('credits').eq('id', userId).single();
        return NextResponse.json({ error: '积分不足', needed: totalCredit, balance: u?.credits || 0 });
      }

      return NextResponse.json({ success: true, creditsUsed: totalCredit, balance: result.new_balance });
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
