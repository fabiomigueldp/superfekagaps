import { continueGuairaCourse } from './helpers/guairaCourseController';
import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { chapterExcursionBrowser } from './helpers/chapterExcursionHarness';
import type { GuairaChapterApp } from '../src/adventure/experimental/guaira/chapter/GuairaChapterApp';
import { readFileSync } from 'node:fs';
import { ProgressStore } from '../src/adventure/progress';
import { guairaChapterRoute } from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import type { GuairaChapterSceneId } from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import type { WorldGame } from '../src/adventure/WorldGame';
import type { GuairaMayorLab } from '../src/adventure/experimental/guaira/GuairaMayorLab';
import { GUAIRA_RESPIROS as G, GuairaRespiros } from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import { jetCycleTick } from '../src/adventure/WorldMachineState';

const STEP = 1000 / 60;
function fixture(t: TestContext) {
    const h = chapterExcursionBrowser(t);
    const pad = { index: 0, id: 'Guaíra standard controller fixture', connected: true, mapping: 'standard', axes: [0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    let focused = true, connected = true, polls = 0;
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => { polls++; return connected ? [pad] : []; } });
    Object.assign(h.document, { hasFocus: () => focused });
    const hold = (...indices: number[]) => pad.buttons.forEach((b, i) => { b.pressed = indices.includes(i); b.value = b.pressed ? 1 : 0; });
    const step = (app: GuairaChapterApp, frames = 1) => { for (let i = 0; i < frames; i++) app.activeGame?.update(STEP); };
    const press = (app: GuairaChapterApp, ...indices: number[]) => { hold(); step(app); hold(...indices); step(app); };
    return { ...h, pad, hold, step, press, polls: () => polls,
        focused: (value: boolean) => { focused = value; },
        connected: (value: boolean) => { connected = value; h.window.dispatch(value ? 'gamepadconnected' : 'gamepaddisconnected', { gamepad: pad }); } };
}
async function ready(app: GuairaChapterApp) {
    const deadline = performance.now() + 5000;
    while (app.mode === 'loading' && performance.now() < deadline) await nextTurn();
    assert.equal(app.mode, 'game'); assert.ok(app.activeGame); return app.activeGame;
}

test('the mounted chapter receives native controller movement, jump, run and pound', async t => {
    const h = fixture(t), app = h.create({ initialScene: 'guaira-travessia' }), g = await ready(app);
    h.step(app); const start = g.player.data.position.x;
    h.hold(15, 2); h.step(app, 12);
    assert.ok(g.player.data.position.x > start + 20, 'a controller must continue working after entering Guaíra');
    assert.equal(g.input.getState().run, true);
    h.hold(0); h.step(app, 8); assert.equal(g.player.data.isGrounded, false);
    h.hold(13); h.step(app); assert.equal(g.input.getState().downPressed, true);
});

const state = (g: WorldGame) => JSON.stringify({ p: g.player.data, o: g.objects, b: g.boss, c: g.camera, t: g.time, coins: g.coins });

test('Start, options, help and back keep one paused attempt and require new gestures at each layer', async t => {
    const h = fixture(t), app = h.create({ initialScene: 'guaira-travessia' }), g = await ready(app);
    h.press(app, 9); assert.equal(g.state, 'paused');
    const paused = state(g); h.step(app, 40); assert.equal(state(g), paused);
    h.press(app, 13); assert.equal(h.document.activeElement, h.byId('chapter-options'));
    h.press(app, 0); assert.equal(h.byId('chapter-pause-options').hidden, false);
    h.step(app, 30); assert.equal(g.state, 'paused'); assert.equal(state(g), paused);
    h.press(app, 13); assert.equal(h.document.activeElement, h.byId('chapter-controls'));
    h.press(app, 0); const dialog = h.byId('chapter-controls-help');
    assert.equal((dialog as unknown as HTMLDialogElement).open, true);
    h.step(app, 30); assert.equal((dialog as unknown as HTMLDialogElement).open, true, 'held confirm must not close the help it opened');
    let scrolled = 0; Object.assign(dialog.children[1], { scrollBy: (options: ScrollToOptions) => { scrolled += options.top ?? 0; } });
    h.press(app, 13); assert.equal(scrolled, 96);
    h.press(app, 1); assert.equal((dialog as unknown as HTMLDialogElement).open, false);
    h.step(app, 30); assert.equal(h.byId('chapter-pause-options').hidden, false, 'held back cannot cross a second layer');
    h.press(app, 1); assert.equal(h.byId('chapter-pause-options').hidden, true);
    assert.equal(state(g), paused);
    h.press(app, 9); assert.equal(g.state, 'playing'); assert.equal(h.document.activeElement, h.byId('game-canvas'));
    h.step(app, 20); assert.equal(g.state, 'playing'); assert.equal(g.input.getState().jump, false);
});

