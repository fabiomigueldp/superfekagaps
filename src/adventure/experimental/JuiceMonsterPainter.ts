import type { JuiceMinibossModel } from './JuiceMinibossModel';
import { juicePose } from './JuiceAnimation';

// Hand-painted at the game's logical resolution. The dome, brows and gumline
// share a single liquid material; no detached eyes, horns or humanoid limbs.
const INK = '#200b32';
const PLUM = '#41105f';
const SHADE = '#65118e';
const VIOLET = '#9022be';
const LILAC = '#c449e0';
const GLOSS = '#ef91fa';
const WHITE = '#fff0ff';
const AMBER = '#ffeaa0';
const SIGNAL = '#eeed9a';

function oval(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
    c.fillStyle = color; c.beginPath();
    c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, Math.PI * 2); c.fill();
}
function polygon(c: CanvasRenderingContext2D, points: number[], color: string) {
    c.beginPath(); c.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
    c.closePath(); c.fillStyle = color; c.fill();
}
function dome(c: CanvasRenderingContext2D, lean: number, breathe: number) {
    c.beginPath(); c.moveTo(-22, -1);
    c.bezierCurveTo(-25, -4, -17, -4, -17.5, -12);
    c.bezierCurveTo(-19.5 - breathe * .5, -22, -18 + lean, -34, -10 + lean, -41);
    c.bezierCurveTo(-3 + lean, -47 + breathe, 10 + lean, -46 + breathe, 16 + lean, -37);
    c.bezierCurveTo(21 + lean, -30, 17 + breathe * .7, -20, 19, -12);
    c.bezierCurveTo(19, -6, 26, -4, 23, -1);
    c.bezierCurveTo(18, 2, 13, -1.5, 7, 0);
    c.bezierCurveTo(1, 2.3, -7, -1.5, -12, 0);
    c.bezierCurveTo(-17, 1.9, -21, 1.1, -22, -1); c.closePath();
}
function glob(c: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number, hot = false) {
    c.save(); c.translate(x, y); c.rotate(angle);
    oval(c, -.3, 0, r + .7, r, INK);
    oval(c, 0, -.2, r, r - .6, hot ? '#dd3ac1' : VIOLET);
    oval(c, -.7, -.9, Math.max(1, r * .55), Math.max(.7, r * .3), GLOSS);
    c.fillStyle = WHITE; c.fillRect(-1, -1.8, 1, 1); c.restore();
}

/** Warning geometry is taken directly from the locked combat geometry. */
function anticipation(c: CanvasRenderingContext2D, b: JuiceMinibossModel, cx: number, cy: number) {
    if (b.phase !== 'warning') return;
    const floor = b.arena.floor - cy, center = b.x + b.width / 2 - cx;
    c.save(); c.globalAlpha = .36 + b.progress * .5;
    if (b.attack === 'pounce') {
        const target = b.targetX - cx;
        oval(c, target, floor - 1, b.width * .56, 3, SIGNAL);
        c.strokeStyle = WHITE; c.lineWidth = 1;
        c.beginPath(); c.ellipse(target, floor - 1, b.width * .56 + 5 - b.progress * 4, 5, 0, 0, Math.PI * 2); c.stroke();
        polygon(c, [target - 3, floor - 12, target, floor - 8, target + 3, floor - 12], SIGNAL);
    } else if (b.attack === 'dash') {
        const end = (b.facing < 0 ? b.arena.left : b.arena.right) - cx;
        c.strokeStyle = SIGNAL; c.lineWidth = 1; c.beginPath();
        c.moveTo(center, floor - 2); c.lineTo(end, floor - 2); c.stroke();
        for (let i = 1; i <= 3; i++) {
            const x = center + b.facing * (b.width / 2 + i * 11 + b.progress * 3);
            if (x < b.arena.left - cx || x > b.arena.right - cx) continue;
            polygon(c, [x - b.facing * 3, floor - 8, x + b.facing * 2, floor - 5, x - b.facing * 3, floor - 2], SIGNAL);
        }
    } else {
        const fan = b.fanLaunch;
        c.strokeStyle = SIGNAL; c.lineWidth = 1;
        for (const vector of fan.vectors) {
            c.beginPath();
            c.moveTo(fan.x - cx + vector.vx * 110, fan.y - cy + vector.vy * 110);
            c.lineTo(fan.x - cx + vector.vx * (235 + b.progress * 35), fan.y - cy + vector.vy * (235 + b.progress * 35));
            c.stroke();
        }
    }
    c.restore();
}

