import test from 'node:test';
import assert from 'node:assert/strict';
import { JuiceMinibossModel } from '../src/adventure/experimental/JuiceMinibossModel';
import { drawJuiceMiniboss } from '../src/adventure/experimental/JuiceMinibossArt';

for (const target of [{ x: 7, y: 212 }, { x: 313, y: 212 }, { x: 160, y: 110 }]) {
    test(`fan painter advertises all five exact locked launch vectors toward ${target.x},${target.y}`, () => {
        const b = new JuiceMinibossModel(); b.phase = 'warning'; b.attack = 'fan';
        b.targetX = target.x; b.targetY = target.y; b.phaseTime = 320;
        b.facing = target.x < b.x ? -1 : 1;
        const lines: Array<{ start: number[]; end: number[] }> = [];
        let start: number[] = [], end: number[] = [];
        const c = new Proxy({
            beginPath() { start = []; end = []; },
            moveTo(x: number, y: number) { start = [x, y]; },
            lineTo(x: number, y: number) { end = [x, y]; },
            stroke() { if (start.length && end.length) lines.push({ start, end }); }
        }, { get(object, key) { return Reflect.get(object, key) ?? (() => {}); } }) as unknown as CanvasRenderingContext2D;
        const camera = { x: 3, y: 64 }, fan = b.fanLaunch;
        drawJuiceMiniboss(c, b, camera.x, camera.y);
        assert.ok(lines.length >= 5);
        lines.slice(0, 5).forEach((line, i) => {
            const vector = fan.vectors[i], length = 230 + b.progress * 45;
            assert.deepEqual(line.start, [fan.x - camera.x + vector.vx * 110, fan.y - camera.y + vector.vy * 110]);
            assert.deepEqual(line.end, [fan.x - camera.x + vector.vx * length, fan.y - camera.y + vector.vy * length]);
        });
    });
}
