import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../src/adventure/campaign';
import { ALL_DELICIA_STAGES } from '../src/adventure/delicia/DeliciaContent';
import { movingFloor } from '../src/adventure/delicia/DeliciaSimulation';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { WorldFoe } from '../src/adventure/WorldEnemies';
import { Player } from '../src/entities/Player';
import { isSolidTile, isOneWayTile } from '../src/world/tileRules';
import { overlaps, type AdventureStage } from '../src/adventure/types';
import type { InputState, Rect } from '../src/types';

const dt = 1000 / 60;
const idle: InputState = { left: false, right: false, run: false, jump: false, jumpPressed: false, jumpReleased: false, down: false, downPressed: false, start: false, pause: false, mute: false };
const carriers = STAGES.flatMap(stage => stage.mechanisms.filter(m => m.to && ['platform', 'lift', 'support', 'swing'].includes(m.kind)).map(spec => ({ stage, spec })));
function solidAt(stage: AdventureStage, x: number, y: number) { return isSolidTile(stage.level.tiles[Math.floor(y / 16)]?.[Math.floor(x / 16)]); }
function solidIntersection(stage: AdventureStage, rect: Rect) {
    for (let y = Math.max(0, Math.floor((rect.y + .001) / 16)); y < Math.min(stage.level.height, Math.ceil((rect.y + rect.height - .001) / 16)); y++)
        for (let x = Math.max(0, Math.floor((rect.x + .001) / 16)); x < Math.min(stage.level.width, Math.ceil((rect.x + rect.width - .001) / 16)); x++)
            if (isSolidTile(stage.level.tiles[y][x])) return `${x},${y}`;
    return null;
}

test('all 36 campaign movers have stable identities, real fixed mounts and clear deck/rider corridors', () => {
    assert.equal(carriers.length, 36);
    assert.equal(carriers.filter(({ spec }) => spec.kind === 'platform').length, 19);
    for (const { stage, spec } of carriers) {
        const key = `${stage.id}:${spec.id}`;
        assert.equal(spec.mounts?.length, 2, key);
        for (const mount of spec.mounts!) {
            if (mount.kind === 'ground') {
                // The entire 12 px equipment foot sits on actual solid top, not a
                // decorative crane, one-way platform, empty gap or buried tile.
                for (const x of [mount.x - 6, mount.x + 5.999]) {
                    assert.ok(solidAt(stage, x, mount.y + .001), `${key}: ungrounded foot`);
                    assert.ok(!solidAt(stage, x, mount.y - .001), `${key}: buried foot`);
                }
            } else for (const x of [mount.x - 3, mount.x + 2.999]) for (const y of [mount.y - 6, mount.y + 5.999])
                assert.ok(solidAt(stage, x, y), `${key}: wall plate outside wall`);
        }
        for (let i = 0; i <= 64; i++) {
            const p = i / 64, x = spec.x + (spec.to!.x - spec.x) * p, y = spec.y + (spec.to!.y - spec.y) * p;
            assert.equal(solidIntersection(stage, { x, y, width: spec.width, height: spec.height }), null, `${key}: deck enters solid terrain at ${p}`);
            assert.equal(solidIntersection(stage, { x, y: y - 24, width: spec.width, height: 24 }), null, `${key}: rider enters solid terrain at ${p}`);
        }
    }
    assert.equal(STAGES.find(s => s.id === '2-1')!.mechanisms.find(m => m.id === 'p1')!.x, 448);
    assert.equal(STAGES.find(s => s.id === '2-3')!.mechanisms.find(m => m.id === 'p2')!.x, 1104);
});

