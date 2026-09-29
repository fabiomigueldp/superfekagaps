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
    id = '';
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
  return { input, key, touch, canvas, windowSurface, documentSurface, editable: new Element(true) };
}

test('touch ground pound has a press edge and can be combined with direction', (t) => {
  const { input, touch } = inputHarness(t);
  touch('touchstart', [[50, 90], [5, 90]]);
  input.update();
  assert.equal(input.getState().downPressed, true);
  assert.equal(input.getState().left, true);
  input.update();assert.equal(input.getState().downPressed, false);
  touch('touchend', [[5, 90]]);assert.equal(input.getState().down, false);
  touch('touchstart', [[50, 90]]);input.update();assert.equal(input.getState().downPressed, true);
});

test('menu touch works anywhere without activating movement underneath it', (t) => {
  const { input, touch } = inputHarness(t);
  input.setMenuMode(true);touch('touchstart', [[90, 90]]);input.update();
  assert.equal(input.consumeStart(), true);assert.equal(input.getState().jump, false);
  touch('touchend', []);input.setMenuMode(false);
  touch('touchstart', [[90, 90]]);input.update();
  assert.equal(input.consumePause(), false);assert.equal(input.getState().jumpPressed, true);
});

test('boss warning locks the gap location so moving away evades the smash', () => {
  const level = makeLevel(-30, -4);level.data.tiles[10].fill(TileType.GROUND);
  const boss = new Joaozao(-25, 6);
  Object.assign(boss, { currentAction: 'create_gap', actionTimer: 2000 });
  boss.update(100, level, -20 * TILE_SIZE, 64);
  assert.deepEqual(boss.data.attackPreview, { x: -21 * TILE_SIZE, y: 6 * TILE_SIZE, width: 48, progress: .2 });
  boss.update(400, level, -14 * TILE_SIZE, 64);
  assert.equal(boss.data.attackPreview, undefined);
  assert.equal(level.getTile(10, 10), TileType.EMPTY);
  assert.equal(level.getTile(16, 10), TileType.GROUND);
  assert.deepEqual(boss.consumeImpact(), { x: -20 * TILE_SIZE + 8, y: 6 * TILE_SIZE });
  boss.update(100, level, -14 * TILE_SIZE, 64);assert.equal(boss.consumeImpact(), null);
});

test('damaging the boss interrupts its warning and prevents the queued gap', () => {
  const level = makeLevel();level.data.tiles[10].fill(TileType.GROUND);
  const boss = new Joaozao(5, 10);
  Object.assign(boss, { currentAction: 'create_gap', actionTimer: 2000 });
  boss.update(100, level, 10 * TILE_SIZE, 64);
  assert.ok(boss.data.attackPreview);boss.takeDamage();
  assert.equal(boss.data.attackPreview, undefined);
  boss.update(400, level, 10 * TILE_SIZE, 64);
  assert.equal(level.getTile(10, 10), TileType.GROUND);assert.equal(boss.consumeImpact(), null);
});

test('landing animation expires without changing the player collision box', () => {
  const level = makeLevel();level.data.tiles[10].fill(TileType.GROUND);
  const player = new Player(5, 10),before = player.getRect();
  player.update(DT, neutral, level);
  assert.equal(player.data.landingTimer, 90);assert.deepEqual(player.getRect(), before);
  for(let i=0;i<6;i++)player.update(DT, neutral, level);
  assert.equal(player.data.landingTimer, 0);assert.deepEqual(player.getRect(), before);
});

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

test('WASD resolves opposite directions by latest press and restores the held direction', (t) => {
  const { input, key } = inputHarness(t);
  assert.equal(key('keydown', 'KeyA'), true);
  assert.deepEqual([input.getState().left, input.getState().right], [true, false]);
  key('keydown', 'KeyD');
  assert.deepEqual([input.getState().left, input.getState().right], [false, true]);
  key('keyup', 'KeyD');
  assert.deepEqual([input.getState().left, input.getState().right], [true, false]);
  key('keydown', 'ArrowRight');
  assert.deepEqual([input.getState().left, input.getState().right], [false, true]);
  key('keyup', 'ArrowRight');
  assert.deepEqual([input.getState().left, input.getState().right], [true, false]);
  key('keyup', 'KeyA');
  assert.deepEqual([input.getState().left, input.getState().right], [false, false]);
  assert.equal(key('keydown', 'KeyW', { ctrlKey: true }), false);
  assert.equal(input.getState().jump, false);
});

