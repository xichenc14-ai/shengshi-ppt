import { NextResponse } from 'next/server';
import { getKeyPoolStatus } from '@/lib/gamma-key-pool';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 硬编码的可用 Gamma key（用于 /me 查询）
const FALLBACK_KEY = 'sk-gamma-aN5tVoqv26bND6vl7eIfaNzY5ffx20725LbgEnlSw';

// GET: 查询 Gamma API 账户信息（管理/监控用）
// 注意：Gamma API 没有 /account 端点，余额从 key-pool 追踪
// 实时余额只能从生成任务的响应中获取
export async function GET() {
  try {
    // 1. 获取 workspace 信息（/me 端点可用）
    let workspaceInfo = null;
    const apiKey = FALLBACK_KEY;

    try {
      const meRes = await fetch(`${GAMMA_API_BASE}/me`, {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
          'User-Agent': GAMMA_UA,
        },
      });
      if (meRes.ok) {
        workspaceInfo = await meRes.json();
      }
    } catch (e) {
      console.warn('[gamma-balance] /me fetch failed:', e instanceof Error ? e.message : String(e));
    }

    // 2. 获取 key pool 追踪的余额（基于历史生成响应，非实时）
    const poolStatus = getKeyPoolStatus();

    return NextResponse.json({
      // workspace 信息
      email: workspaceInfo?.email || null,
      workspaceName: workspaceInfo?.workspaceName || null,
      // key pool 追踪的余额（历史值，非实时）
      keyPools: poolStatus.keys.map(k => ({
        label: k.label,
        remaining: k.remaining,
        lastUsed: k.lastUsed,
        successCount: k.successCount,
        failCount: k.failCount,
      })),
      totalRemaining: poolStatus.totalRemaining,
      healthyKeyCount: poolStatus.healthyCount,
      lowBalanceKeys: poolStatus.lowBalanceKeys,
      // 重要提示
      note: 'key pool 余额基于历史生成响应，非实时查询。如需实时余额，请查看最近一次生成任务的 credits.remaining',
      checkedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
