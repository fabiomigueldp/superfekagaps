import test from 'node:test';
import assert from 'node:assert/strict';
import { GuairaCampaignWaterMotion, GUAIRA_CAMPAIGN_WATER_PATCHES } from '../src/adventure/GuairaCampaignWaterMotion';
import { campaignWaterRestored } from '../src/adventure/GuairaCampaignConsequences';
import { freshSave, parseSave } from '../src/adventure/progress';
import { guairaChapterRoute } from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';

const camera = { width: 1280, height: 800, center: { x: 4.21, y: .67 }, zoom: 1.1 };
function fixture() {
    let allocations = 0;
    const calls: unknown[][] = [];
    const context = new Proxy({}, {
        get: (_target, key) => key === 'createLinearGradient' ? (...args: unknown[]) => {
            calls.push([key, ...args]); return { addColorStop: (...args: unknown[]) => calls.push(['stop', ...args]) };
        } : (...args: unknown[]) => calls.push([key, ...args]),
        set: (_target, key, value) => { calls.push([key, value]); return true; },
    }) as CanvasRenderingContext2D;
    const effect = new GuairaCampaignWaterMotion({} as CanvasImageSource, () => {
        allocations++; return { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
    });
    return { effect, calls, allocated: () => allocations };
}

test('motion requires the real mayor outcome and never changes campaign progress', () => {
    const { effect, allocated } = fixture(), save = freshSave();
    save.legacySerraAccess = true; save.completed = ['3-5', '4-1']; save.guaira.optional = { gallery: true, relief: true };
    assert.deepEqual(effect.overlays(campaignWaterRestored(save), camera, 10, false), []);
    assert.equal(allocated(), 0);
    save.guaira.completed = guairaChapterRoute(save.guaira.opening);
    const before = JSON.stringify(save), reloaded = parseSave(before);
    assert.equal(effect.overlays(campaignWaterRestored(reloaded), camera, 10, false).length, 4);
    assert.equal(JSON.stringify(save), before);
});

test('live reduced-motion changes immediately remove all animated detail and retain reusable crops', () => {
    const { effect, calls, allocated } = fixture();
    assert.deepEqual(effect.overlays(true, camera, 10, true), []); assert.equal(allocated(), 0);
    const first = effect.overlays(true, camera, 10, false); assert.equal(allocated(), 4);
    calls.length = 0;
    assert.deepEqual(effect.overlays(true, camera, 90, true), []); assert.equal(calls.length, 0);
    const resumed = effect.overlays(true, camera, 10, false);
    assert.deepEqual(first, resumed); assert.equal(allocated(), 4);
    assert.equal(GUAIRA_CAMPAIGN_WATER_PATCHES.reduce((sum, [, , w, h]) => sum + w * h, 0), 1245);
});

test('same visible time is deterministic, invalid time is stable, and water stays in the authored alpha', () => {
    const { effect, calls } = fixture();
    effect.overlays(true, camera, 1.2, false); const a = JSON.stringify(calls); calls.length = 0;
    effect.overlays(true, camera, 1.2, false); assert.equal(JSON.stringify(calls), a); calls.length = 0;
    effect.overlays(true, camera, 0, false); const zero = JSON.stringify(calls); calls.length = 0;
    effect.overlays(true, camera, NaN, false); assert.equal(JSON.stringify(calls), zero); calls.length = 0;
    effect.overlays(true, camera, -5, false); assert.equal(JSON.stringify(calls), zero); calls.length = 0;
    effect.overlays(true, camera, 3.6, false); assert.notEqual(JSON.stringify(calls), a);
    assert.equal(calls.filter(call => call[0] === 'globalCompositeOperation' && call[1] === 'destination-in').length, 4);
    assert.equal(calls.filter(call => call[0] === 'drawImage').length, 4);
});

test('offscreen water is culled before allocating or painting', () => {
    const { effect, calls, allocated } = fixture();
    assert.deepEqual(effect.overlays(true, { ...camera, center: { x: -100, y: -100 } }, 1, false), []);
    assert.equal(allocated(), 0); assert.equal(calls.length, 0);
});

test('missing optional Canvas context leaves the static reward usable without allocation retries', () => {
    let attempts = 0;
    const effect = new GuairaCampaignWaterMotion({} as CanvasImageSource, () => {
        attempts++; return { width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement;
    });
    assert.deepEqual(effect.overlays(true, camera, 0, false), []);
    assert.deepEqual(effect.overlays(true, camera, 1, false), []);
    assert.equal(attempts, 1);
});
