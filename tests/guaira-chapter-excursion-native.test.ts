import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorldGame } from '../src/adventure/WorldGame';
import { GuairaGallery } from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import { CHAPTER_SCENES, loadGuairaChapterScene, type GuairaChapterSceneFactory } from '../src/adventure/experimental/guaira/chapter/GuairaChapterScenes';
import { loadGuairaChapterExcursion } from '../src/adventure/experimental/guaira/chapter/GuairaChapterExcursions';
import type { GuairaChapterSceneId } from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import { chapterExcursionBrowser, chapterRecording, flushChapter } from './helpers/chapterExcursionHarness';

const recordings: Record<GuairaChapterSceneId, string> = {
    'guaira-travessia': 'guairaTraversalReplay', 'guaira-patio-comportas': 'guairaJunctionReplay',
    'guaira-respiros': 'guairaRespirosReplay', 'guaira-lab': 'guairaLabReplay',
    'guaira-subida': 'guairaAscentReplay', 'guaira-prefeito': 'guairaMayorReplay'
};
const optionalName = 'Bairro da Vala Seca / Galeria dos Remendos: desvio opcional';
type Harness = ReturnType<typeof chapterExcursionBrowser>;
async function mapReady(h: Harness) { await flushChapter(); h.frames(2); }
function choose(h: Harness, name: string) {
    h.button('Ver a jornada de Guaíra').click(); h.button(name).click();
}
function arrive(h: Harness) { h.frames(1200); }

/** Native keyboard/touch recordings drive the real Player and mechanisms.
 * Unlike failure/ownership fixtures, this suite never supplies a result or
 * writes a player position, breakable tile, checkpoint, boss or finish flag. */
for (const [opening, touch] of [['guaira-travessia', false], ['guaira-patio-comportas', true]] as const) {
    test(`${opening}: real host/map/Gallery excursion preserves receipts and resumes the five-stage journey (${touch ? 'touch' : 'keyboard'})`, async t => {
        const h = chapterExcursionBrowser(t);
        const factories = Object.fromEntries(await Promise.all(Object.keys(CHAPTER_SCENES).map(async id =>
            [id, await loadGuairaChapterScene(id as GuairaChapterSceneId)]))) as Record<GuairaChapterSceneId, GuairaChapterSceneFactory>;
        const excursion = await loadGuairaChapterExcursion();
        const app = h.create({ loadScene: async id => factories[id], loadExcursion: async () => excursion });
        const activeGame = (): WorldGame | null => app.activeGame;
        await mapReady(h);
        if (opening === 'guaira-patio-comportas') {
            h.button('Pátio das Comportas: usar como abertura alternativa').click(); await mapReady(h);
        }
        const route = [...app.snapshot.route]; assert.equal(route.length, 5); assert.equal(route[0], opening);
        h.button(`Entrar: ${CHAPTER_SCENES[opening].title}`).click(); await flushChapter();
        const first = activeGame()!; assert.ok(first); assert.equal(first.stage.id, opening);
        h.play(first, chapterRecording(recordings[opening]), touch);
        h.frames(); h.byId('chapter-primary').click(); await mapReady(h);
        assert.equal(first.isDisposed, true); assert.equal(app.snapshot.accepted.length, 1);

        // Retain an earned replay on purpose: RETOMAR must not substitute the
        // recommendation just because a different scene is next in the route.
        choose(h, `${CHAPTER_SCENES[opening].title}: Concluído · repetir`);
        const retained = app.snapshot;
        assert.equal(retained.selectedScene, opening); assert.notEqual(retained.nextRecommendedScene, opening);
        choose(h, optionalName); await mapReady(h);
        assert.deepEqual(app.snapshot, retained); assert.equal(activeGame(), null);
        arrive(h);
        assert.equal(app.mode, 'map', 'physical arrival and walking never enter');
        h.button('Entrar na Galeria dos Remendos, percurso opcional').click(); await flushChapter();
        let gallery = activeGame(); assert.ok(gallery instanceof GuairaGallery);
        assert.deepEqual(app.snapshot, retained); assert.equal(gallery.finished, false);
        h.play(gallery, { runs: [[25, ['ArrowRight']]] }, touch);
        const oldGallery = gallery;
        h.byId('chapter-retry').click(); await flushChapter();
        gallery = activeGame(); assert.ok(gallery instanceof GuairaGallery);
        assert.notEqual(gallery, oldGallery); assert.equal(oldGallery.isDisposed, true);
        assert.equal(gallery.finished, false); assert.equal(gallery.player.data.position.x, 48);
        assert.deepEqual(app.snapshot, retained, 'optional retry has no chapter authority');
        h.play(gallery, chapterRecording('guairaGalleryReplay'), touch);
        assert.equal(gallery.finished, true, 'native breaks, descents and stairs reached the real exit');
        h.frames(); assert.deepEqual(app.snapshot, retained, 'optional victory is not a sixth receipt');
        h.byId('chapter-map-return').click(); await mapReady(h);
        assert.equal(gallery.isDisposed, true); assert.equal(app.mode, 'map');
        assert.deepEqual(app.snapshot, retained);
        assert.ok(h.all().some(node => node.className === 'chapter-map-count' && node.textContent === '1/5 · nesta sessão'));
        assert.equal(h.button('Entrar na Galeria dos Remendos, percurso opcional').disabled, false, 'return is physically Bairro');
        h.button(`Retomar ${CHAPTER_SCENES[opening].title}, trecho selecionado da jornada`).click();
        arrive(h);
        assert.equal(activeGame(), null); assert.equal(app.snapshot.selectedScene, opening);
        assert.deepEqual(app.snapshot.accepted, retained.accepted);
        assert.equal(app.snapshot.nextRecommendedScene, retained.nextRecommendedScene);

        for (const scene of route.slice(1)) {
            choose(h, `${CHAPTER_SCENES[scene].title}: Próximo trecho`); arrive(h);
            h.button(`Entrar: ${CHAPTER_SCENES[scene].title}`).click(); await flushChapter();
            const game: WorldGame = activeGame()!; assert.ok(game); assert.equal(game.stage.id, scene);
            const count: number = app.snapshot.accepted.length;
            h.play(game, chapterRecording(recordings[scene]), touch); h.frames();
            assert.equal(app.snapshot.accepted.length, count, 'native success is accepted only on explicit Continue');
            h.byId('chapter-primary').click(); await mapReady(h);
            assert.equal(game.isDisposed, true); assert.equal(app.snapshot.accepted.length, count + 1);
        }
        const completed = app.snapshot;
        assert.equal(completed.chapterComplete, true); assert.equal(completed.accepted.length, 5);
        assert.deepEqual(completed.accepted.map(receipt => receipt.sceneId), route);
        choose(h, optionalName); arrive(h);
        h.button('Entrar na Galeria dos Remendos, percurso opcional').click(); await flushChapter();
        const finalGallery = activeGame(); assert.ok(finalGallery instanceof GuairaGallery);
        h.play(finalGallery, { runs: [[20, ['ArrowRight']]] }, touch);
        assert.equal(finalGallery.finished, false); h.byId('chapter-map-return').click(); await mapReady(h);
        assert.equal(finalGallery.isDisposed, true); assert.deepEqual(app.snapshot, completed, 'abandoning after 5/5 preserves the exact original receipts');
        app.dispose(); h.checkDisposed();
    });
}
