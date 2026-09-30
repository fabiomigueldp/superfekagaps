import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseMapMetadata } from '../src/adventure/WorldMapArt';

const root = new URL('../public/assets/world/map/', import.meta.url);
test('the complete map runtime art payload stays under 350 KB and every exported layer is WebP', () => {
    const files = ['costa-diorama.webp', 'costa-shadow.webp', 'porto-distant.webp', 'costa-diorama.meta.json'];
    let bytes = 0;
    for (const file of files) {
        const data = readFileSync(new URL(file, root)); bytes += data.byteLength;
        if (file.endsWith('.webp')) {
            assert.equal(data.toString('ascii', 0, 4), 'RIFF');
            assert.equal(data.toString('ascii', 8, 12), 'WEBP');
        }
    }
    assert.ok(bytes <= 350_000, `Lazy-loaded map assets total ${bytes} bytes`);
    assert.ok(parseMapMetadata(JSON.parse(readFileSync(new URL(files[3], root), 'utf8'))));
});
test('the shipped transparent WebP layers retain the authored camera framing', () => {
    for (const [file, width, height] of [['costa-diorama.webp', 1920, 1200], ['porto-distant.webp', 960, 600]] as const) {
        const webp = readFileSync(new URL(file, root));
        assert.equal(webp.toString('ascii', 12, 16), 'VP8X');
        assert.ok(webp[20] & 0x10, `${file} must retain transparency for sea compositing`);
        assert.equal(1 + webp.readUIntLE(24, 3), width);
        assert.equal(1 + webp.readUIntLE(27, 3), height);
    }
});