test('disconnect, hidden page and foreign focus cancel the controller without stealing keyboard input', async t => {
    const h = fixture(t), app = h.create({ initialScene: 'guaira-travessia' }), g = await ready(app);
    h.press(app, 15); assert.equal(g.input.getState().right, true);
    h.connected(false); h.step(app); assert.equal(g.input.getState().right, false);
    h.connected(true); h.step(app, 10); assert.equal(g.input.getState().right, false, 'held direction cannot rearm on reconnect');
    const canvas = h.byId('game-canvas');
    h.window.dispatch('keydown', { code: 'ArrowLeft', key: 'ArrowLeft', target: canvas });
    h.step(app); assert.equal(g.input.getState().left, true, 'independent keyboard owner survives');
    h.window.dispatch('keyup', { code: 'ArrowLeft', key: 'ArrowLeft', target: canvas });
    h.press(app, 9); assert.equal(g.state, 'paused');
    const polls = h.polls(), snapshot = state(g);
    h.document.hidden = true; h.document.dispatch('visibilitychange'); h.hold(0); h.step(app, 5);
    assert.equal(h.polls(), polls); assert.equal(state(g), snapshot);
    h.document.hidden = false; h.document.dispatch('visibilitychange'); h.step(app, 10); assert.equal(g.state, 'paused');
    h.focused(false); h.step(app); h.focused(true); h.step(app); assert.equal(g.state, 'paused');
    h.hold(); h.step(app); const outside = h.document.createElement('button'); h.body.append(outside); outside.focus();
    const before = h.polls(); h.hold(9); h.step(app, 10); assert.equal(h.polls(), before); assert.equal(g.state, 'paused');
    canvas.focus(); h.step(app, 10); assert.equal(g.state, 'paused');
    h.press(app, 9); assert.equal(g.state, 'playing');
});

