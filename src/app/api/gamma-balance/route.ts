import { NextResponse } from 'next/server';
import { getKeyPoolStatus } from '@/lib/gamma-key-pool';

/**
 * GET: 查询 Gamma API 各Key余额状态（管理/监控用）
 * 使用 Key 池状态查询（不调用 account API，因为 account API 可能不支持多key）
 */
export async function GET() {
  try {
    const status = getKeyPoolStatus();

    if (status.configuredCount === 0) {
      return NextResponse.json({ error: 'Gamma API Key 未配置' }, { status: 500 });
    }

    return NextResponse.json({
      keys: status.keys, // 完整信息（余额/使用次数/失败次数）
      totalRemaining: status.totalRemaining,
      healthyCount: status.healthyCount,
      lowBalanceKeys: status.lowBalanceKeys,
      configuredCount: status.configuredCount,
      checkedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}