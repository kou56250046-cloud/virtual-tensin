/**
 * 座布団グリッドの定数と座標計算ユーティリティ
 */

export const ZABUTON_LEFT = {
  startX: 8,
  startY: 218,
  areaW: 278,
  areaH: 412,
  cols: 6,
  rows: 8,
} as const;

export const ZABUTON_RIGHT = {
  startX: 614,
  startY: 218,
  areaW: 278,
  areaH: 412,
  cols: 6,
  rows: 8,
} as const;

/** seat_id の center 座標を返す */
export function getSeatCenter(seatId: string): { x: number; y: number } | null {
  const parts = seatId.split('-');
  if (parts.length !== 3) return null;
  const [side, r, c] = parts;
  const row = parseInt(r);
  const col = parseInt(c);
  const area = side === 'L' ? ZABUTON_LEFT : ZABUTON_RIGHT;
  const cellW = area.areaW / area.cols;
  const cellH = area.areaH / area.rows;
  return {
    x: area.startX + col * cellW + cellW / 2,
    y: area.startY + row * cellH + cellH / 2,
  };
}

/** クリック座標から seat_id を返す（座布団エリア外は null） */
export function getZabutonAt(x: number, y: number): string | null {
  for (const [side, area] of [
    ['L', ZABUTON_LEFT],
    ['R', ZABUTON_RIGHT],
  ] as const) {
    if (
      x >= area.startX &&
      x < area.startX + area.areaW &&
      y >= area.startY &&
      y < area.startY + area.areaH
    ) {
      const cellW = area.areaW / area.cols;
      const cellH = area.areaH / area.rows;
      const col = Math.floor((x - area.startX) / cellW);
      const row = Math.floor((y - area.startY) / cellH);
      return `${side}-${row}-${col}`;
    }
  }
  return null;
}
