/** Native pixel construction shared by scenery, parallax layers and map miniatures. */
export type Point = readonly [
    number,
    number
];
export const ink = '#192c44';
export function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
    if (w <= 0 || h <= 0)
        return;
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
export function pixelLine(c: CanvasRenderingContext2D, x: number, y: number, xx: number, yy: number, color: string, size = 1) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(xx - x), Math.abs(yy - y))));
    for (let i = 0; i <= n; i++)
        box(c, x + (xx - x) * i / n, y + (yy - y) * i / n, size, size, color);
}
/** Scan conversion keeps diagonal edges on the same grid as the sprites. */
export function polygon(c: CanvasRenderingContext2D, points: readonly Point[], color: string) {
    const min = Math.floor(Math.min(...points.map(p => p[1]))), max = Math.ceil(Math.max(...points.map(p => p[1])));
    for (let y = min; y < max; y++) {
        const cuts: number[] = [], scan = y + .5;
        for (let i = 0; i < points.length; i++) {
            const a = points[i], b = points[(i + 1) % points.length];
            if ((a[1] <= scan && b[1] > scan) || (b[1] <= scan && a[1] > scan))
                cuts.push(a[0] + (scan - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
        cuts.sort((a, b) => a - b);
        for (let i = 0; i + 1 < cuts.length; i += 2)
            box(c, Math.ceil(cuts[i]), y, Math.ceil(cuts[i + 1]) - Math.ceil(cuts[i]), 1, color);
    }
}
export function oval(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
    for (let j = 0; j < h; j++) {
        const half = Math.sqrt(Math.max(0, 1 - ((j + .5 - h / 2) / (h / 2)) ** 2)) * w / 2;
        box(c, Math.ceil(x + w / 2 - half), y + j, Math.floor(half * 2), 1, color);
    }
}
export function rivet(c: CanvasRenderingContext2D, x: number, y: number) {
    box(c, x, y, 3, 3, '#233d56');
    box(c, x, y, 2, 1, '#b2d0d7');
    box(c, x, y + 1, 1, 1, '#81a7b8');
}
export function drop(c: CanvasRenderingContext2D, x: number, y: number, size = 10, color = '#ae6bde') {
    polygon(c, [[x + size / 2, y], [x + size, y + size], [x + size * .8, y + size * 1.35], [x + size * .25, y + size * 1.35], [x, y + size]], color);
    pixelLine(c, x + size * .32, y + size * .65, x + size * .25, y + size, '#e3b6f2');
}
export function cloud(c: CanvasRenderingContext2D, x: number, y: number, w: number, color = '#ecf5df') {
    oval(c, x + w * .18, y - 6, w * .35, 17, color);
    oval(c, x + w * .42, y - 11, w * .37, 24, color);
    oval(c, x, y, w, 14, color);
    box(c, x + 5, y + 11, w - 10, 2, '#d1e6d8');
}
export function palm(c: CanvasRenderingContext2D, x: number, y: number, h: number, muted = false) {
    const leaf = muted ? '#669d86' : '#3b854f', light = muted ? '#86b79a' : '#84bb53';
    polygon(c, [[x, y], [x + 6, y], [x + 2, y - h], [x - 3, y - h]], muted ? '#769889' : '#806349');
    pixelLine(c, x + 1, y - h + 7, x + 3, y - 2, muted ? '#a2b595' : '#c3965b', 2);
    for (let j = 5; j < h; j += 8)
        pixelLine(c, x, y - j, x + 4, y - j - 2, '#576b4a');
    const top = y - h;
    for (const dir of [-1, 1]) {
        polygon(c, [[x, top + 4], [x + dir * 8, top - 7], [x + dir * 20, top - 8], [x + dir * 29, top + 5], [x + dir * 21, top], [x + dir * 11, top], [x + dir * 3, top + 7]], leaf);
        pixelLine(c, x + dir * 4, top, x + dir * 19, top - 5, light, 2);
        polygon(c, [[x, top + 4], [x + dir * 18, top + 1], [x + dir * 27, top + 12], [x + dir * 25, top + 20], [x + dir * 18, top + 10]], leaf);
    }
    polygon(c, [[x - 3, top + 3], [x - 8, top - 18], [x - 2, top - 22], [x + 4, top - 13], [x + 2, top + 4]], light);
    oval(c, x - 4, top + 5, 6, 6, '#826044');
    oval(c, x + 2, top + 3, 5, 7, '#b58a4d');
}
export function pine(c: CanvasRenderingContext2D, x: number, y: number, h: number, dark = false) {
    box(c, x - 2, y - h * .65, 4, h * .65, '#647068');
    for (let j = 4; j >= 0; j--) {
        const yy = y - h + j * h * .15, half = 6 + j * h * .085;
        polygon(c, [[x, yy - 9], [x - half, yy + h * .24], [x + half, yy + h * .24]], dark ? '#35675f' : '#477e77');
        polygon(c, [[x, yy - 7], [x - half + 2, yy + h * .2], [x - 1, yy + h * .14]], dark ? '#5c9474' : '#73a795');
        box(c, x - half + 3, yy + h * .2, half * .7, 2, dark ? '#94b28a' : '#a8c5b0');
    }
}
export function roof(c: CanvasRenderingContext2D, x: number, y: number, w: number, h = 12) {
    polygon(c, [[x + 7, y], [x + w - 8, y], [x + w, y + h], [x, y + h]], '#663d52');
    polygon(c, [[x + 7, y + 1], [x + w - 8, y + 1], [x + w - 3, y + h - 3], [x + 3, y + h - 3]], '#bb6461');
    for (let i = 9; i < w - 7; i += 8) {
        pixelLine(c, x + i, y + 2, x + i - 3, y + h - 4, '#eea67c', 2);
        pixelLine(c, x + i + 3, y + 3, x + i, y + h - 1, '#894758');
    }
    box(c, x, y + h - 2, w, 3, '#644450');
}
export function flowers(c: CanvasRenderingContext2D, x: number, y: number, w: number, pot = false) {
    if (pot) {
        polygon(c, [[x + 1, y - 7], [x + w - 1, y - 7], [x + w - 4, y], [x + 4, y]], '#b96c58');
        box(c, x, y - 9, w, 3, '#ecb083');
    }
    for (let i = 0; i < w; i += 5) {
        const yy = y - (pot ? 11 : 3) - i % 3;
        oval(c, x + i - 2, yy - 3, 7, 5, '#377554');
        box(c, x + i, yy - 3, 4, 2, '#85b85f');
        if (i % 3 !== 0) {
            box(c, x + i + 1, yy - 5, 3, 3, i % 2 ? '#e87da9' : '#f6dfb7');
            box(c, x + i + 2, yy - 4, 1, 1, '#f8d66c');
        }
    }
}
export function wheel(c: CanvasRenderingContext2D, x: number, y: number, size: number, time = 0) {
    oval(c, x, y, size, size, ink);
    oval(c, x + 2, y + 2, size - 4, size - 4, '#dba94a');
    oval(c, x + 5, y + 5, size - 10, size - 10, '#284b61');
    const center = size / 2;
    for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5 + time / 2600;
        pixelLine(c, x + center, y + center, x + center + Math.cos(a) * (center - 4), y + center + Math.sin(a) * (center - 4), '#efc66b', 2);
    }
    oval(c, x + center - 4, y + center - 4, 8, 8, '#587e94');
    box(c, x + center - 1, y + center - 1, 3, 3, '#d2e3df');
}
export function tank(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time = 0, cold = false) {
    const lip = Math.min(10, w / 6);
    box(c, x + 5, y + lip, w - 10, h - lip, ink);
    oval(c, x + 5, y, w - 10, lip * 3, ink);
    box(c, x + 7, y + lip, w - 14, h - lip - 4, cold ? '#638bab' : '#46677f');
    oval(c, x + 7, y + 2, w - 14, lip * 2, '#90abbc');
    oval(c, x + 11, y + 3, w - 22, lip, '#bbcfd4');
    box(c, x + 12, y + lip * 2, w - 24, h - lip * 2 - 9, '#4d4a75');
    const fluid = y + h * .53 + Math.round(Math.sin(time / 950 + x) * 1);
    box(c, x + 13, fluid, w - 26, y + h - 10 - fluid, '#8954b6');
    box(c, x + 13, fluid + 5, w - 26, 4, '#a76bd0');
    for (let i = 0; i < w - 27; i += 6) {
        box(c, x + 13 + i, fluid + Math.round(Math.sin(time / 330 + i) * 1), Math.min(6, w - 26 - i), 2, '#d8a5eb');
    }
    for (let i = 0; i < 5; i++) {
        const xx = x + 16 + (i * 17) % Math.max(4, w - 34), yy = y + h - 15 - (time / 55 + i * 13) % Math.max(6, h * .36);
        box(c, xx, yy, 2, 2, '#bc8fdb');
        box(c, xx, yy, 1, 1, '#e6bdf4');
    }
    box(c, x + 14, y + lip * 2 + 3, 3, h - lip * 2 - 17, '#a9c1d38c');
    box(c, x + w - 20, y + lip * 2 + 4, 2, h - lip * 2 - 20, '#c5dbe377');
    for (const yy of [y + lip * 2 - 4, y + h - 9]) {
        box(c, x + 2, yy, w - 4, 7, ink);
        box(c, x + 3, yy, w - 6, 2, '#d1e0df');
        box(c, x + 3, yy + 2, w - 6, 3, '#6d97ac');
        for (let i = 9; i < w - 6; i += 16)
            rivet(c, x + i, yy + 2);
    }
    if (w > 35 && h > 45)
        drop(c, x + w / 2 - 5, y + lip * 2 + 8, 9);
    box(c, x + 9, y + h - 2, 7, 4, ink);
    box(c, x + w - 16, y + h - 2, 7, 4, ink);
    if (cold)
        for (let i = 8; i < w - 8; i += 11) {
            box(c, x + i, y + lip * 2 - 4, 7, 2, '#dcf6f0');
            box(c, x + i + 3, y + lip * 2 - 3, 2, 3 + i % 5, '#c0eaf1');
        }
}
export function pipe(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cold = false) {
    const dark = cold ? '#345871' : '#704d4e', mid = cold ? '#689aac' : '#b37b5c', light = cold ? '#b9e5e9' : '#ecb183';
    box(c, x, y + 2, w, 8, ink);
    box(c, x + 1, y + 3, w - 2, 6, dark);
    box(c, x + 2, y + 3, w - 4, 3, mid);
    box(c, x + 2, y + 3, w - 4, 1, light);
    box(c, x + w - 9, y + 4, 9, h, ink);
    box(c, x + w - 8, y + 4, 7, h - 1, mid);
    box(c, x + w - 7, y + 5, 2, h - 3, light);
    box(c, x + w - 3, y + 6, 2, h - 3, dark);
    for (let i = 8; i < w - 8; i += 24) {
        box(c, x + i, y, 5, 12, '#31495e');
        box(c, x + i + 1, y + 1, 2, 10, '#86a7b1');
    }
    for (let j = 18; j < h; j += 23) {
        box(c, x + w - 11, y + j, 13, 5, '#31495e');
        box(c, x + w - 9, y + j + 1, 9, 1, '#acccd1');
    }
}
export function gauge(c: CanvasRenderingContext2D, x: number, y: number, value = .5) {
    oval(c, x, y, 13, 13, ink);
    oval(c, x + 1, y + 1, 11, 11, '#94b2c0');
    oval(c, x + 3, y + 3, 7, 7, '#ede5c9');
    box(c, x + 8, y + 3, 2, 2, '#cf745f');
    const a = -Math.PI + value * Math.PI;
    pixelLine(c, x + 6, y + 7, x + 6 + Math.cos(a) * 4, y + 7 + Math.sin(a) * 4, ink);
    box(c, x + 5, y + 6, 2, 2, '#547890');
}
export function steelBeam(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    box(c, x, y, w, h, ink);
    box(c, x + 1, y + 1, w - 2, h - 2, '#3d667e');
    box(c, x + 1, y + 1, w - 2, 2, '#a0bfca');
    box(c, x + 1, y + h - 3, w - 2, 2, '#274459');
    for (let i = 5; i < w - 3; i += 16)
        rivet(c, x + i, y + Math.max(3, h / 2 - 1));
}
export function crane(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    steelBeam(c, x + 5, y, 12, h);
    steelBeam(c, x, y, w, 10);
    for (let i = 17; i < h - 10; i += 19) {
        pixelLine(c, x + 7, y + i, x + 14, y + i + 15, '#7899a5', 2);
        box(c, x + 7, y + i + 16, 8, 2, '#adc4c9');
    }
    pixelLine(c, x + 17, y + 10, x + w * .44, y + 11, '#638ca2', 3);
    pixelLine(c, x + 17, y + 49, x + w * .44, y + 11, '#638ca2', 3);
    const hx = x + w - 23;
    wheel(c, hx - 2, y + 7, 17);
    pixelLine(c, hx + 6, y + 22, hx + 6, y + h * .52, '#546576');
    box(c, hx, y + h * .52, 14, 13, ink);
    box(c, hx + 2, y + h * .52 + 1, 10, 10, '#e8b34d');
    pixelLine(c, hx + 2, y + h * .52 + 9, hx + 10, y + h * .52 + 1, ink, 2);
    oval(c, hx + 3, y + h * .52 + 13, 9, 12, '#7797a6');
    oval(c, hx + 5, y + h * .52 + 13, 5, 8, '#364e66');
    box(c, hx + 8, y + h * .52 + 12, 5, 5, '#91b4ba');
}
export function container(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant = 0) {
    const colors = [['#427f88', '#75aaa7'], ['#a76257', '#d99472'], ['#b28e42', '#e2b960'], ['#516b99', '#94a2c1']][Math.abs(variant) % 4];
    box(c, x, y, w, h, ink);
    box(c, x + 2, y + 3, w - 4, h - 6, colors[0]);
    for (let i = 8; i < w - 5; i += 8) {
        box(c, x + i, y + 6, 2, h - 12, '#203d514a');
        box(c, x + i + 2, y + 6, 1, h - 12, colors[1]);
    }
    for (const yy of [y, y + h - 5]) {
        box(c, x + 1, yy, w - 2, 5, '#33556b');
        box(c, x + 1, yy, w - 2, 1, yy === y ? '#ece0b5' : '#a5c1c1');
        for (let i = 4; i < w - 4; i += 24)
            rivet(c, x + i, yy + 1);
    }
    for (const xx of [x + 3, x + w - 6]) {
        box(c, xx, y + 7, 2, h - 15, '#dec89f');
        box(c, xx - 1, y + h * .6, 4, 3, ink);
    }
}
export function station(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    box(c, x + 6, y + 13, w - 12, h - 13, '#d5c8a7');
    box(c, x + 8, y + 16, w - 16, h - 17, '#a99e8e');
    for (let i = 17; i < w - 16; i += 27) {
        box(c, x + i, y + 30, 16, Math.min(28, h - 34), '#314f62');
        box(c, x + i + 2, y + 31, 12, 11, '#7eb2bf');
        box(c, x + i + 3, y + 32, 3, 9, '#cae1d3');
        box(c, x + i + 7, y + 31, 2, 13, '#486875');
    }
    for (const xx of [x + 5, x + w - 10]) {
        steelBeam(c, xx, y + 13, 6, h - 13);
    }
    roof(c, x, y, w, 15);
    steelBeam(c, x + 1, y + h - 7, w - 2, 7);
    if (w > 74) {
        wheel(c, x + w - 33, y - 13, 27);
        steelBeam(c, x + w - 46, y + 9, 45, 7);
    }
}
export function freezer(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    box(c, x, y, w, h, '#304d6b');
    box(c, x + 3, y + 4, w - 6, h - 4, '#658fa6');
    for (let i = 7; i < w - 7; i += 32) {
        box(c, x + i, y + 6, 1, h - 9, '#426b85');
        box(c, x + i + 1, y + 6, 1, h - 9, '#81abbb');
        rivet(c, x + i + 5, y + 8);
        rivet(c, x + i + 5, y + h - 9);
        if (h > 94)
            for (let j = 0; j < 4; j++)
                box(c, x + i + 8, y + 27 + j * 4, 16, 2, '#375e7b');
    }
    const size = Math.min(76, w - 16, h - 9), dx = x + (w - size) / 2, dy = y + h - size;
    oval(c, dx, dy, size, size, '#1d354d');
    oval(c, dx + 3, dy + 3, size - 6, size - 6, '#b0d4dd');
    oval(c, dx + 7, dy + 7, size - 14, size - 14, '#3f7097');
    oval(c, dx + 10, dy + 10, size - 20, size - 20, '#527d9f');
    const mx = dx + size / 2, my = dy + size / 2;
    for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3, r = size * .19;
        pixelLine(c, mx, my, mx + Math.cos(a) * r, my + Math.sin(a) * r, '#c6eaf0', 2);
    }
    box(c, dx + size - 12, my - 6, 6, 14, ink);
    box(c, dx + size - 11, my - 4, 3, 8, '#e4c46d');
    for (let i = 6; i < w - 5; i += 11) {
        box(c, x + i, y, 8, 3, '#ddf8f2');
        polygon(c, [[x + i + 2, y + 2], [x + i + 5, y + 2], [x + i + 3, y + 10 + i % 5]], '#bde9ee');
    }
}
export function rockArch(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    // Irregular coastal limestone: no masonry cap or uniform paired pillars.
    const left = Math.round(w * .24), right = Math.round(w * .73);
    polygon(c, [[x, y + h], [x + 8, y + h * .42], [x + left - 5, y + 12], [x + w * .47, y], [x + right + 6, y + 9], [x + w - 4, y + h * .57], [x + w, y + h], [x + right, y + h], [x + right - 4, y + h * .43], [x + w * .54, y + 27], [x + left + 10, y + h * .45], [x + left, y + h]], '#b29372');
    polygon(c, [[x, y + h], [x + 8, y + h * .42], [x + left - 5, y + 12], [x + w * .47, y], [x + right + 6, y + 9], [x + right, y + 19], [x + w * .44, y + 12], [x + left + 3, y + 23], [x + 16, y + h * .55], [x + 12, y + h]], '#d0b083');
    for (let i = 0; i < 7; i++) {
        const yy = y + 25 + i * 11, xx = x + 9 + (i % 2) * 5;
        if (yy < y + h - 4) {
            pixelLine(c, xx, yy, xx + left * .55, yy - 3, '#927d6b');
            pixelLine(c, x + right + 4, yy + 4, x + w - 8, yy + 1, '#8a7769');
        }
    }
    flowers(c, x + left - 5, y + 13, w * .4);
    box(c, x + w * .45, y + 16, 7, 2, '#e8cc98');
}
export function arch(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, coastal = false) {
    const pier = Math.max(7, Math.min(17, w * .14)), radius = w / 2 - pier;
    box(c, x, y + radius, pier, h - radius, coastal ? '#c29d71' : '#c5b296');
    box(c, x + w - pier, y + radius, pier, h - radius, coastal ? '#a28471' : '#b19f93');
    for (let j = 0; j <= radius; j++) {
        const edge = Math.sqrt(Math.max(0, radius * radius - (radius - j) ** 2));
        box(c, x + radius + pier - edge - pier, y + j, pier, 1, coastal ? '#d3b181' : '#e6d5b3');
        box(c, x + radius + pier + edge, y + j, pier, 1, coastal ? '#ac8e75' : '#b6a699');
    }
    if (!coastal) {
        box(c, x - 2, y - 3, w + 4, 5, '#ebd8b0');
        box(c, x, y + 2, w, 2, '#8f8992');
        for (let yy = y + radius + 4; yy < y + h; yy += 15) {
            box(c, x, yy, pier, 1, '#8e8990');
            box(c, x + w - pier, yy, pier, 1, '#8e8990');
        }
    }
    else {
        flowers(c, x - 2, y, w);
    }
}
export function oven(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time = 0) {
    const size = Math.min(w, h * 1.3), xx = x + (w - size) / 2;
    oval(c, xx, y + 8, size, h * 1.3, '#744452');
    oval(c, xx + 2, y + 10, size - 4, h * 1.3 - 4, '#b56e5d');
    box(c, xx + size * .38, y, size * .2, 15, '#985b57');
    box(c, xx + size * .34, y, size * .28, 3, '#dbab85');
    const door = size * .52, dx = xx + (size - door) / 2, dy = y + h * .45;
    oval(c, dx - 3, dy - 3, door + 6, door + 2, '#e4bd8c');
    oval(c, dx, dy, door, door, '#372b3b');
    box(c, dx, dy + door * .5, door, h - (dy - y) - door * .5, '#372b3b');
    for (let i = 3; i < door - 3; i += 7) {
        const f = 6 + Math.round(Math.sin(time / 120 + i) * 3);
        polygon(c, [[dx + i, y + h - 3], [dx + i + 2, y + h - 10 - f], [dx + i + 6, y + h - 4]], '#e6974e');
        box(c, dx + i + 2, y + h - 7, 2, 4, '#f7d480');
    }
    box(c, x, y + h - 2, w, 5, '#d4b79b');
    box(c, x + 2, y + h + 3, w - 4, 5, '#805451');
}
export function villa(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    box(c, x + 5, y + 13, w - 10, h - 13, '#d8c5a9');
    box(c, x + w - 14, y + 14, 8, h - 14, '#b5a399');
    roof(c, x, y, w);
    for (let i = 14; i < w - 16; i += 25) {
        box(c, x + i, y + 25, 10, 18, '#857c77');
        box(c, x + i + 1, y + 26, 8, 15, '#f4d892');
        box(c, x + i + 4, y + 26, 1, 15, '#986e62');
        box(c, x + i + 1, y + 32, 8, 1, '#986e62');
        box(c, x + i - 4, y + 24, 3, 20, '#55866b');
        box(c, x + i + 11, y + 24, 3, 20, '#48765f');
    }
    flowers(c, x + 2, y + h, w - 4);
    flowers(c, x + 9, y + 16, w * .35);
}
