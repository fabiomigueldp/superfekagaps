import assert from 'node:assert/strict';
import { WorldGame } from '../../src/adventure/WorldGame';
import { stageById } from '../../src/adventure/campaign';
import { ProgressStore } from '../../src/adventure/progress';
import { WorldTutorial } from '../../src/adventure/WorldTutorial';
import type { InputState } from '../../src/types';

export const DT = 1000 / 60;
const idle: InputState = {
    left: false, right: false, jump: false, run: false, down: false,
    start: false, pause: false, mute: false,
    jumpPressed: false, jumpReleased: false, downPressed: false
};

/** Uses the production checkpoint load, WorldGame update, Player and mechanisms.
 * Only DOM/audio devices are stubbed; no positions, timers, damage or world state are injected. */
export function secretCannonHarness() {
    const game = Object.create(WorldGame.prototype) as any;
    const store = new ProgressStore(null);
    // Resume from the campaign's actual checkpoint immediately before the secret room.
    store.save.checkpoint = { stage: '5-3', index: 1, helmet: false };
    const effects: string[] = [], speech: string[] = [], frames: Partial<InputState>[] = [];
    let controls = { ...idle };
    Object.assign(game, {
        store, tutorial: new WorldTutorial(store), touch: false,
        state: 'title', time: 0, elapsed: 0, coins: 0, toast: '', toastTimer: 0,
        selection: 0, menuSelection: 0, buttons: [],
        camera: { x: 0, y: 0, targetX: 0, targetY: 0, shakeTimer: 0, shakeMagnitude: 0, bounds: { minX: 0, minY: 0, maxX: 2560, maxY: 368 } },
        input: {
            reset() { controls = { ...idle }; }, setMenuMode() {},
            update() {}, consumeMute: () => false, consumePause: () => false,
            getState: () => controls
        },
        audio: {
            cancelSpeech() {}, setDying() {}, pause() {}, select() {}, tick() {}, toggle() {},
            say(_speaker: string, text: string) { speech.push(text); },
            sfx(effect: string) { effects.push(effect); }
        },
        renderer: { advanceClock() {}, addImpact() {} }
    });
    game.load('5-3', true, stageById('5-3')!);
    return {
        game, store, effects, speech, frames,
        step(input: Partial<InputState> = {}) {
            controls = { ...idle, ...input };
            frames.push(input);
            game.update(DT);
            assert.equal(game.player.data.isDead, false, 'The route must not require damage or a death.');
            assert.equal(game.player.data.hasHelmet, false, 'The checkpoint proof uses no damage shield.');
        }
    };
}

export type SecretCannonHarness = ReturnType<typeof secretCannonHarness>;
export const feet = (h: SecretCannonHarness) => h.game.player.data.position.y + h.game.player.data.height;

export function walkTo(h: SecretCannonHarness, tile: number) {
    for (let frame = 0; frame < 240; frame++) {
        const delta = tile * 16 - h.game.player.data.position.x;
        if (Math.abs(delta) < 2 && Math.abs(h.game.player.data.velocity.x) < .25) return;
        h.step({ left: delta < -1, right: delta > 1 });
    }
    assert.fail(`Could not walk to tile ${tile}.`);
}

export function poundSwitch(h: SecretCannonHarness) {
    h.step({ jump: true, jumpPressed: true });
    assert.equal(h.game.player.data.isGrounded, false);
    for (let frame = 1; frame < 120; frame++) {
        h.step({ jump: frame < 7, jumpReleased: frame === 7, down: frame >= 5, downPressed: frame === 5 });
        if (h.game.player.data.isGrounded) return;
    }
    assert.fail('The player did not land the switch pound.');
}

export function jumpTo(h: SecretCannonHarness, tile: number, floor: number, hold = 9) {
    for (let frame = 0; frame < 150; frame++) {
        const delta = tile * 16 - h.game.player.data.position.x;
        h.step({ left: delta < -2, right: delta > 2, run: true, jump: frame < hold, jumpPressed: frame === 0, jumpReleased: frame === hold });
        if (frame > 2 && h.game.player.data.isGrounded) {
            assert.equal(feet(h), floor * 16, `Jump to ${tile},${floor} landed at ${h.game.player.data.position.x / 16},${feet(h)/16}`);
            return;
        }
    }
    assert.fail(`Could not jump to ${tile},${floor}.`);
}

export function runTo(h: SecretCannonHarness, tile: number) {
    for (let frame = 0; frame < 240; frame++) {
        if (h.game.player.data.position.x >= tile * 16) return;
        h.step({ right: true, run: true });
    }
    assert.fail(`Could not run to tile ${tile}.`);
}

export function reachSecretCatwalk(h: SecretCannonHarness) {
    jumpTo(h, 109, 12);
    if (h.game.objects.get('st').active) runTo(h, 112.5);
    else jumpTo(h, 113, 12); // The optional gate can be jumped, but its exit must remain locked.
    jumpTo(h, 119, 8);
    walkTo(h, 120);
    jumpTo(h, 127, 5);
}

export function finishSecret(h: SecretCannonHarness) {
    reachSecretCatwalk(h);
    for (let frame = 0; frame < 200 && h.game.state === 'playing'; frame++) h.step({ right: true });
    assert.equal(h.game.state, 'clear');
    assert.equal(h.game.clearSecret, true);
    assert.ok(h.store.save.secrets.includes('5-3'));
    assert.ok(h.store.save.seals.includes('5-3:s3'));
}
