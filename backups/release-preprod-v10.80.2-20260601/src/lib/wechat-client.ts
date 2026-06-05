// WeChat OAuth Client - 微信开放平台网页扫码登录
// 环境变量：
//   WECHAT_APP_ID=xxx          (微信开放平台网站应用 AppID)
//   WECHAT_APP_SECRET=xxx      (微信开放平台网站应用 AppSecret)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Step 1: 生成微信OAuth授权URL
export function getWechatAuthURL(state?: string) {
  const appId = process.env.WECHAT_APP_ID;
  if (!appId) return null;

  const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://shengxinppt.lol'}/api/wechat/callback`);
  const scope = 'snsapi_login';
  const _state = state || Math.random().toString(36).substring(2, 15);

  return `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${_state}#wechat_redirect`;
}

// Step 2: 用授权码换取 access_token + openid
export async function getWechatAccessToken(code: string): Promise<{
  access_token?: string;
  openid?: string;
  error?: string;
}> {
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;
  if (!appId || !appSecret) return { error: '微信配置未完成' };

  try {
    const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.errcode) {
      return { error: `微信错误: ${data.errmsg} (${data.errcode})` };
    }

    return {
      access_token: data.access_token,
      openid: data.openid,
    };
  } catch (e) {
    return { error: `请求失败: ${e instanceof Error ? e.message : 'unknown'}` };
  }
}

// Step 3: 用 access_token + openid 获取用户信息
export async function getWechatUserInfo(accessToken: string, openid: string): Promise<{
  openid?: string;
  nickname?: string;
  headimgurl?: string;
  unionid?: string;
  error?: string;
}> {
  try {
    const url = `https://api.weixin.qq.com/sns/userinfo?access_token=${accessToken}&openid=${openid}&lang=zh_CN`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.errcode) {
      return { error: `获取用户信息失败: ${data.errmsg}` };
    }

    return {
      openid: data.openid,
      nickname: data.nickname,
      headimgurl: data.headimgurl,
      unionid: data.unionid,
    };
  } catch (e) {
    return { error: `请求失败: ${e instanceof Error ? e.message : 'unknown'}` };
  }
}

// 查找或创建微信用户
export async function findOrCreateWechatUser(
  openid: string,
  nickname?: string,
  headimgurl?: string,
) {
  const sb = getSupabase();
  if (!sb) return { error: '数据库未配置' };

  // 查找已有微信用户
  const { data: users } = await sb
    .from('users')
    .select('id,phone,nickname,credits,plan_type,is_active,wechat_openid')
    .eq('wechat_openid', openid);

  if (users && users.length > 0) {
    const u = users[0];
    // 更新最后登录时间
    await sb.from('users').update({
      last_login_at: new Date().toISOString(),
      ...(nickname ? { nickname } : {}),
      ...(headimgurl ? { avatar_url: headimgurl } : {}),
    }).eq('id', u.id);

    return {
      user: {
        id: u.id,
        phone: u.phone || '',
        nickname: u.nickname || nickname || '微信用户',
        credits: u.credits,
        plan_type: u.plan_type,
        has_subscription: u.plan_type !== 'free',
        is_new: false,
      },
    };
  }

  // 新用户注册
  const { data: newUser, error: insErr } = await sb
    .from('users')
    .insert({
      wechat_openid: openid,
      phone: `wechat_${openid.substring(0, 8)}`,
      credits: 50,
      plan_type: 'free',
      nickname: nickname || '微信用户',
      avatar_url: headimgurl || null,
      is_active: true,
    })
    .select()
    .single();

  if (insErr || !newUser) {
    console.error('WeChat user insert error:', insErr);
    return { error: '微信注册失败' };
  }

  // 注册赠送积分
  await sb.from('credit_transactions').insert({
    user_id: newUser.id,
    amount: 50,
    balance_after: 50,
    type: 'signup_gift',
    description: '微信注册赠送50积分',
  });

  return {
    user: {
      id: newUser.id,
      phone: newUser.phone || '',
      nickname: newUser.nickname,
      credits: newUser.credits,
      plan_type: newUser.plan_type,
      is_active: true,
      has_subscription: false,
      is_new: true,
    },
  };
}

// ===== API Route Handlers =====

// GET: 生成微信授权URL（前端调此接口获取跳转链接）
export async function GET() {
  const authUrl = getWechatAuthURL();
  if (!authUrl) {
    return NextResponse.json({ error: '微信登录未配置' }, { status: 503 });
  }
  return NextResponse.json({ url: authUrl });
}
