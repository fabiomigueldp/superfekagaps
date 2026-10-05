import { ART } from './palette';
import { drawPlayerProtection } from './playerProtectionArt';

/** Reveal-only decoration. All timing and control ownership stay with the player. */
export function drawRespawnArrival(c: CanvasRenderingContext2D, x: number, y: number, progress: number, reducedMotion = false): void {
  if (reducedMotion) {
    // Stationary brackets identify the arriving body without a pulse, orbit or sprite flash.
    drawPlayerProtection(c, x, y);
    return;
  }
  c.save();
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
  c.restore();
}
