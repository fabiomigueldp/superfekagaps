export type PixelFrame = readonly string[];
export type PixelPalette = Readonly<Record<string, string | null>>;

/** Authoring surface with integer coordinates; no DOM, interpolation or vector antialiasing. */
export class PixelGrid {
  private cells: string[][];
  constructor(readonly width: number, readonly height: number) {
    this.cells = Array.from({ length: height }, () => Array<string>(width).fill('_'));
  }
  dot(x: number, y: number, color: string): this {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.cells[y][x] = color;
    return this;
  }
  rect(x: number, y: number, w: number, h: number, color: string): this {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) this.dot(x + xx, y + yy, color);
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, color: string): this {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) this.dot(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps, color);
    return this;
  }
  stamp(rows: PixelFrame, x: number, y: number): this {
    rows.forEach((row, yy) => [...row].forEach((color, xx) => { if (color !== '_') this.dot(x + xx, y + yy, color); }));
    return this;
  }
  finish(): string[] { return this.cells.map(row => row.join('')); }
}

/** Immutable art is rasterized once, including facing and damage variants. */
export class SpriteAtlas {
  private frames = new WeakMap<PixelFrame, WeakMap<PixelPalette, Map<string, HTMLCanvasElement>>>();
  draw(ctx: CanvasRenderingContext2D, frame: PixelFrame, palette: PixelPalette,
    x: number, y: number, flip = false, scale = 1, tint?: string): void {
    const key = `${flip}:${tint ?? ''}`;
    let palettes = this.frames.get(frame);
    if (!palettes) { palettes = new WeakMap(); this.frames.set(frame, palettes); }
    let variants = palettes.get(palette);
    if (!variants) { variants = new Map(); palettes.set(palette, variants); }
    let canvas = variants.get(key);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = frame[0]?.length ?? 0; canvas.height = frame.length;
      const source = canvas.getContext('2d')!;
      frame.forEach((row, yy) => [...row].forEach((symbol, xx) => {
        const color = palette[symbol];
        if (!color) return;
        source.fillStyle = tint ?? color;
        source.fillRect(flip ? canvas!.width - xx - 1 : xx, yy, 1, 1);
      }));
      variants.set(key, canvas);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, Math.round(x), Math.round(y), canvas.width * scale, canvas.height * scale);
  }
}

export function animationIndex(timeMs: number, count: number, frameMs: number): number {
  return count > 0 && frameMs > 0 ? Math.floor(Math.max(0, timeMs) / frameMs) % count : 0;
}

/** Bound the native world buffer even for extreme camera values in imported maps. */
export function sceneZoom(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.max(.1, Math.min(8, value)) : 1;
}

/** UI and world consume the same simulation-driven clock. Drawing never advances time. */
export class VisualClock {
  time = 0;
  advance(deltaMs: number): void {
    if (Number.isFinite(deltaMs)) this.time += Math.max(0, Math.min(250, deltaMs));
  }
}
