import { JuiceMinibossModel } from './JuiceMinibossModel';

// Small, high-contrast forms derived from the imagegen concept. The painted
// silhouette is deliberately distinct from the existing campaign boss sprites.
const P = {
    edge: '#28103d', deep: '#491363', dark: '#691986', body: '#a32fc8',
    light: '#e766ef', shine: '#fff1ff', lime: '#dded67', pulp: '#b5ce39',
    rind: '#698329', eye: '#fff2b2', amber: '#eea843',
};
function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
    c.fillStyle = color; c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, Math.PI * 2); c.fill();
}
function path(c: CanvasRenderingContext2D, points: number[], color: string | CanvasGradient) {
    c.fillStyle = color; c.beginPath(); c.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
    c.closePath(); c.fill();
}
function citrus(c: CanvasRenderingContext2D, x: number, y: number, r: number, angle = 0) {
    c.save(); c.translate(x, y); c.rotate(angle);
    ellipse(c, 0, 0, r + 1, r + 1, P.edge);
    ellipse(c, 0, 0, r, r, P.rind);
    ellipse(c, 0, -.5, r - 1, r - 1, P.lime);
    ellipse(c, 0, -.5, r - 2, r - 2, P.pulp);
    c.strokeStyle = '#f9ffc3'; c.lineWidth = .7;
    for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        c.beginPath(); c.moveTo(0, -.5); c.lineTo(Math.cos(a) * (r - 1.5), Math.sin(a) * (r - 1.5) - .5); c.stroke();
    }
    ellipse(c, -.4, -.6, 1, 1, '#f9ffc3'); c.restore();
}
function tendril(c: CanvasRenderingContext2D, x: number, y: number, ex: number, ey: number, bend: number, width: number) {
    c.lineCap = 'round';
    for (const [color, w] of [[P.edge, width + 3], [P.dark, width], [P.light, 1]] as const) {
        c.strokeStyle = color; c.lineWidth = w; c.beginPath();
        c.moveTo(x, y); c.quadraticCurveTo((x + ex) / 2 + bend, Math.min(y, ey) - 9, ex, ey); c.stroke();
    }
}
function droplet(c: CanvasRenderingContext2D, x: number, y: number, radius: number, angle = 0) {
    c.save(); c.translate(x, y); c.rotate(angle);
    ellipse(c, 0, 0, radius + .8, radius, P.edge);
    ellipse(c, 0, -.4, radius, radius - .7, P.body);
    ellipse(c, -radius * .2, -radius * .4, radius * .5, .8, P.shine); c.restore();
}