test('all 19 autonomous routes use explicit feasible periods and hold both real terminals', () => {
    for (const { stage, spec } of carriers.filter(({ spec }) => spec.kind === 'platform')) {
        const key = `${stage.id}:${spec.id}`, motion = spec.motion!;
        assert.equal(motion.kind, 'shuttle', key);
        assert.equal(motion.dwellMs, 450, key);
        assert.equal(motion.rampMs, 350, key);
        const length = Math.hypot(spec.to!.x - spec.x, spec.to!.y - spec.y);
        const legMs = spec.period! / 2 - motion.dwellMs;
        assert.ok(length / (legMs - motion.rampMs) * 1000 <= motion.maxSpeed + 1e-7, `${key}: impossible authored speed`);
        const objects = new WorldObjects(stage.mechanisms), level = new WorldLevel(stage.level), body = objects.get(spec.id)!;
        let homeFrames = 0, arrivalFrames = 0;
        for (let i = 0; i < Math.ceil(spec.period! / dt) + 1; i++) {
            objects.update(dt, level, body.x);
            const cross = (body.x - spec.x) * (spec.to!.y - spec.y) - (body.y - spec.y) * (spec.to!.x - spec.x);
            assert.ok(Math.abs(cross) < 1e-6, `${key}: leaves fixed rail`);
            if (Math.hypot(body.x - spec.x, body.y - spec.y) < 1e-6) homeFrames++;
            if (Math.hypot(body.x - spec.to!.x, body.y - spec.to!.y) < 1e-6) arrivalFrames++;
        }
        assert.ok(homeFrames >= 26 && arrivalFrames >= 26, `${key}: terminal stop missing`);
    }
});

interface Surface { x: number; y: number; width: number }
function surfaceAt(stage: AdventureStage, x: number, y: number): Surface {
    const row = Math.round(y / 16), col = Math.round(x / 16); let end = col;
    const type = stage.level.tiles[row][col];
    assert.ok(isSolidTile(type) || isOneWayTile(type), `${stage.id}: missing intended bank`);
    while (end < stage.level.width && stage.level.tiles[row][end] === type) end++;
    return { x, y, width: (end - col) * 16 };
}
// Intended forward banks/catwalks for every non-arena moving route, in world
// pixels. These are physical landing surfaces, not endpoint-only graph edges.
const routes: Record<string, [number, number, number, number]> = {
    '2-1:p1': [272,192,528,224], '2-1:p2': [1024,208,1520,176],
    '2-2:l1': [0,224,464,112], '2-2:l2': [912,192,1248,96], '2-2:l3': [1696,192,2016,128],
    '2-3:p1': [304,176,608,224], '2-3:p2': [864,160,1216,208], '2-3:secretLift': [1456,144,1856,80],
    '2-4:p1': [0,224,560,192], '2-4:p2': [1344,176,1824,160],
    '3-2:crate1': [272,192,752,224], '3-2:crate2': [944,176,1472,224], '3-3:sl': [1584,176,1856,80],
    '4-1:cab1': [0,224,560,176], '4-1:cab2': [1168,208,1664,160],
    '4-2:l1': [0,224,448,112], '4-2:l2': [896,192,1232,80], '4-2:l3': [1680,192,2048,112],
    '4-3:cab1': [0,224,576,160], '4-3:cab2': [1216,208,1760,144], '4-3:sl': [1760,144,2144,80],
    '4-4:p1': [0,224,560,160], '4-4:p2': [1200,208,1760,144],
    '6-1:sup1': [1200,176,1520,144], '6-3:l1': [0,224,448,112], '6-3:sl': [1568,224,1888,128], '6-4:p1': [0,224,560,160],
};

/** Bounded constructive witness search. Uses real moving bodies, actual terrain,
 * player controls and nearby live foes/barrels/jets. A failure means these scripts
 * failed, not a mathematical impossibility proof or a full-stage playthrough. */
