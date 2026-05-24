'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Session } from '@/types';
import {
  drawAvatarWithPhoto,
  drawAvatarInitial,
  loadImage,
  getCachedImage,
} from '@/lib/avatars/shapes';

interface Props {
  sessions: Session[];
  mySessionId: string;
  onMove: (x: number, y: number) => void;
  onAvatarClick: (session: Session) => void;
}

const CANVAS_W = 900;
const CANVAS_H = 620;
const AVATAR_RADIUS = 24;

export default function RoomCanvas({ sessions, mySessionId, onMove, onAvatarClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // ── 背景（天心苑祈祷室風）──
    drawRoom(ctx);

    // ── アバター ──
    for (const s of sessions) {
      const isMe = s.id === mySessionId;
      if (s.avatar_url) {
        const cached = getCachedImage(s.avatar_url);
        if (cached) {
          drawAvatarWithPhoto(ctx, s.x, s.y, cached, s.name, AVATAR_RADIUS, isMe);
        } else {
          // ロード中はイニシャル表示、ロード完了後に再描画
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

  // クリック操作
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

      // アバタータップ判定
      for (const s of sessions) {
        if (s.id === mySessionId) continue;
        if (Math.hypot(x - s.x, y - s.y) <= AVATAR_RADIUS + 6) {
          onAvatarClick(s);
          return;
        }
      }
      onMove(x, y);
    },
    [sessions, mySessionId, onMove, onAvatarClick, getCanvasPos]
  );

  const handleTouch = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      const { x, y } = getCanvasPos(t.clientX, t.clientY);

      for (const s of sessions) {
        if (s.id === mySessionId) continue;
        if (Math.hypot(x - s.x, y - s.y) <= AVATAR_RADIUS + 12) {
          onAvatarClick(s);
          return;
        }
      }
      onMove(x, y);
    },
    [sessions, mySessionId, onMove, onAvatarClick, getCanvasPos]
  );

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      onClick={handleClick}
      onTouchStart={handleTouch}
      className="w-full h-full rounded-lg cursor-pointer touch-none select-none"
      style={{ maxHeight: 'calc(100vh - 56px)' }}
    />
  );
}

// ─────────────────────────────────────────────────────────
// 天心苑祈祷室の背景描画
// ─────────────────────────────────────────────────────────

function drawRoom(ctx: CanvasRenderingContext2D) {
  const W = CANVAS_W;
  const H = CANVAS_H;

  // ① 床全体（明るい木目グラデーション）
  const floorGrad = ctx.createLinearGradient(0, 180, 0, H);
  floorGrad.addColorStop(0, '#e8c98a');
  floorGrad.addColorStop(0.5, '#d4a96a');
  floorGrad.addColorStop(1, '#c49050');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, 0, W, H);

  // ② 木目パターン（横方向の薄いライン）
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#8B5E3C';
  ctx.lineWidth = 1;
  for (let y = 200; y < H; y += 18) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // 縦目（パーケット風）
  ctx.globalAlpha = 0.06;
  for (let x = 0; x < W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 180);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.restore();

  // ③ 壁エリア（上部：オフホワイト）
  const wallGrad = ctx.createLinearGradient(0, 0, 0, 190);
  wallGrad.addColorStop(0, '#f8f4ee');
  wallGrad.addColorStop(1, '#f0ece4');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, W, 165);

  // ④ 天井コーファードパネル（格子模様）
  ctx.save();
  ctx.strokeStyle = '#d4c8b8';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 90) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 165); ctx.stroke();
  }
  for (let y = 0; y <= 165; y += 55) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();

  // ⑤ 木製壇（祭壇台）
  const daisGrad = ctx.createLinearGradient(0, 155, 0, 195);
  daisGrad.addColorStop(0, '#a0724a');
  daisGrad.addColorStop(1, '#7a5230');
  ctx.fillStyle = daisGrad;
  ctx.fillRect(0, 158, W, 38);

  // 壇の上辺ハイライト
  ctx.fillStyle = '#c8966e';
  ctx.fillRect(0, 158, W, 3);

  // ⑥ 柱（左右）
  drawColumn(ctx, 60, 0, 165);
  drawColumn(ctx, W - 60, 0, 165);

  // ⑦ 御真影エリア（中央の白壁部分）
  drawAltar(ctx, W / 2, 80);

  // ⑧ 部屋の輪郭（薄いシャドウ）
  ctx.save();
  ctx.strokeStyle = 'rgba(100,70,30,0.3)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.restore();

  // ⑨ 床と壁の境界ライン（巾木）
  ctx.fillStyle = '#8B5E3C';
  ctx.fillRect(0, 193, W, 5);
}

/** 柱 */
function drawColumn(ctx: CanvasRenderingContext2D, cx: number, top: number, bottom: number) {
  const w = 28;
  const grad = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  grad.addColorStop(0, '#a07848');
  grad.addColorStop(0.3, '#c8966e');
  grad.addColorStop(0.7, '#b08050');
  grad.addColorStop(1, '#7a5230');
  ctx.fillStyle = grad;
  ctx.fillRect(cx - w / 2, top, w, bottom - top);

  // 柱の輪郭
  ctx.strokeStyle = '#7a5230';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2, top, w, bottom - top);
}

/** 祭壇・御真影 */
function drawAltar(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  // 中央の大きな御真影額縁
  drawFrame(ctx, cx, cy, 100, 90, true);

  // 左の小さな額縁（2枚）
  drawFrame(ctx, cx - 170, cy + 10, 55, 75, false);
  drawFrame(ctx, cx - 110, cy + 10, 45, 70, false);

  // 右の小さな額縁
  drawFrame(ctx, cx + 145, cy + 5, 50, 72, false);

  // 蝋燭（5本）
  const candleXs = [cx - 60, cx - 30, cx, cx + 30, cx + 60];
  candleXs.forEach((x) => drawCandle(ctx, x, cy + 55));

  // 花（中央下）
  ctx.save();
  ctx.font = '14px serif';
  ctx.textAlign = 'center';
  ctx.fillText('🌸', cx, cy + 76);
  ctx.restore();
}

/** 額縁 */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  w: number, h: number,
  isMain: boolean
) {
  const fw = isMain ? 6 : 4; // 枠の太さ

  // 額縁（ゴールド）
  ctx.fillStyle = '#c8a832';
  ctx.fillRect(cx - w / 2 - fw, cy - h / 2 - fw, w + fw * 2, h + fw * 2);

  // 絵の部分（暗め）
  ctx.fillStyle = isMain ? '#2a1a10' : '#1a1210';
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);

  // 内側ハイライト
  ctx.strokeStyle = '#e8c840';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2 - fw + 1, cy - h / 2 - fw + 1, w + fw * 2 - 2, h + fw * 2 - 2);
}

/** 蝋燭 */
function drawCandle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // 本体
  ctx.fillStyle = '#f5f0e0';
  ctx.fillRect(x - 3, y - 10, 6, 14);

  // 炎
  ctx.beginPath();
  ctx.ellipse(x, y - 12, 3, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 180, 40, 0.9)';
  ctx.fill();

  // 光のグロー
  const grd = ctx.createRadialGradient(x, y - 12, 1, x, y - 12, 10);
  grd.addColorStop(0, 'rgba(255,220,80,0.4)');
  grd.addColorStop(1, 'rgba(255,150,0,0)');
  ctx.beginPath();
  ctx.arc(x, y - 12, 10, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();
}
