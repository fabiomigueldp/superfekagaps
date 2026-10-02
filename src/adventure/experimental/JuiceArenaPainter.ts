import type { JuiceMinibossModel } from './JuiceMinibossModel';
import { pixelText } from '../../graphics/BitmapFont';

const C = { ink: '#131724', copper: '#9a6652' };
function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
    c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h);
}
function oval(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
    c.fillStyle = color; c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, Math.PI * 2); c.fill();
}
function pipe(c: CanvasRenderingContext2D, points: number[], size: number, charged: boolean) {
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const [width, color] of [[size + 3, C.ink], [size, C.copper], [size - 3, charged ? '#aa648d' : '#be8b67']] as const) {
        c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(points[0], points[1]);
        for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]); c.stroke();
    }
}
function gauge(c: CanvasRenderingContext2D, x: number, y: number, pressure: number) {
    oval(c, x, y, 6, 6, C.ink); oval(c, x, y, 4.5, 4.5, '#b2ac91');
    c.strokeStyle = '#8c4152'; c.lineWidth = 1;
    const a = -2.5 + pressure * 2.6;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 3.5, y + Math.sin(a) * 3.5); c.stroke();
    rect(c, x, y, 1, 1, C.ink);
}

/** Containment chamber with quiet, dark space behind combat silhouettes. */
export function drawJuiceLabBackground(c: CanvasRenderingContext2D, time: number, boss?: JuiceMinibossModel) {
    const t = time / 1000, hot = !!boss?.enraged && boss.phase !== 'defeated';
    const charging = boss?.phase === 'warning' ? boss.progress : 0;
    const pressure = Math.min(1, (hot ? .78 : .28) + charging * .15 + Math.sin(t * (hot ? 3 : 1)) * .045);
    c.save();
    rect(c, 0, 0, 320, 180, C.ink);
    const wall = c.createLinearGradient(0, 30, 0, 157);
    wall.addColorStop(0, hot ? '#443047' : '#293440'); wall.addColorStop(1, '#181c2a');
    c.fillStyle = wall; c.fillRect(4, 24, 312, 136);
    for (let row = 0; row < 4; row++) for (let x = -24 + (row % 2) * 24; x < 320; x += 48) {
        rect(c, x, 51 + row * 23, 46, 1, '#34404a'); rect(c, x, 51 + row * 23, 1, 22, '#111923');
    }
    for (const x of [7, 93, 221, 306]) {
        rect(c, x - 2, 35, 9, 121, '#141c27'); rect(c, x, 35, 3, 117, '#41454b');
        rect(c, x, 58, 6, 4, '#6c6262'); rect(c, x, 128, 6, 4, '#51474c');
    }
    // Arched rear braces and inset seams describe a chamber behind the machinery.
    c.strokeStyle = '#4e505746'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(99, 125); c.lineTo(99, 57); c.quadraticCurveTo(160, 22, 221, 57); c.lineTo(221, 125); c.stroke();
    rect(c, 0, 34, 320, 6, '#111923'); rect(c, 0, 35, 320, 1, '#677074');
    for (let x = 14; x < 320; x += 23) rect(c, x, 37, 2, 1, '#9b8d79');
    pipe(c, [19, 43, 19, 91, 48, 91, 48, 150], 5, hot);
    pipe(c, [301, 43, 301, 86, 272, 86, 272, 150], 5, hot);
    pipe(c, [104, 46, 104, 67, 126, 67], 5, hot);
    pipe(c, [216, 46, 216, 67, 194, 67], 5, hot);
    for (const x of [19, 48, 272, 301]) for (const y of [94, 118, 143]) {
        rect(c, x - 4, y, 9, 4, '#262633'); rect(c, x - 3, y, 7, 1, '#977565');
    }
    // Curved reactor glass, moving meniscus, steel hoops, rising gas pockets.
    rect(c, 118, 46, 84, 94, '#101723'); rect(c, 123, 50, 74, 85, '#536069');
    rect(c, 128, 54, 64, 76, '#152131'); oval(c, 160, 59, 31, 6, '#354151');
    rect(c, 130, 62, 60, 65, '#29233e');
    const level = 91 - pressure * 14 + Math.sin(t * 1.3) * 1.5;
    const liquid = c.createLinearGradient(0, level, 0, 129);
    liquid.addColorStop(0, hot ? '#8d439d' : '#613f7e'); liquid.addColorStop(1, '#352547');
    c.fillStyle = liquid; c.fillRect(131, level, 58, 128 - level);
    oval(c, 160, level, 29, 3, hot ? '#b36bb3' : '#865a9b');
    c.strokeStyle = hot ? '#c17ecba0' : '#9b7cafa0'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(133, level); c.bezierCurveTo(144, level - 3 + Math.sin(t * 2.2), 168, level + 3, 187, level); c.stroke();
    for (let i = 0; i < 9; i++) {
        const by = 125 - (t * (hot ? 12 : 5) + i * 7) % (124 - level);
        const bx = 137 + i * 6 + Math.sin(t * 1.7 + i * 2) * 1.2;
        oval(c, bx, by, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2.5 : 1.5, hot ? '#bb77bf88' : '#ae80bd55');
    }
    rect(c, 133, 62, 2, 59, '#a8bdc72c'); rect(c, 137, 62, 1, 26, '#dae1ce2c'); rect(c, 181, 61, 3, 63, '#171d3588');
    // Slanted reflections belong to the glass, behind the unoccluded action plane.
    c.fillStyle = '#d6c9e10b'; c.beginPath(); c.moveTo(141, 61); c.lineTo(156, 61); c.lineTo(176, 122); c.lineTo(161, 122); c.fill();
    for (const y of [51, 126]) {
        rect(c, 119, y, 82, 7, '#35414c'); rect(c, 119, y, 82, 1, '#a19a89');
        for (let x = 123; x < 199; x += 12) { rect(c, x, y + 2, 2, 2, '#b4a184'); rect(c, x + 1, y + 3, 2, 2, '#1a2530'); }
    }
    for (const x of [32, 242]) {
        rect(c, x, 58, 45, 51, '#151d2a'); rect(c, x + 2, 60, 41, 46, '#39424b');
        rect(c, x + 5, 64, 35, 22, '#171b2a');
        for (let i = 0; i < 5; i++) rect(c, x + 8 + i * 6, 80 - i * 2, 3, 3 + i * 2, i / 5 < pressure ? '#927494' : '#3e384f');
        rect(c, x + 5, 90, 21, 10, '#232b35');
        for (let i = 0; i < 4; i++) rect(c, x + 7, 92 + i * 2, 17, 1, '#54606a');
        gauge(c, x + 33, 96, pressure);
        for (const bx of [x + 2, x + 41]) rect(c, bx, 62, 1, 1, '#b5a38a');
    }
    pixelText(c, 'CONTENCAO', 160, 42, '#9a9396', 1, 'center');
    for (const x of [85, 233]) {
        rect(c, x - 1, 40, 2, 11, '#111621'); rect(c, x - 7, 51, 14, 4, '#101923');
        rect(c, x - 5, 55, 10, 2, hot ? '#ffb6ad' : '#f2cf8e');
        const glow = c.createLinearGradient(0, 57, 0, 126);
        glow.addColorStop(0, hot ? '#d779672d' : '#f3c37d24'); glow.addColorStop(1, '#dca86b00');
        c.fillStyle = glow; c.beginPath(); c.moveTo(x - 5, 57); c.lineTo(x + 5, 57); c.lineTo(x + 29, 128); c.lineTo(x - 29, 128); c.fill();
        if (time > 0) for (let i = 0; i < 3; i++) {
            const y = 71 + (t * 3 + i * 17) % 43;
            rect(c, x + Math.sin(i * 8 + t * .3) * 7, y, 1, 1, '#e7b89026');
        }
    }
    const shade = c.createLinearGradient(0, 113, 0, 156);
    shade.addColorStop(0, '#11182700'); shade.addColorStop(1, '#111827dd');
    c.fillStyle = shade; c.fillRect(0, 113, 320, 47);
    // A shared lower pressure manifold visibly connects every vent.
    rect(c, 47, 146, 226, 3, '#101522'); rect(c, 48, 146, 224, 1, '#564356');
    rect(c, 0, 153, 320, 6, '#111824'); rect(c, 0, 153, 320, 1, '#5c5965');
    for (const x of boss?.ventCenters ?? [48, 104, 160, 216, 272]) {
        const vent = boss?.geysers.find(g => Math.abs(g.x + g.width / 2 - x) < 1);
        rect(c, x - 2, 147, 4, 4, '#564356');
        rect(c, x - 11, 151, 22, 7, '#151926'); rect(c, x - 9, 151, 18, 1, '#77717a');
        for (let i = -7; i < 9; i += 3) rect(c, x + i, 153, 1, 4, vent?.phase === 'warning' ? '#bd9861' : vent?.phase === 'active' ? '#c76bd5' : hot ? '#78416e' : '#4f455d');
        if (vent) {
            c.globalAlpha = vent.phase === 'warning' ? .06 + vent.progress * .1 : vent.phase === 'active' ? .17 : .08 * (1 - vent.progress);
            oval(c, x, 155, 17, 5, vent.phase === 'warning' ? '#e9bd73' : '#c96eee'); c.globalAlpha = 1;
        }
    }
    c.restore();
}

