import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason || '无权限' }, { status: auth.reason === '请先登录' ? 401 : 403 });
  }
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 100), 1), 300);
  const action = (searchParams.get('action') || '').trim();

  let query = sb
    .from('admin_audit_logs')
    .select('id,operator_user_id,operator_phone,action,target_type,target_id,before_snapshot,after_snapshot,reason,ip_address,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (action) query = query.eq('action', action);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message || '读取失败' }, { status: 500 });
  return NextResponse.json({ logs: data || [] });
}
