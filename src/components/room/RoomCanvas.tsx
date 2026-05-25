'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Session } from '@/types';
import {
  drawAvatarWithPhoto,
  drawAvatarInitial,
  loadImage,
  getCachedImage,
} from '@/lib/avatars/shapes';
import { ZABUTON_LEFT, ZABUTON_RIGHT, getZabutonAt } from '@/lib/zabuton';

interface Props {
  sessions: Session[];
  mySessionId: string;
  mySeatId: string | null;
  onMove: (x: number, y: number) => void;
  onAvatarClick: (session: Session) => void;
  onZabutonClick: (seatId: string, x: number, y: number) => void;
}

const CANVAS_W = 900;
const CANVAS_H = 1280;
const AVATAR_RADIUS = 24;
const SEATED_RADIUS = 16;

export default function RoomCanvas({
  sessions,
  mySessionId,
  mySeatId,
  onMove,
  onAvatarClick,
  onZabutonClick,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // ── 背景（天心苑祈祷室風）──
    drawRoom(ctx, () => draw());

    // ── 座布団グリッド（着席状態を反映）──
    drawZabutonGrids(ctx, sessions, () => draw());

    // ── アバター（着席中は小さく表示しない：座布団上に描画済みのため非表示）──
    for (const s of sessions) {
      if (s.seat_id) continue; // 着席中は座布団グリッド内で描画済み
      const isMe = s.id === mySessionId;
      if (s.avatar_url) {
        const cached = getCachedImage(s.avatar_url);
        if (cached) {
          drawAvatarWithPhoto(ctx, s.x, s.y, cached, s.name, AVATAR_RADIUS, isMe);
        } else {
          drawAvatarInitial(ctx, s.x, s.y, s.name, s.color, AVATAR_RADIUS, isMe);
          loadImage(s.avatar_url, () => draw());
        }
      } else {
        drawAvatarInitial(ctx, s.x, s.y, s.name, s.color, AVATAR_RADIUS, isMe);
      }
    }
  }, [sessions, mySessionId]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Canvas 上の座標に変換
  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (CANVAS_W / rect.width),
      y: (clientY - rect.top) * (CANVAS_H / rect.height),
    };
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasPos(e.clientX, e.clientY);

      // 1. 他のアバターをクリック → 話しかける
      for (const s of sessions) {
        if (s.id === mySessionId) continue;
        const radius = s.seat_id ? SEATED_RADIUS : AVATAR_RADIUS;
        if (Math.hypot(x - s.x, y - s.y) <= radius + 6) {
          onAvatarClick(s);
          return;
        }
      }

      // 2. 座布団エリアをクリック → 着席/離席
      const seatId = getZabutonAt(x, y);
      if (seatId) {
        onZabutonClick(seatId, x, y);
        return;
      }

      // 3. 床をクリック → 移動（着席中は移動不可）
      if (!mySeatId) {
        onMove(x, y);
      }
    },
    [sessions, mySessionId, mySeatId, onMove, onAvatarClick, onZabutonClick, getCanvasPos]
  );

  const handleTouch = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      const { x, y } = getCanvasPos(t.clientX, t.clientY);

      for (const s of sessions) {
        if (s.id === mySessionId) continue;
        const radius = s.seat_id ? SEATED_RADIUS : AVATAR_RADIUS;
        if (Math.hypot(x - s.x, y - s.y) <= radius + 12) {
          onAvatarClick(s);
          return;
        }
      }

      const seatId = getZabutonAt(x, y);
      if (seatId) {
        onZabutonClick(seatId, x, y);
        return;
      }

      if (!mySeatId) {
        onMove(x, y);
      }
    },
    [sessions, mySessionId, mySeatId, onMove, onAvatarClick, onZabutonClick, getCanvasPos]
  );

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      onClick={handleClick}
      onTouchStart={handleTouch}
      className="rounded-lg cursor-pointer touch-none select-none"
      style={{
        width: '100%',
        maxWidth: `${CANVAS_W}px`,
        height: 'auto',
        display: 'block',
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────
// 天心苑祈祷室の背景描画
// ─────────────────────────────────────────────────────────

function drawRoom(ctx: CanvasRenderingContext2D, onLoad: () => void) {
  const W = CANVAS_W;
  const H = CANVAS_H;

  // ① 床全体（木目グラデーション）
  const floorGrad = ctx.createLinearGradient(0, 195, 0, H);
  floorGrad.addColorStop(0, '#e8c98a');
  floorGrad.addColorStop(0.4, '#d4a96a');
  floorGrad.addColorStop(1, '#c49050');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, 0, W, H);

  // ② 木目パターン（横線）
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = '#8B5E3C';
  ctx.lineWidth = 1;
  for (let y = 215; y < H; y += 18) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.globalAlpha = 0.05;
  for (let x = 0; x < W; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 215); ctx.lineTo(x, H); ctx.stroke();
  }
  ctx.restore();

  // ③ 中央通路ハイライト（座布団エリアとの差別化）
  ctx.save();
  ctx.fillStyle = 'rgba(240, 210, 155, 0.20)';
  ctx.fillRect(300, 215, 300, H - 215);
  ctx.restore();

  // ④ 壁エリア（オフホワイト）
  const wallGrad = ctx.createLinearGradient(0, 0, 0, 165);
  wallGrad.addColorStop(0, '#f8f4ee');
  wallGrad.addColorStop(1, '#f0ece4');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, W, 165);

  // ⑤ 天井コーファードパネル
  ctx.save();
  ctx.strokeStyle = '#d4c8b8';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 90) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 165); ctx.stroke();
  }
  for (let y2 = 0; y2 <= 165; y2 += 55) {
    ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(W, y2); ctx.stroke();
  }
  ctx.restore();

  // ⑥ 木製壇（祭壇台）
  const daisGrad = ctx.createLinearGradient(0, 158, 0, 200);
  daisGrad.addColorStop(0, '#a0724a');
  daisGrad.addColorStop(1, '#7a5230');
  ctx.fillStyle = daisGrad;
  ctx.fillRect(0, 158, W, 42);
  ctx.fillStyle = '#c8966e';
  ctx.fillRect(0, 158, W, 3);

  // ⑦ 柱（左右）
  drawColumn(ctx, 60, 0, 165);
  drawColumn(ctx, W - 60, 0, 165);

  // ⑧ 御真影（写真）
  drawAltarWithImages(ctx, onLoad);

  // ⑨ 蝋燭 8本
  const candleXs = [310, 348, 386, 424, 476, 514, 552, 590];
  candleXs.forEach((x) => drawCandle(ctx, x, 173));

  // ⑩ 巾木
  ctx.fillStyle = '#8B5E3C';
  ctx.fillRect(0, 198, W, 5);

  // ⑪ 部屋の輪郭
  ctx.save();
  ctx.strokeStyle = 'rgba(100,70,30,0.3)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.restore();
}

