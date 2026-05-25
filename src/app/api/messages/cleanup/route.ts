import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * 8時間より古いメッセージを削除する
 * ChatPanel マウント時に呼び出される（認証不要）
 */
export async function POST() {
  const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('messages')
    .delete()
    .lt('created_at', cutoff);

  if (error) {
    console.error('messages cleanup error:', error);
    return NextResponse.json({ error: 'cleanup failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
