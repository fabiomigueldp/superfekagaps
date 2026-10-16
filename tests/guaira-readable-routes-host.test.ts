import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterExcursionBrowser, flushChapter } from './helpers/chapterExcursionHarness';
import { loadGuairaChapterExcursion } from '../src/adventure/experimental/guaira/chapter/GuairaChapterExcursions';
import { GuairaGallery } from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import { GuairaRelief } from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import tapes from './helpers/guairaReadableRoutesReplays.json';

for (const touch of [false, true]) test(`gallery service-loop guidance reaches the real chapter with ${touch ? 'owned touch controls' : 'keyboard'}`, async t => {
    const h = chapterExcursionBrowser(t);
    const app = h.create({ initialScene: 'gallery', loadExcursion: loadGuairaChapterExcursion });
    await flushChapter();
    const g = app.activeGame; assert.ok(g instanceof GuairaGallery);
    let frame = 0;
    const remaining = (tapes.galeria.runs as Array<[number, string[]]>).map(([n, keys]) => [n, keys] as [number, string[]]);
    for (const [stop, message] of [[211, /Tampa opcional/], [287, /Oficina por baixo.*dois tablados/], [400, /Ponto seguro.*tampa II/], [759, /Acesso à Câmara de Alívio aberto.*5 moedas/]] as const) {
        const blocks: Array<[number, string[]]> = [];
        while (frame < stop) {
            const [count, keys] = remaining[0], n = Math.min(count, stop - frame);
            blocks.push([n, keys]); frame += n;
            if (n === count) remaining.shift(); else remaining[0][0] -= n;
        }
        h.play(g, { runs: blocks }, touch); g.render(); h.frames();
        assert.match(h.byId('lab-status').textContent, message);
        assert.deepEqual(app.snapshot.accepted, [], 'optional route cannot award main-chapter receipts');
    }
    assert.equal(g.finished, true);
    assert.equal(h.byId('chapter-primary').getAttribute('aria-label'), 'Seguir para a Câmara de Alívio, continuação opcional');
    h.byId('chapter-primary').click(); await flushChapter();
    assert.ok(app.activeGame instanceof GuairaRelief); assert.equal(g.isDisposed, true);
    app.dispose(); h.checkDisposed();
});