// ─── 御真影（写真＋金額縁） ───────────────────────────────

function drawAltarWithImages(ctx: CanvasRenderingContext2D, onLoad: () => void) {
  // 天心苑建物アイコン（左右）
  drawTenshinenBuilding(ctx, 100, 112);
  drawTenshinenBuilding(ctx, 800, 112);

  // left_1（小・左）
  const img1 = getCachedImage('/portraits/left_1.png');
  if (img1) drawPortrait(ctx, 270, 82, 66, 90, img1);
  else { drawPortraitPlaceholder(ctx, 270, 82, 66, 90); loadImage('/portraits/left_1.png', onLoad); }

  // left_2（小・左寄り）
  const img2 = getCachedImage('/portraits/left_2.png');
  if (img2) drawPortrait(ctx, 352, 81, 62, 87, img2);
  else { drawPortraitPlaceholder(ctx, 352, 81, 62, 87); loadImage('/portraits/left_2.png', onLoad); }

  // left_3（大・中央・ご夫妻）
  const img3 = getCachedImage('/portraits/left_3.png');
  if (img3) drawPortrait(ctx, 450, 75, 106, 136, img3);
  else { drawPortraitPlaceholder(ctx, 450, 75, 106, 136); loadImage('/portraits/left_3.png', onLoad); }

  // left_4（小・右）
  const img4 = getCachedImage('/portraits/left_4.png');
  if (img4) drawPortrait(ctx, 618, 81, 62, 86, img4);
  else { drawPortraitPlaceholder(ctx, 618, 81, 62, 86); loadImage('/portraits/left_4.png', onLoad); }

  // 花（中央下）
  ctx.save();
  ctx.font = '13px serif';
  ctx.textAlign = 'center';
  ctx.fillText('🌸', 450, 155);
  ctx.restore();
}

