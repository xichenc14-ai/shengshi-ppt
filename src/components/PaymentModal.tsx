'use client';

import React, { useState } from 'react';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  plan: { id: string; name: string; price: string; billing?: string; reason?: string; neededCredits?: number; currentCredits?: number } | null;
}

// Step 1: 选择支付方式 | Step 2: 确认并扫码
type Step = 'select' | 'confirm';

export default function PaymentModal({ open, onClose, plan }: PaymentModalProps) {
  const [payMethod, setPayMethod] = useState<'wechat' | 'alipay'>('wechat');
  const [step, setStep] = useState<Step>('select');
  const [submitting, setSubmitting] = useState(false);

  const handleNext = async () => {
    if (!plan) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, payMethod, billing: plan.billing || 'monthly' }),
      });
      const data = await res.json();
      if (data.order_no || data.qr_url) {
        setStep('confirm');
      } else if (data.error) {
        alert(data.error);
      }
    } catch {
      alert('创建订单失败');
    }
    setSubmitting(false);
  };

  const handleClose = () => {
    setStep('select');
    onClose();
  };

  // ESC key to close
  React.useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open]);

  if (!open || !plan) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] max-w-[90vw] animate-modal-in overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Step 1: 选择支付方式 */}
        {step === 'select' && (
          <div className="p-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900">开通套餐</h3>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all active:scale-90"
                aria-label="关闭"
              >
                <span className="text-sm leading-none">✕</span>
              </button>
            </div>

            {/* Insufficient credits notice */}
            {plan.reason && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-amber-700 font-medium">⚡ {plan.reason}</p>
                {plan.neededCredits && plan.currentCredits !== undefined && (
                  <p className="text-[10px] text-amber-500 mt-1">当前积分：{plan.currentCredits}，需要：{plan.neededCredits}，差额：{plan.neededCredits - plan.currentCredits}</p>
                )}
              </div>
            )}

            {/* Plan info */}
            <div className="bg-[#F5F3FF] rounded-xl p-4 mb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">{plan.name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">立即生效，按月计费</p>
                </div>
                <div className="text-2xl font-extrabold text-[#5B4FE9]">{plan.price}</div>
              </div>
            </div>

            {/* Payment methods */}
            <div className="space-y-2 mb-5">
              <button
                onClick={() => setPayMethod('wechat')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  payMethod === 'wechat' ? 'border-[#07C160] bg-green-50/50 shadow-sm' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#07C160] flex items-center justify-center text-white text-sm font-bold shadow-sm">微</div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-gray-800">微信支付</p>
                  <p className="text-[10px] text-gray-400">推荐微信用户使用</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  payMethod === 'wechat' ? 'border-[#07C160] bg-[#07C160]' : 'border-gray-200'
                }`}>
                  {payMethod === 'wechat' && <span className="text-white text-[8px] leading-none">✓</span>}
                </div>
              </button>

              <button
                onClick={() => setPayMethod('alipay')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  payMethod === 'alipay' ? 'border-[#1677FF] bg-blue-50/50 shadow-sm' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#1677FF] flex items-center justify-center text-white text-sm font-bold shadow-sm">支</div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-gray-800">支付宝</p>
                  <p className="text-[10px] text-gray-400">支持花呗分期</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  payMethod === 'alipay' ? 'border-[#1677FF] bg-[#1677FF]' : 'border-gray-200'
                }`}>
                  {payMethod === 'alipay' && <span className="text-white text-[8px] leading-none">✓</span>}
                </div>
              </button>
            </div>

            {/* Next button */}
            <button
              onClick={handleNext}
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-purple-300/40 transition-all active:scale-[0.98] disabled:opacity-40"
            >
              {submitting ? (
                <span className="loading-dots"><span /> <span /> <span /></span>
              ) : (
                <>下一步 →"
                </>
              )}
            </button>

            <p className="text-center text-[10px] text-gray-400 mt-3">
              支付即表示同意《用户协议》和《隐私政策》
            </p>
          </div>
        )}

        {/* Step 2: 确认并扫码 */}
        {step === 'confirm' && (
          <div className="p-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => setStep('select')}
                className="flex items-center gap-1.5 text-sm text-[#5B4FE9] hover:text-[#4338CA] transition-colors"
              >
                <span>←</span> 返回
              </button>
              <h3 className="text-base font-bold text-gray-900">确认支付</h3>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all active:scale-90"
                aria-label="关闭"
              >
                <span className="text-sm leading-none">✕</span>
              </button>
            </div>

            {/* Order summary */}
            <div className="bg-[#F5F3FF] rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">订单内容</span>
                <span className="text-sm font-semibold text-gray-800">{plan.name}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">支付方式</span>
                <span className="text-xs font-medium text-gray-700">{payMethod === 'wechat' ? '微信支付' : '支付宝'}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[#DDD6FE]">
                <span className="text-xs text-gray-500">应付金额</span>
                <span className="text-xl font-extrabold text-[#5B4FE9]">{plan.price}</span>
              </div>
            </div>

            {/* QR Code */}
            <div className="bg-gray-50 rounded-xl p-6 mb-4 text-center">
              <div className="w-48 h-48 mx-auto bg-white border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center mb-3 animate-breathe">
                <div className="text-center">
                  <div className="text-4xl mb-2">{payMethod === 'wechat' ? '💚' : '🔵'}</div>
                  <p className="text-xs text-gray-400 font-medium">{payMethod === 'wechat' ? '微信扫码' : '支付宝扫码'}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                使用{payMethod === 'wechat' ? '微信' : '支付宝'}扫描上方二维码完成支付
              </p>
            </div>

            {/* Confirm pay button */}
            <button
              onClick={handleClose}
              className="w-full py-3 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-purple-300/40 transition-all active:scale-[0.98]"
            >
              已完成支付 ✅
            </button>

            <p className="text-center text-[10px] text-gray-400 mt-3">
              支付成功后页面将自动更新 · 如有问题请联系客服
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
