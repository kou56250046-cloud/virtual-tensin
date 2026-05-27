import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { passphrase, name, color } = body as {
    passphrase: string;
    name: string;
    color: string;
  };

  // 合言葉チェック
  const expected = process.env.ACCESS_PASSPHRASE;
  if (!expected || passphrase !== expected) {
    return NextResponse.json({ error: '合言葉が正しくありません' }, { status: 401 });
  }

  // バリデーション
  if (!name?.trim()) {
    return NextResponse.json({ error: 'お名前を入力してください' }, { status: 400 });
  }

  // Supabase に参加者セッションを作成
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      name: name.trim(),
      color: '#8b5cf6', // 全員統一：紫
      avatar_url: null,
      x: 400 + Math.random() * 200 - 100,
      y: 350 + Math.random() * 150 - 75,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('Supabase sessions insert error:', error);
    return NextResponse.json({ error: 'セッションの作成に失敗しました' }, { status: 500 });
  }

  // iron-session Cookie を発行
  const res = NextResponse.json({ ok: true, sessionId: data.id });
  const session = await getIronSession<SessionData>(request, res, sessionOptions);
  session.sessionId = data.id;
  session.name = name.trim();
  session.avatarUrl = null;
  session.color = color;
  session.isLoggedIn = true;
  session.sessionCreatedAt = data.created_at; // 8時間タイマー用
  await session.save();

  return res;
}
