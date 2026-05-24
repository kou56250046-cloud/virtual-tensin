'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AvatarUpload from './AvatarUpload';
import { createClient } from '@/lib/supabase/client';

const AVATAR_COLOR = '#8b5cf6'; // 全員統一：紫

export default function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<'passphrase' | 'profile'>('passphrase');
  const [passphrase, setPassphrase] = useState('');
  const [name, setName] = useState('');
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1: 合言葉確認
  const handlePassphrase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) {
      setError('合言葉を入力してください');
      return;
    }
    setError('');
    setStep('profile');
  };

  // Step 2: プロフィール入力 → 入室
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('お名前を入力してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase, name, color: AVATAR_COLOR }),
      });

      if (!loginRes.ok) {
        const data = await loginRes.json();
        setError(data.error || 'ログインに失敗しました');
        if (loginRes.status === 401) setStep('passphrase');
        return;
      }

      const { sessionId } = await loginRes.json();

      // 写真がある場合は Supabase Storage にアップロード
      if (avatarBlob && sessionId) {
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(`${sessionId}.jpg`, avatarBlob, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(`${sessionId}.jpg`);

          await supabase
            .from('sessions')
            .update({ avatar_url: urlData.publicUrl })
            .eq('id', sessionId);
        }
      }

      router.push('/room');
    } catch {
      setError('ネットワークエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {step === 'passphrase' ? (
        <form onSubmit={handlePassphrase} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-amber-200/80 mb-2">
              合言葉
            </label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="合言葉を入力"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg
                         text-white placeholder-white/40 focus:outline-none focus:border-amber-400
                         focus:ring-1 focus:ring-amber-400 transition"
              autoFocus
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold
                       rounded-lg transition shadow-lg shadow-amber-600/30"
          >
            確認
          </button>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="space-y-5">
          {/* プロフィール写真 */}
          <div>
            <label className="block text-sm font-medium text-amber-200/80 mb-3 text-center">
              プロフィール写真（任意）
            </label>
            <AvatarUpload
              onUpload={(blob, preview) => {
                setAvatarBlob(blob);
                setAvatarPreview(preview);
              }}
              previewUrl={avatarPreview}
            />
          </div>

          {/* お名前 */}
          <div>
            <label className="block text-sm font-medium text-amber-200/80 mb-2">
              お名前 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="祈祷室に表示されるお名前"
              maxLength={20}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg
                         text-white placeholder-white/40 focus:outline-none focus:border-amber-400
                         focus:ring-1 focus:ring-amber-400 transition"
              autoFocus
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('passphrase')}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
            >
              戻る
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-60
                         text-white font-bold rounded-lg transition shadow-lg shadow-amber-600/30"
            >
              {loading ? '入室中...' : '🙏 祈祷室に入室'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
