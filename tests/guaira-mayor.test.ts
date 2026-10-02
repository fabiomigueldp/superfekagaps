import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Player } from '../src/entities/Player';
import { Input } from '../src/engine/Input';
import { STAGES, ISLANDS } from '../src/adventure/campaign';
import { GuairaMayorLab, guairaMayorStage } from '../src/adventure/experimental/guaira/GuairaMayorLab';
import { GuairaMayorModel, MAYOR_ARENA as A, MAYOR_RULES as R } from '../src/adventure/experimental/guaira/GuairaMayorModel';
import { guairaMayorBrowser } from './helpers/guairaMayorHarness';
import { Canvas } from './helpers/guairaLabHarness';
import { GuairaMapModel, guairaArrivalFromSearch, parseGuairaMetadata } from '../src/adventure/experimental/guaira/GuairaMapModel';
import recording from './helpers/guairaMayorReplay.json';

const snapshot = (g: GuairaMayorLab) => structuredClone({ player: g.player.data, mayor: g.mayor,
    objects: g.objects, time: g.time, elapsed: g.elapsed, camera: g.camera });
const feet = (g: GuairaMayorLab) => g.player.data.position.y + g.player.data.height;

function replay(h: ReturnType<typeof guairaMayorBrowser>, g: GuairaMayorLab, touch = false) {
    let frame = 0, carried = 0, pounds = 0, openings = 0, previousValve = false;
    const hitFrames: number[] = [], hitRecoveryTicks: number[] = [];
    for (const [count, keys] of recording.runs as Array<[number, string[]]>) {
        if (touch) {
            const touches = keys.map((key, i) => ({ identifier: i + 1, target: h.canvas,
                clientX: (key === 'ArrowRight' ? .22 : key === 'ArrowLeft' ? .07 : key === 'ArrowDown' ? .5 : .93) * 640,
                clientY: 330 }));
            h.canvas.dispatch('touchstart', { touches });
        } else h.keys(keys);
        for (let n = 0; n < count; n++, frame++) {
            const before = g.mayor.sealsRemaining, recoveryTick = g.mayor.stateTick;
            g.update(recording.stepMs);
            assert.equal(g.player.data.isDead, false, `alive at ${frame}`);
            assert.equal(g.player.data.hasHelmet, true, `helmet at ${frame}`);
            if (g.mayor.sealsRemaining < before) { hitFrames.push(frame + 1); hitRecoveryTicks.push(recoveryTick); }
            const lift = g.objects.get(A.liftId)!, valve = g.objects.get(A.valveId)!;
            if (valve.active && !previousValve) openings++;
            previousValve = valve.active;
            if (g.player.isGroundPoundActive()) pounds++;
            if (g.player.data.isGrounded && Math.abs(feet(g) - lift.y) < .0001 && lift.y !== lift.py) carried++;
        }
    }
    assert.equal(frame, recording.frames); assert.ok(pounds > 15); assert.equal(openings, 3);
    assert.ok(carried >= 20, 'actual native lift carry was used');
    assert.deepEqual(hitFrames, [322, 622, 922]);
    assert.ok(hitRecoveryTicks.every(tick => tick < R.recover - 120), 'more than two seconds of margin in every window');
    assert.equal(g.mayor.publicWaterOpen, true); assert.equal(g.mayor.sealsRemaining, 0);
    assert.ok(g.player.data.position.x < 100); assert.equal(feet(g), A.floor);
    assert.equal(g.player.data.isGrounded, true);
}

