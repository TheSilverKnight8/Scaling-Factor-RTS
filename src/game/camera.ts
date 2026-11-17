import { HH, HW, MAX_ZOOM, MIN_ZOOM, START_ZOOM } from '../render/iso';

/** What part of the map is on screen: the world point at the screen's center, and the zoom. */
export class Camera {
  x = 0;
  y = 0;
  /** Screen pixels per world pixel, from MIN_ZOOM to MAX_ZOOM. Any value in between (smooth zoom). */
  zoom = START_ZOOM;
  /** Screen size in CSS pixels. */
  width = 1;
  height = 1;

  toScreen(X: number, Y: number): [number, number] {
    return [(X - this.x) * this.zoom + this.width / 2, (Y - this.y) * this.zoom + this.height / 2];
  }

  toWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.width / 2) / this.zoom + this.x, (sy - this.height / 2) / this.zoom + this.y];
  }

  /** Keeps the screen's center over the map (a diamond `size` tiles a side). */
  clamp(size: number) {
    const maxX = size * HW;
    const maxY = size * 2 * HH;
    this.x = Math.max(-maxX, Math.min(maxX, this.x));
    this.y = Math.max(0, Math.min(maxY, this.y));
  }

  /**
   * Zooms by `factor`, keeping the world point under screen point (sx, sy) where it is (the
   * mouse pointer for the wheel and pinch, the screen's center for the buttons).
   */
  zoomAt(factor: number, sx: number, sy: number) {
    const [wx, wy] = this.toWorld(sx, sy);
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * factor));
    this.x = wx - (sx - this.width / 2) / this.zoom;
    this.y = wy - (sy - this.height / 2) / this.zoom;
  }
}
