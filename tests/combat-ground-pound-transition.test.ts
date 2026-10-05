import assert from 'node:assert/strict';
import test from 'node:test';
import { ENEMY_SCORE, GameState, GP_FALL_SPEED, PLAYER_JUMP_FORCE, TILE_SIZE, TileType } from '../src/constants';
import { Player } from '../src/entities/Player';
import { Minion } from '../src/entities/enemies/Minion';
import { Game } from '../src/game/Game';
import { TriggerController } from '../src/game/TriggerController';
import { GroundPoundState, type InputState } from '../src/types';
import { Level } from '../src/world/Level';

const DT = 1000 / 60;
const idle: InputState = {
    left: false, right: false, jump: false, run: false, down: false,
    start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false
};

/** Production Game.updatePlaying, Player, Minion and tile collisions; only
 * controller snapshots and rendering/audio devices are replaced. */
function combat(playerFeet: number, enemyX = 5.5) {
    const level = new Level({ id: 'combat-transition', name: 'Combat transition', width: 30, height: 15,
        tiles: Array.from({ length: 15 }, (_, row) => Array<number>(30).fill(row >= 10 ? TileType.GROUND : TileType.EMPTY)),
        playerSpawn: { x: 5, y: playerFeet / TILE_SIZE }, enemies: [], collectibles: [], triggers: [], checkpoints: [],
        goalPosition: { x: 28, y: 10 }, timeLimit: 180, isBossLevel: false });
    const player = new Player(level.data.playerSpawn.x, level.data.playerSpawn.y);
    const minion = new Minion(enemyX, 10), sounds: string[] = [];
    let controls = { ...idle };
    const game = Object.create(Game.prototype) as any;
    Object.assign(game, {
        state: GameState.PLAYING, player, level, minions: [minion], boss: null,
        score: 0, coins: 0, lives: 3, levelTime: 180, totalRunTime: 0, deathTimer: 0,
        collectibles: [], flags: [], particles: [], activeCheckpoint: null,
        triggerController: new TriggerController(), activeCameraOverride: null,
        camera: { x: 0, y: 0, targetX: 0, targetY: 0, shakeTimer: 0, shakeMagnitude: 0, bounds: level.getBounds() },
        input: { consumePause: () => false, getState: () => ({ ...controls }) },
        audio: new Proxy({}, { get: (_target, name) => () => sounds.push(String(name)) }),
        renderer: { addImpact() {} }
    });
    return { game, player, minion, sounds, step(input: Partial<InputState> = {}) {
        controls = { ...idle, ...input };
        game.updatePlaying(DT);
    } };
}

for (const helmet of [false, true]) test(`the first falling step of a ground pound defeats a minion without damage (helmet: ${helmet})`, () => {
    const h = combat(136), { player, minion, game, sounds } = h;
    if (helmet) player.collectHelmet();
    h.step({ down: true, downPressed: true });
    assert.equal(player.data.groundPoundState, GroundPoundState.WINDUP);
    const pausedY = player.data.position.y;
    for (let frame = 0; frame < 8 && player.data.groundPoundTimer > DT; frame++) {
        h.step({ down: true });
        assert.equal(player.data.isDead, false);
        assert.equal(player.data.position.y, pausedY);
        assert.equal(minion.data.isDead, false);
    }
    h.step({ down: true });
    assert.equal(player.getPrevGroundPoundStateForContacts(), GroundPoundState.WINDUP);
    assert.equal(player.getPrevVelocityForContacts().y, 0);
    assert.equal(player.data.isDead, false, 'A valid pound must attack on the WINDUP → FALL step.');
    assert.equal(minion.data.isDead, true);
    assert.equal(player.data.groundPoundState, GroundPoundState.FALL);
    assert.ok(player.data.velocity.y >= GP_FALL_SPEED, 'Pounding a minion keeps the original downward motion.');
    assert.equal(game.score, ENEMY_SCORE);
    assert.equal(player.data.invincibleTimer, 0, 'Do not add protection to hide a misclassified attack.');
    assert.equal(player.data.hasHelmet, helmet, 'A valid attack cannot consume an equipped helmet.');
    assert.equal(sounds.filter(s => s === 'playStomp').length, 1);
    assert.ok(!sounds.includes('playDamage'));
    for (let frame = 0; frame < 3 && !player.data.isGrounded; frame++) h.step({ down: true });
    assert.equal(player.getPrevGroundPoundStateForContacts(), GroundPoundState.FALL);
    assert.equal(player.data.groundPoundState, GroundPoundState.RECOVERY);
    assert.equal(player.data.isGrounded, true);
    assert.equal(game.score, ENEMY_SCORE, 'The landing impact cannot award the same minion twice.');
    assert.equal(sounds.filter(s => s === 'playStomp').length, 1);
});


