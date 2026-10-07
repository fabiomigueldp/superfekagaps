import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorldGame } from '../src/adventure/WorldGame';
import reliefRecordings from './helpers/guairaReliefReplay.json';
import { GuairaRelief } from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import { GuairaGallery } from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import { CHAPTER_SCENES, loadGuairaChapterScene, type GuairaChapterSceneFactory } from '../src/adventure/experimental/guaira/chapter/GuairaChapterScenes';
import { loadGuairaChapterExcursion } from '../src/adventure/experimental/guaira/chapter/GuairaChapterExcursions';
import type { GuairaChapterSceneId } from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import { hasAcceptedPublicWater } from '../src/adventure/experimental/guaira/chapter/GuairaChapterWater';
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
    test(`${opening}: real host/map/Gallery → Relief excursion preserves receipts and resumes the five-stage journey (${touch ? 'touch' : 'keyboard'})`, async t => {
        const h = chapterExcursionBrowser(t);
        const factories = Object.fromEntries(await Promise.all(Object.keys(CHAPTER_SCENES).map(async id =>
            [id, await loadGuairaChapterScene(id as GuairaChapterSceneId)]))) as Record<GuairaChapterSceneId, GuairaChapterSceneFactory>;
        const excursion = await loadGuairaChapterExcursion(), reliefFactory = await loadGuairaChapterExcursion('relief');
        const app = h.create({ loadScene: async id => factories[id], loadExcursion: async id => id === 'gallery' ? excursion : reliefFactory });
        const activeGame = (): WorldGame | null => app.activeGame;
        await mapReady(h);
        if (opening === 'guaira-patio-comportas') {
            h.button('Ver a jornada de Guaíra').click(); h.button('Pátio das Comportas: usar como abertura alternativa').click(); await mapReady(h);
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
        assert.equal(h.byId('chapter-primary').getAttribute('aria-label'), 'Seguir para a Câmara de Alívio, continuação opcional');
        assert.match(h.byId('lab-status').textContent, /Câmara de Alívio/);
        gallery.toggleGalleryPause(); h.frames();
        h.byId('chapter-primary').click(); assert.equal(activeGame(), gallery, 'Paused primary resumes the Gallery first');
        h.byId('chapter-primary').click(); await flushChapter();
        const relief = activeGame(); assert.ok(relief instanceof GuairaRelief); assert.equal(gallery.isDisposed, true);
        assert.equal(relief.player.data.hasHelmet, true); assert.equal(relief.finished, false);
        assert.equal(relief.store.save.checkpoint, null, 'New room owns a fresh local checkpoint');
        const routeName = touch ? 'interval' : 'maintenance';
        h.play(relief, { runs: reliefRecordings[routeName] as Array<[number, string[]]> }, touch); h.frames();
        assert.equal(relief.finished, true); assert.equal(relief.reliefOpened, routeName === 'maintenance');
        assert.match(h.byId('lab-status').textContent, routeName === 'maintenance' ? /alívio aberto/ : /alívio intacto/);
        assert.deepEqual(app.snapshot, retained, 'Relief success has no required chapter authority');
        assert.equal(hasAcceptedPublicWater(app.snapshot), false, 'a real optional cap never wets the Bairro');
        h.byId('chapter-map-return').click(); await mapReady(h);
        assert.equal(relief.isDisposed, true);
        assert.equal(gallery.isDisposed, true); assert.equal(app.mode, 'map');
        assert.deepEqual(app.snapshot, retained);
        assert.ok(h.all().some(node => node.className === 'chapter-map-count' && node.textContent === '1/5 · concluídos'));
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
            assert.equal(app.snapshot.accepted.length, count + 1, 'native success is persisted before Continue');
            h.byId('chapter-primary').click(); await mapReady(h);
            assert.equal(game.isDisposed, true); assert.equal(app.snapshot.accepted.length, count + 1);
        }
        const completed = app.snapshot;
        assert.equal(completed.chapterComplete, true); assert.equal(completed.accepted.length, 5);
        assert.deepEqual(completed.accepted.map(receipt => receipt.sceneId), route);
        assert.equal(hasAcceptedPublicWater(completed), true, 'the actual five-scene host journey owns accepted public water');
        choose(h, optionalName); arrive(h);
        h.button('Entrar na Galeria dos Remendos, percurso opcional').click(); await flushChapter();
        const finalGallery = activeGame(); assert.ok(finalGallery instanceof GuairaGallery);
        h.play(finalGallery, chapterRecording('guairaGalleryReplay'), touch); h.frames();
        assert.equal(finalGallery.finished, true); h.byId('chapter-primary').click(); await flushChapter();
        const finalRelief = activeGame(); assert.ok(finalRelief instanceof GuairaRelief);
        assert.equal(finalGallery.isDisposed, true); assert.deepEqual(app.snapshot, completed);
        const finalRoute = touch ? 'maintenance' : 'interval';
        h.play(finalRelief, { runs: reliefRecordings[finalRoute] as Array<[number, string[]]> }, touch); h.frames();
        assert.equal(finalRelief.finished, true); assert.equal(finalRelief.reliefOpened, finalRoute === 'maintenance');
        assert.deepEqual(app.snapshot, completed, 'Both optional native finishes preserve 5/5');
        assert.equal(hasAcceptedPublicWater(app.snapshot), true, 'later optional visits retain the real accepted Prefeito receipt');
        h.byId('chapter-map-return').click(); await mapReady(h);
        assert.equal(finalRelief.isDisposed, true); assert.deepEqual(app.snapshot, completed);
        completed.accepted.forEach((receipt, index) => assert.equal(app.snapshot.accepted[index], receipt));
        assert.ok(h.all().some(node => node.className === 'chapter-map-count' && node.textContent === '5/5 · concluídos'));
        h.button('Entrar na Galeria dos Remendos, percurso opcional').click(); await flushChapter();
        assert.ok(activeGame() instanceof GuairaGallery, 'Later map entry starts a fresh Gallery even after Relief completion');
        assert.equal((activeGame() as GuairaGallery).finished, false);
        h.byId('chapter-map-return').click(); await mapReady(h); assert.deepEqual(app.snapshot, completed);
        app.dispose(); h.checkDisposed();
    });
}
