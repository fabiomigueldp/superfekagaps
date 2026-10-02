import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFileSync } from 'node:fs';
import { getEventListeners, setMaxListeners } from 'node:events';
import { GuairaChapterMapView, type GuairaChapterMapOptions } from '../src/adventure/experimental/guaira/chapter/GuairaChapterMapView';
import { GuairaChapterSession, type GuairaChapterSceneId, type GuairaChapterSnapshot } from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import type { GuairaChapterTravel } from '../src/adventure/experimental/guaira/chapter/GuairaChapterTravel';
import { GUAIRA_WATER_CONTRACT } from '../src/adventure/experimental/guaira/GuairaWaterMotion';

const metadata = JSON.parse(readFileSync(new URL('../public/assets/world/experimental/guaira/guaira-diorama.meta.json', import.meta.url), 'utf8'));
function dispatch(target: EventTarget, type: string, values = {}) {
    return target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), values));
}
function deferred<T>() {
    let resolve!: (value: T) => void, reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
const flush = async () => { for (let count = 0; count < 12; count++) await Promise.resolve(); };

/** Real EventTarget + production view/travel/session/painter. Only browser device boundaries are replaced. */
function browser(t: TestContext, options: { deferredImage?: boolean; badMetadata?: boolean; water?: boolean; width?: number; height?: number; observerFailure?: 'construct' | 'observe' } = {}) {
    const observed = new Set<Element>(), frames = new Map<number, FrameRequestCallback>();
    const images: FakeImage[] = [], fetchSignals: AbortSignal[] = [], controls: Array<() => void> = [];
    let nextFrame = 0, time = 0, drawCalls = 0, badMetadata = !!options.badMetadata;
    class Element extends EventTarget {
        id = ''; className = ''; type = ''; title = ''; hidden = false; disabled = false; open = false;
        width = 0; height = 0; parent: Element | null = null; children: Element[] = [];
        onclick: (() => void) | null = null;
        style: Record<string, string> = {}; attributes = new Map<string, string>(); private text = '';
        constructor(readonly tagName: string) { super(); }
        get textContent(): string { return this.text + this.children.map(child => child.textContent).join(''); }
        set textContent(text: string) { this.text = text; this.children = []; }
        append(...children: Element[]) { for (const child of children) { child.parent = this; this.children.push(child); } }
        replaceChildren(...children: Element[]) { this.children.forEach(child => { child.parent = null; }); this.children = []; this.append(...children); }
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
        setAttribute(name: string, value: string) { this.attributes.set(name, value); }
        getAttribute(name: string) { return this.attributes.get(name) ?? null; }
        focus() { doc.activeElement = this; }
        showModal() { this.open = true; }
        close() { this.open = false; }
        click() { if (!this.disabled && !this.hidden) { dispatch(this, 'click'); this.onclick?.(); } }
        getBoundingClientRect() {
            return { width: this.className === 'chapter-map-plaque' ? 150 : options.width ?? 800, height: options.height ?? 420, left: 0, top: 0 };
        }
        getContext() {
            return Object.assign(Object.fromEntries(['setTransform', 'clearRect', 'fillRect', 'drawImage', 'beginPath', 'ellipse', 'fill', 'save', 'restore', 'rect', 'clip', 'translate', 'moveTo', 'quadraticCurveTo', 'stroke']
                .map(method => [method, () => { drawCalls++; }])), { createLinearGradient: () => ({ addColorStop() {} }) });
        }
    }
    class FakeImage {
        src = ''; decoded = deferred<void>();
        get naturalWidth() { return this.src.includes('water-mask') ? GUAIRA_WATER_CONTRACT.atlasSize[0] : 1920; }
        get naturalHeight() { return this.src.includes('water-mask') ? GUAIRA_WATER_CONTRACT.atlasSize[1] : 1200; }
        constructor() { images.push(this); }
        decode() {
            if (this.src.includes('water-mask') && !options.water) return Promise.reject(new Error('Optional mask unavailable'));
            if (!options.deferredImage) return Promise.resolve(); return this.decoded.promise;
        }
    }
    const root = new Element('DIV');
    const doc = Object.assign(new EventTarget(), { hidden: false, activeElement: null as Element | null,
        createElement: (tag: string) => new Element(tag.toUpperCase()) });
    const win = Object.assign(new EventTarget(), { devicePixelRatio: 1 });
    const motion = Object.assign(new EventTarget(), { matches: false });
    const RealAbortController = AbortController;
    const globals: Record<string, unknown> = { document: doc, window: win, Image: FakeImage,
        AbortController: class extends RealAbortController { constructor() { super(); setMaxListeners(0, this.signal); } },
        matchMedia: () => motion, requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; },
        cancelAnimationFrame: (id: number) => { frames.delete(id); },
        ResizeObserver: class {
            private target?: Element;
            constructor() { if (options.observerFailure === 'construct') throw new Error('Observer construction failed'); }
            observe(target: Element) { this.target = target; observed.add(target); if (options.observerFailure === 'observe') throw new Error('Observer observation failed'); }
            disconnect() { if (this.target) observed.delete(this.target); }
        },
        fetch: async (_url: string, init: { signal: AbortSignal }) => { fetchSignals.push(init.signal); return { ok: true, json: async () => badMetadata ? {} : metadata }; },
    };
    const original = new Map<string, PropertyDescriptor | undefined>();
    for (const [name, value] of Object.entries(globals)) {
        original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    }
    for (const name of ['location', 'history', 'localStorage', 'sessionStorage']) {
        original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, { configurable: true, get() { assert.fail(`Map view must not access ${name}`); } });
    }
    t.after(() => {
        controls.forEach(dispose => dispose());
        assert.equal(frames.size, 0, 'Disposed views leave no RAF'); assert.equal(observed.size, 0, 'Disposed views disconnect geometry observers');
        for (const [name, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); }
    });
    const all = (at: Element = root): Element[] => [at, ...at.children.flatMap(child => all(child))];
    const byClass = (name: string) => { const found = all().find(node => node.className === name); assert.ok(found, name); return found; };
    const button = (name: string) => { const found = all().find(node => node.tagName === 'BUTTON' && node.getAttribute('aria-label') === name); assert.ok(found, name); return found; };
    const create = (configuration: GuairaChapterMapOptions) => {
        const view = new GuairaChapterMapView(root as unknown as HTMLElement, configuration); controls.push(() => view.dispose()); return view;
    };
    function tick(count = 1) { for (let n = 0; n < count; n++) { const work = [...frames.values()]; frames.clear(); time += 16.67; work.forEach(callback => callback(time)); } }
    function hidden(value: boolean) { doc.hidden = value; dispatch(doc, 'visibilitychange'); }
    function reduced(value: boolean) { motion.matches = value; dispatch(motion, 'change'); }
    return { root, all, byClass, button, create, tick, hidden, reduced, frames, images, doc, motion, win, observed, fetchSignals,
        draws: () => drawCalls, repairMetadata: () => { badMetadata = false; } };
}
function configuration(snapshot: GuairaChapterSnapshot, extra: Partial<GuairaChapterMapOptions> = {}): GuairaChapterMapOptions {
    return { snapshot, arrival: 'town', onSelect() {}, onEnter() {}, onOpening() {}, onRestart() {}, onExit() {}, ...extra };
}
function road(view: GuairaChapterMapView) { return (view as unknown as { travel: GuairaChapterTravel }).travel; }
function clearOpening(session: GuairaChapterSession) {
    const state = session.snapshot(), attempt = session.enterScene(state.opening, state.generation)!;
    return session.continueFrom(attempt, { attempt, alive: true, state: 'playing', result: { sceneId: state.opening, kind: 'reached-finish' } })!.snapshot;
}

