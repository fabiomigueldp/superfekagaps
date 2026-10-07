import assert from 'node:assert/strict';
import test from 'node:test';
import { DELICIA_STAGES, type DeliciaStage } from '../src/adventure/delicia/DeliciaContent';
import { DeliciaSimulation, noDeliciaInput, type DeliciaInput } from '../src/adventure/delicia/DeliciaSimulation';

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
function fixture(dt = 1 / 120, spawnY = 396, cliff = false) {
    const stage: DeliciaStage = { ...structuredClone(DELICIA_STAGES[0]), width: 3000, height: 900,
        spawn: { x: 90, y: spawnY }, floors: [{ x: 0, y: 450, w: cliff ? 140 : 3000, h: 450, material: 'stone' }],
        enemies: [], pickups: [], hazards: [], checkpoints: [], valves: [], machines: [], echoes: [], zones: [],
        gate: { x: 2800, y: 360, w: 50, h: 90 } };
    const sim = new DeliciaSimulation(stage), initialStage = structuredClone(stage);
    let starts = 0;
    const step = (input: Partial<DeliciaInput> = {}) => {
        sim.update(dt, { ...noDeliciaInput(), ...input });
        starts += sim.events.filter(event => event.kind === 'jump').length;
        assert.equal(sim.dead, false);
        assert.equal(sim.finished, false);
    };
    step();
    const arc = (held: boolean) => {
        const points: Array<[number, number]> = [];
        for (let frame = 0; frame < 180; frame++) {
            points.push([396 - sim.player.y, sim.player.vy]);
            if (sim.player.grounded) return points;
            step({ jump: held });
        }
        assert.fail('The native jump must land within 1.5 seconds.');
    };
    return { sim, stage, initialStage, step, arc, starts: () => starts };
}

// The app runs 120 Hz; the simulation also accepts 60 Hz callers.
for (const dt of [1 / 120, 1 / 60]) for (const intent of ['released', 'held', 'released then repressed', 'release/repress on launch', 'released on launch'] as const) {
    test(`Delícia ${1 / dt} Hz: ${intent} landing buffer matches the ordinary arc`, () => {
        const h = fixture(dt), p = h.sim.player;
        const held = intent !== 'released' && intent !== 'released on launch';
        h.step({ jumpPressed: true, jump: held, jumpReleased: !held });
        const ordinary = h.arc(held);
        near(ordinary[0][1], (held ? -610 : -305) + 1750 * dt);
        assert.equal(h.starts(), 1);
        h.step({ jumpReleased: true });
        // Approach landing through real motion, without assigning player position or velocity.
        h.step({ jump: true, jumpPressed: true });
        h.step({ jumpReleased: true });
        let queued = false;
        for (let frame = 0; frame < 180; frame++) {
            const gap = 450 - (p.y + p.h);
            if (!p.grounded && p.vy > 0 && gap > 0 && gap <= (p.vy + 1750 * dt) * dt) {
                const releasedBefore = intent === 'released' || intent === 'released then repressed';
                h.step({ jumpPressed: true, jump: !releasedBefore, jumpReleased: releasedBefore });
                queued = true; break;
            }
            h.step();
        }
        assert.equal(queued, true);
        assert.equal(p.grounded, true);
        assert.ok(p.buffer > 0);
        h.step({ jump: held, jumpPressed: intent === 'released then repressed' || intent === 'release/repress on launch',
            jumpReleased: intent === 'release/repress on launch' || intent === 'released on launch' });
        assert.deepEqual(h.arc(held), ordinary, 'The whole buffered arc uses the latest held intent at launch.');
        for (let frame = 0; frame < 30; frame++) h.step({ jump: held });
        assert.equal(h.starts(), 3, 'A buffer executes once, and holding through landing cannot repeat it.');
        assert.equal(p.buffer, 0);
        assert.equal(p.health, 4);
        assert.equal(h.sim.recordEligible, true);
        assert.deepEqual(h.stage, h.initialStage);
    });
}

for (const held of [false, true]) for (const waited of [4, 20]) {
    test(`Delícia coyote after ${waited} steps preserves ${held ? 'held' : 'released'} intent`, () => {
        const h = fixture(1 / 120, 396, true), p = h.sim.player;
        for (let frame = 0; frame < 100 && p.grounded; frame++) h.step({ right: true });
        assert.equal(p.grounded, false);
        for (let frame = 0; frame < waited; frame++) h.step();
        h.step({ jumpPressed: true, jump: held, jumpReleased: !held });
        assert.equal(h.starts(), waited === 4 ? 1 : 0);
        if (waited === 4) near(p.vy, (held ? -610 : -305) + 1750 / 120);
        else assert.ok(p.vy > 0);
    });
}

test('Delícia expired released buffer cannot launch after a long fall', () => {
    const h = fixture(1 / 120, 100);
    h.step({ jumpPressed: true, jumpReleased: true });
    for (let frame = 0; frame < 180 && !h.sim.player.grounded; frame++) h.step();
    assert.equal(h.sim.player.grounded, true);
    for (let frame = 0; frame < 20; frame++) h.step();
    assert.equal(h.starts(), 0);
    assert.equal(h.sim.player.buffer, 0);
    h.step({ jump: true, jumpPressed: true });
    assert.equal(h.starts(), 1);
    near(h.sim.player.vy, -610 + 1750 / 120);
});

test('Delícia release/repress after takeoff keeps the existing edge-based cut', () => {
    const h = fixture();
    h.step({ jump: true, jumpPressed: true });
    const before = h.sim.player.vy;
    h.step({ jump: true, jumpPressed: true, jumpReleased: true });
    near(h.sim.player.vy, before * .5 + 1750 / 120);
    assert.equal(h.starts(), 1);
});

test('Delícia ordinary full and short jump envelopes remain unchanged at the shipping 120 Hz step', () => {
    for (const [hold, height, apex, land] of [[0, 25.3125, 20, 41], [1, 29.05902777777777, 21, 43], [60, 103.78125, 41, 83]]) {
        const h = fixture(); let highest = 0, apexFrame = 0, landingFrame = 0;
        for (let frame = 0; frame < 180; frame++) {
            h.step({ right: true, jump: frame < hold, jumpPressed: frame === 0, jumpReleased: frame === hold });
            const rise = 396 - h.sim.player.y;
            if (rise > highest) { highest = rise; apexFrame = frame + 1; }
            if (h.sim.player.grounded) { landingFrame = frame + 1; break; }
        }
        near(highest, height); assert.equal(apexFrame, apex); assert.equal(landingFrame, land);
    }
});
