'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Session } from '@/types';
import { createClient } from '@/lib/supabase/client';

interface Props {
  mySessionId: string;
  myName: string;
  myAvatarUrl?: string | null;
  sessions: Session[];
  onNewMessage?: (senderName: string) => void;
  onStartCall: () => void;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🙏', '😮'];

/** セッション一覧からアバターURLを session_id で検索 */
function getAvatarBySessionId(sessions: Session[], sessionId: string | null): string | null {
  if (!sessionId) return null;
  return sessions.find((s) => s.id === sessionId)?.avatar_url ?? null;
}

/** イニシャル円（アバター画像がない場合） */
function InitialAvatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-full bg-violet-500 flex items-center justify-center
                 text-white font-bold shrink-0 select-none"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/** 丸クリップアバター画像 */
function AvatarImage({ url, name, size = 32 }: { url: string | null; name: string; size?: number }) {
  if (!url) return <InitialAvatar name={name} size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

/** メッセージ内の @mention をハイライト */
function MessageContent({ content, myName }: { content: string; myName: string }) {
  const parts = content.split(/(@\S+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const isMentionedMe = part === `@${myName}`;
          return (
            <span
              key={i}
              className={isMentionedMe ? 'text-amber-300 font-bold' : 'text-sky-300 font-medium'}
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export default function ChatPanel({
  mySessionId,
  myName,
  myAvatarUrl,
  sessions,
  onNewMessage,
  onStartCall,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // メンション
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    });
  }, []);

  const onNewMessageRef = useRef(onNewMessage);
  useEffect(() => { onNewMessageRef.current = onNewMessage; }, [onNewMessage]);

  // 初期メッセージ取得 + リアルタイム購読
  useEffect(() => {
    fetch('/api/messages/cleanup', { method: 'POST' }).catch(() => null);

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

    const channel = supabase
      .channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          if (newMsg.session_id !== mySessionId) {
            onNewMessageRef.current?.(newMsg.sender_name);
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      });
    };
    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const unread = messages.filter(
      (m) => m.session_id !== mySessionId && !(m.read_by ?? []).includes(mySessionId)
    );
    unread.forEach((m) => {
      fetch(`/api/messages/${m.id}/read`, { method: 'POST' }).catch(() => null);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 入力変更（メンション検出）
  const handleInputChange = (value: string) => {
    setInput(value);
    const atMatch = value.match(/@([^\s]*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setShowMentionMenu(true);
    } else {
      setShowMentionMenu(false);
      setMentionQuery('');
    }
  };

  // メンション挿入
  const insertMention = (name: string) => {
    const newInput = input.replace(/@[^\s]*$/, `@${name} `);
    setInput(newInput);
    setShowMentionMenu(false);
    setMentionQuery('');
    inputRef.current?.focus();
  };

  const mentionCandidates = sessions.filter(
    (s) => s.name.includes(mentionQuery) && s.id !== mySessionId
  );

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput('');
    setShowMentionMenu(false);

    const { error } = await supabase.from('messages').insert({
      session_id: mySessionId,
      sender_name: myName,
      content: text,
      sender_avatar_url: myAvatarUrl ?? null,
    });

    if (error) console.error('メッセージ送信エラー:', error);
    setSending(false);
  };

  const sendReaction = async (messageId: string, emoji: string) => {
    setReactionTarget(null);
    await fetch(`/api/messages/${messageId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    });
  };

  const handleLongPressStart = (messageId: string) => {
    const timer = setTimeout(() => setReactionTarget(messageId), 500);
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const getReadCount = (msg: Message) => {
    const readBy = msg.read_by ?? [];
    return readBy.filter((id) => id !== mySessionId).length;
  };

  const isSameSenderAsPrev = (index: number) => {
    if (index === 0) return false;
    return messages[index].session_id === messages[index - 1].session_id;
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f28]/80 border-l border-white/10">
      {/* ヘッダー */}
      <div className="px-3 py-2 border-b border-white/10 shrink-0 flex items-center justify-between">
        <h3 className="text-xs font-medium text-amber-300/80">💬 チャット</h3>
        <button
          onClick={onStartCall}
          title="グループ通話を開始"
          className="w-7 h-7 rounded-full flex items-center justify-center
                     bg-green-500/20 hover:bg-green-500/40 text-green-400
                     hover:text-green-300 transition text-base"
          aria-label="グループ通話"
        >
          📞
        </button>
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {messages.length === 0 && (
          <p className="text-white/30 text-xs text-center mt-4">まだメッセージはありません</p>
        )}

        {messages.map((msg, index) => {
          const isMe = msg.session_id === mySessionId;
          const samePrev = isSameSenderAsPrev(index);
          const avatarUrl = isMe
            ? myAvatarUrl ?? null
            : (getAvatarBySessionId(sessions, msg.session_id) ?? msg.sender_avatar_url ?? null);
          const readCount = isMe ? getReadCount(msg) : 0;
          const reactions = msg.reactions ?? {};
          const hasReactions = Object.keys(reactions).length > 0;

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} max-w-[88%]`}>
                {/* アバター（他者のみ・連続投稿では空白） */}
                {!isMe && (
                  <div className="mb-0.5 self-end" style={{ width: 32, height: 32 }}>
                    {!samePrev ? (
                      <AvatarImage url={avatarUrl} name={msg.sender_name} size={32} />
                    ) : (
                      <div style={{ width: 32, height: 32 }} />
                    )}
                  </div>
                )}

                <div className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* 送信者名（他者・連続投稿では非表示） */}
                  {!isMe && !samePrev && (
                    <span className="text-white/50 text-[10px] px-1 ml-0.5">{msg.sender_name}</span>
                  )}

                  {/* 吹き出し */}
                  <div
                    className={`relative flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    onTouchStart={() => handleLongPressStart(msg.id)}
                    onTouchEnd={handleLongPressEnd}
                    onTouchCancel={handleLongPressEnd}
                    onContextMenu={(e) => { e.preventDefault(); setReactionTarget(msg.id); }}
                  >
                    <div
                      className={`
                        px-3 py-2 rounded-2xl text-xs break-words max-w-full leading-relaxed
                        ${isMe
                          ? 'bg-amber-500/70 text-white rounded-tr-sm'
                          : 'bg-white/15 text-white/90 rounded-tl-sm'
                        }
                      `}
                    >
                      <MessageContent content={msg.content} myName={myName} />
                    </div>

                    {/* リアクション表示 */}
                    {hasReactions && (
                      <div className="flex flex-wrap gap-0.5 mt-0.5 px-0.5">
                        {Object.entries(reactions).map(([emoji, senders]) => {
                          const iMine = (senders as string[]).includes(mySessionId);
                          return (
                            <button
                              key={emoji}
                              onClick={() => sendReaction(msg.id, emoji)}
                              className={`
                                flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px]
                                border transition
                                ${iMine
                                  ? 'bg-amber-500/30 border-amber-400/60 text-white'
                                  : 'bg-white/10 border-white/20 text-white/70'
                                }
                              `}
                            >
                              <span>{emoji}</span>
                              <span className="text-[10px]">{(senders as string[]).length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 既読表示 */}
                {isMe && (
                  <div className="text-[9px] text-white/30 mb-1 self-end">
                    {readCount > 0 && `既読 ${readCount}`}
                  </div>
                )}
              </div>

              {/* リアクション選択パネル */}
              {reactionTarget === msg.id && (
                <div className="flex gap-1 mt-1 p-1.5 rounded-2xl bg-[#1a1f40]/90 border border-white/10 shadow-lg">
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => sendReaction(msg.id, emoji)}
                      className="text-lg hover:scale-125 transition-transform active:scale-110 px-0.5"
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    onClick={() => setReactionTarget(null)}
                    className="text-white/40 text-xs px-1 ml-1"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* メンション候補ドロップダウン */}
      {showMentionMenu && mentionCandidates.length > 0 && (
        <div className="mx-2 mb-1 bg-[#1a2040] border border-white/20 rounded-xl overflow-hidden shadow-lg">
          {mentionCandidates.slice(0, 5).map((s) => (
            <button
              key={s.id}
              onClick={() => insertMention(s.name)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 transition text-left"
            >
              <AvatarImage url={s.avatar_url} name={s.name} size={24} />
              <span className="text-white text-xs">{s.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* 入力フォーム */}
      <form onSubmit={sendMessage} className="p-2 border-t border-white/10 flex gap-2 shrink-0 bg-[#0a0f28]/90">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            scrollToBottom();
            setTimeout(() => scrollToBottom(), 300);
          }}
          placeholder="メッセージを入力... (@でメンション)"
          maxLength={200}
          style={{ fontSize: '16px' }}
          className="flex-1 bg-white/10 border border-white/20 rounded-full px-3 py-1.5
                     text-white text-xs placeholder-white/30 focus:outline-none focus:border-amber-400"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="w-8 h-8 bg-amber-500 hover:bg-amber-400 disabled:opacity-40
                     text-white text-sm rounded-full flex items-center justify-center shrink-0 transition"
        >
          ↑
        </button>
      </form>
    </div>
  );
}
