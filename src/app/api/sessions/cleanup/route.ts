import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('sessions')
    .delete()
    .lt('last_seen', cutoff);

  if (error) {
    console.error('sessions cleanup error:', error);
    return NextResponse.json({ error: 'cleanup failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
