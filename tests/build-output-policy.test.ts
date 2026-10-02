import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { copyPublishedAssets, inspectBuildOutput, REVIEW_ONLY_ASSETS } from '../scripts/build_output_policy';

function fixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'feka-output-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const put = (path: string, content: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), content); };
    put('dist/index.html', '<html>game</html>');
    return { root, put, publicDir: join(root, 'public'), outDir: join(root, 'dist') };
}

test('production omits only reviewed exact files while preserving all original bytes', t => {
    const f = fixture(t);
    for (const name of REVIEW_ONLY_ASSETS) f.put(`public/${name}`, `original:${name}`);
    const retained = [
        'assets/audio/music/theme.wav', 'assets/audio/vo/joaozao/porra_nenhuma_0.36s.ogg',
        'assets_delicia/boss_delicia_149.191s.webm', 'assets/world/audio/manifest.json',
        'assets/branding/a-new-runtime-cover.png', 'assets/world/audio/new-runtime-track.wav',
        'assets/world/map/costa-diorama.webp', 'favicon.ico',
    ];
    for (const name of retained) f.put(`public/${name}`, '{}');
    const result = copyPublishedAssets(f.publicDir, f.outDir);
    assert.equal(result.omittedFiles, 21);
    for (const name of REVIEW_ONLY_ASSETS) {
        assert.equal(readFileSync(join(f.publicDir, name), 'utf8'), `original:${name}`);
        assert.equal(existsSync(join(f.outDir, name)), false);
    }
    for (const name of retained) assert.deepEqual(readFileSync(join(f.outDir, name)), readFileSync(join(f.publicDir, name)));
    assert.equal(inspectBuildOutput(f.outDir).files, retained.length + 1);
});

test('output verification stops if a page or bundle needs an omitted asset', t => {
    const f = fixture(t);
    f.put('dist/assets/game.js', 'new Audio("assets/world/audio/mapa.wav")');
    assert.throws(() => inspectBuildOutput(f.outDir), /references excluded asset/);
    rmSync(join(f.outDir, 'assets/game.js'));
    f.put('dist/docs/world/capturas/index.html', '<script>audio.src=`${base}/audio/${name}.wav`</script>');
    assert.throws(() => inspectBuildOutput(f.outDir), /fresh asset audit/);
});

test('size verification counts all bytes and rejects leaks, missing entrypoints and growth', t => {
    const f = fixture(t);
    f.put('dist/assets/texture.bin', '12345');
    const measured = inspectBuildOutput(f.outDir);
    assert.equal(measured.bytes, Buffer.byteLength('<html>game</html>') + 5);
    assert.throws(() => inspectBuildOutput(f.outDir, measured.bytes - 1), /repository budget/);
    f.put(`dist/${REVIEW_ONLY_ASSETS[0]}`, 'review');
    assert.throws(() => inspectBuildOutput(f.outDir), /leaked/);
    rmSync(join(f.outDir, 'index.html'));
    assert.throws(() => inspectBuildOutput(f.outDir), /Missing built index/);
});

test('copy refuses an output directory overlapping preserved sources', t => {
    const f = fixture(t);
    f.put('public/keep.txt', 'original');
    assert.throws(() => copyPublishedAssets(f.publicDir, f.publicDir), /separate/);
    assert.throws(() => copyPublishedAssets(f.publicDir, f.root), /separate/);
    assert.throws(() => copyPublishedAssets(f.publicDir, join(f.publicDir, 'dist')), /separate/);
    assert.equal(readFileSync(join(f.publicDir, 'keep.txt'), 'utf8'), 'original');
});

test('copy recreates nested output directories on subsequent clean builds', t => {
    const f = fixture(t);
    const retained = ['a.txt', 'nested/one.txt', 'nested/two.txt', 'nested/deeper/three.txt'];
    for (const name of retained) f.put(`public/${name}`, `original:${name}`);
    for (let run = 0; run < 2; run++) {
        rmSync(f.outDir, { recursive: true, force: true });
        copyPublishedAssets(f.publicDir, f.outDir);
        for (const name of retained) {
            assert.deepEqual(readFileSync(join(f.outDir, name)), readFileSync(join(f.publicDir, name)));
        }
    }
});

test('size diagnostics reconcile extension totals and exact budget headroom', t => {
    const f = fixture(t);
    f.put('dist/assets/one.wav', '123456');
    f.put('dist/assets/two.WAV', '1234');
    f.put('dist/LICENSE', '123');
    const measured = inspectBuildOutput(f.outDir);
    const htmlBytes = Buffer.byteLength('<html>game</html>');
    assert.deepEqual(measured.byExtension, [
        { extension: '.html', files: 1, bytes: htmlBytes },
        { extension: '.wav', files: 2, bytes: 10 },
        { extension: '', files: 1, bytes: 3 },
    ]);
    assert.equal(measured.byExtension.reduce((sum, group) => sum + group.bytes, 0), measured.bytes);
    assert.equal(measured.byExtension.reduce((sum, group) => sum + group.files, 0), measured.files);
    assert.equal(measured.headroomBytes, measured.maxBytes - measured.bytes);
    assert.equal(inspectBuildOutput(f.outDir, measured.bytes).headroomBytes, 0);
    assert.throws(() => inspectBuildOutput(f.outDir, measured.bytes - 1), /repository budget/);
});
