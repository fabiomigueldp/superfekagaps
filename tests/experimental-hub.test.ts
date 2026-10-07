import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFileSync } from 'node:fs';
import { ExperimentalHub, EXTRAS_LABEL } from '../src/adventure/experimental/hub/ExperimentalHub';
import { EXPERIMENTAL_HUB_RETURN, EXPERIMENTAL_ROUTES, experimentalTitleSize, requestsExperimentalHub } from '../src/adventure/experimental/hub/ExperimentalRoutes';
import { labActionSize } from '../src/adventure/experimental/JuiceLabToolbar';
import { pixelText, textWidth } from '../src/graphics/BitmapFont';
import { ART } from '../src/graphics/palette';
import { WorldGame } from '../src/adventure/WorldGame';
import { freshSave, SAVE_KEY } from '../src/adventure/progress';
import { sceneLifecycleBrowser, LifecycleElement } from './helpers/sceneLifecycleHarness';

/** Native game/input and listener lifetimes; the DOM boundary supplies modal/focus semantics.
 * This is not a browser layout or native-dialog conformance test. */
function browser(t: TestContext) {
    const h = sceneLifecycleBrowser(t);
    const doc = h.document as unknown as { activeElement: LifecycleElement | null; createElement(tag: string): LifecycleElement };
    const decorate = (element: LifecycleElement) => {
        Object.assign(element.style, {
            setProperty(name: string, value: string) { element.style[name] = value; },
            removeProperty(name: string) { delete element.style[name]; }
        });
        Object.defineProperty(element, 'classList', { configurable: true, value: {
            contains: (name: string) => element.className.split(' ').includes(name),
            toggle: (name: string, force: boolean) => {
                const classes = new Set(element.className.split(' ').filter(Boolean));
                if (force) classes.add(name); else classes.delete(name);
                element.className = [...classes].join(' ');
            }
        } });
        Object.defineProperty(element, 'isConnected', { get: () => element === h.body || element.parent !== null });
        element.focus = () => { doc.activeElement = element; };
        Object.assign(element, {
            inert: false, open: false,
            contains(target: LifecycleElement): boolean { return element === target || element.children.some(child => (child as unknown as { contains(t: LifecycleElement): boolean }).contains(target)); },
            showModal() { (element as unknown as { open: boolean }).open = true; },
            close() { (element as unknown as { open: boolean }).open = false; element.dispatch('close'); }
        });
        return element;
    };
    const create = doc.createElement;
    doc.createElement = tag => decorate(create(tag));
    decorate(h.body); decorate(h.canvas); decorate(h.status);
    const save = JSON.stringify({ ...freshSave(), completed: ['1-1'], selected: '1-2' });
    const writes: unknown[] = [], stored = new Map([[SAVE_KEY, save]]);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => { writes.push({ key, value }); stored.set(key, value); }
    } });
    const game = new WorldGame(h.canvas as unknown as HTMLCanvasElement);
    const descendants = (element: LifecycleElement): LifecycleElement[] => [element, ...element.children.flatMap(descendants)];
    const byId = (id: string) => descendants(h.body).find(element => element.id === id)!;
    const gameHub = () => (game as unknown as { experimentalHub: ExperimentalHub }).experimentalHub;
    // Real browser capture precedes bubble, unlike Node EventTarget's insertion order.
    const key = (key: string, values: Record<string, unknown> = {}, type = 'keydown') => {
        const event = new Event(type, { cancelable: true }); let stopped = false;
        Object.defineProperties(event, { key: { value: key }, code: { value: key === ' ' ? 'Space' : key.length === 1 ? `Key${key.toUpperCase()}` : key },
            target: { value: doc.activeElement }, repeat: { value: false, configurable: true },
            stopImmediatePropagation: { value: () => { stopped = true; } } });
        for (const [name, value] of Object.entries(values)) Object.defineProperty(event, name, { value });
        const listeners = h.window.listeners.filter(listener => listener.type === type).sort((a, b) => Number(b.capture) - Number(a.capture));
        for (const listener of listeners) {
            if (typeof listener.callback === 'function') listener.callback(event);
            else listener.callback.handleEvent(event);
            if (stopped) break;
        }
        return event;
    };
    return { ...h, game, byId, gameHub, key, writes, stored, save, doc };
}

