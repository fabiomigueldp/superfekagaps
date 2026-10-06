import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { WorldArt } from '../src/adventure/WorldArt';
import { FOE_FRAMES, foeFrame, WORLD_PALETTE } from '../src/adventure/WorldAssets';
import { WorldFoe } from '../src/adventure/WorldEnemies';
import { WorldObjects, type WorldLevel } from '../src/adventure/WorldPhysics';
import type { PixelFrame } from '../src/graphics/pixels';

const loader = () => new WorldFoe({ id: 'loader-art-test', kind: 'loader', x: 120, y: 224 });
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const silhouette = (frame: PixelFrame) => frame.map(row => row.replace(/[^_]/g, '#')).join('\n');

function capture(art: WorldArt, e: WorldFoe) {
    const calls: { frame: PixelFrame; x: number; y: number; flip: boolean | undefined }[] = [];
    art.atlas.draw = (_ctx, frame, _palette, x, y, flip) => { calls.push({ frame, x, y, flip }); };
    const c = { save() {}, restore() {}, fillRect() {} } as unknown as CanvasRenderingContext2D;
    const before = structuredClone(e);
    art.foe(c, e, 0, 0, 0);
    art.foe(c, e, 0, 0, 999999);
    assert.deepEqual(structuredClone(e), before, 'Rendering cannot change the release clock, hitbox, HP or movement.');
    assert.deepEqual(calls[0], calls[1], 'Repeated or paused rendering must retain its simulation-owned frame.');
    return calls[0];
}

test('loader recoil gives its release, follow-through and settled hand readable shares of all 400 ms', () => {
    const frames = [0, 130, 260].map(time => foeFrame('loader', 'recoil', time));
    assert.equal(new Set(frames.map(silhouette)).size, 3);
    assert.deepEqual(frames, FOE_FRAMES.loader.slice(6, 9));
    for (const [time, index] of [[-10, 0], [129, 0], [130, 1], [259, 1], [260, 2], [399, 2], [400, 2], [10000, 2]] as const) {
        assert.strictEqual(foeFrame('loader', 'recoil', time), frames[index]);
    }
    assert.strictEqual(foeFrame('loader', 'recoil', 0), frames[0], 'Every new barrel starts a fresh release pose.');
    // The front hand draws back toward the torso and down, without sliding either foot.
    assert.deepEqual(frames.map(frame => frame.slice(19, 31).reduce((min, row) => {
        const hand = row.indexOf('S'); return hand < 0 ? min : Math.min(min, hand);
    }, 36)), [2, 6, 11]);
    for (const frame of frames) {
        assert.equal(frame[34], FOE_FRAMES.loader[6][34]);
        assert.equal(frame[35], '_'.repeat(36));
    }
});

test('loader retains its original release pose, other animations, palette, size and body outside the moving arm', () => {
    assert.equal(digest(FOE_FRAMES.loader[6]), 'c895329b062bc6d3974f35ac75d020f9e6f302d83490451a85841d069b082d62');
    assert.equal(digest(FOE_FRAMES.loader.filter((_, index) => index < 6 || index > 8)),
        '86dd9235ba252603f45559688de370bfabc0db9675f0b1e28d8c7f701fc91843');
    for (const frame of FOE_FRAMES.loader) {
        assert.equal(frame.length, 36); assert.ok(frame.every(row => row.length === 36));
        assert.ok([...frame.join('')].every(pixel => pixel === '_' || WORLD_PALETTE[pixel as keyof typeof WORLD_PALETTE]));
    }
    for (const frame of FOE_FRAMES.loader.slice(7, 9)) for (let y = 0; y < 36; y++) for (let x = 0; x < 36; x++) {
        if (x < 1 || x > 17 || y < 19 || y > 30) assert.equal(frame[y][x], FOE_FRAMES.loader[6][y][x]);
    }
    for (const time of [0, 129, 260, 520, 850, 1600]) {
        assert.strictEqual(foeFrame('loader', 'warning', time), FOE_FRAMES.loader[3 + Math.min(2, Math.floor(time / 260))]);
        assert.strictEqual(foeFrame('loader', 'rest', time), FOE_FRAMES.loader[9 + Math.floor(time / 190) % 3]);
    }
});

