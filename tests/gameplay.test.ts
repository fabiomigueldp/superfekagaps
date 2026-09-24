import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { Input } from '../src/engine/Input';
import { Player } from '../src/entities/Player';
import { Minion } from '../src/entities/enemies/Minion';
import { Joaozao } from '../src/entities/enemies/Joaozao';
import { Game } from '../src/game/Game';
import { Level } from '../src/world/Level';
import { GRAVITY, ICE_FRICTION, TileType, GameState, TILE_SIZE } from '../src/constants';
import { GroundPoundState, type LevelData, type InputState } from '../src/types';

const DT = 1000 / 60;
const neutral: InputState = {
  left: false, right: false, jump: false, run: false, down: false,
  start: false, pause: false, mute: false,
  jumpPressed: false, jumpReleased: false, downPressed: false
};

function makeLevel(originX = 0, originY = 0): Level {
  const data: LevelData = {
    id: 'test', name: 'Test level', width: 20, height: 15, originX, originY,
    tiles: Array.from({ length: 15 }, () => Array<number>(20).fill(TileType.EMPTY)),
    playerSpawn: { x: originX + 5, y: originY + 10 }, enemies: [], collectibles: [],
    triggers: [], checkpoints: [], goalPosition: { x: originX + 18, y: originY + 10 },
    timeLimit: 180, isBossLevel: false
  };
  return new Level(data);
}

