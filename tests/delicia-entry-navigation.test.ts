import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { getEventListeners } from 'node:events';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import type { DeliciaApp } from '../src/adventure/delicia/DeliciaApp';
import { DELICIA_SAVE_KEY, freshDeliciaSave } from '../src/adventure/delicia/DeliciaProgress';
import { SAVE_KEY, freshSave } from '../src/adventure/progress';

/** Browser boundaries only: the shared entry, app lifecycle and store execute unchanged. */
function fixture(t: TestContext, href: string, unreadable = false) {
    let activeElement: Element | null = null;
    class Element extends EventTarget {
        className = ''; dataset = {}; hidden = false; disabled = false; href = '';
        children: Element[] = []; parent: Element | null = null; private text = '';
        constructor(readonly tagName: string) { super(); }
        get textContent(): string { return this.text + this.children.map(child => child.textContent).join(''); }
        set textContent(value: string) { this.text = value; this.replaceChildren(); }
        get classList() { return { add: (name: string) => { this.className += ' ' + name; } }; }
        append(...children: Element[]) { for (const child of children) { child.parent = this; this.children.push(child); } }
        replaceChildren(...children: Element[]) { this.children.forEach(child => child.parent = null); this.children = []; this.append(...children); }
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
        setAttribute() {}
        removeAttribute() {}
        getContext() { return null; }
        all(): Element[] { return this.children.flatMap(child => [child, ...child.all()]); }
        querySelector() { return this.all().find(node => node.tagName === 'button') ?? null; }
        focus() { activeElement = this; }
        click() { this.dispatchEvent(new Event('click')); }
    }
    const body = new Element('body'), originalCanvas = new Element('canvas'), editor = new Element('aside');
    body.append(originalCanvas, editor);
    const window = Object.assign(new EventTarget(), { location: new URL(href), deliciaGame: null as DeliciaApp | null });
    const document = Object.assign(new EventTarget(), { body, hidden: false, title: '',
        createElement: (tag: string) => new Element(tag),
        getElementById: (id: string) => id === 'game-canvas' ? originalCanvas : id === 'editor-ui' ? editor : null });
    Object.defineProperty(document, 'activeElement', { get: () => activeElement });
    const saved = freshDeliciaSave();
    saved.completed = ['delicia-1', 'delicia-2']; saved.selected = 'delicia-3';
    saved.checkpoint = { stage: 'delicia-3', index: 1, valves: ['v5'] };
    const storage = new Map([[DELICIA_SAVE_KEY, JSON.stringify(saved)], [SAVE_KEY, JSON.stringify(freshSave())]]);
    const reads: string[] = [], writes: string[] = [], frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    const originals = new Map<string, PropertyDescriptor | undefined>();
    for (const [name, value] of Object.entries({ window, document, navigator: { maxTouchPoints: 0 },
        localStorage: { getItem(key: string) { reads.push(key); if (unreadable) throw new Error('Storage blocked'); return storage.get(key) ?? null; },
            setItem(key: string, value: string) { writes.push(key); storage.set(key, value); } },
        requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++frameId, callback); return frameId; },
        cancelAnimationFrame(id: number) { frames.delete(id); }, fetch: async () => ({ ok: false }) })) {
        originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, { configurable: true, value });
    }
    const appUrl = new URL('../src/adventure/delicia/DeliciaApp.ts', import.meta.url), require = createRequire(appUrl);
    const css = require.extensions['.css']; require.extensions['.css'] = () => {};
    const compile = (url: URL, injectedRequire: (id: string) => unknown = require) => {
        // Vite normally supplies DEV; keeping it true exposes the actual constructed app for assertions.
        const source = readFileSync(url, 'utf8').replace('import.meta', '({env:{DEV:true}})');
        const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
        const module = { exports: {} };
        runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename: url.pathname })(injectedRequire, module, module.exports);
        return module.exports;
    };
    const appModule = compile(appUrl) as typeof import('../src/adventure/delicia/DeliciaApp');
    const { DeliciaArt } = require('./DeliciaArt') as typeof import('../src/adventure/delicia/DeliciaArt');
    const artRequests: Array<() => void> = [];
    t.mock.method(DeliciaArt.prototype, 'load', () => new Promise<void>(resolve => { artRequests.push(resolve); }));
    t.after(() => {
        window.deliciaGame?.dispose();
        if (css) require.extensions['.css'] = css; else delete require.extensions['.css'];
        for (const [name, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
        }
    });
    compile(new URL('../src/adventure/delicia/entry.ts', import.meta.url), id => id === './DeliciaApp' ? appModule : require(id));
    const transition = (type: 'pagehide' | 'pageshow', persisted: boolean) => {
        const event = new Event(type); Object.defineProperty(event, 'persisted', { value: persisted }); window.dispatchEvent(event);
    };
    const roots = () => body.children.filter(node => node.className === 'delicia');
    const listeners = () => ['keydown', 'keyup', 'blur', 'pointerup', 'pointercancel', 'pagehide', 'pageshow', 'resize']
        .map(type => getEventListeners(window, type).length).concat(getEventListeners(document, 'visibilitychange').length);
    const click = (text: string) => {
        const button = body.all().find(node => node.tagName === 'button' && node.textContent === text);
        assert.ok(button, `Missing ${text} button`); button.click();
    };
    return { window, body, originalCanvas, editor, storage, saved, reads, writes, frames, artRequests, roots, listeners, transition, click,
        app: () => { assert.ok(window.deliciaGame); return window.deliciaGame; } };
}

