import type { SkeletonBullModel } from './SkeletonBullModel';

/** Hoof contacts remain at their world positions while the bull moves on.
 * The fixed simulation clock freezes them on pause and bounds every plume. */
export function drawBullFootfalls(c: CanvasRenderingContext2D, b: SkeletonBullModel, reducedMotion: boolean) {
    if (reducedMotion) return;
    const r = (color: string, x: number, y: number, w: number, h: number) => {
        c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h);
    };
    for (const contact of b.footfalls) {
        const age = b.tick - contact.born, drift = Math.floor(age / 3);
        const direction = contact.skid ? contact.facing : -contact.facing;
        const x = contact.x + direction * drift;
        if (age < 10) r('#986749', contact.x - 3, contact.y - 1, contact.skid ? 9 : 5, 1);
        const lift = age < 8 ? Math.floor(age / 3) : Math.floor((15 - age) / 3);
        r(age < 8 ? '#d6a977' : '#c79a6c', x - 2, contact.y - 3 - lift, age < 8 ? 3 : 2, 1);
        r('#bd8966', x + direction * (3 + drift), contact.y - 2 - lift, 2, 1);
    }
}
