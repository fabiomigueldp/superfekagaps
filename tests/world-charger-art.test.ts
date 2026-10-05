import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { WorldArt } from '../src/adventure/WorldArt';
import { FOE_FRAMES, foeFrame, WORLD_PALETTE } from '../src/adventure/WorldAssets';
import { WorldFoe, type FoePhase } from '../src/adventure/WorldEnemies';
import { WorldObjects, type WorldLevel } from '../src/adventure/WorldPhysics';
import type { PixelFrame } from '../src/graphics/pixels';
import type { Rect } from '../src/types';

const charger = () => new WorldFoe({ id: 'charger-art-test', kind: 'charger', x: 120, y: 224 });
const bodyTop = (frame: PixelFrame) => frame.findIndex(row => row.includes('a'));
const silhouette = (frame: PixelFrame) => frame.map(row => row.replace(/[^_]/g, '#')).join('\n');

function capture(art: WorldArt, e: WorldFoe) {
    const calls: { frame: PixelFrame; x: number; y: number; flip: boolean | undefined }[] = [];
    const rectangles: { x: number; y: number; w: number; h: number; color: string }[] = [];
    art.atlas.draw = (_context, frame, _palette, x, y, flip) => { calls.push({ frame, x, y, flip }); };
    const c = { fillStyle: '', save() {}, restore() {}, fillRect(this: { fillStyle: string }, x: number, y: number, w: number, h: number) {
        rectangles.push({ x, y, w, h, color: this.fillStyle });
    } } as unknown as CanvasRenderingContext2D;
    const before = structuredClone(e);
    art.foe(c, e, 0, 0, 99999);
    art.foe(c, e, 0, 0, 99999);
    assert.deepEqual(structuredClone(e), before, 'Drawing must not change timers, velocity, hitbox, HP or phase.');
    assert.deepEqual(calls[0], calls[1], 'Repeated rendering, including paused rendering, stays identical.');
    return { ...calls[0], rectangles };
}

test('charger anticipation lowers its shoulders in three distinct silhouettes without shifting planted soles', () => {
    const frames = [0, 260, 520].map(time => foeFrame('charger', 'warning', time));
    assert.equal(new Set(frames.map(silhouette)).size, 3);
    assert.deepEqual(frames.map(bodyTop), [1, 2, 3]);
    for (const frame of frames) assert.equal(frame[34], FOE_FRAMES.charger[1][34]);
    assert.strictEqual(foeFrame('charger', 'warning', 799), frames[2]);
    assert.strictEqual(foeFrame('charger', 'warning', 0), frames[0], 'The next warning restarts the brace.');
});

test('charger recovery rises only once, keeps its guard down, and holds through the full opening', () => {
    const frames = [0, 470, 940].map(time => foeFrame('charger', 'rest', time));
    assert.equal(new Set(frames.map(silhouette)).size, 3);
    assert.deepEqual(frames.map(bodyTop), [6, 5, 4]);
    for (const [index, time] of [469, 939, 1399].entries()) assert.strictEqual(foeFrame('charger', 'rest', time), frames[index]);
    assert.strictEqual(foeFrame('charger', 'rest', 10000), frames[2], 'Recovery never loops back to the collapse.');
    assert.strictEqual(foeFrame('charger', 'rest', -10), frames[0]);
    for (const frame of frames) {
        assert.equal(frame[34], FOE_FRAMES.charger[1][34]);
        assert.notEqual(silhouette(frame), silhouette(foeFrame('charger', 'warning', 520)));
        assert.notEqual(silhouette(frame), silhouette(foeFrame('charger', 'attack', 0)));
    }
});

test('reduced motion holds distinct brace, charge and exhausted poses without hiding the threat', () => {
    for (const phase of ['walk', 'warning', 'attack', 'rest', 'stunned'] as FoePhase[]) {
        const expected = foeFrame('charger', phase, 0, true, true);
        for (const time of [75, 260, 520, 720, 940, 1399]) assert.strictEqual(foeFrame('charger', phase, time, true, true), expected);
    }
    assert.strictEqual(foeFrame('charger', 'warning', 0, true, true), FOE_FRAMES.charger[5]);
    assert.strictEqual(foeFrame('charger', 'rest', 0, true, true), FOE_FRAMES.charger[10]);
    assert.equal(new Set(['warning', 'attack', 'rest'].map(phase => silhouette(foeFrame('charger', phase, 0, true, true)))).size, 3);
});

test('all charger frames retain native dimensions, palette and floor anchor', () => {
    for (const frame of FOE_FRAMES.charger) {
        assert.equal(frame.length, 36);
        assert.ok(frame.every(row => row.length === 36));
        assert.ok([...frame.join('')].every(pixel => pixel === '_' || WORLD_PALETTE[pixel as keyof typeof WORLD_PALETTE]));
        assert.equal(frame[35], '_'.repeat(36));
        assert.ok(frame[34].includes('K'));
    }
});

