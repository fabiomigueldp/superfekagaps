/** Local focused regression: npx tsx --loader ./tests/helpers/nodeCssLoader.mjs --test tests/classic-boss-death-pause.test.ts
 * Production Game methods, Input, Joaozao and voice collaborators; no renderer,
 * RAF, network or physical audio. Only the Web Audio completion boundary is controlled.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Window } from 'happy-dom';
import { GameState } from '../src/constants';
import { Joaozao } from '../src/entities/enemies/Joaozao';
import { AudioVoicePlayer } from '../src/voice/AudioVoicePlayer';
import { VoiceDirector } from '../src/voice/VoiceDirector';
import { SpeechBubbleController } from '../src/voice/SpeechBubbleController';
import { JOAOZAO_VOICE_MANIFEST } from '../src/voice/joaozaoVoiceManifest';

test('Joaozao defeat freezes while paused and completes only after explicit resume', async () => {
  const window = new Window();
  const globals = ['window', 'document', 'HTMLElement'] as const;
  const previous = globals.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  globals.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: window[key] }));
  const failures: string[] = [];
  const check = (condition: boolean, message: string) => { if (!condition) failures.push(message); };
  const flush = () => new Promise<void>(resolve => setImmediate(resolve));
  try {
    const { Game } = await import('../src/game/Game');
    const { Input } = await import('../src/engine/Input');
    for (const mode of ['fallback', 'timeout', 'async-ended'] as const) {
      const input = new Input(window.document.createElement('canvas') as unknown as HTMLCanvasElement);
      try {
        const source = { onended: null as (() => void) | null, connect() {}, start() {}, stop() {} };
        const context = { createBufferSource: () => source, createGain: () => ({ gain: { value: 1 }, connect() {} }) };
        const voicePlayer = new AudioVoicePlayer({
          ensureReady: () => mode !== 'fallback', getContext: () => context, getSfxDestination: () => ({})
        } as any);
        // Use the real manifest and playback queue, avoiding asset requests.
        (voicePlayer as any).bufferCache.set(JOAOZAO_VOICE_MANIFEST.voiceLines.para_de_encher_o_saco.audioUrl, { duration: 0.96 });
        const voice = new VoiceDirector(JOAOZAO_VOICE_MANIFEST, voicePlayer,
          new SpeechBubbleController({ fadeOutMs: 120 }), () => ({ x: 0, y: 0 }));
        const boss = new Joaozao(10, 10);
        boss.data.health = 1;
        assert.equal(boss.takeDamage().defeated, true);
        let deaths = 0;
        const die = boss.die.bind(boss);
        boss.die = () => { deaths++; die(); };
        // Skip browser rendering/bootstrap only; all state, death and update methods
        // are inherited unchanged. No level is needed to exercise pending defeat.
        const game: any = Object.assign(Object.create(Game.prototype), {
          input, state: GameState.PLAYING, boss, bossVoice: voice,
          player: null, level: null, bossDeathPending: false, bossDeathTimer: 0,
          bossDeathToken: 0, bossDeathTimeoutMs: 2500,
          renderer: { advanceClock() {} },
          audio: { updateMusic() {}, onStateChange() {}, playPause() {} },
          fireworks: [], fireworkSpawnTimer: Infinity
        });
        game.update(100);
        await flush();
        assert.equal(game.bossDeathPending, true);
        assert.equal(boss.data.isDead, false);
        game.handleInterruption(true);
        const before = structuredClone(boss.data);
        const timer = game.bossDeathTimer;
        const voiceClock = (voice as any).nowMs;
        const bubble = voice.getBubbleRenderState();
        const fallback = (voicePlayer as any).fallbackRemainingMs;
        // Complete native audio before the timeout in the async case, proving
        // the callback independently of the safety timeout.
        for (let frame = 0; frame < (mode === 'async-ended' ? 6 : 180); frame++) game.update(1000 / 60);
        await flush();
        check(game.bossDeathTimer === timer, `${mode}: defeat timeout advanced while paused`);
        check((voice as any).nowMs === voiceClock, `${mode}: voice clock advanced while paused`);
        check(JSON.stringify(boss.data) === JSON.stringify(before), `${mode}: boss mutated while paused`);
        check(JSON.stringify(voice.getBubbleRenderState()) === JSON.stringify(bubble), `${mode}: bubble advanced while paused`);
        check((voicePlayer as any).fallbackRemainingMs === fallback, `${mode}: fallback advanced while paused`);
        if (mode === 'async-ended') {
          assert.equal(typeof source.onended, 'function');
          source.onended!(); // Native completion can arrive without a Game update.
          await flush();
          check(!boss.data.isDead && deaths === 0, `${mode}: asynchronous completion killed boss while paused`);
        }
        game.handleInterruption(false);
        game.update(0);
        check(game.state === GameState.PAUSED && !boss.data.isDead, `${mode}: focus return resumed defeat`);
        input.queueCommand('pause');
        game.update(0); // Existing explicit resume control, with no elapsed play time.
        check(game.state === GameState.PLAYING, `${mode}: explicit resume failed`);
        if (mode !== 'async-ended') {
          check(!boss.data.isDead, `${mode}: remaining wait was lost on resume`);
          game.update(mode === 'fallback' ? fallback : timer);
          await flush();
        }
        check(boss.data.isDead && deaths === 1 && !game.bossDeathPending, `${mode}: defeat did not complete once after resume`);
        game.update(0);
        check(deaths === 1, `${mode}: defeat count changed after completion`);
      } finally { input.dispose(); }
    }
  } finally {
    await window.happyDOM.close();
    globals.forEach((key, index) => {
      if (previous[index]) Object.defineProperty(globalThis, key, previous[index]!);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  assert.deepEqual(failures, []);
});
