import test from 'node:test';
import assert from 'node:assert/strict';
import metadata from '../public/assets/world/map/journey-aircraft.meta.json';
import { runGuairaFlight } from '../src/adventure/WorldGuairaFlight';

class Element extends EventTarget {
    children: Element[] = []; textContent = ''; disabled = false; hidden = false; removed = false;
    append(...children: Element[]) { this.children.push(...children); }
    setAttribute() {} showModal() {} close() {} remove() { this.removed = true; }
    getContext() { return null; }
    click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
}
test('flight skip, cancel and failed-save retry commit only a confirmed arrival', async t => {
    const document = Object.assign(new EventTarget(), { body: new Element(), hidden: false, activeElement: null,
        createElement: () => new Element() });
    const window = Object.assign(new EventTarget(), { matchMedia: () => ({ matches: false }), setTimeout, clearTimeout });
    class Image {
        onload: (() => void) | null = null; onerror: (() => void) | null = null;
        naturalWidth = metadata.atlas.width; naturalHeight = metadata.atlas.height;
        set src(_path: string) { queueMicrotask(() => this.onload?.()); }
    }
    for (const [key, value] of Object.entries({ document, window, Image, HTMLElement: Element,
        fetch: async (): Promise<{ ok: boolean; json(): Promise<typeof metadata> }> => ({ ok: true, json: async () => metadata }), requestAnimationFrame: (): number => 1, cancelAnimationFrame: () => {} })) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
        t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : Reflect.deleteProperty(globalThis, key));
    }
    const ready = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
    let attempts = 0, committed = 0, canceled = 0, storageReady = false;
    const cleanup = runGuairaFlight({ from: 'factory', to: 'guaira', onArrive: () => {
        attempts++; if (!storageReady) return false; committed++; return true;
    }, onCancel: () => { canceled++; } });
    await ready();
    const dialog = document.body.children.at(-1)!, skip = dialog.children[2].children[0];
    assert.equal(skip.disabled, false);
    skip.click(); assert.equal(attempts, 1); assert.equal(committed, 0); assert.equal(dialog.removed, false);
    assert.match(dialog.children[1].textContent, /Não foi possível salvar/);
    storageReady = true; skip.click(); skip.click(); cleanup();
    assert.equal(committed, 1); assert.equal(canceled, 0); assert.equal(dialog.removed, true);
    runGuairaFlight({ from: 'guaira', to: 'serra', onArrive: () => { committed++; }, onCancel: () => { canceled++; } });
    await ready();
    const canceledDialog = document.body.children.at(-1)!;
    canceledDialog.children[2].children[1].click(); canceledDialog.children[2].children[0].click();
    assert.equal(committed, 1); assert.equal(canceled, 1);
});
