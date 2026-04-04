'use client';

import React, { useState } from 'react';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  plan: { id: string; name: string; price: string } | null;
}

export default function PaymentModal({ open, onClose, plan }: PaymentModalProps) {
  const [payMethod, setPayMethod] = useState<'wechat' | 'alipay'>('wechat');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!plan) return;
    setSubmitting(true);
    try {
      // TODO: 接入真实支付
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, payMethod }),
      });
      const data = await res.json();
      if (data.order_no) {
        alert(`订单已创建（${data.order_no}），支付功能即将上线！`);
      }
    } catch {
      alert('创建订单失败');
    }
    setSubmitting(false);
  };

  if (!open || !plan) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] max-w-[90vw] animate-modal-in" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-gray-900">开通套餐</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
          </div>

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
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                payMethod === 'wechat' ? 'border-[#07C160] bg-green-50/50' : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-[#07C160] flex items-center justify-center text-white text-xs font-bold">微</div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-800">微信支付</p>
                <p className="text-[10px] text-gray-400">推荐微信用户使用</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${payMethod === 'wechat' ? 'border-[#07C160]' : 'border-gray-200'}`}>
                {payMethod === 'wechat' && <div className="w-2.5 h-2.5 rounded-full bg-[#07C160]" />}
              </div>
            </button>

            <button
              onClick={() => setPayMethod('alipay')}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                payMethod === 'alipay' ? 'border-[#1677FF] bg-blue-50/50' : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-[#1677FF] flex items-center justify-center text-white text-xs font-bold">支</div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-800">支付宝</p>
                <p className="text-[10px] text-gray-400">支持花呗分期</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${payMethod === 'alipay' ? 'border-[#1677FF]' : 'border-gray-200'}`}>
                {payMethod === 'alipay' && <div className="w-2.5 h-2.5 rounded-full bg-[#1677FF]" />}
              </div>
            </button>
          </div>

          {/* QR placeholder */}
          <div className="bg-gray-50 rounded-xl p-8 mb-5 text-center">
            <div className="w-32 h-32 mx-auto bg-white border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center mb-3">
              <div className="text-center">
                <div className="text-2xl mb-1">{payMethod === 'wechat' ? '💚' : '🔵'}</div>
                <p className="text-[10px] text-gray-400">二维码占位</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              {payMethod === 'wechat' ? '微信扫码支付功能即将上线' : '支付宝扫码支付功能即将上线'}
            </p>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-purple-300/40 transition-all disabled:opacity-40"
          >
            {submitting ? '...' : `确认支付 ${plan.price}`}
          </button>

          <p className="text-center text-[10px] text-gray-400 mt-3">
            支付即表示同意《用户协议》和《隐私政策》
          </p>
        </div>
      </div>
    </div>
  );
}
