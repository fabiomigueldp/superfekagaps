import type { AdventureStage } from './types';
import { pixelText, fitText } from '../graphics/BitmapFont';
const r = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const line = (c: CanvasRenderingContext2D, x: number, y: number, xx: number, yy: number, color: string) => { c.strokeStyle = color; c.lineWidth = 1; c.beginPath(); c.moveTo(Math.round(x) + .5, Math.round(y) + .5); c.lineTo(Math.round(xx) + .5, Math.round(yy) + .5); c.stroke(); };
const label = (c: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, color = '#f4deb0') => pixelText(c, fitText(text, w - 8), x + w / 2, y, color, 1, 'center');
/** Landmarks are authored in stage data; no random props can obscure a landing or an enemy. */
export function drawLandmarks(c: CanvasRenderingContext2D, stage: AdventureStage, cx: number, cy: number, time: number, front = false) {
    for (const p of stage.landmarks ?? []) {
        const isFront = p.kind === 'container' || p.kind === 'tank';
        if (isFront !== front)
            continue;
        const x = Math.round(p.x - cx), y = Math.round(p.y - cy), w = p.width, h = p.height;
        if (x + w < -32 || x > 352)
            continue;
        const top = y - h;
        if (p.kind === 'container') {
            const colors = ['#427c86', '#a36a58', '#9b8451', '#605e88'], base = colors[(Math.floor(p.x / 160) + p.variant!) % 4] ?? colors[0];
            r(c, x, top, w, h, '#243b50');
            r(c, x + 2, top + 2, w - 4, h - 4, base);
            r(c, x + 2, top, w - 4, 3, '#d7cfa7');
            for (let i = 7; i < w - 4; i += 10) {
                r(c, x + i, top + 6, 2, h - 12, '#253e5055');
                r(c, x + i + 2, top + 6, 1, h - 12, '#d8d4b233');
            }
            r(c, x + 3, top + h - 8, w - 6, 4, '#283e50');
            r(c, x + 6, top + 6, 2, h - 15, '#d6c499');
            r(c, x + w - 9, top + 6, 2, h - 15, '#d6c499');
            r(c, x + w / 2 - 25, top + h * .44, 50, 15, '#293e51');
            label(c, p.label ?? 'CARGA', x + w / 2 - 25, top + h * .44 + 5, 50);
            r(c, x + w / 2 - 24, top + h * .44 + 17, 9, 3, '#d8c99c');
        }
        else if (p.kind === 'tank') {
            // The tank roof is the solid landing; the glass body extends below that collision surface.
            r(c, x + 3, y + 4, w - 6, h, '#273d58');
            r(c, x + 6, y + 5, w - 12, h - 8, '#53778a');
            r(c, x + 12, y + 12, w - 24, h - 24, '#27324f');
            const fluid = y + Math.min(32, h / 3) + Math.round(Math.sin(time / 900 + p.x) * 2);
            r(c, x + 13, fluid, w - 26, y + h - 13 - fluid, '#673b90');
            r(c, x + 13, fluid, w - 26, 3, '#c396e4');
            for (let i = 0; i < 6; i++) {
                const bx = x + 18 + (i * 29) % Math.max(20, w - 36), by = y + h - 18 - ((time * .017 + i * 21) % Math.max(25, h - 45));
                r(c, bx, by, 3, 3, '#b47bd066');
                r(c, bx, by, 2, 1, '#ddadf1');
            }
            r(c, x + 13, y + 12, 3, h - 25, '#d0e7de55');
            r(c, x + w - 20, y + 12, 4, h - 25, '#94c0d366');
            r(c, x, y, w, 4, '#d4e2d2');
            r(c, x + 2, y + 4, w - 4, 4, '#708b98');
            for (let i = 8; i < w; i += 16)
                r(c, x + i, y + 5, 2, 2, '#26374e');
            r(c, x + w / 2 - 22, y + 19, 44, 12, '#e3d9ae');
            label(c, p.label ?? 'SUCO', x + w / 2 - 22, y + 22, 44, '#3c465b');
        }
        else if (p.kind === 'palms') {
            for (let i = 0; i < 2; i++) {
                const px = x + i * (w - 30) + 12, hh = h - (i % 2) * 23;
                r(c, px, y - hh, 5, hh, '#646748');
                r(c, px + 1, y - hh, 2, hh, '#99966a');
                for (let j = 8; j < hh; j += 12)
                    r(c, px, y - j, 5, 2, '#4b654e');
                for (let j = 0; j < 4; j++) {
                    const yy = y - hh + j * 3;
                    r(c, px - 22 + j * 5, yy, 46 - j * 6, 3, j < 2 ? '#3b765e' : '#549369');
                }
                r(c, px - 2, y - hh + 8, 9, 5, '#9a7b55');
            }
            for (let i = 0; i < 5; i++)
                r(c, x + i * 17, y - 3 - i % 2, 7, 3, '#487b56');
        }
        else if (p.kind === 'lighthouse') {
            const xx = x + w / 2 - 17;
            r(c, xx, top + 19, 34, h - 19, '#718b99');
            r(c, xx + 3, top + 19, 28, h - 19, '#ddd4b3');
            r(c, xx + 3, top + h * .5, 28, 12, '#ae6962');
            r(c, xx + 3, top + h * .76, 28, 10, '#ae6962');
            r(c, xx - 4, top + 12, 42, 7, '#44576c');
            r(c, xx, top, 34, 13, '#31495e');
            r(c, xx + 4, top + 2, 26, 8, '#a6ced0');
            r(c, xx + 8, top - 6, 18, 6, '#b97169');
            r(c, xx + 13, y - 23, 10, 23, '#37475c');
            const beam = Math.floor(time / 900) % 3;
            r(c, xx + 5 + beam * 8, top + 3, 6, 6, '#ffe6ad');
        }
        else if (p.kind === 'rope') {
            r(c, x - 2, y - 17, 3, 25, '#745f4c');
            r(c, x + w - 1, y - 17, 3, 25, '#745f4c');
            for (let i = 0; i < w; i += 4) {
                const sy = y - 15 + Math.sin(i / w * Math.PI) * 11;
                r(c, x + i, sy, 4, 1, '#bfa87e');
                if (i % 16 === 0)
                    r(c, x + i, sy + 1, 1, Math.max(1, y - sy - 1), '#a48c69');
            }
            for (let i = 6; i < w; i += 24) {
                line(c, x + i, y + 5, x + i + 8, y + h, '#41536c');
            }
        }
        else if (p.kind === 'crane') {
            const xx = x + 6;
            r(c, xx, top, 9, h, '#8c7756');
            r(c, xx + 1, top, 6, h, '#d4a859');
            r(c, xx - 9, top, w, 6, '#4c535b');
            r(c, xx - 8, top + 1, w - 2, 3, '#e2bd76');
            for (let i = 0; i < h - 16; i += 16) {
                line(c, xx, top + i, xx + 9, top + i + 16, '#5d6b69');
                line(c, xx + 9, top + i, xx, top + i + 16, '#5d6b69');
            }
            line(c, xx + 6, top + 1, xx + w - 18, top + 5, '#f4ce85');
            const hook = x + w - 29;
            r(c, hook, top + 6, 1, h * .5, '#92a6a5');
            r(c, hook - 4, top + 6 + h * .5, 9, 5, '#ddb474');
            r(c, hook - 2, top + 10 + h * .5, 5, 5, '#586a76');
        }
        else if (p.kind === 'pipe') {
            r(c, x, top, w, 8, '#293f54');
            r(c, x + 2, top + 1, w - 4, 3, '#8ca3aa');
            r(c, x + 5, top + 8, 8, h - 8, '#456978');
            r(c, x + 7, top + 8, 2, h - 8, '#9eb8b7');
            r(c, x + w - 14, top + 8, 9, h - 8, '#456978');
            for (let i = 6; i < w; i += 24) {
                r(c, x + i, top - 2, 4, 12, '#344c60');
                r(c, x + i + 1, top - 1, 2, 10, '#bbc8bd');
            }
            const vx = x + w / 2;
            r(c, vx - 7, top + 13, 14, 14, '#824f74');
            r(c, vx - 5, top + 15, 10, 10, '#bd789d');
            r(c, vx - 1, top + 15, 2, 10, '#f0bbd1');
            r(c, vx - 5, top + 19, 10, 2, '#f0bbd1');
        }
        else if (p.kind === 'station' || p.kind === 'freezer') {
            const cold = p.kind === 'freezer', base = cold ? '#668ca5' : '#59687d', light = cold ? '#b5d6dc' : '#b79577';
            r(c, x, top, w, h, base);
            r(c, x + 5, top + 6, w - 10, h - 6, cold ? '#466880' : '#344959');
            r(c, x, top - 3, w, 4, light);
            r(c, x + 2, top, w - 4, 2, '#dfdbbd');
            for (let i = 9; i < w - 10; i += 25) {
                r(c, x + i, top + 21, 19, Math.min(27, h - 28), cold ? '#7ea9ba' : '#789ba2');
                r(c, x + i + 1, top + 22, 17, 3, '#b9d7d0');
                r(c, x + i + 8, top + 21, 2, Math.min(27, h - 28), base);
            }
            for (const xx of [x + 3, x + w - 7]) {
                r(c, xx, top + 5, 4, h - 5, light);
                r(c, xx + 1, top + 7, 1, h - 7, '#d9d4b3');
            }
            r(c, x + w / 2 - 34, top + 6, 68, 12, '#253d53');
            label(c, p.label ?? 'ESTAÇÃO', x + w / 2 - 34, top + 9, 68, cold ? '#b9e5ed' : '#efce94');
            if (cold)
                for (let i = 7; i < w - 7; i += 17) {
                    r(c, x + i, top + 1, 3, 8 + i % 7, '#d6eee8');
                    r(c, x + i + 1, top + 5, 1, 9 + i % 7, '#aad8e1');
                }
        }
        else if (p.kind === 'pine') {
            for (let i = 0; i < 3; i++) {
                const xx = x + 10 + i * (w - 20) / 3, hh = h - i % 2 * 16;
                r(c, xx, y - hh, 3, hh, '#65776c');
                for (let j = 0; j < 6; j++) {
                    const ww = 9 + j * 5;
                    r(c, xx - ww / 2, y - hh + j * 10, ww, 9, j % 2 ? '#487e78' : '#5a9685');
                    r(c, xx - ww / 2, y - hh + j * 10, ww, 2, '#9ab3a0');
                }
            }
        }
        else if (p.kind === 'arch' || p.kind === 'oven') {
            const oven = p.kind === 'oven', stone = oven ? '#a17c78' : '#a293a5';
            r(c, x, top, w, h, stone);
            r(c, x + 7, top + 16, w - 14, h - 16, oven ? '#4f354b' : '#68748a');
            for (let i = 0; i < w; i += 16) {
                r(c, x + i, top, 14, 5, '#d2c4b1');
                r(c, x + i, top + 8, 14, 1, '#5a566d');
            }
            r(c, x + 7, top + 16, 5, h - 16, '#71667d');
            r(c, x + w - 12, top + 16, 5, h - 16, '#71667d');
            if (oven) {
                for (let i = 16; i < w - 16; i += 12) {
                    const hh = 13 + Math.sin(time / 170 + i) * 5;
                    r(c, x + i, y - hh, 8, hh, '#cb826c');
                    r(c, x + i + 2, y - hh + 5, 4, hh - 5, '#f3c588');
                }
                r(c, x + 8, y - 3, w - 16, 3, '#e6bb8d');
            }
            else {
                r(c, x + 15, top + 22, w - 30, 3, '#a7a6ae');
                r(c, x + w / 2 - 8, y - 24, 16, 24, '#55516c');
            }
            if (p.label)
                label(c, p.label, x + 2, top + 7, w - 4);
        }
        else if (p.kind === 'banner') {
            const xx = x + w / 2;
            r(c, xx - 23, top, 47, 3, '#d4bd94');
            r(c, xx - 18, top + 3, 36, h - 10, '#805b86');
            r(c, xx - 16, top + 3, 3, h - 10, '#c195a7');
            r(c, xx + 14, top + 3, 2, h - 10, '#563f69');
            for (let i = 0; i < 6; i++)
                r(c, xx - 18 + i * 6, y - 7, 6, 3 + Math.round(Math.sin(time / 260 + i) * 2), '#805b86');
            label(c, p.label ?? 'JP', xx - 17, top + 16, 34);
            r(c, xx - 6, top + 31, 12, 2, '#d9b788');
        }
    }
}
