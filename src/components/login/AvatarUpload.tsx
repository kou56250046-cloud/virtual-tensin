'use client';

import { useRef, useState } from 'react';
import { resizeImage } from '@/lib/imageResize';

interface Props {
  onUpload: (blob: Blob, previewUrl: string) => void;
  previewUrl: string | null;
}

export default function AvatarUpload({ onUpload, previewUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルタイプチェック
    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // クライアント側でリサイズ（200×200px, JPEG 0.75）
      const blob = await resizeImage(file, 200, 0.75);
      const previewUrl = URL.createObjectURL(blob);
      onUpload(blob, previewUrl);
    } catch (err) {
      setError('画像の処理に失敗しました。別の画像を試してください。');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* アバタープレビュー */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative group"
      >
        <div className="w-20 h-20 rounded-full overflow-hidden border-3 border-amber-400/60
                        bg-amber-100/20 flex items-center justify-center transition
                        group-hover:border-amber-400">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="アバタープレビュー"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center">
              <div className="text-3xl">👤</div>
            </div>
          )}
        </div>

        {/* ホバー時のオーバーレイ */}
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100
                        transition flex items-center justify-center">
          <span className="text-white text-xs font-medium">変更</span>
        </div>
      </button>

      {/* ボタン */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="px-4 py-2 bg-white/15 hover:bg-white/25 border border-white/30
                   text-white text-sm rounded-lg transition disabled:opacity-50"
      >
        {loading ? '処理中...' : previewUrl ? '📷 写真を変更' : '📷 写真をアップロード'}
      </button>

      {/* スマホ: カメラ + ギャラリー両対応 */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <p className="text-white/40 text-xs text-center">
        スマホのカメラや写真からも選べます<br />
        自動で小さくリサイズされます
      </p>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
