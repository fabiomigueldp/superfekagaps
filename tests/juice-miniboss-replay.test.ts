import test from 'node:test';
import { Player } from '../src/entities/Player';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JuiceMinibossLab } from '../src/adventure/experimental/JuiceMinibossLab';
import { ProgressStore } from '../src/adventure/progress';
import { WorldTutorial } from '../src/adventure/WorldTutorial';
import type { InputState } from '../src/types';
import type { JuiceMinibossModel } from '../src/adventure/experimental/JuiceMinibossModel';

const idle: InputState = { left: false, right: false, run: false, jump: false, down: false, start: false,
    pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
const recording = JSON.parse(readFileSync(new URL('./helpers/juiceLabReplay.json', import.meta.url), 'utf8')) as {
    stepMs: number; keys: Array<keyof InputState>; runs: Array<[number, number]>; frames: number;
    expectedHits: Array<{ frame: number; health: number }>;
};

/** Rendering/DOM boundaries stubbed; collision, movement and encounter are real.
 * Constructor and DOM-event integration are separately covered by lifecycle tests. */
function harness() {
    let controls = { ...idle };
    const store = new ProgressStore(null), game = Object.create(JuiceMinibossLab.prototype) as JuiceMinibossLab;
    const noop = () => {};
    Object.assign(game, { store, tutorial: new WorldTutorial(store), status: { textContent: '' }, touch: false,
        state: 'title', time: 0, elapsed: 0, coins: 0, toast: '', toastTimer: 0, selection: 0, menuSelection: 0, buttons: [],
        camera: { x: 0, y: 64, targetX: 0, targetY: 64, shakeTimer: 0, shakeMagnitude: 0, bounds: { minX: 0, minY: 0, maxX: 320, maxY: 288 } },
        input: { reset() { controls = { ...idle }; }, setMenuMode: noop, update: noop,
            consumeMute: () => false, consumePause: () => false, getState: () => controls },
        audio: { cancelSpeech: noop, setDying: noop, pause: noop, select: noop, tick: noop, toggle: noop, say: noop, sfx: noop },
        renderer: { advanceClock: noop, addImpact: noop } });
    game.load('juice-lab');
    // This immutable historical input recording starts at the original airborne seed.
    // The intro now hands off grounded at x68; lifecycle tests cover that new contract.
    game.player = new Player(3, 12);
    return { game, step(input: InputState) { controls = input; game.update(recording.stepMs); } };
}

function replay() {
    const { game, step } = harness();
    const hits: Array<{ frame: number; health: number }> = [], attacks = new Set<string>();
    let frame = 0, deaths = 0, lastHealth = 6;
    for (const [count, bits] of recording.runs) for (let n = 0; n < count; n++, frame++) {
        const controls = { ...idle };
        recording.keys.forEach((key, i) => { controls[key] = Boolean(bits & (1 << i)); });
        step(controls);
        const boss = game.boss as NonNullable<typeof game.boss> & { model: JuiceMinibossModel };
        attacks.add(boss.model.attack);
        assert.ok(!game.player.data.isDead, `Unexpected death at frame ${frame}`);
        if (game.player.data.isDead) deaths++;
        if (boss.health !== lastHealth) { hits.push({ frame, health: boss.health }); lastHealth = boss.health; }
    }
    assert.equal(frame, recording.frames);
    assert.equal(deaths, 0);
    assert.deepEqual([...attacks].sort(), ['dash', 'fan', 'pounce']);
    assert.equal(game.boss?.phase, 'defeated');
    assert.deepEqual(game.store.save.completed, []);
    assert.deepEqual(hits, recording.expectedHits);
    return { hits, player: game.player.data, boss: game.boss?.health };
}

test('recorded ordinary inputs dodge every attack and win using real movement, with exact deterministic replay', () => {
    assert.deepEqual(replay(), replay());
});

for (const side of ['left', 'right'] as const) for (const health of [6, 3]) {
    test(`fan pressures a stationary ${side} corner in phase ${health === 6 ? 1 : 2} with the real Player`, () => {
        const { game, step } = harness();
        const boss = game.boss as NonNullable<typeof game.boss> & { model: JuiceMinibossModel };
        boss.model.health = health;
        let cornerFrames = 0, entryJump = -100;
        for (let frame = 0; frame < 1200 && !game.player.data.isDead; frame++) {
            // Reach the right corner with one ordinary jump over the spawn-side
            // boss; after arrival, hold only the direction and never dodge.
            if (side === 'right' && entryJump === -100 && game.player.data.position.x >= 200 && game.player.data.isGrounded) entryJump = frame;
            step({ ...idle, run: true, [side]: true, jump: frame - entryJump < 9,
                jumpPressed: frame === entryJump, jumpReleased: frame - entryJump === 9 });
            const p = game.player.data;
            if (side === 'left' ? p.position.x === 0 : p.position.x + p.width === 320) cornerFrames++;
        }
        assert.ok(cornerFrames > 60, 'Ordinary movement reaches and rests at the corner before pressure arrives.');
        assert.equal(game.player.data.isDead, true, 'A corner cannot remain safe indefinitely.');
        assert.equal(boss.model.attack, 'fan', 'The visible fan, rather than a new body hitbox, creates pressure.');
        assert.ok(boss.model.drops.length > 0);
        assert.equal(boss.model.health, health);
        assert.deepEqual(game.store.save.completed, []);
    });
}
