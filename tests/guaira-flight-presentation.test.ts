import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import metadata from '../public/assets/world/map/journey-aircraft.meta.json';
import { runGuairaFlight, type GuairaAirTerminal } from '../src/adventure/WorldGuairaFlight';
import { labActionSize } from '../src/adventure/experimental/JuiceLabToolbar';

function browser(t: TestContext, canvasAvailable = true) {
    const context = { setTransform() {}, fillRect() {}, clearRect() {} };
    class Element extends EventTarget {
        className = ''; title = ''; type = ''; width = 0; height = 0;
        children: Element[] = []; private text = ''; disabled = false; hidden = false;
        isConnected = true; removed = false; attributes = new Map<string, string>();
        get textContent(): string { return this.text + this.children.map(child => child.textContent).join(''); }
        set textContent(value: string) { this.text = value; this.children = []; }
        constructor(readonly tagName: string) { super(); }
        append(...children: Element[]) { this.children.push(...children); }
        setAttribute(name: string, value: string) { this.attributes.set(name, value); }
        showModal() {} close() {} remove() { this.removed = true; }
        getContext() { return canvasAvailable ? context : null; }
        click() { if (!this.disabled && !this.hidden) this.dispatchEvent(new Event('click')); }
        focus() { document.activeElement = this; }
    }
    const prior = new Element('BUTTON');
    const document = Object.assign(new EventTarget(), { body: new Element('BODY'), hidden: false, activeElement: prior,
        createElement: (tag: string) => new Element(tag.toUpperCase()) });
    const window = Object.assign(new EventTarget(), { matchMedia: () => ({ matches: false }), setTimeout, clearTimeout });
    class Image {
        onload: (() => void) | null = null; onerror: (() => void) | null = null;
        naturalWidth = metadata.atlas.width; naturalHeight = metadata.atlas.height;
        set src(_path: string) { queueMicrotask(() => this.onload?.()); }
    }
    let fetchOK = true;
    for (const [key, value] of Object.entries({ document, window, Image, HTMLElement: Element,
        fetch: async (): Promise<{ ok: boolean; json(): Promise<typeof metadata> }> => ({ ok: fetchOK, json: async () => metadata }),
        requestAnimationFrame: (): number => 1, cancelAnimationFrame: () => {} })) {
        const before = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
        t.after(() => before ? Object.defineProperty(globalThis, key, before) : Reflect.deleteProperty(globalThis, key));
    }
    return { document, prior, failLoad() { fetchOK = false; }, allowLoad() { fetchOK = true; },
        get dialog() { return document.body.children.at(-1)!; },
        ready: async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); } };
}

const routes: [GuairaAirTerminal, GuairaAirTerminal, string][] = [
    ['factory', 'guaira', 'Fábrica → Guaíra'], ['guaira', 'factory', 'Guaíra → Fábrica'],
    ['guaira', 'serra', 'Guaíra → Serra'], ['serra', 'guaira', 'Serra → Guaíra'],
];
for (const [from, to, title] of routes) test(`native flight overlay retains route and full action names: ${title}`, async t => {
    const h = browser(t); let canceled = 0;
    const close = runGuairaFlight({ from, to, onArrive: () => assert.fail('no implicit arrival'), onCancel: () => { canceled++; } });
    const [scene, header, nav] = h.dialog.children;
    const heading = header.children[0], status = header.children[1], [skip, cancel, retry] = nav.children;
    assert.equal(scene.className, 'guaira-flight-scene'); assert.equal(scene.width, 960); assert.equal(scene.height, 540);
    assert.equal(heading.tagName, 'H2'); assert.equal(heading.textContent, title);
    assert.equal(heading.children[0].attributes.get('aria-hidden'), 'true');
    assert.equal(heading.children[0].height, 22); assert.ok(heading.children[0].width <= 244);
    assert.equal(heading.children[1].className, 'guaira-flight-sr');
    assert.equal(status.attributes.get('aria-live'), 'polite'); assert.equal(status.attributes.get('aria-atomic'), 'true');
    assert.equal(skip.disabled, true); assert.equal(retry.hidden, true);
    for (const [control, label, start] of [[skip, 'PULAR VIAGEM', 'Pular viagem'], [cancel, 'CANCELAR', 'Cancelar voo'], [retry, 'TENTAR DE NOVO', 'Tentar de novo']] as const) {
        const [art, text] = control.children;
        assert.equal(control.tagName, 'BUTTON'); assert.equal(control.type, 'button');
        assert.equal(art.className, 'lab-action-art'); assert.equal(art.attributes.get('aria-hidden'), 'true');
        assert.equal(art.height, 44); assert.equal(art.width, labActionSize(label).width * 2);
        assert.ok(text.textContent.startsWith(start)); assert.equal(control.title, text.textContent);
        assert.equal(control.attributes.get('aria-label'), text.textContent);
    }
    assert.ok(skip.children[0].width + cancel.children[0].width + 8 <= 300, 'Both normal controls fit at 320px without shrinking bitmap glyphs.');
    await h.ready(); assert.equal(skip.disabled, false);
    h.document.activeElement = cancel;
    h.dialog.dispatchEvent(new Event('cancel', { cancelable: true })); close();
    assert.equal(canceled, 1); assert.equal(h.dialog.removed, true); assert.equal(h.document.activeElement, h.prior);
});

