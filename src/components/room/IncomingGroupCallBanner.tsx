'use client';

import { useEffect } from 'react';

interface Props {
  fromName: string;
  onJoin: () => void;
  onDismiss: () => void;
}

export default function IncomingGroupCallBanner({ fromName, onJoin, onDismiss }: Props) {
  // 30秒後に自動消去
  useEffect(() => {
    const timer = setTimeout(onDismiss, 30000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed top-12 inset-x-3 z-50 flex justify-center pointer-events-none">
      <div className="w-full max-w-sm bg-[#1a2040]/95 border border-white/20 rounded-2xl
                      shadow-2xl backdrop-blur-sm px-4 py-3 pointer-events-auto
                      animate-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-3">
          {/* アイコン（パルスアニメーション） */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <span className="text-xl">📞</span>
            </div>
            <span className="absolute inset-0 rounded-full bg-green-500/30 animate-ping" />
          </div>

          {/* テキスト */}
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">グループ通話</p>
            <p className="text-white/60 text-[11px] truncate">{fromName}さんが通話を開始しました</p>
          </div>

          {/* ボタン */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onDismiss}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20
                         flex items-center justify-center text-white/70 text-xs transition"
              aria-label="後で"
            >
              ✕
            </button>
            <button
              onClick={onJoin}
              className="px-3 py-1.5 rounded-full bg-green-500 hover:bg-green-400
                         text-white text-xs font-bold transition"
            >
              参加
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
