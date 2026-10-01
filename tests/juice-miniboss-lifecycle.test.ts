import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Input } from '../src/engine/Input';
import { Renderer } from '../src/engine/Renderer';
import { Player } from '../src/entities/Player';
import { STAGES } from '../src/adventure/campaign';
import { freshSave, SAVE_KEY } from '../src/adventure/progress';
import { WorldGame } from '../src/adventure/WorldGame';
import { JuiceMinibossLab } from '../src/adventure/experimental/JuiceMinibossLab';
import type { JuiceMinibossModel } from '../src/adventure/experimental/JuiceMinibossModel';

const STEP = 1000 / 60;
type Listener = (event: Record<string, unknown>) => void;

/** Browser boundaries only: the lab, renderer, input, player and encounter are real. */
class EventSurface {
    private listeners = new Map<string, Array<{ listener: Listener; capture: boolean }>>();
    addEventListener(type: string, listener: Listener, options?: boolean | { capture?: boolean }) {
        const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), { listener, capture }]);
    }
    dispatch(type: string, data: Record<string, unknown> = {}) {
        let prevented = false;
        const event = { target: this, currentTarget: this, repeat: false,
            preventDefault() { prevented = true; }, ...data };
        const listeners = this.listeners.get(type) ?? [];
        for (const capture of [true, false])
            for (const entry of listeners) if (entry.capture === capture) entry.listener(event);
        return prevented;
    }
}

class Element extends EventSurface {
    id = '';
    textContent = '';
    hidden = false;
    contentEditable = 'false';
    spellcheck = true;
    style: Record<string, string> = {};
    focused = false;
    closest() { return null; }
    matches() { return false; }
    get isContentEditable() { return this.contentEditable === 'true'; }
    setAttribute() {}
    focus() { this.focused = true; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 640, height: 360 }; }
}

class Canvas extends Element {
    width = 640;
    height = 360;
    drawCalls = 0;
    private context = Object.assign(Object.fromEntries([
        'beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'ellipse', 'fill', 'stroke',
        'fillRect', 'strokeRect', 'clearRect', 'save', 'restore', 'setTransform', 'translate',
        'scale', 'rotate', 'rect', 'clip', 'drawImage'
    ].map(name => [name, () => { this.drawCalls++; }])), {
        globalAlpha: 1, imageSmoothingEnabled: false,
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} })
    }) as unknown as CanvasRenderingContext2D;
    getContext() { return this.context; }
}

