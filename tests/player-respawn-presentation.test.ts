import assert from 'node:assert/strict';
import test from 'node:test';
import { Renderer } from '../src/engine/Renderer';
import { Player } from '../src/entities/Player';
import { WorldGame } from '../src/adventure/WorldGame';
import { PLAYER_PALETTE, PLAYER_SPRITES } from '../src/assets/playerSpriteSpec';
import { PLAYER_RESPAWN_REVEAL_MS } from '../src/constants';
import { drawRespawnArrival } from '../src/graphics/playerRespawnArt';
import { ART } from '../src/graphics/palette';
import type { PixelFrame } from '../src/graphics/pixels';
import { GroundPoundState, type CameraData, type InputState, type PlayerData } from '../src/types';
import { guairaBrowser } from './helpers/guairaLabHarness';

type Paint = [number, number, number, number, string, number];
function recordingContext() {
    const paints: Paint[] = [], stack: Array<[string, number]> = [];
    const c = { fillStyle: 'original', globalAlpha: .75,
        save() { stack.push([this.fillStyle, this.globalAlpha]); },
        restore() { [this.fillStyle, this.globalAlpha] = stack.pop()!; },
        fillRect(x: number, y: number, w: number, h: number) { paints.push([x, y, w, h, this.fillStyle, this.globalAlpha]); }
    };
    return { c: c as unknown as CanvasRenderingContext2D, paints };
}
function painter(reducedMotion: boolean) {
    const { c, paints } = recordingContext();
    const calls: { frame: PixelFrame; x: number; y: number; flip: boolean; tint?: string }[] = [];
    const renderer = Object.create(Renderer.prototype) as Renderer, motion = { matches: reducedMotion };
    Object.assign(renderer, { clock: { time: 3300 }, landingMotion: motion, offscreenCtx: c, interpolationMs: 0, zoom: 1,
        atlas: { draw(_c: unknown, frame: PixelFrame, palette: unknown, x: number, y: number, flip: boolean, _scale: unknown, tint?: string) {
            assert.equal(palette, PLAYER_PALETTE); calls.push({ frame, x, y, flip, tint });
        } } });
    return { renderer, calls, paints, motion, draw(p: PlayerData) {
        calls.length = 0; paints.length = 0; const before = structuredClone(p);
        renderer.drawPlayer(p, { x: 8, y: 4 } as CameraData);
        assert.deepEqual(p, before, 'Presentation cannot change any timer, physics flag, equipment or position.');
    } };
}
const idle: InputState = { left: false, right: false, jump: false, run: false, down: false,
    start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };

for (const reducedMotion of [false, true]) test(`a frozen respawn presents an upright body without changing support or helmet alignment (${reducedMotion})`, () => {
    const player = new Player(3, 10), h = painter(reducedMotion);
    player.die(); player.respawn({ x: 3, y: 10 });
    assert.equal(player.data.isGrounded, false);
    for (const facingRight of [false, true]) for (const hasHelmet of [false, true])
        for (const remaining of [PLAYER_RESPAWN_REVEAL_MS, 210, 1]) {
            Object.assign(player.data, { facingRight, hasHelmet, respawnRevealTimer: remaining });
            h.draw(player.data);
            assert.deepEqual(h.calls[0], { frame: PLAYER_SPRITES.idle, x: 39, y: 130, flip: !facingRight, tint: undefined });
            if (hasHelmet) assert.deepEqual(h.calls[1], { frame: PLAYER_SPRITES.helmet, x: 39, y: 128, flip: !facingRight, tint: undefined });
            assert.equal(player.data.isGrounded, false);
        }
    h.motion.matches = !reducedMotion; h.draw(player.data);
    assert.equal(h.calls[0].frame, PLAYER_SPRITES.idle, 'A live preference change must not restart or interrupt the arrival pose.');
    player.die('hit'); h.draw(player.data);
    assert.equal(h.calls[0].frame, PLAYER_SPRITES.deathImpact, 'Death retains precedence even with a stale reveal timer.');
    player.data.deathKind = 'fall'; h.draw(player.data); assert.equal(h.calls.length, 0);
});

test('reduced-motion arrival marks stay stationary, outside the body, and preserve the canvas state', () => {
    const h = recordingContext(); let previous: Paint[] | undefined;
    for (const progress of [0, .1, .5, .95, 1]) {
        h.paints.length = 0; drawRespawnArrival(h.c, 10.4, 20.4, progress, true);
        assert.equal(h.c.fillStyle, 'original'); assert.equal(h.c.globalAlpha, .75);
        if (previous) assert.deepEqual(h.paints, previous, 'No pulse, orbit, brightness change or progress-driven animation.');
        previous = [...h.paints];
        assert.equal(h.paints.length, 12);
        for (const [x, y, w, height, , alpha] of h.paints) {
            assert.ok([x, y, w, height].every(Number.isInteger));
            assert.ok(x + w <= 3 || x >= 17, 'The marker must not paint over the 16 px player silhouette.');
            assert.equal(alpha, .75);
        }
    }
});

test('ordinary reveal preserves the existing burst exactly', () => {
    for (const progress of [0, .1, .5, .95, 1]) {
        const h = recordingContext(); drawRespawnArrival(h.c, 10, 20, progress);
        const radius = Math.round(4 + 20 * progress), alpha = .75 * Math.sin(Math.PI * progress);
        const expected: Paint[] = Array.from({ length: 8 }, (_, i) => [
            Math.round(10 + Math.cos(i * Math.PI / 4) * radius), Math.round(20 + Math.sin(i * Math.PI / 4) * radius),
            i % 2 ? 2 : 3, 2, i % 2 ? ART.goldLight : ART.paper, alpha]);
        expected.push([10 - radius - 2, 20, 3, 1, ART.tealLight, alpha], [10 + radius, 20, 3, 1, ART.tealLight, alpha],
            [10, 20 - radius - 2, 1, 3, ART.tealLight, alpha], [10, 20 + radius, 1, 3, ART.tealLight, alpha]);
        assert.deepEqual(h.paints, expected);
        assert.equal(h.c.fillStyle, 'original'); assert.equal(h.c.globalAlpha, .75);
    }
});

