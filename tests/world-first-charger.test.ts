import assert from 'node:assert/strict';
import test from 'node:test';
import { STAGES, stageById } from '../src/adventure/campaign';
import { WorldGame } from '../src/adventure/WorldGame';
import { WorldArt } from '../src/adventure/WorldArt';
import { WorldFoe, type FoePhase } from '../src/adventure/WorldEnemies';
import { ProgressStore } from '../src/adventure/progress';
import { WorldTutorial } from '../src/adventure/WorldTutorial';
import { isSolidTile } from '../src/world/tileRules';
import type { InputState } from '../src/types';

const DT = 1000 / 60;
const idle: InputState = { left: false, right: false, jump: false, run: false, down: false,
    start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
interface Event { frame: number; phase: FoePhase | 'land'; x: number; feet: number; grounded: boolean; }
interface Arrival { run: boolean; hold: number; takeoff: number; }

/** Production checkpoint load, falling bridge, Player, foe and damage path.
 * Only browser/audio devices are stubbed. There are no in-route teleports,
 * injected velocities, phase changes, damage shields or terrain replacements.
 * The optional coordinate replays the exact pre-correction authoring. */
function firstChargerHarness(previousX?: number) {
    const game = Object.create(WorldGame.prototype) as any;
    const store = new ProgressStore(null), effects: string[] = [], events: Event[] = [];
    const authored = structuredClone(stageById('1-4')!);
    if (previousX !== undefined) authored.foes.find(f => f.kind === 'charger')!.x = previousX * 16;
    store.save.checkpoint = { stage: '1-4', index: 1, helmet: false };
    let controls = { ...idle }, frame = 0;
    Object.assign(game, {
        store, tutorial: new WorldTutorial(store), touch: false,
        state: 'title', time: 0, elapsed: 0, coins: 0, toast: '', toastTimer: 0,
        selection: 0, menuSelection: 0, buttons: [],
        camera: { x: 0, y: 0, targetX: 0, targetY: 0, shakeTimer: 0, shakeMagnitude: 0,
            bounds: { minX: 0, minY: 0, maxX: 2944, maxY: 368 } },
        input: {
            reset() { controls = { ...idle }; }, setMenuMode() {}, update() {},
            consumeMute: () => false, consumePause: () => false, getState: () => controls
        },
        audio: { cancelSpeech() {}, setDying() {}, pause() {}, select() {}, tick() {}, toggle() {}, say() {},
            sfx(effect: string) { effects.push(effect); } },
        renderer: { advanceClock() {}, addImpact() {} }
    });
    game.load('1-4', true, authored);
    const foe = game.foes.find((f: WorldFoe) => f.spec.kind === 'charger') as WorldFoe;
    let phase = foe.phase, landed = false;
    return { game, foe, effects, events,
        step(input: Partial<InputState> = {}) {
            controls = { ...idle, ...input }; game.update(DT); frame++;
            const p = game.player.data, feet = p.position.y + p.height;
            const snapshot = { frame, x: p.position.x, feet, grounded: p.isGrounded };
            if (foe.phase !== phase) { events.push({ ...snapshot, phase: foe.phase }); phase = foe.phase; }
            if (!landed && p.isGrounded && feet === 11 * 16) {
                landed = true; events.push({ ...snapshot, phase: 'land' });
            }
            assert.equal(p.hasHelmet, false, 'The observation must not consume a damage shield.');
        }
    };
}
type Harness = ReturnType<typeof firstChargerHarness>;
function alive(h: Harness) { assert.equal(h.game.player.data.isDead, false, 'Use an undamaged arrival and observation.'); }
function walkTo(h: Harness, tile: number) {
    for (let frame = 0; frame < 240; frame++) {
        const p = h.game.player.data, dx = tile * 16 - p.position.x;
        if (Math.abs(dx) < 2 && Math.abs(p.velocity.x) < .25) return;
        h.step({ left: dx < -1, right: dx > 1 }); alive(h);
    }
    assert.fail(`Could not walk to ${tile}.`);
}
function jumpTo(h: Harness, tile: number, floor: number, hold = 9, run = true) {
    for (let frame = 0; frame < 150; frame++) {
        const dx = tile * 16 - h.game.player.data.position.x;
        h.step({ left: dx < -2, right: dx > 2, run, jump: frame < hold,
            jumpPressed: frame === 0, jumpReleased: frame === hold }); alive(h);
        const p = h.game.player.data;
        if (frame > 2 && p.isGrounded) {
            assert.equal(p.position.y + p.height, floor * 16, 'Land on the intended authored surface.');
            return;
        }
    }
    assert.fail(`Could not jump to ${tile},${floor}.`);
}
function arrive(h: Harness, arrival: Arrival) {
    walkTo(h, 118);
    jumpTo(h, 124.5, 13);
    walkTo(h, arrival.takeoff);
    jumpTo(h, 131.4, 11, arrival.hold, arrival.run);
    walkTo(h, 131.25);
}
function observeFirstCharge(h: Harness) {
    for (let frame = 0; frame < 160 && h.foe.phase !== 'rest' && !h.game.player.data.isDead; frame++) h.step();
}
function punishRest(h: Harness) {
    assert.equal(h.foe.phase, 'rest');
    for (let frame = 0; frame < 100 && !h.foe.dead; frame++) {
        h.step({ right: h.game.player.data.position.x < h.foe.x + 2,
            jump: frame < 9, jumpPressed: frame === 0, jumpReleased: frame === 9 }); alive(h);
    }
    assert.equal(h.foe.dead, true, 'An ordinary jump during recovery must defeat the first charger.');
    assert.ok(h.effects.includes('hit'));
}
const arrivals: Arrival[] = [
    { run: false, hold: 30, takeoff: 125.8 }, { run: false, hold: 30, takeoff: 126.35 },
    { run: true, hold: 9, takeoff: 125.8 }, { run: true, hold: 15, takeoff: 125.8 },
    { run: true, hold: 15, takeoff: 126.35 }, { run: true, hold: 30, takeoff: 125.8 },
    { run: true, hold: 30, takeoff: 126.35 }
];

test('the first campaign charger keeps its identity and full support on the existing landing', () => {
    const first = STAGES.flatMap(stage => stage.foes.map(foe => ({ stage, foe }))).find(({ foe }) => foe.kind === 'charger')!;
    assert.equal(first.stage.id, '1-4');
    assert.deepEqual(first.foe, { id: 'e1', kind: 'charger', x: 142 * 16, y: 11 * 16, range: 50 });
    const foe = new WorldFoe(first.foe);
    for (let x = foe.x; x < foe.x + foe.width; x++) {
        assert.ok(isSolidTile(first.stage.level.tiles[11][Math.floor(x / 16)]));
        assert.ok(!isSolidTile(first.stage.level.tiles[10][Math.floor(x / 16)]));
    }
    assert.equal(first.stage.dialogues.length, 0, 'The first encounter teaches through spacing, without another tutorial.');
});

for (const arrival of arrivals) test(`first charger: ${arrival.run ? 'running' : 'walking'} ${arrival.hold}-frame jump from ${arrival.takeoff} leaves an observation and punish window`, () => {
    const h = firstChargerHarness(); arrive(h, arrival); observeFirstCharge(h); alive(h);
    assert.deepEqual(h.events.filter(e => e.phase !== 'land').map(e => e.phase), ['warning', 'attack', 'rest']);
    assert.ok(h.foe.x > h.game.player.data.position.x + h.game.player.data.width + 10,
        'The first complete charge stops short of the solid observation margin.');
    assert.equal(h.game.player.data.isGrounded, true);
    assert.equal(h.game.player.getFeetPosition().y, 11 * 16);
    const land = h.events.find(e => e.phase === 'land')!, attack = h.events.find(e => e.phase === 'attack')!;
    assert.ok(attack.frame - land.frame >= 40, 'Even the high running arrival retains at least 2/3 second on solid ground before the attack.');
    punishRest(h);
});

test('the identical checkpoint route exposes the old first-encounter failure', () => {
    const h = firstChargerHarness(138); arrive(h, arrivals[3]); observeFirstCharge(h);
    assert.equal(h.game.player.data.isDead, true, 'The former charge crossed the entire observation landing.');
    const warning = h.events.find(e => e.phase === 'warning')!, land = h.events.find(e => e.phase === 'land')!;
    assert.equal(warning.grounded, false);
    assert.ok(land.frame - warning.frame >= 18, 'The first warning was already substantially spent in the gap jump.');
});

test('the first charger remains dangerous if its vulnerable recovery is ignored', () => {
    const h = firstChargerHarness(); arrive(h, arrivals[3]); observeFirstCharge(h); alive(h);
    for (let frame = 0; frame < 240 && !h.game.player.data.isDead; frame++) h.step();
    assert.equal(h.game.player.data.isDead, true, 'The margin teaches one cycle; it is not a permanent safe spot.');
    assert.equal(h.foe.dead, false);
    assert.equal(h.events.filter(e => e.phase === 'attack').length, 2);
});

/** Capture production paint calls while leaving the existing death sprite/fade intact. */
function deathCuePaint(foe: WorldFoe) {
    const art = new WorldArt();
    const rectangles: { color: string; alpha: number }[] = [], spriteAlpha: number[] = [];
    let savedAlpha = 1;
    const context = {
        fillStyle: '', globalAlpha: 1,
        save() { savedAlpha = this.globalAlpha; }, restore() { this.globalAlpha = savedAlpha; },
        fillRect() { rectangles.push({ color: this.fillStyle, alpha: this.globalAlpha }); }
    };
    art.atlas.draw = () => { spriteAlpha.push(context.globalAlpha); };
    art.foe(context as unknown as CanvasRenderingContext2D, foe, foe.x - 120, 0, 0);
    return { rectangles, spriteAlpha };
}

test('authored first charger loses warning cues immediately when a ground pound defeats it', () => {
    const h = firstChargerHarness();
    arrive(h, { run: true, hold: 9, takeoff: 125.8 }); observeFirstCharge(h); alive(h);
    for (let frame = 0; frame < 65; frame++) h.step();
    for (let frame = 0; frame < 90 && !h.foe.dead; frame++) {
        h.step({ right: h.game.player.data.position.x < h.foe.x + 3,
            jump: frame < 9, jumpPressed: frame === 0, jumpReleased: frame === 9,
            down: frame >= 10, downPressed: frame === 10 });
        alive(h);
    }
    assert.equal(h.foe.dead, true);
    assert.equal(h.foe.phase, 'warning', 'The native kill interrupts the next warning.');
    assert.ok(h.effects.includes('hit'));
    for (let frame = 0; frame <= 22; frame++) {
        const paint = deathCuePaint(h.foe);
        assert.deepEqual(paint.rectangles, [], 'No warning meter, exclamation or directional arrows may survive defeat.');
        assert.deepEqual(paint.spriteAlpha, h.foe.deadTimer > 360 ? [] : [Math.max(0, 1 - h.foe.deadTimer / 360)]);
        h.step(); alive(h);
    }
});

test('live foe cues remain visible; defeat suppresses attack, recovery and loose-helmet overlays', () => {
    for (const phase of ['warning', 'attack', 'rest'] as const) {
        const foe = new WorldFoe({ id: 'cue', kind: 'charger', x: 120, y: 176 });
        foe.phase = phase; foe.timer = 300;
        assert.ok(deathCuePaint(foe).rectangles.length > 0);
        assert.equal(foe.contact({ x: 122, y: foe.y - 10, width: 14, height: 20 },
            { x: 122, y: foe.y - 21, width: 14, height: 20 }, true, true), 'kill');
        assert.deepEqual(deathCuePaint(foe).rectangles, []);
        assert.deepEqual(deathCuePaint(foe).spriteAlpha, [1]);
    }
    const helmet = new WorldFoe({ id: 'helmet-cue', kind: 'helmet', x: 120, y: 176 });
    const player = { x: 122, y: helmet.y - 10, width: 14, height: 20 };
    const previous = { ...player, y: helmet.y - 21 };
    assert.equal(helmet.contact(player, previous, true, false), 'bounce');
    assert.ok(deathCuePaint(helmet).rectangles.length > 0);
    assert.equal(helmet.contact(player, previous, true, false), 'kill');
    assert.deepEqual(deathCuePaint(helmet).rectangles, []);
});
