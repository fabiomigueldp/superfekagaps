import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFileSync } from 'node:fs';
import { getEventListeners, setMaxListeners } from 'node:events';
import { GuairaChapterMapView, type GuairaChapterMapOptions } from '../src/adventure/experimental/guaira/chapter/GuairaChapterMapView';
import { GuairaChapterSession, type GuairaChapterSceneId, type GuairaChapterSnapshot } from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import type { GuairaChapterMapTarget, GuairaChapterNavigation } from '../src/adventure/experimental/guaira/chapter/GuairaChapterNavigation';
import type { GuairaChapterTravel } from '../src/adventure/experimental/guaira/chapter/GuairaChapterTravel';
import { GUAIRA_WATER_CONTRACT } from '../src/adventure/experimental/guaira/GuairaWaterMotion';
import { freshGuairaChapterProgress } from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import { labActionSize } from '../src/adventure/experimental/JuiceLabToolbar';

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
    let nextFrame = 0, time = 0, drawCalls = 0, badMetadata = !!options.badMetadata, focused = true;
    class Element extends EventTarget {
        id = ''; className = ''; type = ''; title = ''; private hiddenValue = false; disabled = false; open = false;
        get hidden() { return this.hiddenValue; }
        set hidden(value: boolean) { this.hiddenValue = value; if (value && this.contains(doc.activeElement)) doc.activeElement = null; }
        contains(node: Element | null): boolean { return !!node && (node === this || this.children.some(child => child.contains(node))); }
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
        focus() { if (!this.disabled && !this.hidden) doc.activeElement = this; }
        showModal() { this.open = true; }
        close() { this.open = false; }
        click() { if (!this.disabled && !this.hidden) { dispatch(this, 'click'); this.onclick?.(); } }
        getBoundingClientRect() {
            return { width: this.className === 'chapter-map-plaque' ? 150 : options.width ?? 800, height: options.height ?? 420, left: 0, top: 0 };
        }
        getContext() {
            return Object.assign(Object.fromEntries(['setTransform', 'clearRect', 'fillRect', 'drawImage', 'beginPath', 'ellipse', 'fill', 'save', 'restore', 'rect', 'clip', 'translate', 'moveTo', 'lineTo', 'closePath', 'scale', 'quadraticCurveTo', 'stroke']
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
    const doc = Object.assign(new EventTarget(), { hidden: false, hasFocus: () => focused, activeElement: null as Element | null,
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
    function blur() { focused = false; dispatch(win, 'blur'); }
    function focus() { focused = true; dispatch(win, 'focus'); }
    return { root, all, byClass, button, create, tick, hidden, reduced, blur, focus, frames, images, doc, motion, win, observed, fetchSignals,
        draws: () => drawCalls, repairMetadata: () => { badMetadata = false; } };
}
function configuration(snapshot: GuairaChapterSnapshot, extra: Partial<GuairaChapterMapOptions> = {}): GuairaChapterMapOptions {
    return { snapshot, navigation: navigation(snapshot), arrival: 'town', onSelect() {}, onEnter() {}, onOpening() {}, onRestart() {}, onExit() {}, ...extra };
}
const chapterTarget = (sceneId: GuairaChapterSceneId): GuairaChapterMapTarget => ({ kind: 'chapter', sceneId });
const optionalTarget: GuairaChapterMapTarget = { kind: 'optional', stop: 'bairro' };
const navigation = (snapshot: GuairaChapterSnapshot, revision = 0): GuairaChapterNavigation => ({ target: chapterTarget(snapshot.selectedScene), revision });
function road(view: GuairaChapterMapView) { return (view as unknown as { travel: GuairaChapterTravel }).travel; }
function clearOpening(session: GuairaChapterSession) {
    const state = session.snapshot(), attempt = session.enterScene(state.opening, state.generation)!;
    return session.continueFrom(attempt, { attempt, alive: true, state: 'playing', result: { sceneId: state.opening, kind: 'reached-finish' } })!.snapshot;
}

test('map copy keeps progress in the header and explains returning to the beginning without erasing it', async t => {
    const h = browser(t, { width: 320 }), session = new GuairaChapterSession();
    const snapshot = clearOpening(session);
    let restarts = 0;
    h.create(configuration(snapshot, { onRestart: () => { restarts++; }, storageMessage: () => 'Progresso somente nesta sessão.' }));
    assert.equal(h.byClass('chapter-map-loading').textContent, 'Carregando o mapa…');
    await flush(); h.tick();
    assert.equal(h.byClass('chapter-map-count').textContent, '1/5 · concluídos');
    assert.doesNotMatch(h.byClass('chapter-map-hint').textContent, /\d\/5/);
    assert.match(h.byClass('chapter-map-hint').textContent, /Progresso somente nesta sessão\./);
    assert.match(h.byClass('chapter-map-canvas').getAttribute('aria-label')!, /^Mapa de Guaíra\./);
    h.button('Ver a jornada de Guaíra').click();
    assert.equal(h.byClass('chapter-map-session-note').textContent, 'Voltar ao início mantém os trechos concluídos. Cada nova tentativa começa do início.');
    const restart = h.button('Voltar ao início sem apagar trechos concluídos');
    const art = restart.children.find(child => child.className === 'lab-action-art')!;
    assert.equal(art.width, labActionSize('VOLTAR AO INÍCIO').width * 2);
    assert.equal(art.height, 44);
    assert.ok(art.width <= 268, 'The complete bitmap label fits the dialog content at 320 CSS pixels');
    restart.click(); assert.equal(restarts, 1); assert.deepEqual(session.snapshot(), snapshot);
});

test('opening and entry use captured generations; repeated/stale controls cannot enter or switch a retired session', async t => {
    const h = browser(t), session = new GuairaChapterSession();
    const entered: GuairaChapterSceneId[] = [], openings: string[] = [];
    const view = h.create(configuration(session.snapshot(), { onEnter: (target, generation, revision) => {
        assert.equal(target.kind, 'chapter'); if (target.kind !== 'chapter') return;
        const sceneId = target.sceneId; entered.push(sceneId); assert.ok(view.canEnter(target, generation, revision));
        session.enterScene(sceneId, generation); view.update(session.snapshot(), false, false, navigation(session.snapshot()));
    }, onOpening: opening => openings.push(opening) }));
    await flush(); h.tick();
    assert.equal(view.canEnter(chapterTarget('guaira-travessia'), session.snapshot().generation, 0), true);
    assert.equal(h.byClass('chapter-map-count').textContent, '0/5 · concluídos');
    const alternative = h.button('Pátio das Comportas: usar como abertura alternativa');
    h.button('Ver a jornada de Guaíra').click();
    const oldOpening = alternative.onclick!; alternative.click(); assert.deepEqual(openings, ['guaira-patio-comportas']);
    const primary = h.button('Entrar: Travessia da Vala Seca'), oldPrimary = primary.onclick!;
    primary.click(); primary.click(); oldPrimary(); oldOpening();
    assert.deepEqual(entered, ['guaira-travessia']); assert.deepEqual(openings, ['guaira-patio-comportas']);
    assert.equal(h.byClass('chapter-map-openings').hidden, true);
    assert.equal(view.canEnter(chapterTarget('guaira-travessia'), session.snapshot().generation, 0), false);
    assert.equal(session.snapshot().accepted.length, 0);
});

test('CAMINHAR follows the authored road; modal and hidden freeze it, CHEGAR only arrives, and update(false) preserves position', async t => {
    const h = browser(t, { water: true }), session = new GuairaChapterSession();
    const snapshot = clearOpening(session), entered: string[] = [];
    const view = h.create(configuration(snapshot, { onEnter: target => { if (target.kind === 'chapter') entered.push(target.sceneId); } }));
    await flush(); h.tick();
    assert.equal(view.canEnter(chapterTarget('guaira-respiros'), snapshot.generation, 0), false);
    assert.equal(road(view).arrival, 'town');
    h.button('Caminhar até Passarela dos Arrozais').click(); h.tick(12);
    const travelled = road(view).distance; assert.ok(travelled > 0 && travelled < road(view).targetDistance);
    assert.equal(h.button('Entrar: Passagem dos Respiros').disabled, true);
    const delayedFrame = [...h.frames.values()][0];
    h.button('Ver a jornada de Guaíra').click(); assert.equal(h.frames.size, 0);
    delayedFrame(300_000); assert.equal(road(view).distance, travelled);
    assert.equal(h.doc.activeElement, h.button('Fechar a jornada e voltar ao mapa'));
    h.reduced(true); assert.equal(road(view).distance, travelled, 'Changing reduced motion behind the modal must not move Feka');
    dispatch(h.byClass('guaira-chapter-map'), 'keydown', { key: 'Escape' });
    assert.equal(h.byClass('chapter-map-dialog').open, false);
    assert.equal(h.doc.activeElement, h.button('Ver a jornada de Guaíra'));
    assert.equal(road(view).arrival, 'rice'); assert.deepEqual(entered, []);
    h.reduced(false);
    const selected = session.selectScene('guaira-travessia', snapshot.generation)!;
    const atRice = road(view).distance; view.update(selected, false, false, navigation(selected)); h.tick(10);
    assert.equal(road(view).distance, atRice); assert.equal(h.button('Caminhar até Estrada do Vento').disabled, false);
    h.button('Caminhar até Estrada do Vento').click(); h.tick(10);
    assert.ok(road(view).distance < atRice);
    const beforeHidden = road(view).distance, draws = h.draws();
    h.hidden(true); assert.equal(h.frames.size, 0); h.tick(30); assert.equal(h.draws(), draws);
    assert.equal(road(view).distance, beforeHidden); h.hidden(false); h.tick();
    assert.ok(beforeHidden - road(view).distance < 9, 'Resuming must not consume hidden elapsed time');
    h.button('Chegar agora, pulando a caminhada').click(); h.tick();
    assert.equal(road(view).arrival, 'town'); assert.deepEqual(entered, []);
    assert.equal(view.canEnter(chapterTarget('guaira-travessia'), selected.generation, 0), true);
    h.button('Repetir Travessia da Vala Seca em uma nova tentativa').click(); assert.deepEqual(entered, ['guaira-travessia']);
    assert.equal(session.snapshot().accepted.length, 1, 'The view never awards or replaces receipts');
});

test('journey rows show route truth, only accepted/next select, selection walks without entering, and old rows reject a newer generation', async t => {
    const h = browser(t), session = new GuairaChapterSession({ opening: 'guaira-patio-comportas' });
    const initial = clearOpening(session); let enters = 0, selections = 0;
    const view = h.create(configuration(initial, { arrival: 'rice', onSelect: (target, generation) => {
        assert.equal(target.kind, 'chapter'); if (target.kind !== 'chapter') return;
        selections++; const next = session.selectScene(target.sceneId, generation); assert.ok(next); view.update(next, true, false, navigation(next));
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
    assert.equal(h.byClass('chapter-map-status').textContent, 'O mapa está indisponível. Sua sessão continua aqui.');
    const retryArt = h.button('Tentar carregar o mapa novamente').children.find(child => child.className === 'lab-action-art')!;
    assert.equal(retryArt.width, labActionSize('TENTAR').width * 2, 'Loading retries remain distinct from restarting a playable attempt');
    assert.equal(view.canEnter(chapterTarget(initial.selectedScene), initial.generation, 0), false);
    assert.equal(h.button('Ver a jornada de Guaíra').disabled, false);
    h.button('Ver a jornada de Guaíra').click();
    h.button('Sair do capítulo e voltar aos extras').click(); assert.equal(exits, 1);
    assert.deepEqual(session.snapshot(), initial); assert.equal(selected, 0);
    h.repairMetadata(); h.button('Tentar carregar o mapa novamente').click(); await flush(); h.tick();
    assert.equal(h.byClass('chapter-map-failure').hidden, true); assert.equal(view.canEnter(chapterTarget(initial.selectedScene), initial.generation, 0), true);
    view.dispose(); const draws = h.draws(); h.hidden(true); h.hidden(false); h.reduced(true); dispatch(h.win, 'resize');
    assert.equal(h.draws(), draws); assert.equal(h.root.children.length, 0);
});

test('disposing during diorama or water decode ignores all late completion and stops every owned handle', async t => {
    const h = browser(t, { deferredImage: true, water: true }), session = new GuairaChapterSession();
    const view = h.create(configuration(session.snapshot()));
    assert.equal(h.images.length, 1); view.dispose(); h.images[0].decoded.resolve(); await flush();
    assert.equal(h.root.children.length, 0); assert.equal(h.images.length, 1); assert.equal(h.frames.size, 0);
    assert.ok(h.fetchSignals[0].aborted); assert.equal(view.canEnter(chapterTarget('guaira-travessia'), session.snapshot().generation, 0), false);
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
    const selected = session.selectScene('guaira-travessia', initial.generation)!; view.update(selected, true, false, navigation(selected)); assert.equal(road(view).distance, midway);
    h.tick(); assert.ok(road(view).distance < midway);
    const next = session.selectScene('guaira-respiros', selected.generation)!;
    h.hidden(true); h.reduced(true); const held = road(view).distance; view.update(next, true, false, navigation(next)); await flush();
    assert.equal(road(view).distance, held); h.hidden(false); assert.equal(road(view).arrival, 'rice');
    assert.equal(view.canEnter(chapterTarget('guaira-respiros'), selected.generation, 0), false);
    assert.equal(view.canEnter(chapterTarget('guaira-respiros'), next.generation, 0), true);
    view.update(initial, true, false, navigation(initial)); assert.equal(view.canEnter(chapterTarget('guaira-respiros'), next.generation, 0), true, 'A delayed old snapshot cannot roll the view back');
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
    assert.equal(h.byClass('chapter-map-count').textContent, '5/5 · concluídos');
    assert.match(h.byClass('chapter-map-story').textContent, /Ramal público aberto\. Os moradores têm água na bica outra vez\. Os gaps continuam\./);
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
    assert.match(css, /overflow-wrap: anywhere/); assert.match(css, /min-height: 64px/);
    assert.doesNotMatch(css, /(?<![-\w])height: 64px/); assert.doesNotMatch(css, /(?:^|[},])\s*(?:body|html|button|canvas)\s*[{,]/m);
    assert.match(css, /max-width: 360px/); assert.match(css, /grid-template-columns: minmax\(0, 1fr\);/);
});

const OPTIONAL_LABEL = 'Bairro da Vala Seca / Galeria dos Remendos: desvio opcional';
const GALLERY_LABEL = 'Entrar na Galeria dos Remendos, percurso opcional';
const RESUME_OPENING = 'Retomar Travessia da Vala Seca, trecho selecionado da jornada';

test('optional Bairro stays outside five journey rows, walks to guaira-2, and requires explicit Gallery entry for either opening', async t => {
    for (const opening of ['guaira-travessia', 'guaira-patio-comportas'] as const) await t.test(opening, async subtest => {
        const h = browser(subtest), session = new GuairaChapterSession({ opening }), before = session.snapshot();
        let revision = 4; const entries: GuairaChapterMapTarget[] = [];
        const view = h.create(configuration(before, { navigation: navigation(before, revision), onSelect: (target, generation, captured) => {
            assert.equal(captured, revision); assert.deepEqual(generation, before.generation);
            view.update(before, true, true, { target, revision: ++revision });
        }, onEnter: (target, generation, captured) => {
            assert.ok(view.canEnter(target, generation, captured)); entries.push(target);
        } }));
        await flush(); h.tick();
        const oldPrimary = h.button(`Entrar: ${opening === 'guaira-travessia' ? 'Travessia da Vala Seca' : 'Pátio das Comportas'}`).onclick!;
        h.button('Ver a jornada de Guaíra').click();
        const list = h.byClass('chapter-map-list'), optional = h.button(OPTIONAL_LABEL);
        assert.equal(list.children.length, 5); assert.equal(optional.parent, h.byClass('chapter-map-optional'));
        assert.equal(optional.parent?.parent, list.parent); assert.equal(optional.getAttribute('aria-pressed'), 'false');
        assert.ok(list.children.every((item, index) => item.textContent.startsWith(`${index + 1}. `)));
        optional.click(); assert.equal(h.byClass('chapter-map-dialog').open, false);
        assert.equal(road(view).targetArrival, 'bairro'); assert.equal(road(view).distance, 0);
        h.tick(15); assert.ok(road(view).distance > 0 && road(view).distance < road(view).targetDistance);
        assert.equal(h.byClass('chapter-map-title').textContent, 'Galeria dos Remendos');
        assert.equal(h.byClass('chapter-map-openings').hidden, true, 'Optional destination hides opening choices without locking the retained opening');
        assert.equal(h.byClass('chapter-map-count').textContent, '0/5 · concluídos');
        assert.equal(view.canEnter(optionalTarget, before.generation, revision), false);
        oldPrimary(); assert.deepEqual(entries, [], 'Old required callback cannot enter after an optional selection');
        const skip = h.button('Chegar agora, pulando a caminhada'); skip.focus(); skip.click(); h.tick();
        assert.equal(road(view).arrival, 'bairro');
        assert.deepEqual(road(view).point, { x: metadata.nodes['guaira-2'].x, y: metadata.nodes['guaira-2'].y });
        assert.deepEqual(entries, []); assert.equal(h.doc.activeElement, h.button(GALLERY_LABEL));
        assert.equal(view.canEnter(optionalTarget, before.generation, revision), true);
        assert.equal(view.canEnter(chapterTarget(before.selectedScene), before.generation, revision), false);
        const gallery = h.button(GALLERY_LABEL), retainedEntry = gallery.onclick!;
        gallery.click(); gallery.click(); retainedEntry(); assert.deepEqual(entries, [optionalTarget]);
        assert.deepEqual(session.snapshot(), before, 'No optional result, selection, generation or receipt enters the session');
    });
});

test('optional opening controls stay hidden and inert until RETOMAR restores either opening', async t => {
    for (const opening of ['guaira-travessia', 'guaira-patio-comportas'] as const) await t.test(opening, async subtest => {
        const h = browser(subtest), session = new GuairaChapterSession({ opening }), before = session.snapshot();
        let revision = 0;
        const openings: string[] = [];
        const view = h.create(configuration(before, { openingAvailable: true, onOpening: value => openings.push(value),
            onSelect: target => view.update(before, true, true, { target, revision: ++revision }) }));
        await flush();
        const traversal = h.button('Travessia da Vala Seca: usar como abertura');
        const junction = h.button('Pátio das Comportas: usar como abertura alternativa');
        const oldOpening = junction.onclick!;
        h.button('Ver a jornada de Guaíra').click(); h.button(OPTIONAL_LABEL).click();
        assert.equal(h.byClass('chapter-map-openings').hidden, true);
        assert.equal(traversal.disabled, true); assert.equal(junction.disabled, true);
        const hiddenOpening = junction.onclick!;
        oldOpening(); hiddenOpening(); traversal.onclick!();
        assert.deepEqual(openings, [], 'Neither hidden current callbacks nor retired visible callbacks can reset the session');
        h.button('Chegar agora, pulando a caminhada').click();
        const title = opening === 'guaira-travessia' ? 'Travessia da Vala Seca' : 'Pátio das Comportas';
        const resume = h.button(`Retomar ${title}, trecho selecionado da jornada`);
        resume.focus(); resume.click();
        assert.equal(h.byClass('chapter-map-openings').hidden, false);
        assert.equal(traversal.disabled, false); assert.equal(junction.disabled, false);
        assert.equal(h.doc.activeElement, h.button('Chegar agora, pulando a caminhada'));
        assert.equal(road(view).targetArrival, 'town');
        assert.deepEqual(session.snapshot(), before, 'RETOMAR changes navigation only, keeping selection and all receipts');
        hiddenOpening(); assert.deepEqual(openings, []);
        h.button('Ver a jornada de Guaíra').click(); traversal.click();
        h.button('Ver a jornada de Guaíra').click(); junction.click();
        assert.deepEqual(openings, ['guaira-travessia', 'guaira-patio-comportas']);
    });
});

test('same-state navigation revision retires every retained map action without changing chapter generation', async t => {
    const h = browser(t), session = new GuairaChapterSession(), before = session.snapshot();
    let revision = 1, entries = 0, selections = 0, restarts = 0, exits = 0, openings = 0;
    const view = h.create(configuration(before, { arrival: 'bairro', navigation: { target: optionalTarget, revision }, onSelect: target => {
        selections++; view.update(before, true, true, { target, revision: ++revision });
    }, onEnter: () => { entries++; }, onRestart: () => { restarts++; }, onExit: () => { exits++; }, onOpening: () => { openings++; } }));
    await flush(); h.tick();
    const oldEnter = h.button(GALLERY_LABEL).onclick!, oldResume = h.button(RESUME_OPENING).onclick!;
    const oldExit = h.button('Sair do capítulo e voltar aos extras').onclick!;
    const oldOpening = h.button('Pátio das Comportas: usar como abertura alternativa').onclick!;
    h.button('Ver a jornada de Guaíra').click();
    const oldRestart = h.button('Voltar ao início sem apagar trechos concluídos').onclick!;
    const oldOptional = h.button(OPTIONAL_LABEL).onclick!;
    assert.equal(h.button(OPTIONAL_LABEL).getAttribute('aria-pressed'), 'true');
    assert.ok(h.byClass('chapter-map-list').children.every(item => item.children[0].getAttribute('aria-pressed') === 'false'));
    h.button(OPTIONAL_LABEL).click(); assert.equal(revision, 2);
    oldEnter(); oldResume(); oldExit(); oldOpening();
    h.button('Ver a jornada de Guaíra').click(); oldRestart(); oldOptional();
    assert.deepEqual({ entries, selections, restarts, exits, openings }, { entries: 0, selections: 1, restarts: 0, exits: 0, openings: 0 });
    assert.deepEqual(session.snapshot(), before);
    view.update(before, true, true, { target: chapterTarget(before.selectedScene), revision: 1 });
    assert.equal(h.button(OPTIONAL_LABEL).getAttribute('aria-pressed'), 'true', 'Older navigation cannot overwrite the optional target');
    h.button('Fechar a jornada e voltar ao mapa').click();
    assert.equal(view.canEnter(optionalTarget, before.generation, 1), false);
    assert.equal(view.canEnter(optionalTarget, before.generation, 2), true);
});

test('RETOMAR restores the exact retained replay, clears hidden-control focus safely, and walks without entry', async t => {
    const h = browser(t), session = new GuairaChapterSession();
    clearOpening(session);
    const before = session.selectScene('guaira-travessia', session.snapshot().generation)!;
    assert.equal(before.nextRecommendedScene, 'guaira-respiros');
    let revision = 8; const selected: GuairaChapterMapTarget[] = [], entries: GuairaChapterMapTarget[] = [];
    const view = h.create(configuration(before, { arrival: 'bairro', openingAvailable: false, navigation: { target: optionalTarget, revision }, onSelect: target => {
        selected.push(target); view.update(before, true, false, { target, revision: ++revision });
    }, onEnter: target => entries.push(target) }));
    await flush(); h.tick();
    const oldGallery = h.button(GALLERY_LABEL).onclick!;
    const resume = h.button(RESUME_OPENING); resume.focus(); resume.click();
    assert.deepEqual(selected, [chapterTarget('guaira-travessia')]);
    assert.equal(road(view).targetArrival, 'town'); assert.equal(road(view).arrival, 'bairro');
    assert.equal(resume.hidden, true); assert.equal(h.doc.activeElement, h.button('Chegar agora, pulando a caminhada'));
    assert.equal(view.canEnter(optionalTarget, before.generation, revision), false);
    h.tick(8); assert.equal(road(view).facingLeft, true);
    h.button('Chegar agora, pulando a caminhada').click();
    oldGallery(); assert.deepEqual(entries, []);
    assert.equal(h.doc.activeElement, h.button('Repetir Travessia da Vala Seca em uma nova tentativa'));
    assert.equal(view.canEnter(chapterTarget('guaira-travessia'), before.generation, revision), true);
    assert.deepEqual(session.snapshot(), before); assert.equal(h.byClass('chapter-map-count').textContent, '1/5 · concluídos');
    h.button('Repetir Travessia da Vala Seca em uma nova tentativa').click();
    assert.deepEqual(entries, [chapterTarget('guaira-travessia')]);
});

test('optional travel suspends behind journey/hidden/resize and reduced motion only arrives; passing Bairro never enables Gallery', async t => {
    const h = browser(t, { water: true }), session = new GuairaChapterSession(), before = clearOpening(session);
    let entries = 0;
    const view = h.create(configuration(before, { arrival: 'bairro', walkToSelection: true, onEnter: () => { entries++; } }));
    await flush();
    assert.equal(road(view).arrival, 'bairro');
    assert.equal(view.canEnter(optionalTarget, before.generation, 0), false, 'A required walk through the actual Bairro anchor is not optional selection');
    h.tick(8); view.update(before, true, false, { target: optionalTarget, revision: 1 }); h.tick(3);
    const held = road(view).distance, delayed = [...h.frames.values()][0];
    h.button('Ver a jornada de Guaíra').click(); h.reduced(true); dispatch(h.win, 'resize');
    delayed(800_000); h.tick(30); assert.equal(road(view).distance, held); assert.equal(h.frames.size, 0);
    assert.equal(view.canEnter(optionalTarget, before.generation, 1), false);
    h.hidden(true); dispatch(h.byClass('chapter-map-dialog'), 'cancel');
    assert.equal(road(view).distance, held, 'Closing a hidden dialog does not consume travel');
    h.hidden(false); h.tick(); assert.equal(road(view).arrival, 'bairro'); assert.equal(entries, 0);
    const gallery = h.button(GALLERY_LABEL), retained = gallery.onclick!;
    h.hidden(true); retained(); assert.equal(entries, 0);
    h.hidden(false); h.button('Ver a jornada de Guaíra').click(); retained(); assert.equal(entries, 0);
    h.button('Fechar a jornada e voltar ao mapa').click(); assert.equal(entries, 0);
    gallery.click(); assert.equal(entries, 1);
});

test('Gallery return restores action focus after ready/visible without stealing later focus and retains Bairro through asset retry', async t => {
    for (const condition of ['normal', 'hidden', 'other-focus', 'failed'] as const) await t.test(condition, async subtest => {
        const h = browser(subtest, { deferredImage: condition !== 'failed', badMetadata: condition === 'failed' });
        const session = new GuairaChapterSession(), before = session.snapshot();
        const view = h.create(configuration(before, { arrival: 'bairro', navigation: { target: optionalTarget, revision: 6 }, focusAction: true }));
        if (condition === 'hidden') h.hidden(true);
        if (condition === 'other-focus') h.button('Sair do capítulo e voltar aos extras').focus();
        if (condition === 'failed') {
            await flush(); assert.equal(h.byClass('chapter-map-failure').hidden, false);
            h.repairMetadata(); h.button('Tentar carregar o mapa novamente').click();
        } else h.images[0].decoded.resolve();
        await flush(); h.tick();
        if (condition === 'hidden') { assert.equal(h.doc.activeElement, null); h.hidden(false); }
        const expected = condition === 'other-focus' ? h.button('Sair do capítulo e voltar aos extras') : h.button(GALLERY_LABEL);
        assert.equal(h.doc.activeElement, expected);
        assert.equal(road(view).arrival, 'bairro'); assert.equal(view.canEnter(optionalTarget, before.generation, 6), true);
        assert.deepEqual(session.snapshot(), before);
    });
});

test('optional target title takes precedence at 5/5 and a natural arrival repairs focused CHEGAR after DOM hides it', async t => {
    const h = browser(t), session = new GuairaChapterSession();
    for (const sceneId of session.snapshot().route) {
        const attempt = session.enterScene(sceneId, session.snapshot().generation)!;
        const result = sceneId === 'guaira-lab' ? { sceneId, kind: 'defeated-bull' } as const
            : sceneId === 'guaira-prefeito' ? { sceneId, kind: 'mayor-water-released' } as const : { sceneId, kind: 'reached-finish' } as const;
        session.continueFrom(attempt, { attempt, alive: true, state: 'playing', result });
    }
    const before = session.snapshot(); let entries = 0;
    const view = h.create(configuration(before, { walkToSelection: true, openingAvailable: false, navigation: { target: optionalTarget, revision: 17 }, onEnter: () => { entries++; } }));
    await flush(); h.tick(); const skip = h.button('Chegar agora, pulando a caminhada'); skip.focus();
    h.tick(500);
    assert.equal(road(view).arrival, 'bairro'); assert.equal(skip.hidden, true);
    assert.equal(h.doc.activeElement, h.button(GALLERY_LABEL));
    assert.equal(h.byClass('chapter-map-title').textContent, 'Galeria dos Remendos');
    assert.equal(h.byClass('chapter-map-count').textContent, '5/5 · concluídos');
    assert.match(h.byClass('chapter-map-story').textContent, /Ramal público aberto\. Os moradores têm água na bica outra vez\. Os gaps continuam\./);
    assert.equal(entries, 0); assert.deepEqual(session.snapshot(), before);
    h.button('Ver a jornada de Guaíra').click(); assert.equal(h.byClass('chapter-map-list').children.length, 5);
    assert.equal(h.byClass('chapter-map-optional').textContent.includes('Concluído'), false);
});

test('held activation keys are suppressed on native map buttons and arrivals never steal unrelated focus', async t => {
    const h = browser(t), session = new GuairaChapterSession(), before = session.snapshot(); let exits = 0;
    const view = h.create(configuration(before, { navigation: { target: optionalTarget, revision: 1 }, walkToSelection: true, onExit: () => { exits++; } }));
    await flush(); h.tick();
    const resume = h.button(RESUME_OPENING); resume.focus();
    const handler = getEventListeners(h.byClass('guaira-chapter-map'), 'keydown')[0];
    for (const key of ['Enter', ' ', 'Spacebar']) {
        const repeat = Object.assign(new Event('keydown', { cancelable: true }), { key, repeat: true });
        Object.defineProperty(repeat, 'target', { value: resume }); handler(repeat);
        assert.equal(repeat.defaultPrevented, true);
        const first = Object.assign(new Event('keydown', { cancelable: true }), { key, repeat: false });
        Object.defineProperty(first, 'target', { value: resume }); handler(first);
        assert.equal(first.defaultPrevented, false);
    }
    h.tick(500); assert.equal(road(view).arrival, 'bairro'); assert.equal(h.doc.activeElement, resume);
    const exit = h.button('Sair do capítulo e voltar aos extras').onclick!;
    h.hidden(true); exit(); assert.equal(exits, 0); h.hidden(false);
    h.button('Ver a jornada de Guaíra').click(); exit(); assert.equal(exits, 0);
    h.button('Fechar a jornada e voltar ao mapa').click(); exit(); assert.equal(exits, 0, 'An old closed-menu callback stays retired');
    h.button('Ver a jornada de Guaíra').click(); h.button('Sair do capítulo e voltar aos extras').click(); assert.equal(exits, 1);
});

test('window blur freezes actual road and water while visible, rejects retained actions, and resumes without elapsed catch-up', async t => {
    const h = browser(t, { water: true }), session = new GuairaChapterSession(), before = session.snapshot();
    let selected = 0, entered = 0, openings = 0, exits = 0;
    const view = h.create(configuration(before, { navigation: { target: optionalTarget, revision: 3 }, walkToSelection: true,
        onSelect: () => { selected++; }, onEnter: () => { entered++; }, onOpening: () => { openings++; }, onExit: () => { exits++; } }));
    await flush(); h.tick(14);
    const distance = road(view).distance, draws = h.draws(), delayedFrame = [...h.frames.values()][0];
    const retained = [h.button('Chegar agora, pulando a caminhada').onclick!, h.button(RESUME_OPENING).onclick!,
        h.button('Pátio das Comportas: usar como abertura alternativa').onclick!, h.button('Sair do capítulo e voltar aos extras').onclick!];
    h.blur(); assert.equal(h.doc.hidden, false); assert.equal(h.frames.size, 0);
    delayedFrame(900_000); retained.forEach(action => action()); h.tick(1_000); dispatch(h.win, 'resize');
    assert.equal(h.frames.size, 0); assert.equal(road(view).distance, distance); assert.equal(h.draws(), draws);
    assert.deepEqual({ selected, entered, openings, exits }, { selected: 0, entered: 0, openings: 0, exits: 0 });
    assert.equal(view.canEnter(optionalTarget, before.generation, 3), false);
    h.focus(); h.tick();
    assert.ok(road(view).distance > distance && road(view).distance - distance < 4, 'Focus restarts the walk clock instead of consuming background time');
    assert.ok(h.draws() > draws);
    h.button('Chegar agora, pulando a caminhada').click(); const entry = h.button(GALLERY_LABEL).onclick!;
    h.blur(); entry(); assert.equal(entered, 0); assert.equal(view.canEnter(optionalTarget, before.generation, 3), false);
    h.focus(); assert.equal(entered, 0); entry(); assert.equal(entered, 1);
    assert.deepEqual(session.snapshot(), before);
});

test('blur during the journey rejects row/restart/close callbacks and focus cannot advance travel behind the modal', async t => {
    const h = browser(t, { water: true }), session = new GuairaChapterSession(), before = session.snapshot();
    let selected = 0, restarts = 0;
    const view = h.create(configuration(before, { navigation: { target: optionalTarget, revision: 2 }, walkToSelection: true,
        onSelect: () => { selected++; }, onRestart: () => { restarts++; } }));
    await flush(); h.tick(9); h.button('Ver a jornada de Guaíra').click();
    const distance = road(view).distance;
    const retained = [h.button(OPTIONAL_LABEL).onclick!, h.byClass('chapter-map-list').children[0].children[0].onclick!,
        h.button('Voltar ao início sem apagar trechos concluídos').onclick!, h.button('Fechar a jornada e voltar ao mapa').onclick!];
    h.blur(); retained.forEach(action => action()); h.reduced(true); h.hidden(true); h.hidden(false);
    dispatch(h.byClass('chapter-map-dialog'), 'cancel'); dispatch(h.byClass('guaira-chapter-map'), 'keydown', { key: 'Escape' });
    assert.equal(h.byClass('chapter-map-dialog').open, true); assert.equal(road(view).distance, distance); assert.equal(h.frames.size, 0);
    assert.deepEqual({ selected, restarts }, { selected: 0, restarts: 0 });
    h.focus(); h.tick(30); assert.equal(h.byClass('chapter-map-dialog').open, true);
    assert.equal(road(view).distance, distance); assert.equal(h.frames.size, 0);
    h.button('Fechar a jornada e voltar ao mapa').click(); assert.equal(road(view).arrival, 'bairro');
    assert.equal(view.canEnter(optionalTarget, before.generation, 2), true);
});

test('a map created or decoded while window-blurred stays suspended until focus and disposal removes focus listeners', async t => {
    for (const blurredBeforeConstruction of [false, true]) await t.test(String(blurredBeforeConstruction), async subtest => {
        const h = browser(subtest, { deferredImage: true, water: true }), session = new GuairaChapterSession(), before = session.snapshot();
        if (blurredBeforeConstruction) h.blur();
        const view = h.create(configuration(before, { arrival: 'bairro', navigation: { target: optionalTarget, revision: 1 }, focusAction: true }));
        if (!blurredBeforeConstruction) h.blur();
        h.images[0].decoded.resolve(); await flush();
        assert.equal(h.frames.size, 0); assert.equal(h.doc.activeElement, null);
        assert.equal(view.canEnter(optionalTarget, before.generation, 1), false);
        h.focus(); assert.equal(h.doc.activeElement, h.button(GALLERY_LABEL));
        assert.equal(view.canEnter(optionalTarget, before.generation, 1), true);
        view.dispose(); assert.equal(getEventListeners(h.win, 'blur').length, 0); assert.equal(getEventListeners(h.win, 'focus').length, 0);
        h.blur(); h.focus(); h.images[1].decoded.resolve(); await flush();
        assert.equal(h.frames.size, 0); assert.equal(h.root.children.length, 0);
    });
});

/** Presentation fixture only; real Prefeito acceptance is covered separately. */
function acceptedWaterSession() {
    const session = new GuairaChapterSession();
    for (const sceneId of session.snapshot().route) {
        const attempt = session.enterScene(sceneId, session.snapshot().generation)!;
        const result = sceneId === 'guaira-lab' ? { sceneId, kind: 'defeated-bull' } as const
            : sceneId === 'guaira-prefeito' ? { sceneId, kind: 'mayor-water-released' } as const : { sceneId, kind: 'reached-finish' } as const;
        session.continueFrom(attempt, { attempt, alive: true, state: 'playing', result });
    }
    return session;
}

test('completed campaign return names the unlocked onward action without repeating the outcome or navigating automatically', async t => {
    const h = browser(t), session = acceptedWaterSession(), before = session.snapshot();
    let continuations = 0, entries = 0;
    const view = h.create(configuration(before, { arrival: 'vazao', campaign: true, canContinueCampaign: () => true,
        onContinueCampaign: () => { continuations++; }, onEnter: () => { entries++; } }));
    await flush(); h.tick();
    const status = h.byClass('chapter-map-status');
    assert.equal(status.textContent, 'Serra do Mar liberada · siga viagem pela Jornada.');
    assert.equal(status.getAttribute('role'), 'status'); assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.equal(h.byClass('chapter-map-story').textContent, 'Ramal público aberto. Os moradores têm água na bica outra vez. Os gaps continuam. · Progresso somente nesta sessão.');
    const onward = h.button('Seguir viagem para Serra do Mar'), repeat = h.button('Repetir o Prefeito em uma nova tentativa');
    assert.equal(onward.disabled, false); assert.equal(repeat.disabled, false);
    assert.equal(continuations, 0); assert.equal(entries, 0); assert.deepEqual(session.snapshot(), before);
    const retiredOnward = onward.onclick!;
    retiredOnward(); assert.equal(continuations, 0, 'Closed-menu utilities are inert');
    h.button('Ver a jornada de Guaíra').click();
    retiredOnward(); assert.equal(continuations, 0, 'Opening the menu does not refresh a retained callback');
    for (const mode of ['hidden', 'blur'] as const) {
        if (mode === 'hidden') h.hidden(true); else h.blur();
        onward.onclick!(); assert.equal(continuations, 0, `${mode} must keep the existing action interruption guard`);
        if (mode === 'hidden') h.hidden(false); else h.focus();
    }
    onward.click(); assert.equal(continuations, 1); assert.equal(entries, 0); assert.deepEqual(session.snapshot(), before);
    view.dispose(); onward.onclick?.(); assert.equal(continuations, 1);
});

test('onward completion copy survives restored progress without claiming persistence', async t => {
    const h = browser(t), earned = acceptedWaterSession().snapshot();
    const session = new GuairaChapterSession({ progress: { ...freshGuairaChapterProgress(),
        completed: [...earned.route], selectedScene: 'guaira-prefeito' } });
    const before = session.snapshot();
    h.create(configuration(before, { campaign: true, canContinueCampaign: () => true,
        storageMessage: () => 'Progresso somente nesta sessão.' }));
    await flush(); h.tick();
    assert.equal(h.byClass('chapter-map-status').textContent, 'Serra do Mar liberada · siga viagem pela Jornada.');
    assert.match(h.byClass('chapter-map-hint').textContent, /Progresso somente nesta sessão\./);
    assert.doesNotMatch(h.byClass('chapter-map-status').textContent, /salv[ao]/i);
    assert.deepEqual(session.snapshot(), before);
});

test('standalone, locked, incomplete, optional and earlier replay selections keep their own map guidance', async t => {
    for (const mode of ['standalone', 'locked', 'incomplete', 'optional', 'replay', 'walking'] as const) await t.test(mode, async subtest => {
        const h = browser(subtest), session = mode === 'incomplete' ? new GuairaChapterSession() : acceptedWaterSession();
        if (mode === 'replay') session.selectScene('guaira-travessia', session.snapshot().generation);
        const before = session.snapshot();
        h.create(configuration(before, { arrival: mode === 'optional' ? 'bairro' : mode === 'walking' ? 'town' : 'vazao',
            campaign: mode !== 'standalone', canContinueCampaign: () => mode !== 'locked',
            navigation: mode === 'optional' ? { target: optionalTarget, revision: 1 } : navigation(before),
            walkToSelection: mode === 'walking' }));
        await flush(); h.tick();
        const status = h.byClass('chapter-map-status').textContent;
        assert.doesNotMatch(status, /Serra do Mar liberada/);
        if (mode === 'optional') assert.match(status, /Desvio opcional/);
        else if (mode === 'walking') assert.match(status, /A caminho de Casa da Vazão/);
        else assert.match(status, /Feka|Caminhe/);
        if (mode === 'standalone') assert.equal(h.all().some(node => node.getAttribute('aria-label') === 'Seguir viagem para Serra do Mar'), false);
        assert.deepEqual(session.snapshot(), before);
    });
});

test('accepted Bairro water uses one existing clock without irrigation, preserves optional priority, and freezes on every suspension', async t => {
    const h = browser(t), session = acceptedWaterSession();
    const view = h.create(configuration(session.snapshot(), { arrival: 'bairro', navigation: { target: optionalTarget, revision: 1 } }));
    await flush(); h.tick(2);
    assert.equal(h.byClass('chapter-map-title').textContent, 'Galeria dos Remendos');
    assert.equal(h.byClass('chapter-map-count').textContent, '5/5 · concluídos');
    assert.equal(h.byClass('chapter-map-story').textContent, 'Ramal público aberto. Os moradores têm água na bica outra vez. Os gaps continuam. · Progresso somente nesta sessão.');
    assert.match(h.byClass('chapter-map-canvas').getAttribute('aria-label')!, /Bica do Bairro com água nesta sessão\./);
    assert.equal(h.button(GALLERY_LABEL).disabled, false); assert.equal(h.frames.size, 1);
    const internals = view as unknown as { water: { released: boolean; draw: (...args: unknown[]) => void }; waterClock: { seconds: number } };
    assert.equal(internals.water.released, true);
    let paints = 0; const draw = internals.water.draw.bind(internals.water);
    internals.water.draw = (...args) => { paints++; draw(...args); };
    h.tick(60); assert.equal(paints, 30, 'stationary water shares the existing 30Hz cadence');
    for (const mode of ['hidden', 'blur', 'menu'] as const) {
        const pending = [...h.frames.values()][0], seconds = internals.waterClock.seconds;
        const paintsBefore: number = paints;
        if (mode === 'hidden') h.hidden(true); else if (mode === 'blur') h.blur(); else h.button('Ver a jornada de Guaíra').click();
        const draws = h.draws();
        pending(900_000); h.tick(90); assert.equal(h.frames.size, 0); assert.equal(h.draws(), draws); assert.equal(paints, paintsBefore); assert.equal(internals.waterClock.seconds, seconds);
        if (mode === 'hidden') h.hidden(false); else if (mode === 'blur') h.focus(); else h.button('Fechar a jornada e voltar ao mapa').click();
        h.tick(); assert.equal(internals.waterClock.seconds, seconds, 'resume resets the timestamp without consuming hidden time');
        assert.equal(h.frames.size, 1); h.tick(2);
    }
    h.reduced(true); h.tick(); const still = h.draws(); h.tick(120); assert.equal(h.draws(), still); assert.equal(h.frames.size, 0);
    h.reduced(false); h.tick();
    const active = session.enterScene('guaira-prefeito', session.snapshot().generation)!;
    view.update(session.snapshot(), false, false, { target: chapterTarget('guaira-prefeito'), revision: 2 });
    h.tick(10); assert.equal(h.frames.size, 0); assert.equal(internals.water.released, true, 'replay retains receipt but has no active map paint');
    session.exitToMap(active, { attempt: active, alive: false, state: 'dead', result: null });
    view.update(session.snapshot(), false, false, { target: optionalTarget, revision: 3 }); h.tick(); assert.equal(h.frames.size, 1);
    view.dispose(); assert.equal(internals.water.released, false); assert.equal(h.frames.size, 0);
});

test('new or disposed sessions have no water text, and late old wet decode cannot repaint the new dry map', async t => {
    const h = browser(t, { deferredImage: true }), old = acceptedWaterSession();
    const first = h.create(configuration(old.snapshot(), { arrival: 'bairro', navigation: { target: optionalTarget, revision: 1 } }));
    const fresh = old.restartChapter(old.snapshot().generation)!;
    first.dispose();
    h.create(configuration(fresh.snapshot(), { arrival: 'bairro', navigation: { target: optionalTarget, revision: 1 } }));
    h.images[1].decoded.resolve(); await flush(); h.tick();
    const draws = h.draws(); h.images[0].decoded.resolve(); await flush(); h.tick(30);
    assert.equal(h.draws(), draws); assert.equal(h.frames.size, 0);
    assert.equal(h.byClass('chapter-map-count').textContent, '0/5 · concluídos');
    assert.doesNotMatch(h.byClass('chapter-map-hint').textContent, /moradores têm água/);
    assert.doesNotMatch(h.byClass('chapter-map-canvas').getAttribute('aria-label')!, /Bica do Bairro/);
    assert.equal(h.button(GALLERY_LABEL).disabled, false);
});

test('development chapter exposes existing stage choices without completed badges or new controls', async t => {
    const h = browser(t), session = new GuairaChapterSession({ developmentUnlocked: true });
    let selected: GuairaChapterMapTarget | null = null;
    h.create(configuration(session.snapshot(), { onSelect: target => { selected = target; } }));
    await flush(); h.tick();
    assert.equal(h.byClass('chapter-map-count').textContent, '0/5 · concluídos');
    h.button('Ver a jornada de Guaíra').click();
    const rows = h.all().filter(node => node.className === 'chapter-map-step-button');
    assert.equal(rows.length, 5);
    for (const row of rows) { assert.equal(row.disabled, false); assert.doesNotMatch(row.textContent, /Concluído|Depois de/); }
    rows[4].click(); assert.deepEqual(selected, chapterTarget('guaira-prefeito'));
    assert.equal(session.snapshot().accepted.length, 0);
});

test('integrated map keeps one Jornada action and moves settings, travel and opening alternatives into its modal', async t => {
    const h = browser(t), session = new GuairaChapterSession({ developmentUnlocked: true });
    const before = session.snapshot(); let exits = 0, audio = true;
    h.create(configuration(before, { campaign: true, canContinueCampaign: () => true,
        storageMessage: () => 'Conclusões salvas neste navegador.', audioEnabled: () => audio,
        onAudioEnabled: enabled => { audio = enabled; }, onExit: () => { exits++; } }));
    await flush(); h.tick();
    const journey = h.button('Ver a jornada de Guaíra'), dialog = h.byClass('chapter-map-dialog');
    assert.deepEqual(h.byClass('chapter-map-navigation').children, [journey]);
    assert.equal(h.byClass('chapter-map-openings').parent, dialog);
    assert.equal(h.byClass('chapter-map-utilities').parent, dialog);
    assert.equal(h.byClass('chapter-map-title').textContent, 'Travessia da Vala Seca');
    assert.equal(h.byClass('chapter-map-hint').hidden, true, 'Successful storage is not a permanent HUD message');
    assert.match(h.byClass('chapter-map-story').textContent, /cinco etapas.*Conclusões salvas/);
    assert.equal(journey.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(journey.getAttribute('aria-expanded'), 'false');
    const exit = h.button('Voltar à Fábrica e continuar a viagem'), staleExit = exit.onclick!;
    staleExit(); assert.equal(exits, 0);
    dispatch(h.byClass('guaira-chapter-map'), 'keydown', { key: 'Escape', repeat: false });
    assert.equal(dialog.open, true); assert.equal(journey.getAttribute('aria-expanded'), 'true');
    assert.equal(h.doc.activeElement, h.button('Fechar a jornada e voltar ao mapa'));
    dispatch(h.byClass('guaira-chapter-map'), 'keydown', { key: 'Escape', repeat: true });
    assert.equal(dialog.open, true, 'Holding Escape cannot reopen or repeatedly close the modal');
    staleExit(); assert.equal(exits, 0, 'A new menu does not renew an old utility callback');
    h.button('Desativar o som do capítulo').click(); assert.equal(audio, false); assert.equal(dialog.open, true);
    h.button('Ver mapa inteiro').click(); assert.equal(dialog.open, false);
    assert.equal(h.doc.activeElement, journey); assert.equal(h.button('Acompanhar Feka').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(session.snapshot(), before, 'Settings/panorama never create completion or unlock changes');
    journey.click(); exit.click(); assert.equal(exits, 1); assert.equal(dialog.open, false);
});

test('map loading and asset failure both retain the same modal exit without entering a level', async t => {
    const h = browser(t, { deferredImage: true }), session = new GuairaChapterSession(); let exits = 0, enters = 0;
    h.create(configuration(session.snapshot(), { onExit: () => { exits++; }, onEnter: () => { enters++; } }));
    const journey = h.button('Ver a jornada de Guaíra');
    assert.equal(journey.disabled, false); journey.click();
    assert.equal(h.byClass('chapter-map-dialog').open, true);
    h.button('Sair do capítulo e voltar aos extras').click(); assert.equal(exits, 1); assert.equal(enters, 0);
    h.images[0].decoded.reject(new Error('Image unavailable')); await flush();
    assert.equal(h.byClass('chapter-map-failure').hidden, false); journey.click();
    h.button('Sair do capítulo e voltar aos extras').click(); assert.equal(exits, 2); assert.equal(enters, 0);
    assert.equal(session.snapshot().accepted.length, 0);
});

test('Jornada sound button belongs to its current open menu while unmodified M remains available on the map', async t => {
    const h = browser(t), session = new GuairaChapterSession(); let audio = true, changes = 0;
    const view = h.create(configuration(session.snapshot(), { audioEnabled: () => audio,
        onAudioEnabled: enabled => { audio = enabled; changes++; } }));
    await flush();
    const shell = h.byClass('guaira-chapter-map'), journey = h.button('Ver a jornada de Guaíra');
    const sound = h.button('Desativar o som do capítulo'), beforeOpen = sound.onclick!;
    beforeOpen(); sound.click(); assert.equal(changes, 0, 'A utility in the closed dialog is inert');
    dispatch(shell, 'keydown', { key: 'M', repeat: false }); assert.equal(audio, false); assert.equal(changes, 1);
    for (const modifiers of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { repeat: true }])
        dispatch(shell, 'keydown', { key: 'm', ...modifiers });
    assert.equal(changes, 1, 'Modified or repeated shortcuts do not toggle sound');
    journey.click(); beforeOpen(); assert.equal(changes, 1, 'Opening does not renew a retained sound callback');
    const firstMenu = sound.onclick!;
    sound.click(); assert.equal(audio, true); assert.equal(changes, 2); assert.equal(h.byClass('chapter-map-dialog').open, true);
    h.button('Fechar a jornada e voltar ao mapa').click(); firstMenu(); assert.equal(changes, 2);
    journey.click(); firstMenu(); assert.equal(changes, 2, 'The first menu lease remains retired after reopening');
    const currentMenu = sound.onclick!;
    h.blur(); currentMenu(); assert.equal(changes, 2); h.focus();
    h.hidden(true); currentMenu(); assert.equal(changes, 2); h.hidden(false);
    sound.click(); assert.equal(audio, false); assert.equal(changes, 3);
    const disposed = sound.onclick!; view.dispose(); disposed(); assert.equal(changes, 3); assert.equal(sound.onclick, null);
});

test('modified Escape never opens or closes Jornada or consumes the browser shortcut', async t => {
    const h = browser(t), session = new GuairaChapterSession(); h.create(configuration(session.snapshot())); await flush();
    const shell = h.byClass('guaira-chapter-map'), dialog = h.byClass('chapter-map-dialog');
    for (const open of [false, true]) {
        if (open) h.button('Ver a jornada de Guaíra').click();
        for (const modifiers of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
            assert.equal(dispatch(shell, 'keydown', { key: 'Escape', repeat: false, ...modifiers }), true,
                'Modified Escape is not cancelled by the map');
            assert.equal(dialog.open, open);
        }
    }
    assert.equal(dispatch(shell, 'keydown', { key: 'Escape', repeat: false }), false);
    assert.equal(dialog.open, false, 'Unmodified Escape keeps its close action');
    assert.equal(dispatch(shell, 'keydown', { key: 'Escape', repeat: false }), false);
    assert.equal(dialog.open, true, 'Unmodified Escape keeps its open action');
});
