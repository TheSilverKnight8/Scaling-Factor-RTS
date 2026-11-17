import { DEFAULT_ZOOM, HH, HW, ZOOMS } from '../render/iso';

/** What part of the map is on screen: the world point at the screen's center, and the zoom. */
export class Camera {
  x = 0;
  y = 0;
  zoomIndex = DEFAULT_ZOOM;
  /** Screen size in CSS pixels. */
  width = 1;
  height = 1;

  get zoom() {
    return ZOOMS[this.zoomIndex];
  }

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

  setZoom(index: number) {
    this.zoomIndex = Math.max(0, Math.min(ZOOMS.length - 1, index));
  }
}
