import { describe, expect, it } from 'vitest';
import { activateSubscription, reconcileUserEntitlements } from '@/lib/payment/subscription';

function createMockSupabase(user: Record<string, unknown>, orders: Array<Record<string, unknown>> = []) {
  const updates: Array<Record<string, unknown>> = [];
  const transactions: Array<Record<string, unknown>> = [];

  const sb = {
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: user, error: null }),
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: async () => {
              Object.assign(user, payload);
              updates.push(payload);
              return { error: null };
            },
          }),
        };
      }

      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: async () => ({ data: orders, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'credit_transactions') {
        return {
          insert: async (payload: Record<string, unknown>) => {
            transactions.push(payload);
            return { error: null };
          },
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
  };

  return { sb, user, updates, transactions };
}

describe('payment subscription service', () => {
  it('adds upgrade credits on top of the current balance', async () => {
    const { sb, user, transactions } = createMockSupabase({
      id: 'user-1',
      credits: 120,
      plan_type: 'basic',
      plan_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const result = await activateSubscription(sb, 'user-1', 'advanced', 'monthly', 1500);

    expect(result.success).toBe(true);
    expect(user.credits).toBe(1620);
    expect(user.plan_type).toBe('pro');
    expect(transactions.at(-1)?.amount).toBe(1500);
  });

  it('extends the current expiry when renewing the same plan', async () => {
    const currentExpire = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const { sb, user, transactions } = createMockSupabase({
      id: 'user-renew',
      credits: 80,
      plan_type: 'basic',
      plan_expires_at: currentExpire.toISOString(),
    });

    const result = await activateSubscription(sb, 'user-renew', 'shengxin', 'monthly', 500, 'ORD_RENEW', 'renew');

    expect(result.success).toBe(true);
    expect(user.credits).toBe(580);
    expect(user.plan_type).toBe('plus');
    expect(new Date(String(user.plan_expires_at)).getTime()).toBeGreaterThan(currentExpire.getTime());
    expect(transactions.at(-1)?.description).toContain('续费省心会员');
  });

  it('resets free monthly credits once a free cycle has elapsed', async () => {
    const old = new Date();
    old.setMonth(old.getMonth() - 2);
    const { sb, user, transactions } = createMockSupabase({
      id: 'user-2',
      credits: 3,
      plan_type: 'free',
      created_at: old.toISOString(),
      free_cycle_anchor: old.toISOString(),
      free_credits_reset_at: old.toISOString(),
    });

    const result = await reconcileUserEntitlements(sb, 'user-2');

    expect(result.success).toBe(true);
    expect(result.changed).toBe(true);
    expect(user.credits).toBe(40);
    expect(transactions.at(-1)?.type).toBe('free_monthly_reset');
    expect(transactions.at(-1)?.balance_after).toBe(40);
  });
});
