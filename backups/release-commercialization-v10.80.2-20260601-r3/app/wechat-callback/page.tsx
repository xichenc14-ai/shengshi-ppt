'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function WechatCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const userParam = searchParams.get('user');
    if (!userParam) {
      router.replace('/?login=wechat_error');
      return;
    }

    try {
      const user = JSON.parse(decodeURIComponent(userParam));
      fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', user }),
      }).then(() => {
        router.replace('/?login=wechat_success');
      }).catch(() => {
        router.replace('/?login=wechat_error');
      });
    } catch {
      router.replace('/?login=wechat_error');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-[#FAFBFE] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#07C160] flex items-center justify-center animate-bounce">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
            <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05a6.293 6.293 0 0 1-.261-1.82c0-3.572 3.193-6.468 7.13-6.468.239 0 .473.016.706.034C16.879 4.707 13.163 2.188 8.691 2.188zm5.396 16.496c-.254 0-.507-.018-.758-.04l.042-.002c-.093.007-.187.013-.282.013a7.942 7.942 0 0 1-2.395-.37.644.644 0 0 0-.537.073l-1.428.838a.246.246 0 0 1-.125.04.22.22 0 0 1-.218-.221c0-.054.022-.108.036-.16l.293-1.114a.444.444 0 0 0-.16-.5C6.883 16.14 5.86 14.485 5.86 12.626c0-3.393 3.086-6.14 6.9-6.14 3.815 0 6.9 2.747 6.9 6.14 0 3.393-3.085 6.058-6.573 6.058z"/>
          </svg>
        </div>
        <p className="text-gray-600 font-medium">微信登录中...</p>
        <p className="text-xs text-gray-400 mt-1">正在同步您的账号信息</p>
      </div>
    </div>
  );
}

export default function WeChatCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFBFE] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#07C160] flex items-center justify-center animate-bounce">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05a6.293 6.293 0 0 1-.261-1.82c0-3.572 3.193-6.468 7.13-6.468.239 0 .473.016.706.034C16.879 4.707 13.163 2.188 8.691 2.188zm5.396 16.496c-.254 0-.507-.018-.758-.04l.042-.002c-.093.007-.187.013-.282.013a7.942 7.942 0 0 1-2.395-.37.644.644 0 0 0-.537.073l-1.428.838a.246.246 0 0 1-.125.04.22.22 0 0 1-.218-.221c0-.054.022-.108.036-.16l.293-1.114a.444.444 0 0 0-.16-.5C6.883 16.14 5.86 14.485 5.86 12.626c0-3.393 3.086-6.14 6.9-6.14 3.815 0 6.9 2.747 6.9 6.14 0 3.393-3.085 6.058-6.573 6.058z"/>
            </svg>
          </div>
          <p className="text-gray-600 font-medium">微信登录中...</p>
        </div>
      </div>
    }>
      <WechatCallbackInner />
    </Suspense>
  );
}
