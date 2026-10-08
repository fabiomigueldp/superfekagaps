import assert from 'node:assert/strict';
import test from 'node:test';
import { secretCannonHarness, DT } from './helpers/worldSecretCannonHarness';

function bossHit(health = 1) {
    const { game, effects } = secretCannonHarness();
    game.load('1-5');
    game.closeDialogue(); game.closeDialogue();
    game.boss.phase = 'open'; game.boss.health = health; game.boss.timer = 0;
    game.player.data.position = { x: game.boss.x + 5, y: game.boss.y - game.player.data.height - 1 };
    game.player.data.velocity = { x: 0, y: 2 };
    game.player.data.isGrounded = false;
    game.update(DT);
    assert.equal(game.boss.health, health - 1);
    assert.equal(game.camera.shakeTimer, 180);
    assert.equal(game.hitStop, 70);
    assert.ok(effects.includes('hit'));
    return game;
}

test('final boss hit keeps hitstop, then settles shake during defeat and stays steady on clear', () => {
    const game = bossHit();
    assert.equal(game.boss.phase, 'defeated');
    while (game.hitStop > 0) {
        game.update(DT);
        assert.equal(game.camera.shakeTimer, 180, 'Impact stays frozen during hitstop.');
    }
    game.update(DT);
    assert.ok(game.camera.shakeTimer > 0 && game.camera.shakeTimer < 180);
    for (let frame = 0; frame < 12; frame++) game.update(DT);
    assert.equal(game.state, 'playing');
    assert.equal(game.camera.shakeTimer, 0, 'Shake settles before the defeat animation finishes.');
    for (let frame = 0; frame < 180; frame++) game.update(DT);
    assert.equal(game.state, 'clear');
    assert.equal(game.camera.shakeTimer, 0);
    const time = game.time;
    for (let frame = 0; frame < 120; frame++) game.update(DT);
    assert.ok(game.time > time, 'Clear celebration continues without camera shake.');
    assert.equal(game.camera.shakeTimer, 0);
});

test('nonfinal hit and final hit preserve pause/settings freeze and resume countdown', () => {
    for (const health of [1, 2]) {
        const game = bossHit(health);
        while (game.hitStop > 0) game.update(DT);
        game.pause();
        const frozen = game.camera.shakeTimer;
        game.update(300);
        assert.equal(game.camera.shakeTimer, frozen);
        game.settings('paused');
        game.update(300);
        assert.equal(game.camera.shakeTimer, frozen);
        game.closeSettings();
        assert.equal(game.state, 'paused');
        game.resume(); game.update(DT);
        assert.ok(game.camera.shakeTimer > 0 && game.camera.shakeTimer < frozen);
    }
});

test('completion clears an active impact only when entering the result screen', () => {
    const { game } = secretCannonHarness();
    game.camera.shakeTimer = 130;
    game.update(DT);
    assert.ok(game.camera.shakeTimer > 0);
    game.complete(false);
    assert.equal(game.state, 'clear');
    assert.equal(game.camera.shakeTimer, 0);
});

test('loading another stage clears leftover camera shake', () => {
    const { game } = secretCannonHarness();
    game.camera.shakeTimer = 130;
    game.load('1-1');
    assert.equal(game.camera.shakeTimer, 0);
});
