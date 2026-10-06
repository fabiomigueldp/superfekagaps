import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldGame } from '../src/adventure/WorldGame';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { GP_WINDUP_MS, PLAYER_RESPAWN_REVEAL_MS, TileType } from '../src/constants';
import { Player } from '../src/entities/Player';
import { GroundPoundState, type InputState } from '../src/types';
import { Level } from '../src/world/Level';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

const DT = 1000 / 60;
const idle: InputState = { left: false, right: false, jump: false, run: false, down: false,
    start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
const down = { ...idle, down: true, downPressed: true };

function floor(tile = TileType.GROUND) {
    return new Level({ id: 'spawn-support', name: 'Spawn support', width: 30, height: 15,
        tiles: Array.from({ length: 15 }, (_, row) => Array<number>(30).fill(row === 10 ? tile : TileType.EMPTY)),
        playerSpawn: { x: 5, y: 10 }, enemies: [], collectibles: [], triggers: [], checkpoints: [],
        goalPosition: { x: 28, y: 10 }, timeLimit: 180, isBossLevel: false });
}

for (const entry of ['construction', 'reset', 'respawn'] as const) {
    for (const tile of [TileType.GROUND, TileType.PLATFORM]) test(`${entry}: down cannot pound from an unsimulated supported spawn (${tile})`, () => {
        const player = new Player(5, 10), level = floor(tile);
        if (entry === 'reset') player.reset(5, 10);
        if (entry === 'respawn') {
            player.die('fall'); player.respawn({ x: 5, y: 10 });
            player.update(PLAYER_RESPAWN_REVEAL_MS, idle, level);
        }
        assert.equal(player.data.isGrounded, false, 'The frozen arrival must not pretend that collision has run.');
        const spawn = player.getRect();
        const result = player.update(DT, down, level);
        assert.equal(result.groundPoundStarted, false, 'Ground pound requires leaving the floor first.');
        assert.equal(player.data.groundPoundState, GroundPoundState.NONE);
        assert.equal(player.data.isGrounded, true);
        assert.deepEqual(player.getRect(), spawn);
        assert.equal(result.groundPoundImpact, null);
    });
}

test('World moving support also prevents a grounded spawn pound without changing its body', () => {
    const level = new WorldLevel(floor(TileType.EMPTY).data);
    const objects = new WorldObjects([{ id: 'spawn-dock', kind: 'lift', x: 64, y: 160,
        width: 64, height: 8, to: { x: 64, y: 80 }, gated: true }]);
    level.bodies = objects.bodies;
    const before = structuredClone(objects.bodies), player = new Player(5, 10);
    assert.equal(player.update(DT, down, level).groundPoundStarted, false);
    assert.equal(player.data.isGrounded, true);
    assert.deepEqual(objects.bodies, before);
});

for (const height of [1, 32]) test(`a genuinely airborne restart ${height}px above support still begins its pound immediately`, () => {
    const player = new Player(5, 10), level = floor();
    player.respawn({ x: 5, y: 10 - height / 16 });
    player.update(PLAYER_RESPAWN_REVEAL_MS, idle, level);
    const spawn = player.getRect();
    assert.equal(player.update(DT, down, level).groundPoundStarted, true);
    assert.equal(player.data.groundPoundState, GroundPoundState.WINDUP);
    assert.equal(player.data.groundPoundTimer, GP_WINDUP_MS - DT);
    assert.deepEqual(player.getRect(), spawn, 'The original airborne windup still holds position.');
});

for (const kind of ['hit', 'fall'] as const) for (const control of ['keyboard', 'touch', 'action source'] as const)
    test(`World ${kind} checkpoint retry: first-step ${control} down cannot manufacture an airborne attack`, t => {
        const h = sceneLifecycleBrowser(t), game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
        t.after(() => game.dispose());
        game.load('1-1'); game.audio.enabled = false;
        const cp = game.stage.checkpoints[0];
        game.player.data.position = { x: cp.x * 16, y: cp.y * 16 - game.player.data.height };
        game.update(DT);
        assert.equal(game.store.save.checkpoint?.index, 0);
        const source = game.input.createActionSource();
        const finger = { identifier: 7, target: h.canvas, clientX: 320, clientY: 330 };
        function pressDown() {
            if (control === 'keyboard') h.key('keydown', 'ArrowDown');
            else if (control === 'touch') h.canvas.dispatch('touchstart', { touches: [finger], changedTouches: [finger] });
            else source.press('down');
        }
        function releaseDown() {
            if (control === 'keyboard') h.key('keyup', 'ArrowDown');
            else if (control === 'touch') h.canvas.dispatch('touchend', { touches: [], changedTouches: [finger] });
            else source.release();
        }
        for (let attempt = 0; attempt < 2; attempt++) {
            h.key('keydown', ' '); game.update(DT); h.key('keyup', ' ');
            pressDown(); game.update(DT); releaseDown();
            assert.equal(game.player.data.groundPoundState, GroundPoundState.WINDUP);
            const oldPlayer = game.player;
            oldPlayer.die(kind);
            game.state = 'paused';
            const frozenDeath = structuredClone(oldPlayer.data);
            game.update(500); assert.deepEqual(oldPlayer.data, frozenDeath);
            game.state = 'playing'; game.update(oldPlayer.data.deathTimerMax);
            assert.notEqual(game.player, oldPlayer);
            const player = game.player, spawn = player.getRect(), save = structuredClone(game.store.save);
            assert.equal(player.data.groundPoundState, GroundPoundState.NONE);
            game.update(200);
            game.state = 'paused';
            const frozenReveal = structuredClone(player.data);
            game.update(500); assert.deepEqual(player.data, frozenReveal);
            game.state = 'playing'; game.update(PLAYER_RESPAWN_REVEAL_MS - 200);
            assert.equal(player.data.respawnRevealTimer, 0);
            assert.equal(player.data.isGrounded, false);
            assert.deepEqual(player.getRect(), spawn);
            pressDown(); game.update(DT); releaseDown();
            assert.equal(game.input.getState().downPressed, true, 'The real input edge reached the first playable step.');
            assert.equal(player.data.groundPoundState, GroundPoundState.NONE);
            assert.equal(player.data.isGrounded, true);
            assert.deepEqual(player.getRect(), spawn);
            assert.equal(player.data.invincibleTimer, 1500 - DT, 'Keep the native protection window.');
            for (let frame = 0; frame < 12; frame++) game.update(DT);
            assert.equal(player.data.groundPoundState, GroundPoundState.NONE, 'No delayed phantom pound or impact.');
            assert.deepEqual(game.store.save, save);
        }
        source.dispose();
    });
