/**
 * oVice 風の丸形プロフィール写真アバターを Canvas に描画
 */

// 画像キャッシュ
const imageCache = new Map<string, HTMLImageElement>();

/**
 * プロフィール写真アバターを描画（写真あり）
 */
export function drawAvatarWithPhoto(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  img: HTMLImageElement,
  name: string,
  radius = 24,
  isSelected = false
) {
  ctx.save();

  // 選択リング（金色）
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#c8a832';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // 白いボーダー
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // 丸くクリップして写真を描画
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);

  ctx.restore();

  // 名前ラベル
  drawNameLabel(ctx, cx, cy + radius + 4, name);
}

/**
 * イニシャルフォールバックアバターを描画（写真なし）
 */
export function drawAvatarInitial(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  name: string,
  color: string,
  radius = 24,
  isSelected = false
) {
  ctx.save();

  // 選択リング
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#c8a832';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // 白ボーダー
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // 色付き円
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // イニシャル文字
  const initial = name.charAt(0).toUpperCase() || '?';
  ctx.font = `bold ${Math.round(radius * 0.9)}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, cx, cy);

  ctx.restore();

  // 名前ラベル
  drawNameLabel(ctx, cx, cy + radius + 4, name);
}

/**
 * 名前ラベル（半透明背景付き）
 */
function drawNameLabel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  name: string
) {
  const label = name.length > 8 ? name.slice(0, 8) + '…' : name;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const metrics = ctx.measureText(label);
  const pw = metrics.width + 8;
  const ph = 15;

  // ラベル背景
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.roundRect(cx - pw / 2, y, pw, ph, 4);
  ctx.fill();

  // テキスト
  ctx.fillStyle = '#3a2a1a';
  ctx.fillText(label, cx, y + 1);
}

/**
 * URL から画像をロード（キャッシュ付き）
 * 非同期でロードし、準備ができたら onLoad コールバックを呼ぶ
 */
export function loadImage(
  url: string,
  onLoad: (img: HTMLImageElement) => void
): HTMLImageElement | null {
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    imageCache.set(url, img);
    onLoad(img);
  };
  img.onerror = () => {
    // ロード失敗はフォールバックで対応
  };
  img.src = url;
  return null;
}

/** キャッシュから画像を取得 */
export function getCachedImage(url: string): HTMLImageElement | null {
  return imageCache.get(url) ?? null;
}

/** キャッシュをクリア */
export function clearImageCache() {
  imageCache.clear();
}