test('load retry and save retry keep native buttons, bitmap decoration and original callback semantics', async t => {
    const h = browser(t); h.failLoad(); let attempts = 0;
    runGuairaFlight({ from: 'factory', to: 'guaira', onArrive: () => ++attempts > 1 });
    const [, header, nav] = h.dialog.children, [skip, , retry] = nav.children, art = skip.children[0];
    await h.ready(); assert.equal(skip.disabled, true); assert.equal(retry.hidden, false);
    assert.match(header.children[1].textContent, /não carregou/);
    h.allowLoad(); retry.click(); await h.ready();
    assert.equal(skip.disabled, false); assert.equal(retry.hidden, true);
    skip.click(); assert.equal(attempts, 1); assert.equal(h.dialog.removed, false);
    assert.equal(skip.children[0], art, 'The failed-save label repaints the original control.');
    assert.equal(art.width, labActionSize('TENTAR SALVAR').width * 2); assert.equal(art.height, 44);
    assert.equal(skip.attributes.get('aria-label'), 'Tentar salvar e continuar');
    assert.equal(skip.children[1].textContent, 'Tentar salvar e continuar');
    skip.click(); skip.click(); assert.equal(attempts, 2); assert.equal(h.dialog.removed, true);
});

test('Canvas-unavailable overlay exposes complete readable title and controls', async t => {
    const h = browser(t, false); let canceled = 0;
    runGuairaFlight({ from: 'guaira', to: 'factory', onArrive: () => assert.fail(), onCancel: () => { canceled++; } });
    const [, header, nav] = h.dialog.children;
    assert.equal(header.children[0].children.length, 1);
    assert.equal(header.children[0].children[0].className, '');
    assert.equal(header.children[0].textContent, 'Guaíra → Fábrica');
    for (const button of nav.children) {
        assert.equal(button.children[0].hidden, true); assert.equal(button.children[1].className, '');
        assert.ok(button.children[1].textContent.length > 0);
    }
    await h.ready(); nav.children[1].click(); assert.equal(canceled, 1);
});

test('flight CSS keeps scene-only reveal, safe-area clearances, 44px targets and forced-color text', () => {
    const css = readFileSync(new URL('../src/adventure/guaira-campaign.css', import.meta.url), 'utf8');
    const flight = css.slice(css.indexOf('/* The scene stays fullscreen'));
    assert.doesNotMatch(flight, /\.guaira-flight(?:\[data-ready="true"\])? canvas\s*\{/);
    assert.match(flight, /\.guaira-flight button\s*\{[^}]*min-height: 44px; min-width: 44px;/);
    assert.match(flight, /button:focus-visible\s*\{ outline: 3px solid #fff9e6; outline-offset: 3px;/);
    for (const side of ['top', 'right', 'bottom', 'left']) assert.ok(flight.includes(`env(safe-area-inset-${side})`));
    const reduced = flight.slice(flight.indexOf('@media (prefers-reduced-motion: reduce)'));
    assert.match(reduced, /\.guaira-flight\[data-ready="true"\] \.guaira-flight-scene \{ animation: none;/);
    const forced = flight.slice(flight.indexOf('@media (forced-colors: active)'));
    assert.match(forced, /\.guaira-flight-title-art, \.guaira-flight \.lab-action-art \{ display: none;/);
    assert.match(forced, /position: static; width: auto; height: auto;/);
    assert.match(forced, /clip-path: none; white-space: normal; overflow-wrap: anywhere;/);
    assert.match(forced, /button:disabled \{ color: GrayText; border-color: GrayText; opacity: 1;/);
    assert.match(forced, /button:focus-visible \{ outline-color: Highlight;/);
});
