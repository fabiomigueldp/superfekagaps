import { ART } from './palette';

/** Stationary protection marks: leave the whole player and its equipment readable. */
export function drawPlayerProtection(c: CanvasRenderingContext2D, x: number, y: number): void {
  c.save();
  for (const side of [-1, 1]) {
    const edge = Math.round(x) + side * 11, top = Math.round(y) - 5;
    const start = side < 0 ? edge : edge - 2;
    c.fillStyle = ART.ink;
    c.fillRect(edge - 1, top - 1, 3, 12);
    c.fillRect(start - 1, top - 1, 5, 3);
    c.fillRect(start - 1, top + 8, 5, 3);
    c.fillStyle = ART.tealLight;
    c.fillRect(edge, top, 1, 10);
    c.fillRect(start, top, 3, 1);
    c.fillRect(start, top + 9, 3, 1);
  }
  c.restore();
}
