import test from 'node:test';
import assert from 'node:assert/strict';
import { JuiceMinibossLab } from '../src/adventure/experimental/JuiceMinibossLab';
import { FactorySalonSession } from '../src/adventure/factory/FactorySalonSession';
import type { JuiceAttack, JuiceMinibossModel, JuicePhase } from '../src/adventure/experimental/JuiceMinibossModel';
import { pixelText } from '../src/graphics/BitmapFont';
import { juiceEpilogueBrowser, replayJuiceVictory, STEP } from './helpers/juiceEpilogueHarness';

type Encounter = NonNullable<JuiceMinibossLab['boss']> & { model: JuiceMinibossModel; blockedStompFeedback: boolean };
const encounter = (game: JuiceMinibossLab) => game.boss as Encounter;
const feedback = 'SEM DANO: ESPERE A COROA';
type Dot = { x: number; y: number; color: string };
function shape(dots: Dot[]) {
    assert.ok(dots.length > 0);
    const x = Math.min(...dots.map(p => p.x)), y = Math.min(...dots.map(p => p.y));
    return dots.map(p => `${p.x - x},${p.y - y}`).sort();
}
function expectedText(text: string) {
    const dots: Dot[] = [];
    pixelText({ fillRect(x: number, y: number) { dots.push({ x, y, color: '' }); } } as unknown as CanvasRenderingContext2D,
        text, 0, 0, '');
    return shape(dots);
}
function recordHud(game: JuiceMinibossLab) {
    game.render(); // Obtain the composite HUD surface after the world pass.
    const c = game.renderer.getContext(), fill = c.fillRect.bind(c);
    let recording = false;
    let dots: Dot[] = [];
    c.fillRect = (x, y, width, height) => {
        if (x === 0 && y === 0 && width === 320 && height === 34 && c.fillStyle === '#161c2a') {
            recording = true; dots = [];
        }
        if (recording && width === 1 && height === 1) dots.push({ x, y, color: String(c.fillStyle) });
        fill(x, y, width, height);
    };
    return () => { recording = false; game.render(); return dots; };
}
function block(game: JuiceMinibossLab, attack: JuiceAttack = 'fan') {
    const boss = encounter(game), b = boss.model;
    b.phase = 'warning'; b.attack = attack; b.phaseTime = 0;
    const p = { x: b.x + 5, y: b.y - 20, width: 14, height: 24 };
    assert.equal(boss.contact(p, { ...p, y: b.y - p.height - 2 }, true), 'bounce');
    assert.equal(boss.blockedStompFeedback, true);
    return boss;
}

for (const reduced of [false, true]) for (const embedded of [false, true]) {
    test(`ordinary keys explain both blocked stomps without changing the victory (${embedded ? 'Factory salon' : 'lab'}, ${reduced ? 'reduced' : 'normal'})`, t => {
        const h = juiceEpilogueBrowser(t, reduced);
        const game = embedded ? new FactorySalonSession(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement) : h.create();
        game.skipIntro();
        game.audio.enabled = false; // The explanation must not depend on audible feedback.
        const boss = encounter(game), paint = recordHud(game);
        const contact = boss.contact.bind(boss), blockedFrames: number[] = [];
        let frame = 0, result = 'none', checkedOpening = false;
        boss.contact = (...args) => { result = contact(...args); return result as ReturnType<typeof contact>; };
        replayJuiceVictory(h, game, () => {
            if (result === 'bounce') {
                blockedFrames.push(frame);
                assert.equal(boss.blockedStompFeedback, true);
                const before = JSON.stringify({ model: boss.model, player: game.player.data, save: game.store.save });
                const dots = paint();
                const cause = dots.filter(p => p.color === '#ffcfb0');
                const action = dots.filter(p => p.color === '#d8cbd7');
                assert.deepEqual(shape(cause), expectedText(feedback));
                assert.deepEqual(shape(action), expectedText(boss.hint), 'The current attack instruction is still complete.');
                assert.ok(cause.every(p => p.x >= 0 && p.x < 320 && p.y >= 16 && p.y <= 22));
                assert.ok(action.every(p => p.x >= 0 && p.x < 320 && p.y >= 25 && p.y < 33));
                assert.match(h.status.textContent, /Sem dano: espere a coroa/);
                if (game instanceof FactorySalonSession) {
                    const campaignStatus = { textContent: '' };
                    game.reflectCampaignStatus(campaignStatus, h.status.textContent);
                    assert.equal(campaignStatus.textContent, h.status.textContent);
                }
                assert.equal(JSON.stringify({ model: boss.model, player: game.player.data, save: game.store.save }), before);
            }
            if (blockedFrames.length && boss.model.vulnerable) {
                checkedOpening = true;
                assert.equal(boss.blockedStompFeedback, false);
                const dots = paint();
                assert.equal(dots.filter(p => p.color === '#ffcfb0').length, 0);
                assert.match(h.status.textContent, /Abertura!/);
            }
            result = 'none'; frame++;
        });
        assert.deepEqual(blockedFrames, [269, 768]);
        assert.equal(checkedOpening, true);
        assert.equal(boss.health, 0);
        assert.equal(boss.blockedStompFeedback, false);
        assert.equal(game.audio.enabled, false);
        assert.deepEqual(game.store.save.completed, []);
        game.dispose();
    });
}