test('main opts in once; open, Escape, cancel and close preserve campaign and release held inputs', t => {
    const h = browser(t); h.canvas.focus(); h.game.render();
    const initial = JSON.stringify(h.game.store.save), frames = h.frames.size;
    const source = h.game.input.createActionSource(); source.press('run');
    h.game.enableExperimentalHub(); h.game.enableExperimentalHub();
    const hub = h.gameHub(), entry = h.byId('open-experiments');
    assert.equal(h.body.children.filter(element => element.id === 'experimental-hub').length, 1);
    entry.focus(); entry.click();
    assert.equal(hub.isOpen, true); assert.equal(h.game.state, 'title');
    assert.equal(h.doc.activeElement?.tagName, 'A');
    assert.equal((h.canvas as unknown as { inert: boolean }).inert, true);
    for (const key of ['ArrowDown', 'ArrowRight', 's', 'w', 'm', ' ']) {
        h.key(key); h.game.update(16); h.key(key, {}, 'keyup');
        assert.ok(Object.values(h.game.input.getState()).every(value => value === false));
        assert.equal(h.game.state, 'title');
    }
    const selection = (h.game as unknown as { menuSelection: number }).menuSelection;
    assert.equal(selection, 0);
    h.canvas.dispatch('pointerdown', { clientX: 320, clientY: 218 });
    assert.equal(h.game.state, 'title', 'Behind-modal pointer must not begin the campaign');
    assert.equal(h.key('Escape').defaultPrevented, true);
    assert.equal(hub.isOpen, false); assert.equal(h.doc.activeElement, entry);
    assert.equal((h.canvas as unknown as { inert: boolean }).inert, false);
    entry.click(); h.byId('experimental-hub').dispatch('cancel'); assert.equal(hub.isOpen, false);
    entry.click(); h.byId('close-experiments').click(); assert.equal(hub.isOpen, false);
    assert.equal(JSON.stringify(h.game.store.save), initial); assert.equal(h.stored.get(SAVE_KEY), h.save);
    assert.deepEqual(h.writes, []); assert.equal(h.frames.size, frames, 'Hub creates no animation loop');
    source.dispose();
    h.canvas.focus(); h.key('Enter');
    assert.equal(h.game.state, 'intro', 'The campaign still starts normally after closing the hub');
    assert.equal(hub.rail.hidden, true);
});

test('modal traps boundary Tab, keeps native links and rejects repeated activation', t => {
    const h = browser(t); h.game.enableExperimentalHub('?experiments=1');
    const dialog = h.byId('experimental-hub'), nav = dialog.children.find(element => element.tagName === 'NAV')!;
    assert.equal(nav.children.length, 3);
    assert.equal(h.byId('experimental-hub-title').children.find(child => child.tagName === 'SPAN')?.textContent, 'EXTRAS');
    assert.equal(h.byId('experimental-hub-note').textContent, 'Para seguir a campanha, volte ao título.');
    assert.deepEqual(nav.children.map(link => (link as unknown as { href: string }).href), EXPERIMENTAL_ROUTES.map(route => route.href));
    const first = nav.children[0], close = h.byId('close-experiments');
    assert.equal(h.doc.activeElement, first);
    assert.equal(h.key('Tab', { shiftKey: true }).defaultPrevented, true); assert.equal(h.doc.activeElement, close);
    assert.equal(h.key('Tab').defaultPrevented, true); assert.equal(h.doc.activeElement, first);
    assert.equal(h.key('Enter').defaultPrevented, false, 'Browser performs ordinary anchor activation');
    assert.equal(h.key('Enter', { repeat: true }).defaultPrevented, true);
    assert.equal(first.dispatch('click', { ctrlKey: true, button: 0 }).defaultPrevented, false);
    assert.equal(first.dispatch('click', { metaKey: true, button: 0 }).defaultPrevented, false);
    assert.equal(first.dispatch('auxclick', { button: 1 }).defaultPrevented, false);
    assert.equal(h.gameHub().isOpen, true, 'Modified link activation leaves the existing session open');
    h.window.dispatch('pagehide'); assert.equal(h.gameHub().isOpen, false);
    h.window.dispatch('pageshow', { persisted: true }); assert.equal(h.gameHub().isOpen, true);
});

