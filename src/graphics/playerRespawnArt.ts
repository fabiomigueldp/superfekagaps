import { ART } from './palette';

/** Reveal-only decoration. All timing and control ownership stay with the player. */
export function drawRespawnArrival(c: CanvasRenderingContext2D, x: number, y: number, progress: number, reducedMotion = false): void {
  c.save();
  if (reducedMotion) {
    // Stationary brackets identify the arriving body without a pulse, orbit or sprite flash.
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
  } else {
    const t = Math.max(0, Math.min(1, progress));
    const radius = Math.round(4 + 20 * t);
    c.globalAlpha *= Math.sin(Math.PI * t);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const px = Math.round(x + Math.cos(angle) * radius), py = Math.round(y + Math.sin(angle) * radius);
      c.fillStyle = i % 2 ? ART.goldLight : ART.paper;
      c.fillRect(px, py, i % 2 ? 2 : 3, 2);
    }
    c.fillStyle = ART.tealLight;
    c.fillRect(x - radius - 2, y, 3, 1); c.fillRect(x + radius, y, 3, 1);
    c.fillRect(x, y - radius - 2, 1, 3); c.fillRect(x, y + radius, 1, 3);
  }
  c.restore();
}
