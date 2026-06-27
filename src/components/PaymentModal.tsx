'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useAuth, type UserInfo } from '@/lib/auth-context';
import { isPaymentFeatureEnabledClient } from '@/lib/payment-feature';

// 收款码图片映射
const QR_CODE_MAP: Record<string, Record<'monthly' | 'annual', string>> = {
  'shengxin': {
    monthly: '/payment-qrcodes/basic-monthly.jpg',
    annual: '/payment-qrcodes/basic-annual.jpg',
  },
  'advanced': {
    monthly: '/payment-qrcodes/pro-monthly.jpg',
    annual: '/payment-qrcodes/pro-annual.jpg',
  },
  'basic': {
    monthly: '/payment-qrcodes/basic-monthly.jpg',
    annual: '/payment-qrcodes/basic-annual.jpg',
  },
  'standard': {
    monthly: '/payment-qrcodes/pro-monthly.jpg',
    annual: '/payment-qrcodes/pro-annual.jpg',
  },
  'pro': {
    monthly: '/payment-qrcodes/pro-monthly.jpg',
    annual: '/payment-qrcodes/pro-annual.jpg',
  },
  'vip': {
    monthly: '/payment-qrcodes/vip-monthly.jpg',
    annual: '/payment-qrcodes/vip-annual.jpg',
  },
};

// 获取对应套餐的收款码
function getQRCode(planId: string, billing: 'monthly' | 'annual'): string | null {
  return QR_CODE_MAP[planId]?.[billing] || null;
}

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  plan: {
    id: string;
    name: string;
    price: string;
    billing?: string;
    reason?: string;
    neededCredits?: number;
    currentCredits?: number;
    purchaseMode?: 'upgrade' | 'renew';
  } | null;
}

type Step = 'select' | 'confirm' | 'success';
type CreatedOrder = {
  orderNo: string;
  providerOrderId?: string;
  payUrl?: string;
  qrCodeUrl?: string;
  providerMock?: boolean;
  productName?: string;
};

function getSupportedPaymentMethods(): Array<'wechat' | 'alipay'> {
  const raw = process.env.NEXT_PUBLIC_PAYMENT_SUPPORTED_METHODS || 'wechat';
  const methods = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is 'wechat' | 'alipay' => item === 'wechat' || item === 'alipay');
  return methods.length > 0 ? methods : ['wechat'];
}