test('opening and entry use captured generations; repeated/stale controls cannot enter or switch a retired session', async t => {
    const h = browser(t), session = new GuairaChapterSession();
    const entered: GuairaChapterSceneId[] = [], openings: string[] = [];
    const view = h.create(configuration(session.snapshot(), { onEnter: (sceneId, generation) => {
        entered.push(sceneId); assert.ok(view.canEnter(sceneId, generation));
        session.enterScene(sceneId, generation); view.update(session.snapshot(), false, false);
    }, onOpening: opening => openings.push(opening) }));
    await flush(); h.tick();
    assert.equal(view.canEnter('guaira-travessia', session.snapshot().generation), true);
    assert.equal(h.byClass('chapter-map-count').textContent, '0/5 · nesta sessão');
    const alternative = h.button('Pátio das Comportas: usar como abertura alternativa');
    const oldOpening = alternative.onclick!; alternative.click(); assert.deepEqual(openings, ['guaira-patio-comportas']);
    const primary = h.button('Entrar: Travessia da Vala Seca'), oldPrimary = primary.onclick!;
    primary.click(); primary.click(); oldPrimary(); oldOpening();
    assert.deepEqual(entered, ['guaira-travessia']); assert.deepEqual(openings, ['guaira-patio-comportas']);
    assert.equal(h.byClass('chapter-map-openings').hidden, true);
    assert.equal(view.canEnter('guaira-travessia', session.snapshot().generation), false);
    assert.equal(session.snapshot().accepted.length, 0);
});

