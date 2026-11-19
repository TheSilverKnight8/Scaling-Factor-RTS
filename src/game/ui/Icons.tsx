import { useEffect, useRef } from 'react';
import type { ItemId } from '../../sim/content/items';
import type { ToolId } from '../Game';
import { footprint, type StructureKind } from '../../sim/content/structures';
import { HH, HW } from '../../render/iso';
import { STRUCTURE_HEIGHT, drawStructure } from '../../render/objects';
import { PLAYER_COLORS } from '../../render/style';
import { drawBelt, drawItemIcon, drawPipe, drawPowerLine, drawSplitterMerger } from '../../render/transport';

// Small pictures for the interface, drawn with the same code as the map.

function useCanvas(size: number, draw: (ctx: CanvasRenderingContext2D, px: number) => void, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    draw(ctx, size * dpr);
  }, deps);
  return ref;
}

/** Fits a drawing of world-pixel bounds into the square canvas. */
function fit(ctx: CanvasRenderingContext2D, px: number, left: number, top: number, right: number, bottom: number) {
  const k = Math.min(px / (right - left + 10), px / (bottom - top + 10));
  ctx.setTransform(k, 0, 0, k, px / 2 - ((left + right) / 2) * k, px / 2 - ((top + bottom) / 2) * k);
}

export function StructureIcon({ kind, color = 0, size = 52 }: { kind: StructureKind; color?: number; size?: number }) {
  const ref = useCanvas(
    size,
    (ctx, px) => {
      const { w, h } = footprint(kind, 0);
      const height = STRUCTURE_HEIGHT[kind] ?? 24;
      fit(ctx, px, -h * HW, -height, w * HW, (w + h) * HH);
      const col = PLAYER_COLORS[color];
      drawStructure(ctx, { kind, x: 0, y: 0, w, h, rot: 0, color: col.main, dark: col.dark }, 0);
    },
    [kind, color, size],
  );
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}

/** The build menu's picture for any tool: structures, belts, splitters, mergers, power lines. */
export function ToolIcon({ id, color = 0, size = 52 }: { id: ToolId; color?: number; size?: number }) {
  const ref = useCanvas(
    size,
    (ctx, px) => {
      const col = PLAYER_COLORS[color];
      if (id === 'belt') {
        fit(ctx, px, -2 * HW, -4, 2 * HW, 3 * HH);
        drawBelt(ctx, 0, 0, 0, null, 0, true);
        drawBelt(ctx, 1, 0, 1, 0, 0, true);
        drawBelt(ctx, 1, 1, 1, null, 0, true);
      } else if (id === 'pipe') {
        fit(ctx, px, -2 * HW, -10, 2 * HW, 3 * HH);
        drawPipe(ctx, 0, 0, 0, null);
        drawPipe(ctx, 1, 0, 1, 0);
        drawPipe(ctx, 1, 1, 1, null);
      } else if (id === 'splitter' || id === 'merger') {
        fit(ctx, px, -HW, -12, HW, 2 * HH);
        drawSplitterMerger(ctx, id, 0, 0, 1, col.main, col.dark);
      } else if (id === 'line') {
        fit(ctx, px, -40, -40, 40, 10);
        drawPowerLine(ctx, [-34, -24], [34, -30]);
        for (const [x, y] of [
          [-34, -24],
          [34, -30],
        ]) {
          ctx.fillStyle = col.main;
          ctx.strokeStyle = '#002657';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else if (id !== 'placeUnit' && id !== 'patrol') {
        const { w, h } = footprint(id, 0);
        const height = STRUCTURE_HEIGHT[id] ?? 24;
        fit(ctx, px, -h * HW, -height, w * HW, (w + h) * HH);
        drawStructure(ctx, { kind: id, x: 0, y: 0, w, h, rot: 0, color: col.main, dark: col.dark }, 0);
      }
    },
    [id, color, size],
  );
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}

export function ItemIcon({ item, size = 18 }: { item: ItemId; size?: number }) {
  const ref = useCanvas(
    size,
    (ctx, px) => {
      fit(ctx, px, -8, -7, 8, 6);
      drawItemIcon(ctx, item);
    },
    [item, size],
  );
  return <canvas ref={ref} className="shrink-0" style={{ width: size, height: size }} aria-hidden />;
}

