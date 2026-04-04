'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';

const LOGIN_TABS = ['wechat', 'account', 'phone'] as const;

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const { login } = useAuth();
  const [tab, setTab] = useState<typeof LOGIN_TABS[number]>('wechat');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [wechatHint, setWechatHint] = useState(false);
  // Account login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const sendCode = async () => {
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) { setError('请输入正确的手机号'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_code', phone }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      setCodeSent(true);
      setCountdown(60);
      // MVP: show code in console for testing
      if (data.code) console.log('[DEV] 验证码:', data.code);
    } catch { setError('发送失败'); }
    setLoading(false);
  };

  const handleVerifyLogin = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) { setError('请输入6位验证码'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_code', phone, code: fullCode }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      if (data.user) login(data.user);
    } catch { setError('登录失败'); }
    setLoading(false);
  };

  // Quick login (MVP fallback)
  const handleQuickLogin = async () => {
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) { setError('请输入正确的手机号'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', phone }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      if (data.user) login(data.user);
    } catch { setError('登录失败'); }
    setLoading(false);
  };

  // Account password login
  const handleAccountLogin = async () => {
    if (!username.trim()) { setError('请输入用户名'); return; }
    if (!password.trim()) { setError('请输入密码'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'password_login', username, password }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      if (data.user) login(data.user);
    } catch { setError('登录失败'); }
    setLoading(false);
  };

  const handleCodeInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    // Auto-focus next
    if (value && index < 5) codeRefs.current[index + 1]?.focus();
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handleClose = () => {
    onClose();
    setPhone('');
    setCode(['', '', '', '', '', '']);
    setCountdown(0);
    setCodeSent(false);
    setError('');
    setUsername('');
    setPassword('');
    setShowPassword(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[360px] max-w-[90vw] animate-modal-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="text-center pt-8 pb-4 px-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-purple-200/50">
            <span className="text-white text-lg font-bold">P</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900">登录省心PPT</h3>
          <p className="text-xs text-gray-400 mt-1">登录即送 100 积分</p>
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-1 bg-gray-100 mx-6 rounded-xl p-1 mb-5">
          {LOGIN_TABS.map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
            >
              {t === 'wechat' ? '微信登录' : t === 'account' ? '账号登录' : '手机号登录'}
            </button>
          ))}
        </div>

        <div className="px-6 pb-6">
          {/* WeChat login */}
          {tab === 'wechat' && (
            <div className="text-center">
              <button
                onClick={() => setWechatHint(true)}
                className="w-full py-3.5 bg-[#07C160] text-white rounded-xl text-sm font-semibold hover:bg-[#06AD56] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-100/50"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05a6.293 6.293 0 0 1-.261-1.82c0-3.572 3.193-6.468 7.13-6.468.239 0 .473.016.706.034C16.879 4.707 13.163 2.188 8.691 2.188zm5.396 16.496c-.254 0-.507-.018-.758-.04l.042-.002c-.093.007-.187.013-.282.013a7.942 7.942 0 0 1-2.395-.37.644.644 0 0 0-.537.073l-1.428.838a.246.246 0 0 1-.125.04.22.22 0 0 1-.218-.221c0-.054.022-.108.036-.16l.293-1.114a.444.444 0 0 0-.16-.5C6.883 16.14 5.86 14.485 5.86 12.626c0-3.393 3.086-6.14 6.9-6.14 3.815 0 6.9 2.747 6.9 6.14 0 3.393-3.085 6.058-6.573 6.058z"/></svg>
                微信一键登录
              </button>

              {wechatHint && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl animate-fade-in">
                  <p className="text-xs text-amber-700">📱 微信登录功能即将上线，敬请期待！</p>
                  <p className="text-[10px] text-amber-500 mt-1">目前请使用账号或手机号登录</p>
                </div>
              )}

              <div className="mt-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[10px] text-gray-400">或</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="mt-4 flex items-center justify-center gap-4">
                <button onClick={() => setTab('account')} className="text-xs text-[#5B4FE9] hover:underline">使用账号登录</button>
                <button onClick={() => setTab('phone')} className="text-xs text-[#5B4FE9] hover:underline">使用手机号登录</button>
              </div>
            </div>
          )}

          {/* Account login */}
          {tab === 'account' && (
            <div>
              {/* Username input */}
              <div className="relative mb-4">
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  placeholder="请输入用户名"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] outline-none text-sm transition-all"
                  onKeyDown={e => { if (e.key === 'Enter') handleAccountLogin(); }}
                />
              </div>

              {/* Password input */}
              <div className="relative mb-4">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="请输入密码"
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 border border-gray-200 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] outline-none text-sm transition-all"
                  onKeyDown={e => { if (e.key === 'Enter') handleAccountLogin(); }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>

              {/* Account login button */}
              <button
                onClick={handleAccountLogin}
                disabled={!username.trim() || !password.trim() || loading}
                className="w-full py-3 bg-[#5B4FE9] text-white rounded-xl text-sm font-semibold hover:bg-[#4F46E5] transition-colors disabled:opacity-40"
              >
                {loading ? '...' : '登录'}
              </button>

              {error && <p className="text-center text-xs text-red-500 mt-3">{error}</p>}
            </div>
          )}

          {/* Phone login */}
          {tab === 'phone' && (
            <div>
              {/* Phone input */}
              <div className="relative mb-4">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setCodeSent(false); setCode(['', '', '', '', '', '']); setError(''); }}
                  placeholder="请输入手机号"
                  maxLength={11}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] outline-none text-sm transition-all"
                />
              </div>

              {/* Code input (6 boxes) */}
              {codeSent && (
                <div className="mb-4 animate-fade-in">
                  <div className="flex gap-2 justify-center">
                    {code.map((c, i) => (
                      <input
                        key={i}
                        ref={el => { codeRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={c}
                        onChange={e => handleCodeInput(i, e.target.value)}
                        onKeyDown={e => handleCodeKeyDown(i, e)}
                        className="w-10 h-12 text-center text-lg font-bold rounded-xl border border-gray-200 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] outline-none transition-all"
                      />
                    ))}
                  </div>
                  <button onClick={sendCode} disabled={countdown > 0} className="mt-2 text-xs text-[#5B4FE9] hover:underline disabled:text-gray-300 disabled:no-underline">
                    {countdown > 0 ? `${countdown}s 后重新发送` : '重新发送验证码'}
                  </button>
                </div>
              )}

              {/* Actions */}
              {codeSent ? (
                <button
                  onClick={handleVerifyLogin}
                  disabled={code.join('').length !== 6 || loading}
                  className="w-full py-3 bg-[#5B4FE9] text-white rounded-xl text-sm font-semibold hover:bg-[#4F46E5] transition-colors disabled:opacity-40"
                >
                  {loading ? '...' : '验证登录'}
                </button>
              ) : (
                <button
                  onClick={sendCode}
                  disabled={!phone || !/^1[3-9]\d{9}$/.test(phone) || loading}
                  className="w-full py-3 bg-[#5B4FE9] text-white rounded-xl text-sm font-semibold hover:bg-[#4F46E5] transition-colors disabled:opacity-40"
                >
                  {loading ? '...' : '获取验证码'}
                </button>
              )}

              {/* Quick login fallback */}
              <div className="mt-3 text-center">
                <button
                  onClick={handleQuickLogin}
                  disabled={!phone || !/^1[3-9]\d{9}$/.test(phone) || loading}
                  className="text-[10px] text-gray-400 hover:text-[#5B4FE9] transition-colors disabled:text-gray-300"
                >
                  快速登录（无需验证码）
                </button>
              </div>

              {error && <p className="text-center text-xs text-red-500 mt-3">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
