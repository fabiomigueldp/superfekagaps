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
import type { JuiceIntroAudio } from '../src/adventure/experimental/JuiceIntroAudio';

const STEP = 1000 / 60;
type Listener = (event: Record<string, unknown>) => void;

/** Browser boundaries only: the lab, renderer, input, player and encounter are real. */
class EventSurface {
    private listeners = new Map<string, Array<{ listener: Listener; capture: boolean }>>();
    addEventListener(type: string, listener: Listener, options?: boolean | { capture?: boolean }) {
        const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), { listener, capture }]);
    }
    removeEventListener(type: string, listener: Listener, options?: boolean | { capture?: boolean }) {
        const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
        this.listeners.set(type, (this.listeners.get(type) ?? []).filter(entry => entry.listener !== listener || entry.capture !== capture));
    }
    get listenerCount() { return [...this.listeners.values()].reduce((count, entries) => count + entries.length, 0); }
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
    tagName = 'DIV';
    className = '';
    title = '';
    children: Element[] = [];
    readonly attributes = new Map<string, string>();
    private ownText = '';
    get textContent(): string { return this.ownText + this.children.map(child => child.textContent).join(''); }
    set textContent(value: string) { this.ownText = value; this.children = []; }
    hidden = false;
    contentEditable = 'false';
    spellcheck = true;
    style: Record<string, string> = {};
    focused = false;
    closest(selector: string): Element | null {
        return this.tagName === 'BUTTON' && selector.includes('button') || this.tagName === 'A' && selector.includes('a[href]') ? this : null;
    }
    matches() { return false; }
    get isContentEditable() { return this.contentEditable === 'true'; }
    append(...children: Element[]) { this.children.push(...children); }
    setAttribute(key: string, value: string) { this.attributes.set(key, value); }
    getAttribute(key: string) { return this.attributes.get(key) ?? null; }
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

function browser(t: TestContext, reducedMotion = false) {
    const canvas = new Canvas(); canvas.id = 'game-canvas';
    const status = new Element(); status.id = 'lab-status';
    const retry = new Element(); retry.id = 'lab-retry';
    const pause = new Element(); pause.id = 'lab-pause';
    const skip = new Element(); skip.id = 'lab-skip';
    const replay = new Element(); replay.id = 'lab-replay';
    const present = new Element(); present.id = 'lab-present';
    const exit = new Element(); exit.id = 'lab-exit'; exit.tagName = 'A';
    for (const button of [retry, pause, skip, replay, present]) button.tagName = 'BUTTON';
    const elements = new Map<string, Element>([canvas, status, retry, pause, skip, replay, present, exit].map(element => [element.id, element]));
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const requestFrame = (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; };
    const cancelFrame = (id: number) => { frames.delete(id); };
    const matchMedia = (query: string) => Object.assign(new EventSurface(), {
        matches: reducedMotion && query === '(prefers-reduced-motion: reduce)', media: query,
    });
    const document = Object.assign(new EventSurface(), {
        title: '', hidden: false, body: { style: {} }, querySelector: () => null,
        getElementById: (id: string) => elements.get(id) ?? null,
        createElement: (tag: string) => tag === 'canvas' ? new Canvas() : new Element()
    });
    const window = Object.assign(new EventSurface(), {
        innerWidth: 640, innerHeight: 440, devicePixelRatio: 1, requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame, matchMedia,
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
        innerWidth: window.innerWidth, innerHeight: window.innerHeight, requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame, matchMedia }))
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
    return { canvas, status, retry, pause, skip, replay, present, exit, document, window, frames, storageCalls, create, key, pointer, hidden, frame };
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