export function drawJuiceLabFloor(c: CanvasRenderingContext2D, cy: number, boss?: JuiceMinibossModel, cx = 0) {
    const y = 224 - cy;
    rect(c, 0, y, 320, 180 - y, '#1d2330'); rect(c, 0, y, 320, 1, '#c3b59e');
    rect(c, 0, y + 1, 320, 2, '#6e7378'); rect(c, 0, y + 3, 320, 4, '#111923');
    for (let x = 0; x < 320; x += 16) {
        rect(c, x + 2, y + 3, 7, 3, '#ae8a59'); rect(c, x + 2, y + 3, 7, 1, '#d2b276');
        rect(c, x, y + 8, 15, 1, '#4b5360'); rect(c, x + 15, y + 8, 1, 12, '#0e1923'); rect(c, x + 2, y + 10, 1, 1, '#867c76');
    }
    rect(c, 0, y + 18, 320, 2, '#101923');
    if (boss) {
        // Broken wet reflections sit on the apron rather than duplicating sprites.
        c.save();
        const altitude = Math.max(0, boss.arena.floor - boss.y - boss.height);
        c.globalAlpha = Math.max(.025, .14 - altitude / 750);
        const center = boss.x + boss.width / 2 - cx;
        for (let row = 0; row < 4; row++) {
            const width = boss.width * (1 - row * .13);
            rect(c, center - width / 2, y + 2 + row * 3, width, 1, '#c07ce3');
        }
        for (const jet of boss.geysers) if (jet.phase !== 'warning') {
            c.globalAlpha = jet.phase === 'active' ? .23 : .12 * (1 - jet.progress);
            for (let row = 0; row < 4; row++) rect(c, jet.x - cx + row, y + 2 + row * 3, jet.width - row * 2, 1, '#d694ef');
        }
        c.restore();
    }
}