for (const path of ['/world/releases/candidate/delicia.html', '/world/releases/candidate/?delicia=true']) {
    test(`Back/Forward remounts the disposed Delícia entry once at ${path}`, async t => {
        const h = fixture(t, `https://game.example${path}`), before = [...h.storage], listeners = h.listeners();
        assert.equal(h.roots().length, 1); assert.equal(h.originalCanvas.hidden, true); assert.equal(h.editor.hidden, true);
        const first = h.app(); h.transition('pageshow', false); h.transition('pageshow', true);
        assert.equal(h.app(), first, 'Initial or duplicate pageshow cannot create a second app.');
        for (let visit = 0; visit < 3; visit++) {
            const previous = h.app(), lateFrame = [...h.frames.values()][0];
            h.transition('pagehide', true);
            assert.equal(h.roots().length, 0); assert.equal(h.frames.size, 0);
            h.transition('pageshow', true);
            assert.equal(h.roots().length, 1, 'bfcache restores the entry after DeliciaApp disposed its old root.');
            assert.notEqual(h.app(), previous); assert.deepEqual(h.app().store.save, h.saved);
            assert.equal(h.frames.size, 1);
            const restored = h.app(); h.transition('pageshow', true); lateFrame(900_000);
            h.artRequests[visit](); await Promise.resolve();
            assert.equal(h.app(), restored); assert.equal(h.roots().length, 1); assert.equal(h.frames.size, 1);
            assert.deepEqual(h.listeners(), listeners, 'Repeated restoration keeps one set of app listeners.');
            h.click('Opções'); assert.equal(h.app().screen, 'settings');
            h.click('Voltar'); assert.equal(h.app().screen, 'title');
            const link = h.body.all().find(node => node.className.includes('dl-world-link'));
            assert.ok(link); assert.equal(new URL(link.href, h.window.location).href, 'https://game.example/world/releases/candidate/');
        }
        assert.deepEqual([...h.storage], before); assert.deepEqual(h.writes, []);
        assert.ok(h.reads.every(key => key === DELICIA_SAVE_KEY), 'Restoration never reads World progress.');
        assert.equal(h.window.location.href, `https://game.example${path}`, 'Bootstrap does not rewrite the preview URL or query.');
    });
}

test('ordinary navigation still disposes; non-persisted pageshow does not remount the discarded document', t => {
    const h = fixture(t, 'https://game.example/delicia.html');
    h.transition('pagehide', false); h.transition('pageshow', false);
    assert.equal(h.roots().length, 0); assert.equal(h.frames.size, 0); assert.deepEqual(h.writes, []);
});

test('a restored entry reads the latest saved checkpoint instead of reviving an obsolete session', t => {
    const h = fixture(t, 'https://game.example/delicia.html');
    h.transition('pagehide', true);
    const latest = { ...h.saved, completed: [...h.saved.completed, 'delicia-3'], selected: 'delicia-4', checkpoint: null };
    h.storage.set(DELICIA_SAVE_KEY, JSON.stringify(latest));
    const before = [...h.storage];
    h.transition('pageshow', true);
    assert.deepEqual(h.app().store.save, latest);
    assert.deepEqual([...h.storage], before); assert.deepEqual(h.writes, []);
});

test('a history return with unreadable storage restores usable recovery UI without overwriting either campaign', t => {
    const h = fixture(t, 'https://game.example/delicia.html', true), before = [...h.storage];
    h.transition('pagehide', true); h.transition('pageshow', true);
    assert.equal(h.roots().length, 1); assert.match(h.app().store.warning, /não pôde ser lido/);
    h.click('Opções'); assert.equal(h.app().screen, 'settings');
    assert.match(h.body.textContent, /Exporte uma cópia/);
    assert.deepEqual([...h.storage], before); assert.deepEqual(h.writes, []);
});