test('fan audio follows actual projectile release and finishing a fan cannot shake the arena', t => {
    const h = browser(t), game = h.create(), boss = encounter(game), b = boss.model;
    b.phase = 'attack'; b.attack = 'fan'; b.targetX = 80; b.targetY = 210;
    let releases = 0;
    for (let i = 0; i < 40; i++) {
        const before = b.drops.length;
        boss.update(STEP, game.player.getRect(), game.objects, game.level);
        if (boss.released) {
            releases++;
            assert.equal(before, 0); assert.equal(b.drops.length, 7, 'the sound is attached to the actual spit');
        }
        assert.equal(boss.impact, false, 'exhaling is not a floor impact');
    }
    assert.equal(releases, 1);
    assert.equal(b.phase, 'recover');
});

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

test('the real toolbar preserves bitmap names through intro, pause, replay and retry lifecycle', async t => {
    const h = browser(t);
    await import('../src/juice-lab');
    const game = h.window.worldGame;
    assert.ok(game instanceof JuiceMinibossLab);
    for (const [control, name] of [[h.pause, 'Pausar'], [h.present, 'Apresentar pose'],
        [h.skip, 'Pular introdução'], [h.replay, 'Rever introdução'],
        [h.retry, 'Tentar novamente'], [h.exit, 'Voltar ao jogo']] as const) {
        assert.equal(control.textContent, name);
        assert.equal(control.getAttribute('aria-label'), name);
        assert.equal(control.title, name, 'Compact bitmap copy has an unabridged tooltip.');
        const art = control.children[0];
        assert.ok(art instanceof Canvas);
        assert.equal(art.getAttribute('aria-hidden'), 'true', 'Only semantic text names the native control.');
        assert.equal(art.height, 44); assert.ok(art.width >= 44);
    }
    const pauseArt = h.pause.children[0] as Canvas;
    const pauseWidth = pauseArt.width;
    assert.equal(game.labMode, 'intro');
    assert.equal(h.retry.hidden, true, 'Intro uses Skip; redundant Retry must not force compact navigation to wrap.');
    assert.equal(h.skip.hidden, false); assert.equal(h.replay.hidden, true); assert.equal(h.present.hidden, true);
    h.skip.dispatch('click'); h.frame(); assert.equal(game.labMode, 'combat');
    assert.equal(h.retry.hidden, false, 'Retry is available during combat.');
    assert.equal(h.skip.hidden, true); assert.equal(h.replay.hidden, false); assert.equal(h.present.hidden, true);
    h.replay.dispatch('click'); h.frame(); assert.equal(game.labMode, 'intro');
    assert.equal(h.retry.hidden, true, 'Replay restores the compact intro controls.');
    assert.equal(h.skip.hidden, false); assert.equal(h.replay.hidden, true);
    for (let i=0;i<1000 && game.intro?.beat !== 'prepare';i++) game.intro?.advance(100,{right:true});
    advance(game, 12); h.frame();
    assert.equal(h.present.hidden, false);
    assert.equal(h.retry.hidden, true, 'Presentation and Retry never compete for the compact toolbar.');
    h.present.dispatch('click'); advance(game); h.frame();
    assert.equal(game.intro?.beat, 'reveal', 'The real accessible presentation control triggers the pose.');
    assert.equal(h.present.hidden, true, 'The pose action leaves the toolbar after presentation.');
    assert.equal(h.frames.size, 2, 'The actual entrypoint starts gameplay and accessible-control refresh.');
    h.pause.dispatch('click'); h.frame();
    assert.equal(game.state, 'paused');
    assert.equal(h.pause.textContent, 'Continuar');
    assert.equal(h.pause.getAttribute('aria-label'), 'Continuar'); assert.equal(h.pause.title, 'Continuar');
    assert.equal(h.pause.children[0], pauseArt, 'Updating the pause label preserves the bitmap child.');
    assert.ok(pauseArt.width > pauseWidth, 'The face is repainted for the full CONTINUAR label.');
    const pausedDraws = pauseArt.drawCalls; h.frame();
    assert.equal(pauseArt.drawCalls, pausedDraws, 'An unchanged frame does not repaint the control.');
    h.pause.dispatch('click'); h.frame();
    assert.equal(game.state, 'playing');
    assert.equal(h.pause.textContent, 'Pausar');
    assert.equal(h.pause.getAttribute('aria-label'), 'Pausar'); assert.equal(h.pause.title, 'Pausar');
    assert.equal(h.pause.children[0], pauseArt); assert.equal(pauseArt.width, pauseWidth);
    h.key('Escape'); advance(game); h.frame();
    assert.equal(h.pause.getAttribute('aria-label'), 'Continuar', 'Keyboard pause also refreshes the semantic action.');
    h.key('Escape'); advance(game); h.frame();
    assert.equal(h.pause.getAttribute('aria-label'), 'Pausar');
    h.skip.dispatch('click'); game.render(); h.frame();
    game.player.die('hit'); game.render(); h.frame();
    assert.match(h.status.textContent, /Feka caiu.*reinicia automaticamente/);
    h.pause.dispatch('click'); game.render(); h.frame();
    assert.match(h.status.textContent, /Pausado/, 'Pause takes precedence over the death announcement');
    h.pause.dispatch('click');
    for (let frame = 0; frame < 240 && game.player.data.isDead; frame++) advance(game);
    assert.equal(game.player.data.isDead, false, 'The native death pipeline restarted the fight');
    game.render(); h.frame();
    assert.match(h.status.textContent, /^Nova tentativa/);
    encounter(game).model.phase = 'recover'; game.render(); h.frame();
    assert.match(h.status.textContent, /Nova tentativa.*Abertura/, 'Recovery context retains actionable native combat hints');
    h.replay.dispatch('click'); game.render(); h.frame();
    assert.doesNotMatch(h.status.textContent, /Nova tentativa|Feka caiu/, 'Replay retires old fight feedback');
    assert.equal(h.frames.size, 2, 'Recovery feedback reuses the existing UI loop');
    game.load('juice-lab');
    const initialPlayer = structuredClone(game.player.data);
    const initialBoss = structuredClone(encounter(game).model);
    for (const afterVictory of [false, true]) {
        const oldBoss = encounter(game), oldPlayer = game.player;
        advance(game, 30);
        oldBoss.model.health = 2;
        oldBoss.model.drops.push({ x: 90, y: 150, width: 8, height: 8, vx: .1, vy: 0, life: 500 });
        oldBoss.model.geysers.push({ x: 149, y: 160, width: 22, height: 64, phase: 'warning', phaseTime: 430, progress: .48 });
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
    assert.deepEqual(h.storageCalls, [], 'Page feedback never reads or writes campaign saves');
    game.dispose(); h.frame();
    assert.equal(h.frames.size, 0, 'Native and toolbar loops stop after disposal');
});

test('final stomp settles its impact while advancing only the lab outcome without campaign completion', t => {
    const h = browser(t), game = h.create();
    const internals = game as unknown as { complete(secret: boolean): void; sparks: Array<{ life: number }> };
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
    assert.ok(game.camera.shakeTimer > 0, 'The actual final stomp starts camera feedback.');
    assert.ok(internals.sparks.length > 0, 'The actual final stomp emits particles.');
    advance(game, 240); game.render();
    assert.equal(game.state, 'playing');
    assert.equal(encounter(game).phase, 'defeated');
    assert.ok(encounter(game).timer > 1150, 'Observe beyond the inherited campaign completion timeout.');
    assert.equal(game.camera.shakeTimer, 0, 'The victory screen must settle instead of shaking forever.');
    assert.deepEqual(internals.sparks, [], 'Final-hit particles expire while the result remains open.');
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

test('native toolbar activation is not cancelled or leaked into gameplay in playing and paused states', t => {
    const h = browser(t), game = h.create(true), link = new Element(); link.tagName = 'A';
    for (const state of ['playing', 'paused'] as const) {
        game.state = state;
        for (const target of [h.pause, h.present, h.skip, h.replay, h.retry, link]) {
            for (const [key, code] of [['Enter', 'Enter'], [' ', 'Space']]) {
                game.input.reset();
                const prevented = h.window.dispatch('keydown', { key, code, target });
                assert.equal(prevented, false, `${state}/${target.id || 'link'}/${code} keeps native activation`);
                game.input.update();
                const input = game.input.getState();
                assert.equal(input.start, false); assert.equal(input.jump, false); assert.equal(input.jumpPressed, false);
                assert.equal(game.state, state, 'Native activation cannot invoke the canvas pause menu.');
                h.window.dispatch('keyup', { key, code, target });
            }
        }
    }
    game.state = 'title'; game.input.reset();
    const prevented = h.window.dispatch('keydown', { key: 'Enter', code: 'Enter', target: h.canvas });
    assert.equal(prevented, true, 'The ordinary canvas menu still owns Enter.');
});

test('movement gestures cannot resume paused audio; explicit Escape resume can', t => {
    const h = browser(t), game = h.create(true);
    const context = { state: 'running', currentTime: 0, resumes: 0,
        suspend() { this.state = 'suspended'; return Promise.resolve(); },
        resume() { this.resumes++; this.state = 'running'; return Promise.resolve(); } };
    (game.audio as unknown as { ctx: unknown }).ctx = context;
    game.toggleLabPause();
    for (const key of ['ArrowRight', 'ArrowLeft', 'a', 'd', ' ']) h.key(key);
    assert.equal(game.state, 'paused'); assert.equal(context.state, 'suspended'); assert.equal(context.resumes, 0);
    h.key('Escape');
    assert.equal(game.state, 'playing'); assert.equal(context.state, 'running'); assert.equal(context.resumes, 1);
});

test('toolbar intro pause clears pending presentation and impact input while preserving audio pause', t => {
    const h = browser(t), game = h.create(true);
    const internals = game as unknown as { pendingPresentation: boolean; hitStopInput: unknown; introAudio: { setPaused(value: boolean): void } };
    const audioStates: boolean[] = [];
    internals.introAudio.setPaused = value => audioStates.push(value);
    internals.pendingPresentation = true;
    internals.hitStopInput = { jumpPressed: false, jumpReleased: false, downPressed: true };
    game.toggleLabPause();
    assert.equal(game.state, 'paused'); assert.equal(internals.pendingPresentation, false); assert.equal(internals.hitStopInput, null);
    assert.equal(audioStates.at(-1), true);
    game.toggleLabPause();
    assert.equal(game.state, 'playing'); assert.equal(audioStates.at(-1), false);
    assert.equal(internals.pendingPresentation, false); assert.equal(internals.hitStopInput, null);
});


test('pausing during second-stage floor warnings freezes every timer and retry removes them', t => {
    const h = browser(t), game = h.create(), model = encounter(game).model;
    model.health = 2; model.phase = 'rest'; model.cycle = 0;
    advance(game, 28);
    assert.equal(model.phase, 'warning'); assert.equal(model.geysers.length, 2);
    assert.ok(model.geysers.every(g => g.phase === 'warning'));
    game.toggleLabPause(); const frozen = snapshot(game);
    advance(game, 90); game.render();
    assert.deepEqual(snapshot(game), frozen);
    game.toggleLabPause(); advance(game);
    assert.ok(model.geysers[0].phaseTime > frozen.model.geysers[0].phaseTime);
    game.load('juice-lab');
    assert.equal(encounter(game).model.health, 6);
    assert.equal(encounter(game).model.enraged, false);
    assert.deepEqual(encounter(game).model.geysers, []);
    assert.deepEqual(encounter(game).model.drops, []);
});


for (const reduced of [false, true]) {
    test(`combat impact camera honors the browser motion preference (${reduced ? 'reduced' : 'ordinary'})`, t => {
        const h = browser(t, reduced), game = h.create();
        assert.equal(game.reducedMotion, reduced);
        assert.equal(game.store.save.preferences.shake, !reduced);
        const views: number[] = [], drawPlayer = game.renderer.drawPlayer.bind(game.renderer);
        game.renderer.drawPlayer = (player, camera, ...args) => {
            views.push(camera.x); return drawPlayer(player, camera, ...args);
        };
        game.camera.shakeTimer = 180;
        game.time = 0; game.render(); game.time = 40; game.render();
        assert.equal(views.length, 2);
        if (reduced) assert.deepEqual(views, [game.camera.x, game.camera.x], 'Impact renders keep a stationary view.');
        else assert.notEqual(views[0], views[1], 'Ordinary motion retains impact feedback.');
        game.dispose();
    });
}

test('disposing an active introduction cancels voices, releases global callbacks and permits a clean remount', t => {
    const h = browser(t), surfaces = [h.window, h.document, h.canvas];
    const baseline = surfaces.map(surface => surface.listenerCount);
    const game = h.create(true), introAudio = (game as unknown as { introAudio: JuiceIntroAudio }).introAudio;
    const mounted = surfaces.map(surface => surface.listenerCount);
    assert.ok(mounted.some((count, i) => count > baseline[i]));
    // Stub WebAudio device nodes only. The real score schedules and owns its voices.
    const parameter = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
    const nodes: Array<{ disconnected: boolean; stops: Array<number | undefined> }> = [];
    const makeNode = () => {
        const node = { gain: parameter(), frequency: parameter(), type: '', onended: null,
            disconnected: false, stops: [] as Array<number | undefined>,
            connect() {}, disconnect() { this.disconnected = true; }, start() {},
            stop(when?: number) { this.stops.push(when); },
        };
        nodes.push(node); return node;
    };
    const route = { context: { state: 'running', currentTime: 0, createGain: makeNode, createOscillator: makeNode },
        destination: {}, enabled: true };
    game.audio.getEffectsRoute = () => route as unknown as ReturnType<typeof game.audio.getEffectsRoute>;
    assert.equal(introAudio.play('resolve'), true);
    assert.ok(introAudio.activeVoiceCount > 0);
    let unlocks = 0, cancellations = 0;
    const unlock = game.audio.unlock.bind(game.audio), cancel = introAudio.cancel.bind(introAudio);
    game.audio.unlock = () => { unlocks++; unlock(); };
    introAudio.cancel = () => { cancellations++; cancel(); };
    game.start(); assert.ok(h.frames.size > 0);
    game.dispose();
    assert.equal(game.isDisposed, true);
    assert.equal(introAudio.activeVoiceCount, 0);
    assert.ok(nodes.every(node => node.disconnected), 'Scheduled envelopes and sources disconnect immediately.');
    assert.ok(nodes.some(node => node.stops.includes(undefined)), 'Future score voices receive an immediate stop.');
    assert.deepEqual(surfaces.map(surface => surface.listenerCount), baseline, 'No canvas or global callback retains the discarded lab.');
    assert.equal(h.frames.size, 0); assert.equal(h.window.worldGame, undefined);
    assert.equal(introAudio.play('resolve'), false, 'Disposal is terminal even when an audio route remains available.');
    const cancelled = cancellations, oldState = game.state;
    h.key('ArrowRight'); h.window.dispatch('blur'); h.window.dispatch('pagehide'); h.hidden(true);
    assert.equal(unlocks, 0); assert.equal(cancellations, cancelled); assert.equal(game.state, oldState);
    h.hidden(false);
    const replacement = h.create(true);
    assert.deepEqual(surfaces.map(surface => surface.listenerCount), mounted, 'Remount installs exactly one scene worth of listeners.');
    h.window.dispatch('blur'); assert.equal(replacement.state, 'paused');
    assert.equal(game.state, oldState); assert.equal(cancellations, cancelled);
    replacement.dispose(); game.dispose();
    assert.deepEqual(surfaces.map(surface => surface.listenerCount), baseline);
});
