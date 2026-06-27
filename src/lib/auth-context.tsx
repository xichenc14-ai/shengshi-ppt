'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export interface UserInfo {
  id: string;
  phone: string;
  nickname: string;
  avatar?: string;
  credits: number;
  plan_type: string;
  plan_expires_at?: string | null;
  has_subscription?: boolean;
  is_new?: boolean;
  is_active?: boolean;
  is_admin?: boolean;
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
  login: (user: UserInfo, authToken?: string) => Promise<boolean>;
  logout: () => void;
  updateCredits: (credits: number) => void;
  updateUser: (data: Partial<UserInfo>) => void;
  refreshUser: (options?: { force?: boolean }) => Promise<UserInfo | null>;
  syncUserSnapshot: (snapshot: Partial<UserInfo>) => Promise<UserInfo | null>;
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
    fetch('/api/session', { cache: 'no-store' })
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
        }).then((res) => {
          localStorage.removeItem('sx_user');
          if (res.ok) setUser(parsed);
        }).catch(() => {
          localStorage.removeItem('sx_user');
        });
      } else if (!old && user) {
        // 已有session，确保localStorage干净
        localStorage.removeItem('sx_user');
      }
    } catch {}
  }, [loading, user]);

  const login = useCallback((u: UserInfo, authToken?: string) => {
    // 登录接口本身会原子写入 Session；先直接回读。保留 POST 仅兼容旧响应。
    return fetch('/api/session', { cache: 'no-store' })
      .then(async (syncRes) => {
        if (!syncRes.ok) return false;
        let syncData = await syncRes.json();
        if (syncData?.user?.id !== u.id) {
          const legacyRes = await fetch('/api/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', user: u, authToken }),
          });
          if (!legacyRes.ok) return false;
          const retryRes = await fetch('/api/session', { cache: 'no-store' });
          if (!retryRes.ok) return false;
          syncData = await retryRes.json();
        }
        if (syncData?.user?.id === u.id) {
          setUser(syncData.user);
          setShowLogin(false);
          return true;
        }
        return false;
      })
      .catch(() => false);
  }, []);

  const refreshUser = useCallback(async (options?: { force?: boolean }) => {
    try {
      const res = options?.force
        ? await fetch('/api/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', user: {} }),
            cache: 'no-store',
          })
        : await fetch('/api/session', { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      if ((data?.isLoggedIn || data?.success) && data?.user) {
        setUser(data.user);
        return data.user as UserInfo;
      }
      if (!data?.isLoggedIn) setUser(null);
      return null;
    } catch {
      return null;
    }
  }, []);

  const syncUserSnapshot = useCallback(async (snapshot: Partial<UserInfo>) => {
    setUser(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        ...snapshot,
        credits: Number(snapshot.credits ?? prev.credits ?? 0),
        plan_type: snapshot.plan_type || prev.plan_type || 'free',
      };
    });
    return await refreshUser({ force: true });
  }, [refreshUser]);

  useEffect(() => {
    const handleFocus = () => {
      void refreshUser();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshUser();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshUser]);

  const logout = useCallback(() => {
    setUser(null);
    // 销毁服务端session
    fetch('/api/session', { method: 'DELETE' }).catch(() => {});
  }, []);

  const updateCredits = useCallback((credits: number) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, credits };
      window.setTimeout(() => {
        void fetch('/api/session', { cache: 'no-store' })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.isLoggedIn && data?.user) setUser(data.user);
          })
          .catch(() => {});
      }, 300);
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
      refreshUser, syncUserSnapshot,
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
