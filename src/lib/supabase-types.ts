/**
 * src/lib/supabase-types.ts
 *
 * 完整的 Supabase Database 类型定义
 * 替代多处 `as unknown as Type` 的类型断言
 *
 * 生成时间: 2026-05-10
 * 版本: v10.44
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────
// Database Types
// ─────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          phone: string | null;
          nickname: string | null;
          credits: number | null;
          plan_type: string | null;
          plan_started_at: string | null;
          plan_expires_at: string | null;
          free_cycle_anchor: string | null;
          free_credits_reset_at: string | null;
          last_entitlement_sync_at: string | null;
          is_active: boolean | null;
          password_hash: string | null;
          last_login_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          phone?: string | null;
          nickname?: string | null;
          credits?: number | null;
          plan_type?: string | null;
          plan_started_at?: string | null;
          plan_expires_at?: string | null;
          free_cycle_anchor?: string | null;
          free_credits_reset_at?: string | null;
          last_entitlement_sync_at?: string | null;
          is_active?: boolean | null;
          password_hash?: string | null;
          last_login_at?: string | null;
        };
        Update: {
          id?: string;
          phone?: string | null;
          nickname?: string | null;
          credits?: number | null;
          plan_type?: string | null;
          plan_started_at?: string | null;
          plan_expires_at?: string | null;
          free_cycle_anchor?: string | null;
          free_credits_reset_at?: string | null;
          last_entitlement_sync_at?: string | null;
          is_active?: boolean | null;
          password_hash?: string | null;
          last_login_at?: string | null;
        };
      };
      credit_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          balance_after: number;
          type: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          balance_after: number;
          type: string;
          description?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          balance_after?: number;
          type?: string;
          description?: string | null;
        };
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          order_no: string;
          product_type: string;
          product_name: string | null;
          amount: number | null;
          status: string | null;
          pay_method: string | null;
          metadata: Record<string, unknown> | null;
          expires_at: string | null;
          paid_at: string | null;
          trade_no: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          order_no: string;
          product_type: string;
          product_name?: string | null;
          amount?: number | null;
          status?: string | null;
          pay_method?: string | null;
          metadata?: Record<string, unknown> | null;
          expires_at?: string | null;
          paid_at?: string | null;
          trade_no?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          order_no?: string;
          product_type?: string;
          product_name?: string | null;
          amount?: number | null;
          status?: string | null;
          pay_method?: string | null;
          metadata?: Record<string, unknown> | null;
          expires_at?: string | null;
          paid_at?: string | null;
          trade_no?: string | null;
        };
      };
      verification_codes: {
        Row: {
          id: string;
          phone: string;
          code: string;
          expires_at: string;
          verified: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          phone: string;
          code: string;
          expires_at: string;
          verified?: boolean;
        };
        Update: {
          id?: string;
          phone?: string;
          code?: string;
          expires_at?: string;
          verified?: boolean;
        };
      };
      ppt_feedback: {
        Row: {
          id: string;
          user_id: string;
          generation_id: string | null;
          vote: string;
          rating: number | null;
          comment: string | null;
          topic: string | null;
          ppt_title: string | null;
          page_count: number | null;
          image_mode: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          generation_id?: string | null;
          vote: string;
          rating?: number | null;
          comment?: string | null;
          topic?: string | null;
          ppt_title?: string | null;
          page_count?: number | null;
          image_mode?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          generation_id?: string | null;
          vote?: string;
          rating?: number | null;
          comment?: string | null;
          topic?: string | null;
          ppt_title?: string | null;
          page_count?: number | null;
          image_mode?: string | null;
        };
      };
    };
    Functions: {
      deduct_credits_atomic: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_description: string;
        };
        Returns: {
          new_balance: number;
        };
      };
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// ─────────────────────────────────────────────
// Typed Supabase Client Factory
// ─────────────────────────────────────────────

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * 创建类型安全的 Supabase 客户端
 */
export function createTypedClient(
  url: string,
  key: string
): TypedSupabaseClient {
  return createClient<Database>(url, key) as TypedSupabaseClient;
}

// ─────────────────────────────────────────────
// RPC Result Types
// ─────────────────────────────────────────────

export interface DeductCreditsResult {
  new_balance: number;
}

export interface RpcOptions {
  schema?: string;
}

// ─────────────────────────────────────────────
// Table Row Types
// ─────────────────────────────────────────────

export type UserRow = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type CreditTransactionRow = Database['public']['Tables']['credit_transactions']['Row'];
export type CreditTransactionInsert = Database['public']['Tables']['credit_transactions']['Insert'];

export type OrderRow = Database['public']['Tables']['orders']['Row'];
export type OrderInsert = Database['public']['Tables']['orders']['Insert'];
export type OrderUpdate = Database['public']['Tables']['orders']['Update'];

export type VerificationCodeRow = Database['public']['Tables']['verification_codes']['Row'];
export type PptFeedbackRow = Database['public']['Tables']['ppt_feedback']['Row'];
