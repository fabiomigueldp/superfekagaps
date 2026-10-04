import assert from 'node:assert/strict';
import test from 'node:test';
import { Renderer } from '../src/engine/Renderer';
import { Player } from '../src/entities/Player';
import { PLAYER_PALETTE, PLAYER_SPRITES, PLAYER_WALK } from '../src/assets/playerSpriteSpec';
import { GroundPoundState, type PlayerData } from '../src/types';
import type { PixelFrame } from '../src/graphics/pixels';

function painter(reducedMotion = false) {
    const calls: { frame: PixelFrame; x: number; y: number; flip: boolean; tint?: string }[] = [];
    const rectangles: number[][] = [];
    const context = { globalAlpha: 1, fillStyle: '', save() {}, restore() {},
        fillRect(...args: number[]) { rectangles.push(args); } } as unknown as CanvasRenderingContext2D;
    const motion = { matches: reducedMotion }, renderer = Object.create(Renderer.prototype) as Renderer;
    Object.assign(renderer, { clock: { time: 0 }, landingMotion: motion, offscreenCtx: context,
        atlas: { draw(_c: unknown, frame: PixelFrame, _palette: unknown, x: number, y: number, flip: boolean, _scale: unknown, tint?: string) {
            calls.push({ frame, x, y, flip, tint });
        } } });
    return { calls, rectangles, motion, draw(p: PlayerData) { calls.length = 0; rectangles.length = 0; renderer.drawPlayer(p, { x: 8, y: 4 } as any); } };
}
function player() {
    const p = new Player(3, 10).data;
    Object.assign(p, { isGrounded: true, landingTimer: 90 });
    return p;
}

test('ordinary landing bends two pixels, settles one, and keeps both planted soles', () => {
    const frames = [PLAYER_SPRITES.land, PLAYER_SPRITES.landSettle, PLAYER_SPRITES.idle];
    assert.equal(new Set(frames.map(frame => frame.join(''))).size, 3);
    for (const [index, frame] of frames.entries()) {
        assert.equal(frame.length, 26);
        assert.ok(frame.every(row => row.length === 16 && [...row].every(symbol => symbol in PLAYER_PALETTE)));
        assert.equal(frame.findIndex(row => /[^_]/.test(row)), [2, 1, 0][index]);
        for (const flip of [false, true]) {
            const sole = flip ? [...frame[25]].reverse().join('') : frame[25];
            const idleSole = flip ? [...PLAYER_SPRITES.idle[25]].reverse().join('') : PLAYER_SPRITES.idle[25];
            assert.equal(sole, idleSole);
        }
    }
    assert.notDeepEqual(PLAYER_SPRITES.land, PLAYER_SPRITES.sit, 'ordinary contact is distinct from ground pound');
});

test('landing keeps render coordinates, helmet attachment, and boost silhouette at every phase and facing', () => {
    const h = painter(), p = player();
    for (const facingRight of [true, false]) for (const helmet of [true, false]) for (const boost of [0, 800]) {
        Object.assign(p, { facingRight, hasHelmet: helmet, miniFantaTimer: boost });
        for (const [timer, frame, head] of [[90, PLAYER_SPRITES.land, 2], [45, PLAYER_SPRITES.landSettle, 1], [1, PLAYER_SPRITES.landSettle, 1], [0, PLAYER_SPRITES.idle, 0]] as const) {
            p.landingTimer = timer;
            const before = structuredClone(p); h.draw(p);
            assert.equal(h.calls[0].frame, frame);
            assert.deepEqual([h.calls[0].x, h.calls[0].y, h.calls[0].flip], [39, 130, !facingRight]);
            assert.deepEqual(h.rectangles.slice(0, 2), [[42, 155, 12, 2], [44, 154, 8, 1]], 'same contact shadow');
            if (helmet) assert.deepEqual([h.calls[1].frame, h.calls[1].x, h.calls[1].y], [PLAYER_SPRITES.helmet, 39, 128 + head]);
            assert.deepEqual(p, before, 'rendering cannot alter player state');
        }
    }
});

test('reduced motion stays upright and a live preference change neither mutates nor restarts landing', () => {
    const h = painter(true), p = player();
    p.hasHelmet = true;
    for (const timer of [90, 45, 1]) {
        p.landingTimer = timer; h.draw(p);
        assert.equal(h.calls[0].frame, PLAYER_SPRITES.idle);
        assert.equal(h.calls[1].y, 128);
    }
    p.landingTimer = 30; h.motion.matches = false; h.draw(p);
    assert.equal(h.calls[0].frame, PLAYER_SPRITES.landSettle);
    h.motion.matches = true; h.draw(p);
    assert.equal(h.calls[0].frame, PLAYER_SPRITES.idle);
    assert.equal(p.landingTimer, 30);
});

test('airborne, ground-pound, movement and damage priorities keep their existing authored frames', () => {
    const h = painter(), p = player();
    for (const [state, frame] of [[GroundPoundState.WINDUP, PLAYER_SPRITES.windup], [GroundPoundState.FALL, PLAYER_SPRITES.sit], [GroundPoundState.RECOVERY, PLAYER_SPRITES.sit]] as const) {
        p.groundPoundState = state; h.draw(p); assert.equal(h.calls[0].frame, frame);
    }
    p.groundPoundState = GroundPoundState.NONE; p.isGrounded = false;
    for (const [vy, frame] of [[-1, PLAYER_SPRITES.jump], [1, PLAYER_SPRITES.fall]] as const) {
        p.velocity.y = vy; h.draw(p); assert.equal(h.calls[0].frame, frame);
    }
    p.isGrounded = true; p.landingTimer = 0; p.velocity.x = 2; p.animationTimer = 100;
    h.draw(p); assert.equal(h.calls[0].frame, PLAYER_WALK[1]);
    p.landingTimer = 90; p.invincibleTimer = 91; h.draw(p);
    assert.equal(h.calls[0].frame, PLAYER_SPRITES.land); assert.ok(h.calls[0].tint);
});
