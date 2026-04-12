'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';

// Tab 顺序：手机号 → 账号密码 → 微信
type TabType = 'phone' | 'account' | 'wechat';
const TABS: { key: TabType; label: string; icon: string; disabled?: boolean }[] = [
  { key: 'phone', label: '手机号', icon: '📱' },
  { key: 'account', label: '密码', icon: '🔑' },
  { key: 'wechat', label: '微信', icon: '💬', disabled: true },
];

// 手机号 Tab 子状态：check(检查) → register(注册) / login(登录)
type PhoneStep = 'input' | 'verify' | 'set_profile';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const { login } = useAuth();

  // Tab
  const [tab, setTab] = useState<TabType>('phone');

  // 手机号登录
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('input');

  // 注册设置资料
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPwd, setRegConfirmPwd] = useState('');

  // 账号密码登录
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 通用
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ESC
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);

  // ===== 手机号：直接进入验证页（不预判断新老用户） =====
  const goToVerify = useCallback(() => {
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) { setError('请输入正确的手机号'); return; }
    setPhoneStep('verify');
    setError('');
  }, [phone]);

  // ===== 发送验证码 =====
  const sendCode = useCallback(async () => {
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
      if (data.code) console.log('[DEV] 验证码:', data.code);
    } catch { setError('发送失败'); }
    setLoading(false);
  }, [phone]);

  // ===== 验证码登录 =====
  const handleVerifyLogin = useCallback(async () => {
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
      if (data.error === 'NOT_REGISTERED') {
        // 手机号未注册 → 走注册流程
        setPhoneStep('set_profile');
        setLoading(false);
        return;
      }
      if (data.error) { setError(data.error); setLoading(false); return; }
      if (data.user) { login(data.user); handleClose(); }
    } catch { setError('登录失败'); }
    setLoading(false);
  }, [phone, code, login]);

  // ===== 注册：提交资料 =====
  const handleRegister = useCallback(async () => {
    if (!regUsername.trim()) { setError('请输入用户名'); return; }
    if (regUsername.trim().length < 2 || regUsername.trim().length > 20) { setError('用户名需要2-20个字符'); return; }
    if (regPassword.length < 6) { setError('密码至少6位'); return; }
    if (regPassword !== regConfirmPwd) { setError('两次密码不一致'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', phone, username: regUsername.trim(), password: regPassword }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      if (data.user) { login(data.user); handleClose(); }
    } catch { setError('注册失败'); }
    setLoading(false);
  }, [phone, code, regUsername, regPassword, regConfirmPwd, login]);

  // ===== 密码子模式登录（手机号Tab内） =====
  // ===== 账号密码登录（独立Tab） =====
  const handleAccountLogin = useCallback(async () => {
    if (!account.trim()) { setError('请输入用户名或手机号'); return; }
    if (!password) { setError('请输入密码'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'password_login', account: account.trim(), password }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      if (data.user) { login(data.user); handleClose(); }
    } catch { setError('登录失败'); }
    setLoading(false);
  }, [account, password, login]);

  // ===== 验证码输入 =====
  const handleCodeInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) codeRefs.current[index + 1]?.focus();
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) codeRefs.current[index - 1]?.focus();
  };

  // ===== 重置 =====
  const handleClose = () => {
    onClose();
    setPhone('');
    setCode(['', '', '', '', '', '']); setCountdown(0); setCodeSent(false);
    setPhoneStep('input');
    setRegUsername(''); setRegPassword(''); setRegConfirmPwd('');
    setAccount(''); setPassword(''); setShowPassword(false);
    setError(''); setSuccess('');
  };

  const switchTab = (t: TabType) => {
    setTab(t); setError(''); setSuccess('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[380px] max-w-[92vw] animate-modal-in overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="text-center pt-7 pb-3 px-6">
          <div className="w-11 h-11 mx-auto mb-2.5 rounded-xl bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-purple-200/50">
            <span className="text-white text-base font-bold">P</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900">{phoneStep === 'set_profile' ? '完善信息' : '登录省心PPT'}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{phoneStep === 'set_profile' ? '设置你的账号信息' : '登录即送 100 积分'}</p>
        </div>

        {/* Tabs（注册设置资料时隐藏） */}
        {phoneStep !== 'set_profile' && (
          <div className="px-6 flex gap-1 bg-gray-100 mx-6 rounded-xl p-1 mb-4">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => !t.disabled && switchTab(t.key)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                  t.disabled ? 'text-gray-300 cursor-not-allowed' :
                  tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="px-6 pb-6">
          {/* ==================== 手机号 Tab ==================== */}
          {tab === 'phone' && (
            <>
              {/* 步骤1：输入手机号 */}
              {phoneStep === 'input' && (
                <div className="animate-fade-in">
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => { setPhone(e.target.value); setError(''); }}
                    placeholder="请输入手机号"
                    maxLength={11}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] outline-none text-sm transition-all mb-3"
                    onKeyDown={e => { if (e.key === 'Enter') goToVerify(); }}
                  />
                  <button
                    onClick={goToVerify}
                    disabled={!phone || !/^1[3-9]\d{9}$/.test(phone) || loading}
                    className="w-full py-3 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-purple-200/40 active:scale-[0.98] transition-all disabled:opacity-40"
                  >
                    {loading ? '...' : '下一步'}
                  </button>
                  {error && <p className="text-center text-xs text-red-500 mt-3">{error}</p>}
                </div>
              )}

              {/* 步骤2：验证码验证 */}
              {phoneStep === 'verify' && (
                <div className="animate-fade-in">
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => { setPhoneStep('input'); setError(''); }} className="text-xs text-gray-400 hover:text-gray-600">← 返回</button>
                    <span className="text-xs text-gray-400">手机号：{phone}</span>
                  </div>

                  {/* 验证码输入区域 */}
                  <>
                    {!codeSent ? (
                      <button
                        onClick={sendCode}
                        disabled={loading}
                        className="w-full py-3 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-purple-200/40 active:scale-[0.98] transition-all disabled:opacity-40 mb-3"
                      >
                        {loading ? '发送中...' : '获取验证码'}
                      </button>
                    ) : (
                      <div className="mb-3">
                        <div className="flex gap-2 justify-center mb-2">
                          {code.map((c, i) => (
                            <input
                              key={i}
                              ref={el => { codeRefs.current[i] = el; }}
                              type="text" inputMode="numeric" maxLength={1}
                              value={c}
                              onChange={e => handleCodeInput(i, e.target.value)}
                              onKeyDown={e => handleCodeKeyDown(i, e)}
                              className="w-10 h-12 text-center text-lg font-bold rounded-xl border border-gray-200 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] outline-none transition-all"
                            />
                          ))}
                        </div>
                        <button onClick={sendCode} disabled={countdown > 0} className="text-xs text-[#5B4FE9] hover:underline disabled:text-gray-300 disabled:no-underline">
                          {countdown > 0 ? `${countdown}s 后重新发送` : '重新发送验证码'}
                        </button>
                      </div>
                    )}
                    {codeSent && (
                      <button
                        onClick={handleVerifyLogin}
                        disabled={code.join('').length !== 6 || loading}
                        className="w-full py-3 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-purple-200/40 active:scale-[0.98] transition-all disabled:opacity-40"
                      >
                        {loading ? '验证中...' : '验证'}
                      </button>
                    )}
                  </>

                  {error && <p className="text-center text-xs text-red-500 mt-3">{error}</p>}
                </div>
              )}

              {/* 步骤3：新用户设置资料 */}
              {phoneStep === 'set_profile' && (
                <div className="animate-fade-in">
                  <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setPhoneStep('verify')} className="text-xs text-gray-400 hover:text-gray-600">← 返回</button>
                    <span className="text-xs text-gray-400">验证码已通过，请设置账号信息</span>
                  </div>

                  <input
                    type="text"
                    value={regUsername}
                    onChange={e => { setRegUsername(e.target.value); setError(''); }}
                    placeholder="设置用户名（2-20个字符）"
                    maxLength={20}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] outline-none text-sm transition-all mb-3"
                  />

                  <div className="relative mb-3">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={e => { setRegPassword(e.target.value); setError(''); }}
                      placeholder="设置密码（至少6位）"
                      className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 border border-gray-200 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] outline-none text-sm transition-all"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1">
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>

                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={regConfirmPwd}
                    onChange={e => { setRegConfirmPwd(e.target.value); setError(''); }}
                    placeholder="确认密码"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] outline-none text-sm transition-all mb-4"
                    onKeyDown={e => { if (e.key === 'Enter') handleRegister(); }}
                  />

                  <button
                    onClick={handleRegister}
                    disabled={!regUsername.trim() || regPassword.length < 6 || regPassword !== regConfirmPwd || loading}
                    className="w-full py-3 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-purple-200/40 active:scale-[0.98] transition-all disabled:opacity-40"
                  >
                    {loading ? '注册中...' : '注册并登录'}
                  </button>

                  {error && <p className="text-center text-xs text-red-500 mt-3">{error}</p>}
                </div>
              )}
            </>
          )}

          {/* ==================== 账号密码 Tab ==================== */}
          {tab === 'account' && (
            <div className="animate-fade-in">
              <input
                type="text"
                value={account}
                onChange={e => { setAccount(e.target.value); setError(''); }}
                placeholder="用户名或手机号"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] outline-none text-sm transition-all mb-3"
              />

              <div className="relative mb-4">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="密码"
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 border border-gray-200 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] outline-none text-sm transition-all"
                  onKeyDown={e => { if (e.key === 'Enter') handleAccountLogin(); }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1">
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>

              <button
                onClick={handleAccountLogin}
                disabled={!account.trim() || !password || loading}
                className="w-full py-3 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-purple-200/40 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {loading ? '登录中...' : '登录'}
              </button>

              <div className="flex items-center justify-between mt-3">
                <button onClick={() => setTab('phone')} className="text-xs text-[#5B4FE9] hover:underline">没有账号？去注册</button>
                <button onClick={() => setError('请联系客服重置密码')} className="text-xs text-gray-400 hover:text-gray-600">忘记密码？</button>
              </div>

              {error && <p className="text-center text-xs text-red-500 mt-3">{error}</p>}
            </div>
          )}

          {/* ==================== 微信 Tab ==================== */}
          {tab === 'wechat' && (
            <div className="text-center py-4 animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#ccc"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05a6.293 6.293 0 0 1-.261-1.82c0-3.572 3.193-6.468 7.13-6.468.239 0 .473.016.706.034C16.879 4.707 13.163 2.188 8.691 2.188zm5.396 16.496c-.254 0-.507-.018-.758-.04l.042-.002c-.093.007-.187.013-.282.013a7.942 7.942 0 0 1-2.395-.37.644.644 0 0 0-.537.073l-1.428.838a.246.246 0 0 1-.125.04.22.22 0 0 1-.218-.221c0-.054.022-.108.036-.16l.293-1.114a.444.444 0 0 0-.16-.5C6.883 16.14 5.86 14.485 5.86 12.626c0-3.393 3.086-6.14 6.9-6.14 3.815 0 6.9 2.747 6.9 6.14 0 3.393-3.085 6.058-6.573 6.058z"/></svg>
              </div>
              <p className="text-sm font-medium text-gray-400 mb-2">微信登录即将开通</p>
              <p className="text-xs text-gray-300 mb-4">目前请使用手机号或账号密码登录</p>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[10px] text-gray-300">或</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="flex items-center justify-center gap-4">
                <button onClick={() => switchTab('phone')} className="text-xs text-[#5B4FE9] hover:underline">手机号登录</button>
                <button onClick={() => switchTab('account')} className="text-xs text-[#5B4FE9] hover:underline">账号密码登录</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