type Tape = { initialSettleFrames?: number; runs: Array<[number, string[]]> };
const read = (name: string) => JSON.parse(readFileSync(new URL(`./helpers/${name}.json`, import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const field = read('guairaFieldRoutesReplays'), readable = read('guairaReadableRoutesReplays');
const tapes: Record<string, Tape> = {
    'guaira-travessia': field.travessia, 'guaira-patio-comportas': read('guairaJunctionOptionalReplay'),
    'guaira-respiros': field.respiros, 'guaira-lab': read('guairaLabReplay'), 'guaira-subida': read('guairaRooftopReplay'),
    'guaira-prefeito': read('guairaMayorReplay'), gallery: readable.galeria, relief: read('guairaReliefRoutesReplays').high,
};
const buttons: Record<string, number> = { ArrowLeft: 14, ArrowRight: 15, Space: 0, ShiftLeft: 2, ArrowDown: 13 };
for (const [id, tape] of Object.entries(tapes)) test(`native controller completes ${id} and owns its completion menu`, async t => {
    const h = fixture(t), store = new ProgressStore(null, false), route = guairaChapterRoute('guaira-travessia');
    // Scene-entry prerequisite fixture only. No live actor, mechanism, clock or result is written.
    const scene = id as GuairaChapterSceneId | 'gallery' | 'relief';
    if (route.includes(scene as GuairaChapterSceneId)) store.save.guaira.completed = route.slice(0, route.indexOf(scene as GuairaChapterSceneId));
    const app = h.create({ initialScene: scene, progressStore: store }), g = await ready(app);
    h.step(app); // A real neutral step after the map-to-game handoff.
    const completed = () => id === 'guaira-lab' ? g.boss?.phase === 'defeated' : id === 'guaira-prefeito'
        ? (g as GuairaMayorLab).mayor.publicWaterOpen : (g as WorldGame & { finished: boolean }).finished;
    let frame = 0;
    route: for (const [count, keys] of [[tape.initialSettleFrames ?? 0, []], ...tape.runs] as Array<[number, string[]]>) {
        h.hold(...keys.map(key => { assert.ok(key in buttons, key); return buttons[key]; }));
        for (let n = 0; n < count; n++) {
            h.step(app); frame++;
            assert.equal(g.player.data.isDead, false, `alive at ${frame}`);
            assert.equal(g.player.data.hasHelmet, true, `helmet at ${frame}`);
            if (completed()) break route;
        }
    }
    assert.equal(completed(), true);
    // A button held at the first completion-menu sample must be released before it can confirm.
    h.hold(0); h.step(app, 12); assert.equal(app.activeGame === g, true);
    h.press(app, 9); assert.equal(g.state, 'paused'); const snapshot = state(g);
    h.step(app, 12); assert.equal(state(g), snapshot);
    h.press(app, 9); assert.equal(g.state, 'playing');
    h.press(app, 0); // Continue, Alívio or Outra rota, according to the live native result.
    assert.equal(app.activeGame === g, false); assert.equal(g.isDisposed, true);
    if (id === 'gallery' || id === 'relief') { await ready(app); h.step(app, 12); assert.equal(app.activeGame!.player.data.isGrounded, true, 'held confirm cannot jump in the replacement scene'); }
});

for (const checkpoint of [false, true]) test(`a real water mistake recovers through controller input ${checkpoint ? 'at the checkpoint' : 'from the entrance'}`, async t => {
    const h = fixture(t), store = new ProgressStore(null, false); store.save.guaira.completed = ['guaira-travessia'];
    const app = h.create({ initialScene: 'guaira-respiros', progressStore: store }), g = await ready(app) as GuairaRespiros;
    h.step(app);
    const walk = (x: number) => {
        h.hold(15);
        for (let n = 0; n < 700 && g.player.data.position.x < x && !g.player.data.isDead; n++) h.step(app);
        assert.ok(g.player.data.position.x >= x, `reach ${x} using native walking`);
        h.hold();
    };
    const waitDry = (id: string) => {
        h.hold(); h.step(app, 30);
        for (let n = 0; n < 252; n++) {
            const tick = jetCycleTick(g.objects.get(id)!, g.objects.time);
            if (tick >= 2500 && tick < 2534) return;
            h.step(app);
        }
        assert.fail('a full pressure cycle must expose a dry departure');
    };
    if (checkpoint) { walk(128); waitDry(G.firstJetId); walk(G.checkpointX); assert.equal(g.store.save.checkpoint?.index, 0); }
    // Walk into real water, then hesitate on the grate. No position, timer, damage or receipt injection.
    walk(checkpoint ? 460 : 200); const before = g.player;
    let sawDamage = false, sawDeath = false;
    for (let n = 0; n < 1000 && g.player === before; n++) {
        h.step(app); sawDamage ||= !g.player.data.hasHelmet; sawDeath ||= g.player.data.isDead;
    }
    assert.ok(sawDamage && sawDeath); assert.equal(g.player === before, false);
    assert.equal(g.player.data.position.x, checkpoint ? G.checkpointX : G.spawnX);
    assert.equal(g.player.data.hasHelmet, true); assert.equal(g.finished, false);
    h.step(app, 30); // Native reveal, then neutral controller rearming.
    if (!checkpoint) { walk(128); waitDry(G.firstJetId); walk(G.checkpointX); }
    waitDry(G.secondJetId); walk(G.finalCheckpointX);
    waitDry(G.thirdJetId); walk(G.finalRefugeX); waitDry(G.fourthJetId); walk(1088);
    const buttons:Record<string,number>={ArrowRight:15,ArrowLeft:14,ArrowDown:13,ShiftLeft:2,Space:0};
    const result=continueGuairaCourse(g,keys=>{h.hold(...keys.map(k=>buttons[k]));h.step(app);});
    assert.ok(result.finished&&!result.dead);h.hold();
    assert.equal(g.finished, true); assert.equal(g.player.data.hasHelmet, true);
    assert.equal(app.snapshot.accepted.length <= 2, true, 'mistakes cannot award or skip bosses');
});