function browser(t: TestContext) {
    const canvas = new Canvas(); canvas.id = 'game-canvas';
    const status = new Element(); status.id = 'lab-status';
    const retry = new Element(); retry.id = 'lab-retry';
    const pause = new Element(); pause.id = 'lab-pause';
    const skip = new Element(); skip.id = 'lab-skip';
    const replay = new Element(); replay.id = 'lab-replay';
    const present = new Element(); present.id = 'lab-present';
    const elements = new Map<string, Element>([[canvas.id, canvas], [status.id, status], [retry.id, retry], [pause.id, pause], [skip.id, skip], [replay.id, replay], [present.id, present]]);
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const requestFrame = (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; };
    const document = Object.assign(new EventSurface(), {
        title: '', hidden: false, body: { style: {} }, querySelector: () => null,
        getElementById: (id: string) => elements.get(id) ?? null,
        createElement: (tag: string) => tag === 'canvas' ? new Canvas() : new Element()
    });
    const window = Object.assign(new EventSurface(), {
        innerWidth: 640, innerHeight: 440, devicePixelRatio: 1, requestAnimationFrame: requestFrame,
        worldGame: undefined as WorldGame | undefined
    });
    const savedCampaign = JSON.stringify({ ...freshSave(), completed: ['1-1'], selected: '1-2' });
    const storageCalls: string[] = [];
    const storage = {
        getItem(key: string) { storageCalls.push(`get:${key}`); return key === SAVE_KEY ? savedCampaign : null; },
        setItem(key: string) { storageCalls.push(`set:${key}`); },
        removeItem(key: string) { storageCalls.push(`remove:${key}`); },
        clear() { storageCalls.push('clear'); }
    };
    const original = new Map<string, PropertyDescriptor | undefined>();
    function global(name: string, descriptor: PropertyDescriptor) {
        original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, { configurable: true, ...descriptor });
    }
    t.after(() => {
        for (const [name, descriptor] of original) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else Reflect.deleteProperty(globalThis, name);
        }
        assert.deepEqual(storageCalls, [], 'The ephemeral lab must not even look up localStorage.');
    });
    for (const [name, value] of Object.entries({ document, window, HTMLElement: Element,
        navigator: { maxTouchPoints: 0 }, location: { hash: '' },
        innerWidth: window.innerWidth, innerHeight: window.innerHeight, requestAnimationFrame: requestFrame }))
        global(name, { writable: true, value });
    const storageDescriptor = { get() { storageCalls.push('localStorage'); return storage; } };
    global('localStorage', storageDescriptor);
    Object.defineProperty(window, 'localStorage', storageDescriptor);

    function key(key: string, repeat = false) {
        const code = key === ' ' ? 'Space' : key.length === 1 ? `Key${key.toUpperCase()}` : key;
        window.dispatch('keydown', { key, code, repeat, target: canvas });
        if (!repeat) window.dispatch('keyup', { key, code, target: canvas });
    }
    function pointer(x: number, y: number) { canvas.dispatch('pointerdown', { clientX: x * 2, clientY: y * 2 }); }
    function hidden(value: boolean) { document.hidden = value; document.dispatch('visibilitychange'); }
    function create(withIntro = false) { const game = new JuiceMinibossLab(canvas as unknown as HTMLCanvasElement, status as unknown as HTMLElement); if (!withIntro) game.skipIntro(); return game; }
    function frame() {
        const pending = [...frames]; frames.clear();
        for (const [, callback] of pending) callback(performance.now());
    }
    return { canvas, status, retry, pause, skip, replay, present, document, window, frames, storageCalls, create, key, pointer, hidden, frame };
}

function encounter(game: JuiceMinibossLab) {
    assert.ok(game.boss, 'The real constructor installs an experimental encounter.');
    return game.boss as NonNullable<typeof game.boss> & { model: JuiceMinibossModel };
}
function advance(game: JuiceMinibossLab, count = 1) { for (let i = 0; i < count; i++) game.update(STEP); }
function snapshot(game: JuiceMinibossLab) {
    return structuredClone({ player: game.player.data, model: encounter(game).model, time: game.time, elapsed: game.elapsed });
}
function defeat(game: JuiceMinibossLab) {
    const boss = encounter(game), model = boss.model;
    model.health = 1; model.phase = 'recover'; model.phaseTime = 0;
    const player = { x: model.x + 5, y: model.y - 20, width: 14, height: 24 };
    assert.equal(boss.contact(player, { ...player, y: model.y - player.height - 2 }, true), 'defeated');
    assert.equal(boss.phase, 'defeated');
}

test('real lab constructor loads a cloned standalone arena without reading campaign storage', t => {
    const h = browser(t), authored = structuredClone(STAGES), game = h.create();
    assert.ok(game instanceof WorldGame);
    assert.ok(game.input instanceof Input);
    assert.ok(game.renderer instanceof Renderer);
    assert.ok(game.player instanceof Player);
    assert.equal(h.window.worldGame, game);
    assert.equal(game.state, 'playing');
    assert.equal(game.stage.id, 'juice-lab');
    assert.equal(game.level.data.id, 'experimental-juice-lab');
    assert.equal(encounter(game).model.health, encounter(game).model.maxHealth);
    assert.equal(encounter(game).model.phase, 'intro');
    for (const key of ['foes', 'exits', 'pickups', 'checkpoints', 'dialogues', 'mechanisms'] as const)
        assert.deepEqual(game.stage[key], [], `No campaign ${key} should leak into the arena.`);
    assert.match(h.document.title, /Turbosuco/);
    assert.match(h.status.textContent, /Experimento/);
    assert.deepEqual(game.store.save.completed, [], 'An existing campaign save is not imported into the lab.');
    game.render();
    assert.ok(h.canvas.drawCalls > 0, 'The complete real renderer can present the experimental arena.');
    assert.deepEqual(STAGES, authored, 'Constructing and rendering the lab must not mutate campaign stage data.');
    assert.deepEqual(h.storageCalls, []);
});