test('CAMINHAR follows the authored road; modal and hidden freeze it, CHEGAR only arrives, and update(false) preserves position', async t => {
    const h = browser(t, { water: true }), session = new GuairaChapterSession();
    const snapshot = clearOpening(session), entered: string[] = [];
    const view = h.create(configuration(snapshot, { onEnter: scene => entered.push(scene) }));
    await flush(); h.tick();
    assert.equal(view.canEnter('guaira-respiros', snapshot.generation), false);
    assert.equal(road(view).arrival, 'town');
    h.button('Caminhar até Passarela dos Arrozais').click(); h.tick(12);
    const travelled = road(view).distance; assert.ok(travelled > 0 && travelled < road(view).targetDistance);
    assert.equal(h.button('Entrar: Passagem dos Respiros').disabled, true);
    const delayedFrame = [...h.frames.values()][0];
    h.button('Ver a jornada de Guaíra').click(); assert.equal(h.frames.size, 0);
    delayedFrame(300_000); assert.equal(road(view).distance, travelled);
    assert.equal(h.doc.activeElement, h.button('Fechar a jornada e voltar à maquete'));
    h.reduced(true); assert.equal(road(view).distance, travelled, 'Changing reduced motion behind the modal must not move Feka');
    dispatch(h.byClass('guaira-chapter-map'), 'keydown', { key: 'Escape' });
    assert.equal(h.byClass('chapter-map-dialog').open, false);
    assert.equal(h.doc.activeElement, h.button('Ver a jornada de Guaíra'));
    assert.equal(road(view).arrival, 'rice'); assert.deepEqual(entered, []);
    h.reduced(false);
    const selected = session.selectScene('guaira-travessia', snapshot.generation)!;
    const atRice = road(view).distance; view.update(selected, false); h.tick(10);
    assert.equal(road(view).distance, atRice); assert.equal(h.button('Caminhar até Estrada do Vento').disabled, false);
    h.button('Caminhar até Estrada do Vento').click(); h.tick(10);
    assert.ok(road(view).distance < atRice);
    const beforeHidden = road(view).distance, draws = h.draws();
    h.hidden(true); assert.equal(h.frames.size, 0); h.tick(30); assert.equal(h.draws(), draws);
    assert.equal(road(view).distance, beforeHidden); h.hidden(false); h.tick();
    assert.ok(beforeHidden - road(view).distance < 9, 'Resuming must not consume hidden elapsed time');
    h.button('Chegar agora, pulando a caminhada').click(); h.tick();
    assert.equal(road(view).arrival, 'town'); assert.deepEqual(entered, []);
    assert.equal(view.canEnter('guaira-travessia', selected.generation), true);
    h.button('Repetir Travessia da Vala Seca em uma nova tentativa').click(); assert.deepEqual(entered, ['guaira-travessia']);
    assert.equal(session.snapshot().accepted.length, 1, 'The view never awards or replaces receipts');
});

