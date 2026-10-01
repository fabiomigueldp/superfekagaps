import type { Barrel } from './WorldPhysics';
import { box as r } from './WorldPainting';

/** Short, cosmetic liquid wake and a contact-anchored landing. Neither is a hitbox. */
export function drawCannonBarrelEffects(c: CanvasRenderingContext2D, p: Barrel, cx: number, cy: number, time: number) {
    // Enemy/boss barrels keep their own established presentation.
    if (p.launchedAt === undefined) return;
    const age = time - p.launchedAt;
    if (age >= 0 && age < 240) {
        const t = age / 240, dir = Math.sign(p.vx) || -1;
        for (let i = 0; i < 3; i++) {
            const spread = (i + 1) * (3 + t * 4);
            const x = p.x + p.width / 2 - dir * (p.width / 2 + spread) - cx;
            const y = p.y + 6 + i * 2 + t * t * 6 - cy;
            r(c, x, y, i === 0 && t < .5 ? 2 : 1, 1, i === 1 ? '#dca8ed' : '#a365c0');
        }
    }
    const elapsed = p.landedAt === undefined ? Infinity : time - p.landedAt;
    if (p.landingPoint && elapsed >= 0 && elapsed < 260) {
        const t = elapsed / 260, x = p.landingPoint.x - cx, y = p.landingPoint.y - cy;
        // Heavy keg contact sends dust sideways. A little seal seep stays purple in the cold.
        for (const dir of [-1, 1]) {
            if (t < .75) r(c, x + dir * (6 + t * 13), y - 1, t < .4 ? 3 : 2, 1, '#c1c4b4');
            if (t < .6) r(c, x + dir * (4 + t * 9), y - 2 - Math.sin(t * Math.PI) * 3, 1, 1, '#dce0c5');
            if (p.pressurized) r(c, x + dir * (4 + t * 11), y - 2 - t * 10 + t * t * 12, 1, t < .65 ? 2 : 1, '#b77bd5');
        }
    }
}