test('Escape pauses through real input and resumes through the registered menu listener', t => {
    const h = browser(t), game = h.create();
    advance(game, 5);
    h.key('Escape'); advance(game);
    assert.equal(game.state, 'paused');
    const frozen = snapshot(game);
    advance(game, 90); game.render(); game.render();
    assert.deepEqual(snapshot(game), frozen, 'Repeated update and render calls leave a paused fight frozen.');
    assert.match(h.status.textContent, /Pausado/);
    h.key('Escape', true);
    assert.equal(game.state, 'paused', 'Held Escape cannot immediately resume the fight.');
    h.key('Escape');
    assert.equal(game.state, 'playing');
    advance(game);
    assert.equal(game.state, 'playing', 'The resume key must not remain queued and pause again.');
    assert.ok(encounter(game).model.time > frozen.model.time);
    game.render();
    assert.doesNotMatch(h.status.textContent, /Pausado/, 'Resume must replace the paused status text.');
});

test('canvas HUD and page visibility pause the real lab without advancing the encounter', t => {
    const h = browser(t), game = h.create();
    for (const pause of [() => h.pointer(305, 10), () => h.hidden(true)]) {
        advance(game, 2); pause();
        assert.equal(game.state, 'paused');
        const frozen = snapshot(game);
        advance(game, 60); game.render();
        assert.deepEqual(snapshot(game), frozen);
        h.hidden(false);
        assert.equal(game.state, 'paused', 'Returning to the tab cannot silently resume a fight.');
        h.key('Escape'); advance(game);
        assert.equal(game.state, 'playing');
    }
});

test('paused lab rendering never exposes or activates the campaign menu', t => {
    const h = browser(t), game = h.create();
    const internals = game as unknown as { buttons: Array<{ run(): void }>; complete(secret: boolean): void };
    const before = structuredClone(game.store.save);
    h.pointer(305, 10); game.render();
    assert.equal(game.state, 'paused');
    assert.deepEqual(internals.buttons, [], 'Campaign map/settings/export callbacks must never be installed.');
    // These are the inherited WorldGame pause-menu hit targets; no callback should run.
    for (const y of [76, 98, 120, 142]) {
        h.pointer(160, y); h.key('ArrowDown'); h.key('Enter'); game.render();
        assert.equal(game.state, 'paused');
        assert.deepEqual(internals.buttons, []);
    }
    assert.deepEqual(game.store.save, before);
    h.key('Escape'); advance(game);
    assert.equal(game.state, 'playing');
    assert.deepEqual(game.store.save, before);
});

