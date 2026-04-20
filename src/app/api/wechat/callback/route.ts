import { NextRequest, NextResponse } from 'next/server';
import {
  getWechatAccessToken,
  getWechatUserInfo,
  findOrCreateWechatUser,
} from '@/lib/wechat-client';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // 🚨 安全：验证 state 参数（OAuth CSRF 保护）
  if (state && state !== 'wechat_login') {
    console.warn('[WeChat] Invalid state:', state);
    return NextResponse.redirect(new URL('/?login=wechat_error&reason=invalid_state', req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?login=wechat_error', req.url));
  }

  try {
    // Step 1: 换取 access_token
    const tokenRes = await getWechatAccessToken(code);
    if (tokenRes.error || !tokenRes.access_token || !tokenRes.openid) {
      console.error('WeChat token error:', tokenRes.error);
      return NextResponse.redirect(new URL('/?login=wechat_error', req.url));
    }

    // Step 2: 获取用户信息（可选，获取失败不阻断登录）
    const userInfo = await getWechatUserInfo(tokenRes.access_token, tokenRes.openid);

    // Step 3: 查找或创建用户
    const result = await findOrCreateWechatUser(
      tokenRes.openid,
      userInfo.nickname,
      userInfo.headimgurl,
    );

    if (result.error || !result.user) {
      console.error('WeChat create user error:', result.error);
      return NextResponse.redirect(new URL('/?login=wechat_error', req.url));
    }

    // Step 4: 将用户 ID 写入 session cookie（避免 URL 传递用户数据）
    // 通过 /wechat-callback?sessionId=xxx 中转，sessionId 只是临时令牌，不含用户数据
    const sessionId = result.user.id;
    return NextResponse.redirect(
      new URL(`/wechat-callback?sessionId=${encodeURIComponent(sessionId)}`, req.url)
    );
  } catch (e) {
    console.error('WeChat callback error:', e);
    return NextResponse.redirect(new URL('/?login=wechat_error', req.url));
  }
}