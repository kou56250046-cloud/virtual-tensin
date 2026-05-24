-- バーチャル天心苑祈祷室 初期スキーマ

-- 参加中セッション
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  character_type TEXT NOT NULL CHECK (
    character_type IN ('student','youth','family_youth','senior_male','senior_female')
  ),
  color TEXT NOT NULL DEFAULT '#4f8ef7',
  x FLOAT DEFAULT 400,
  y FLOAT DEFAULT 300,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 全体チャット
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL CHECK (length(content) <= 200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 話しかけリクエスト
CREATE TABLE IF NOT EXISTS call_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  to_session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  meet_link TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS 有効化 ────────────────────────────────────────────────

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_requests ENABLE ROW LEVEL SECURITY;

-- sessions: 全員が読める、作成はバックエンド（Service Role）のみ
CREATE POLICY "sessions_select" ON sessions FOR SELECT USING (true);

-- messages: 全員が読める・書ける（INSERT のみ、バックエンド経由）
CREATE POLICY "messages_select" ON messages FOR SELECT USING (true);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (true);

-- call_requests: 全員が読める
CREATE POLICY "call_requests_select" ON call_requests FOR SELECT USING (true);

-- ─── Realtime 有効化 ────────────────────────────────────────────

-- Supabase ダッシュボードの Database > Replication から有効化するか、以下を実行
-- ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE call_requests;

-- ─── 古いセッションを自動削除（5分以上応答なし） ────────────────

-- pg_cron が有効な場合（Supabase Pro以上）
-- SELECT cron.schedule('cleanup-sessions', '*/5 * * * *',
--   $$DELETE FROM sessions WHERE last_seen < NOW() - INTERVAL '5 minutes'$$
-- );

-- 無料枠の場合：アプリ側のハートビートタイムアウトで対応
