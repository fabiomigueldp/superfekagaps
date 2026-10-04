/** Offline proof only: real native input/renderers plus equivalent Canvas text layout.
 * Not a browser screenshot or evidence of the DOM's responsive wrapping.
 * STORY_CANVAS_MODULE points at optional @napi-rs/canvas; output stays outside public/.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LifecycleElement as Canvas, sceneLifecycleBrowser } from '../../tests/helpers/sceneLifecycleHarness';
import { loadGuairaChapterScene } from '../../src/adventure/experimental/guaira/chapter/GuairaChapterScenes';
import { GuairaChapterSession } from '../../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import { freshGuairaChapterProgress, guairaChapterRoute } from '../../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import { chapterCompletionStory, chapterJourneyStory } from '../../src/adventure/experimental/guaira/chapter/GuairaChapterStory';
import { chapterAttemptSummary } from '../../src/adventure/experimental/guaira/chapter/GuairaChapterPresentation';
import { GuairaChapterWater } from '../../src/adventure/experimental/guaira/chapter/GuairaChapterWater';
import { paintGuairaMap, guairaCamera } from '../../src/adventure/experimental/guaira/GuairaMapArt';
import { paintLabAction, labActionSize } from '../../src/adventure/experimental/JuiceLabToolbar';
const root = resolve(import.meta.dirname, '../..'), out = resolve(process.argv[2] ?? '../guaira-story-proof');
const { createCanvas, loadImage, GlobalFonts } = createRequire(import.meta.url)(process.env.STORY_CANVAS_MODULE ?? '@napi-rs/canvas');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'ProofSans');
const surfaces = new WeakMap(), contexts = new WeakMap();
Canvas.prototype.getContext = function () {
    if (contexts.has(this)) return contexts.get(this);
    const surface = createCanvas(this.width, this.height); surfaces.set(this, surface);
    for (const key of ['width', 'height']) Object.defineProperty(this, key, { configurable: true,
        get: () => surface[key], set: value => { surface[key] = value; } });
    const c = surface.getContext('2d'), proxy = new Proxy(c, {
        get: (target, key) => key === 'drawImage' ? (image, ...args) => target.drawImage(surfaces.get(image) ?? image, ...args)
            : typeof target[key] === 'function' ? target[key].bind(target) : target[key],
        set: (target, key, value) => { target[key] = value; return true; }
    });
    contexts.set(this, proxy); return proxy;
};
function wrap(c, text, x, y, width, size = 11, lineHeight = 16) {
    c.font = `${size}px ProofSans`; c.fillStyle = '#f5efd3';
    const lines = []; let line = '';
    for (const word of text.split(' ')) {
        const candidate = line ? `${line} ${word}` : word;
        if (c.measureText(candidate).width > width && line) { lines.push(line); line = word; } else line = candidate;
    }
    if (line) lines.push(line);
    for (const [index, row] of lines.entries()) { assert.ok(c.measureText(row).width <= width); c.fillText(row, x, y + index * lineHeight); }
    return { y: y + lines.length * lineHeight, lines };
}
function buttons(c, labels, x, y) {
    for (const [index, label] of labels.entries()) {
        c.save(); c.translate(x, y); c.scale(2, 2); paintLabAction(c, label, index === 0); c.restore();
        x += labActionSize(label).width * 2 + 4;
    }
}
mkdirSync(out, { recursive: true });
const atlas = await loadImage(`${root}/public/assets/world/experimental/guaira/guaira-diorama.webp`);
const metadata = JSON.parse(readFileSync(`${root}/public/assets/world/experimental/guaira/guaira-diorama.meta.json`, 'utf8'));
const reports = [];
for (const [sceneId, prerequisites, recordingName] of [['guaira-lab', 2, 'guairaLabReplay'], ['guaira-prefeito', 4, 'guairaMayorReplay']] as const) {
    for (const reducedMotion of [false, true]) {
        const cleanup = [], h = sceneLifecycleBrowser({ after: f => cleanup.push(f) });
        h.media.matches = reducedMotion;
        const factory = await loadGuairaChapterScene(sceneId), runtime = factory(h.canvas, h.status), game = runtime.game;
        const progress = freshGuairaChapterProgress(); progress.completed = guairaChapterRoute(progress.opening).slice(0, prerequisites); progress.selectedScene = sceneId;
        const session = new GuairaChapterSession({ progress }), attempt = session.enterScene(sceneId, session.snapshot().generation)!;
        const recording = JSON.parse(readFileSync(`${root}/tests/helpers/${recordingName}.json`, 'utf8'));
        let held = new Set<string>(), frame = 0, firstStory = 0, firstNativeResult = 0;
        for (const [count, keys] of [[recording.initialSettleFrames ?? 0, []], ...recording.runs]) {
            const next = new Set<string>(keys);
            for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
            for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
            held = next;
            for (let n = 0; n < count; n++) {
                game.update(recording.stepMs); frame++;
                const live = runtime.sample(attempt); if (live.result) firstNativeResult ||= frame;
                session.acceptCompletion(attempt, live);
                const story = chapterCompletionStory(session.snapshot(), sceneId);
                if (story) firstStory ||= frame;
                assert.equal(!!story, !!live.result && live.alive, 'Never show a causal outcome before its native victory');
            }
        }
        for (const code of held) h.window.dispatch('keyup', { code, target: h.canvas });
        assert.equal(firstStory, firstNativeResult); assert.ok(firstStory > 0);
        const state = () => JSON.stringify({ player: game.player.data, boss: game.boss, time: game.time, save: game.store.save, chapter: session.snapshot() });
        const before = state(); game.render(); assert.equal(state(), before, 'Rendering never advances the scene or receipt');
        const native = createCanvas(320, 180); native.getContext('2d').drawImage(surfaces.get(h.canvas), 0, 0, 320, 180);
        const suffix = reducedMotion ? 'reduced' : 'normal'; writeFileSync(`${out}/${sceneId}-${suffix}-native.png`, native.toBuffer('image/png'));
        for (const width of [390, 960]) {
            const height = width === 390 ? 660 : 800, image = createCanvas(width, height), c = image.getContext('2d');
            c.fillStyle = '#262936'; c.fillRect(0, 0, width, height);
            const caption = wrap(c, 'OFFLINE PROOF: native renderer + equivalent text layout', 8, 18, width - 16, 10, 14);
            c.fillStyle = '#382b35'; c.fillRect(0, caption.y, width, 200);
            const status = `${chapterCompletionStory(session.snapshot(), sceneId)} · ${chapterAttemptSummary(game.coins)} · Continuar volta ao mapa de Guaíra · Conclusões salvas neste navegador.`;
            const text = wrap(c, status, 6, caption.y + 16, width - 12);
            buttons(c, ['CONTINUAR', 'TENTAR', 'MAPA', 'SOM'], 6, text.y + 4);
            const key = wrap(c, 'Teclado: ←/→ mover · Espaço pular · ↓ no ar: sentada · Shift correr · Esc pausa · M som', 6, text.y + 63, width - 12);
            c.fillStyle = '#262936'; c.fillRect(0, key.y + 6, width, height - key.y - 6); c.imageSmoothingEnabled = false;
            const scale = width === 390 ? 1 : 2; c.drawImage(native, (width - 320 * scale) / 2, key.y + 14, 320 * scale, 180 * scale);
            const labelY = key.y + 180 * scale + 34;
            wrap(c, 'MAP OUTCOME (same accepted receipt)', 8, labelY, width - 16, 10, 14);
            const hint = wrap(c, `${chapterJourneyStory(session.snapshot())} · ${prerequisites + 1}/5 concluídos`, 8, labelY + 20, width - 16);
            const mapHeight = height - hint.y - 8, map = createCanvas(width, mapHeight), mc = map.getContext('2d');
            const point = metadata.nodes[sceneId === 'guaira-prefeito' ? 'guaira-2' : 'guaira-4'];
            const camera = guairaCamera(metadata, width, mapHeight, point, false), water = new GuairaChapterWater(); water.update(session.snapshot());
            paintGuairaMap(mc, atlas, camera, { point, moving: false, facingLeft: false, reducedMotion }, 0, { effect: water, seconds: 1.25 });
            c.drawImage(map, 0, hint.y + 8);
            writeFileSync(`${out}/${sceneId}-${suffix}-${width}.png`, image.toBuffer('image/png'));
            reports.push({ sceneId, reducedMotion, width, status, statusLines: text.lines, firstNativeResult, firstStory, frame, unchangedAfterPaint: true });
        }
        game.dispose(); assert.equal(h.listenerCount(), 0); assert.equal(h.frames.size, 0);
        for (const restore of cleanup) restore();
    }
}
writeFileSync(`${out}/report.json`, JSON.stringify({ method: 'Offline real native keyboard replays and production Canvas painters. Equivalent text layout uses exact host copy. Not browser or DOM-layout QA.', reports }, null, 2) + '\n');
console.log(JSON.stringify({ out, reports: reports.length }));