class Surface {
  listeners = new Map<string, ((event: any) => void)[]>();
  addEventListener(type: string, listener: (event: any) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  emit(type: string, event: Record<string, unknown> = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function inputHarness(t: TestContext) {
  class Element extends Surface {
    constructor(private editable = false) { super(); }
    closest(): Element | null { return this.editable ? this : null; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  }
  const canvas = new Element();
  const windowSurface = new Surface();
  const documentSurface = Object.assign(new Surface(), {
    hidden: false, getElementById: () => canvas
  });
  const saved = ['window', 'document', 'HTMLElement'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.assign(globalThis, { window: windowSurface, document: documentSurface, HTMLElement: Element });
  t.after(() => {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  const input = new Input();
  const key = (type: 'keydown' | 'keyup', code: string, options: Record<string, unknown> = {}) => {
    let prevented = false;
    windowSurface.emit(type, { code, target: canvas, repeat: false, preventDefault: () => { prevented = true; }, ...options });
    return prevented;
  };
  const touch = (type: string, points: [number, number][]) => {
    canvas.emit(type, {
      currentTarget: canvas, preventDefault() {},
      touches: points.map(([clientX, clientY], identifier) => ({ identifier, clientX, clientY, target: canvas }))
    });
  };
  return { input, key, touch, windowSurface, documentSurface, editable: new Element(true) };
}

test('releasing one keyboard alias keeps the other held', (t) => {
  const { input, key } = inputHarness(t);
  key('keydown', 'ArrowLeft');
  key('keydown', 'KeyA');
  key('keyup', 'ArrowLeft');
  input.update();
  assert.equal(input.getState().left, true);
  key('keyup', 'KeyA');
  assert.equal(input.getState().left, false);
});

test('short jump and menu taps survive until the next simulation tick', (t) => {
  const { input, key } = inputHarness(t);
  key('keydown', 'Space');
  key('keyup', 'Space');
  key('keydown', 'Enter');
  key('keyup', 'Enter');
  input.update();
  assert.equal(input.getState().jumpPressed, true);
  assert.equal(input.getState().jumpReleased, true);
  assert.equal(input.getState().jump, false);
  assert.equal(input.consumeStart(), true);
  assert.equal(input.consumeStart(), false);
  input.update();
  assert.equal(input.getState().jumpPressed, false);
});

test('unhandled commands expire and held keys do not retrigger after reset', (t) => {
  const { input, key } = inputHarness(t);
  key('keydown', 'Enter');
  input.update();
  input.update();
  assert.equal(input.consumeStart(), false);
  input.reset();
  key('keydown', 'Enter', { repeat: true });
  input.update();
  assert.equal(input.consumeStart(), false);
  key('keyup', 'Enter');
  key('keydown', 'Enter');
  input.update();
  assert.equal(input.consumeStart(), true);
});

test('focus loss and hidden documents clear held controls and pending actions', (t) => {
  const { input, key, windowSurface, documentSurface } = inputHarness(t);
  key('keydown', 'Space');
  key('keydown', 'KeyM');
  windowSurface.emit('blur');
  input.update();
  assert.equal(input.getState().jump, false);
  assert.equal(input.consumeMute(), false);
  key('keydown', 'KeyD');
  documentSurface.hidden = true;
  documentSurface.emit('visibilitychange');
  assert.equal(input.getState().right, false);
});

test('editing a form does not trigger gameplay or suppress spaces', (t) => {
  const { input, key, editable } = inputHarness(t);
  assert.equal(key('keydown', 'Space', { target: editable }), false);
  key('keydown', 'KeyM', { target: editable });
  input.update();
  assert.equal(input.getState().jump, false);
  assert.equal(input.consumeMute(), false);
});

test('touch movement and releases are rebuilt from the remaining fingers', (t) => {
  const { input, touch } = inputHarness(t);
  touch('touchstart', [[5, 90], [10, 90]]);
  assert.equal(input.getState().left, true);
  touch('touchend', [[10, 90]]);
  assert.equal(input.getState().left, true);
  touch('touchmove', [[90, 90]]);
  assert.equal(input.getState().left, false);
  assert.equal(input.getState().jump, true);
  touch('touchend', []);
  assert.equal(input.getState().jump, false);
});

test('keyboard and touch controls coexist and each menu touch is consumed once', (t) => {
  const { input, key, touch } = inputHarness(t);
  key('keydown', 'Space');
  touch('touchstart', [[90, 90]]);
  touch('touchend', []);
  assert.equal(input.getState().jump, true);
  touch('touchstart', [[50, 10]]);
  input.update();
  assert.equal(input.consumeStart(), true);
  assert.equal(input.consumePause(), false);
  touch('touchend', []);
  touch('touchstart', [[50, 10]]);
  input.update();
  assert.equal(input.consumePause(), true);
  assert.equal(input.consumeStart(), false);
});

test('respawn cancels ground pound and clears buffered movement state', () => {
  const player = new Player(5, 10);
  Object.assign(player.data, {
    groundPoundState: GroundPoundState.FALL, groundPoundTimer: 120,
    jumpBufferTimer: 100, coyoteTimer: 80, isRunning: true
  });
  player.die();
  player.respawn({ x: -3, y: 7 });
  assert.equal(player.data.groundPoundState, GroundPoundState.NONE);
  assert.equal(player.data.groundPoundTimer, 0);
  assert.equal(player.data.jumpBufferTimer, 0);
  assert.equal(player.data.coyoteTimer, 0);
  assert.equal(player.data.isRunning, false);
  assert.equal(player.data.isDead, false);
  assert.equal(player.data.invincibleTimer, 2000);
  assert.deepEqual(player.data.position, { x: -3 * TILE_SIZE, y: 7 * TILE_SIZE - player.data.height });
});

test('ice friction uses world origins, including negative coordinates', () => {
  const level = makeLevel(-12, -8);
  level.data.tiles[10].fill(TileType.ICE);
  const player = new Player(-7, 2);
  player.data.isGrounded = true;
  player.data.velocity.x = 2;
  player.update(DT, neutral, level);
  assert.equal(player.data.velocity.x, 2 * ICE_FRICTION);
  assert.equal(player.data.isGrounded, true);
});

test('minions apply gravity and displacement once and turn at solid walls', () => {
  const level = makeLevel();
  const minion = new Minion(5, 4);
  const before = { ...minion.data.position };
  minion.update(DT, level);
  assert.equal(minion.data.position.y, before.y + GRAVITY * 0.5);
  assert.equal(minion.data.position.x, before.x - 0.8);

  level.data.tiles[10].fill(TileType.GROUND);
  level.data.tiles[8][4] = TileType.ICE;
  level.data.tiles[9][4] = TileType.ICE;
  const blocked = new Minion(5, 10);
  blocked.update(DT, level);
  assert.equal(blocked.data.position.x, 5 * TILE_SIZE);
  assert.equal(blocked.data.facingRight, true);
  assert.ok(blocked.data.velocity.x > 0);
});

test('boss moves once per tick and stays inside shifted arena bounds', (t) => {
  t.mock.method(Math, 'random', () => 0.99);
  const level = makeLevel(-30, 0);
  const boss = new Joaozao(-25, 4);
  boss.data.velocity.x = 2;
  const before = { ...boss.data.position };
  boss.update(DT, level, -15 * TILE_SIZE, 64);
  assert.equal(boss.data.position.x, before.x + 1.8);
  assert.equal(boss.data.position.y, before.y + GRAVITY * 0.7);
  assert.ok(boss.data.position.x < 0);
});

test('boss gaps and projectile limits use the edited level origin', () => {
  const level = makeLevel(-30, -4);
  level.data.tiles[10].fill(TileType.GROUND);
  const boss = new Joaozao(-25, 6);
  Object.assign(boss, { currentAction: 'create_gap', actionTimer: 1400 });
  boss.update(DT, level, -20 * TILE_SIZE, 6 * TILE_SIZE - 24);
  assert.equal(level.getTile(10, 10), TileType.EMPTY);
  assert.deepEqual(boss.consumeImpact(), { x: -20 * TILE_SIZE + TILE_SIZE / 2, y: 6 * TILE_SIZE });

  boss.projectiles.push({
    position: { x: -23 * TILE_SIZE, y: 4 * TILE_SIZE }, velocity: { x: 3, y: 0 },
    width: 8, height: 8, active: true, damage: 1, owner: 'enemy'
  });
  boss.update(DT, level, -20 * TILE_SIZE, 64);
  assert.equal(boss.projectiles.length, 1);
});

function gameHarness() {
  // Exercise the real update/death methods without creating browser rendering/audio devices.
  const game = Object.create(Game.prototype) as any;
  const audioCalls = { deaths: 0, respawns: 0 };
  Object.assign(game, {
    state: GameState.PLAYING, player: new Player(5, 10), level: makeLevel(),
    lives: 3, levelTime: 0.001, totalRunTime: 0, deathTimer: 0, activeCheckpoint: null,
    input: { consumePause: () => false, getState: () => neutral },
    audio: {
      playFall() {}, onPlayerDeathStart() { audioCalls.deaths++; },
      onRespawn() { audioCalls.respawns++; }
    },
    spawnParticles() {}
  });
  return { game, audioCalls };
}

test('timeout finishes the death animation and grants time on the next life', () => {
  const { game, audioCalls } = gameHarness();
  game.updatePlaying(DT);
  assert.equal(game.player.data.isDead, true);
  assert.equal(game.levelTime, 0);
  assert.equal(game.lives, 3);
  game.updatePlaying(1500);
  assert.equal(game.lives, 2);
  assert.equal(game.player.data.isDead, false);
  assert.equal(game.levelTime, game.level.data.timeLimit);
  assert.deepEqual(audioCalls, { deaths: 1, respawns: 1 });
});

test('falling into a gap uses the death timer instead of respawning immediately', () => {
  const { game, audioCalls } = gameHarness();
  game.levelTime = 100;
  game.player.data.position.y = game.level.getBounds().maxY + 1;
  game.updatePlaying(DT);
  assert.equal(game.player.data.isDead, true);
  assert.equal(game.deathTimer, 1500);
  game.updatePlaying(DT);
  assert.equal(game.lives, 3);
  assert.equal(audioCalls.deaths, 1);
  game.updatePlaying(1500);
  assert.equal(game.lives, 2);
  assert.ok(game.levelTime > 99 && game.levelTime < 100);
  assert.deepEqual(audioCalls, { deaths: 1, respawns: 1 });
});
