import { useEffect, useRef } from 'react';
import { footprint, type StructureKind } from '../../sim/content/structures';
import { HH, HW } from '../../render/iso';
import { STRUCTURE_HEIGHT, drawStructure } from '../../render/objects';
import { PLAYER_COLORS } from '../../render/style';

/** A small picture of a structure, drawn with the same code as the map. */
export function StructureIcon({ kind, color = 0, size = 52 }: { kind: StructureKind; color?: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d')!;
    const { w, h } = footprint(kind, 0);
    const height = STRUCTURE_HEIGHT[kind] ?? 24;
    const left = -h * HW;
    const right = w * HW;
    const top = -height;
    const bottom = (w + h) * HH;
    const k = Math.min((size * dpr) / (right - left + 10), (size * dpr) / (bottom - top + 10));
    ctx.setTransform(k, 0, 0, k, (size * dpr) / 2 - ((left + right) / 2) * k, (size * dpr) / 2 - ((top + bottom) / 2) * k);
    const col = PLAYER_COLORS[color];
    drawStructure(ctx, { kind, x: 0, y: 0, w, h, rot: 0, color: col.main, dark: col.dark }, 0);
  }, [kind, color, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}