function transfer(stage: AdventureStage, id: string, phaseMs: number, bank: Surface, boarding: boolean, run: boolean, reverse = false): boolean {
    for (const offset of [6, 18, 34]) for (const hold of [0, 4, 9, 15, 30]) {
        const objects = new WorldObjects(stage.mechanisms), level = new WorldLevel(stage.level), body = objects.get(id)!;
        const foes = stage.foes.map(f => new WorldFoe(f));
        const terrainOnly = new WorldLevel(stage.level);
        let boardedAt: { x: number; y: number } | null = null;
        if (body.kind !== 'platform') body.active = true;
        const waiting = { x: bank.x + bank.width - 24, y: bank.y - 24, width: 14, height: 24 };
        for (let i = 0; i < Math.round(phaseMs / dt); i++) {
            objects.update(dt, level, waiting.x);
            for (const foe of foes) if (Math.abs(foe.x - waiting.x) <= 500) foe.update(dt, level, objects, waiting);
        }
        level.bodies = objects.bodies;
        const source = boarding ? bank : body;
        const sx = boarding
            ? reverse ? Math.max(source.x, Math.min(source.x + source.width - 14, body.x + body.width + offset)) : Math.min(source.x + source.width - 14, Math.max(source.x, body.x - offset - 14))
            : reverse ? source.x + offset : source.x + source.width - offset - 14;
        const player = new Player(sx / 16, source.y / 16); player.data.isGrounded = true;
        let damaged = false;
        for (let i = 0; i < 150; i++) {
            const previous = player.getRect(), beforeV = player.data.velocity.y;
            objects.update(dt, level, previous.x);
            if (player.data.isGrounded) player.data.position = level.transport(previous);
            const target = boarding ? body : bank;
            // Some cargo decks deliberately arrive above a broad bank. Walk
            // beyond the deck rather than steering back onto its held top.
            const tx = boarding ? target.x + (reverse ? 8 : target.width / 2 - 7) : reverse
                ? Math.max(target.x + 6, Math.min(target.x + target.width - 24, (body.home?.x ?? body.x) - 24))
                : Math.min(target.x + target.width - 20, Math.max(target.x + 10, (body.to?.x ?? body.x) + body.width + 8));
            const dx = tx - player.data.position.x, brake = Math.abs(dx) < 5;
            player.update(dt, boardedAt ? idle : { ...idle, run, right: brake ? player.data.velocity.x < -.5 : dx > 0, left: brake ? player.data.velocity.x > .5 : dx < 0,
                jump: i < hold, jumpPressed: i === 0 && hold > 0, jumpReleased: i === hold && hold > 0 }, level);
            const p = player.getRect();
            if (level.checkSpikeCollision(p) || level.checkLavaCollision(p)) damaged = true;
            for (const b of objects.bodies) if (b.kind === 'jet') { const hazard = objects.jetDanger(b); if (hazard && overlaps(p, hazard)) damaged = true; }
            if (objects.barrels.some(b => b.life > 0 && overlaps(p, b))) damaged = true;
            for (const foe of foes) {
                if (Math.abs(foe.x - p.x) > 500) continue;
                foe.update(dt, level, objects, p);
                const contact = foe.contact(p, previous, player.data.velocity.y > 0 || beforeV > 0, false);
                if (contact === 'hurt') damaged = true;
                // A transfer witness doesn't require fighting its destination's
                // enemy. Count only a clean landing before any enemy contact.
                if (contact === 'kill' || contact === 'bounce') damaged = true;
            }
            if (damaged || player.data.isDead || p.y > 368) break;
            if (i > 1 && player.data.isGrounded && Math.abs(p.y + p.height - target.y) < .1 && p.x + p.width > target.x + 2 && p.x < target.x + target.width - 2) {
                if (!boarding) return true;
                // At shared-height one-way docks, touching the deck rectangle
                // alone does not prove that the carrier supports the player.
                const staticContact = terrainOnly.resolveCollision(p, { x: 0, y: 1 }, p);
                const onStatic = staticContact.grounded && Math.abs(staticContact.position.y - p.y) < 1.001;
                if (!onStatic) {
                    boardedAt ??= { x: body.x, y: body.y };
                    if (!body.motion || Math.hypot(body.x - boardedAt.x, body.y - boardedAt.y) >= 8) return true;
                }
            } else if (boardedAt) break;
        }
    }
    return false;
}