test('journey rows show route truth, only accepted/next select, selection walks without entering, and old rows reject a newer generation', async t => {
    const h = browser(t), session = new GuairaChapterSession({ opening: 'guaira-patio-comportas' });
    const initial = clearOpening(session); let enters = 0, selections = 0;
    const view = h.create(configuration(initial, { arrival: 'rice', onSelect: (scene, generation) => {
        selections++; const next = session.selectScene(scene, generation); assert.ok(next); view.update(next, true, false);
    }, onEnter: () => { enters++; } }));
    await flush(); h.tick(); h.button('Ver a jornada de Guaíra').click();
    const list = h.byClass('chapter-map-list'), rows = list.children.map(item => item.children[0]);
    assert.equal(rows.length, 5); assert.equal(rows[0].textContent.includes('Pátio das Comportas'), true);
    assert.equal(rows.some(row => row.textContent.includes('Travessia da Vala Seca')), false);
    assert.deepEqual(rows.map(row => row.disabled), [false, false, true, true, true]);
    assert.match(rows[2].textContent, /Depois de Passagem dos Respiros/);
    rows[0].click(); assert.equal(selections, 1); assert.equal(enters, 0); assert.equal(road(view).moving, true);
    h.button('Ver a jornada de Guaíra').click(); rows[1].click(); assert.equal(selections, 1, 'Retained old DOM rows carry old generations');
    dispatch(h.byClass('chapter-map-dialog'), 'cancel'); assert.equal(h.byClass('chapter-map-dialog').open, false);
    const before = session.snapshot(); dispatch(h.doc, 'keydown', { key: 'ArrowUp' }); dispatch(h.byClass('guaira-chapter-map'), 'keydown', { key: 'ArrowRight' });
    assert.deepEqual(session.snapshot(), before, 'No free-map global arrow shortcuts');
    assert.equal(h.all().filter(node => node.className === 'chapter-map-plaque').length, 1);
});

test('load failure leaves the session untouched and offers retry/exit; late decode after disposal cannot remount', async t => {
    const h = browser(t, { badMetadata: true }), session = new GuairaChapterSession();
    let exits = 0, selected = 0; const initial = session.snapshot();
    const view = h.create(configuration(initial, { onExit: () => { exits++; }, onSelect: () => { selected++; } }));
    await flush();
    assert.equal(h.byClass('chapter-map-failure').hidden, false);
    assert.equal(view.canEnter(initial.selectedScene, initial.generation), false);
    assert.equal(h.button('Ver a jornada de Guaíra').disabled, true);
    h.button('Sair do capítulo e voltar ao jogo principal').click(); assert.equal(exits, 1);
    assert.deepEqual(session.snapshot(), initial); assert.equal(selected, 0);
    h.repairMetadata(); h.button('Tentar carregar a maquete novamente').click(); await flush(); h.tick();
    assert.equal(h.byClass('chapter-map-failure').hidden, true); assert.equal(view.canEnter(initial.selectedScene, initial.generation), true);
    view.dispose(); const draws = h.draws(); h.hidden(true); h.hidden(false); h.reduced(true); dispatch(h.win, 'resize');
    assert.equal(h.draws(), draws); assert.equal(h.root.children.length, 0);
});

test('disposing during diorama or water decode ignores all late completion and stops every owned handle', async t => {
    const h = browser(t, { deferredImage: true, water: true }), session = new GuairaChapterSession();
    const view = h.create(configuration(session.snapshot()));
    assert.equal(h.images.length, 1); view.dispose(); h.images[0].decoded.resolve(); await flush();
    assert.equal(h.root.children.length, 0); assert.equal(h.images.length, 1); assert.equal(h.frames.size, 0);
    assert.ok(h.fetchSignals[0].aborted); assert.equal(view.canEnter('guaira-travessia', session.snapshot().generation), false);
    const other = h.create(configuration(session.snapshot())); h.images[1].decoded.resolve(); await flush(); h.tick();
    assert.equal(h.images.length, 3); other.dispose(); const draws = h.draws(); h.images[2].decoded.resolve(); await flush();
    assert.equal(h.draws(), draws); assert.equal(h.root.children.length, 0); assert.equal(h.frames.size, 0);
});

test('constructor rollback removes attached DOM and listeners when observer construction or observation fails', async t => {
    for (const observerFailure of ['construct', 'observe'] as const) await t.test(observerFailure, subtest => {
        const h = browser(subtest, { observerFailure }), session = new GuairaChapterSession();
        assert.throws(() => h.create(configuration(session.snapshot())), /Observer .* failed/);
        assert.equal(h.root.children.length, 0); assert.equal(h.observed.size, 0); assert.equal(h.frames.size, 0);
        assert.equal(getEventListeners(h.doc, 'visibilitychange').length, 0);
        assert.equal(getEventListeners(h.win, 'resize').length, 0);
        assert.equal(getEventListeners(h.motion, 'change').length, 0);
        const draws = h.draws(); h.hidden(true); h.hidden(false); h.reduced(true); dispatch(h.win, 'resize');
        assert.equal(h.draws(), draws); assert.equal(h.frames.size, 0); assert.equal(h.images.length, 0);
    });
});

