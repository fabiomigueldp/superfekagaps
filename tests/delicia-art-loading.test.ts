import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { DeliciaArt } from '../src/adventure/delicia/DeliciaArt';
import { DELICIA_ASSETS } from '../src/adventure/delicia/DeliciaContent';

const gameplayAssets = [
    'backdrop', 'environment-atlas', 'props', 'boss-atlas', 'enemies-v2',
    'jaja-motion-v2', 'guina-motion-v2', 'landmarks-v2', 'terrain-v2',
];
const url = (name: string) => `${DELICIA_ASSETS}${name}.webp${name === 'props' || name === 'landmarks-v2' ? '?v=5' : ''}`;

function images(t: TestContext) {
    const requested: MockImage[] = [];
    class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = '';
        constructor() { requested.push(this); }
    }
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'Image');
    Object.defineProperty(globalThis, 'Image', { configurable: true, value: MockImage });
    t.after(() => previous ? Object.defineProperty(globalThis, 'Image', previous) : Reflect.deleteProperty(globalThis, 'Image'));
    return requested;
}

test('gameplay loader requests exactly its nine rendered images and keeps versioned atlases', async t => {
    const requested = images(t), art = new DeliciaArt(), loading = art.load();
    assert.deepEqual(requested.map(image => image.src), gameplayAssets.map(url));
    assert.equal(art.images.size, 0, 'pending images are not ready');
    for (const image of requested) image.onload?.();
    await loading;
    assert.deepEqual([...art.images.keys()], gameplayAssets);
    for (let index = 0; index < gameplayAssets.length; index++)
        assert.strictEqual(art.images.get(gameplayAssets[index]), requested[index]);
    for (const name of ['portraits', 'island', 'key-art', 'world-concept-v2'])
        assert.equal(art.images.has(name), false, `${name} has no gameplay canvas consumer`);
    art.dispose(); art.dispose();
    assert.equal(art.images.size, 0, 'disposal releases ready image references');
});

test('one failed image still settles the loader and preserves the other gameplay images', async t => {
    const requested = images(t), art = new DeliciaArt(), loading = art.load();
    requested[0].onerror?.();
    for (const image of requested.slice(1)) image.onload?.();
    await loading;
    assert.equal(art.images.has('backdrop'), false);
    assert.deepEqual([...art.images.keys()], gameplayAssets.slice(1));
    art.dispose(); assert.equal(art.images.size, 0);
});

test('late successful and failed loads cannot repopulate a disposed gameplay cache', async t => {
    const requested = images(t), art = new DeliciaArt(), loading = art.load();
    requested[0].onload?.();
    assert.equal(art.images.size, 1);
    art.dispose();
    for (const image of requested.slice(1, -1)) image.onload?.();
    requested.at(-1)?.onerror?.();
    await loading;
    assert.equal(art.images.size, 0);
});