test('feedback lasts only one simulation second, retains all attack instructions and keeps geyser status', t => {
    const h = juiceEpilogueBrowser(t), game = h.create(), paint = recordHud(game);
    for (const attack of ['dash', 'fan', 'pounce'] as const) {
        const boss = block(game, attack);
        const dots = paint();
        assert.deepEqual(shape(dots.filter(p => p.color === '#d8cbd7')), expectedText(boss.hint));
        assert.ok(h.status.textContent.includes(boss.hint));
    }
    const boss = block(game);
    boss.model.geysers = [{ x: 60, y: 160, width: 22, height: 64, phase: 'warning', phaseTime: 0, progress: 0 }];
    paint();
    assert.match(h.status.textContent, /Sem dano: espere a coroa/);
    assert.match(h.status.textContent, /Saia das marcas douradas/);
    for (let i = 0; i < 99; i++) boss.update(10, game.player.getRect(), game.objects, game.level);
    assert.equal(boss.blockedStompFeedback, true);
    boss.update(20, game.player.getRect(), game.objects, game.level);
    assert.equal(boss.blockedStompFeedback, false);
    paint();
    assert.doesNotMatch(h.status.textContent, /Sem dano/);
    game.dispose();
});

for (const phase of ['recover', 'hurt', 'enrage', 'defeated', 'intro'] as JuicePhase[]) {
    test(`${phase} supersedes and permanently clears the failed-attempt cue`, t => {
        const h = juiceEpilogueBrowser(t), game = h.create(), boss = block(game);
        boss.model.phase = phase;
        assert.equal(boss.blockedStompFeedback, false, 'Current phase immediately suppresses the cue.');
        boss.update(1, game.player.getRect(), game.objects, game.level);
        boss.model.phase = 'rest';
        assert.equal(boss.blockedStompFeedback, false, 'A later rest cannot revive stale feedback.');
        game.dispose();
    });
}

test('pause and hit-stop freeze the cue; death hides it and restart/replay discard it', t => {
    const h = juiceEpilogueBrowser(t), game = h.create(), paint = recordHud(game);
    let boss = block(game);
    const time = boss.model.time;
    h.key('Escape'); game.update(STEP);
    for (let i = 0; i < 120; i++) game.update(STEP);
    assert.equal(boss.model.time, time);
    assert.equal(boss.blockedStompFeedback, true);
    paint(); assert.match(h.status.textContent, /Pausado/);
    h.key('Escape');
    (game as unknown as { hitStop: number }).hitStop = 70;
    for (let i = 0; i < 5; i++) game.update(STEP);
    assert.equal(boss.model.time, time);
    assert.equal(boss.blockedStompFeedback, true);
    paint(); assert.match(h.status.textContent, /Sem dano/);
    game.player.data.isDead = true;
    const dots = paint();
    assert.equal(dots.filter(p => p.color === '#ffcfb0').length, 0);
    assert.doesNotMatch(h.status.textContent, /Sem dano/);
    game.load('juice-lab');
    boss = encounter(game);
    assert.equal(boss.blockedStompFeedback, false);
    block(game); game.replayIntro(); game.skipIntro();
    assert.equal(encounter(game).blockedStompFeedback, false);
    game.dispose();
});
