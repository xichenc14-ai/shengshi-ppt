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

    // Step 2: 获取用户信息
    const userInfo = await getWechatUserInfo(tokenRes.access_token, tokenRes.openid);
    if (userInfo.error) {
      console.error('WeChat user info error:', userInfo.error);
      // 即使获取用户信息失败（用户未关注公众号等），仍可用 openid 登录
    }

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

    // Step 4: 写入 session cookie
    // 通过一个中间页面来设置 cookie（避免API路由设置cookie后重定向的问题）
    const userJson = encodeURIComponent(JSON.stringify(result.user));
    return NextResponse.redirect(
      new URL(`/wechat-callback?user=${userJson}`, req.url)
    );
  } catch (e) {
    console.error('WeChat callback error:', e);
    return NextResponse.redirect(new URL('/?login=wechat_error', req.url));
  }
}
