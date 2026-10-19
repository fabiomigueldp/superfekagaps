import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Game } from '../src/game/Game';
import { Renderer } from '../src/engine/Renderer';
import { Player } from '../src/entities/Player';
import type { CameraData } from '../src/types';

type CameraHost = {
  camera: CameraData;
  player: Player;
  renderer: Renderer;
  activeCameraOverride: null;
  updateCamera(deltaTime: number): void;
};

function cameraHost(reducedMotion: boolean, shakeTimer: number) {
  // Exercise the real camera update and live Renderer getter without creating
  // browser/audio devices. Only the media-query result is supplied by the test.
  const motion = { matches: reducedMotion };
  const renderer = Object.create(Renderer.prototype) as Renderer;
  Object.assign(renderer, { landingMotion: motion });
  const game = Object.create(Game.prototype) as CameraHost;
  Object.assign(game, {
    renderer, player: new Player(40, 24), activeCameraOverride: null,
    camera: {
      x: 100, y: 60, targetX: 0, targetY: 0, zoom: 1.3,
      shakeTimer, shakeMagnitude: 8,
      bounds: { minX: 0, maxX: 2000, minY: 0, maxY: 1200 }
    }
  });
  return { game, motion };
}

function cameraSteps(t: TestContext, reducedMotion: boolean, shakeTimer: number) {
  const h = cameraHost(reducedMotion, shakeTimer);
  const random = t.mock.method(Math, 'random', () => .75);
  return { ...h, step(deltaTime: number, remaining: number, offset: number) {
    const playerBefore = structuredClone(h.game.player.data);
    const steady = Object.create(Game.prototype) as CameraHost;
    Object.assign(steady, h.game, { camera: { ...structuredClone(h.game.camera), shakeTimer: 0 } });
    steady.updateCamera(deltaTime);
    const randomCalls = random.mock.callCount();
    h.game.updateCamera(deltaTime);
    assert.equal(h.game.renderer.reducedMotion, h.motion.matches, 'preference is read live');
    assert.equal(h.game.camera.shakeTimer, remaining, 'preference cannot pause or restart the timer');
    assert.equal(h.game.camera.x, steady.camera.x + offset);
    assert.equal(h.game.camera.y, steady.camera.y + offset);
    assert.equal(random.mock.callCount() - randomCalls, offset ? 2 : 0);
    assert.deepEqual({ ...h.game.camera, x: steady.camera.x, y: steady.camera.y, shakeTimer: 0 }, steady.camera,
      'camera tracking, zoom, bounds and magnitude are unchanged');
    assert.deepEqual(h.game.player.data, playerBefore, 'camera feedback cannot mutate physics or player animation');
  } };
}

test('Classic keeps ordinary camera shake and its existing expiration boundary', t => {
  const h = cameraSteps(t, false, 32);
  h.step(16, 16, 2);
  h.step(16, 0, 2);
  h.step(16, 0, 0);
});

test('Classic reduced motion suppresses only visual shake while its timer expires', t => {
  const h = cameraSteps(t, true, 32);
  h.step(16, 16, 0);
  h.step(20, -4, 0);
  h.step(16, -4, 0);
});

test('Classic responds to preference changes during active shake without reviving an expired effect', t => {
  const h = cameraSteps(t, false, 80);
  h.step(16, 64, 2);
  h.motion.matches = true;
  h.step(16, 48, 0);
  h.motion.matches = false;
  h.step(16, 32, 2);
  h.motion.matches = true;
  h.step(16, 16, 0);
  h.step(16, 0, 0);
  h.motion.matches = false;
  h.step(16, 0, 0);
});