test('D still moves for a simulation tick when the tap is shorter than a frame', (t) => {
  const { input, key } = inputHarness(t);
  const level = makeLevel();
  level.data.tiles[10].fill(TileType.GROUND);
  const player = new Player(5, 10);
  player.update(DT, neutral, level);
  const startX = player.data.position.x;

  key('keydown', 'KeyD');
  key('keyup', 'KeyD');
  input.update();
  assert.equal(input.getState().right, true);
  player.update(DT, input.getState(), level);
  assert.ok(player.data.position.x > startX);
  input.update();
  assert.equal(input.getState().right, false);
});

test('D and the right arrow produce the same movement for a held press', (t) => {
  const { input, key } = inputHarness(t);
  const level = makeLevel();
  level.data.tiles[10].fill(TileType.GROUND);

  const travel = (code: 'KeyD' | 'ArrowRight') => {
    input.reset();
    const player = new Player(5, 10);
    player.update(DT, neutral, level);
    key('keydown', code, code === 'KeyD' ? { key: 'd' } : { key: 'ArrowRight' });
    for (let frame = 0; frame < 12; frame++) {
      input.update();
      player.update(DT, input.getState(), level);
    }
    key('keyup', code, code === 'KeyD' ? { key: 'd' } : { key: 'ArrowRight' });
    return { x: player.data.position.x, velocityX: player.data.velocity.x };
  };

  const arrow = travel('ArrowRight');
  const d = travel('KeyD');
  assert.ok(d.x > 5 * TILE_SIZE);
  assert.deepEqual(d, arrow);
});

test('D accepts the typed character when code differs and recovers from stale key state', (t) => {
  const { input, key } = inputHarness(t);
  key('keydown', 'Unidentified', { key: 'd' });
  assert.equal(input.getState().right, true);
  key('keydown', 'KeyA');
  assert.equal(input.getState().left, true);
  key('keydown', 'Unidentified', { key: 'd' });
  assert.equal(input.getState().right, true);
  key('keyup', 'Unidentified', { key: 'd' });
  assert.equal(input.getState().left, true);
  key('keyup', 'KeyA');
  input.reset();
  key('keydown', 'Unidentified', { key: 'd', repeat: true });
  assert.equal(input.getState().right, true);
  key('keyup', 'Unidentified', { key: 'd' });
  assert.equal(input.getState().right, false);
});

test('the gameplay canvas accepts D while ordinary editable fields stay isolated', (t) => {
  const { input, key, canvas, editable, windowSurface } = inputHarness(t);
  canvas.id = 'game-canvas';
  canvas.closest = () => canvas;
  key('keydown', 'KeyD', { key: 'd' });
  assert.equal(input.getState().right, true);
  key('keyup', 'KeyD', { key: 'd' });
  windowSurface.emit('keydown', { code: 'KeyD', key: 'd', target: editable, repeat: false, preventDefault() {} });
  assert.equal(input.getState().right, false);
});

test('W jumps while D moves and S starts the aerial attack', (t) => {
  const { input, key } = inputHarness(t);
  const level = makeLevel();
  level.data.tiles[10].fill(TileType.GROUND);
  const player = new Player(5, 10);
  player.update(DT, neutral, level);
  const start = { ...player.data.position };

  key('keydown', 'KeyD');
  key('keydown', 'KeyW');
  key('keydown', 'ShiftLeft');
  input.update();
  player.update(DT, input.getState(), level);
  assert.ok(player.data.position.x > start.x);
  assert.ok(player.data.position.y < start.y);
  assert.equal(player.data.isRunning, true);

  key('keydown', 'KeyS');
  input.update();
  const attack = player.update(DT, input.getState(), level);
  assert.equal(attack.groundPoundStarted, true);
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
  const spawn = { ...player.data.position };
  player.update(200, { ...neutral, right: true }, makeLevel(-5));
  assert.deepEqual(player.data.position, spawn);
  player.update(220, { ...neutral, right: true }, makeLevel(-5));
  assert.deepEqual(player.data.position, spawn);
  assert.equal(player.data.invincibleTimer, 2000);
  player.update(DT, { ...neutral, right: true }, makeLevel(-5));
  assert.ok(player.data.position.x > spawn.x);
});