test('the real retry button resets boss, player, queued input and pause state', async t => {
    const h = browser(t);
    await import('../src/juice-lab');
    const game = h.window.worldGame;
    assert.ok(game instanceof JuiceMinibossLab);
    assert.equal(game.labMode, 'intro');
    h.skip.dispatch('click'); assert.equal(game.labMode, 'combat');
    h.replay.dispatch('click'); assert.equal(game.labMode, 'intro');
    for (let i=0;i<1000 && game.intro?.beat !== 'prepare';i++) game.intro?.advance(100,{right:true});
    advance(game, 12); h.present.dispatch('click'); advance(game);
    assert.equal(game.intro?.beat, 'reveal', 'The real accessible presentation control triggers the pose.');
    assert.equal(h.frames.size, 2, 'The actual entrypoint starts gameplay and accessible-control refresh.');
    h.pause.dispatch('click'); h.frame();
    assert.equal(game.state, 'paused');
    assert.equal(h.pause.textContent, 'Continuar');
    h.pause.dispatch('click'); h.frame();
    assert.equal(game.state, 'playing');
    assert.equal(h.pause.textContent, 'Pausar');
    game.load('juice-lab');
    const initialPlayer = structuredClone(game.player.data);
    const initialBoss = structuredClone(encounter(game).model);
    for (const afterVictory of [false, true]) {
        const oldBoss = encounter(game), oldPlayer = game.player;
        advance(game, 30);
        oldBoss.model.health = 2;
        oldBoss.model.drops.push({ x: 90, y: 150, width: 8, height: 8, vx: .1, vy: 0, life: 500 });
        oldPlayer.data.position.x = 120; oldPlayer.data.velocity.x = 4;
        oldPlayer.data.hasHelmet = true; oldPlayer.die('hit');
        if (afterVictory) defeat(game);
        h.pointer(305, 10);
        h.window.dispatch('keydown', { key: 'ArrowRight', code: 'ArrowRight', target: h.canvas });
        h.retry.dispatch('click');
        assert.equal(game.state, 'playing');
        assert.notEqual(game.player, oldPlayer);
        assert.notEqual(game.boss, oldBoss);
        assert.deepEqual(game.player.data, initialPlayer);
        assert.deepEqual(structuredClone(encounter(game).model), initialBoss);
        assert.equal(game.elapsed, 0); assert.equal(game.coins, 0);
        assert.equal(h.canvas.focused, true);
        assert.match(h.status.textContent, /Experimento/);
        assert.equal(game.input.getState().right, false);
        assert.equal(game.input.getState().pause, false);
        advance(game);
        assert.equal(game.player.data.position.x, initialPlayer.position.x, 'Retry discards held gameplay keys.');
        assert.equal(game.state, 'playing');
    }
});

test('defeat advances only the lab outcome and never invokes campaign completion or persistence', t => {
    const h = browser(t), game = h.create();
    const internals = game as unknown as { complete(secret: boolean): void };
    let completions = 0, persists = 0;
    const complete = internals.complete;
    internals.complete = function(secret) { completions++; return complete.call(game, secret); };
    const persist = game.store.persist;
    game.store.persist = function() { persists++; return persist.call(this); };
    const boss = encounter(game), model = boss.model;
    model.health = 1; model.phase = 'recover'; model.phaseTime = 0;
    game.player.data.position = { x: model.x + 5, y: model.y - game.player.data.height - 1 };
    game.player.data.velocity = { x: 0, y: 2 };
    const save = structuredClone(game.store.save);
    advance(game);
    assert.equal(boss.phase, 'defeated', 'The real WorldGame update resolves the final falling stomp.');
    assert.equal(model.health, 0);
    advance(game, 240); game.render();
    assert.equal(game.state, 'playing');
    assert.equal(encounter(game).phase, 'defeated');
    assert.ok(encounter(game).timer > 1150, 'Observe beyond the inherited campaign completion timeout.');
    assert.equal(completions, 0);
    assert.equal(persists, 0);
    assert.deepEqual(game.store.save, save);
    assert.deepEqual(encounter(game).model.hazards, []);
    assert.match(h.status.textContent, /Vitória/);
});

test('Escape remains usable after victory and a paused victory remains frozen', t => {
    const h = browser(t), game = h.create();
    defeat(game); advance(game, 3);
    h.key('Escape'); advance(game);
    assert.equal(game.state, 'paused', 'Victory must still process Escape through actual gameplay input.');
    const frozen = snapshot(game);
    advance(game, 90); game.render();
    assert.deepEqual(snapshot(game), frozen);
    h.key('Escape'); advance(game);
    assert.equal(game.state, 'playing');
    assert.equal(encounter(game).phase, 'defeated');
    assert.ok(encounter(game).model.time > frozen.model.time);
});