function eye(c: CanvasRenderingContext2D, side: number, lean: number, gaze: number, weary: boolean, hot: boolean, blink: number) {
    c.save(); c.translate(lean, (weary ? 1.5 : 0) - 27 * (1 - blink)); c.scale(side, blink);
    // Work in the right eye's coordinates, then mirror its complete socket.
    c.beginPath(); c.moveTo(2, -26); c.lineTo(14.5, -31.5);
    c.bezierCurveTo(16, -25, 12, -21, 7, -23); c.bezierCurveTo(4, -23.2, 2, -24, 2, -26); c.closePath();
    c.fillStyle = INK; c.fill();
    c.beginPath(); c.moveTo(3.7, -26); c.lineTo(13.1, -29.8);
    c.bezierCurveTo(13.5, -25.6, 11, -23, 7.5, -24); c.bezierCurveTo(5, -24, 4, -25, 3.7, -26); c.closePath();
    c.fillStyle = hot ? '#ffcd73' : AMBER; c.fill();
    c.save(); c.clip();
    const iris = 8.5 + gaze * side;
    oval(c, iris, -26.2, 2.7, 3.7, hot ? '#f44380' : '#d433b6');
    oval(c, iris, -26.4, 1.25, 2.7, INK);
    c.fillStyle = WHITE; c.fillRect(iris - 1, -28, 1, 1.3);
    c.restore();
    // Thick overhanging brows occlude the eye; the highlight is a wet ridge.
    c.beginPath(); c.moveTo(1.2, -26.2);
    c.bezierCurveTo(1, -29.3, 6, -31, 10, -34);
    c.bezierCurveTo(13, -36.5, 16.6, -34.3, 16.2, -31.8);
    c.bezierCurveTo(12, -32.4, 8, -27.6, 3.8, -25.6);
    c.bezierCurveTo(2.8, -25.3, 1.6, -25.6, 1.2, -26.2); c.closePath();
    c.fillStyle = SHADE; c.strokeStyle = INK; c.lineWidth = 1.15; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(3, -28.1);
    c.bezierCurveTo(8, -30, 12, -35.4, 15, -33);
    c.strokeStyle = hot ? '#f580da' : LILAC; c.lineWidth = 1.6; c.stroke();
    c.restore();
}

function mouth(c: CanvasRenderingContext2D, lean: number, open: number, time: number, defeated: boolean) {
    c.save(); c.translate(lean, -17); c.scale(1, open);
    // The dark negative space does the work. Every pale 'fang' is purple gum
    // pulled into a hanging droplet, never an isolated white cartoon tooth.
    c.beginPath(); c.moveTo(-13, -3);
    c.bezierCurveTo(-11, -7, -10, -5, -9, -2); c.lineTo(-7, 1);
    c.bezierCurveTo(-6, 2, -7, -4, -4, -4); c.lineTo(-1, -.5);
    c.bezierCurveTo(0, 1, 0, -4, 3, -4); c.lineTo(5, -2);
    c.bezierCurveTo(7, 0, 8, -5, 11, -4); c.lineTo(13, -1);
    c.bezierCurveTo(14, 3, 12, 8, 10, 10); c.lineTo(7, 5);
    c.lineTo(5, 10); c.lineTo(2, 6); c.lineTo(-1, 12);
    c.bezierCurveTo(-3, 14, -4, 8, -5, 8); c.lineTo(-8, 11);
    c.lineTo(-10, 6); c.lineTo(-12, 9); c.bezierCurveTo(-15, 7, -14, 0, -13, -3); c.closePath();
    c.fillStyle = '#170c29'; c.fill();
    c.strokeStyle = PLUM; c.lineWidth = 1.5; c.stroke();
    // A dim reflected pool sits deep in the throat and stays lower contrast.
    c.save(); c.clip(); oval(c, 1, 12, 8, 3.8, '#52155e'); c.restore();
    for (const [x, y, length] of [[-12, -2, 5], [-5, -4, 6], [3, -4, 4], [11, -2, 7]]) {
        const drip = length + Math.sin(time * 3 + x) * .55;
        c.beginPath(); c.moveTo(x - 1.3, y); c.lineTo(x - .6, y + drip);
        c.quadraticCurveTo(x + .5, y + drip + 1, x + .8, y + drip - .5); c.lineTo(x + 1.2, y); c.closePath();
        c.fillStyle = defeated ? SHADE : VIOLET; c.fill();
        c.fillStyle = LILAC; c.fillRect(x - .5, y + 1, .7, Math.max(1, drip - 2));
    }
    c.restore();
}

