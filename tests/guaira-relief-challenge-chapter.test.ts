import assert from 'node:assert/strict';
import test from 'node:test';
import { GuairaRelief } from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import { GuairaGallery } from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import { CHAPTER_SCENES, loadGuairaChapterScene, type GuairaChapterSceneFactory } from '../src/adventure/experimental/guaira/chapter/GuairaChapterScenes';
import { loadGuairaChapterExcursion } from '../src/adventure/experimental/guaira/chapter/GuairaChapterExcursions';
import type { GuairaChapterSceneId } from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import { hasAcceptedPublicWater } from '../src/adventure/experimental/guaira/chapter/GuairaChapterWater';
import { publicWaterAudioLevel } from '../src/adventure/experimental/guaira/chapter/GuairaChapterAudio';
import { chapterExcursionBrowser, chapterRecording, flushChapter } from './helpers/chapterExcursionHarness';
import reliefRecordings from './helpers/guairaReliefReplay.json';

const recordings: Record<GuairaChapterSceneId, string> = {
    'guaira-travessia': 'guairaTraversalReplay', 'guaira-patio-comportas': 'guairaJunctionReplay',
    'guaira-respiros': 'guairaRespirosReplay', 'guaira-lab': 'guairaLabReplay',
    'guaira-subida': 'guairaAscentReplay', 'guaira-prefeito': 'guairaMayorReplay'
};

/** Exercise the shipped OUTRA ROTA and TENTAR controls with actual native
 * routes at each receipt boundary; DOM/canvas/audio/assets are boundaries. */
for (const [opening, touch] of [['guaira-travessia', false], ['guaira-patio-comportas', true]] as const) {
    test(`${opening}: optional goals at 0/5, 1/5 and 5/5 preserve real receipts and victory water/audio`, async t => {
        const h = chapterExcursionBrowser(t);
        const factories = Object.fromEntries(await Promise.all(Object.keys(CHAPTER_SCENES).map(async id =>
            [id, await loadGuairaChapterScene(id as GuairaChapterSceneId)]))) as Record<GuairaChapterSceneId, GuairaChapterSceneFactory>;
        const galleryFactory = await loadGuairaChapterExcursion('gallery'), reliefFactory = await loadGuairaChapterExcursion('relief');
        const app = h.create({ loadScene: async id => factories[id], loadExcursion: async id => id === 'gallery'
            ? galleryFactory : reliefFactory });
        const mapReady = async () => { await flushChapter(); h.frames(2); };
        const choose = (name: string) => { h.button('Ver a jornada de Guaíra').click(); h.button(name).click(); };
        await mapReady();
        if (opening === 'guaira-patio-comportas') { h.button('Pátio das Comportas: usar como abertura alternativa').click(); await mapReady(); }
        const route = [...app.snapshot.route];
        async function excursion() {
            const before = app.snapshot, water = before.accepted.length === 5;
            const previousAudio = publicWaterAudioLevel(before, { x: 926, y: 606 });
            choose('Bairro da Vala Seca / Galeria dos Remendos: desvio opcional'); await mapReady(); h.frames(1200);
            h.button('Entrar na Galeria dos Remendos, percurso opcional').click(); await flushChapter();
            const gallery = app.activeGame; assert.ok(gallery instanceof GuairaGallery);
            h.play(gallery, chapterRecording('guairaGalleryReplay'), touch); h.frames();
            h.byId('chapter-primary').click(); await flushChapter();
            const first = app.activeGame; assert.ok(first instanceof GuairaRelief);
            const initialRoute = touch ? 'interval' : 'maintenance';
            const nextRoute = touch ? 'headBump' : 'interval';
            h.play(first, { runs: reliefRecordings[initialRoute] as [number, string[]][] }, touch); h.frames();
            const oldRetry = first.routes.capture('retry')!, action = first.routes.capture('other-route')!;
            assert.match(h.byId('chapter-primary').getAttribute('aria-label')!, /outra rota/);
            h.byId('chapter-primary').click(); await flushChapter();
            const second = app.activeGame; assert.ok(second instanceof GuairaRelief);
            assert.notEqual(second, first); assert.equal(first.isDisposed, true);
            assert.equal(second.routes.snapshot.goal, action.options.routeGoal);
            assert.equal(action.consume(), null); assert.equal(oldRetry.consume(), null);
            h.play(second, { runs: reliefRecordings[nextRoute] as [number, string[]][] }, touch); h.frames();
            assert.equal(second.routes.snapshot.verdict, 'met');
            assert.match(h.byId('lab-status').textContent, /Objetivo opcional cumprido/);
            assert.deepEqual(app.snapshot, before, 'optional success has no chapter authority');
            before.accepted.forEach((receipt, i) => assert.equal(app.snapshot.accepted[i], receipt));
            assert.equal(hasAcceptedPublicWater(app.snapshot), water);
            assert.equal(publicWaterAudioLevel(app.snapshot, { x: 926, y: 606 }), previousAudio);
            assert.equal(previousAudio > 0, water);
            h.byId('chapter-retry').click(); await flushChapter();
            const third = app.activeGame; assert.ok(third instanceof GuairaRelief);
            assert.equal(second.isDisposed, true); assert.equal(third.routes.snapshot.goal, action.options.routeGoal);
            h.play(third, { runs: reliefRecordings[initialRoute] as [number, string[]][] }, touch); h.frames();
            assert.equal(third.finished, true); assert.equal(third.routes.snapshot.verdict, 'missed');
            assert.match(h.byId('lab-status').textContent, /Passagem concluída; objetivo opcional não cumprido/);
            assert.deepEqual(app.snapshot, before, 'optional failure also preserves every chapter receipt');
            assert.equal(publicWaterAudioLevel(app.snapshot, { x: 926, y: 606 }), previousAudio);
            const leaving = third.routes.capture('other-route')!;
            h.byId('chapter-map-return').click(); await mapReady();
            assert.equal(third.isDisposed, true); assert.equal(leaving.consume(), null);
            assert.deepEqual(app.snapshot, before);
        }
        await excursion();
        for (let i = 0; i < route.length; i++) {
            const scene = route[i];
            choose(`${CHAPTER_SCENES[scene].title}: Próximo trecho`); h.frames(1200);
            h.button(`Entrar: ${CHAPTER_SCENES[scene].title}`).click(); await flushChapter();
            const game = app.activeGame; assert.ok(game);
            h.play(game, chapterRecording(recordings[scene]), touch); h.frames();
            assert.equal(app.snapshot.accepted.length, i, 'acceptance remains explicit');
            h.byId('chapter-primary').click(); await mapReady();
            assert.equal(app.snapshot.accepted.length, i + 1);
            if (i === 0 || i === route.length - 1) await excursion();
        }
        assert.equal(app.snapshot.chapterComplete, true); assert.equal(app.snapshot.accepted.length, 5);
        assert.deepEqual(app.snapshot.accepted.map(receipt => receipt.sceneId), route);
        app.dispose(); h.checkDisposed();
    });
}