test('new selection reverses actual movement without teleporting; hidden reduced-motion requests wait until visible', async t => {
    const h = browser(t), session = new GuairaChapterSession(); const initial = clearOpening(session);
    const view = h.create(configuration(initial, { walkToSelection: true })); await flush(); h.tick(30);
    const midway = road(view).distance; assert.ok(midway > 0);
    const selected = session.selectScene('guaira-travessia', initial.generation)!; view.update(selected, true); assert.equal(road(view).distance, midway);
    h.tick(); assert.ok(road(view).distance < midway);
    const next = session.selectScene('guaira-respiros', selected.generation)!;
    h.hidden(true); h.reduced(true); const held = road(view).distance; view.update(next, true); await flush();
    assert.equal(road(view).distance, held); h.hidden(false); assert.equal(road(view).arrival, 'rice');
    assert.equal(view.canEnter('guaira-respiros', selected.generation), false);
    assert.equal(view.canEnter('guaira-respiros', next.generation), true);
    view.update(initial, true); assert.equal(view.canEnter('guaira-respiros', next.generation), true, 'A delayed old snapshot cannot roll the view back');
});

test('completed chapter reports only accepted results and requires explicit new Prefeito entry; abandoned opening stays locked', async t => {
    const h = browser(t), session = new GuairaChapterSession();
    for (const sceneId of session.snapshot().route) {
        const attempt = session.enterScene(sceneId, session.snapshot().generation)!;
        const result = sceneId === 'guaira-lab' ? { sceneId, kind: 'defeated-bull' } as const
            : sceneId === 'guaira-prefeito' ? { sceneId, kind: 'mayor-water-released' } as const : { sceneId, kind: 'reached-finish' } as const;
        assert.ok(session.continueFrom(attempt, { attempt, alive: true, state: 'playing', result }));
    }
    let entries = 0; const complete = session.snapshot();
    const view = h.create(configuration(complete, { arrival: 'vazao', openingAvailable: false, onEnter: () => { entries++; } }));
    await flush(); h.tick();
    assert.equal(h.byClass('chapter-map-title').textContent, 'CAPÍTULO CONCLUÍDO');
    assert.equal(h.byClass('chapter-map-count').textContent, '5/5 · nesta sessão');
    assert.match(h.byClass('chapter-map-hint').textContent, /Água pública liberada/);
    assert.equal(entries, 0); h.button('Repetir o Prefeito em uma nova tentativa').click(); assert.equal(entries, 1);
    assert.deepEqual(session.snapshot().accepted, complete.accepted); view.dispose();
    const abandoned = new GuairaChapterSession(), attempt = abandoned.enterScene('guaira-travessia', abandoned.snapshot().generation)!;
    abandoned.exitToMap(attempt, { attempt, alive: true, state: 'playing', result: null });
    h.create(configuration(abandoned.snapshot(), { openingAvailable: false })); await flush();
    assert.equal(h.byClass('chapter-map-openings').hidden, true); assert.equal(abandoned.snapshot().accepted.length, 0);
});

test('CSS scopes every rule, preserves native 44px controls and lets narrow/footer text grow', () => {
    const css = readFileSync(new URL('../src/adventure/experimental/guaira/chapter/guaira-chapter-map.css', import.meta.url), 'utf8');
    assert.match(css, /min-height: 44px/); assert.match(css, /forced-colors: active/); assert.match(css, /focus-visible/);
    assert.match(css, /overflow-wrap: anywhere/); assert.match(css, /min-height: 84px/);
    assert.doesNotMatch(css, /(?<![-\w])height: 84px/); assert.doesNotMatch(css, /(?:^|[},])\s*(?:body|html|button|canvas)\s*[{,]/m);
    assert.match(css, /max-width: 360px/); assert.match(css, /grid-template-columns: minmax\(0, 1fr\);/);
});