test('a later falling pound step keeps the existing kill, no-bounce and single-score behavior', () => {
    const h = combat(120);
    h.step({ down: true, downPressed: true });
    for (let frame = 0; frame < 8 && h.player.data.groundPoundState === GroundPoundState.WINDUP; frame++) h.step({ down: true });
    assert.equal(h.player.data.groundPoundState, GroundPoundState.FALL);
    assert.equal(h.minion.data.isDead, false, 'The first fall step is still above this minion.');
    h.step({ down: true });
    assert.equal(h.player.getPrevGroundPoundStateForContacts(), GroundPoundState.FALL);
    assert.equal(h.minion.data.isDead, true);
    assert.equal(h.player.data.isDead, false);
    assert.equal(h.player.data.velocity.y, GP_FALL_SPEED);
    assert.equal(h.game.score, ENEMY_SCORE);
});

test('a still-winding-up top overlap is damage, not an early ground-pound attack', () => {
    const h = combat(141.5);
    h.player.collectHelmet();
    h.step({ down: true, downPressed: true });
    assert.equal(h.player.data.groundPoundState, GroundPoundState.WINDUP);
    assert.equal(h.player.data.velocity.y, 0);
    assert.equal(h.minion.data.isDead, false);
    assert.equal(h.player.data.hasHelmet, false);
    assert.equal(h.player.data.invincibleTimer, 1000);
    assert.equal(h.game.score, 0);
    assert.equal(h.sounds.filter(s => s === 'playHelmetBreak').length, 1);
    h.step({ down: true });
    assert.equal(h.player.data.isDead, false, 'The existing helmet grace window still covers repeated overlap.');
    assert.equal(h.player.data.invincibleTimer, 1000 - DT);
    assert.equal(h.sounds.filter(s => s === 'playHelmetBreak').length, 1);
    assert.ok(!h.sounds.includes('playStomp'));
});

test('the first falling pound step cannot turn a side collision into a stomp', () => {
    const h = combat(143, 6.25);
    h.player.collectHelmet();
    h.step({ down: true, downPressed: true });
    for (let frame = 0; frame < 8 && h.player.data.groundPoundTimer > DT; frame++) {
        h.step({ down: true });
        assert.equal(h.player.data.hasHelmet, true, 'The minion is still approaching the suspended player.');
    }
    h.step({ down: true });
    assert.equal(h.player.getPrevGroundPoundStateForContacts(), GroundPoundState.WINDUP);
    assert.equal(h.player.data.groundPoundState, GroundPoundState.FALL);
    assert.equal(h.player.data.isGrounded, false);
    assert.equal(h.minion.data.isDead, false);
    assert.equal(h.player.data.hasHelmet, false);
    assert.equal(h.player.data.invincibleTimer, 1000);
    assert.equal(h.game.score, 0);
    assert.ok(!h.sounds.includes('playStomp'));
});

test('jumping upward into a minion remains damage rather than a stomp', () => {
    const h = combat(160, 6);
    h.player.collectHelmet();
    h.step();
    assert.equal(h.player.data.isGrounded, true);
    h.step({ jump: true, jumpPressed: true });
    assert.equal(h.player.data.hasHelmet, true);
    h.step({ jump: true });
    assert.ok(h.player.data.velocity.y < 0);
    assert.ok(h.player.getPrevVelocityForContacts().y < 0);
    assert.equal(h.minion.data.isDead, false);
    assert.equal(h.player.data.hasHelmet, false);
    assert.equal(h.game.score, 0);
    assert.ok(!h.sounds.includes('playStomp'));
});

test('an ordinary descending stomp retains its bounce and one score award', () => {
    const h = combat(136);
    for (let frame = 0; frame < 10 && !h.minion.data.isDead; frame++) h.step();
    assert.equal(h.minion.data.isDead, true);
    assert.equal(h.player.data.isDead, false);
    assert.equal(h.player.data.groundPoundState, GroundPoundState.NONE);
    assert.equal(h.player.data.velocity.y, PLAYER_JUMP_FORCE * .6);
    assert.equal(h.game.score, ENEMY_SCORE);
    assert.equal(h.sounds.filter(s => s === 'playStomp').length, 1);
    h.step();
    assert.equal(h.game.score, ENEMY_SCORE);
});