/** The full live jet contains its exact hazard rect; gold warnings cannot hurt. */
export function drawJuiceGeysers(c: CanvasRenderingContext2D, b: JuiceMinibossModel, cx: number, cy: number, reducedMotion = false) {
    c.save();
    const time = reducedMotion ? 0 : b.time;
    for (const g of b.geysers) {
        const x = g.x - cx, floor = b.arena.floor - cy, middle = x + g.width / 2;
        if (g.phase === 'warning') {
            // Show the whole future danger column, including its jump clearance.
            // Gold, broken edges and a translucent interior distinguish this
            // harmless projection from the solid purple jet. Never grow its
            // height with the countdown: the full extent matters from frame one.
            const top = g.y - cy;
            c.fillStyle = '#f3c979'; c.globalAlpha = .12;
            c.fillRect(x, top, g.width, g.height);
            c.globalAlpha = .8;
            rect(c, x, top, g.width, 1, '#f3c979');
            for (let dy = 0; dy < g.height; dy += 8) {
                const dashHeight = Math.min(3, g.height - dy);
                rect(c, x, top + dy, 1, dashHeight, '#f3c979');
                rect(c, x + g.width - 1, top + dy, 1, dashHeight, '#f3c979');
            }
            c.globalAlpha = 1;
            oval(c, middle, floor - 1, g.width / 2 + 4, 3, '#1b142b'); rect(c, x - 3, floor - 2, g.width + 6, 2, '#f3c979');
            rect(c, x - 3, floor - 5, 1, 5, '#fff0c9'); rect(c, x + g.width + 2, floor - 5, 1, 5, '#fff0c9');
            rect(c, middle - 1, floor - 16, 2, 7, '#f3c979'); rect(c, middle - 1, floor - 7, 2, 2, '#f3c979');
            rect(c, x, floor + 4, g.width, 2, '#352f40'); rect(c, x, floor + 4, g.width * g.progress, 2, '#f3c979');
            for (let i = 0; i < 3; i++) oval(c, x + 4 + i * 7, floor - 2 - Math.sin(g.progress * Math.PI * 3 + i) ** 2 * 3, 2, 1, '#b76acc');
            continue;
        }
        const receding = g.phase === 'recede', amount = receding ? 1 - g.progress : 1, top = floor - g.height * amount;
        c.globalAlpha = receding ? amount * .65 : 1;
        // Billowing edges always stay outside the rectangular danger core.
        c.save(); c.beginPath(); c.moveTo(x, top);
        for (let y = top; y < floor; y += 12) {
            const end = Math.min(floor, y + 12), swell = 2 + Math.sin(time * .014 + y) ** 2 * 2;
            c.bezierCurveTo(x - swell, y + (end - y) / 3, x - swell, end - 2, x, end);
        }
        c.lineTo(x + g.width, floor);
        for (let y = floor; y > top; y -= 12) {
            const end = Math.max(top, y - 12), swell = 2 + Math.cos(time * .014 + y) ** 2 * 2;
            c.bezierCurveTo(x + g.width + swell, y - (y - end) / 3, x + g.width + swell, end + 2, x + g.width, end);
        }
        c.closePath(); c.fillStyle = '#4a1d70'; c.strokeStyle = '#241132'; c.lineWidth = 1.5; c.fill(); c.stroke(); c.clip();
        rect(c, x, top, g.width, floor - top, '#a844cc');
        for (let i = 0; i < 3; i++) {
            const streamX = x + 3 + i * 7;
            c.beginPath(); c.moveTo(streamX, floor);
            for (let y = floor; y > top; y -= 8) c.lineTo(streamX + Math.sin(y * .17 + time * .013 + i) * 2, Math.max(top, y - 8));
            c.lineWidth = i === 1 ? 4 : 2; c.strokeStyle = i === 1 ? '#d86fe7' : '#742da9'; c.stroke();
        }
        for (let i = 0; i < 5; i++) {
            const py = floor - ((time * .16 + i * 15) % Math.max(1, floor - top));
            oval(c, x + 4 + (i % 3) * 6, py, 1.5, 4, '#efa6f2');
        }
        c.restore();
        // Foamy, broken crown and airborne droplets replace a rigid flat cap.
        for (let i = 0; i < 6; i++) {
            const bx = x + 1 + i * 4, by = top + Math.sin(time * .02 + i * 1.7) * 2;
            oval(c, bx, by, 3, 3.5, '#ce6bdf'); oval(c, bx - .5, by - 1, 1.8, 1.1, '#f4c3f7');
        }
        if (!reducedMotion && !receding) for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
            const age = (time / 420 + i / 3) % 1;
            const dx = middle + side * (g.width / 2 + age * (7 + i * 2));
            const dy = top - 8 * Math.sin(age * Math.PI) + age * age * 19;
            oval(c, dx, dy, 1.5, 2, '#b865d6'); oval(c, dx, dy - .5, .6, .7, '#f4c3f7');
        }
        oval(c, middle, floor - 1, g.width / 2 + 5, 3, '#9a48bd');
        oval(c, middle - 4, floor - 2, 5, 1, '#d88de9'); c.globalAlpha = 1;
    }
    c.restore();
}
