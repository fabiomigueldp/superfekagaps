import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Input } from '../src/engine/Input';
import { Player } from '../src/entities/Player';
import { Renderer } from '../src/engine/Renderer';
import { STAGES } from '../src/adventure/campaign';
import { GuairaBullEncounter, GuairaBullLab } from '../src/adventure/experimental/guaira/GuairaBullLab';
import { BULL_RULES, SkeletonBullModel } from '../src/adventure/experimental/guaira/SkeletonBullModel';
import { guairaBrowser, Canvas } from './helpers/guairaLabHarness';

const step = (game: GuairaBullLab, n = 1) => { for (let i = 0; i < n; i++) game.update(BULL_RULES.tickMs); };
const model = (game: GuairaBullLab) => (game.boss as GuairaBullEncounter).model;
const snapshot = (game: GuairaBullLab) => structuredClone({ player: game.player.data, boss: model(game), time: game.time, elapsed: game.elapsed });

test('isolated lab uses the real engine, cloned flat stage, helmet and fixed camera', t => {
    const h = guairaBrowser(t), original = structuredClone(STAGES), game = h.create();
    assert.ok(game.player instanceof Player); assert.ok(game.input instanceof Input); assert.ok(game.renderer instanceof Renderer);
    assert.equal(game.stage.id, 'guaira-lab'); assert.equal(game.level.data.id, 'experimental-guaira-lab');
    for (const key of ['foes', 'pickups', 'exits', 'dialogues', 'mechanisms', 'checkpoints', 'landmarks'] as const)
        assert.deepEqual(game.stage[key], []);
    assert.equal(game.player.data.hasHelmet, true);
    assert.equal(game.player.data.isGrounded, true);
    assert.equal(game.player.data.position.y + game.player.data.height, 224);
    assert.equal(game.camera.x, 0); assert.equal(game.camera.y, 64);
    game.render(); assert.ok(h.canvas.drawCalls > 0);
    assert.deepEqual(game.store.save.completed, []); assert.deepEqual(STAGES, original);
    const html = readFileSync(new URL('../guaira-lab.html', import.meta.url), 'utf8');
    assert.match(html, /id="lab-exit" href="\.\/guaira\.html\?at=corral"/);
    assert.doesNotMatch(html, /intro|KeyX|HP/);
});

test('pause via Escape, HUD, blur and visibility freezes and resumes without campaign controls', t => {
    const h = guairaBrowser(t), game = h.create();
    for (const pause of [() => { h.key('Escape'); step(game); }, () => h.pointer(305, 10),
        () => h.window.dispatch('blur'), () => h.hidden(true)]) {
        step(game, 2); pause(); assert.equal(game.state, 'paused');
        const frozen = snapshot(game); step(game, 80); game.render();
        assert.deepEqual(snapshot(game), frozen);
        assert.match(h.status.textContent, /Pausado/);
        assert.deepEqual((game as unknown as { buttons: unknown[] }).buttons, []);
        h.hidden(false); assert.equal(game.state, 'paused');
        h.key('Escape', true); assert.equal(game.state, 'paused');
        h.key('Escape'); step(game); assert.equal(game.state, 'playing');
    }
});

test('real toolbar has native 44px bitmap controls, retry resets combat and Enter/Space do not leak', async t => {
    const h = guairaBrowser(t); await import('../src/guaira-lab');
    const game = h.window.worldGame as GuairaBullLab;
    for (const [control, name] of [[h.pause, 'Pausar'], [h.retry, 'Tentar novamente'], [h.exit, 'Voltar ao mapa de Guaíra']] as const) {
        assert.equal(control.getAttribute('aria-label'), name);
        assert.equal(control.textContent, name);
        assert.ok(control.children[0] instanceof Canvas); assert.equal((control.children[0] as Canvas).height, 44);
        for (const state of ['playing', 'paused'] as const) for (const [key, code] of [[' ', 'Space'], ['Enter', 'Enter']]) {
            game.state = state; game.input.reset();
            assert.equal(h.window.dispatch('keydown', { key, code, target: control }), false);
            game.input.update(); assert.equal(game.input.getState().jumpPressed, false); assert.equal(game.input.getState().start, false);
            assert.equal(game.state, state); h.window.dispatch('keyup', { key, code, target: control });
        }
    }
    game.state = 'playing'; h.pause.dispatch('click'); h.frame();
    assert.equal(game.state, 'paused'); assert.equal(h.pause.getAttribute('aria-label'), 'Continuar');
    const oldPlayer = game.player, oldBoss = game.boss;
    model(game).health = 1; game.player.die('hit');
    h.retry.dispatch('click');
    assert.equal(game.state, 'playing'); assert.notEqual(game.player, oldPlayer); assert.notEqual(game.boss, oldBoss);
    assert.equal(model(game).health, 6); assert.equal(model(game).state, 'intro');
    assert.equal(game.player.data.hasHelmet, true); assert.equal(game.player.data.isDead, false);
    assert.equal(h.canvas.focused, true); assert.equal(game.elapsed, 0);
});