test('chooser has one useful description per route, full accessible labels and no repeated introduction', t => {
    const h = browser(t); h.game.enableExperimentalHub();
    const dialog = h.byId('experimental-hub'), nav = dialog.children.find(element => element.tagName === 'NAV')!;
    assert.deepEqual(dialog.children.map(child => child.tagName), ['H1', 'NAV', 'P', 'BUTTON']);
    assert.equal(dialog.getAttribute('aria-labelledby'), 'experimental-hub-title');
    assert.equal(dialog.getAttribute('aria-describedby'), 'experimental-hub-note');
    const choices = [
        ['./guaira-capitulo.html', 'CAPÍTULO DE GUAÍRA', 'Progresso salvo neste navegador.'],
        ['./guaira.html', 'GUAÍRA LIVRE', 'Explore percursos em treino, sem salvar.'],
        ['./juice-lab.html', 'TREINO TURBOSUCO', 'Treine a arena, sem salvar progresso.']
    ];
    assert.deepEqual(EXPERIMENTAL_ROUTES.map(({ href, label, description }) => [href, label, description]), choices);
    for (const [index, [href, label, description]] of choices.entries()) {
        const link = nav.children[index], [plate, detail] = link.children;
        assert.equal((link as unknown as { href: string }).href, href);
        assert.equal(link.getAttribute('aria-label'), `${label}. ${description}`);
        assert.equal(plate.children.find(child => child.tagName === 'SPAN')?.textContent, label);
        assert.equal(detail.textContent, description);
        assert.equal(link.children.length, 2, 'one label and one description');
    }
    for (const [id, label] of [['open-experiments', EXTRAS_LABEL], ['close-experiments', 'VOLTAR AO TÍTULO']]) {
        const button = h.byId(id);
        assert.equal(button.getAttribute('aria-label'), label);
        assert.equal(button.children.find(child => child.tagName === 'SPAN')?.textContent, label);
    }
    assert.deepEqual(h.writes, [], 'chooser copy and artwork do not change saved progress');
});

