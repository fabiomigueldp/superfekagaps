import { introductionReached } from './helpers/guairaCourseTest';
import assert from 'node:assert/strict';
import test from 'node:test';
import { pixelText, textWidth } from '../src/graphics/BitmapFont';
import { jetCycle } from '../src/adventure/WorldMachineState';
import { chapterGuidance } from '../src/adventure/experimental/guaira/chapter/GuairaChapterPresentation';
import { chapterCompletionStory } from '../src/adventure/experimental/guaira/chapter/GuairaChapterStory';
import { GuairaChapterSession } from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import { freshGuairaChapterProgress, guairaChapterRoute } from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import { guairaAscentBrowser } from './helpers/guairaAscentHarness';
import { guairaJunctionBrowser } from './helpers/guairaJunctionHarness';
import { guairaMayorBrowser } from './helpers/guairaMayorHarness';
import { guairaRespirosBrowser } from './helpers/guairaRespirosHarness';
import ascent from './helpers/guairaReadableRoutesReplays.json';
import patio from './helpers/guairaJunctionOptionalReplay.json';
import mayor from './helpers/guairaMayorReplay.json';

type Run = [number, string[]];
type H = ReturnType<typeof guairaAscentBrowser> | ReturnType<typeof guairaJunctionBrowser> |
    ReturnType<typeof guairaMayorBrowser> | ReturnType<typeof guairaRespirosBrowser>;
type Game = ReturnType<H['create']>;
const dt = 1000 / 60;
const feet = (g: Game) => g.player.data.position.y + g.player.data.height;
function play(h: H, g: Game, runs: Run[], until = Infinity, touch = false, observe = (_n: number) => {}) {
    let n = 0;
    for (const [count, keys] of runs) {
        if (touch) {
            const x: Record<string, number> = { ArrowLeft: .08, ArrowRight: .22, ArrowDown: .5, ShiftLeft: .78, Space: .93 };
            const touches = keys.map((key, i) => ({ identifier: i + 1, target: h.canvas, clientX: x[key] * 640, clientY: 330 }));
            h.canvas.dispatch(touches.length ? 'touchstart' : 'touchend', { touches });
        } else h.keys(keys);
        for (let i = 0; i < count && n < until; i++) { g.update(dt); observe(++n); }
        if (n === until) break;
    }
    return n;
}
function visible(g: Game, x: number, width: number, y: number) {
    assert.ok(x >= g.camera.x && x + width <= g.camera.x + 320, 'entire landing width visible');
    assert.ok(y - g.camera.y >= 24 && y - g.camera.y <= 172, 'landing below HUD and above viewport foot');
    assert.ok(g.player.data.position.y - 10 - g.camera.y >= 23, 'whole conservative helmet bound visible');
}

for (const touch of [false, true]) for (const reducedMotion of [false, true])
    test(`lookout has a continuously visible receiving balcony, touch=${touch}, reduced=${reducedMotion}`, t => {
        const h = guairaAscentBrowser(t, { touch, reducedMotion }), g = h.create();
        let landed = 0;
        play(h, g, ascent.subida.runs as Run[], Infinity, touch, n => {
            assert.equal(g.player.data.isDead, false); assert.equal(g.player.data.hasHelmet, true);
            if (n >= 1014 && !landed) {
                visible(g, 1072, 48, 96);
                if (g.player.data.isGrounded && g.player.data.position.x > 1058 && feet(g) === 96) landed = n;
            }
        });
        assert.ok(landed > 1014 && landed < 1070); assert.equal(g.finished, true); assert.equal(g.coins, ascent.subida.coins);
        assert.equal(feet(g), g.stage.level.goalPosition.y*16, 'arrives on the elevated aqueduct terrace');
    });

for (const hold of [16, 20, 24, 36, 52]) test(`lookout accepts ${hold}-frame jump and reaches the house without a precise release`, t => {
    const h = guairaAscentBrowser(t), g = h.create();
    play(h, g, ascent.subida.runs as Run[], 1014);
    let landed = false;
    play(h, g, [[hold, ['ArrowRight', 'Space']], [64 - hold, ['ArrowRight']]], Infinity, false, () => {
        if (!landed) visible(g, 1072, 48, 96);
        if (g.player.data.isGrounded && g.player.data.position.x > 1058 && feet(g) === 96) landed = true;
    });
    assert.equal(landed, true);
    h.run(g, 130, ['ArrowRight']); assert.equal(introductionReached(g), true); assert.equal(g.player.data.hasHelmet, true);
});

for (const touch of [false, true]) test(`Pátio full optional route retains the far bank through the exit jump, touch=${touch}`, t => {
    const h = guairaJunctionBrowser(t, { touch }), g = h.create();
    play(h, g, patio.runs as Run[], Infinity, touch, n => {
        assert.equal(g.player.data.isDead, false); assert.equal(g.player.data.hasHelmet, true);
        if (n >= 153 && n <= 182) visible(g, 384, 16, 256);
        if (n >= 1745 && n <= 1788) visible(g, 848, 48, 208);
    });
    assert.equal(g.finished, true); assert.equal(g.coins, patio.coins);
});