test('death keeps its impact origin and direction and cancels pending attacks', () => {
  const player = new Player(5,10);
  player.data.isGrounded = true;
  player.data.groundPoundState = GroundPoundState.FALL;
  player.data.jumpBufferTimer = 100;
  const origin = { ...player.data.position };
  player.die('hit', player.getCenter().x + 20);
  assert.equal(player.data.deathDirection, -1);
  assert.equal(player.data.deathWasGrounded, true);
  assert.equal(player.data.groundPoundState, GroundPoundState.NONE);
  assert.equal(player.data.jumpBufferTimer, 0);
  player.data.position.x += 30;
  player.die('fall');
  player.bounce();
  assert.deepEqual(player.data.deathOrigin, origin);
  assert.equal(player.data.deathKind, 'hit');
  assert.deepEqual(player.data.velocity,{x:0,y:0});
});

test('fixed simulation steps finish each death on its intended frame', () => {
  for (const [kind, frames] of [['hit',90],['fall',63]] as const) {
    const player = new Player(5,10);
    player.die(kind);
    for (let i=0;i<frames-1;i++) player.advanceDeath(DT);
    assert.ok(player.data.deathTimer>0);
    player.advanceDeath(DT);
    assert.equal(player.data.deathTimer,0);
  }
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
    lives: 3, levelTime: 0.001, totalRunTime: 0, deathTimer: 0, activeCheckpoint: null, particles: [],
    input: { consumePause: () => false, getState: () => neutral },
    audio: {
      playFall() {}, playDeath() {}, onPlayerDeathStart() { audioCalls.deaths++; },
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
  assert.equal(game.player.data.deathKind, 'hit');
  assert.equal(game.player.data.deathTimer, 1500);
  assert.equal(game.levelTime, 0);
  assert.equal(game.lives, 3);
  game.updatePlaying(1500);
  assert.equal(game.lives, 2);
  assert.equal(game.player.data.isDead, false);
  assert.equal(game.player.data.respawnRevealTimer, 420);
  assert.equal(game.levelTime, game.level.data.timeLimit);
  assert.deepEqual(audioCalls, { deaths: 1, respawns: 1 });
});

test('falling into a gap uses the death timer instead of respawning immediately', () => {
  const { game, audioCalls } = gameHarness();
  game.levelTime = 100;
  game.player.data.position.y = game.level.getBounds().maxY + 1;
  game.updatePlaying(DT);
  assert.equal(game.player.data.isDead, true);
  assert.equal(game.player.data.deathKind, 'fall');
  assert.equal(game.deathTimer, 1050);
  game.updatePlaying(DT);
  assert.equal(game.lives, 3);
  assert.equal(audioCalls.deaths, 1);
  game.updatePlaying(1050);
  assert.equal(game.lives, 2);
  assert.ok(game.levelTime > 99 && game.levelTime < 100);
  assert.deepEqual(audioCalls, { deaths: 1, respawns: 1 });
});

test('death and the checkpoint reveal freeze mechanisms and preserve playable time', () => {
  const { game } = gameHarness();
  game.levelTime = 100;
  let mechanismTicks = 0;
  game.level.updateDynamicTiles = () => mechanismTicks++;
  game.playerDie();
  game.updatePlaying(1500);
  const spawn = { ...game.player.data.position };
  const protection = game.player.data.invincibleTimer;
  game.updatePlaying(420);
  assert.equal(mechanismTicks,0);
  assert.equal(game.levelTime,100);
  assert.deepEqual(game.player.data.position,spawn);
  assert.equal(game.player.data.invincibleTimer,protection);
});