/** 額縁付き御真影を描画 */
function drawPortrait(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  w: number, h: number,
  img: HTMLImageElement
) {
  const fw = 5;
  ctx.fillStyle = '#c8a832';
  ctx.fillRect(cx - w / 2 - fw, cy - h / 2 - fw, w + fw * 2, h + fw * 2);
  ctx.strokeStyle = '#e8d060';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2 - fw + 1, cy - h / 2 - fw + 1, w + fw * 2 - 2, h + fw * 2 - 2);
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
}

/** 御真影プレースホルダー */
function drawPortraitPlaceholder(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  w: number, h: number
) {
  const fw = 5;
  ctx.fillStyle = '#c8a832';
  ctx.fillRect(cx - w / 2 - fw, cy - h / 2 - fw, w + fw * 2, h + fw * 2);
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
}

/** 天心苑建物アイコン（Canvas描画） */
function drawTenshinenBuilding(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const bw = 72, bh = 58;
  const bx = cx - bw / 2, by = cy - bh / 2;

  // ベース（茶色）
  ctx.fillStyle = '#8B5E3C';
  ctx.fillRect(bx, by + bh - 8, bw, 8);

  // 壁（クリーム）
  ctx.fillStyle = '#f5f0e8';
  ctx.fillRect(bx + 4, by + 18, bw - 8, bh - 26);
  ctx.strokeStyle = '#c8b89a';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 4, by + 18, bw - 8, bh - 26);

  // アーチ窓 × 2
  ctx.fillStyle = '#7a5230';
  ([
    [bx + 14, by + bh - 20],
    [bx + bw - 30, by + bh - 20],
  ] as [number, number][]).forEach(([wx, wy]) => {
    ctx.fillRect(wx, wy, 12, 12);
    ctx.beginPath();
    ctx.arc(wx + 6, wy, 6, Math.PI, 0);
    ctx.fill();
  });

  // 屋根（三角・ゴールド）
  ctx.beginPath();
  ctx.moveTo(bx, by + 20);
  ctx.lineTo(cx, by);
  ctx.lineTo(bx + bw, by + 20);
  ctx.closePath();
  ctx.fillStyle = '#e8d060';
  ctx.fill();
  ctx.strokeStyle = '#c8a832';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // テキスト「天心苑」
  ctx.fillStyle = '#7a5230';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('天心苑', cx, by + 22);
  ctx.textBaseline = 'alphabetic';
}

/** 柱 */
function drawColumn(ctx: CanvasRenderingContext2D, cx: number, top: number, bottom: number) {
  const w = 28;
  const grad = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  grad.addColorStop(0, '#a07848');
  grad.addColorStop(0.35, '#c8966e');
  grad.addColorStop(0.65, '#b08050');
  grad.addColorStop(1, '#7a5230');
  ctx.fillStyle = grad;
  ctx.fillRect(cx - w / 2, top, w, bottom - top);
  ctx.strokeStyle = '#7a5230';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2, top, w, bottom - top);
}

/** 蝋燭 */
function drawCandle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#f5f0e0';
  ctx.fillRect(x - 3, y - 10, 6, 14);
  ctx.beginPath();
  ctx.ellipse(x, y - 12, 3, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 180, 40, 0.9)';
  ctx.fill();
  const grd = ctx.createRadialGradient(x, y - 12, 1, x, y - 12, 10);
  grd.addColorStop(0, 'rgba(255,220,80,0.4)');
  grd.addColorStop(1, 'rgba(255,150,0,0)');
  ctx.beginPath();
  ctx.arc(x, y - 12, 10, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();
}

