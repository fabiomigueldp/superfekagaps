import assert from 'node:assert/strict';
import test from 'node:test';
import { DELICIA_STAGES } from '../src/adventure/delicia/DeliciaContent';
import { DeliciaSimulation, noDeliciaInput } from '../src/adventure/delicia/DeliciaSimulation';

const DT = 1 / 120;
for (const direction of [-1, 1]) for (const recovery of ['natural', 'parry'] as const) {
    test(`roller restores patrol after ${recovery} recovery, approaching from ${direction}`, () => {
        const sim = new DeliciaSimulation(DELICIA_STAGES[6]);
        const roller = sim.enemies.find(enemy => enemy.kind === 'roller')!;
        const state = () => roller.state;
        assert.equal(Math.abs(roller.vx), 55);
        const tickAway = (distance: number) => {
            // Keep other authored encounters out of this isolated combat observation.
            Object.assign(sim.player, { x: roller.x + direction * distance, y: roller.y - 200, vy: 0, invincible: 1 });
            sim.update(DT, noDeliciaInput());
        };
        tickAway(180);
        assert.equal(roller.state, 'tell');
        assert.ok(sim.events.some(event => event.kind === 'tell'));
        for (let i = 0; i < 100 && state() !== 'attack'; i++) tickAway(180);
        assert.equal(roller.state, 'attack');
        assert.equal(roller.vx, direction * 260);
        if (recovery === 'parry') {
            Object.assign(sim.player, { x: roller.x + 5, y: roller.y, vy: 0 });
            sim.update(DT, { ...noDeliciaInput(), parry: true });
            assert.equal(sim.parries, 1);
            assert.ok(sim.events.some(event => event.kind === 'parry'));
        } else {
            for (let i = 0; i < 120 && state() !== 'stun'; i++) tickAway(450);
        }
        assert.equal(roller.state, 'stun');
        const recoveryDirection = Math.sign(roller.vx);
        for (let i = 0; i < 240 && state() !== 'walk'; i++) tickAway(450);
        assert.equal(roller.state, 'walk');
        assert.equal(roller.vx, recoveryDirection * 55, 'Recovery keeps direction and restores normal patrol speed.');
        const before = roller.x;
        tickAway(450);
        assert.equal(roller.state, 'walk');
        assert.ok(Math.abs(Math.abs(roller.x - before) - 55 * DT) < 1e-9);
        assert.ok(!sim.events.some(event => event.kind === 'tell'));
        tickAway(180);
        assert.equal(roller.state, 'tell', 'The next charge still requires its normal warning.');
        assert.ok(sim.events.some(event => event.kind === 'tell'));
    });
}
