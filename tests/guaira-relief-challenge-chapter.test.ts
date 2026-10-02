import assert from 'node:assert/strict';
import test from 'node:test';
import { GuairaRelief } from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import { GuairaGallery } from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import type { GuairaReliefOptions } from '../src/adventure/experimental/guaira/relief/GuairaReliefChallenge';
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

/** The future OUTRA ROTA button is deliberately not implemented in the host.
 * A factory seam passes its consumed options via the existing native retry.
 * All results/receipts, room transitions and five stages are actually played;
 * only DOM/canvas/audio/assets are boundaries. This proves API integration,
 * not a shipped button, browser rendering, phone UX or an audio audition. */
for (const [opening, touch] of [['guaira-travessia', false], ['guaira-patio-comportas', true]] as const) {
    test(`${opening}: optional goals at 0/5, 1/5 and 5/5 preserve real receipts and victory water/audio`, async t => {
        const h = chapterExcursionBrowser(t);
        const factories = Object.fromEntries(await Promise.all(Object.keys(CHAPTER_SCENES).map(async id =>
            [id, await loadGuairaChapterScene(id as GuairaChapterSceneId)]))) as Record<GuairaChapterSceneId, GuairaChapterSceneFactory>;
        const galleryFactory = await loadGuairaChapterExcursion('gallery'), reliefFactory = await loadGuairaChapterExcursion('relief');
        let pendingOptions: GuairaReliefOptions | undefined;
        const app = h.create({ loadScene: async id => factories[id], loadExcursion: async id => id === 'gallery'
            ? galleryFactory : (canvas, status) => {
                const options = pendingOptions; pendingOptions = undefined;
                return reliefFactory(canvas, status, options);
            } });
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
            const options = action.consume(); assert.ok(options); pendingOptions = options;
            h.byId('chapter-retry').click(); await flushChapter();
            const second = app.activeGame; assert.ok(second instanceof GuairaRelief);
            assert.notEqual(second, first); assert.equal(first.isDisposed, true);
            assert.equal(second.routes.snapshot.goal, options.routeGoal);
            assert.equal(action.consume(), null); assert.equal(oldRetry.consume(), null);
            h.play(second, { runs: reliefRecordings[nextRoute] as [number, string[]][] }, touch); h.frames();
            assert.equal(second.routes.snapshot.verdict, 'met');
            assert.deepEqual(app.snapshot, before, 'optional success has no chapter authority');
            before.accepted.forEach((receipt, i) => assert.equal(app.snapshot.accepted[i], receipt));
            assert.equal(hasAcceptedPublicWater(app.snapshot), water);
            assert.equal(publicWaterAudioLevel(app.snapshot, { x: 926, y: 606 }), previousAudio);
            assert.equal(previousAudio > 0, water);
            const leaving = second.routes.capture('other-route')!;
            h.byId('chapter-map-return').click(); await mapReady();
            assert.equal(second.isDisposed, true); assert.equal(leaving.consume(), null);
            assert.deepEqual(app.snapshot, before); assert.equal(pendingOptions, undefined);
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
