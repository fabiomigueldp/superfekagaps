import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TriggerController } from '../src/game/TriggerController';
import { MusicManager } from '../src/engine/MusicManager';
import { AudioEngine } from '../src/engine/AudioEngine';
import { GameState } from '../src/constants';
import { TriggerType, type LevelData, type LevelTrigger } from '../src/types';

const inside = { x: 8, y: 8, width: 16, height: 24 };
const outside = { ...inside, x: 300 };
const base = { id: 'trigger', x: 0, y: 0, width: 64, height: 64, active: true, oneShot: false };
const createLevel = (...triggers: LevelTrigger[]): LevelData => ({
  id: 'test', name: 'Triggers', width: 20, height: 12,
  tiles: Array.from({ length: 12 }, () => Array<number>(20).fill(0)),
  playerSpawn: { x: 1, y: 2 }, enemies: [], collectibles: [], triggers, checkpoints: [],
  goalPosition: { x: 18, y: 10 }, timeLimit: 180, isBossLevel: false
});
const noActions = { audio: () => true, damage: () => true };

test('audio zones fire once on entry and can fire again after leaving', () => {
  const controller = new TriggerController();
  const level = createLevel({ ...base, type: TriggerType.AUDIO, trackId: 'boss', action: 'PLAY' });
  let calls = 0;
  const actions = { ...noActions, audio: () => { calls++; return true; } };
  controller.update(16, level, inside, actions);
  controller.update(16, level, inside, actions);
  assert.equal(calls, 1);
  controller.update(16, level, outside, actions);
  controller.update(16, level, inside, actions);
  assert.equal(calls, 2);
});

test('one-shot triggers are consumed only on successful activation and do not mutate level data', () => {
  const controller = new TriggerController();
  const level = createLevel({ ...base, oneShot: true, type: TriggerType.DAMAGE, damagePerTick: 1, instantKill: false });
  const original = structuredClone(level);
  let accepted = false;
  let calls = 0;
  const actions = { ...noActions, damage: () => { calls++; return accepted; } };
  controller.update(16, level, inside, actions);
  accepted = true;
  controller.update(16, level, inside, actions);
  controller.update(16, level, inside, actions);
  controller.update(16, level, outside, actions);
  controller.update(16, level, inside, actions);
  assert.equal(calls, 2);
  assert.deepEqual(level, original);
  controller.update(16, structuredClone(level), inside, actions);
  assert.equal(calls, 3, 'a new play session rearms one-shot triggers');
});

test('a one-shot camera lasts for its first visit and stays consumed on later visits', () => {
  const camera = { ...base, oneShot: true, type: TriggerType.CAMERA as const, zoom: 2, lockX: true, lockY: false };
  const controller = new TriggerController();
  const level = createLevel(camera);
  assert.equal(controller.update(16, level, inside, noActions), camera);
  assert.equal(controller.update(16, level, inside, noActions), camera);
  assert.equal(controller.update(16, level, outside, noActions), null);
  assert.equal(controller.update(16, level, inside, noActions), null);
  assert.equal(controller.update(16, level, inside, noActions), null);
});

test('dialog zones display text, expire without restarting each tick, and reset between levels', () => {
  const controller = new TriggerController();
  const level = createLevel({ ...base, type: TriggerType.DIALOG, text: 'Cuidado com o buraco!' });
  controller.update(16, level, inside, noActions);
  assert.equal(controller.getDialogRenderState()?.text, 'Cuidado com o buraco!');
  controller.update(3000, level, inside, noActions);
  controller.update(250, level, inside, noActions);
  assert.equal(controller.getDialogRenderState(), null);
  controller.update(16, level, outside, noActions);
  controller.update(16, level, inside, noActions);
  assert.ok(controller.getDialogRenderState());
  controller.update(16, createLevel(), inside, noActions);
  assert.equal(controller.getDialogRenderState(), null);
});

test('inactive zones and empty dialog text do not activate', () => {
  const controller = new TriggerController();
  const level = createLevel(
    { ...base, type: TriggerType.AUDIO, active: false, trackId: 'boss', action: 'PLAY' },
    { ...base, id: 'dialog', type: TriggerType.DIALOG, text: '  ' }
  );
  controller.update(16, level, inside, { ...noActions, audio: () => { throw new Error('inactive audio'); } });
  assert.equal(controller.getDialogRenderState(), null);
});

test('music triggers validate IDs, preserve STOP during powerups, and reset on level changes', async () => {
  const played: string[] = [];
  let stops = 0;
  const engine = {
    ensureReady: () => true, setMusicVolume() {},
    playMusic: async (id: string) => { played.push(id); return true; },
    crossfadeTo: async (id: string) => { played.push(id); return true; },
    stopMusic: () => { stops++; }
  } as unknown as AudioEngine;
  const manager = new MusicManager(engine);
  const context = { levelId: '0', isBossLevel: false, playerAlive: true, powerupActive: false, gameState: GameState.PLAYING };
  manager.onStateChange(GameState.MENU, GameState.PLAYING, context);
  await Promise.resolve();
  assert.equal(manager.applyLevelTrigger('does-not-exist', 'PLAY'), false);
  assert.equal(manager.applyLevelTrigger('boss', 'PLAY'), true);
  await Promise.resolve();
  assert.deepEqual(played, ['game', 'boss']);
  manager.applyLevelTrigger('', 'STOP');
  manager.update(16, { gameState: GameState.PLAYING, isBossLevel: false, isDead: false, powerupActive: true, deliciaMode: false });
  assert.deepEqual(played, ['game', 'boss']);
  assert.ok(stops >= 1);
  manager.onStateChange(GameState.PLAYING, GameState.PLAYING, { ...context, levelId: '1' });
  await Promise.resolve();
  assert.equal(played.at(-1), 'game');
});

test('late music requests cannot clear a newer pending trigger request', async () => {
  const resolvers: ((value: boolean) => void)[] = [];
  const played: string[] = [];
  const engine = {
    ensureReady: () => true, setMusicVolume() {}, stopMusic() {},
    playMusic: (id: string) => {
      played.push(id);
      return new Promise<boolean>((resolve) => resolvers.push(resolve));
    }
  } as unknown as AudioEngine;
  const manager = new MusicManager(engine);
  manager.onStateChange(GameState.MENU, GameState.PLAYING, {
    levelId: '0', isBossLevel: false, playerAlive: true, powerupActive: false, gameState: GameState.PLAYING
  });
  manager.applyLevelTrigger('boss', 'PLAY');
  resolvers[0](false);
  await Promise.resolve();
  manager.update(16, { gameState: GameState.PLAYING, isBossLevel: false, isDead: false, powerupActive: false, deliciaMode: false });
  assert.deepEqual(played, ['game', 'boss']);
  resolvers[1](true);
  await Promise.resolve();
});

test('STOP cancels music still loading, including crossfades', async () => {
  const engine = new AudioEngine();
  let resolveBuffer: (buffer: object) => void = () => {};
  Object.assign(engine, {
    ensureReady: () => true,
    musicGain: {},
    audioContext: { currentTime: 0, createBufferSource: () => { throw new Error('stale track started after STOP'); } },
    loadBuffer: () => new Promise((resolve) => { resolveBuffer = resolve; })
  });
  const pending = engine.playMusic('game');
  engine.stopMusic();
  resolveBuffer({ duration: 1 });
  assert.equal(await pending, false);
  const crossfade = engine.crossfadeTo('boss', { durationMs: 300 });
  engine.stopMusic();
  resolveBuffer({ duration: 1 });
  assert.equal(await crossfade, false);
});