type Paint = [string, number, number, number, number];
function recordHud(g: Game) {
    g.render(); const context = g.renderer.getContext(), calls: Paint[] = [], original = context.fillRect.bind(context);
    context.fillRect = (x, y, w, h) => { calls.push([String(context.fillStyle), x, y, w, h]); original(x, y, w, h); };
    return () => {
        calls.length = 0; const before = JSON.stringify({ p: g.player.data, o: g.objects, c: g.camera, b: g.boss, t: g.time });
        g.render(); assert.equal(JSON.stringify({ p: g.player.data, o: g.objects, c: g.camera, b: g.boss, t: g.time }), before);
        let index = -1;
        calls.forEach(([, x, y, w, h], i) => { if (x === 0 && y === 0 && w === 320 && h === 23) index = i; });
        assert.ok(index >= 0); return calls.slice(index);
    };
}
for (const name of ['patio', 'prefeito', 'subida'] as const) test(`${name} hints never paint into the level during a complete native route`, t => {
    const h = name === 'patio' ? guairaJunctionBrowser(t) : name === 'prefeito' ? guairaMayorBrowser(t) : guairaAscentBrowser(t), g = h.create(), paint = recordHud(g);
    let checked = 0;
    play(h, g, (name === 'patio' ? patio.runs : name === 'prefeito' ? mayor.runs : ascent.subida.runs) as Run[], Infinity, false, n => {
        if (n % 7) return;
        const calls = paint(); checked++;
        for (const [, x, y, w, height] of calls) assert.ok(x >= 0 && x + w <= 320 && y >= 0 && y + height <= 23,
            `frame ${n}: HUD cannot cover a destination, attack or coin`);
        if (name === 'prefeito') {
            const expected: Paint[] = [], c = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) { expected.push([this.fillStyle, x, y, w, h]); } };
            pixelText(c as unknown as CanvasRenderingContext2D, g.boss!.hint, 8, 13, '#f0ddae');
            assert.deepEqual(calls.slice(-expected.length), expected, 'warning remains present even during the upper jump');
        }
    });
    assert.ok(checked > 150);
});

test('Respiros reports all six actual phases without calling rising or receding water dry', t => {
    const h = guairaRespirosBrowser(t), g = h.create(), phases = new Set<string>();
    for (let n = 0; n < 252; n++) {
        h.run(g, 1); const cue = g.pressureReading!, body = g.objects.get(cue.id)!, cycle = jetCycle(body, g.objects.time);
        assert.equal(cue.letter, 'A'); assert.equal(cue.phase, cycle.phase); phases.add(cue.phase);
        if (cycle.danger) assert.doesNotMatch(cue.label, /SECO|ISOLADO|ALIVIANDO/);
        if (cycle.phase === 'idle') assert.match(cue.label, /PISO SECO/);
        if (cycle.phase === 'charging') assert.match(cue.label, /PRESSAO SUBINDO/);
        assert.ok(69 + textWidth(cue.label) < 233, 'cue fits before coin count');
        const time = g.objects.time; g.render(); assert.equal(g.objects.time, time);
        assert.ok(chapterGuidance(h.status.textContent, '').startsWith(cue.detail), 'live pressure reaches chapter guidance, ahead of control help');
    }
    assert.equal(phases.size, 6); assert.equal(g.player.data.hasHelmet, true);
    h.keys([]); g.toggleRespirosPause(); const cue = g.pressureReading;
    h.run(g, 120); assert.deepEqual(g.pressureReading, cue, 'pause cannot invent a new crossing window');
});

test('pressure guidance follows each outlet, backtracking and actual isolation of C', t => {
    const h = guairaRespirosBrowser(t), g = h.create(), p = g.player.data;
    // Focused geography fixtures: the complete ordinary-input route is covered
    // separately. Only which existing outlet the player is looking at changes.
    for (const [x, right, expected] of [[48, true, 'A'], [300, true, 'B'], [600, true, 'C'], [824, true, 'D'], [300, false, 'A'], [600, false, 'B'], [824, false, 'C']] as const) {
        p.position.x = x; p.facingRight = right; assert.equal(g.pressureReading?.letter, expected);
    }
    p.position.x = 700; p.facingRight = false;
    assert.equal(g.pressureReading?.letter, 'C', 'outlet beneath the body takes priority over facing');
    g.objects.get('guaira-respiro-c')!.active = true;
    assert.equal(g.pressureReading?.isolated, true); assert.match(g.pressureReading!.label, /C: ISOLADO/);
    p.position.x = 824; p.facingRight = true;
    assert.equal(g.pressureReading?.letter, 'D'); assert.equal(g.pressureReading?.isolated, false);
});

for (const opening of ['guaira-travessia', 'guaira-patio-comportas'] as const)
    test(`${opening}: every live completion explains the next step without awarding a receipt or spoiling earlier replays`, () => {
        const route = guairaChapterRoute(opening), next = [/arrozal.*Respiros/, /Ossabravo.*Curral/, /água ainda falta.*Suba/, /enfrente o Prefeito/, /Ramal público aberto.*moradores/];
        for (let count = 0; count < route.length; count++) {
            const session = new GuairaChapterSession({ progress: { ...freshGuairaChapterProgress(), opening, completed: route.slice(0, count), selectedScene: route[count] } });
            const before = JSON.stringify(session.snapshot());
            assert.match(chapterCompletionStory(session.snapshot(), route[count])!, next[count]);
            assert.equal(JSON.stringify(session.snapshot()), before, 'copy cannot accept native success');
            if (count > 1) assert.equal(chapterCompletionStory(session.snapshot(), opening), null);
            const persisted = new GuairaChapterSession({ progress: { ...freshGuairaChapterProgress(), opening, completed: route.slice(0, count + 1), selectedScene: route[Math.min(count + 1, 4)] } });
            assert.match(chapterCompletionStory(persisted.snapshot(), route[count])!, next[count], 'host persists success before Continue');
            session.dispose(); assert.equal(chapterCompletionStory(session.snapshot(), route[count]), null);
        }
    });
