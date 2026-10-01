import assert from 'node:assert/strict';
import test from 'node:test';
import { stageById } from '../src/adventure/campaign';

import { overlaps } from '../src/adventure/types';
import { secretCannonHarness, walkTo, poundSwitch, jumpTo, runTo, reachSecretCatwalk, finishSecret, DT } from './helpers/worldSecretCannonHarness';

test('5-3 deliberately routes a pressurized keg away from its secret target until the safe switch is pressed', () => {
    const stage = stageById('5-3')!;
    const belt = stage.mechanisms.find(m => m.id === 'sb')!;
    const button = stage.mechanisms.find(m => m.id === 'ss')!;
    const cannon = stage.mechanisms.find(m => m.id === 'launch132')!;
    const target = stage.mechanisms.find(m => m.id === 'st')!;
    assert.equal(belt.direction, 1);
    assert.equal(cannon.direction, -1);
    assert.equal(cannon.pressurized, true);
    assert.equal(target.pressurized, true);
    assert.ok(target.x < cannon.x && target.x > belt.x);
    assert.equal(button.link, belt.id);
    assert.ok(button.x + button.width < belt.x, 'The control remains on the safe lower approach.');
    assert.equal(stage.exits.find(e => e.id === 'secret')!.requires, 'st');
    assert.ok(stage.route?.some(cue => cue.switch === 'ss'));
    assert.ok(stage.dialogues.some(d => d.x === 100 * 16 && /sentada.*botão.*barril.*gelo/.test(d.text)));
    assert.deepEqual(stage.pickups.filter(p => p.kind === 'seal').map(p => [p.id, p.x / 16, p.y / 16]), [
        ['5-3:s1', 30, 9], ['5-3:s2', 71, 8], ['5-3:s3', 127, 3]
    ]);
    assert.equal(stage.mechanisms.find(m => m.id === 'b1')!.direction, -1, 'The earlier ungated demonstration is unchanged.');
    assert.equal(stageById('3-2')!.mechanisms.find(m => m.id === 'b1')!.direction, -1);
});

test('waiting through repeated live cannon cycles cannot unlock the 5-3 secret', () => {
    const h = secretCannonHarness();
    walkTo(h, 103.3);
    for (let frame = 0; frame < 1800; frame++) h.step();
    assert.equal(h.game.objects.get('ss').active, false);
    assert.equal(h.game.objects.get('st').active, false);
    assert.ok(h.game.objects.get('launch132').firedAt > 25000, 'The cannon must actually be running, not sleeping offscreen.');
    assert.equal(h.game.state, 'playing');
    assert.deepEqual(h.store.save.secrets, []);
    assert.ok(h.speech.some(text => text.includes('Uma sentada no botão')));
});

test('jumping to the high secret exit without operating the switch leaves it locked', () => {
    const h = secretCannonHarness();
    walkTo(h, 103.3);
    for (let frame = 0; frame < 1800; frame++) h.step();
    reachSecretCatwalk(h);
    walkTo(h, 133.3);
    const exit = h.game.stage.exits.find((e: { id: string }) => e.id === 'secret');
    assert.ok(overlaps(h.game.player.getRect(), exit), 'Test the actual exit overlap, not only target state.');
    for (let frame = 0; frame < 1800; frame++) h.step();
    assert.equal(h.game.objects.get('st').active, false);
    assert.equal(h.game.state, 'playing');
    assert.deepEqual(h.store.save.secrets, []);
    assert.ok(!h.frames.some(input => input.downPressed));
});

for (const waitFrames of [0, 36, 180, 300, 2400]) {
    test(`a real jump and pound opens 5-3, and ordinary jumps finish its secret after ${waitFrames * DT} ms of observation`, () => {
        const h = secretCannonHarness();
        walkTo(h, 103.3);
        for (let frame = 0; frame < waitFrames; frame++) h.step();
        poundSwitch(h);
        assert.equal(h.game.objects.get('ss').active, true);
        assert.equal(h.game.objects.get('sb').active, true);
        assert.equal(h.game.objects.get('st').active, false, 'The switch reverses the belt; it must not magically open the target.');
        const pressedAt = h.game.objects.time;
        for (let frame = 0; frame < 360 && !h.game.objects.get('st').active; frame++) h.step();
        assert.equal(h.game.objects.get('st').active, true);
        assert.ok(h.game.objects.get('st').brokenAt > pressedAt);
        assert.ok(h.effects.includes('pound'));
        finishSecret(h);
        assert.equal(h.game.nextMapSelection, '5-5');
    });
}

test('5-3 normal exit remains reachable without reversing the secret conveyor or opening its target', () => {
    const h = secretCannonHarness();
    walkTo(h, 103.3);
    jumpTo(h, 109, 12);
    jumpTo(h, 113, 12);
    runTo(h, 127);
    jumpTo(h, 137, 13, 14);
    jumpTo(h, 145, 14, 14);
    for (let frame = 0; frame < 200 && h.game.state === 'playing'; frame++) h.step({ right: true });
    assert.equal(h.game.state, 'clear');
    assert.equal(h.game.clearSecret, false);
    assert.ok(h.store.save.completed.includes('5-3'));
    assert.deepEqual(h.store.save.secrets, []);
    assert.equal(h.game.objects.get('st').active, false);
    assert.ok(!h.frames.some(input => input.downPressed));
});

test('a checkpoint reload restores the authored locked puzzle and another player pound can solve it again', () => {
    const h = secretCannonHarness();
    walkTo(h, 103.3);
    poundSwitch(h);
    for (let frame = 0; frame < 360 && !h.game.objects.get('st').active; frame++) h.step();
    assert.equal(h.game.objects.get('st').active, true);
    h.game.load('5-3', true);
    assert.equal(h.game.player.data.position.x, 94 * 16);
    walkTo(h, 103.3);
    for (let frame = 0; frame < 600; frame++) h.step();
    assert.equal(h.game.objects.get('st').active, false);
    assert.equal(h.game.objects.get('sb').active, false);
    poundSwitch(h);
    for (let frame = 0; frame < 360 && !h.game.objects.get('st').active; frame++) h.step();
    assert.equal(h.game.objects.get('st').active, true);
    finishSecret(h);
});