test('touch owns ordinary move, jump and ground-pound actions and cancel releases them', t => {
    const h = guairaBrowser(t, { touch: true }), game = h.create();
    const touch = (identifier: number, x: number) => ({ identifier, clientX: x * 640, clientY: 330, target: h.canvas });
    const right = touch(1, .22), jump = touch(2, .93), down = touch(3, .5);
    h.canvas.dispatch('touchstart', { touches: [right, jump] }); step(game);
    assert.ok(game.player.data.velocity.x > 0); assert.ok(game.player.data.velocity.y < 0);
    h.canvas.dispatch('touchstart', { touches: [right, down] }); step(game);
    assert.equal(game.input.getState().down, true); assert.ok(game.player.isGroundPoundActive());
    h.canvas.dispatch('touchcancel', { touches: [], changedTouches: [right, down] }); step(game);
    assert.equal(game.input.getState().right, false); assert.equal(game.input.getState().down, false);
    game.render();
});

test('helmet loss, real death animation and automatic retry preserve the lab and campaign isolation', t => {
    const h = guairaBrowser(t), game = h.create(), oldPlayer = game.player;
    assert.deepEqual(game.player.takeDamage(), { damaged: false, helmetUsed: true });
    assert.equal(game.player.data.hasHelmet, false); assert.equal(game.player.data.isDead, false);
    game.player.data.invincibleTimer = 0;
    (game as unknown as { hurt(x: number): void }).hurt(200); assert.equal(game.player.data.isDead, true);
    for (let i = 0; i < 180 && game.player === oldPlayer; i++) step(game);
    assert.notEqual(game.player, oldPlayer); assert.equal(game.player.data.hasHelmet, true);
    assert.equal(game.stage.id, 'guaira-lab'); assert.equal(model(game).health, 6);
    assert.deepEqual(game.store.save.completed, []);
});

test('final real falling stomp produces a pausable lab outcome without campaign completion', t => {
    const h = guairaBrowser(t), game = h.create(), b = model(game);
    b.health = 1; b.state = 'recover'; b.stateTick = 0;
    game.player.data.position = { x: b.x + 12, y: b.y - game.player.data.height - 1 };
    game.player.data.velocity = { x: 0, y: 2 }; game.player.data.isGrounded = false;
    const internals = game as unknown as { complete(): void }; let completed = 0;
    internals.complete = () => { completed++; };
    step(game); assert.equal(b.health, 0); assert.equal(game.boss?.phase, 'defeated');
    step(game, 240); game.render(); assert.equal(completed, 0); assert.match(h.status.textContent, /Vitória/);
    h.key('Escape'); step(game); assert.equal(game.state, 'paused');
    const frozen = snapshot(game); step(game, 60); assert.deepEqual(snapshot(game), frozen);
    h.key('Escape'); step(game); assert.equal(game.state, 'playing'); assert.equal(b.health, 0);
    assert.deepEqual(game.store.save.completed, []);
});

test('full directional telegraph locks aim and oversize time steps cannot skip it', () => {
    const b = new SkeletonBullModel(); const left = { x: 0, y: 200, width: 14, height: 24 };
    for (let i = 0; i < 84; i++) b.update(BULL_RULES.tickMs, left);
    assert.equal(b.state, 'tell'); assert.equal(b.stateTick, 0); assert.equal(b.facing, -1);
    b.update(10000, { ...left, x: 306 }); assert.equal(b.state, 'tell'); assert.equal(b.stateTick, 6); assert.equal(b.facing, -1);
    for (let i = 6; i < BULL_RULES.tell; i++) b.update(BULL_RULES.tickMs, left);
    assert.equal(b.state, 'charge');
});

test('recovery accepts a falling stomp on the exact braking frame but never side attacks', () => {
    const b = new SkeletonBullModel(); b.state = 'charge'; b.facing = -1; b.x = 17;
    const p = { x: 24, y: b.y - 2, width: 14, height: 24 };
    b.update(BULL_RULES.tickMs, p); assert.equal(b.state, 'brake'); assert.ok(b.hazards.length > 0);
    assert.equal(b.contact(p, { ...p, y: b.y - 25 }, true), 'hit'); assert.equal(b.health, 5);
    assert.equal(b.contact(p, { ...p, y: b.y - 25 }, true), 'none'); assert.equal(b.health, 5);
    const side = new SkeletonBullModel(); side.state = 'recover';
    assert.equal(side.contact({ x: side.x, y: side.y, width: 14, height: 24 }, { x: side.x, y: side.y, width: 14, height: 24 }, false), 'none');
    assert.equal(side.health, 6);
});

test('reduced-motion lab disables shake and keeps combat timing intact', t => {
    const h = guairaBrowser(t, { reducedMotion: true }), game = h.create();
    assert.equal(game.reducedMotion, true); assert.equal(game.store.save.preferences.shake, false);
    step(game, 86); assert.equal(model(game).state, 'tell'); game.render();
});

test('toolbar pause discards a sentada buffered during impact hit-stop', t => {
    const h = guairaBrowser(t), game = h.create();
    const internals = game as unknown as { hitStop: number; hitStopInput: { downPressed: boolean } | null };
    game.player.data.position.y = 130; game.player.data.velocity.y = -3; game.player.data.isGrounded = false;
    internals.hitStop = 70; h.key('ArrowDown'); step(game);
    assert.equal(internals.hitStopInput?.downPressed, true);
    game.toggleLabPause(); assert.equal(game.state, 'paused');
    assert.equal(internals.hitStopInput, null);
    game.toggleLabPause(); step(game, 8);
    assert.equal(game.player.isGroundPoundActive(), false);
});
