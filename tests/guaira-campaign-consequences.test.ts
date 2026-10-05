import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { freshSave, parseSave } from '../src/adventure/progress';
import { campaignWaterRestored, campaignWaterOverlay, loadCampaignWaterImage } from '../src/adventure/GuairaCampaignConsequences';
import { campaignArtOverlay } from '../src/adventure/GuairaCampaignArt';
import { showGuairaRegion } from '../src/adventure/WorldGuairaRegion';
import { guairaChapterRoute } from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import { recordSalonVictory } from '../src/adventure/factory/FactorySalon';

test('only the mayor receipt reveals water, including reload, revisit and legacy cases', () => {
    const save = freshSave(), image = {} as CanvasImageSource;
    assert.equal(campaignWaterOverlay(save, image), null);
    save.legacySerraAccess = true; save.completed = ['3-5', '4-1'];
    save.guaira.optional = { gallery: true, relief: true }; recordSalonVictory(save);
    assert.equal(campaignWaterRestored(save), false);
    save.guaira.completed = guairaChapterRoute(save.guaira.opening);
    save.guaira.selectedScene = save.guaira.completed[0];
    const before = JSON.stringify(save), reloaded = parseSave(before);
    assert.equal(campaignWaterRestored(reloaded), true);
    assert.deepEqual(campaignWaterOverlay(reloaded, image), campaignArtOverlay('guaira', image));
    assert.equal(campaignWaterOverlay(reloaded, null), null);
    assert.equal(JSON.stringify(save), before, 'presentation cannot award or mutate progress');
    assert.equal(campaignWaterRestored(freshSave()), false);
    assert.ok(statSync(new URL('../public/assets/world/map/guaira-campaign/guaira-water-restored.webp', import.meta.url)).size < 5000);
});

class Element extends EventTarget {
    children: Element[] = []; textContent = ''; disabled = false; isConnected = true;
    className = ''; id = ''; src = ''; alt = ''; dataset: Record<string, string> = {};
    append(...children: Element[]) { this.children.push(...children); }
    setAttribute() {} showModal() {} close() {} focus() {}
    getContext() { return null; }
    get firstElementChild() { return this.children[0] ?? null; }
    remove() { this.isConnected = false; }
}
test('region preview layers the same earned water and removes a missing optional image', t => {
    const body = new Element();
    const prior = { document: globalThis.document, HTMLElement: globalThis.HTMLElement };
    Object.assign(globalThis, { document: { body, activeElement: null, createElement: () => new Element() }, HTMLElement: Element });
    t.after(() => Object.assign(globalThis, prior));
    const save = freshSave(), callbacks = { fly() {}, goToFactory() {}, goToSerra() {} };
    save.legacySerraAccess = true;
    showGuairaRegion(save, '4-1', callbacks);
    assert.equal(body.children.at(-1)!.children[0].children[1].children.length, 1);
    save.guaira.completed = ['guaira-prefeito'];
    showGuairaRegion(save, '4-1', callbacks);
    const images = body.children.at(-1)!.children[0].children[1].children;
    assert.equal(images.length, 2); assert.equal(images[0].alt, '', 'The thumbnail is decorative; earned water is described in the panel.');
    assert.match(images[1].src, /guaira-water-restored.webp$/);
    images[1].dispatchEvent(new Event('error'));
    assert.equal(images[1].isConnected, false);
});

test('optional loader reports failures without blocking map rendering', async t => {
    const previous = globalThis.Image;
    class ImageStub { decoding = ''; naturalWidth = 0; onload: (() => void) | null = null; onerror: (() => void) | null = null;
        set src(_value: string) { queueMicrotask(() => this.onerror?.()); }
    }
    globalThis.Image = ImageStub as unknown as typeof Image;
    t.after(() => { globalThis.Image = previous; });
    assert.equal(await loadCampaignWaterImage(), null);
});
