import test from 'node:test';
import assert from 'node:assert/strict';
import { JuiceMinibossModel } from '../src/adventure/experimental/JuiceMinibossModel';
import { drawJuiceGeysers } from '../src/adventure/experimental/JuiceArenaPainter';

const player = { x: 68, y: 192, width: 14, height: 32 };
const step = 1000 / 120;

function paint(boss: JuiceMinibossModel, cx: number, cy: number, reducedMotion: boolean) {
    const fills: Array<{ x: number; y: number; width: number; height: number; alpha: number }> = [];
    const state = { globalAlpha: 1 };
    const context = new Proxy(state, {
        get(target, key) {
            if (key === 'fillRect') return (x: number, y: number, width: number, height: number) => {
                fills.push({ x, y, width, height, alpha: target.globalAlpha });
            };
            return Reflect.get(target, key) ?? (() => {});
        },
    }) as unknown as CanvasRenderingContext2D;
    drawJuiceGeysers(context, boss, cx, cy, reducedMotion);
    return fills;
}

for (const cycle of [0, 1, 3]) for (const reducedMotion of [false, true]) {
    test(`stage-two cycle ${cycle} advertises the full future geyser volume, reduced motion ${reducedMotion}`, () => {
        const boss = new JuiceMinibossModel(); boss.health = 2; boss.phase = 'rest'; boss.cycle = cycle;
        while (boss.phase === 'rest') boss.update(step, player);
        assert.equal(boss.phase, 'warning');
        assert.equal(boss.geysers.length, 2);
        const locked = boss.geysers.map(({ x, y, width, height }) => ({ x, y, width, height }));
        const started = boss.time;
        while (boss.phase === 'warning') {
            assert.deepEqual(boss.hazards, [], 'The projected volume is still harmless.');
            const before = JSON.stringify(boss);
            const cx = 3, cy = 64;
            const fills = paint(boss, cx, cy, reducedMotion);
            for (const hazard of locked) assert.ok(fills.some(fill =>
                fill.x === hazard.x - cx && fill.y === hazard.y - cy
                && fill.width === hazard.width && fill.height === hazard.height
                && fill.alpha > 0 && fill.alpha < .3),
            'From the first warning frame, a translucent projection shows the entire eventual danger volume.');
            assert.equal(JSON.stringify(boss), before, 'Rendering cannot advance or retarget the encounter.');
            boss.update(step, { ...player, x: 280, y: 100 });
        }
        assert.ok(boss.time - started >= boss.geyserWarningMs);
        assert.deepEqual(boss.hazards, locked, 'The visible warning and live collision occupy exactly the same volume.');
    });
}

test('geyser warning retains its countdown in reduced motion while ignoring cosmetic time', () => {
    const boss = new JuiceMinibossModel(); boss.health = 2; boss.phase = 'rest';
    while (boss.phase === 'rest') boss.update(step, player);
    const early = paint(boss, 0, 64, true);
    for (let i = 0; i < 54; i++) boss.update(step, player);
    const halfway = paint(boss, 0, 64, true);
    assert.notDeepEqual(halfway, early, 'The floor countdown continues to communicate when the jets fire.');
    boss.time += 5000;
    assert.deepEqual(paint(boss, 0, 64, true), halfway);
});
