'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AvatarUpload from './AvatarUpload';
import { createClient } from '@/lib/supabase/client';
import {
  loadProfile,
  saveProfile,
  clearProfile,
  dataUrlToBlob,
  blobToDataUrl,
} from '@/lib/profileStorage';

const AVATAR_COLOR = '#8b5cf6'; // 全員統一：紫

export default function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<'passphrase' | 'profile'>('passphrase');
  const [passphrase, setPassphrase] = useState('');
  const [name, setName] = useState('');
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [hasStoredProfile, setHasStoredProfile] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // マウント時にlocalStorageからプロフィールを復元
  useEffect(() => {
    const profile = loadProfile();
    if (profile) {
      setName(profile.name);
      if (profile.avatarDataUrl) {
        setAvatarPreview(profile.avatarDataUrl);
        setAvatarDataUrl(profile.avatarDataUrl);
      }
      setHasStoredProfile(true);
    }
  }, []);

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

  // Step 2: 入室
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

      // アップロードする blob を決定
      // 新しく選択した画像があればそちらを優先、なければ保存済みを使用
      let uploadBlob: Blob | null = avatarBlob;
      let finalDataUrl: string | null = avatarDataUrl;

      if (!uploadBlob && avatarDataUrl) {
        // localStorageの画像を再利用
        uploadBlob = dataUrlToBlob(avatarDataUrl);
      }

      if (uploadBlob && sessionId) {
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(`${sessionId}.jpg`, uploadBlob, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(`${sessionId}.jpg`);

          // RLS バイパスのため API 経由（admin クライアント）で更新
          await fetch(`/api/session/${sessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatar_url: urlData.publicUrl }),
          });

          // 新しく選んだ画像の場合は DataURL を更新
          if (avatarBlob && !finalDataUrl) {
            finalDataUrl = await blobToDataUrl(avatarBlob);
          }
        }
      }

      // localStorageに保存（次回ログイン時に自動復元）
      saveProfile({
        name: name.trim(),
        avatarDataUrl: finalDataUrl,
      });

      router.push('/room');
    } catch {
      setError('ネットワークエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // プロフィールをリセット
  const handleReset = () => {
    clearProfile();
    setName('');
    setAvatarBlob(null);
    setAvatarPreview(null);
    setAvatarDataUrl(null);
    setHasStoredProfile(false);
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

          {/* 保存済みプロフィールのプレビュー */}
          {hasStoredProfile && (
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover border-2 border-violet-400/60"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center
                                justify-center text-white font-bold text-sm border-2 border-violet-400/60">
                  {name.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{name}</p>
                <p className="text-amber-200/50 text-xs">保存済みプロフィール</p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-white/30 hover:text-white/60 text-xs transition shrink-0"
              >
                変更
              </button>
            </div>
          )}

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold
                       rounded-lg transition shadow-lg shadow-amber-600/30"
          >
            {hasStoredProfile ? '🙏 入室する' : '確認'}
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
              onUpload={async (blob, preview) => {
                setAvatarBlob(blob);
                setAvatarPreview(preview);
                // DataURLも保持（localStorage用）
                const dataUrl = await blobToDataUrl(blob);
                setAvatarDataUrl(dataUrl);
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