test('every non-arena carrier supports timed walk/run boarding and clean destination landings', () => {
    assert.equal(Object.keys(routes).length, carriers.filter(({ stage }) => !stage.encounter).length);
    for (const { stage, spec } of carriers.filter(({ stage }) => !stage.encounter)) {
        const key = `${stage.id}:${spec.id}`, [hx, hy, ex, ey] = routes[key];
        const home = surfaceAt(stage, hx, hy), end = surfaceAt(stage, ex, ey);
        const arrival = spec.motion ? spec.period! / 2 : Math.hypot(spec.to!.x - spec.x, spec.to!.y - spec.y) / .055 + dt;
        for (const run of [false, true]) {
            assert.ok(transfer(stage, spec.id, 0, home, true, run), `${key}: initial ${run ? 'run' : 'walk'} boarding`);
            assert.ok(transfer(stage, spec.id, arrival, end, false, run), `${key}: ${run ? 'run' : 'walk'} destination landing`);
            if (spec.motion) {
                // Late arrival at the stop and an entire missed departure both
                // retain a real boarding window on the next visit.
                assert.ok(transfer(stage, spec.id, spec.period! + 225, home, true, run), `${key}: delayed next-cycle boarding`);
                assert.ok(transfer(stage, spec.id, arrival + 225, end, true, run, true), `${key}: return-trip boarding`);
                assert.ok(transfer(stage, spec.id, spec.period!, home, false, run, true), `${key}: return-trip landing`);
            }
        }
    }
});

test('checkpoint reconstruction resets every mover to its authored home without mutating stage data', () => {
    for (const stage of STAGES.filter(s => s.mechanisms.some(m => m.to))) {
        const snapshot = JSON.stringify(stage), objects = new WorldObjects(stage.mechanisms), level = new WorldLevel(stage.level);
        for (const b of objects.bodies) if (b.to && b.kind !== 'platform') b.active = true;
        for (let i = 0; i < 180; i++) objects.update(dt, level, stage.level.playerSpawn.x * 16);
        for (const checkpoint of stage.checkpoints) {
            const rebuilt = new WorldObjects(stage.mechanisms);
            const player = new Player(checkpoint.x, checkpoint.y);
            assert.ok(Number.isFinite(player.getRect().y));
            for (const spec of stage.mechanisms.filter(m => m.to)) {
                const body = rebuilt.get(spec.id)!;
                assert.deepEqual(body.home, { x: spec.x, y: spec.y });
                assert.equal(body.x, spec.x); assert.equal(body.y, spec.y); assert.equal(body.active, false);
            }
        }
        assert.equal(JSON.stringify(stage), snapshot, `${stage.id}: mutated checkpoint source`);
    }
});

test('separate Delícia engine inventories all 37 movers without inheriting World route changes', () => {
    const uses = ALL_DELICIA_STAGES.flatMap(stage => stage.floors.filter(f => f.kind === 'moving' || f.kind === 'lift').map(floor => ({ stage, floor })));
    assert.equal(uses.length, 37); assert.equal(uses.filter(({ floor }) => floor.kind === 'moving').length, 28);
    for (const { stage, floor } of uses) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (let i = 0; i < 120; i++) {
            const time = (2 * Math.PI * i / 120 - (floor.phase ?? 0)) / (floor.speed ?? 1.6), box = movingFloor(floor, time);
            minX = Math.min(minX, box.x); maxX = Math.max(maxX, box.x); minY = Math.min(minY, box.y); maxY = Math.max(maxY, box.y);
            for (const ground of stage.floors.filter(f => f.h > 50)) {
                const body = { x: box.x, y: box.y - 54, width: box.w, height: 54 + box.h };
                assert.equal(overlaps(body, { x: ground.x, y: ground.y, width: ground.w, height: ground.h }), false, `${stage.id}: Delícia route enters bank`);
            }
        }
        const travel = floor.travel ?? 60;
        assert.ok(Math.abs((floor.kind === 'moving' ? maxX - minX : maxY - minY) - travel) < 1e-6);
    }
});