test('other campaign enemy artwork is pixel-identical and reduced motion does not change its selector', () => {
    const hashes = {
        helmet: 'ddf99c88d466ff7c3a027eb15e2481319092f1102f6f5b0e8421920f47bbce74',
        loader: '048c9095cc89b85d664142396f4cbca416399b596a85dbeda471117efd0944e3',
        rail: '93f54403e1c17c06cb6afd96ceb474cc368e28768a86173a6eb233c4e684426b',
        agitator: '8bc8d59be3ab332a28623af01893d29b651dc6c9c743d70e0567c5d112fc36b0',
    };
    for (const kind of Object.keys(hashes) as (keyof typeof hashes)[]) {
        assert.equal(createHash('sha256').update(JSON.stringify(FOE_FRAMES[kind])).digest('hex'), hashes[kind]);
        for (const phase of ['walk', 'warning', 'attack', 'rest', 'recoil', 'stunned']) for (const time of [0, 260, 520, 1399]) {
            assert.strictEqual(foeFrame(kind, phase, time, false, true), foeFrame(kind, phase, time, false));
        }
    }
});

test('WorldArt connects the current motion preference and preserves warning progress, facing and entity state', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
    const media = { matches: true };
    Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: () => media });
    try {
        const art = new WorldArt(), e = charger();
        e.phase = 'warning'; e.timer = 400;
        for (const facing of [-1, 1]) {
            e.facing = facing;
            const rendered = capture(art, e);
            assert.strictEqual(rendered.frame, FOE_FRAMES.charger[5]);
            assert.equal(rendered.flip, facing > 0);
            assert.equal(rendered.x, e.x + e.width / 2 - 18);
            assert.equal(rendered.y, e.y + e.height - 36);
            assert.ok(rendered.rectangles.some(r => r.y === e.y + e.height - 36 - 4 && r.w === Math.round(e.width * .5) && r.color === '#edbb68'),
                'The existing warning progress bar still advances in reduced motion.');
        }
        media.matches = false;
        assert.strictEqual(capture(art, e).frame, FOE_FRAMES.charger[4], 'A live preference change is read on the next render.');
        e.phase = 'rest'; e.timer = 1200;
        assert.strictEqual(capture(art, e).frame, FOE_FRAMES.charger[11]);
    } finally {
        if (descriptor) Object.defineProperty(globalThis, 'matchMedia', descriptor);
        else Reflect.deleteProperty(globalThis, 'matchMedia');
    }
});

test('rendering leaves the exact warning, charge and recovery durations and stomp rules unchanged', () => {
    const level = {
        worldToCol: (x: number) => Math.floor(x / 16), worldToRow: (y: number) => Math.floor(y / 16), getTile: () => 1,
        resolveCollision: (r: Rect, v: { x: number; y: number }) => ({ position: { x: r.x + v.x, y: r.y }, velocity: { x: v.x, y: 0 } }),
    } as unknown as WorldLevel;
    const e = charger(), art = new WorldArt(), objects = new WorldObjects([]), player = { x: 40, y: 200, width: 14, height: 24 };
    e.update(0, level, objects, player);
    for (const [dt, phase, timer] of [[799, 'warning', 799], [1, 'attack', 0], [719, 'attack', 719], [1, 'rest', 0], [1399, 'rest', 1399], [1, 'walk', 0]] as const) {
        e.update(dt, level, objects, player);
        assert.equal(e.phase, phase); assert.equal(e.timer, timer);
        capture(art, e);
        assert.equal(e.width, 25); assert.equal(e.height, 27); assert.equal(e.hp, 1);
    }
    for (const phase of ['warning', 'attack', 'rest'] as FoePhase[]) {
        const foe = charger(); foe.phase = phase;
        const above = { x: foe.x + 4, y: foe.y - 10, width: 14, height: 24 };
        const previous = { ...above, y: foe.y - 25 };
        assert.equal(foe.contact(above, previous, true, false), phase === 'rest' ? 'kill' : 'bounce');
        const side = charger(); side.phase = phase;
        assert.equal(side.contact({ x: side.x, y: side.y, width: 14, height: 24 }, previous, false, false), 'hurt',
            'The tired pose invites a stomp; side contact is still hazardous.');
    }
});

test('charger warning meter clears every brace pose while other enemy cue anchors stay unchanged', () => {
    const art = new WorldArt(), e = charger(); e.phase = 'warning';
    for (const time of [0, 260, 520, 799]) for (const facing of [-1, 1]) {
        e.timer = time; e.facing = facing;
        const rendered = capture(art, e);
        const top = rendered.y + rendered.frame.findIndex(row => /[^_]/.test(row));
        const meter = rendered.rectangles.find(r => r.color === '#3c344c')!;
        assert.ok(meter.y + meter.h < top, `Meter overlaps the brace at ${time} ms.`);
    }
    for (const kind of ['helmet', 'loader', 'rail', 'agitator'] as const) {
        const other = new WorldFoe({ id: kind, kind, x: 120, y: 224 }); other.phase = 'warning';
        const rendered = capture(art, other);
        assert.equal(rendered.rectangles.find(r => r.color === '#3c344c')!.y, other.y - 4);
    }
});
