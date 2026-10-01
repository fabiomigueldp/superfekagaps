import test from 'node:test';
import assert from 'node:assert/strict';
import { stageById } from '../src/adventure/campaign';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { jetCycle, jetCycleTick } from '../src/adventure/WorldMachineState';
import { geyserPresentation } from '../src/adventure/WorldGeyserState';
import { BossEncounter } from '../src/adventure/BossEncounter';

function fixture(period = 4200, phase = 0) {
    return new WorldObjects([
        { id: 'j', kind: 'jet', x: 160, y: 176, width: 12.8, height: 48, period, phase },
        { id: 's', kind: 'switch', x: 100, y: 220, width: 24, height: 4, link: 'j' }
    ]);
}
const level = () => new WorldLevel(stageById('5-2')!.level);

test('reopening during the original danger window gives the full warning, then resumes one cycle', () => {
    const o = fixture(), l = level(), b = o.get('j')!;
    o.time = 1000;
    assert.ok(o.activate('s')); assert.equal(b.active, true);
    o.update(1000, l, 160);
    assert.ok(o.activate('s')); assert.equal(b.active, false);
    assert.equal(b.changedAt, 2000);
    assert.equal(b.jetOpenedAt, 2000);
    assert.equal(jetCycleTick(b, o.time), 1000);
    assert.equal(o.jetState(b), 'warning'); assert.equal(o.jetDanger(b), null);
    let warnings = 0, releases = 0;
    for (let i = 0; i < 80; i++) {
        o.update(10, l, 160);
        warnings += o.events.filter(e => e.kind === 'pressure').length;
        releases += o.events.filter(e => e.kind === 'jet').length;
        assert.equal(o.jetDanger(b), null, 'No immediate or early damage when reopening.');
        assert.deepEqual(geyserPresentation(b, o.time).danger, o.jetDanger(b));
    }
    assert.equal(warnings, 1); assert.equal(releases, 0);
    o.update(10, l, 160);
    assert.ok(o.jetDanger(b));
    assert.equal(o.events.filter(e => e.kind === 'jet').length, 1);
    o.time = 2000 + 4200;
    assert.equal(jetCycleTick(b, o.time), 1000, 'The player reset keeps its new, predictable cadence.');
});

test('reopening preserves the configured warning fraction at custom periods and ignores old offsets', () => {
    for (const period of [2100, 4200, 8400]) for (const phase of [-10000, 0, 2600]) {
        const b = fixture(period, phase).get('j')!;
        b.jetOpenedAt = 10000;
        const warning = period * 800 / 4200;
        assert.equal(jetCycle(b, 10000).phase, 'charging');
        assert.equal(jetCycle(b, 10000 + warning - 1).danger, null);
        assert.ok(jetCycle(b, 10000 + warning + period * 20 / 4200).danger);
        b.active = true;
        assert.equal(jetCycle(b, 10000 + warning + 40).danger, null);
    }
});

test('rapid close/open attempts respect the existing switch debounce and cannot skip the tell', () => {
    const o = fixture(), l = level(), b = o.get('j')!;
    o.time = 2050;
    assert.ok(o.activate('s')); assert.equal(o.activate('s'), false);
    o.update(400, l, 160);
    assert.ok(o.activate('s')); assert.equal(o.activate('s'), false);
    assert.equal(jetCycleTick(b, o.time), 1000);
    o.update(400, l, 160);
    assert.ok(o.activate('s'));
    assert.equal(o.jetDanger(b), null);
    o.update(400, l, 160);
    assert.ok(o.activate('s'));
    assert.equal(jetCycleTick(b, o.time), 1000);
    assert.equal(o.jetDanger(b), null);
});

test('untouched authored machines retain their original phases', () => {
    for (const phase of [-10000, 0, 900, 2100, 2600]) {
        const b = fixture(4200, phase).get('j')!;
        for (const t of [0, 1000, 1800, 2500, 4199, 5000]) {
            assert.equal(jetCycleTick(b, t), ((t + phase) % 4200 + 4200) % 4200);
        }
    }
});

test('boss-controlled pressure keeps its authored idle lead-in instead of taking the manual valve path', () => {
    for (const stageId of ['3-5', '5-5']) {
        const stage = stageById(stageId)!, o = new WorldObjects(stage.mechanisms), l = new WorldLevel(stage.level);
        const boss = new BossEncounter(stage.encounter!), b = o.get('bossJet')!;
        boss.health--; b.active = true; b.observedActive = true; o.time = 2000;
        boss.update(16, { x: 40, y: 200, width: 14, height: 24 }, o, l);
        assert.equal(b.active, false); assert.equal(b.phase, -2000);
        o.update(16, l, 160);
        assert.equal(b.jetOpenedAt, undefined);
        assert.equal(b.changedAt, 2016);
        assert.equal(jetCycleTick(b, o.time), 16);
        assert.equal(jetCycle(b, o.time).phase, 'idle');
        assert.equal(jetCycle(b, 2999).phase, 'idle');
        assert.equal(jetCycle(b, 3000).phase, 'charging');
        assert.ok(jetCycle(b, 3820).danger);
    }
});