export default function PaymentModal({ open, onClose, plan }: PaymentModalProps) {
  const { user, refreshUser, syncUserSnapshot } = useAuth();
  const [payMethod, setPayMethod] = useState<'wechat' | 'alipay'>('wechat');
  const [step, setStep] = useState<Step>('select');
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [orderError, setOrderError] = useState('');
  const [statusHint, setStatusHint] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(120);
  const [qrExpired, setQrExpired] = useState(false);
  const [qrLoadFailed, setQrLoadFailed] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);
  const pollingRef = useRef(false);
  const creatingRef = useRef(false);
  const isProd = process.env.NODE_ENV === 'production';
  const paymentEnabled = isPaymentFeatureEnabledClient();
  const supportedMethods = useMemo(() => getSupportedPaymentMethods(), []);
  const supportsWechat = supportedMethods.includes('wechat');
  const supportsAlipay = supportedMethods.includes('alipay');

  const createOrder = useCallback(async (surface: 'select' | 'confirm') => {
    if (!plan || !user) return false;
    if (creatingRef.current) return false;
    creatingRef.current = true;
    setSubmitting(true);
    setOrderError('');
    setStatusHint('');
    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_order',
          planId: plan.id,
          payMethod,
          userId: user.id,
          billing: plan.billing || 'monthly',
          purchaseMode: plan.purchaseMode || 'upgrade',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data?.error || '创建订单失败，请稍后重试';
        if (surface === 'confirm') setStatusHint(message);
        else setOrderError(message);
        return false;
      }
      setOrder({
        orderNo: String(data.order_no || ''),
        providerOrderId: typeof data.provider_order_id === 'string' ? data.provider_order_id : undefined,
        payUrl: typeof data.pay_url === 'string' ? data.pay_url : undefined,
        qrCodeUrl: typeof data.qr_code_url === 'string' ? data.qr_code_url : undefined,
        providerMock: Boolean(data.provider_mock),
        productName: typeof data.product_name === 'string' ? data.product_name : undefined,
      });
      setRemainingSeconds(120);
      setQrExpired(false);
      setQrLoadFailed(false);
      setQrLoaded(false);
      setStep('confirm');
      if (surface === 'confirm') setStatusHint('二维码已刷新，请使用新二维码支付');
      return true;
    } catch {
      const message = '创建订单失败，请检查网络后重试';
      if (surface === 'confirm') setStatusHint(message);
      else setOrderError(message);
      return false;
    } finally {
      creatingRef.current = false;
      setSubmitting(false);
    }
  }, [plan, payMethod, user]);

  // 重置状态当Modal打开时（延后到下一帧，避免 effect 内同步 setState）
  useEffect(() => {
    if (!open) return;
    const frameId = requestAnimationFrame(() => {
      setStep('select');
      setPayMethod(supportsWechat ? 'wechat' : supportedMethods[0] || 'wechat');
      setSubmitting(false);
      setOrder(null);
      setOrderError('');
      setStatusHint('');
      setSuccessMessage('');
      setRemainingSeconds(120);
      setQrExpired(false);
      setQrLoadFailed(false);
      setQrLoaded(false);
    });
    return () => cancelAnimationFrame(frameId);
  }, [open, supportsWechat, supportedMethods]);

  const handleNext = useCallback(async () => {
    await createOrder('select');
  }, [createOrder]);

  const handleRefreshOrder = useCallback(async () => {
    await createOrder('confirm');
  }, [createOrder]);

  const handleClose = useCallback(() => {
    setStep('select');
    setOrder(null);
    setOrderError('');
    setStatusHint('');
    setSuccessMessage('');
    setRemainingSeconds(120);
    setQrExpired(false);
    setQrLoadFailed(false);
    setQrLoaded(false);
    onClose();
  }, [onClose]);

  const finishPayment = useCallback(async (message?: string, paidUser?: Partial<UserInfo>) => {
    let freshUser = paidUser ? await syncUserSnapshot(paidUser) : null;
    if (!freshUser) freshUser = await refreshUser({ force: true });
    if (!freshUser) {
      await new Promise((resolve) => window.setTimeout(resolve, 600));
      freshUser = await refreshUser({ force: true });
    }
    const planName = String(
      message?.match(/成为(.+?)！/)?.[1]
      || (freshUser?.plan_type === 'pro' || freshUser?.plan_type === 'advanced' ? '尊享会员' : '')
      || (freshUser?.plan_type === 'basic' || freshUser?.plan_type === 'shengxin' ? '省心会员' : '')
      || plan?.name
      || order?.productName
      || '会员'
    ).replace(/[（）(].*$/, '');
    setSuccessMessage(message || `付款成功，恭喜您成为${planName}！`);
    setStep('success');
    setSubmitting(false);
  }, [order?.productName, plan?.name, refreshUser, syncUserSnapshot]);

  const checkPaymentStatus = useCallback(async (manual = false) => {
    if (!plan || !user || !order?.orderNo) {
      handleClose();
      return false;
    }
    if (pollingRef.current) return false;
    pollingRef.current = true;
    if (manual) {
      setSubmitting(true);
      setStatusHint('');
    }
    try {
      const statusRes = await fetch(`/api/payment?order_no=${encodeURIComponent(order.orderNo)}`, { cache: 'no-store' });
      const data = await statusRes.json();
      if (!statusRes.ok) {
        if (manual) setStatusHint(data?.error || '查询订单状态失败，请稍后重试');
        return false;
      }
      const orderStatus = String(data?.order?.status || '');
      if (orderStatus === 'completed') {
        setStatusHint('支付成功，正在刷新会员状态...');
        await finishPayment(
          typeof data?.message === 'string' ? data.message : undefined,
          data?.user && typeof data.user === 'object' ? data.user : undefined
        );
        return true;
      }
      if (orderStatus === 'pending') {
        if (manual) setStatusHint('订单还在等待付款，系统会继续自动检查');
        return false;
      }
      if (orderStatus === 'expired') {
        setQrExpired(true);
        setRemainingSeconds(0);
        setStatusHint('二维码已超时，请刷新后重新支付');
        return false;
      }
      if (manual) setStatusHint(`当前订单状态：${orderStatus || '未知'}，请稍后再试`);
      return false;
    } catch {
      if (manual) setStatusHint('状态检查失败，请检查网络后重试');
      return false;
    } finally {
      pollingRef.current = false;
      if (manual) setSubmitting(false);
    }
  }, [plan, user, order?.orderNo, handleClose, finishPayment]);

  useEffect(() => {
    if (!open || step !== 'confirm' || !order?.orderNo || qrExpired) return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          setQrExpired(true);
          setStatusHint('二维码已超时，请刷新后重新支付');
          return 0;
        }
        return current - 1;
      });
      void checkPaymentStatus(false);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [open, step, order?.orderNo, qrExpired, checkPaymentStatus]);

  useEffect(() => {
    if (!open || step !== 'confirm') return;
    if (qrExpired || qrLoadFailed || qrLoaded || !order?.qrCodeUrl) return;
    const timeout = window.setTimeout(() => setQrLoadFailed(true), 10000);
    return () => window.clearTimeout(timeout);
  }, [open, step, order?.qrCodeUrl, qrExpired, qrLoadFailed, qrLoaded]);

  // ESC key
  React.useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, handleClose]);

  if (!open || !plan) return null;

  if (!paymentEnabled) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={handleClose}>
        <div className="bg-white rounded-3xl shadow-2xl w-[420px] max-w-[94vw] animate-modal-in overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="h-1.5 bg-gradient-to-r from-[#5B4FE9] via-[#7C3AED] to-[#8B5CF6]" />
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">支付通道申请中</h3>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all active:scale-90"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <p className="text-sm text-slate-600 leading-6">
              当前版本已先行上线非支付功能。会员开通与充值将在支付资质完成后开放。
            </p>
            <button
              onClick={handleClose}
              className="mt-5 w-full py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all"
            >
              我知道了
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isWechat = payMethod === 'wechat';
  const fallbackQr = getQRCode(plan.id, (plan.billing as 'monthly' | 'annual') || 'monthly');
  const isMobileDevice = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const mobilePayQr = isMobileDevice && order?.payUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(order.payUrl)}`
    : null;
  const finalQr = mobilePayQr || order?.qrCodeUrl || (!isProd ? fallbackQr : null);
  const showQr = Boolean(finalQr && !qrExpired && !qrLoadFailed);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={handleClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-[420px] max-w-[94vw] animate-modal-in overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* 顶部渐变装饰条 */}
        <div className="h-1.5 bg-gradient-to-r from-[#5B4FE9] via-[#7C3AED] to-[#8B5CF6]" />

        {/* Step 1: 选择支付方式 */}
        {step === 'select' && (
          <div className="p-4 sm:p-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">{plan.purchaseMode === 'renew' ? '续费套餐' : '开通套餐'}</h3>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all active:scale-90"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* 积分不足提示 */}
            {plan.reason && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl p-3.5 mb-5">
                <p className="text-xs text-amber-700 font-medium flex items-center gap-1.5">⚡ {plan.reason}</p>
                {plan.neededCredits && plan.currentCredits !== undefined && (
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-amber-500">
                    <span>当前: {plan.currentCredits} 积分</span>
                    <span>需要: {plan.neededCredits} 积分</span>
                    <span className="font-bold text-amber-600">差额: {plan.neededCredits - plan.currentCredits}</span>
                  </div>
                )}
              </div>
            )}

            {/* 套餐信息卡片 */}
            <div className="bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] rounded-2xl p-3 sm:p-4 mb-4 sm:mb-5 border border-purple-100/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">{plan.name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {plan.purchaseMode === 'renew' ? '支付成功后有效期自动顺延' : '支付成功后立即生效 · 会员权益按周期开通'}
                  </p>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-[#5B4FE9]">{plan.price}</div>
              </div>
            </div>

            {/* 支付方式选择 */}
            <p className="text-xs font-medium text-gray-500 mb-2.5">选择支付方式</p>
            <div className="space-y-2 mb-4 sm:mb-5">
              {supportsWechat && (
                <button
                  onClick={() => setPayMethod('wechat')}
                  className={`w-full flex items-center gap-2.5 sm:gap-3.5 p-3 sm:p-3.5 rounded-2xl border-2 transition-all duration-200 ${
                    isWechat ? 'border-[#07C160] bg-green-50/60 shadow-sm shadow-green-100/50' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#07C160] flex items-center justify-center text-white text-sm font-bold shadow-sm">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05a6.293 6.293 0 0 1-.261-1.82c0-3.572 3.193-6.468 7.13-6.468.239 0 .473.016.706.034C16.879 4.707 13.163 2.188 8.691 2.188zm5.396 16.496c-.254 0-.507-.018-.758-.04l.042-.002c-.093.007-.187.013-.282.013a7.942 7.942 0 0 1-2.395-.37.644.644 0 0 0-.537.073l-1.428.838a.246.246 0 0 1-.125.04.22.22 0 0 1-.218-.221c0-.054.022-.108.036-.16l.293-1.114a.444.444 0 0 0-.16-.5C6.883 16.14 5.86 14.485 5.86 12.626c0-3.393 3.086-6.14 6.9-6.14 3.815 0 6.9 2.747 6.9 6.14 0 3.393-3.085 6.058-6.573 6.058z"/></svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-xs sm:text-sm font-semibold text-gray-800">微信支付</p>
                    <p className="text-[10px] text-gray-400">推荐 · 即时到账</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    isWechat ? 'border-[#07C160] bg-[#07C160]' : 'border-gray-200'
                  }`}>
                    {isWechat && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>}
                  </div>
                </button>
              )}

              {supportsAlipay && (
                <button
                  onClick={() => setPayMethod('alipay')}
                  className={`w-full flex items-center gap-2.5 sm:gap-3.5 p-3 sm:p-3.5 rounded-2xl border-2 transition-all duration-200 ${
                    !isWechat ? 'border-[#1677FF] bg-blue-50/60 shadow-sm shadow-blue-100/50' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1677FF] flex items-center justify-center text-white text-sm font-bold shadow-sm">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M21.422 13.477C21.422 13.477 19.948 12.507 18.765 11.813C19.37 10.576 19.668 9.132 19.668 7.552C19.668 3.5 16.842 0.5 13.334 0.5C9.826 0.5 7 3.5 7 7.552C7 11.603 9.826 14.603 13.334 14.603C14.556 14.603 15.698 14.2 16.67 13.5C17.6 14.04 19.08 14.93 19.08 14.93C19.38 15.1 19.76 15 19.9 14.7L21.4 13.477C21.54 13.177 21.542 12.677 21.422 13.477ZM13.334 12.603C11.034 12.603 9.166 10.403 9.166 7.652C9.166 4.901 11.034 2.701 13.334 2.701C15.634 2.701 17.502 4.901 17.502 7.652C17.502 10.403 15.634 12.603 13.334 12.603Z"/></svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-xs sm:text-sm font-semibold text-gray-800">支付宝</p>
                    <p className="text-[10px] text-gray-400">支持花呗分期</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    !isWechat ? 'border-[#1677FF] bg-[#1677FF]' : 'border-gray-200'
                  }`}>
                    {!isWechat && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>}
                  </div>
                </button>
              )}
            </div>

            {/* 确认支付按钮 */}
            <button
              onClick={handleNext}
              disabled={submitting || !user}
              className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:shadow-purple-300/40 transition-all active:scale-[0.98] disabled:opacity-40"
            >
              {submitting ? '创建订单中...' : `确认支付 ${plan.price}`}
            </button>
            {orderError && (
              <p className="text-center text-xs text-red-500 mt-2">{orderError}</p>
            )}
            {!user && (
              <p className="text-center text-xs text-amber-600 mt-2">请先登录后再发起支付</p>
            )}

            <p className="text-center text-[10px] text-gray-300 mt-3">
              支付即表示同意
              {' '}
              <Link href="/terms" className="text-gray-400 hover:text-[#5B4FE9]">《用户协议》</Link>
              {' '}
              和
              {' '}
              <Link href="/privacy" className="text-gray-400 hover:text-[#5B4FE9]">《隐私政策》</Link>
            </p>
          </div>
        )}

        {/* Step 2: 确认并扫码 */}
        {step === 'confirm' && (
          <div className="p-4 sm:p-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <button onClick={() => setStep('select')} className="flex items-center gap-1.5 text-sm text-[#5B4FE9] hover:text-[#4338CA] transition-colors font-medium">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                返回
              </button>
              <h3 className="text-base font-bold text-gray-900">扫码支付</h3>
              <button onClick={handleClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all active:scale-90">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* 订单摘要 */}
            <div className="bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] rounded-2xl p-3 sm:p-4 mb-4 sm:mb-5 border border-purple-100/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">订单内容</span>
                <span className="text-sm font-semibold text-gray-800">{plan.name}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">支付方式</span>
                <span className="text-xs font-medium text-gray-700">{isWechat ? '💚 微信支付' : '🔵 支付宝'}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-purple-200/50">
                <span className="text-xs text-gray-500">应付金额</span>
                <span className="text-lg sm:text-xl font-extrabold text-[#5B4FE9]">{plan.price}</span>
              </div>
              {order?.orderNo && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">订单号</span>
                  <span className="text-[11px] font-mono text-gray-600">{order.orderNo}</span>
                </div>
              )}
            </div>

            {/* 二维码区域 */}
            <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 mb-4 sm:mb-5 text-center">
              {showQr ? (
                <>
                  <img
                    src={finalQr || ''}
                    alt="收款码"
                    onLoad={(event) => {
                      const image = event.currentTarget;
                      if (image.naturalWidth < 64 || image.naturalHeight < 64) {
                        setQrLoadFailed(true);
                        setQrLoaded(false);
                        return;
                      }
                      setQrLoaded(true);
                      setQrLoadFailed(false);
                    }}
                    onError={() => {
                      setQrLoaded(false);
                      setQrLoadFailed(true);
                    }}
                    className="w-52 h-52 sm:w-64 sm:h-64 mx-auto bg-white rounded-2xl shadow-md mb-3 object-contain"
                  />
                  <div className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-gray-500 shadow-sm mb-2">
                    二维码有效期 {remainingSeconds}s
                  </div>
                  <p className="text-xs text-gray-500 font-medium">
                    请使用{isWechat ? '微信' : '支付宝'}扫描上方二维码支付
                  </p>
                  {isMobileDevice && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      手机端可截图后在微信内识别二维码支付
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                    金额：{plan.price} · 收款方：省心PPT
                  </p>
                </>
              ) : (
                <div className="w-52 h-52 sm:w-64 sm:h-64 mx-auto bg-white border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center mb-3 shadow-sm">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 font-semibold">
                      {qrExpired ? '二维码已超时' : '二维码加载失败'}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1 mb-4">
                      请刷新后使用新的二维码支付
                    </p>
                    <button
                      type="button"
                      onClick={handleRefreshOrder}
                      disabled={submitting}
                      className="px-5 py-2.5 rounded-xl bg-[#5B4FE9] text-white text-xs font-bold hover:bg-[#4338CA] transition-colors disabled:opacity-40"
                    >
                      {submitting ? '刷新中...' : '刷新二维码'}
                    </button>
                  </div>
                </div>
              )}
              {statusHint && (
                <p className="text-center text-xs text-amber-600 mt-3">{statusHint}</p>
              )}
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="p-6 animate-fade-in text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-3xl">
              ✓
            </div>
            <h3 className="mt-4 text-lg font-black text-gray-900">{successMessage || '付款成功，会员已开通！'}</h3>
            <p className="mt-2 text-xs leading-5 text-gray-500">积分和会员状态已同步，可在右上角用户菜单查看最新余额。</p>
            <button
              onClick={handleClose}
              className="mt-6 w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              我知道了
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
