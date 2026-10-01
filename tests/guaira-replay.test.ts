import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { guairaBrowser } from './helpers/guairaLabHarness';
import { BULL_RULES } from '../src/adventure/experimental/guaira/SkeletonBullModel';
import { GuairaBullEncounter } from '../src/adventure/experimental/guaira/GuairaBullLab';

const recording = JSON.parse(readFileSync(new URL('./helpers/guairaLabReplay.json', import.meta.url), 'utf8')) as {
    stepMs: number; frames: number; runs: Array<[number, string[]]>; expectedHits: Array<{ frame: number; health: number }>;
};

test('frozen ordinary keys win deterministically through real Input, Player and WorldGame with helmet intact', t => {
    const h = guairaBrowser(t), game = h.create();
    function replay() {
        game.load('guaira-lab'); let held = new Set<string>(), frame = 0, health = 6;
        const hits: Array<{ frame: number; health: number }> = [], states = new Set<string>();
        for (const [count, keys] of recording.runs) for (let n = 0; n < count; n++, frame++) {
            const next = new Set(keys);
            for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { key: code === 'Space' ? ' ' : code, code, target: h.canvas });
            for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { key: code === 'Space' ? ' ' : code, code, target: h.canvas });
            held = next; game.update(recording.stepMs);
            const b = (game.boss as GuairaBullEncounter).model; states.add(b.state);
            assert.equal(game.player.data.isDead, false, `Unexpected death on frame ${frame}`);
            assert.equal(game.player.data.hasHelmet, true, `Unexpected contact on frame ${frame}`);
            assert.equal(game.camera.x, 0); assert.equal(game.camera.y, 64);
            if (b.health !== health) { hits.push({ frame, health: b.health }); health = b.health; }
        }
        assert.equal(frame, recording.frames); assert.deepEqual(hits, recording.expectedHits);
        assert.equal(game.boss?.phase, 'defeated'); assert.equal(game.boss?.health, 0);
        for (const state of ['tell', 'charge', 'brake', 'rattle', 'bones', 'recover']) assert.ok(states.has(state), state);
        assert.deepEqual(game.store.save.completed, []);
        return { hits, player: structuredClone(game.player.data), boss: structuredClone((game.boss as GuairaBullEncounter).model) };
    }
    assert.deepEqual(replay(), replay());
});

for (const side of ['left', 'right'] as const) test(`ordinary corner camping at the ${side} edge loses helmet and then dies`, t => {
    const h = guairaBrowser(t), game = h.create(); let entryJump = -100, cornerFrames = 0;
    const code = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
    h.window.dispatch('keydown', { key: code, code, target: h.canvas });
    h.window.dispatch('keydown', { key: 'Shift', code: 'ShiftLeft', target: h.canvas });
    let hitState = '';
    for (let frame = 0; frame < 1600 && !game.player.data.isDead; frame++) {
        const p = game.player.data;
        if (side === 'right' && entryJump === -100 && p.position.x > 190 && p.isGrounded) {
            entryJump = frame; h.window.dispatch('keydown', { key: ' ', code: 'Space', target: h.canvas });
        }
        if (frame - entryJump === 9) h.window.dispatch('keyup', { key: ' ', code: 'Space', target: h.canvas });
        game.update(BULL_RULES.tickMs);
        if (side === 'left' ? p.position.x === 0 : p.position.x + p.width === 320) cornerFrames++;
        if (!p.hasHelmet) hitState = (game.boss as GuairaBullEncounter).model.state;
    }
    assert.ok(cornerFrames > 60); assert.equal(game.player.data.hasHelmet, false);
    assert.equal(game.player.data.isDead, true); assert.equal(hitState, 'bones');
    assert.equal(game.boss?.health, 6); assert.deepEqual(game.store.save.completed, []);
});

for (const [state, facing, bx, px] of [
    ['charge', -1, 100, 144], ['brake', -1, 21, 65],
    ['charge', 1, 95, 85], ['brake', 1, 251, 241],
] as const) test(`real falling top safely bounces from trailing sweep: ${state}/${facing}`, t => {
    const h = guairaBrowser(t), game = h.create(), b = (game.boss as GuairaBullEncounter).model;
    b.state = 'charge'; b.facing = facing; b.x = bx;
    game.player.data.position = { x: px, y: 166 }; game.player.data.velocity = { x: 0, y: 6 };
    game.player.data.isGrounded = false;
    game.update(BULL_RULES.tickMs);
    assert.equal(b.state, state); assert.equal(b.health, 6);
    assert.equal(game.player.data.hasHelmet, true); assert.equal(game.player.data.isDead, false);
    assert.ok(game.player.data.velocity.y < 0, 'The real WorldGame bounce resolves the swept top.');
});

for (const side of ['left', 'right'] as const) for (const opening of ['brake', 'recover'] as const)
    for (const pound of [false, true]) test(`ordinary ${pound ? 'sentada' : 'jump'} reaches ${opening} from ${side} edge`, t => {
        const h = guairaBrowser(t), game = h.create(), b = (game.boss as GuairaBullEncounter).model;
        b.state = opening; b.x = side === 'left' ? 16 : 256;
        game.player.data.position = { x: side === 'left' ? 0 : 306, y: 200 };
        game.player.data.isGrounded = true;
        const direction = side === 'left' ? 'ArrowRight' : 'ArrowLeft';
        const key = (code: string, down: boolean) => h.window.dispatch(down ? 'keydown' : 'keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        key(direction, true); key('Space', true);
        for (let frame = 0; frame < 72 && b.health === 6; frame++) {
            if (frame === 9) key('Space', false);
            if (frame === 13) key(direction, false);
            if (pound && frame === 18) key('ArrowDown', true);
            if (pound && frame === 19) key('ArrowDown', false);
            game.update(BULL_RULES.tickMs);
        }
        assert.equal(b.health, 5); assert.equal(game.player.data.hasHelmet, true); assert.equal(game.player.data.isDead, false);
    });