test('death automatically restarts a fresh experimental encounter without loading campaign progress', t => {
    const h = browser(t), game = h.create();
    const oldBoss = encounter(game), oldPlayer = game.player;
    oldBoss.model.health = 2;
    oldBoss.model.drops.push({ x: 90, y: 150, width: 8, height: 8, vx: .1, vy: 0, life: 500 });
    oldPlayer.die('hit');
    for (let i = 0; game.player === oldPlayer && i < 180; i++) advance(game);
    assert.notEqual(game.player, oldPlayer, 'The actual death timer reaches automatic retry.');
    assert.notEqual(game.boss, oldBoss);
    assert.equal(game.stage.id, 'juice-lab');
    assert.equal(game.state, 'playing');
    assert.equal(game.player.data.isDead, false);
    assert.equal(encounter(game).model.health, encounter(game).model.maxHealth);
    assert.equal(encounter(game).model.phase, 'intro');
    assert.deepEqual(encounter(game).model.drops, []);
    assert.deepEqual(game.store.save.completed, []);
});


test('stage introduction freezes encounter, pauses, skips and replays without touching storage', t => {
    const h = browser(t), authored = structuredClone(STAGES), game = h.create(true);
    assert.equal(game.labMode, 'intro');
    const model = encounter(game).model;
    advance(game, 220); game.render();
    assert.equal(game.intro?.beat, 'walk');
    assert.equal(model.time, 0); assert.equal(model.health, model.maxHealth);
    h.key('Escape'); advance(game);
    const before = JSON.stringify(game.intro?.frame);
    advance(game, 200); game.render();
    assert.equal(JSON.stringify(game.intro?.frame), before);
    game.skipIntro();
    assert.equal(game.state, 'paused', 'Skip preserves pause intent');
    assert.equal(game.labMode, 'combat');
    assert.equal(game.player.data.position.x, 68);
    assert.equal(encounter(game).model.time, 0);
    h.key('Escape'); advance(game, 5);
    assert.ok(encounter(game).model.time > 0);
    game.load('juice-lab'); assert.equal(game.labMode, 'combat');
    game.replayIntro(); assert.equal(game.labMode, 'intro');
    assert.equal(game.intro?.beat, 'establish');
    assert.deepEqual(STAGES, authored); assert.deepEqual(h.storageCalls, []);
});

test('complete staged route hands off once, without stale presentation input or hidden attack time', t => {
    const h = browser(t), game = h.create(true); const cues: string[] = [];
    game.onIntroCue = cue => cues.push(cue);
    for (let n = 0; n < 4000 && game.labMode === 'intro'; n++) {
        game.intro!.advance(STEP, { right: true, presentPressed: true });
        game.update(STEP);
    }
    assert.equal(game.labMode, 'combat'); assert.equal(game.intro, null);
    assert.equal(encounter(game).model.time, 0);
    assert.equal(encounter(game).model.phase, 'intro');
    assert.equal(game.player.data.velocity.y, 0);
    assert.equal(cues.filter(c => c === 'combat').length, 1);
    game.skipIntro(); assert.equal(cues.filter(c => c === 'combat').length, 1);
    assert.deepEqual(h.storageCalls, []);
});

test('real Escape resumes an introduction through inherited menu listener without re-pausing', t => {
    const h = browser(t), game = h.create(true);
    advance(game, 12);
    h.key('Escape'); advance(game);
    assert.equal(game.state, 'paused');
    const time = game.intro!.timeMs;
    advance(game, 60); assert.equal(game.intro!.timeMs, time);
    h.key('Escape', true); assert.equal(game.state, 'paused');
    h.key('Escape');
    assert.equal(game.state, 'playing', 'WorldGame.menuKey handles resume synchronously.');
    advance(game);
    assert.equal(game.state, 'playing', 'Resume clears the queued pause input.');
    assert.ok(game.intro!.timeMs > time);
    assert.equal(encounter(game).model.time, 0, 'Resuming the scene must not advance combat.');
    game.render(); assert.doesNotMatch(h.status.textContent, /Pausado/);
});