/** Shared-clock anticipation and animation; decorative splashes never collide. */
export function drawJuiceMiniboss(c: CanvasRenderingContext2D, b: JuiceMinibossModel, cx: number, cy: number) {
    const x = b.x - cx, y = b.y - cy, f = b.facing, t = b.time / 1000;
    const warning = b.phase === 'warning', dash = b.phase === 'attack' && b.attack === 'dash';
    const recover = b.phase === 'recover' || b.phase === 'defeated';
    const floor = b.arena.floor - cy, center = x + 15;
    c.save();
    if (warning) {
        c.globalAlpha = .3 + b.progress * .4;
        if (b.attack === 'pounce') {
            ellipse(c, b.targetX - cx, floor - 1, 22, 4, P.lime);
            c.strokeStyle = P.eye; c.lineWidth = 1;
            c.beginPath(); c.ellipse(b.targetX - cx, floor - 1, 26 - b.progress * 4, 6, 0, 0, Math.PI * 2); c.stroke();
            c.fillStyle = P.edge; c.fillRect(b.targetX - cx - 1, floor - 8, 2, 7);
        } else if (b.attack === 'dash') {
            const end = f < 0 ? b.arena.left - cx : b.arena.right - cx;
            c.strokeStyle = P.lime; c.lineWidth = 1; c.beginPath();
            c.moveTo(center, floor - 3); c.lineTo(end, floor - 3); c.stroke();
            for (let i = 1; i <= 3; i++) {
                const ax = center + f * (20 + i * 13 + b.progress * 4);
                path(c, [ax - f * 3, floor - 7, ax + f * 2, floor - 4, ax - f * 3, floor - 1], P.lime);
            }
        } else {
            c.strokeStyle = P.lime; c.lineWidth = 1;
            const fan = b.fanLaunch;
            // Five short rays share the exact locked launch vectors, including
            // upward bias. A new player position cannot rotate them mid-warning.
            for (const vector of fan.vectors) {
                c.beginPath();
                c.moveTo(fan.x - cx + vector.vx * 110, fan.y - cy + vector.vy * 110);
                c.lineTo(fan.x - cx + vector.vx * (230 + b.progress * 45),
                    fan.y - cy + vector.vy * (230 + b.progress * 45));
                c.stroke();
            }
        }
        c.globalAlpha = 1;
    }
    const shadowScale = Math.max(.4, 1 - (floor - y - 30) / 150);
    ellipse(c, center, floor + 1, 20 * shadowScale, 3 * shadowScale, '#170f2d88');
    // Broad directional trails and small liquid satellites keep fast actions legible.
    if (dash) for (let i = 5; i >= 1; i--) {
        c.globalAlpha = .36 - i * .045;
        ellipse(c, center - f * i * 10, y + 21 + i % 2, 14 - i, 7 - i * .6, P.light);
    }
    c.globalAlpha = 1;
    for (const d of b.drops) {
        const dx = d.x - cx + 4, dy = d.y - cy + 4;
        c.globalAlpha = .45; ellipse(c, dx - d.vx * 38, dy - d.vy * 38, 6, 2, P.light); c.globalAlpha = 1;
        droplet(c, dx, dy, 4, Math.atan2(d.vy, d.vx));
        ellipse(c, dx, dy, 1.4, 1.4, P.lime);
    }
    if (b.phase === 'recover' && b.phaseTime < 300 || b.phase === 'hurt' || b.phase === 'defeated') {
        const age = b.phaseTime / (b.phase === 'defeated' ? 800 : 350);
        if (age < 1) for (let i = 0; i < 8; i++) {
            const direction = i < 4 ? -1 : 1, distance = 8 + (i % 4) * 4 + age * 20;
            const py = floor - Math.sin(age * Math.PI) * (6 + i % 3 * 5);
            c.globalAlpha = 1 - age; droplet(c, center + direction * distance, py, 2 + i % 2, age * direction);
        }
        c.globalAlpha = 1;
    }
    const pulse = warning ? Math.sin(b.progress * Math.PI * 8) * b.progress : Math.sin(t * 5) * .35;
    const squash = recover ? .72 : warning && b.attack === 'pounce' ? 1 - b.progress * .3 : dash ? .72 : 1;
    const stretch = dash ? 1.38 : recover ? 1.17 : warning && b.attack === 'fan' ? 1 + b.progress * .13 : 1;
    // Anchor the core at the feet; the crown stays attached during squash/recovery.
    c.save(); c.translate(center, y + 30); c.scale(stretch, squash);
    const lean = dash ? f * 4 : warning ? -f * b.progress * 2 : Math.sin(t * 3) * .5;
    const armLift = warning ? b.progress * 7 : b.phase === 'attack' && b.attack === 'fan' ? 7 : Math.sin(t * 6) * 1.8;
    tendril(c, -8, -12, -20 - pulse, -10 - armLift, -4, 5);
    tendril(c, 8, -12, 20 + pulse, -10 - armLift, 4, 5);
    for (const side of [-1, 1]) {
        ellipse(c, side * 19, -8 - armLift, 6, 6, P.edge);
        ellipse(c, side * 19, -9 - armLift, 5, 5, P.body);
        citrus(c, side * 19, -11 - armLift, 3.6, t * .6 * side);
        ellipse(c, side * 10, -2, 9, 3, P.edge);
        ellipse(c, side * 10, -3, 7, 2, P.dark);
        ellipse(c, side * 12, -4, 4, .8, P.light);
    }
    // Flowing crest, citrus pressure cap, sharp brow and glossy juice core.
    tendril(c, -f * 6, -21, -f * (13 + pulse), -36 + Math.sin(t * 4) * 2, -f * 7, 3);
    ellipse(c, lean, -16, 15, 14, P.edge);
    ellipse(c, lean, -17, 13.5, 12.5, P.dark);
    ellipse(c, lean - 1, -19, 11.7, 10, P.body);
    ellipse(c, lean - 6, -23, 4, 3, P.light);
    ellipse(c, lean - 7, -24, 2, 1, P.shine);
    c.save(); c.translate(lean, -28); c.rotate(-f * .18 + pulse * .04);
    ellipse(c, 0, 0, 10, 3, P.edge);
    citrus(c, 0, -1, 7, .3);
    path(c, [-3, -4, -3, -10, 3, -11, 4, -4], P.edge);
    path(c, [-2, -5, -2, -9, 2, -10, 3, -5], P.pulp);
    c.fillStyle = P.lime; c.fillRect(-1, -9, 2, 4);
    path(c, [-2, -9, -7, -14, -9, -13, -7, -9], P.rind); c.restore();
    for (const side of [-1, 1]) {
        const ex = lean + side * 6;
        ellipse(c, ex, -15, 5.5, recover ? 3.4 : 5, P.edge);
        ellipse(c, ex, -15, 4.5, recover ? 2.4 : 4, P.eye);
        ellipse(c, ex + f * 1.2, -14, 1.7, recover ? 1.6 : 2.6, P.edge);
        ellipse(c, ex + f * 1.2 - .5, -15, .65, .8, P.shine);
        path(c, [ex - 6, -21 - side, ex + 6, -18 + side, ex + 6, -21, ex - 6, -23], P.dark);
    }
    path(c, [lean - 4, -7, lean + 4, -8, lean + 2, -5, lean - 2, -5], P.edge);
    c.fillStyle = P.eye; c.fillRect(lean + f, -7, 2, 1);
    if (b.phase === 'hurt') {
        c.globalAlpha = .3 * Math.max(0, 1 - b.phaseTime / 350); ellipse(c, lean, -17, 15, 14, P.shine); c.globalAlpha = 1;
    }
    c.restore();
    if (b.vulnerable) {
        const crownY = y + 30 - 35 * squash;
        c.strokeStyle = P.lime; c.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const a = -Math.PI / 2 + (i - 1) * .8;
            const r = 8 + Math.sin(t * 10) * 1.5;
            c.beginPath(); c.moveTo(center + Math.cos(a) * r, crownY + Math.sin(a) * r);
            c.lineTo(center + Math.cos(a) * (r + 3), crownY + Math.sin(a) * (r + 3)); c.stroke();
        }
    }
    c.restore();
}

