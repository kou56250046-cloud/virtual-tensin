'use client';

import { useState } from 'react';
import { Session } from '@/types';

interface Props {
  target: Session | null;
  onClose: () => void;
}

export default function CallDialog({ target, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!target) return null;

  const handleCall = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toSessionId: target.id }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError((errData as { error?: string }).error ?? '通話リクエストの送信に失敗しました');
        return;
      }
      const data = await res.json() as { meetLink?: string };
      if (data.meetLink) setMeetLink(data.meetLink);
    } catch (e) {
      console.error(e);
      setError('ネットワークエラーが発生しました。再度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMeetLink(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#f8f4ee] border border-amber-300/60 rounded-2xl p-6 w-full max-w-sm
                      shadow-2xl shadow-black/40">
        {!meetLink ? (
          <>
            <h2 className="text-amber-800 font-bold text-lg mb-2">話しかける</h2>
            <p className="text-amber-900/70 text-sm mb-4">
              <span className="text-amber-900 font-semibold">{target.name}</span>
              さんに話しかけますか？
            </p>
            <p className="text-amber-800/50 text-xs mb-4">
              Google Meet のリンクを共有します。<br />
              相手にも同じリンクへの通知が届きます。
            </p>
            {error && (
              <p className="text-red-600 text-xs mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                ⚠️ {error}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 bg-amber-100 hover:bg-amber-200
                           text-amber-800 rounded-lg transition text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={handleCall}
                disabled={loading}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-60
                           text-white font-bold rounded-lg transition text-sm"
              >
                {loading ? '接続中...' : '📞 話しかける'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-green-700 font-bold text-lg mb-2">✅ Meet リンク生成完了</h2>
            <p className="text-amber-900/70 text-sm mb-4">
              {target.name}さんに通知を送りました。
              下のボタンから Meet に参加してください。
            </p>
            <a
              href={meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold
                         rounded-lg transition text-center mb-3 text-sm"
            >
              🎥 Google Meet に参加
            </a>
            <p className="text-amber-800/30 text-xs text-center mb-3 break-all">{meetLink}</p>
            <button
              onClick={handleClose}
              className="w-full py-2 bg-amber-100 hover:bg-amber-200
                         text-amber-800 rounded-lg transition text-sm"
            >
              閉じる
            </button>
          </>
        )}
      </div>
    </div>
  );
}
