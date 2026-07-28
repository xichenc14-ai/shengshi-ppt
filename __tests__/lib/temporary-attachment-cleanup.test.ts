import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient, selectRows, removeObjects, deleteRows, updateRows } = vi.hoisted(() => ({
  createClient: vi.fn(),
  selectRows: vi.fn(),
  removeObjects: vi.fn(),
  deleteRows: vi.fn(),
  updateRows: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

import { cleanupExpiredTemporaryAttachments } from '@/lib/temporary-attachments';

function client() {
  const selectQuery = {
    select: vi.fn(() => selectQuery),
    lt: vi.fn(() => selectQuery),
    limit: selectRows,
  };
  const deleteQuery = { in: deleteRows, eq: vi.fn().mockResolvedValue({ error: null }) };
  const updateQuery = { in: updateRows };
  return {
    from: vi.fn(() => ({
      ...selectQuery,
      delete: vi.fn(() => deleteQuery),
      update: vi.fn(() => updateQuery),
    })),
    storage: { from: vi.fn(() => ({ remove: removeObjects })) },
  };
}

describe('temporary attachment cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T10:00:00.000Z'));
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://database.example.com');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-test-key');
    createClient.mockReturnValue(client());
    removeObjects.mockResolvedValue({ error: null });
    deleteRows.mockResolvedValue({ error: null });
    updateRows.mockResolvedValue({ error: null });
    selectRows.mockResolvedValue({
      data: [
        { id: 'final', storage_path: 'u/final.txt', delete_after: '2026-07-13T09:59:00.000Z' },
        { id: 'retry', storage_path: 'u/retry.txt', delete_after: '2026-07-13T11:00:00.000Z' },
      ],
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('deletes final leases and reschedules leases whose upload token is still valid', async () => {
    await expect(cleanupExpiredTemporaryAttachments()).resolves.toBe(2);
    expect(removeObjects).toHaveBeenCalledWith(['u/final.txt', 'u/retry.txt']);
    expect(deleteRows).toHaveBeenCalledWith('id', ['final']);
    expect(updateRows).toHaveBeenCalledWith('id', ['retry']);
  });

  it('keeps leases for retry when object deletion fails', async () => {
    removeObjects.mockResolvedValue({ error: { message: 'storage unavailable' } });
    await expect(cleanupExpiredTemporaryAttachments()).rejects.toThrow('临时附件过期删除失败');
    expect(deleteRows).not.toHaveBeenCalled();
    expect(updateRows).not.toHaveBeenCalled();
  });
});