/** Deterministic animation: model time is the only clock, including micro-motion. */
export function drawJuiceMiniboss(c: CanvasRenderingContext2D, b: JuiceMinibossModel, cx: number, cy: number, reducedMotion = false) {
    // Pause the decorative clock only. Telegraphs and combat pose/position keep
    // following the model so reducing motion never hides an attack's timing.
    const t = reducedMotion ? 0 : b.time / 1000, f = b.facing, floor = b.arena.floor - cy;
    const center = b.x + b.width / 2 - cx, feet = b.y + b.height - cy;
    const warning = b.phase === 'warning', dash = b.phase === 'attack' && b.attack === 'dash';
    const recover = b.phase === 'recover', hurt = b.phase === 'hurt', defeated = b.phase === 'defeated';
    const rage = b.phase === 'enrage', hot = b.enraged && !defeated;
    const impact = Math.exp(-b.phaseTime / 115);
    const pose = juicePose(b, reducedMotion), { sx, sy, lean } = pose;
    c.save(); anticipation(c, b, cx, cy);
    const altitude = Math.max(0, floor - feet), shadow = Math.max(.42, 1 - altitude / 140);
    oval(c, center, floor + 1, b.width * .62 * shadow, 3 * shadow, '#130d2488');
    if (dash && !reducedMotion) {
        for (let i = 4; i >= 1; i--) {
            c.globalAlpha = .22 - i * .035;
            oval(c, center - f * i * 9, feet - 9, b.width * .4 - i, 5, hot ? '#ed52c5' : LILAC);
        }
        c.globalAlpha = 1;
    }
    for (const d of b.drops) {
        const x = d.x + d.width / 2 - cx, y = d.y + d.height / 2 - cy;
        if (!reducedMotion) {
            c.save(); c.translate(x, y); c.rotate(Math.atan2(d.vy, d.vx));
            c.globalAlpha = .28; oval(c, -5.5, 0, 4.5, 1.5, LILAC);
            c.globalAlpha = .15; oval(c, -10, 0, 2, .8, GLOSS); c.restore();
        }
        glob(c, x, y, d.width / 2 - .25, Math.atan2(d.vy, d.vx), hot);
    }
    if (!reducedMotion && rage) {
        const age = b.phaseTime / b.enrageMs;
        if (age < 1) for (let i = 0; i < 8; i++) {
            const direction = i < 4 ? -1 : 1;
            const distance = b.width * .38 + (i % 4) * 3 + age * 18;
            const py = feet - Math.sin(age * Math.PI) * (5 + i % 3 * 5);
            c.globalAlpha = 1 - age; glob(c, center + direction * distance, py, 1.2 + i % 2 * .7, direction * age, hot);
        }
        c.globalAlpha = 1;
    }
    // Normalized 44×46 body anchored to the model's own feet and dimensions.
    c.save(); c.translate(center, feet - .5); c.scale(b.width / 44 * sx, b.height / 46 * sy);
    dome(c, lean, pose.surface);
    c.fillStyle = SHADE; c.strokeStyle = INK; c.lineWidth = 2; c.fill(); c.stroke();
    c.save(); c.clip();
    oval(c, lean - 1, -29, 19, 23, hot ? '#a32aae' : VIOLET);
    oval(c, 16 + lean, -17, 10, 24, PLUM);
    oval(c, -17, -15, 5, 18, SHADE);
    // A thin cool rim and broken surface facets make the mass feel translucent.
    c.beginPath(); c.moveTo(-18, -14); c.bezierCurveTo(-20, -32, -9 + lean, -46, 4 + lean, -44);
    c.strokeStyle = '#dc80f4'; c.lineWidth = .9; c.stroke();
    polygon(c, [lean - 3, -39, lean + 2, -40, lean + 4, -36, lean, -33, lean - 4, -35], '#a72bcb');
    // Large asymmetrical specular patches follow the continuous dome.
    c.beginPath(); c.moveTo(lean - 14, -32);
    c.bezierCurveTo(lean - 11, -39, lean - 5, -44, lean + 3, -43);
    c.bezierCurveTo(lean - 5, -40, lean - 8, -36, lean - 10, -31); c.closePath();
    c.fillStyle = LILAC; c.fill();
    c.beginPath(); c.moveTo(lean + 4, -42);
    c.bezierCurveTo(lean + 10, -43, lean + 15, -39, lean + 16, -34);
    c.bezierCurveTo(lean + 13, -35, lean + 9, -34, lean + 7, -37); c.closePath();
    c.fillStyle = LILAC; c.fill();
    polygon(c, [lean + 7, -41, lean + 11, -40, lean + 13, -37, lean + 9, -37, lean + 7, -38], WHITE);
    polygon(c, [lean - 13, -35, lean - 11, -38, lean - 9, -39, lean - 10, -36, lean - 12, -34], GLOSS);
    // Wet outer cheek: a hanging strand flows into the puddle without an arm.
    c.beginPath(); c.moveTo(-16.2, -25); c.bezierCurveTo(-18, -20, -15, -14, -17, -10);
    c.bezierCurveTo(-19, -7, -18, -5, -21, -3); c.lineTo(-17, -4);
    c.bezierCurveTo(-14, -9, -15, -17, -14, -23); c.closePath(); c.fillStyle = LILAC; c.fill();
    c.beginPath(); c.moveTo(16, -20); c.bezierCurveTo(14, -14, 18, -11, 16, -6);
    c.strokeStyle = VIOLET; c.lineWidth = 2.5; c.stroke();
    // A few drifting gas inclusions keep the skin moving without visual noise.
    for (let i = 0; i < 4; i++) {
        const bx = [-12, 14, -7, 4][i] + Math.sin(t * 1.9 + i) * .5;
        const by = -5 - (t * 2.2 + i * 9) % 34;
        oval(c, bx, by, 1 + i % 2 * .35, 1.5, i % 2 ? '#b738c8' : '#75209b');
    }
    if (hot) {
        c.globalAlpha = .38 + Math.sin(t * 7) * .1;
        c.strokeStyle = '#fb76b5'; c.lineWidth = .8;
        for (const side of [-1, 1]) {
            c.beginPath(); c.moveTo(side * 3 + lean, -40); c.lineTo(side * 6 + lean, -37);
            c.lineTo(side * 4 + lean, -33); c.lineTo(side * 9 + lean, -30); c.stroke();
            c.beginPath(); c.moveTo(side * 15, -21); c.lineTo(side * 12, -17); c.lineTo(side * 15, -12); c.stroke();
        }
        c.globalAlpha = 1;
    }
    c.restore();
    // The maw is drawn before the brows so the whole face hangs from the dome.
    mouth(c, lean * .8, pose.mouth, t, defeated);
    const blink = !warning && !hot && !recover && !hurt && !defeated && t % 4.6 > 4.47 ? .45 : pose.eyelid;
    eye(c, -1, lean, f * .85, recover || hurt, hot, blink);
    eye(c, 1, lean, f * .85, recover || hurt, hot, blink);
    // Heavy front lobes are part of the puddled skirt, well below the face.
    c.beginPath(); c.moveTo(-20, -2); c.bezierCurveTo(-15, -5, -12, -4, -9, -2);
    c.strokeStyle = LILAC; c.lineWidth = 1.5; c.stroke();
    c.beginPath(); c.moveTo(7, -.5); c.bezierCurveTo(12, -4, 15, -2, 20, -1.8);
    c.strokeStyle = VIOLET; c.lineWidth = 1.5; c.stroke();
    oval(c, -2.5, -3.4, 2.3, 1.1, LILAC);
    c.fillStyle = GLOSS; c.fillRect(-3.7, -4.2, 1.1, .8);
    if (hurt) {
        c.globalAlpha = .48 * impact; dome(c, lean, pose.surface); c.fillStyle = WHITE; c.fill(); c.globalAlpha = 1;
    }
    c.restore();
    if (b.vulnerable) {
        const surface = feet - b.height * sy;
        const hover = Math.sin(t * 8) * 1.2;
        // A little crown points into the real stomp surface, never the mouth.
        polygon(c, [center - 7, surface - 9 + hover, center - 5, surface - 5 + hover,
            center, surface - 7 + hover, center + 5, surface - 5 + hover, center + 7, surface - 9 + hover,
            center + 5, surface - 2 + hover, center - 5, surface - 2 + hover], INK);
        polygon(c, [center - 5, surface - 8 + hover, center - 4, surface - 4 + hover,
            center, surface - 6 + hover, center + 4, surface - 4 + hover, center + 5, surface - 8 + hover,
            center + 4, surface - 3 + hover, center - 4, surface - 3 + hover], SIGNAL);
        for (const side of [-1, 1]) {
            c.fillStyle = SIGNAL; c.fillRect(center + side * 11, surface - 5 + hover, 2, 1);
        }
    }
    c.restore();
}