/** A contained juice factory, with a quiet middle plane behind the combat. */
export function drawJuiceLabBackground(c: CanvasRenderingContext2D, time: number) {
    c.fillStyle = '#211a31'; c.fillRect(0, 0, 320, 180);
    const glow = c.createLinearGradient(0, 25, 0, 155);
    glow.addColorStop(0, '#714337'); glow.addColorStop(.6, '#3a2b39'); glow.addColorStop(1, '#271d35');
    c.fillStyle = glow; c.fillRect(5, 24, 310, 139);
    for (let x = 18; x < 320; x += 39) {
        c.fillStyle = '#3a2934'; c.fillRect(x, 30, 4, 120);
        for (let y = 54; y < 142; y += 24) { c.fillStyle = '#4b353c'; c.fillRect(x + 4, y, 34, 1); }
    }
    // Glass reservoirs are set away from Feka's starting silhouette and HUD.
    for (const [x, w, top] of [[10, 41, 69], [130, 64, 56], [265, 44, 67]]) {
        c.fillStyle = '#171a2b'; c.fillRect(x - 3, top - 5, w + 6, 84);
        c.fillStyle = '#5c5264'; c.fillRect(x, top, w, 77);
        c.fillStyle = '#2f283e'; c.fillRect(x + 3, top + 4, w - 6, 67);
        c.fillStyle = '#482453'; c.fillRect(x + 5, top + 26, w - 10, 44);
        c.fillStyle = '#773478'; c.fillRect(x + 5, top + 26, w - 10, 2);
        c.fillStyle = '#95819466'; c.fillRect(x + 6, top + 7, 3, 58);
        for (let i = 0; i < 4; i++) {
            const by = top + 65 - (time * .011 + i * 14) % 36;
            ellipse(c, x + 12 + i * (w - 24) / 3, by, 1.5, 2, '#a7669b88');
        }
        for (const ty of [top - 2, top + 72]) {
            c.fillStyle = '#776478'; c.fillRect(x - 3, ty, w + 6, 4);
            c.fillStyle = '#b19884'; for (let bx = x; bx < x + w; bx += 10) c.fillRect(bx, ty + 1, 2, 1);
        }
        c.fillStyle = '#4d414f'; c.fillRect(x + w / 2 - 3, 24, 6, top - 29);
        c.fillStyle = '#89705e'; c.fillRect(x + w / 2 - 2, 24, 1, top - 29);
    }
    for (const x of [79, 232]) {
        c.fillStyle = '#262031'; c.fillRect(x, 23, 2, 40);
        path(c, [x - 8, 67, x - 5, 60, x + 7, 60, x + 10, 67], '#292438');
        c.fillStyle = '#f7cd72'; c.fillRect(x - 6, 67, 14, 2);
        const light = c.createLinearGradient(0, 69, 0, 120);
        light.addColorStop(0, '#ffd47820'); light.addColorStop(1, '#ffd47800');
        path(c, [x - 6, 69, x + 8, 69, x + 23, 120, x - 21, 120], light);
    }
    c.fillStyle = '#191727'; c.fillRect(0, 146, 320, 12);
    c.fillStyle = '#51435c'; c.fillRect(0, 151, 320, 2);
}

export function drawJuiceLabFloor(c: CanvasRenderingContext2D, cy: number) {
    const y = 224 - cy;
    c.fillStyle = '#201c30'; c.fillRect(0, y, 320, 180 - y);
    c.fillStyle = '#b0a5a8'; c.fillRect(0, y, 320, 2);
    c.fillStyle = '#4d455b'; c.fillRect(0, y + 2, 320, 6);
    for (let x = 0; x < 320; x += 16) {
        c.fillStyle = '#1e1b2a'; c.fillRect(x, y + 3, 7, 4);
        c.fillStyle = '#b9a46b'; c.fillRect(x + 8, y + 3, 6, 4);
        c.fillStyle = '#635569'; c.fillRect(x, y + 11, 1, 10);
        c.fillStyle = '#8c7b8f'; c.fillRect(x + 3, y + 11, 2, 1);
    }
}
