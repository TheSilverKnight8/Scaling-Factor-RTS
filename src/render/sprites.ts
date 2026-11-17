// Cached pictures of things drawn many times (units). Each picture is drawn once per look and
// scale with the same vector code, then stamped onto the screen, which is far cheaper than
// stroking every figure every frame when hundreds are on screen.

interface Sprite {
  canvas: HTMLCanvasElement;
  /** Device pixels from the picture's top-left corner to the anchor (the unit's feet). */
  ax: number;
  ay: number;
}

export class SpriteCache {
  private sprites = new Map<string, Sprite>();
  private scale = 0;

  /**
   * The picture for `key` at `scale` device pixels per world pixel. `bounds` is the drawing's
   * extent around the anchor, in world pixels; `draw` draws it with the anchor at (0, 0).
   */
  get(key: string, scale: number, bounds: { left: number; top: number; right: number; bottom: number }, draw: (ctx: CanvasRenderingContext2D) => void): Sprite {
    if (scale !== this.scale) {
      this.sprites.clear();
      this.scale = scale;
    }
    let s = this.sprites.get(key);
    if (s) return s;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil((bounds.right - bounds.left) * scale) + 4;
    canvas.height = Math.ceil((bounds.bottom - bounds.top) * scale) + 4;
    const ax = Math.round(-bounds.left * scale) + 2;
    const ay = Math.round(-bounds.top * scale) + 2;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(scale, 0, 0, scale, ax, ay);
    draw(ctx);
    s = { canvas, ax, ay };
    if (this.sprites.size > 4000) this.sprites.clear();
    this.sprites.set(key, s);
    return s;
  }
}
