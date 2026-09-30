import type { AdventureStage } from './types';
import { pixelText, fitText } from '../graphics/BitmapFont';
import { box as r, pixelLine as line, polygon, oval, palm, pine, roof, flowers, tank, pipe, gauge, crane, container, station, freezer, arch, rockArch, oven, villa, steelBeam, ink } from './WorldPainting';
const label = (c: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, color = '#f4dfac') => pixelText(c, fitText(text, w - 8), x + w / 2, y, color, 1, 'center');
/** All major structures are explicitly positioned by the level author. Their bases share the tile grid. */
export function drawLandmarks(c: CanvasRenderingContext2D, stage: AdventureStage, cx: number, cy: number, time: number, front = false) {
    for (const p of stage.landmarks ?? []) {
        if ((p.kind === 'container' || p.kind === 'tank') !== front)
            continue;
        const x = Math.round(p.x - cx), y = Math.round(p.y - cy), w = p.width, h = p.height, top = y - h;
        if (x + w < -40 || x > 360)
            continue;
        if (p.kind === 'container') {
            const cols = Math.max(1, Math.ceil(w / 112)), rows = Math.max(1, Math.ceil(h / 45)), ww = w / cols, hh = h / rows;
            for (let j = 0; j < rows; j++)
                for (let i = 0; i < cols; i++) {
                    const xx = x + i * ww, yy = top + j * hh;
                    container(c, xx, yy, ww - 1, hh, (p.variant ?? 0) + Math.floor(p.x / 160) + i + j);
                    const name = i === Math.floor(cols / 2) && j === 0 ? p.label ?? 'CARGA' : String(i + j * cols + 1).padStart(2, '0'), bw = Math.min(ww - 16, name.length * 6 + 9);
                    r(c, xx + ww / 2 - bw / 2, yy + hh * .4, bw, 11, '#233e53');
                    label(c, name, xx + ww / 2 - bw / 2, yy + hh * .4 + 3, bw);
                }
        }
        else if (p.kind === 'tank') {
            // Tank windows occupy solid terrain beneath the real, uninterrupted roof landing.
            const count = Math.max(1, Math.round(w / 91)), tw = w / count;
            for (let i = 0; i < count; i++)
                tank(c, x + i * tw + 4, y + 9, tw - 8, h - 11, time, stage.world === 5);
            steelBeam(c, x, y, w, 8);
            if (p.label && w > 75) {
                const bw = Math.min(w - 16, Math.max(54, p.label.length * 6 + 10));
                r(c, x + w / 2 - bw / 2, y + 18, bw, 12, '#e0ce9e');
                label(c, p.label, x + w / 2 - bw / 2, y + 21, bw, '#35435b');
            }
        }
        else if (p.kind === 'palms') {
            palm(c, x + w * .24, y, h * .72);
            palm(c, x + w * .76, y, h * .96);
            flowers(c, x + 4, y, w - 8);
        }
        else if (p.kind === 'lighthouse') {
            const xx = x + w / 2 - 17;
            polygon(c, [[xx + 5, top + 18], [xx + 27, top + 18], [xx + 35, y], [xx - 3, y]], '#4e6b82');
            polygon(c, [[xx + 7, top + 18], [xx + 25, top + 18], [xx + 30, y], [xx + 1, y]], '#e6d9af');
            for (const yy of [top + h * .47, top + h * .72]) {
                r(c, xx + 4, yy, 25, 10, '#bb7066');
                r(c, xx + 4, yy, 6, 10, '#e09378');
            }
            r(c, xx + 25, top + 22, 3, h - 22, '#b5a9a0');
            r(c, xx - 3, top + 14, 38, 5, ink);
            r(c, xx + 2, top + 3, 28, 11, '#476f89');
            r(c, xx + 5, top + 5, 7, 7, '#b2d8d6');
            r(c, xx + 16, top + 5, 9, 7, '#f4db8c');
            roof(c, xx - 4, top - 5, 40, 9);
            r(c, xx + 12, y - 20, 10, 20, '#4a5b6b');
            r(c, xx + 13, y - 18, 3, 16, '#9b8a73');
            r(c, xx + 9, top + h * .35, 5, 8, '#698a99');
            r(c, xx + 5 + Math.floor(time / 700) % 3 * 7, top + 5, 4, 6, '#fff0b8');
        }
        else if (p.kind === 'rope') {
            for (const xx of [x - 3, x + w - 2]) {
                r(c, xx, y - 24, 5, 31, ink);
                r(c, xx + 1, y - 23, 3, 29, '#ad8050');
                r(c, xx - 1, y - 20, 7, 3, '#edc689');
                r(c, xx - 1, y - 10, 7, 2, '#d0ac77');
            }
            for (let i = 0; i < w; i += 3) {
                const yy = y - 21 + Math.sin(i / w * Math.PI) * 10;
                r(c, x + i, yy, 3, 2, '#795946');
                r(c, x + i, yy, 3, 1, '#d3b278');
                if (i % 12 === 0)
                    line(c, x + i, yy + 2, x + i, y - 1, '#b69a70');
            }
        }
        else if (p.kind === 'crane') {
            crane(c, x, top, w, h);
        }
        else if (p.kind === 'pipe') {
            pipe(c, x, top, w, h, stage.world === 5);
            pipe(c, x + 3, top + 32, w * .42, Math.max(9, h - 34), stage.world === 5);
            gauge(c, x + w * .45, top + 13, .35 + (Math.sin(time / 800) * .1));
            oval(c, x + w * .7, top + 14, 16, 16, '#754d67');
            oval(c, x + w * .7 + 2, top + 16, 12, 12, '#b97186');
            line(c, x + w * .7 + 7, top + 17, x + w * .7 + 7, top + 26, '#efb3b6', 2);
            line(c, x + w * .7 + 3, top + 21, x + w * .7 + 12, top + 21, '#efb3b6', 2);
        }
        else if (p.kind === 'station') {
            const hh = Math.min(h, 96), tt = y - hh;
            station(c, x, tt, w, hh);
            if (p.label) {
                r(c, x + w / 2 - 34, tt + 19, 68, 11, '#334d60');
                label(c, p.label, x + w / 2 - 34, tt + 21, 68);
            }
        }
        else if (p.kind === 'freezer') {
            const hh = Math.min(h, 114), count = Math.max(1, Math.round(w / 112)), ww = w / count;
            for (let i = 0; i < count; i++)
                freezer(c, x + i * ww, y - hh, ww - 3, hh);
            if (p.label) {
                r(c, x + 8, y - hh + 10, Math.min(106, w - 16), 11, '#30526d');
                label(c, p.label, x + 8, y - hh + 12, Math.min(106, w - 16), '#c6e9ea');
            }
        }
        else if (p.kind === 'pine') {
            for (let i = 0; i < 3; i++)
                pine(c, x + 12 + i * (w - 24) / 3, y, h - (i % 2) * 22, i === 1);
        }
        else if (p.kind === 'arch' || p.kind === 'rockArch') {
            if (p.kind === 'rockArch') {
                const ww = Math.min(w, 150), hh = Math.min(h, 105);
                rockArch(c, x + (w - ww) / 2, y - hh, ww, hh);
            }
            else {
                const count = Math.max(1, Math.floor(w / 70)), hh = Math.min(h, 84), tt = y - hh;
                for (let i = 0; i < count; i++) {
                    arch(c, x + i * w / count, tt, w / count, hh);
                    flowers(c, x + i * w / count + 5, tt + 2, 22);
                }
                roof(c, x - 3, tt - 13, w + 6, 13);
                flowers(c, x + 5, y, w - 10);
                if (p.label) {
                    r(c, x + w / 2 - 31, tt + 7, 62, 12, '#8a6a67');
                    label(c, p.label, x + w / 2 - 31, tt + 10, 62);
                }
            }
        }
        else if (p.kind === 'oven') {
            oven(c, x + 6, top + 9, w - 12, h - 15, time);
            r(c, x + 3, y - 1, w - 6, 4, '#ded0b0');
            if (p.label)
                label(c, p.label, x + 6, top + 2, w - 12, '#f0c990');
        }
        else if (p.kind === 'garden') {
            for (let i = 0; i < w; i += 33)
                flowers(c, x + i, y, 24, stage.world === 6);
            if (h > 45) {
                pine(c, x + 12, y, h, true);
                pine(c, x + w - 18, y, h * .78, true);
            }
        }
        else if (p.kind === 'house') {
            const hh = Math.min(h, 91), tt = y - hh;
            villa(c, x, tt, w, hh);
            if (p.label) {
                r(c, x + w / 2 - 21, tt + 49, 42, 14, '#896453');
                label(c, p.label, x + w / 2 - 21, tt + 53, 42);
            }
        }
        else if (p.kind === 'bottler') {
            steelBeam(c, x, top, w, 7);
            for (let i = 12; i < w - 12; i += 32) {
                r(c, x + i, top + 7, 3, h * .38, '#819cab');
                r(c, x + i - 2, top + h * .38, 7, 4, '#3d586d');
                const bx = x + ((i + Math.floor(time / 110)) % (w - 18)) + 5, by = y - 17;
                r(c, bx + 2, by, 4, 3, '#d9dfcc');
                r(c, bx, by + 3, 8, 12, '#4b5676');
                r(c, bx + 1, by + 5, 6, 9, '#a777cb');
                r(c, bx + 2, by + 6, 1, 6, '#d6b7e5');
                r(c, bx + 1, by + 10, 6, 3, '#e1d9bb');
            }
            r(c, x, y - 2, w, 3, '#708799');
            r(c, x, y + 1, w, 5, '#354e65');
            for (let i = 8; i < w; i += 14)
                oval(c, x + i, y + 2, 5, 5, '#95a2af');
        }
        else if (p.kind === 'banner') {
            const xx = x + w / 2;
            r(c, xx - 21, top, 43, 3, '#d1b887');
            r(c, xx - 23, top - 1, 4, 5, '#edcf8d');
            r(c, xx + 21, top - 1, 4, 5, '#edcf8d');
            polygon(c, [[xx - 17, top + 3], [xx + 17, top + 3], [xx + 17, y - 12], [xx, y], [xx - 17, y - 12]], '#7a414e');
            polygon(c, [[xx - 14, top + 4], [xx + 14, top + 4], [xx + 14, y - 13], [xx, y - 4], [xx - 14, y - 13]], '#c07869');
            label(c, p.label ?? 'JP', xx - 16, top + 16, 32, '#ffe1a0');
            r(c, xx - 5, top + 29, 10, 2, '#ead1a0');
        }
    }
}
