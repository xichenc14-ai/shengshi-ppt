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

interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  showLogin: boolean;
  showPayment: boolean;
  paymentPlan: { id: string; name: string; price: string } | null;
  login: (user: UserInfo) => void;
  logout: () => void;
  updateCredits: (credits: number) => void;
  updateUser: (data: Partial<UserInfo>) => void;
  openLogin: () => void;
  closeLogin: () => void;
  openPayment: (plan: { id: string; name: string; price: string }) => void;
  closePayment: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<{ id: string; name: string; price: string } | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem('sx_user');
      if (s) setUser(JSON.parse(s));
    } catch {}
    setLoading(false);
  }, []);

  const login = useCallback((u: UserInfo) => {
    setUser(u);
    localStorage.setItem('sx_user', JSON.stringify(u));
    setShowLogin(false);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('sx_user');
  }, []);

  const updateCredits = useCallback((credits: number) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, credits };
      localStorage.setItem('sx_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateUser = useCallback((data: Partial<UserInfo>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      localStorage.setItem('sx_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const openLogin = useCallback(() => setShowLogin(true), []);
  const closeLogin = useCallback(() => setShowLogin(false), []);
  const openPayment = useCallback((plan: { id: string; name: string; price: string }) => {
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