test('heading uses native bitmap glyphs and full labels fit their canvases and narrow chooser contracts', t => {
    const h = browser(t), create = h.doc.createElement;
    type Pixel = { color: string; x: number; y: number; width: number; height: number };
    const paintings = new Map<LifecycleElement, Pixel[]>();
    h.doc.createElement = tag => {
        const element = create(tag);
        if (tag === 'canvas') {
            const pixels: Pixel[] = []; paintings.set(element, pixels);
            const ctx = element.getContext(); let scale = 1;
            ctx.setTransform = (a?: number | DOMMatrix2DInit, _b?: number, _c?: number, d?: number) => {
                assert.ok(typeof a === 'number'); assert.equal(a, d); scale = a;
            };
            ctx.fillRect = (x, y, width, height) => pixels.push({ color: String(ctx.fillStyle), x: x * scale, y: y * scale, width: width * scale, height: height * scale });
        }
        return element;
    };
    h.game.enableExperimentalHub();
    const heading = h.byId('experimental-hub-title').children.find(child => child.tagName === 'CANVAS')!;
    assert.equal(heading.width, textWidth(EXTRAS_LABEL, 2)); assert.equal(heading.height, 14);
    assert.equal(heading.getAttribute('aria-hidden'), 'true');
    const expected: Pixel[] = [];
    pixelText({ fillRect: (x: number, y: number, width: number, height: number) => expected.push({ color: ART.goldLight, x, y, width, height }) } as unknown as CanvasRenderingContext2D,
        EXTRAS_LABEL, 0, 0, ART.goldLight, 2);
    assert.deepEqual(paintings.get(heading), expected, 'small shared-font heading has no decorative plate or replacement art');
    for (const [canvas, pixels] of paintings) {
        assert.ok(pixels.length > 0);
        for (const { x, y, width, height } of pixels) {
            assert.ok(x >= 0 && y >= 0 && x + width <= canvas.width && y + height <= canvas.height,
                'every actual painted rectangle stays inside its bitmap');
        }
    }
    const nav = h.byId('experimental-hub').children.find(element => element.tagName === 'NAV')!;
    for (const [index, route] of EXPERIMENTAL_ROUTES.entries()) {
        const canvas = nav.children[index].children[0].children.find(child => child.tagName === 'CANVAS')!;
        assert.equal(canvas.width, labActionSize(route.label).width * 2);
        assert.equal(canvas.height, 44);
        assert.ok(textWidth(route.label, 2) + 12 <= canvas.width, 'complete bitmap label keeps its side padding');
        // CSS contract arithmetic only; native browser layout is checked separately.
        for (const viewport of [240, 280, 320, 472]) {
            const available = Math.min(440, viewport - 20) - 6 - 24 - 6 - 16;
            const displayedWidth = Math.min(canvas.width, available);
            assert.ok(displayedWidth <= available);
            assert.ok(canvas.height * displayedWidth / canvas.width <= 44, 'art scales proportionally inside the unchanged 62px link target');
        }
    }
    const css = readFileSync(new URL('../src/adventure/experimental/hub/experimental-hub.css', import.meta.url), 'utf8');
    assert.match(css, /\.experimental-route-plate \{[^}]*max-width: 100%/);
    assert.match(css, /\.experimental-route-plate \.lab-action-art \{ height: auto; \}/);
    assert.match(css, /\.experimental-entry \.lab-action-art, \.experimental-hub \.lab-action-art \{[^}]*max-width: 100%/);
    assert.match(css, /\.experimental-route \{[^}]*min-height: 62px/);
    assert.match(css, /\.experimental-entry button, \.experimental-hub button \{[^}]*min-height: 44px; min-width: 44px/);
    assert.match(css, /\.experimental-hub button \{ max-width: 100%; \}/);
});

test('canvas-unavailable and forced-colors fallbacks retain readable heading and complete control names', t => {
    const h = browser(t), create = h.doc.createElement;
    h.doc.createElement = tag => {
        const element = create(tag);
        if (tag === 'canvas') element.getContext = () => null as unknown as CanvasRenderingContext2D;
        return element;
    };
    h.game.enableExperimentalHub('?experiments=1');
    const heading = h.byId('experimental-hub-title');
    const nav = h.byId('experimental-hub').children.find(element => element.tagName === 'NAV')!;
    const controls = [h.byId('open-experiments'), heading, ...nav.children.map(link => link.children[0]), h.byId('close-experiments')];
    const labels = [EXTRAS_LABEL, EXTRAS_LABEL, ...EXPERIMENTAL_ROUTES.map(route => route.label), 'VOLTAR AO TÍTULO'];
    for (const [index, control] of controls.entries()) {
        assert.equal(control.children.find(child => child.tagName === 'CANVAS')?.hidden, true);
        const text = control.children.find(child => child.tagName === 'SPAN')!;
        assert.equal(text.textContent, labels[index]); assert.equal(text.className, '', 'fallback text is visible');
    }
    assert.equal(h.key('Escape').defaultPrevented, true); assert.equal(h.gameHub().isOpen, false);
    const css = readFileSync(new URL('../src/adventure/experimental/hub/experimental-hub.css', import.meta.url), 'utf8');
    assert.match(css, /\.experimental-heading-art\[hidden\] \{ display: none; \}/);
    assert.match(css, /\.experimental-entry \.lab-action-art\[hidden\], \.experimental-hub \.lab-action-art\[hidden\]/);
    const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
    assert.match(forced, /\.experimental-heading-art \{ display: none; \}/);
    assert.match(forced, /\.experimental-hub \.lab-sr \{[^}]*position: static;[^}]*clip-path: none;[^}]*white-space: normal;[^}]*overflow-wrap: anywhere/);
});