// ─────────────────────────────────────────────────────────
// 着席アバター描画（クッション内に収まるよう最適化）
// ─────────────────────────────────────────────────────────

function drawSeatedAvatar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  img: HTMLImageElement | null,
  name: string, color: string,
  r: number
) {
  ctx.save();

  // 白ボーダー
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  if (img) {
    // 写真（丸クリップ）
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  } else {
    // 色円 + 頭文字
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.font = `bold ${Math.round(r * 0.9)}px sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.charAt(0) || '?', cx, cy);
  }

  ctx.restore();

  // 小さい名前テキスト（クッション内下部）
  const label = name.length > 5 ? name.slice(0, 4) + '…' : name;
  ctx.font = '9px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, cx, cy + r + 2);
  ctx.textBaseline = 'alphabetic';
}

// ─────────────────────────────────────────────────────────
// 座布団グリッド描画（着席状態付き）
// ─────────────────────────────────────────────────────────

function drawZabutonGrids(
  ctx: CanvasRenderingContext2D,
  sessions: Session[],
  onLoad: () => void
) {
  const occupiedSeats = new Map<string, Session>();
  for (const s of sessions) {
    if (s.seat_id) occupiedSeats.set(s.seat_id, s);
  }
  drawZabutonArea(ctx, ZABUTON_LEFT, 'L', occupiedSeats, onLoad);
  drawZabutonArea(ctx, ZABUTON_RIGHT, 'R', occupiedSeats, onLoad);
}

interface ZabutonArea {
  startX: number;
  startY: number;
  areaW: number;
  areaH: number;
  cols: number;
  rows: number;
}

function drawZabutonArea(
  ctx: CanvasRenderingContext2D,
  area: ZabutonArea,
  side: 'L' | 'R',
  occupiedSeats: Map<string, Session>,
  onLoad: () => void
) {
  const cellW = area.areaW / area.cols;
  const cellH = area.areaH / area.rows;
  const pad = 18;

  for (let r = 0; r < area.rows; r++) {
    for (let c = 0; c < area.cols; c++) {
      const x = area.startX + c * cellW + pad / 2;
      const y = area.startY + r * cellH + pad / 2;
      const w = cellW - pad;
      const h = cellH - pad;
      const seatId = `${side}-${r}-${c}`;
      const occupant = occupiedSeats.get(seatId);

      // クッション本体
      ctx.fillStyle = occupant ? '#9333ea' : '#7c3aed';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, 4);
      else ctx.rect(x, y, w, h);
      ctx.fill();

      // 上面ハイライト
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + 3, y + 3, w - 6, 5);

      // 縫い目
      ctx.strokeStyle = occupant ? '#a855f7' : '#6d28d9';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + 4); ctx.lineTo(x + w / 2, y + h - 4); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 4, y + h / 2); ctx.lineTo(x + w - 4, y + h / 2); ctx.stroke();

      // 着席中：クッション上に小アバター
      if (occupant) {
        const cx2 = x + w / 2;
        const cy2 = y + h * 0.42; // 名前ラベル分を考慮して少し上
        const r2 = Math.min(Math.min(w, h) / 2 - 3, 14); // 最大14px
        if (occupant.avatar_url) {
          const cached = getCachedImage(occupant.avatar_url);
          if (cached) {
            drawSeatedAvatar(ctx, cx2, cy2, cached, occupant.name, occupant.color, r2);
          } else {
            drawSeatedAvatar(ctx, cx2, cy2, null, occupant.name, occupant.color, r2);
            loadImage(occupant.avatar_url, onLoad);
          }
        } else {
          drawSeatedAvatar(ctx, cx2, cy2, null, occupant.name, occupant.color, r2);
        }
      }
    }
  }
}
