import assert from 'node:assert/strict';
import test from 'node:test';
import { Renderer } from '../src/engine/Renderer';
import { WorldGame } from '../src/adventure/WorldGame';
import { guairaBrowser } from './helpers/guairaLabHarness';
import { Player } from '../src/entities/Player';
import { Level } from '../src/world/Level';
import { PLAYER_PALETTE, PLAYER_SPRITES } from '../src/assets/playerSpriteSpec';
import { ART } from '../src/graphics/palette';
import { drawPlayerProtection } from '../src/graphics/playerProtectionArt';
import { animationIndex, type PixelFrame } from '../src/graphics/pixels';
import { TileType } from '../src/constants';
import { GroundPoundState, type CameraData, type InputState, type PlayerData } from '../src/types';

type Paint = [number, number, number, number, string, number];
function painter(reducedMotion: boolean) {
    const paints: Paint[] = [], stack: Array<[string, number]> = [];
    const calls: { frame: PixelFrame; x: number; y: number; flip: boolean; tint?: string }[] = [];
    const c = { fillStyle: 'original', globalAlpha: .75,
        save() { stack.push([this.fillStyle, this.globalAlpha]); },
        restore() { [this.fillStyle, this.globalAlpha] = stack.pop()!; },
        fillRect(x: number, y: number, w: number, h: number) { paints.push([x, y, w, h, this.fillStyle, this.globalAlpha]); }
    };
    const renderer = Object.create(Renderer.prototype) as Renderer, motion = { matches: reducedMotion };
    Object.assign(renderer, { clock: { time: 0 }, landingMotion: motion, offscreenCtx: c, interpolationMs: 0, zoom: 1,
        atlas: { draw(_c: unknown, frame: PixelFrame, palette: unknown, x: number, y: number, flip: boolean, _scale: unknown, tint?: string) {
            assert.equal(palette, PLAYER_PALETTE); calls.push({ frame, x, y, flip, tint });
        } } });
    return { renderer, calls, paints, c, motion, draw(p: PlayerData) {
        paints.length = 0; calls.length = 0;
        const before = structuredClone(p); renderer.drawPlayer(p, { x: 8, y: 4 } as CameraData);
        assert.deepEqual(p, before, 'Presentation cannot alter protection, equipment, position, velocity, or any other player state.');
        assert.equal(c.globalAlpha, .75);
    } };
}
const idle: InputState = { left: false, right: false, jump: false, run: false, down: false,
    start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
function floor() {
    return new Level({ id: 'protection', name: 'Protection', width: 60, height: 26,
        tiles: Array.from({ length: 26 }, (_, y) => Array<number>(60).fill(y >= 20 ? TileType.GROUND : TileType.EMPTY)),
        playerSpawn: { x: 5, y: 20 }, enemies: [], collectibles: [], triggers: [], checkpoints: [],
        goalPosition: { x: 58, y: 20 }, timeLimit: 180, isBossLevel: false });
}

test('reduced-motion helmet loss keeps a colored body and stationary protection through every old flash phase', () => {
    const player = new Player(5, 20), h = painter(true);
    player.update(1000 / 60, idle, floor()); player.data.hasHelmet = true;
    h.draw(player.data); assert.equal(h.calls.length, 2); assert.equal(h.paints.length, 2);
    assert.deepEqual(player.takeDamage(), { damaged: false, helmetUsed: true });
    assert.equal(player.data.invincibleTimer, 1000); assert.equal(player.data.hasHelmet, false);
    let previous: Paint[] | undefined;
    for (const remaining of [1000, 990, 901, 900, 899, 811, 810, 809, 180, 90, 89, 1]) {
        player.data.invincibleTimer = remaining; h.draw(player.data);
        assert.equal(h.calls.length, 1, 'The absorbed helmet must immediately disappear.');
        assert.equal(h.calls[0].tint, undefined, 'No white-body flash under reduced motion.');
        assert.equal(h.paints.length, 14, 'Shadow plus stationary protection brackets.');
        if (previous) assert.deepEqual(h.paints, previous, 'Remaining time cannot pulse or animate the protection cue.');
        previous = [...h.paints];
        assert.deepEqual(player.takeDamage(), { damaged: false, helmetUsed: false });
    }
    player.data.invincibleTimer = 0; h.draw(player.data);
    assert.equal(h.paints.length, 2, 'The cue vanishes exactly when vulnerability returns.');
    assert.deepEqual(player.takeDamage(), { damaged: true, helmetUsed: false });
});

test('normal damage tint, facing, poses, equipment, and live preference changes retain existing priorities', () => {
    const h = painter(false), p = new Player(3, 10).data;
    p.isGrounded = true; p.hasHelmet = true;
    for (const facingRight of [false, true]) for (const remaining of [1000, 901, 900, 180, 90, 89, 1, 0]) {
        Object.assign(p, { facingRight, invincibleTimer: remaining }); h.draw(p);
        const calls = structuredClone(h.calls);
        assert.equal(h.calls[0].tint, remaining > 0 && animationIndex(remaining, 2, 90) === 1 ? ART.paper : undefined);
        assert.equal(h.calls[1].tint, undefined); assert.equal(h.calls[1].frame, PLAYER_SPRITES.helmet);
        assert.equal(h.paints.length, 2);
        h.motion.matches = true; h.draw(p);
        assert.deepEqual(h.calls.map(call => ({ ...call, tint: undefined })), calls.map(call => ({ ...call, tint: undefined })));
        assert.equal(h.calls[0].tint, undefined); assert.equal(h.paints.length, remaining > 0 ? 14 : 2);
        h.motion.matches = false; h.draw(p); assert.deepEqual(h.calls, calls);
    }
    p.hasHelmet = false; p.invincibleTimer = 500; h.motion.matches = true;
    for (const [state, frame] of [[GroundPoundState.WINDUP, PLAYER_SPRITES.windup], [GroundPoundState.FALL, PLAYER_SPRITES.sit], [GroundPoundState.RECOVERY, PLAYER_SPRITES.sit]] as const) {
        p.groundPoundState = state; h.draw(p); assert.equal(h.calls[0].frame, frame); assert.equal(h.calls[0].tint, undefined);
    }
    p.groundPoundState = GroundPoundState.NONE; p.isGrounded = false;
    for (const [vy, frame] of [[-1, PLAYER_SPRITES.jump], [1, PLAYER_SPRITES.fall]] as const) {
        p.velocity.y = vy; h.draw(p); assert.equal(h.calls[0].frame, frame); assert.equal(h.paints.length, 12);
    }
});

test('protection art stays outside the body, uses integer pixels, and restores canvas state', () => {
    const h = painter(true);
    drawPlayerProtection(h.c as unknown as CanvasRenderingContext2D, 10.4, 20.4);
    assert.equal(h.c.fillStyle, 'original'); assert.equal(h.c.globalAlpha, .75);
    assert.equal(h.paints.length, 12);
    for (const [x, y, w, height, , alpha] of h.paints) {
        assert.ok([x, y, w, height].every(Number.isInteger));
        assert.ok(x + w <= 3 || x >= 17, 'No mark can cover the 16 px body.');
        assert.equal(alpha, .75);
    }
});

for (const reducedMotion of [false, true]) test(`drawing protected movement repeatedly is simulation-neutral and expires at native damage boundary (${reducedMotion})`, () => {
    const rendered = new Player(5, 20), control = new Player(5, 20), h = painter(reducedMotion), level = floor();
    for (const p of [rendered, control]) { p.update(1000 / 60, idle, level); p.data.hasHelmet = true; p.takeDamage(); }
    const input = { ...idle, right: true, jump: true, jumpPressed: true };
    for (let i = 0; i < 100; i++) {
        const dt = 10;
        const expected = control.update(dt, input, level);
        assert.deepEqual(rendered.update(dt, input, level), expected);
        input.jumpPressed = false; if (i === 12) { input.jump = false; input.jumpReleased = true; } else input.jumpReleased = false;
        h.draw(rendered.data); const paints = [...h.paints], calls = [...h.calls];
        for (let repeat = 0; repeat < 3; repeat++) { h.draw(rendered.data); assert.deepEqual(h.paints, paints); assert.deepEqual(h.calls, calls); }
        assert.deepEqual(rendered.data, control.data, 'Render frequency and reduced-motion setting cannot affect the simulation.');
        assert.deepEqual(rendered.takeDamage(), control.takeDamage());
        assert.equal(rendered.data.invincibleTimer, 990 - i * 10);
    }
    assert.equal(rendered.data.invincibleTimer, 0);
    assert.deepEqual(rendered.takeDamage(), { damaged: true, helmetUsed: false });
    assert.ok(!h.paints.some(paint => paint[4] === ART.tealLight));
});

for (const kind of ['hit', 'fall'] as const) test(`death takes precedence over any leftover protection (${kind})`, () => {
    const p = new Player(5, 20), h = painter(true);
    p.data.invincibleTimer = 900; p.die(kind); h.draw(p.data);
    assert.ok(!h.paints.some(paint => paint[4] === ART.tealLight));
    assert.equal(h.calls.length, kind === 'hit' ? 1 : 0);
    if (kind === 'hit') assert.equal(h.calls[0].frame, PLAYER_SPRITES.deathImpact);
});

for (const reducedMotion of [false, true]) test(`native campaign pause holds helmet-loss protection and resumes at the same expiry (${reducedMotion})`, t => {
    const browser = guairaBrowser(t, { reducedMotion }), game = new WorldGame(browser.canvas as unknown as HTMLCanvasElement, true);
    game.load('1-1', false); game.audio.enabled = false;
    for (let i = 0; i < 8; i++) game.update(1000 / 60);
    game.player.data.hasHelmet = true;
    assert.deepEqual(game.player.takeDamage(), { damaged: false, helmetUsed: true });
    const h = painter(reducedMotion); h.draw(game.player.data);
    const saved = structuredClone({ player: game.player.data, save: game.store.save }), paints = [...h.paints], calls = [...h.calls];
    game.state = 'paused'; game.update(500); game.render(); h.draw(game.player.data);
    assert.deepEqual({ player: game.player.data, save: game.store.save }, saved);
    assert.deepEqual(h.paints, paints); assert.deepEqual(h.calls, calls);
    game.state = 'playing';
    for (let i = 0; i < 99; i++) game.update(10);
    game.update(9); h.draw(game.player.data);
    assert.equal(game.player.data.invincibleTimer, 1);
    assert.equal(h.paints.some(paint => paint[4] === ART.tealLight), reducedMotion);
    assert.deepEqual(game.player.takeDamage(), { damaged: false, helmetUsed: false });
    game.update(1); h.draw(game.player.data);
    assert.equal(game.player.data.invincibleTimer, 0);
    assert.ok(!h.paints.some(paint => paint[4] === ART.tealLight));
    assert.deepEqual(game.player.takeDamage(), { damaged: true, helmetUsed: false });
});
