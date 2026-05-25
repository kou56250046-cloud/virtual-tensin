'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Session } from '@/types';
import { createClient } from '@/lib/supabase/client';
import RoomCanvas from '@/components/room/RoomCanvas';
import ChatPanel from '@/components/room/ChatPanel';
import CallDialog from '@/components/room/CallDialog';
import ToastNotification, { Toast } from '@/components/room/ToastNotification';
import { getSeatCenter } from '@/lib/zabuton';

interface MySession {
  sessionId: string;
  name: string;
  avatarUrl: string | null;
  color: string;
}

interface SeatConfirm {
  seatId: string;
  x: number;
  y: number;
}

export default function RoomPage() {
  const router = useRouter();
  const [me, setMe] = useState<MySession | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [targetSession, setTargetSession] = useState<Session | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [seatConfirm, setSeatConfirm] = useState<SeatConfirm | null>(null);

  // 自分の着席状態（sessions から派生）
  const mySeatId = sessions.find((s) => s.id === me?.sessionId)?.seat_id ?? null;

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

  // アバター移動
  const handleMove = useCallback(async (x: number, y: number) => {
    if (!me) return;
    setSessions((p) => p.map((s) => s.id === me.sessionId ? { ...s, x, y } : s));
    await fetch(`/api/session/${me.sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y }),
    });
  }, [me]);

  // 座布団クリック処理
  const handleZabutonClick = useCallback((seatId: string, x: number, y: number) => {
    if (!me) return;

    // 着席中のユーザーを確認
    const occupant = sessions.find((s) => s.seat_id === seatId);

    if (occupant && occupant.id !== me.sessionId) {
      // 他人が着席中 → 話しかける
      setTargetSession(occupant);
      return;
    }

    if (mySeatId === seatId) {
      // 自分が着席中 → 離席
      handleRiseki();
      return;
    }

    // 空席 → 着席確認ダイアログ
    const center = getSeatCenter(seatId);
    setSeatConfirm({ seatId, x: center?.x ?? x, y: center?.y ?? y });
  }, [me, sessions, mySeatId]);

  // 着席
  const handleChinchi = useCallback(async () => {
    if (!me || !seatConfirm) return;
    const { seatId, x, y } = seatConfirm;

    // ローカル即時反映
    setSessions((p) => p.map((s) =>
      s.id === me.sessionId ? { ...s, seat_id: seatId, x, y } : s
    ));
    setSeatConfirm(null);

    await fetch(`/api/session/${me.sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seat_id: seatId, x, y }),
    });
  }, [me, seatConfirm]);

  // 離席
  const handleRiseki = useCallback(async () => {
    if (!me) return;

    // ローカル即時反映
    setSessions((p) => p.map((s) =>
      s.id === me.sessionId ? { ...s, seat_id: null } : s
    ));

    await fetch(`/api/session/${me.sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seat_id: null }),
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
          {/* 離席ボタン（着席中のみ表示） */}
          {mySeatId && (
            <button
              onClick={handleRiseki}
              className="px-2 py-1 bg-violet-700/70 hover:bg-violet-600/70
                         text-violet-100 text-xs rounded transition"
            >
              🪑 離席
            </button>
          )}

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
        <div className="flex-1 md:max-w-[900px] relative overflow-hidden md:overflow-y-auto bg-[#c49050]">
          <RoomCanvas
            sessions={sessions}
            mySessionId={me.sessionId}
            mySeatId={mySeatId}
            onMove={handleMove}
            onAvatarClick={setTargetSession}
            onZabutonClick={handleZabutonClick}
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
                    {s.seat_id && <span className="text-violet-600/70"> 着席中</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* チャット（PC: サイドバー、モバイル: フローティング） */}
        <div className={`
          ${showChat ? 'flex' : 'hidden md:flex'}
          flex-col
          w-64 md:flex-1 md:min-w-[256px]
          md:border-l md:border-amber-800/30
        `}>
          <ChatPanel mySessionId={me.sessionId} myName={me.name} />
        </div>
      </div>

      {/* 着席確認ダイアログ */}
      {seatConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#f8f4ee] border border-amber-300/60 rounded-2xl p-6 w-full max-w-xs
                          shadow-2xl shadow-black/40">
            <h2 className="text-amber-800 font-bold text-base mb-2">🪑 着席しますか？</h2>
            <p className="text-amber-900/60 text-sm mb-5">
              このクッションに着席します。<br />
              「離席」ボタンでいつでも立てます。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setSeatConfirm(null)}
                className="flex-1 py-2.5 bg-amber-100 hover:bg-amber-200
                           text-amber-800 rounded-lg transition text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={handleChinchi}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500
                           text-white font-bold rounded-lg transition text-sm"
              >
                着席する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ダイアログ・通知 */}
      <CallDialog target={targetSession} onClose={() => setTargetSession(null)} />
      <ToastNotification toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