test('isolated native scene has only local mechanisms, checkpoint and a safe continuous floor', t => {
    const h = guairaMayorBrowser(t), campaign = structuredClone(STAGES), islands = structuredClone(ISLANDS), g = h.create();
    assert.ok(g.player instanceof Player); assert.ok(g.input instanceof Input);
    assert.equal(g.stage.id, A.id); assert.equal(g.camera.x, 0); assert.equal(g.camera.y, 64);
    assert.deepEqual(g.stage.exits, []); assert.deepEqual(g.stage.foes, []);
    assert.deepEqual(g.objects.bodies.map(b => b.kind), ['switch', 'lift', 'support']);
    assert.ok(g.stage.level.tiles[14].every(tile => tile !== 0));
    const clone = guairaMayorStage(); clone.level.tiles[14][0] = 0;
    assert.notEqual(guairaMayorStage().level.tiles[14][0], 0);
    h.run(g, 1); assert.equal(g.store.save.checkpoint?.stage, A.id);
    g.render(); assert.ok(h.canvas.drawCalls > 0);
    assert.deepEqual(STAGES, campaign); assert.deepEqual(ISLANDS, islands);
    const html = readFileSync(new URL('../guaira-prefeito.html', import.meta.url), 'utf8');
    assert.deepEqual(Array.from(html.matchAll(/href="([^"]+)"/g), match => match[1]), ['./guaira.html?at=vazao']);
    assert.doesNotMatch(html, /guaira-lab\.ts|KeyX|HP/);
    assert.match(html, /guaira-prefeito\.ts/);
});

for (const touch of [false, true]) test(`${touch ? 'native touch' : 'keyboard'} replay releases three locks and escapes without damage or campaign completion`, t => {
    const h = guairaMayorBrowser(t, { touch }), g = h.create(); let completed = 0;
    (g as unknown as { complete(): void }).complete = () => { completed++; };
    replay(h, g, touch); h.run(g, 240); g.render();
    assert.equal(completed, 0); assert.deepEqual(g.store.save.completed, []); assert.deepEqual(g.store.save.times, {});
    assert.equal(g.boss!.hint, 'AGUA DO BAIRRO LIBERADA');
    assert.equal(h.status.textContent, 'Feka: “A água voltou. Os gaps continuam.” · CASA: voltar à Casa da Vazão · TENTAR: recomeçar o encontro');
    assert.equal(g.objects.get(A.valveId)!.active, true); assert.equal(g.objects.get(A.liftId)!.y, A.deckY);
    const before = g.player.data.position.x; h.run(g, 12, ['ArrowRight']);
    assert.ok(g.player.data.position.x > before, 'controls continue to work after the public water opens');
});

test('warning target is immutable and exact danger appears only after its full warning', () => {
    const b = new GuairaMayorModel(), access = { valveActive: false, liftReady: false, registerOpened: false };
    for (let i = 0; i < R.intro + R.idle; i++) b.update(R.tickMs, access);
    assert.equal(b.state, 'warning'); assert.equal(b.danger, null);
    const target = b.stampTarget; assert.ok(Object.isFrozen(target)); assert.deepEqual(target, A.vent);
    b.update(10000, access); assert.equal(b.stateTick, 6); assert.equal(b.state, 'warning');
    for (let i = 6; i < R.warning; i++) b.update(R.tickMs, access);
    assert.equal(b.state, 'stamp'); assert.equal(b.stampTarget, target); assert.equal(b.danger, target);
    for (let i = 0; i < R.stamp; i++) b.update(R.tickMs, access);
    assert.equal(b.state, 'recover'); assert.equal(b.danger, null);
});

test('closed or stale register never damages the mayor; stamp resets both halves of the native toggle', t => {
    const h = guairaMayorBrowser(t), g = h.create(), b = g.mayor;
    g.objects.activate(A.valveId); h.run(g, R.intro + R.idle + R.warning);
    assert.equal(b.state, 'stamp'); assert.equal(g.objects.get(A.valveId)!.active, false);
    assert.equal(g.objects.get(A.liftId)!.active, false); assert.equal(b.registerOpenedThisCycle, false);
    h.run(g, R.stamp); assert.equal(b.state, 'recover'); assert.equal(b.vulnerable, false);
    const p = { x: b.x + 10, y: b.y - 1, width: 14, height: 24 }, previous = { ...p, y: b.y - 25 };
    assert.equal(b.contact(p, previous, true), 'bounce'); assert.equal(b.sealsRemaining, 3);
    assert.equal(b.contact({ ...p, y: b.y + 8 }, { ...p, y: b.y + 8 }, false), 'none');
    assert.equal(g.objects.activate(A.valveId), true); assert.equal(g.objects.get(A.liftId)!.active, true);
    // Late native switch interaction is observable only in its actual update.
    g.boss!.update(R.tickMs, g.player.getRect(), g.objects, g.level);
    assert.equal(b.registerOpenedThisCycle, true); assert.equal(b.vulnerable, false);
    h.run(g, 72); assert.equal(b.vulnerable, true);
    assert.equal(g.objects.activate(A.valveId), true);
    g.boss!.update(R.tickMs, g.player.getRect(), g.objects, g.level);
    assert.equal(b.vulnerable, false); assert.match(g.boss!.hint, /REGISTRO/);
    h.run(g, 25); assert.equal(g.objects.activate(A.valveId), true);
    g.boss!.update(R.tickMs, g.player.getRect(), g.objects, g.level);
    h.run(g, 26); assert.equal(b.vulnerable, true);
    assert.equal(b.contact(p, previous, true), 'hit'); assert.equal(b.sealsRemaining, 2);
    assert.equal(b.contact(p, previous, true), 'none'); assert.equal(b.sealsRemaining, 2);
});

test('safe corners and missed windows stay replayable; waiting and jump spam cannot release locks', t => {
    const h = guairaMayorBrowser(t), g = h.create();
    for (const x of [0, 48, 80, 306]) {
        h.keys([]); g.load(A.id); g.player.data.position.x = x;
        h.run(g, 1800);
        assert.equal(g.player.data.hasHelmet, true); assert.equal(g.player.data.isDead, false);
        assert.equal(g.mayor.sealsRemaining, 3); assert.ok(g.mayor.cycle >= 4);
        h.run(g, 50, ['Space']); assert.equal(g.mayor.sealsRemaining, 3);
    }
    h.keys([]); g.load(A.id); h.run(g, 2 * (R.idle + R.warning + R.stamp + R.recover));
    // A fresh whole attempt still follows the same tested route after long passivity.
    h.keys([]); g.load(A.id); replay(h, g);
});

test('late opening misses safely, closes in the next stamped cycle and can be reopened', t => {
    const h = guairaMayorBrowser(t), g = h.create();
    h.run(g, R.intro + R.idle + R.warning + R.stamp + R.recover - 5);
    assert.equal(g.mayor.state, 'recover'); assert.equal(g.mayor.stateTick, 265);
    g.objects.activate(A.valveId);
    g.boss!.update(R.tickMs, g.player.getRect(), g.objects, g.level);
    h.run(g, 4); assert.equal(g.mayor.state, 'idle'); assert.equal(g.mayor.sealsRemaining, 3);
    h.run(g, R.idle + R.warning); assert.equal(g.mayor.state, 'stamp');
    assert.equal(g.objects.get(A.valveId)!.active, false); assert.equal(g.objects.get(A.liftId)!.active, false);
    assert.equal(g.mayor.registerOpenedThisCycle, false);
    h.run(g, R.stamp); g.objects.activate(A.valveId);
    g.boss!.update(R.tickMs, g.player.getRect(), g.objects, g.level);
    h.run(g, 72); assert.equal(g.mayor.vulnerable, true); assert.equal(g.player.data.hasHelmet, true);
});

test('closing native lift carries Feka to dry floor without crushing; both sides are viable exits', t => {
    const h = guairaMayorBrowser(t), g = h.create();
    for (const keys of [[], ['ArrowLeft'], ['ArrowRight']]) {
        h.keys([]); g.load(A.id);
        const lift = g.objects.get(A.liftId)!, valve = g.objects.get(A.valveId)!;
        lift.y = lift.py = A.deckY; lift.active = lift.observedActive = valve.active = valve.observedActive = true;
        g.player.data.position = { x: 160, y: A.deckY - g.player.data.height };
        h.run(g, R.intro + R.idle + R.warning);
        h.run(g, 100, keys);
        assert.equal(feet(g), A.floor); assert.equal(g.player.data.isDead, false); assert.equal(g.player.data.hasHelmet, true);
        assert.equal(lift.y, A.floor);
    }
});

test('all render states preserve simulation and restore encounter even when a painter throws', t => {
    const h = guairaMayorBrowser(t), g = h.create();
    for (const frame of [1, 129, 32, 24, 80]) {
        h.run(g, frame); const before = snapshot(g), boss = g.boss;
        g.render(); assert.deepEqual(snapshot(g), before); assert.equal(g.boss, boss);
    }
    const boss = g.boss; g.toggleLabPause(); const before = snapshot(g);
    g.art.background = () => { throw Error('deliberate painter failure'); };
    assert.throws(() => g.render(), /deliberate/); assert.equal(g.boss, boss); assert.equal(g.state, 'paused');
    assert.deepEqual(snapshot(g), before);
});

for (const reducedMotion of [false, true]) for (const heldFrames of [7, 45])
    test(`local camera keeps real helmet visible through ${heldFrames}-frame jump (reduced motion ${reducedMotion})`, t => {
        const h = guairaMayorBrowser(t, { reducedMotion }), g = h.create();
        // Reach the actual raised lift entirely through the frozen keyboard path.
        let frame = 0;
        for (const [count, keys] of recording.runs as Array<[number, string[]]>) {
            h.keys(keys);
            for (let n = 0; n < count && frame < 252; n++, frame++) g.update(R.tickMs);
            if (frame === 252) break;
        }
        let raised = false, restoredBeforeVent = false;
        for (let n = 0; n < 130; n++) {
            // Move left after take-off: miss the deck intentionally and use the dry floor.
            h.run(g, 1, n < heldFrames ? ['ArrowLeft', 'Space'] : ['ArrowLeft']);
            const p = g.player.data, spriteTop = Math.round(p.position.y) - Math.round(g.camera.y) - 4;
            assert.ok(spriteTop >= 26, `helmet above HUD at jump step ${n}`);
            raised ||= g.camera.y < 20;
            if (feet(g) >= A.vent.y) {
                assert.ok(A.vent.y + A.vent.height - Math.round(g.camera.y) <= 180, 'whole vent returns before Feka can enter its height');
                restoredBeforeVent = true;
            }
            assert.equal(p.hasHelmet, true); assert.equal(p.isDead, false);
            if (n === 20) {
                g.toggleLabPause(); const frozen = snapshot(g); h.run(g, 80); g.render();
                assert.deepEqual(snapshot(g), frozen); g.toggleLabPause();
            }
        }
        if (heldFrames === 45) assert.equal(raised, true);
        assert.equal(restoredBeforeVent, true); assert.ok(Math.abs(g.camera.y - 64) < .01);
        assert.equal(g.mayor.sealsRemaining, 3, 'camera motion alone never releases water');
    });

test('opening matches the visible upper back and rejects falling contacts in adjacent empty pixels', () => {
    const makeOpen = () => {
        const b = new GuairaMayorModel(); b.state = 'recover';
        b.update(R.tickMs, { valveActive: true, liftReady: true, registerOpened: true }); return b;
    };
    for (const [x, expected] of [[260, 'bounce'], [288, 'bounce'], [274, 'hit'], [278, 'hit']] as const) {
        const b = makeOpen(), p = { x, y: b.y - 1, width: 14, height: 24 };
        assert.equal(b.contact(p, { ...p, y: b.y - 25 }, true), expected);
        assert.equal(b.sealsRemaining, expected === 'hit' ? 2 : 3);
    }
    const b = makeOpen(), p = { x: 274, y: 98, width: 14, height: 24 };
    assert.equal(b.contact(p, { ...p, y: 97 }, true), 'none', 'a floor jump peaking below the top never crosses it');
});

test('visible vent uses native helmet loss and death/retry; checkpoint cannot retain partial victory', t => {
    const h = guairaMayorBrowser(t), g = h.create(); h.run(g, 1);
    h.run(g, R.intro + R.idle + R.warning - 2);
    g.player.data.position.x = 150; h.run(g, 1);
    assert.equal(g.mayor.state, 'stamp'); assert.equal(g.player.data.hasHelmet, false); assert.equal(g.player.data.isDead, false);
    const old = g.player; g.player.data.invincibleTimer = 0; g.player.data.position.x = 180;
    h.run(g, 1); assert.equal(g.player.data.isDead, true);
    for (let i = 0; i < 180 && old === g.player; i++) h.run(g, 1);
    assert.notEqual(g.player, old); assert.equal(g.player.data.hasHelmet, true);
    assert.equal(g.player.data.position.x, 48); assert.equal(g.mayor.sealsRemaining, 3);
    assert.equal(g.mayor.state, 'intro'); assert.equal(g.objects.get(A.valveId)!.active, false);
    assert.deepEqual(g.store.save.completed, []);
});

test('Escape, toolbar, blur and visibility pause native movement and the mechanism clock', t => {
    const h = guairaMayorBrowser(t), g = h.create(); h.run(g, 130);
    for (const pause of [() => { h.key('Escape'); h.run(g, 1); }, () => g.toggleLabPause(),
        () => h.window.dispatch('blur'), () => h.hidden(true)]) {
        pause(); assert.equal(g.state, 'paused'); const frozen = snapshot(g);
        h.run(g, 200); g.render(); assert.deepEqual(snapshot(g), frozen);
        assert.deepEqual((g as unknown as { buttons: unknown[] }).buttons, []);
        h.hidden(false); assert.equal(g.state, 'paused');
        h.key('Escape'); h.run(g, 1); assert.equal(g.state, 'playing');
    }
});

test('reduced motion preserves the winning route and suppresses cosmetic impacts', t => {
    const h = guairaMayorBrowser(t, { reducedMotion: true }), g = h.create();
    assert.equal(g.store.save.preferences.shake, false); replay(h, g); g.render();
});

test('three native toolbar actions expose Casa after victory, retain paused return and reset on retry', async t => {
    const h = guairaMayorBrowser(t); await import('../src/guaira-prefeito');
    const g = h.window.worldGame as GuairaMayorLab;
    assert.equal(h.exit.getAttribute('href'), './guaira.html?at=vazao');
    assert.equal(h.pause.getAttribute('aria-label'), 'Pausar'); assert.equal(h.retry.getAttribute('aria-label'), 'Tentar novamente');
    assert.equal(h.exit.getAttribute('aria-label'), 'Voltar à Casa da Vazão no mapa');
    const exitArt = h.exit.children[0] as Canvas, mapWidth = exitArt.width;
    assert.ok(exitArt instanceof Canvas); assert.equal(exitArt.height, 44);
    for (const control of [h.pause, h.retry, h.exit]) for (const [key, code] of [[' ', 'Space'], ['Enter', 'Enter']]) {
        g.input.reset(); assert.equal(h.window.dispatch('keydown', { key, code, target: control }), false);
        g.input.update(); assert.equal(g.input.getState().jumpPressed, false);
        h.window.dispatch('keyup', { key, code, target: control });
    }
    const html = readFileSync(new URL('../guaira-prefeito.html', import.meta.url), 'utf8');
    assert.match(html, /id="lab-exit" href="\.\/guaira.html\?at=vazao"/);
    assert.equal(Array.from(html.matchAll(/<(?:button|a)\b/g)).length, 3);
    assert.match(html, /min-height:44px;min-width:44px/);
    h.pause.dispatch('click'); h.frame(); assert.equal(g.state, 'paused');
    assert.equal(h.exit.dispatch('click'), false, 'pause never intercepts the native map link');
    const returnHref = html.match(/id="lab-exit" href="([^"]+)"/)![1];
    const meta = parseGuairaMetadata(JSON.parse(readFileSync(new URL('../public/assets/world/experimental/guaira/guaira-diorama.meta.json', import.meta.url), 'utf8')))!;
    const map = new GuairaMapModel(meta, guairaArrivalFromSearch(new URL(returnHref, 'https://example.test/').search));
    assert.equal(map.arrival, 'vazao'); assert.equal(map.selected, null); assert.equal(map.moving, false);
    assert.equal(map.enterHref(), './guaira-prefeito.html', 'the paused exit returns to Casa with a separate optional entry');
    assert.equal(g.state, 'paused', 'reading the return action does not resume the lab');
    const old = g.player; h.retry.dispatch('click'); assert.equal(g.state, 'playing');
    assert.notEqual(g.player, old); assert.equal(g.mayor.state, 'intro'); assert.equal(g.mayor.sealsRemaining, 3);
    assert.equal(h.canvas.focused, true); assert.equal(g.elapsed, 0); assert.equal(g.player.data.hasHelmet, true);

    replay(h, g);
    assert.equal(h.exit.dispatch('click'), false, 'return activation reads a victory before RAF');
    assert.equal(h.exit.getAttribute('href'), './guaira.html?at=vazao&visit=mayor-clear'); h.frame();
    assert.equal(h.exit.getAttribute('aria-label'), 'Voltar à Casa da Vazão');
    assert.equal(h.exit.title, 'Voltar à Casa da Vazão');
    assert.equal(h.exit.textContent, 'Voltar à Casa da Vazão');
    assert.equal(h.exit.children[0], exitArt, 'Casa reuses the existing native anchor and bitmap');
    assert.equal(exitArt.width, mapWidth, 'Casa occupies the same width as Mapa');
    assert.equal(exitArt.height, 44);
    let exitNameWrites = 0;
    const setExitAttribute = h.exit.setAttribute.bind(h.exit);
    t.mock.method(h.exit, 'setAttribute', (key: string, value: string) => { if (key === 'aria-label') exitNameWrites++; setExitAttribute(key, value); });
    h.frame(); h.frame();
    assert.equal(exitNameWrites, 0, 'stable outcome does not rewrite the accessible exit name each frame');
    assert.equal(h.exit.dispatch('click'), false, 'victory keeps native navigation to the Casa arrival with its visit summary');
    assert.match(h.status.textContent, /A água voltou\. Os gaps continuam\./);
    h.pause.dispatch('click'); h.frame();
    assert.equal(g.state, 'paused'); assert.equal(h.pause.getAttribute('aria-label'), 'Continuar');
    assert.equal(h.exit.getAttribute('aria-label'), 'Voltar à Casa da Vazão');
    assert.equal(h.exit.getAttribute('href'), './guaira.html?at=vazao&visit=mayor-clear');
    assert.equal(h.exit.dispatch('click'), false);
    const frozen = snapshot(g); h.run(g, 60); g.render(); assert.deepEqual(snapshot(g), frozen);
    const controlsWidth = [h.pause, h.retry, h.exit].reduce((sum, control) => sum + (control.children[0] as Canvas).width, 0);
    assert.ok(controlsWidth + 2 * 4 + 2 * 6 <= 320, 'even Continuar/Tentar/Casa fit the 320px toolbar with existing gaps and padding');
    assert.deepEqual(g.store.save.completed, []); assert.deepEqual(g.store.save.times, {});
    h.retry.dispatch('click');
    assert.equal(h.exit.getAttribute('href'), './guaira.html?at=vazao', 'Retry clears the completed visit before RAF');
    assert.equal(h.exit.getAttribute('aria-label'), 'Voltar à Casa da Vazão no mapa');
    h.frame();
    assert.equal(g.state, 'playing'); assert.equal(g.mayor.publicWaterOpen, false); assert.equal(g.mayor.sealsRemaining, 3);
    assert.equal(h.exit.getAttribute('aria-label'), 'Voltar à Casa da Vazão no mapa');
    assert.equal(exitNameWrites, 1, 'Retry changes the exit name once');
    assert.equal(h.exit.children[0], exitArt); assert.equal(h.canvas.focused, true);
    assert.doesNotMatch(h.status.textContent, /A água voltou|CASA:/);
    assert.deepEqual(h.storageCalls, []);
});
