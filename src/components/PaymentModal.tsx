'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';

// 收款码图片映射
const QR_CODE_MAP: Record<string, Record<'monthly' | 'annual', string>> = {
  'basic': {
    monthly: '/payment-qrcodes/basic-monthly.jpg',
    annual: '/payment-qrcodes/basic-annual.jpg',
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
  plan: { id: string; name: string; price: string; billing?: string; reason?: string; neededCredits?: number; currentCredits?: number } | null;
}

type Step = 'select' | 'confirm';

export default function PaymentModal({ open, onClose, plan }: PaymentModalProps) {
  const { user } = useAuth();
  const [payMethod, setPayMethod] = useState<'wechat' | 'alipay'>('wechat');
  const [step, setStep] = useState<Step>('select');
  const [submitting, setSubmitting] = useState(false);

  // 重置状态当Modal打开时
  useEffect(() => {
    if (open) {
      setStep('select');
      setPayMethod('wechat');
      setSubmitting(false);
    }
  }, [open]);

  const handleNext = useCallback(async () => {
    if (!plan) return;
    setStep('confirm');
    // 后台创建订单
    fetch('/api/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: plan.id, payMethod, billing: plan.billing || 'monthly', userId: user?.id }),
    }).then(res => res.json()).then(data => {
      if (data.error) {
        setStep('select');
        alert(data.error);
      }
    }).catch(() => {});
  }, [plan, payMethod]);

  const handleClose = useCallback(() => {
    setStep('select');
    onClose();
  }, [onClose]);

  // ESC key
  React.useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, handleClose]);

  if (!open || !plan) return null;

  const isWechat = payMethod === 'wechat';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={handleClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-[420px] max-w-[92vw] animate-modal-in overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* 顶部渐变装饰条 */}
        <div className="h-1.5 bg-gradient-to-r from-[#5B4FE9] via-[#7C3AED] to-[#8B5CF6]" />

        {/* Step 1: 选择支付方式 */}
        {step === 'select' && (
          <div className="p-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">开通套餐</h3>
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
            <div className="bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] rounded-2xl p-4 mb-5 border border-purple-100/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">{plan.name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">立即生效 · 按月自动续费 · 随时取消</p>
                </div>
                <div className="text-2xl font-extrabold text-[#5B4FE9]">{plan.price}</div>
              </div>
            </div>

            {/* 支付方式选择 */}
            <p className="text-xs font-medium text-gray-500 mb-2.5">选择支付方式</p>
            <div className="space-y-2.5 mb-5">
              <button
                onClick={() => setPayMethod('wechat')}
                className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border-2 transition-all duration-200 ${
                  isWechat ? 'border-[#07C160] bg-green-50/60 shadow-sm shadow-green-100/50' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#07C160] flex items-center justify-center text-white text-sm font-bold shadow-sm">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05a6.293 6.293 0 0 1-.261-1.82c0-3.572 3.193-6.468 7.13-6.468.239 0 .473.016.706.034C16.879 4.707 13.163 2.188 8.691 2.188zm5.396 16.496c-.254 0-.507-.018-.758-.04l.042-.002c-.093.007-.187.013-.282.013a7.942 7.942 0 0 1-2.395-.37.644.644 0 0 0-.537.073l-1.428.838a.246.246 0 0 1-.125.04.22.22 0 0 1-.218-.221c0-.054.022-.108.036-.16l.293-1.114a.444.444 0 0 0-.16-.5C6.883 16.14 5.86 14.485 5.86 12.626c0-3.393 3.086-6.14 6.9-6.14 3.815 0 6.9 2.747 6.9 6.14 0 3.393-3.085 6.058-6.573 6.058z"/></svg>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-gray-800">微信支付</p>
                  <p className="text-[10px] text-gray-400">推荐 · 即时到账</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  isWechat ? 'border-[#07C160] bg-[#07C160]' : 'border-gray-200'
                }`}>
                  {isWechat && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>}
                </div>
              </button>

              <button
                onClick={() => setPayMethod('alipay')}
                className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border-2 transition-all duration-200 ${
                  !isWechat ? 'border-[#1677FF] bg-blue-50/60 shadow-sm shadow-blue-100/50' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#1677FF] flex items-center justify-center text-white text-sm font-bold shadow-sm">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M21.422 13.477C21.422 13.477 19.948 12.507 18.765 11.813C19.37 10.576 19.668 9.132 19.668 7.552C19.668 3.5 16.842 0.5 13.334 0.5C9.826 0.5 7 3.5 7 7.552C7 11.603 9.826 14.603 13.334 14.603C14.556 14.603 15.698 14.2 16.67 13.5C17.6 14.04 19.08 14.93 19.08 14.93C19.38 15.1 19.76 15 19.9 14.7L21.4 13.477C21.54 13.177 21.542 12.677 21.422 13.477ZM13.334 12.603C11.034 12.603 9.166 10.403 9.166 7.652C9.166 4.901 11.034 2.701 13.334 2.701C15.634 2.701 17.502 4.901 17.502 7.652C17.502 10.403 15.634 12.603 13.334 12.603Z"/></svg>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-gray-800">支付宝</p>
                  <p className="text-[10px] text-gray-400">支持花呗分期</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  !isWechat ? 'border-[#1677FF] bg-[#1677FF]' : 'border-gray-200'
                }`}>
                  {!isWechat && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>}
                </div>
              </button>
            </div>

            {/* 确认支付按钮 */}
            <button
              onClick={handleNext}
              disabled={submitting}
              className="w-full py-4 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:shadow-purple-300/40 transition-all active:scale-[0.98] disabled:opacity-40"
            >
              确认支付 {plan.price}
            </button>

            <p className="text-center text-[10px] text-gray-300 mt-3">
              支付即表示同意《用户协议》和《隐私政策》
            </p>
          </div>
        )}

        {/* Step 2: 确认并扫码 */}
        {step === 'confirm' && (
          <div className="p-6 animate-fade-in">
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
            <div className="bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] rounded-2xl p-4 mb-5 border border-purple-100/50">
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
                <span className="text-xl font-extrabold text-[#5B4FE9]">{plan.price}</span>
              </div>
            </div>

            {/* 二维码区域 */}
            <div className="bg-gray-50 rounded-2xl p-6 mb-5 text-center">
              {getQRCode(plan.id, (plan.billing as 'monthly' | 'annual') || 'monthly') ? (
                <>
                  <img
                    src={getQRCode(plan.id, (plan.billing as 'monthly' | 'annual') || 'monthly')!}
                    alt="收款码"
                    className="w-64 h-64 mx-auto bg-white rounded-2xl shadow-md mb-3 object-contain"
                  />
                  <p className="text-xs text-gray-500 font-medium">
                    请使用{isWechat ? '微信' : '支付宝'}扫描上方二维码支付
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    金额：{plan.price} · 收款方：省心PPT
                  </p>
                </>
              ) : (
                <div className="w-52 h-52 mx-auto bg-white border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center mb-3">
                  <div className="text-center">
                    <div className="text-5xl mb-2">{isWechat ? '💚' : '🔵'}</div>
                    <p className="text-sm text-gray-500 font-medium">{isWechat ? '微信扫码' : '支付宝扫码'}</p>
                    <p className="text-[10px] text-gray-400 mt-1">暂无收款码</p>
                  </div>
                </div>
              )}
            </div>

            {/* 已完成支付按钮 */}
            <button
              onClick={handleClose}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:shadow-green-200/40 transition-all active:scale-[0.98]"
            >
              已完成支付 ✅
            </button>

            <p className="text-center text-[10px] text-gray-300 mt-3">
              支付成功后页面将自动刷新 · 如有问题请联系客服
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
