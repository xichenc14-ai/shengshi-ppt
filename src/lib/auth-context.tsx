'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export interface UserInfo {
  id: string;
  phone: string;
  nickname: string;
  credits: number;
  plan_type: string;
  has_subscription?: boolean;
  is_new?: boolean;
  is_active?: boolean;
}

interface PaymentPlan {
  id: string;
  name: string;
  price: string;
  billing?: string;
  reason?: string;
  neededCredits?: number;
  currentCredits?: number;
}

interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  showLogin: boolean;
  showPayment: boolean;
  paymentPlan: PaymentPlan | null;
  login: (user: UserInfo) => void;
  logout: () => void;
  updateCredits: (credits: number) => void;
  updateUser: (data: Partial<UserInfo>) => void;
  openLogin: () => void;
  closeLogin: () => void;
  openPayment: (plan: PaymentPlan) => void;
  closePayment: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan | null>(null);

  // 从服务端session恢复用户状态
  useEffect(() => {
    fetch('/api/session')
      .then(res => res.json())
      .then(data => {
        if (data.isLoggedIn && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 迁移旧localStorage用户到cookie（一次性）
  useEffect(() => {
    if (loading) return;
    try {
      const old = localStorage.getItem('sx_user');
      if (old && !user) {
        const parsed = JSON.parse(old);
        // 一次性迁移：写入服务端session，然后清理localStorage
        fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login', user: parsed }),
        }).then(() => {
          localStorage.removeItem('sx_user');
          setUser(parsed);
        }).catch(() => {});
      } else if (!old && user) {
        // 已有session，确保localStorage干净
        localStorage.removeItem('sx_user');
      }
    } catch {}
  }, [loading, user]);

  const login = useCallback((u: UserInfo) => {
    setUser(u);
    setShowLogin(false);
    // 写入服务端httpOnly cookie
    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', user: u }),
    }).catch(() => {});
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    // 销毁服务端session
    fetch('/api/session', { method: 'DELETE' }).catch(() => {});
  }, []);

  const updateCredits = useCallback((credits: number) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, credits };
      fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', user: { credits } }),
      }).catch(() => {});
      return updated;
    });
  }, []);

  const updateUser = useCallback((data: Partial<UserInfo>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', user: data }),
      }).catch(() => {});
      return updated;
    });
  }, []);

  const openLogin = useCallback(() => setShowLogin(true), []);
  const closeLogin = useCallback(() => setShowLogin(false), []);
  const openPayment = useCallback((plan: PaymentPlan) => {
    setPaymentPlan(plan);
    setShowPayment(true);
  }, []);
  const closePayment = useCallback(() => {
    setShowPayment(false);
    setPaymentPlan(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, showLogin, showPayment, paymentPlan,
      login, logout, updateCredits, updateUser,
      openLogin, closeLogin, openPayment, closePayment,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