test('title-only styling, stale callbacks and disposal do not touch other scenes', t => {
    const h = browser(t); const baseListeners = h.listenerCount();
    h.game.enableExperimentalHub(); const hub = h.gameHub();
    h.game.render(); assert.ok(h.body.classList.contains('experimental-title'));
    const originalWidth = h.canvas.style.width;
    h.window.innerWidth = 472; h.window.innerHeight = 303; h.window.dispatch('resize');
    assert.equal(h.canvas.style['--experimental-title-width'], '320px');
    const savedOpen = h.byId('open-experiments'); savedOpen.click();
    (h.game as unknown as { change(screen: string): void }).change('gallery');
    assert.equal(hub.isOpen, false); assert.equal(hub.rail.hidden, true);
    assert.equal(h.body.classList.contains('experimental-title'), false);
    assert.equal(h.canvas.style.width, '320px', 'Renderer inline dimensions remain owned by its resize');
    savedOpen.click(); assert.equal(hub.isOpen, false);
    (h.game as unknown as { change(screen: string): void }).change('title');
    assert.equal(hub.rail.hidden, false);
    h.game.dispose(); assert.equal(h.listenerCount(), 0); assert.equal(h.frames.size, 0);
    assert.equal(h.body.children.some(element => element.id === 'experimental-hub'), false);
    assert.equal(h.canvas.style['--experimental-title-width'], undefined);
    savedOpen.click(); hub.open(); assert.equal(hub.isOpen, false);
    assert.ok(baseListeners > 0); assert.equal(originalWidth, '640px');
    const ephemeral = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
    ephemeral.enableExperimentalHub('?experiments=1');
    assert.equal((ephemeral as unknown as { experimentalHub?: ExperimentalHub }).experimentalHub, undefined);
    ephemeral.dispose(); assert.equal(h.listenerCount(), 0);
});

test('closed return context rejects duplicate, arbitrary and session-bearing values', () => {
    assert.equal(EXPERIMENTAL_HUB_RETURN, './?experiments=1');
    assert.equal(requestsExperimentalHub('?experiments=1'), true);
    for (const search of ['', '?experiments=true', '?experiments=https://example.com', '?experiments=1&experiments=1', '?return=./?experiments=1', '?session=5'])
        assert.equal(requestsExperimentalHub(search), false, search);
    assert.equal(requestsExperimentalHub('?experiments=1&return=https://example.com&session=5'), true,
        'Unrelated values never become destinations or restore session results');
});

test('compact title geometry leaves a 44px rail and preserves canvas coordinates/aspect', () => {
    for (const [width, height] of [[472, 303], [320, 480], [640, 360], [844, 390], [960, 540], [320, 180], [280, 180]]) {
        const size = experimentalTitleSize(width, height);
        assert.ok(size.width <= width); assert.ok(size.height + 60 <= height);
        assert.ok(Math.abs(size.width / size.height - 320 / 180) < 1e-12);
    }
    assert.deepEqual(experimentalTitleSize(472, 303), { width: 320, height: 180 });
    assert.deepEqual(experimentalTitleSize(320, 480), { width: 320, height: 180 });
    assert.equal(experimentalTitleSize(640, 360).height, 300, 'Reserve rail space without dropping a whole integer scale');
});

test('title exposes its native menu before Extras and leaves Tab traversal to the browser', t => {
    const h = browser(t); h.canvas.focus(); h.game.render(); h.game.enableExperimentalHub();
    const hub = h.gameHub(), entry = h.byId('open-experiments');
    const menu = h.body.children.find(element => element.className === 'canvas-menu-accessibility');
    assert.ok(menu); assert.equal(menu.hidden, false); assert.equal(hub.rail.hidden, false);
    assert.deepEqual(menu.children.map(button => button.textContent), ['CONTINUAR', 'OPÇÕES', 'GALERIA', 'ORIGINAL']);
    assert.ok(h.body.children.indexOf(menu) < h.body.children.indexOf(hub.rail as unknown as LifecycleElement),
        'Native title controls precede Extras in document/tab order.');
    for (const button of [...menu.children, entry]) {
        assert.equal(button.tagName, 'BUTTON'); assert.equal(button.disabled, false); assert.equal(button.tabIndex, 0);
        button.focus();
        for (const shiftKey of [false, true]) {
            // The DOM harness does not implement browser Tab focus movement. Check
            // both event owners leave it native instead of faking that movement.
            if (button !== entry) assert.equal(menu.dispatch('keydown', { key: 'Tab', shiftKey, target: button }).defaultPrevented, false);
            assert.equal(h.key('Tab', { shiftKey }).defaultPrevented, false);
            assert.equal(hub.isOpen, false, 'Tab must not become an Extras activation shortcut.');
            assert.equal(h.game.state, 'title');
        }
    }
    entry.click(); assert.equal(hub.isOpen, true, 'The separately focusable Extras control still opens the chooser.');
    assert.deepEqual(h.writes, []); assert.equal(h.stored.get(SAVE_KEY), h.save);
    h.game.dispose();
});

