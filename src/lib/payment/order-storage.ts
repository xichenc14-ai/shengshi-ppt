type SupabaseLike = {
  from: (table: string) => {
    insert?: (payload: Record<string, unknown>) => unknown;
    update?: (payload: Record<string, unknown>) => unknown;
  };
};

type SupabaseError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

function missingSchemaColumn(error: SupabaseError | null | undefined): string | null {
  if (!error || error.code !== 'PGRST204') return null;
  const match = String(error.message || '').match(/'([^']+)' column/);
  return match?.[1] || null;
}

async function runWithMissingColumnRetry(
  payload: Record<string, unknown>,
  run: (nextPayload: Record<string, unknown>) => Promise<{ error: SupabaseError | null }>
): Promise<{ error: SupabaseError | null; payload: Record<string, unknown>; stripped: string[] }> {
  let nextPayload = { ...payload };
  const stripped: string[] = [];

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await run(nextPayload);
    const missing = missingSchemaColumn(result.error);
    if (!missing || !(missing in nextPayload)) {
      return { ...result, payload: nextPayload, stripped };
    }
    stripped.push(missing);
    delete nextPayload[missing];
  }

  return {
    error: { code: 'PGRST204', message: `Too many missing columns: ${stripped.join(', ')}` },
    payload: nextPayload,
    stripped,
  };
}

export async function insertOrderCompat(
  sb: SupabaseLike,
  payload: Record<string, unknown>
): Promise<{ error: SupabaseError | null; stripped: string[] }> {
  const result = await runWithMissingColumnRetry(payload, async (nextPayload) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query = (sb.from('orders') as any).insert(nextPayload);
    return await query;
  });
  if (result.stripped.length > 0) {
    console.warn(`[Payment] orders insert stripped missing columns: ${result.stripped.join(', ')}`);
  }
  return { error: result.error, stripped: result.stripped };
}

export async function updateOrderCompat(
  sb: SupabaseLike,
  payload: Record<string, unknown>,
  orderNo: string
): Promise<{ error: SupabaseError | null; stripped: string[] }> {
  const result = await runWithMissingColumnRetry(payload, async (nextPayload) => {
    if (Object.keys(nextPayload).length === 0) return { error: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query = (sb.from('orders') as any).update(nextPayload).eq('order_no', orderNo);
    return await query;
  });
  if (result.stripped.length > 0) {
    console.warn(`[Payment] orders update stripped missing columns: ${result.stripped.join(', ')}, order=${orderNo}`);
  }
  return { error: result.error, stripped: result.stripped };
}