for (const reducedMotion of [false, true]) for (const kind of ['hit', 'fall'] as const)
    test(`native ${kind} checkpoint retry stays upright through the reveal and releases normal physics (${reducedMotion})`, t => {
        const browser = guairaBrowser(t, { reducedMotion }), game = new WorldGame(browser.canvas as unknown as HTMLCanvasElement, true);
        game.load('1-1', false); game.audio.enabled = false;
        const cp = game.stage.checkpoints[0];
        game.player.data.position = { x: cp.x * 16, y: cp.y * 16 - game.player.data.height };
        game.player.data.isGrounded = true; game.update(1000 / 60);
        assert.equal(game.store.save.checkpoint?.index, 0);
        game.player.die(kind); game.update(game.player.data.deathTimerMax);
        assert.equal(game.player.data.respawnRevealTimer, PLAYER_RESPAWN_REVEAL_MS);
        assert.equal(game.player.data.isGrounded, false);
        const player = game.player, spawn = { ...player.data.position }, protection = player.data.invincibleTimer;
        const h = painter(reducedMotion);
        for (const dt of [0, 210, 209]) {
            if (dt) game.update(dt);
            h.draw(player.data); assert.equal(h.calls[0].frame, PLAYER_SPRITES.idle);
            assert.deepEqual(player.data.position, spawn); assert.equal(player.data.invincibleTimer, protection);
            if (dt === 210) {
                const frozen = structuredClone(player.data), marks = [...h.paints];
                game.state = 'paused'; game.update(500); game.render(); h.draw(player.data);
                assert.deepEqual(player.data, frozen, 'Pause cannot advance the arrival or its protection.');
                assert.deepEqual(h.paints, marks, 'Repeated paused drawing holds the exact arrival cue.');
                game.state = 'playing';
            }
        }
        game.update(1);
        assert.equal(player.data.respawnRevealTimer, 0); assert.deepEqual(player.data.position, spawn);
        h.draw(player.data); assert.equal(h.calls[0].frame, PLAYER_SPRITES.idle, 'The zero-timer frozen boundary cannot flicker back to a fall.');
        assert.equal(h.paints.length, reducedMotion ? 12 : 0, 'The burst ends on time; reduced-motion protection marks continue through the frozen boundary.');
        game.update(1000 / 60); h.draw(player.data);
        assert.equal(player.data.isGrounded, true);
        assert.equal(h.calls[0].frame, reducedMotion ? PLAYER_SPRITES.idle : PLAYER_SPRITES.land, 'Existing first-contact presentation resumes immediately.');
        assert.ok(player.data.invincibleTimer < protection);
        assert.equal(h.paints.length, reducedMotion ? 14 : 2, 'The contact shadow returns; reduced-motion protection marks remain while the player is protected.');
        // A truly airborne restart must use the actual first physics result, without a sticky arrival pose.
        player.respawn({ x: cp.x, y: cp.y - 4 });
        player.update(PLAYER_RESPAWN_REVEAL_MS, { ...idle, right: true }, game.level);
        const suspended = { ...player.data.position };
        h.draw(player.data); assert.equal(h.calls[0].frame, PLAYER_SPRITES.idle); assert.equal(h.paints.length, reducedMotion ? 12 : 0);
        player.update(1000 / 60, { ...idle, right: true }, game.level);
        assert.equal(player.data.isGrounded, false); assert.ok(player.data.position.y > suspended.y);
        assert.ok(player.data.position.x > suspended.x); h.draw(player.data);
        assert.equal(h.calls[0].frame, PLAYER_SPRITES.fall); assert.equal(h.paints.length, reducedMotion ? 12 : 0);
    });

for (const reducedMotion of [false, true]) test(`arrival boundary guard excludes initial spawns and active gameplay (${reducedMotion})`, () => {
    const player = new Player(3, 10), h = painter(reducedMotion);
    h.draw(player.data); assert.equal(h.calls[0].frame, PLAYER_SPRITES.fall, 'Ordinary construction has no reveal history.');
    player.data.invincibleTimer = 1500;
    h.draw(player.data); assert.equal(h.calls[0].frame, PLAYER_SPRITES.fall, 'Protection alone is not arrival history.');
    player.reset(3, 10);
    h.draw(player.data); assert.equal(h.calls[0].frame, PLAYER_SPRITES.fall, 'An unprotected reset is not a respawn.');
    player.data.invincibleTimer = 1500;
    player.data.animationTimer = 1;
    h.draw(player.data); assert.equal(h.calls[0].frame, PLAYER_SPRITES.fall, 'Even the first millisecond of real simulation releases the guard.');
    player.data.animationTimer = 0; player.data.velocity.x = 1;
    h.draw(player.data); assert.equal(h.calls[0].frame, PLAYER_SPRITES.fall);
    player.data.velocity.x = 0; player.data.velocity.y = -1;
    h.draw(player.data); assert.equal(h.calls[0].frame, PLAYER_SPRITES.jump);
    player.data.velocity.y = 0; player.data.groundPoundState = GroundPoundState.WINDUP;
    h.draw(player.data); assert.equal(h.calls[0].frame, PLAYER_SPRITES.windup);
});
