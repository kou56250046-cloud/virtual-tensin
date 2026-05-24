'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Session } from '@/types';
import { createClient } from '@/lib/supabase/client';
import RoomCanvas from '@/components/room/RoomCanvas';
import ChatPanel from '@/components/room/ChatPanel';
import CallDialog from '@/components/room/CallDialog';
import ToastNotification, { Toast } from '@/components/room/ToastNotification';

interface MySession {
  sessionId: string;
  name: string;
  avatarUrl: string | null;
  color: string;
}

export default function RoomPage() {
  const router = useRouter();
  const [me, setMe] = useState<MySession | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [targetSession, setTargetSession] = useState<Session | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // セッション情報取得
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (!data.isLoggedIn) { router.push('/'); return; }
        setMe({
          sessionId: data.sessionId,
          name: data.name,
          avatarUrl: data.avatarUrl ?? null,
          color: data.color,
        });
      });
  }, [router]);

  // Supabase Realtime
  useEffect(() => {
    if (!me) return;
    const supabase = createClient();

    // 現在の参加者取得
    supabase.from('sessions').select('*').then(({ data }) => {
      if (data) setSessions(data as Session[]);
    });

    const channel = supabase
      .channel('sessions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const s = payload.new as Session;
            setSessions((p) => [...p, s]);
            if (s.id !== me.sessionId) addToast(`🙏 ${s.name}さんが入室しました`);
          } else if (payload.eventType === 'UPDATE') {
            setSessions((p) => p.map((s) => s.id === payload.new.id ? payload.new as Session : s));
          } else if (payload.eventType === 'DELETE') {
            const d = payload.old as Session;
            setSessions((p) => p.filter((s) => s.id !== d.id));
            if (d.name) addToast(`${d.name}さんが退室しました`);
          }
        }
      )
      .subscribe();

    // 通話リクエスト購読
    const callChannel = supabase
      .channel('call-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'call_requests',
          filter: `to_session_id=eq.${me.sessionId}` },
        (payload) => {
          const fromId = payload.new.from_session_id;
          const from = sessions.find((s) => s.id === fromId);
          addToast(`📞 ${from?.name ?? '誰か'}さんから話しかけられています`, 'warning');
        }
      )
      .subscribe();

    // ハートビート（30秒）
    const hb = setInterval(() => {
      fetch(`/api/session/${me.sessionId}`, { method: 'PUT' });
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(callChannel);
      clearInterval(hb);
    };
  }, [me, addToast]);

  const handleMove = useCallback(async (x: number, y: number) => {
    if (!me) return;
    setSessions((p) => p.map((s) => s.id === me.sessionId ? { ...s, x, y } : s));
    await fetch(`/api/session/${me.sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y }),
    });
  }, [me]);

  const handleLogout = async () => {
    if (!confirm('祈祷室から退室しますか？')) return;
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  if (!me) {
    return (
      <div className="min-h-screen bg-[#e8c98a] flex items-center justify-center">
        <div className="text-amber-800 text-sm animate-pulse">🕯️ 入室中...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#c49050]">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-3 py-1.5 shrink-0
                         bg-[#7a5230]/90 border-b border-amber-900/40">
        <span className="text-amber-200 font-bold text-sm">🕯️ 天心苑 祈祷室</span>

        <div className="flex items-center gap-2">
          {/* チャット（モバイル用） */}
          <button
            onClick={() => setShowChat(!showChat)}
            className="md:hidden px-2 py-1 bg-amber-700/60 hover:bg-amber-600/60
                       text-amber-100 text-xs rounded transition"
          >
            💬
          </button>

          {/* 参加者 */}
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="px-2 py-1 bg-amber-700/60 hover:bg-amber-600/60
                       text-amber-100 text-xs rounded transition"
          >
            👥 {sessions.length}
          </button>

          <span className="text-amber-200/60 text-xs hidden sm:block">{me.name}</span>

          <button
            onClick={handleLogout}
            className="px-2 py-1 bg-red-900/50 hover:bg-red-800/60
                       text-red-300 text-xs rounded transition"
          >
            退室
          </button>
        </div>
      </header>

      {/* メインエリア */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* キャンバス */}
        <div className="flex-1 relative overflow-hidden">
          <RoomCanvas
            sessions={sessions}
            mySessionId={me.sessionId}
            onMove={handleMove}
            onAvatarClick={setTargetSession}
          />

          {/* 参加者一覧オーバーレイ */}
          {showParticipants && (
            <div className="absolute top-2 left-2 bg-[#f8f4ee]/95 border border-amber-300/60
                            rounded-xl p-3 min-w-36 max-h-64 overflow-y-auto shadow-lg">
              <p className="text-amber-800 text-xs font-bold mb-2">参加者</p>
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-2 py-1">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/60"
                       style={{ backgroundColor: s.color }} />
                  <span className="text-amber-900/80 text-xs">
                    {s.name}
                    {s.id === me.sessionId && <span className="text-amber-500/70"> (自分)</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* チャット（PC: サイドバー、モバイル: フローティング） */}
        <div className={`
          ${showChat ? 'flex' : 'hidden md:flex'}
          w-64 flex-col
          md:border-l md:border-amber-800/30
        `}>
          <ChatPanel mySessionId={me.sessionId} myName={me.name} />
        </div>
      </div>

      {/* ダイアログ・通知 */}
      <CallDialog target={targetSession} onClose={() => setTargetSession(null)} />
      <ToastNotification toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
