import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllKeys, getKeyPoolStatus, selectBestKey } from '@/lib/gamma-key-pool';
import { requireAdmin } from '@/lib/admin-auth';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// GET: 查询 Gamma API 账户信息（管理/监控用）
// 注意：Gamma API 没有 /account 端点，余额从 key-pool 追踪
// 实时余额只能从生成任务的响应中获取
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason || '无权限' }, { status: auth.reason === '请先登录' ? 401 : 403 });
  }

  try {
    // 1. 获取 workspace 信息（/me 端点可用）
    const allKeys = await getAllKeys();
    let liveBalance: { remaining: number; deducted: number; generationId: string } | null = null;
    let apiKey = '';
    try {
      apiKey = (await selectBestKey()).key;
    } catch {
      apiKey = allKeys[0]?.key || '';
    }

    try {
      if (!apiKey) throw new Error('无可用 Gamma Key');

      // 尝试从 Supabase 获取最近的生成ID，查询Gamma实时余额
      try {
        const sb = getSupabase();
        if (sb) {
          const { data: genTx } = await sb
            .from('credit_transactions')
            .select('description')
            .eq('type', 'generation')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (genTx) {
            const genId = String((genTx as { description?: string }).description || '')
              .replace(/^生成结算-/, '').trim();
            if (genId) {
              const genRes = await fetch(`${GAMMA_API_BASE}/generations/${genId}`, {
                headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json', 'User-Agent': GAMMA_UA },
              });
              if (genRes.ok) {
                const genData = await genRes.json() as Record<string, unknown>;
                const credits = (genData.credits || {}) as Record<string, number>;
                if (typeof credits.remaining === 'number') {
                  liveBalance = { remaining: credits.remaining, deducted: credits.deducted || 0, generationId: genId };
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('[gamma-balance] live balance query failed:', e instanceof Error ? e.message : String(e));
      }
    } catch (e) {
      console.warn('[gamma-balance] /me fetch failed:', e instanceof Error ? e.message : String(e));
    }

    // 2. 获取 key pool 追踪的余额（基于历史生成响应，非实时）
    const poolStatus = await getKeyPoolStatus();
    const sharedRemaining = liveBalance?.remaining ?? poolStatus.sharedRemaining;

    return NextResponse.json({
      // workspace 信息
      // key pool 追踪的余额（历史值，非实时）
      keyPools: poolStatus.keys.map(k => ({
        label: k.label,
        remaining: k.remaining,
        status: k.status,
        quotaPoolTag: k.quotaPoolTag,
        countsTowardAdminQuota: k.countsTowardAdminQuota,
        lastUsed: k.lastUsed,
        successCount: k.successCount,
        failCount: k.failCount,
      })),
      totalRemaining: poolStatus.adminTotalRemaining,
      sharedRemaining,
      adminTotalRemaining: poolStatus.adminTotalRemaining,
      quotaGroups: poolStatus.quotaGroups,
      healthyKeyCount: poolStatus.healthyCount,
      lowBalanceKeys: poolStatus.lowBalanceKeys,
      liveBalance: liveBalance ? {
        remaining: liveBalance.remaining,
        deducted: liveBalance.deducted,
        generationId: liveBalance.generationId,
        source: '实时查询（最近一次生成）',
      } : { note: '暂无最近生成记录，使用 key-pool 追踪值' },
      // 重要提示
      note: '多个 key 共享同一额度，展示余额按单个共享额度计算，不叠加',
      checkedAt: new Date().toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
