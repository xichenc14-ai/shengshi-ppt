'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';

// 现代登录方式：手机号验证码 | 账号密码
type TabType = 'phone' | 'account';

const TABS: { key: TabType; label: string; icon: string }[] = [
  { key: 'phone', label: '验证码登录', icon: '📱' },
  { key: 'account', label: '密码登录', icon: '🔑' },
];

// 手机号流程：input(输入手机号) → verify(验证码) → profile(新用户设置资料)
type PhoneStep = 'input' | 'verify' | 'set_profile';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const { login } = useAuth();

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
  const [showPassword, setShowPassword] = useState(false);

  // 账号密码登录
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPwdLogin, setShowPwdLogin] = useState(false);

  // 通用状态
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);

  // 打开时聚焦手机号输入框
  useEffect(() => {
    if (open && tab === 'phone' && phoneStep === 'input') {
      setTimeout(() => {
        document.getElementById('login-phone-input')?.focus();
      }, 100);
    }
  }, [open, tab, phoneStep]);

  // 手机号格式化
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits;
  };

  const isValidPhone = (p: string) => /^1[3-9]\d{9}$/.test(p);

  // ===== 手机号：输入手机号 → 自动获取验证码 =====
  const goToVerify = useCallback(async () => {
    if (!phone || !isValidPhone(phone)) { setError('请输入正确的手机号'); return; }
    setLoading(true); setError(''); setAttemptsLeft(null);

    // 发送验证码
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
      setPhoneStep('verify');
      // 自动聚焦第一个验证码输入框
      setTimeout(() => codeRefs.current[0]?.focus(), 150);
    } catch { setError('发送失败，请检查网络'); }
    setLoading(false);
  }, [phone]);

  // ===== 重新发送验证码 =====
  const resendCode = useCallback(async () => {
    if (countdown > 0 || !phone) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_code', phone }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      setCountdown(60);
      setCode(['', '', '', '', '', '']);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch { setError('发送失败'); }
    setLoading(false);
  }, [phone, countdown]);

  // ===== 验证码输入 =====
  const handleCodeInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    // 自动跳到下一个输入框
    if (value && index < 5) codeRefs.current[index + 1]?.focus();
    // 6位输满自动验证
    if (value && index === 5) {
      const fullCode = [...newCode.slice(0, index), value].join('');
      if (fullCode.length === 6) {
        setTimeout(() => handleVerifyLogin(fullCode), 200);
      }
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (paste.length === 6) {
      const newCode = paste.split('');
      setCode(newCode);
      setTimeout(() => handleVerifyLogin(paste), 200);
    } else if (paste.length > 0) {
      const newCode = [...code];
      for (let i = 0; i < paste.length && i < 6; i++) {
        newCode[i] = paste[i];
      }
      setCode(newCode);
      const nextIdx = Math.min(paste.length, 5);
      codeRefs.current[nextIdx]?.focus();
    }
  };

  // ===== 验证码登录/注册分流 =====
  const handleVerifyLogin = useCallback(async (fullCode?: string) => {
    const fc = fullCode || code.join('');
    if (fc.length !== 6) { setError('请输入6位验证码'); return; }
    setLoading(true); setError(''); setAttemptsLeft(null);
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_code', phone, code: fc }),
      });
      const data = await res.json();
      if (data.error === 'NOT_REGISTERED') {
        setPhoneStep('set_profile');
        setLoading(false);
        setTimeout(() => document.getElementById('reg-username-input')?.focus(), 150);
        return;
      }
      if (data.error === 'NEED_SET_PASSWORD') {
        // 账号未设置密码，引导设置
        setPhone(phone);
        setPhoneStep('set_profile');
        setLoading(false);
        setTimeout(() => document.getElementById('reg-username-input')?.focus(), 150);
        return;
      }
      if (data.error) {
        setError(data.error);
        if (data.attemptsLeft !== undefined) setAttemptsLeft(data.attemptsLeft);
        setLoading(false);
        return;
      }
      if (data.user) { login(data.user); handleClose(); }
    } catch { setError('验证失败，请检查网络'); }
    setLoading(false);
  }, [phone, code, login]);

  // ===== 注册：提交资料 =====
  const handleRegister = useCallback(async () => {
    if (!regUsername.trim()) { setError('请输入用户名'); return; }
    if (regUsername.trim().length < 2 || regUsername.trim().length > 20) { setError('用户名需要2-20个字符'); return; }
    if (/[<>"'&]/.test(regUsername)) { setError('用户名包含非法字符'); return; }
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
    } catch { setError('注册失败，请检查网络'); }
    setLoading(false);
  }, [phone, regUsername, regPassword, regConfirmPwd, login]);

  // ===== 账号密码登录 =====
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
    } catch { setError('登录失败，请检查网络'); }
    setLoading(false);
  }, [account, password, login]);

  // ===== 重置 =====
  const handleClose = () => {
    onClose();
    setPhone(''); setCode(['', '', '', '', '', '']); setCountdown(0); setCodeSent(false);
    setPhoneStep('input');
    setRegUsername(''); setRegPassword(''); setRegConfirmPwd(''); setShowPassword(false);
    setAccount(''); setPassword(''); setShowPwdLogin(false);
    setError(''); setAttemptsLeft(null);
  };

  const switchTab = (t: TabType) => {
    setTab(t); setError(''); setAttemptsLeft(null);
  };

  if (!open) return null;

  // ===== 遮罩输入的手机号（中间4位） =====
  const maskedPhone = phone.length === 11 ? `${phone.slice(0,3)}****${phone.slice(7)}` : phone;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-[400px] max-w-[92vw] animate-modal-in overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* 顶部渐变装饰条 */}
        <div className="h-1.5 bg-gradient-to-r from-[#5B4FE9] via-[#7C3AED] to-[#8B5CF6]" />

        {/* Header */}
        <div className="text-center pt-7 pb-3 px-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] flex items-center justify-center shadow-xl shadow-purple-200/60">
            <span className="text-white text-xl font-black">P</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900">
            {phoneStep === 'set_profile' ? '设置你的账号' : '欢迎来到省心PPT'}
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            {phoneStep === 'set_profile' ? '首次使用，快速设置即可' : '登录即送 50 积分，立即体验AI生成PPT'}
          </p>
        </div>

        {/* Tabs（注册设置资料时隐藏） */}
        {phoneStep !== 'set_profile' && (
          <div className="px-6 mb-4">
            <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => switchTab(t.key)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    tab === t.key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 pb-7">
          {/* ==================== 手机号验证码登录 ==================== */}
          {tab === 'phone' && (
            <>
              {/* 步骤1：输入手机号 */}
              {phoneStep === 'input' && (
                <div className="animate-fade-in">
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">手机号</label>
                  <div className="relative mb-4">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">+86</span>
                    <input
                      id="login-phone-input"
                      type="tel"
                      value={phone}
                      onChange={e => { setPhone(formatPhone(e.target.value)); setError(''); }}
                      placeholder="请输入手机号"
                      maxLength={11}
                      className="w-full pl-14 pr-4 py-3.5 rounded-2xl bg-[#FAFBFE] border border-gray-200 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] focus:bg-white outline-none text-sm transition-all"
                      onKeyDown={e => { if (e.key === 'Enter') goToVerify(); }}
                    />
                  </div>
                  <button
                    onClick={goToVerify}
                    disabled={!isValidPhone(phone) || loading}
                    className="w-full py-3.5 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:shadow-purple-300/40 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        发送中...
                      </span>
                    ) : '获取验证码'}
                  </button>
                  {error && <p className="text-center text-xs text-red-500 mt-3 flex items-center justify-center gap-1"><span>⚠️</span>{error}</p>}
                </div>
              )}

              {/* 步骤2：输入验证码 */}
              {phoneStep === 'verify' && (
                <div className="animate-fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => { setPhoneStep('input'); setError(''); }} className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                      返回
                    </button>
                    <span className="text-xs text-gray-400">验证码发送至 {maskedPhone}</span>
                  </div>

                  {/*                   {/* 验证码输入区域 - 透明overlay输入框，支持所有浏览器自动填充 */}
                  <div className="flex gap-2.5 justify-center mb-4">
                    <div className="relative flex gap-2.5">
                      {code.map((c, i) => (
                        <div key={i} className={`w-11 h-13 text-center text-xl font-bold rounded-xl border-2 transition-all select-none ${c ? 'border-[#5B4FE9] bg-[#F5F3FF] scale-105' : 'border-gray-200 bg-gray-50'}`}>
                          <span className="leading-[3rem]">{c}</span>
                        </div>
                      ))}
                      {/* 透明输入框覆盖格子，接收所有输入（键盘+粘贴+浏览器自动填充） */}
                      <input
                        ref={el => { codeRefs.current[0] = el; }}
                        id="sms-code-input"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="one-time-code"
                        enterKeyHint="done"
                        value={code.join('')}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          const digits = val.split('');
                          const newCode = ['', '', '', '', '', ''];
                          for (let i = 0; i < 6; i++) newCode[i] = digits[i] || '';
                          setCode(newCode);
                          if (val.length === 6) setTimeout(() => handleVerifyLogin(val), 200);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Backspace' && code.join('') === '') codeRefs.current[0]?.focus();
                          if (e.key === 'Enter') { const full = code.join(''); if (full.length === 6) handleVerifyLogin(full); }
                        }}
                        onPaste={e => {
                          e.preventDefault();
                          const paste = (e.clipboardData || (window as any).clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
                          const digits = paste.split('');
                          const newCode = ['', '', '', '', '', ''];
                          for (let i = 0; i < 6; i++) newCode[i] = digits[i] || '';
                          setCode(newCode);
                          if (paste.length === 6) setTimeout(() => handleVerifyLogin(paste), 200);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-text"
                        style={{ fontSize: '40px', letterSpacing: '2.2rem', paddingLeft: '8px' }}
                      />
                    </div>
                  </div>

                  {/* 重新发送 */}
                  <div className="text-center mb-4">
                    {countdown > 0 ? (
                      <span className="text-xs text-gray-400">{countdown}s 后可重新发送</span>
                    ) : (
                      <button onClick={resendCode} disabled={loading} className="text-xs text-[#5B4FE9] hover:text-[#4338CA] font-medium hover:underline disabled:text-gray-300">
                        重新发送验证码
                      </button>
                    )}
                  </div>

                  {/* 验证按钮 */}
                  <button
                    onClick={() => handleVerifyLogin()}
                    disabled={code.join('').length !== 6 || loading}
                    className="w-full py-3.5 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:shadow-purple-300/40 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        验证中...
                      </span>
                    ) : '验证并登录'}
                  </button>

                  {error && (
                    <p className="text-center text-xs text-red-500 mt-3 flex items-center justify-center gap-1">
                      <span>⚠️</span>{error}
                      {attemptsLeft !== null && attemptsLeft > 0 && (
                        <span className="text-gray-400 ml-1">（剩余 {attemptsLeft} 次）</span>
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* 步骤3：新用户设置资料 */}
              {phoneStep === 'set_profile' && (
                <div className="animate-fade-in">
                  <div className="flex items-center gap-2 mb-5">
                    <button onClick={() => setPhoneStep('verify')} className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                      返回
                    </button>
                    <span className="text-xs text-gray-400">手机号 {maskedPhone} 已验证 ✓</span>
                  </div>

                  {/* 用户名 */}
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">用户名</label>
                  <input
                    id="reg-username-input"
                    type="text"
                    value={regUsername}
                    onChange={e => { setRegUsername(e.target.value); setError(''); }}
                    placeholder="起一个好听的名字"
                    maxLength={20}
                    className="w-full px-4 py-3.5 rounded-2xl bg-[#FAFBFE] border border-gray-200 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] focus:bg-white outline-none text-sm transition-all mb-3"
                  />

                  {/* 密码 */}
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">设置密码</label>
                  <div className="relative mb-2">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={e => { setRegPassword(e.target.value); setError(''); }}
                      placeholder="至少6位密码"
                      className="w-full px-4 py-3.5 pr-12 rounded-2xl bg-[#FAFBFE] border border-gray-200 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] focus:bg-white outline-none text-sm transition-all"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>

                  {/* 确认密码 */}
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={regConfirmPwd}
                    onChange={e => { setRegConfirmPwd(e.target.value); setError(''); }}
                    placeholder="再次输入密码"
                    className={`w-full px-4 py-3.5 rounded-2xl border outline-none text-sm transition-all mb-4 ${
                      regConfirmPwd && regConfirmPwd !== regPassword
                        ? 'bg-red-50 border-red-200 focus:border-red-400'
                        : 'bg-[#FAFBFE] border-gray-200 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] focus:bg-white'
                    }`}
                    onKeyDown={e => { if (e.key === 'Enter') handleRegister(); }}
                  />
                  {regConfirmPwd && regConfirmPwd === regPassword && regConfirmPwd.length >= 6 && (
                    <p className="text-xs text-green-500 mb-3 -mt-2">✓ 密码一致</p>
                  )}

                  <button
                    onClick={handleRegister}
                    disabled={!regUsername.trim() || regPassword.length < 6 || regPassword !== regConfirmPwd || loading}
                    className="w-full py-3.5 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:shadow-purple-300/40 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        注册中...
                      </span>
                    ) : '注册并登录'}
                  </button>

                  {error && <p className="text-center text-xs text-red-500 mt-3 flex items-center justify-center gap-1"><span>⚠️</span>{error}</p>}
                </div>
              )}
            </>
          )}

          {/* ==================== 账号密码登录 ==================== */}
          {tab === 'account' && (
            <div className="animate-fade-in">
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">用户名或手机号</label>
              <input
                type="text"
                value={account}
                onChange={e => { setAccount(e.target.value); setError(''); }}
                placeholder="请输入用户名或手机号"
                className="w-full px-4 py-3.5 rounded-2xl bg-[#FAFBFE] border border-gray-200 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] focus:bg-white outline-none text-sm transition-all mb-3"
              />

              <label className="text-xs font-medium text-gray-500 mb-1.5 block">密码</label>
              <div className="relative mb-5">
                <input
                  type={showPwdLogin ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="请输入密码"
                  className="w-full px-4 py-3.5 pr-12 rounded-2xl bg-[#FAFBFE] border border-gray-200 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] focus:bg-white outline-none text-sm transition-all"
                  onKeyDown={e => { if (e.key === 'Enter') handleAccountLogin(); }}
                />
                <button type="button" onClick={() => setShowPwdLogin(!showPwdLogin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                  {showPwdLogin ? '🙈' : '👁️'}
                </button>
              </div>

              <button
                onClick={handleAccountLogin}
                disabled={!account.trim() || !password || loading}
                className="w-full py-3.5 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:shadow-purple-300/40 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    登录中...
                  </span>
                ) : '登录'}
              </button>

              <div className="flex items-center justify-between mt-3">
                <button onClick={() => setTab('phone')} className="text-xs text-[#5B4FE9] hover:underline font-medium">没有账号？验证码注册</button>
                <button onClick={() => setError('请联系客服重置密码')} className="text-xs text-gray-400 hover:text-gray-600">忘记密码？</button>
              </div>

              {error && <p className="text-center text-xs text-red-500 mt-3 flex items-center justify-center gap-1"><span>⚠️</span>{error}</p>}
            </div>
          )}
        </div>

        {/* 底部协议 */}
        {phoneStep !== 'set_profile' && (
          <div className="px-6 pb-5 pt-0">
            <p className="text-center text-[10px] text-gray-300">
              登录即表示同意 <a href="#" className="text-gray-400 hover:text-[#5B4FE9]">用户协议</a> 和 <a href="#" className="text-gray-400 hover:text-[#5B4FE9]">隐私政策</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
