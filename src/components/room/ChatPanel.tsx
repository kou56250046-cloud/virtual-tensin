'use client';

import { useState, useEffect, useRef } from 'react';
import { Message } from '@/types';
import { createClient } from '@/lib/supabase/client';

interface Props {
  mySessionId: string;
  myName: string;
  onNewMessage?: (senderName: string) => void;
}

export default function ChatPanel({ mySessionId, myName, onNewMessage }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // onNewMessage を ref で保持して Realtime 再購読を防ぐ
  const onNewMessageRef = useRef(onNewMessage);
  useEffect(() => { onNewMessageRef.current = onNewMessage; }, [onNewMessage]);

  // 初期メッセージ取得 + リアルタイム購読
  useEffect(() => {
    // 8時間より古いメッセージを削除（バックグラウンド）
    fetch('/api/messages/cleanup', { method: 'POST' }).catch(() => null);

    // 過去8時間以内のメッセージを取得
    const since = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
    supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .gte('created_at', since)
      .limit(200)
      .then(({ data }) => {
        if (data) setMessages(data as Message[]);
      });

    // リアルタイム購読
    const channel = supabase
      .channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          // 自分以外のメッセージのとき通知コールバックを呼ぶ
          if (newMsg.session_id !== mySessionId) {
            onNewMessageRef.current?.(newMsg.sender_name);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // 新メッセージで自動スクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput('');

    const { error } = await supabase.from('messages').insert({
      session_id: mySessionId,
      sender_name: myName,
      content: text,
    });

    if (error) console.error('メッセージ送信エラー:', error);
    setSending(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f28]/80 border-l border-white/10">
      {/* ヘッダー */}
      <div className="px-3 py-2 border-b border-white/10">
        <h3 className="text-xs font-medium text-amber-300/80">💬 チャット</h3>
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-white/30 text-xs text-center mt-4">まだメッセージはありません</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`${msg.session_id === mySessionId ? 'text-right' : ''}`}>
            <span className="text-white/40 text-[10px]">{msg.sender_name}</span>
            <div className={`inline-block mt-0.5 px-2 py-1 rounded-lg text-xs max-w-[85%] break-words
              ${msg.session_id === mySessionId
                ? 'bg-amber-500/30 text-amber-100'
                : 'bg-white/10 text-white/90'
              }`}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 入力フォーム */}
      <form onSubmit={sendMessage} className="p-2 border-t border-white/10 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="メッセージ..."
          maxLength={200}
          style={{ fontSize: '16px' }}
          className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5
                     text-white text-xs placeholder-white/30 focus:outline-none focus:border-amber-400"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="px-2 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40
                     text-white text-xs rounded transition"
        >
          送信
        </button>
      </form>
    </div>
  );
}
