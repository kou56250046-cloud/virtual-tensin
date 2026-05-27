-- 既読管理: messages テーブルに read_by 配列を追加
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}';

-- リアクション: messages テーブルに reactions JSONB を追加
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}';

-- メッセージ送信者のアバターURL（退室後も表示できるよう保存）
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_avatar_url TEXT;

-- インデックス: read_by の高速検索（GINインデックス）
CREATE INDEX IF NOT EXISTS idx_messages_read_by ON messages USING GIN (read_by);
