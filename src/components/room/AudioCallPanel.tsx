'use client';

import { useEffect } from 'react';
import { useWebRTCCall } from '@/hooks/useWebRTCCall';

interface Props {
  mySessionId: string;
  myName: string;
  onLeave: () => void;
}

export default function AudioCallPanel({ mySessionId, myName, onLeave }: Props) {
  const { isInCall, isMuted, participants, joinCall, leaveCall, toggleMute, error } = useWebRTCCall(mySessionId, myName);

  // マウント時に自動接続
  useEffect(() => {
    joinCall();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLeave = () => {
    leaveCall();
    onLeave();
  };

  return (
    <div className="shrink-0 bg-[#0d1230]/95 border-b border-white/10 px-3 py-2">
      <div className="flex items-center gap-2">
        {/* ステータス */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${isInCall ? 'bg-green-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
          <span className="text-green-300 text-xs font-medium">
            {isInCall ? 'グループ通話中' : '接続中...'}
          </span>
        </div>

        {/* 参加者アイコン一覧 */}
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto min-w-0">
          {participants.map((p) => (
            <div key={p.sessionId} className="flex items-center gap-1 shrink-0">
              <div className={`
                w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
                border-2 shrink-0
                ${p.isMuted
                  ? 'bg-white/10 border-white/20 text-white/50'
                  : 'bg-violet-500 border-violet-400 text-white'
                }
              `}>
                {p.userName.charAt(0)}
              </div>
              <span className="text-white/60 text-[10px] max-w-[4rem] truncate">
                {p.isLocal ? '自分' : p.userName}
              </span>
              {p.isMuted && <span className="text-[9px] text-white/30">🔇</span>}
            </div>
          ))}
          {participants.length === 0 && !error && (
            <span className="text-white/30 text-[10px]">接続しています...</span>
          )}
          {error && (
            <span className="text-red-400 text-[10px] truncate">{error}</span>
          )}
        </div>

        {/* コントロール */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={toggleMute}
            disabled={!isInCall}
            className={`
              w-7 h-7 rounded-full flex items-center justify-center text-sm transition
              ${isMuted
                ? 'bg-red-500/80 hover:bg-red-500 text-white'
                : 'bg-white/10 hover:bg-white/20 text-white'
              }
              disabled:opacity-40
            `}
            title={isMuted ? 'ミュート解除' : 'ミュート'}
          >
            {isMuted ? '🔇' : '🎙️'}
          </button>

          <button
            onClick={handleLeave}
            className="px-2.5 py-1 rounded-full bg-red-600 hover:bg-red-500
                       text-white text-[11px] font-bold transition shrink-0"
          >
            退出
          </button>
        </div>
      </div>
    </div>
  );
}
