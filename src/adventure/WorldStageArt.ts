import type { BossEncounter } from './BossEncounter';
import type { Island } from './types';
import { pixelText } from '../graphics/BitmapFont';
import { box as r, pixelLine as line, polygon, oval, palm, pine, tank, pipe, gauge, crane, container, station, freezer, arch, oven, villa, steelBeam, wheel, flowers, roof } from './WorldPainting';
export function drawArena(c: CanvasRenderingContext2D, b: BossEncounter, cx: number, cy: number, time: number) {
    c.save();
    c.translate(-Math.round(cx), -Math.round(cy));
    if (b.id === 'J1') {
        palm(c, 28, 224, 77);
        palm(c, 312, 224, 99);
        for (const x of [13, 297]) {
            r(c, x, 146, 7, 78, '#574b48');
            r(c, x + 1, 147, 3, 77, '#bd9869');
            r(c, x - 3, 145, 13, 5, '#dcc189');
        }
        for (let x = 18; x < 304; x += 2) {
            const yy = 155 + Math.sin((x - 18) / 286 * Math.PI) * 24;
            r(c, x, yy, 2, 2, '#755e51');
            r(c, x, yy, 2, 1, '#e1c99b');
            if (x % 12 === 6)
                line(c, x, yy + 2, x, 222, '#a18c69');
        }
        flowers(c, 7, 224, 31);
        flowers(c, 284, 224, 32);
    }
    else if (b.id === 'J2') {
        villa(c, 25, 106, 156, 116);
        arch(c, 182, 111, 80, 112);
        roof(c, 178, 99, 91, 13);
        pine(c, 298, 224, 98, true);
        r(c, 57, 158, 47, 18, '#8a6762');
        r(c, 59, 160, 43, 14, '#c39479');
        pixelText(c, 'Y + J', 80, 164, '#ffecbd', 1, 'center');
        oven(c, 110, 166, 58, 53, time);
        flowers(c, 10, 224, 43, true);
        flowers(c, 276, 224, 34, true);
        r(c, 272, 194, 7, 30, '#b5a390');
        r(c, 301, 194, 7, 30, '#a89b91');
    }
    else if (b.character === 'biel') {
        crane(c, 5, 91, 307, 133);
        steelBeam(c, 303, 91, 9, 133);
        if (b.id === 'B1') {
            container(c, 16, 166, 53, 58, 1);
            container(c, 146, 185, 45, 39, 0);
        }
        else {
            station(c, 10, 142, 56, 82);
            pine(c, 168, 224, 62, true);
            line(c, 17, 106, 306, 106, '#afb8b0');
        }
        // Remote operator's stand, visibly separate from the traversable lift route.
        r(c, 213, 171, 4, 53, '#40627a');
        r(c, 239, 171, 4, 53, '#40627a');
        line(c, 214, 178, 240, 214, '#9bb0b1', 2);
        line(c, 240, 178, 214, 214, '#9bb0b1', 2);
        steelBeam(c, 204, 171, 42, 5);
        r(c, 232, 163, 16, 8, '#35516a');
        r(c, 234, 164, 4, 2, '#d6bf73');
        r(c, 242, 164, 3, 2, '#a9cd81');
        r(c, 109, 118, 108, 13, '#2d485e');
        pixelText(c, b.id === 'B2' ? 'ESTAÇÃO DO BIEL' : 'PORTO DO BIELZÃO', 163, 122, '#f4d18c', 1, 'center');
    }
    else {
        const cold = b.id === 'C2';
        for (const x of [11, 65, 119, 173])
            tank(c, x, 127, 48, 96, time, cold);
        pipe(c, 8, 105, 240, 106, cold);
        gauge(c, 113, 108, .4 + Math.sin(time / 1800) * .2);
        if (cold) {
            freezer(c, 248, 100, 66, 124);
            r(c, 136, 173, 13, 3, '#dffbf3');
            r(c, 292, 173, 13, 3, '#dffbf3');
        }
        else {
            r(c, 256, 125, 54, 72, '#304f67');
            r(c, 259, 127, 48, 64, '#607986');
            for (let yy = 148; yy < 188; yy += 6)
                r(c, 278, yy, 23, 2, '#38566b');
            gauge(c, 260, 174, b.phase === 'open' ? .1 : .8);
        }
        r(c, 57, 123, 164, 14, '#283f58');
        r(c, 58, 123, 162, 1, '#c2c9b8');
        pixelText(c, cold ? 'RESERVA ESPECIAL' : 'FÁBRICA DE SUCO', 139, 127, '#f4dfac', 1, 'center');
        // Return drive at ground height. Its amber cover matches the incoming barrel path.
        if (!cold) {
            wheel(c, 239, 204, 19, b.phase === 'open' ? 0 : time);
            r(c, 258, 208, 4, 16, '#647f92');
        }
        steelBeam(c, 256, 201, 57, 5);
        r(c, 302, 206, 4, 18, '#506f84');
    }
    c.restore();
}
export function drawIsland(c: CanvasRenderingContext2D, w: Island, selected: boolean, time: number) {
    const [x, y] = w.map;
    oval(c, x - 25, y + 1, 50, 17, '#528b9c');
    oval(c, x - 22, y - 2, 44, 20, '#36536f');
    oval(c, x - 22, y - 5, 44, 22, '#9e8774');
    oval(c, x - 21, y - 9, 42, 22, '#dcc493');
    oval(c, x - 19, y - 9, 39, 18, w.id === 5 ? '#c7e8e5' : w.id === 3 ? '#879792' : '#83af72');
    polygon(c, [[x - 17, y + 6], [x - 13, y + 10], [x - 15, y + 14], [x - 20, y + 10]], '#b59b7e');
    r(c, x + 11, y + 9, 3, 5, '#806f6a');
    r(c, x - 23, y + 16, 15, 1, '#83bec0');
    r(c, x + 7, y + 18, 17, 1, '#6aabb8');
    if (w.id === 1) {
        r(c, x + 6, y - 23, 7, 25, '#e9d8b0');
        r(c, x + 6, y - 15, 7, 5, '#c57b6a');
        r(c, x + 4, y - 25, 11, 3, '#4b657d');
        roof(c, x + 3, y - 30, 13, 6);
        palm(c, x - 10, y + 1, 18);
    }
    else if (w.id === 2) {
        container(c, x - 18, y - 4, 19, 11, 1);
        container(c, x + 1, y - 3, 18, 10, 0);
        steelBeam(c, x - 15, y - 28, 5, 31);
        steelBeam(c, x - 17, y - 30, 36, 5);
        line(c, x - 10, y - 11, x + 3, y - 25, '#b5c7bc', 2);
        wheel(c, x + 8, y - 25, 10);
        line(c, x + 13, y - 15, x + 13, y - 5, '#d8cca5');
        r(c, x + 9, y - 6, 9, 8, '#d6ab53');
        line(c, x + 9, y - 2, x + 14, y - 6, '#334e62', 2);
    }
    else if (w.id === 3) {
        tank(c, x - 17, y - 24, 27, 32, 0);
        pipe(c, x + 7, y - 29, 12, 31);
        r(c, x + 7, y - 7, 12, 13, '#62798c');
        r(c, x + 9, y - 5, 7, 4, '#d8c7a2');
    }
    else if (w.id === 4) {
        polygon(c, [[x - 22, y + 7], [x - 4, y - 29], [x + 3, y - 17], [x + 12, y - 27], [x + 24, y + 7]], '#7394a6');
        polygon(c, [[x - 4, y - 29], [x - 10, y - 15], [x - 4, y - 18], [x + 1, y - 14]], '#edf1de');
        r(c, x + 2, y - 7, 16, 13, '#c6bc9e');
        roof(c, x, y - 13, 20, 7);
        r(c, x + 7, y - 4, 5, 6, '#42637c');
        line(c, x - 22, y - 8, x + 19, y - 17, '#d9d6b8');
        pine(c, x - 13, y + 6, 16, true);
    }
    else if (w.id === 5) {
        freezer(c, x - 19, y - 19, 31, 28);
        pipe(c, x + 11, y - 28, 10, 34, true);
        r(c, x - 20, y - 19, 32, 2, '#f0f8e9');
    }
    else {
        r(c, x - 18, y - 21, 31, 28, '#d8c5a9');
        r(c, x + 10, y - 21, 4, 28, '#b5a399');
        for (const xx of [x - 12, x + 4]) {
            r(c, xx, y - 16, 5, 8, '#f4d892');
            r(c, xx + 2, y - 16, 1, 8, '#986e62');
            r(c, xx - 2, y - 17, 1, 10, '#55866b');
        }
        roof(c, x - 22, y - 28, 39, 8);
        r(c, x - 6, y - 8, 6, 12, '#775667');
        flowers(c, x - 20, y + 7, 39);
        pine(c, x + 18, y + 4, 23, true);
    }
    if (selected)
        pixelText(c, '↓', x, y - 39 + Math.round(Math.sin(time / 220) * 2), w.accent, 1, 'center');
}
