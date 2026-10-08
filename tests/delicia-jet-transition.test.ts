import assert from 'node:assert/strict';
import test from 'node:test';
import { DELICIA_STAGES } from '../src/adventure/delicia/DeliciaContent';
import { DeliciaSimulation, noDeliciaInput, type DeliciaInput } from '../src/adventure/delicia/DeliciaSimulation';
import { GroundPoundState } from '../src/types';

const step = (sim: DeliciaSimulation, input: Partial<DeliciaInput> = {}) =>
    sim.update(1 / 60, { ...noDeliciaInput(), ...input });

function approachJet() {
    // Real checkpoint route, with no changes to authored content or live state.
    const sim = new DeliciaSimulation(DELICIA_STAGES[3], false, 0);
    for (let frame = 0; frame < 180; frame++) step(sim, { right: sim.player.x < 1763 });
    step(sim, { jump: true, jumpPressed: true });
    return sim;
}

for (const pound of [false, true]) test(`authored jet preserves its launch after ${pound ? 'ground-pound windup' : 'an ordinary jump'}`, () => {
    const sim = approachJet();
    step(sim, { pound });
    assert.equal(sim.events.filter(event => event.kind === 'jet').length, 1);
    assert.equal(sim.player.vy, -2250);
    assert.equal(sim.nativePlayer.data.groundPoundState, GroundPoundState.NONE);
    assert.equal(sim.nativePlayer.data.groundPoundTimer, 0);
    assert.equal(sim.player.pounding, false);
    assert.equal(sim.player.grounded, false);
    assert.equal(sim.player.health, 4);
    const launchY = sim.player.y;
    step(sim);
    assert.ok(sim.player.y < launchY, 'the emitted launch must move Feka upward next step');
    assert.equal(sim.player.vy, -2160);
    assert.ok(!sim.events.some(event => event.kind === 'jet'), 'the launch retains its cooldown');
    step(sim, { pound: true });
    assert.equal(sim.nativePlayer.data.groundPoundState, GroundPoundState.WINDUP, 'a new pound remains available after launch');
    assert.ok(sim.nativePlayer.data.groundPoundTimer > 0);
});

for (const state of [GroundPoundState.FALL, GroundPoundState.RECOVERY]) test(`jet clears native ${state} and its timer on activation`, () => {
    const sim = new DeliciaSimulation(DELICIA_STAGES[3]);
    const jet = sim.stage.machines!.find(machine => machine.kind === 'jet')!;
    sim.time = jet.period * .82 - jet.phase;
    Object.assign(sim.player, { x: jet.x + 5, y: jet.y, vy: 60, grounded: state === GroundPoundState.RECOVERY, pounding: state === GroundPoundState.FALL });
    Object.assign(sim.nativePlayer.data, { groundPoundState: state, groundPoundTimer: 100 });
    step(sim);
    assert.equal(sim.events.filter(event => event.kind === 'jet').length, 1);
    assert.equal(sim.nativePlayer.data.groundPoundState, GroundPoundState.NONE);
    assert.equal(sim.nativePlayer.data.groundPoundTimer, 0);
    assert.equal(sim.player.vy, -jet.power!);
    const launchY = sim.player.y;
    step(sim);
    assert.ok(sim.player.y < launchY);
});

for (const outside of [false, true]) test(`${outside ? 'an out-of-range' : 'an inactive'} jet leaves pound windup alone`, () => {
    const sim = new DeliciaSimulation(DELICIA_STAGES[3]);
    const jet = sim.stage.machines!.find(machine => machine.kind === 'jet')!;
    sim.time = outside ? jet.period * .82 - jet.phase : 0;
    Object.assign(sim.player, { x: jet.x + (outside ? 100 : 5), y: jet.y, grounded: false });
    step(sim, { pound: true });
    assert.ok(!sim.events.some(event => event.kind === 'jet'));
    assert.equal(sim.nativePlayer.data.groundPoundState, GroundPoundState.WINDUP);
    assert.ok(sim.nativePlayer.data.groundPoundTimer > 0);
});