test('reduced motion holds loaded, primed and empty-handed poses and responds to live preference changes', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
    const media = { matches: true };
    Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: () => media });
    try {
        const art = new WorldArt(), e = loader();
        for (const phase of ['rest', 'warning', 'recoil', 'stunned'] as const) {
            e.phase = phase;
            const expected = foeFrame('loader', phase, 0, true, true);
            for (const time of [0, 130, 260, 399, 850, 1600]) {
                e.timer = time;
                assert.strictEqual(capture(art, e).frame, expected);
            }
        }
        assert.equal(new Set(['rest', 'warning', 'recoil'].map(phase => silhouette(foeFrame('loader', phase, 0, true, true)))).size, 3);
        e.phase = 'recoil'; e.timer = 300;
        assert.strictEqual(capture(art, e).frame, FOE_FRAMES.loader[7]);
        media.matches = false;
        for (const facing of [-1, 1]) {
            e.facing = facing;
            const rendered = capture(art, e);
            assert.strictEqual(rendered.frame, FOE_FRAMES.loader[8]);
            assert.equal(rendered.flip, facing > 0);
            assert.equal(rendered.x, e.x + e.width / 2 - 18);
            assert.equal(rendered.y, e.y + e.height - 36);
        }
    } finally {
        if (descriptor) Object.defineProperty(globalThis, 'matchMedia', descriptor);
        else Reflect.deleteProperty(globalThis, 'matchMedia');
    }
});

test('loader keeps exact activation, 850 ms windup, projectile release and 400 ms recovery on repeat throws', () => {
    const level = {} as WorldLevel, objects = new WorldObjects([]), art = new WorldArt();
    const e = loader(), player = { x: 40, y: 200, width: 14, height: 24 };
    e.update(2000, level, objects, { ...player, x: 1000 });
    assert.equal(e.phase, 'rest'); assert.equal(objects.barrels.length, 0);
    for (const facing of [-1, 1]) {
        e.timer = 0;
        const target = { ...player, x: e.x + facing * 60 };
        const count = objects.barrels.length;
        for (const [dt, phase, timer] of [[1500, 'rest', 1500], [1, 'warning', 0], [850, 'warning', 850], [1, 'recoil', 0],
            [129, 'recoil', 129], [1, 'recoil', 130], [130, 'recoil', 260], [140, 'recoil', 400], [1, 'rest', 0]] as const) {
            e.update(dt, level, objects, target);
            assert.equal(e.phase, phase); assert.equal(e.timer, timer);
            capture(art, e);
            if (phase === 'recoil') {
                assert.equal(objects.barrels.length, count + 1);
                const barrel = objects.barrels[count];
                assert.equal(barrel.x, e.x + (facing < 0 ? -14 : e.width));
                assert.equal(barrel.y, e.y - 4);
                assert.equal(barrel.vx, facing * 1.8); assert.equal(barrel.vy, -2.5);
            } else if (phase === 'warning') assert.equal(objects.barrels.length, count);
        }
        assert.equal(objects.barrels.length, count + 1);
        assert.deepEqual([e.x, e.y, e.width, e.height, e.hp], [120, 199, 22, 25, 1]);
    }
});

test('loader contact rules and death interruption remain unchanged throughout its throw', () => {
    const art = new WorldArt();
    for (const phase of ['rest', 'warning', 'recoil'] as const) {
        const e = loader(); e.phase = phase; e.timer = 300;
        const previous = { x: e.x + 4, y: e.y - 25, width: 14, height: 24 };
        assert.equal(e.contact({ ...previous, y: e.y }, previous, false, false), 'hurt');
        assert.equal(e.contact({ ...previous, y: e.y - 10 }, previous, true, false), 'kill');
        assert.equal(e.dead, true);
        assert.strictEqual(capture(art, e).frame, foeFrame('loader', 'stunned', 300));
        e.update(361, {} as WorldLevel, new WorldObjects([]), previous);
        assert.equal(capture(art, e), undefined, 'An interrupted throw cannot linger or replay after death.');
    }
});
