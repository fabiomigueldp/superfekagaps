import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JuiceMinibossLab } from '../src/adventure/experimental/JuiceMinibossLab';
import type { JuiceMinibossModel } from '../src/adventure/experimental/JuiceMinibossModel';
import { pixelText } from '../src/graphics/BitmapFont';
import { guairaBrowser } from './helpers/guairaLabHarness';

const recording = JSON.parse(readFileSync(new URL('./helpers/juiceLabReplay.json', import.meta.url), 'utf8')) as {
    stepMs: number; runs: Array<[number, number]>;
};
type Dot = { x: number; y: number; color: string; alpha: number };
function shape(dots: Dot[]) {
    assert.ok(dots.length > 0, 'The complete warning must be painted.');
    const x = Math.min(...dots.map(p => p.x)), y = Math.min(...dots.map(p => p.y));
    return dots.map(p => `${p.x - x},${p.y - y}`).sort();
}
function expectedText(text: string, color: string) {
    const dots: Dot[] = [];
    pixelText({ fillRect(x: number, y: number) { dots.push({ x, y, color, alpha: 1 }); } } as unknown as CanvasRenderingContext2D,
        text, 0, 0, color);
    return shape(dots);
}

for (const reducedMotion of [false, true]) {
    test(`phase-2 warnings fit the existing HUD throughout ordinary replay (${reducedMotion ? 'reduced' : 'normal'} motion)`, t => {
        const h = guairaBrowser(t, { reducedMotion });
        let collecting = false, dots: Dot[] = [], fills: number[][] = [];
        const createElement = h.document.createElement;
        h.document.createElement = tag => {
            const element = createElement(tag);
            if (tag === 'canvas') {
                const c = (element as typeof h.canvas).getContext();
                const stack: Array<{ alpha: number; color: typeof c.fillStyle }> = [];
                c.save = () => { stack.push({ alpha: c.globalAlpha, color: c.fillStyle }); };
                c.restore = () => { const saved = stack.pop(); if (saved) { c.globalAlpha = saved.alpha; c.fillStyle = saved.color; } };
                c.fillRect = (x, y, w, height) => {
                    if (x === 0 && y === 0 && w === 320 && height === 34 && c.fillStyle === '#161c2a') {
                        collecting = true; dots = []; fills = [];
                    }
                    if (!collecting) return;
                    fills.push([x, y, w, height]);
                    if (w === 1 && height === 1) dots.push({ x, y, color: String(c.fillStyle), alpha: c.globalAlpha });
                };
            }
            return element;
        };
        const game = new JuiceMinibossLab(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
        game.skipIntro();
        assert.equal(game.reducedMotion, reducedMotion);
        let held = new Set<string>(), frame = 0, enrageFrames = 0, sawFadeIn = false, sawFull = false, sawFadeOut = false;
        const phrases = [
            { text: 'PRESSAO MAXIMA', color: '#ffcfb0' },
            { text: 'SAIA DAS MARCAS NO CHAO', color: '#e9d4ec' }
        ];
        for (const [count, bits] of recording.runs) {
            const next = new Set(['ArrowLeft', 'ArrowRight', 'ShiftLeft', 'Space'].filter((_, i) => bits & (1 << i)));
            for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { code, target: h.canvas });
            for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { code, target: h.canvas });
            held = next;
            for (let n = 0; n < count; n++) {
                game.update(recording.stepMs); frame++;
                const model = (game.boss as NonNullable<typeof game.boss> & { model: JuiceMinibossModel }).model;
                if (model.phase !== 'enrage') continue;
                collecting = false; game.render(); enrageFrames++;
                assert.ok(fills.every(([x, y, w, height]) => x >= 0 && x + w <= 320 && y >= 0 && y + height <= 34),
                    `Transition UI must stay inside the existing HUD at frame ${frame}.`);
                const rows = phrases.map(({ text, color }) => {
                    const painted = dots.filter(p => p.color === color);
                    assert.deepEqual(shape(painted), expectedText(text, color), 'Retain every bitmap glyph at its native size.');
                    assert.ok(painted.every(p => p.y > 13 && p.y < 33), 'Warnings clear the title/health row and HUD border.');
                    const alpha = Math.max(0, Math.min(1, model.phaseTime / 140, (model.enrageMs - model.phaseTime) / 160));
                    assert.ok(painted.every(p => p.alpha === alpha), 'Preserve the existing transition fade.');
                    return { top: Math.min(...painted.map(p => p.y)), bottom: Math.max(...painted.map(p => p.y)) };
                });
                assert.ok(rows[0].bottom < rows[1].top, 'Both full warning phrases are separated and legible.');
                sawFadeIn ||= model.phaseTime > 0 && model.phaseTime < 140;
                sawFull ||= model.phaseTime >= 140 && model.phaseTime <= model.enrageMs - 160;
                sawFadeOut ||= model.phaseTime > model.enrageMs - 160;
            }
        }
        assert.ok(enrageFrames > 60 && sawFadeIn && sawFull && sawFadeOut, 'Replay covers the entire native transition.');
        assert.equal(game.boss?.phase, 'defeated');
        assert.equal(game.player.data.isDead, false);
        assert.deepEqual(h.storageCalls, []);
    });
}
