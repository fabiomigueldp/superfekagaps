import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseMapMetadata } from '../src/adventure/WorldMapArt';

const root = new URL('../public/assets/world/map/', import.meta.url);
test('each visited island loads under 350 KB of authored WebP art and matching metadata', () => {
    const islands = [
        { world: 1, files: ['costa-diorama.webp', 'costa-shadow.webp', 'porto-distant.webp', 'costa-diorama.meta.json'] },
        { world: 2, files: ['porto-diorama.webp', 'porto-diorama.meta.json'] },
        { world: 3, files: ['fabrica-diorama.webp', 'fabrica-diorama.meta.json'] },
    ];
    for (const { world, files } of islands) {
        let bytes = 0;
        for (const file of files) {
            const data = readFileSync(new URL(file, root)); bytes += data.byteLength;
            if (file.endsWith('.webp')) {
                assert.equal(data.toString('ascii', 0, 4), 'RIFF');
                assert.equal(data.toString('ascii', 8, 12), 'WEBP');
            }
        }
        assert.ok(bytes <= 350_000, `Island ${world} lazy-loaded art totals ${bytes} bytes`);
        const metadata = parseMapMetadata(JSON.parse(readFileSync(new URL(files.at(-1)!, root), 'utf8')), world);
        assert.ok(metadata);
        if (world > 1) assert.ok(metadata.artBounds, `Island ${world} ships measured silhouette bounds.`);
    }
});
test('the shipped transparent WebP layers retain the authored camera framing', () => {
    for (const [file, width, height] of [['costa-diorama.webp', 1920, 1200], ['porto-diorama.webp', 1920, 1200],
        ['fabrica-diorama.webp', 1920, 1200], ['porto-distant.webp', 960, 600]] as const) {
        const webp = readFileSync(new URL(file, root));
        assert.equal(webp.toString('ascii', 12, 16), 'VP8X');
        assert.ok(webp[20] & 0x10, `${file} must retain transparency for sea compositing`);
        assert.equal(1 + webp.readUIntLE(24, 3), width);
        assert.equal(1 + webp.readUIntLE(27, 3), height);
    }
});
