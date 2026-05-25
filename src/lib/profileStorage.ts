/**
 * プロフィール情報をlocalStorageに永続保存するユーティリティ
 */

const PROFILE_KEY = 'tensinen_profile';

export interface StoredProfile {
  name: string;
  avatarDataUrl: string | null; // base64画像（リサイズ済み、約30〜50KB）
}

/** 保存されたプロフィールを読み込む */
export function loadProfile(): StoredProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as StoredProfile) : null;
  } catch {
    return null;
  }
}

/** プロフィールを保存する */
export function saveProfile(profile: StoredProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // localStorage が使えない環境（プライベートブラウザ等）は無視
  }
}

/** プロフィールを削除する */
export function clearProfile(): void {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {}
}

/** DataURL → Blob に変換（再アップロード時に使用） */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

/** Blob → DataURL に変換（保存時に使用） */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
