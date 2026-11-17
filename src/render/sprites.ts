// Cached pictures of things drawn many times (units). Each picture is drawn once per look and
// scale with the same vector code, then stamped onto the screen, which is far cheaper than
// stroking every figure every frame.

interface Sprite {
  canvas: HTMLCanvasElement;
  /** Device pixels from the picture's top-left corner to the anchor (the unit's feet). */
  ax: number;
  ay: number;
  scale: number;
}

/** Sprite scales: steps of a quarter power of two, from 1/4 to 4. */
const SCALES = Array.from({ length: 17 }, (_, i) => 2 ** ((i - 8) / 4));

function spriteScale(k: number) {
  for (const s of SCALES) if (s >= k - 1e-6) return s;
  return SCALES[SCALES.length - 1];
}

export class SpriteCache {
  private sprites = new Map<string, Sprite>();

  /**
   * Draws the picture for `key` with its anchor at device pixel (dx, dy), at `k` device pixels per
   * world pixel. `bounds` is the drawing's extent around the anchor in world pixels; `draw` draws
   * it with the anchor at (0, 0). The context must have no transform set. While the zoom is
   * changing (`settled` false) pictures come from a few fixed scales and are stretched; once it
   * settles they are made at the exact scale.
   */
  stamp(ctx: CanvasRenderingContext2D, key: string, k: number, settled: boolean, dx: number, dy: number, bounds: { left: number; top: number; right: number; bottom: number }, draw: (c: CanvasRenderingContext2D) => void) {
    const scale = settled ? Math.round(k * 1000) / 1000 : spriteScale(k);
    const full = `${scale}:${key}`;
    let s = this.sprites.get(full);
    if (!s) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil((bounds.right - bounds.left) * scale) + 4;
      canvas.height = Math.ceil((bounds.bottom - bounds.top) * scale) + 4;
      const ax = Math.round(-bounds.left * scale) + 2;
      const ay = Math.round(-bounds.top * scale) + 2;
      const c = canvas.getContext('2d')!;
      c.setTransform(scale, 0, 0, scale, ax, ay);
      draw(c);
      s = { canvas, ax, ay, scale };
      if (this.sprites.size > 3000) this.sprites.clear();
      this.sprites.set(full, s);
    }
    const r = k / s.scale;
    if (r > 0.999 && r < 1.001) ctx.drawImage(s.canvas, Math.round(dx - s.ax), Math.round(dy - s.ay));
    else ctx.drawImage(s.canvas, dx - s.ax * r, dy - s.ay * r, s.canvas.width * r, s.canvas.height * r);
  }
}