test('actual entrypoints preserve final focus ordering, return links, and fresh chapter sessions', () => {
    const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    const main = read('src/main.ts');
    assert.ok(main.indexOf('game.enableExperimentalHub') > main.lastIndexOf('canvas.focus('));
    assert.match(main, /if \(game instanceof WorldGame\) game.enableExperimentalHub/);
    assert.match(read('guaira.html'), /id="map-exit" href="\.\/\?experiments=1"/);
    assert.match(read('guaira.html'), /id="map-chapter" href="\.\/guaira-capitulo.html"/);
    assert.match(read('juice-lab.html'), /id="lab-exit" href="\.\/\?experiments=1"/);
    const chapter = read('src/guaira-capitulo.ts');
    assert.match(chapter, /location.assign\(EXPERIMENTAL_HUB_RETURN\)/);
    assert.match(chapter, /if \(event.persisted\) \{ chapter.dispose\(\); chapter = createChapter\(\); \}/);
    const css = read('src/adventure/experimental/hub/experimental-hub.css');
    assert.match(css, /min-height: 44px/); assert.match(css, /forced-colors/);
    assert.doesNotMatch(read('src/adventure/experimental/hub/ExperimentalHub.ts'), /localStorage|sessionStorage|requestAnimationFrame|new Image/);
});

test('failed native modal acquisition restores inertness, touch and focus; retry succeeds', t => {
 const h=browser(t); h.canvas.focus(); h.game.enableExperimentalHub(); const hub=h.gameHub();
 const dialog=h.byId('experimental-hub') as unknown as {showModal():void;open:boolean};
 const show=dialog.showModal; dialog.showModal=()=>{throw Error('native showModal failure')};
 assert.throws(()=>hub.open(), /native showModal failure/);
 assert.equal(hub.isOpen,false); assert.equal((h.canvas as any).inert,false);
 assert.equal((h.game.input as any).canvasTouchSuspensions.size,0); assert.equal(h.doc.activeElement,h.canvas);
 dialog.showModal=show; hub.open(); assert.equal(hub.isOpen,true);
 h.game.dispose(); assert.equal(h.listenerCount(),0); assert.equal(h.frames.size,0);
});
test('native close, delayed close and page restoration are idempotent', t => {
 const h=browser(t); h.canvas.focus(); h.game.enableExperimentalHub('?experiments=1'); const hub=h.gameHub();
 const dialog=h.byId('experimental-hub') as any;
 dialog.close(); assert.equal(hub.isOpen,false); assert.equal(h.doc.activeElement,h.canvas);
 assert.equal((h.game.input as any).canvasTouchSuspensions.size,0);
 h.window.dispatch('pagehide'); h.window.dispatch('pageshow',{persisted:true}); assert.equal(hub.isOpen,false);
 hub.open(); dialog.dispatch('close'); assert.equal(hub.isOpen,true,'A delayed close notification cannot dismiss a reopened modal');
 h.window.dispatch('pagehide'); assert.equal(hub.isOpen,false);
 h.window.dispatch('pageshow',{persisted:true}); assert.equal(hub.isOpen,true);
 assert.equal((h.game.input as any).canvasTouchSuspensions.size,1);
 h.window.dispatch('pageshow',{persisted:true}); assert.equal((h.game.input as any).canvasTouchSuspensions.size,1);
 h.game.dispose(); assert.equal(h.listenerCount(),0);
});
