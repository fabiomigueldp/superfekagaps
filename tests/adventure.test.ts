import { guairaChapterRoute } from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, stageById } from '../src/adventure/campaign';
import { freshSave, finishStage, isUnlocked, parseSave, ProgressStore, validateStage, SAVE_KEY } from '../src/adventure/progress';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { BossEncounter } from '../src/adventure/BossEncounter';
import { auditRoute } from './helpers/worldRoutes';
import { WorldFoe } from '../src/adventure/WorldEnemies';
import { Player } from '../src/entities/Player';
import type { InputState, Rect } from '../src/types';
const idle: InputState = { left: false, right: false, run: false, jump: false, down: false, start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
test('World authors 30 valid stages, 72 unique seals, six secrets and six encounters', () => {
    assert.equal(STAGES.length, 30);
    assert.equal(new Set(STAGES.map(s => s.id)).size, 30);
    for (const s of STAGES)
        assert.deepEqual(validateStage(s), [], s.id);
    const seals = STAGES.flatMap(s => s.pickups.filter(p => p.kind === 'seal'));
    assert.equal(seals.length, 72);
    assert.equal(new Set(seals.map(s => s.id)).size, 72);
    assert.equal(STAGES.flatMap(s => s.exits).filter(e => e.id === 'secret').length, 6);
    assert.deepEqual(STAGES.flatMap(s => s.encounter ? [s.encounter] : []), ['J1', 'B1', 'C1', 'B2', 'C2', 'J2']);
});
test('normal and secret routes require all six bosses while keeping skipped stages available', () => {
    for (const useSecrets of [false, true]) {
        const save = freshSave();
        assert.equal(isUnlocked('2-1', save), false);
        for (let w = 1; w <= 6; w++) {
            for (let n = 1; n <= 3; n++) {
                const id = `${w}-${n}`;
                assert.ok(isUnlocked(id, save));
                finishStage(save, id, n === 3 && useSecrets ? 'secret' : 'normal', 30);
            }
            assert.ok(isUnlocked(`${w}-4`, save));
            if (!useSecrets) {
                assert.equal(isUnlocked(`${w}-5`, save), false);
                finishStage(save, `${w}-4`, 'normal', 30);
            }
            assert.ok(isUnlocked(`${w}-5`, save));
            if (w < 6)
                assert.equal(isUnlocked(`${w + 1}-1`, save), false);
            finishStage(save, `${w}-5`, 'normal', 60);
            if (w === 3) {
                assert.equal(isUnlocked('4-1', save), false);
                save.guaira.completed = guairaChapterRoute(save.guaira.opening);
            }
        }
        assert.equal(save.completed.length, useSecrets ? 24 : 30);
    }
});
test('save import validates values, preserves unique acquisitions and rejects unknown versions', () => {
    const s = freshSave();
    s.seals = ['1-1:s1', '1-1:s1', 'invalid'];
    s.completed = ['1-1', '90-2'];
    s.times = { '1-1': 12, '1-2': Infinity };
    const parsed = parseSave(JSON.stringify(s));
    assert.deepEqual(parsed.seals, ['1-1:s1']);
    assert.deepEqual(parsed.completed, ['1-1']);
    assert.deepEqual(parsed.times, { '1-1': 12 });
    assert.throws(() => parseSave('{"version":9}'));
});
test('storage failures retain session progress; incompatible saves are not overwritten', () => {
    let writes = 0;
    const store = new ProgressStore({ getItem: () => '{"version":9}', setItem: () => { writes++; } });
    store.collect('1-1:s1');
    assert.equal(writes, 0);
    assert.ok(store.warning);
    const broken = new ProgressStore({ getItem: () => null, setItem: () => { throw Error('full'); } });
    assert.ok(broken.collect('1-1:s2'));
    assert.equal(broken.collect('1-1:s2'), false);
    assert.deepEqual(broken.save.seals, ['1-1:s2']);
    const memory = new Map();
    const working = new ProgressStore({ getItem: k => memory.get(k) ?? null, setItem: (k, v) => { memory.set(k, v); } });
    working.collect('2-1:s1');
    assert.ok(memory.has(SAVE_KEY));
});
test('moving platforms carry a grounded player and allow jumping off without double displacement', () => {
    const level = new WorldLevel(STAGES[0].level);
    const objects = new WorldObjects([{ id: 'p', kind: 'platform', x: 80, y: 180, width: 64, height: 8, to: { x: 180, y: 180 }, period: 4000 }]);
    level.bodies = objects.bodies;
    const player = new Player(6, 180 / 16);
    player.data.isGrounded = true;
    const start = player.data.position.x;
    for (let i = 0; i < 45; i++) {
        const before = player.getRect();
        objects.update(1000 / 60, level, before.x);
        player.data.position = level.transport(before);
        player.update(1000 / 60, idle, level);
    }
    assert.ok(player.data.position.x > start + 20);
    assert.ok(player.data.isGrounded);
    assert.equal(player.data.position.y + player.data.height, 180);
    player.update(1000 / 60, { ...idle, jump: true, jumpPressed: true }, level);
    assert.ok(player.data.velocity.y < 0);
    assert.equal(player.data.isGrounded, false);
});
test('mechanism toggles return to canonical positions and do not mutate authored specs', () => {
    const s = stageById('2-2')!, snapshot = JSON.stringify(s.mechanisms), o = new WorldObjects(s.mechanisms), l = new WorldLevel(s.level);
    assert.ok(o.activate('s1'));
    for (let i = 0; i < 150; i++)
        o.update(1000 / 60, l, 320);
    assert.ok(Math.abs(o.get('l1')!.y - s.mechanisms.find(m => m.id === 'l1')!.to!.y) < 1);
    assert.ok(o.activate('s1'));
    for (let i = 0; i < 150; i++)
        o.update(1000 / 60, l, 320);
    assert.ok(Math.abs(o.get('l1')!.y - 208) < 1);
    assert.equal(JSON.stringify(s.mechanisms), snapshot);
});
test('boss warning locks target and a hit consumes exactly one vulnerability window', () => {
    const b = new BossEncounter('J1'), l = new WorldLevel(stageById('1-5')!.level), o = new WorldObjects([]);
    b.update(1200, { x: 100, y: 200, width: 14, height: 24 }, o, l);
    const target = b.targetX;
    b.update(500, { x: 200, y: 200, width: 14, height: 24 }, o, l);
    assert.equal(b.targetX, target);
    b.phase = 'open';
    const p = { x: b.x + 5, y: b.y - 12, width: 14, height: 24 }, prev = { ...p, y: b.y - 26 };
    assert.equal(b.contact(p, prev, true), 'hit');
    assert.equal(b.health, 2);
    assert.equal(b.contact(p, prev, true), 'none');
});
test('Calabrezzo opens only after a returned barrel reaches his equipment', () => {
    const s = stageById('3-5')!, b = new BossEncounter('C1'), o = new WorldObjects(s.mechanisms), l = new WorldLevel(s.level);
    b.phase = 'attack';
    o.spawnBarrel(b.x - 20, 208, 1, false, true);
    b.update(16, { x: 30, y: 200, width: 14, height: 24 }, o, l);
    assert.equal(b.phase, 'attack');
    o.barrels[0].returned = true;
    b.update(16, { x: 30, y: 200, width: 14, height: 24 }, o, l);
    assert.equal(b.phase, 'open');
});
test('all authored main routes have physical jumping and platform connections to their exits', () => {
    for (const stage of STAGES.filter(s => !s.encounter)) {
        const audit = auditRoute(stage);
        assert.ok(audit.ok, `${stage.id}: disconnected main route; unreachable ${audit.unreachable.map(s => `${s.x / 16},${s.y / 16}`).join(';')}`);
    }
});
test('final João impact on a marked support creates a repeatable attack opening', () => {
    const s = stageById('6-5')!, boss = new BossEncounter('J2'), o = new WorldObjects(s.mechanisms), l = new WorldLevel(s.level), p = { x: 232, y: 200, width: 14, height: 24 };
    boss.update(1200, p, o, l);
    boss.update(1000, p, o, l);
    assert.ok(o.get('right')!.active);
    boss.update(650, p, o, l);
    assert.equal(boss.phase, 'open');
    boss.update(3400, p, o, l);
    assert.equal(boss.phase, 'rest');
});
test('João warning does not leave an invisible active hitbox after the impact', () => {
    const s = stageById('1-5')!, boss = new BossEncounter('J1'), o = new WorldObjects(s.mechanisms), l = new WorldLevel(s.level), p = { x: 100, y: 200, width: 14, height: 24 };
    boss.update(1200, p, o, l);
    boss.update(1000, p, o, l);
    boss.update(100, p, o, l);
    assert.ok(boss.danger);
    boss.update(200, p, o, l);
    assert.equal(boss.danger, null);
});
test('helmet loss changes the enemy response, while a pound defeats armor immediately', () => {
    const e = new WorldFoe({ id: 'worker', kind: 'helmet', x: 100, y: 224 });
    const p = { x: 103, y: e.y - 10, width: 14, height: 24 }, prev = { ...p, y: e.y - 25 };
    assert.equal(e.contact(p, prev, true, false), 'bounce');
    assert.equal(e.armor, false);
    assert.equal(e.phase, 'stunned');
    assert.equal(e.contact(p, prev, true, false), 'kill');
    const other = new WorldFoe(e.spec);
    assert.equal(other.contact(p, prev, true, true), 'kill');
});
test('loader commits to its warned direction and releases only after anticipation', () => {
    const s = stageById('1-5')!, l = new WorldLevel(s.level), o = new WorldObjects([]), e = new WorldFoe({ id: 'loader', kind: 'loader', x: 120, y: 224 });
    const left = { x: 40, y: 200, width: 14, height: 24 }, right = { ...left, x: 170 };
    e.update(1600, l, o, left);
    assert.equal(e.phase, 'warning');
    assert.equal(o.barrels.length, 0);
    e.update(500, l, o, right);
    assert.equal(e.facing, -1);
    assert.equal(o.barrels.length, 0);
    e.update(400, l, o, right);
    assert.equal(o.barrels.length, 1);
    assert.ok(o.barrels[0].vx < 0);
    assert.ok(o.barrels[0].vy < 0);
});
test('charger does not acquire a target on another floor or retarget during warning', () => {
    const s = stageById('1-5')!, l = new WorldLevel(s.level), o = new WorldObjects([]), e = new WorldFoe({ id: 'charger', kind: 'charger', x: 160, y: 224 });
    e.update(16, l, o, { x: 80, y: 40, width: 14, height: 24 });
    assert.equal(e.phase, 'walk');
    e.update(16, l, o, { x: 80, y: 200, width: 14, height: 24 });
    assert.equal(e.phase, 'warning');
    e.update(500, l, o, { x: 240, y: 200, width: 14, height: 24 });
    assert.equal(e.facing, -1);
    for (let i = 0; i < 100; i++)
        e.update(16, l, o, { x: 240, y: 200, width: 14, height: 24 });
    assert.equal(e.phase, 'rest');
});
test('agitator collision includes the blade tips only during its spin', () => {
    const e = new WorldFoe({ id: 'mixer', kind: 'agitator', x: 100, y: 224 }), p = { x: 94, y: 213, width: 4, height: 8 };
    assert.equal(e.contact(p, p, false, false), 'none');
    e.phase = 'attack';
    assert.equal(e.contact(p, p, false, false), 'hurt');
    e.phase = 'rest';
    assert.equal(e.contact(p, p, false, false), 'none');
});
test('João leap commits to its shadow, moves through the air and opens on landing', () => {
    const b = new BossEncounter('J1'), s = stageById('1-5')!, l = new WorldLevel(s.level), o = new WorldObjects([]), p = { x: 160, y: 200, width: 14, height: 24 };
    b.health = 2;
    b.cycle = 1;
    b.update(1200, p, o, l);
    assert.equal(b.pattern, 'leap');
    const target = b.targetX;
    b.update(1000, { ...p, x: 30 }, o, l);
    b.update(300, p, o, l);
    assert.equal(b.targetX, target);
    assert.ok(b.y < 150);
    b.update(650, p, o, l);
    assert.equal(b.phase, 'open');
    assert.equal(b.y, 180);
    assert.equal(b.danger, null);
});
test('Calabrezzo throws from his raised hand before the barrel reaches the conveyor', () => {
    const stage = stageById('3-5')!, boss = new BossEncounter('C1'), o = new WorldObjects(stage.mechanisms), l = new WorldLevel(stage.level), p = { x: 30, y: 200, width: 14, height: 24 };
    boss.update(1200, p, o, l);
    boss.update(900, p, o, l);
    assert.equal(o.barrels.length, 0);
    assert.equal(boss.pose, 'windup');
    boss.update(60, p, o, l);
    assert.equal(boss.released, true);
    assert.equal(boss.pose, 'shoot');
    assert.equal(boss.poseTime, 0);
    assert.ok(o.barrels[0].y < 180 && o.barrels[0].vy < 0);
    assert.equal(boss.impact, false, 'A throw is not an impact at the player target.');
    for (let i = 0; i < 80; i++)
        o.update(1000 / 60, l, p.x);
    assert.ok(o.barrels.some(b => Math.abs(b.y + b.height - 224) < 1));
});
test('encounter lift waits for an opening instead of following the autonomous cable cycle', () => {
    const stage = stageById('3-5')!, boss = new BossEncounter('C1'), o = new WorldObjects(stage.mechanisms), l = new WorldLevel(stage.level), p = { x: 30, y: 200, width: 14, height: 24 };
    for (let i = 0; i < 150; i++)
        o.update(1000 / 60, l, p.x);
    assert.equal(o.get('access')!.y, 208);
    boss.phase = 'attack';
    const barrel = o.spawnBarrel(240, 208, 1, false, true);
    barrel.returned = true;
    boss.update(16, p, o, l);
    assert.equal(boss.phase, 'open');
    for (let i = 0; i < 70; i++)
        o.update(1000 / 60, l, p.x);
    assert.equal(o.get('access')!.y, 160);
    boss.phase = 'hurt';
    boss.update(16, p, o, l);
    assert.equal(o.get('access')!.active, false);
});
test('reinforced ice blocks ordinary barrels and yields to a pressurized one', () => {
    const stage = stageById('5-5')!, o = new WorldObjects(stage.mechanisms), l = new WorldLevel(stage.level), target = o.get('iceLeft')!;
    o.spawnBarrel(target.x - 8, 208, 1, false);
    o.update(16, l, target.x);
    assert.equal(target.active, false);
    assert.equal(o.barrels.length, 0);
    o.spawnBarrel(target.x - 8, 208, 1, true);
    o.update(16, l, target.x);
    assert.equal(target.active, true);
    assert.ok(o.events.some(e => e.kind === 'break'));
});
test('an opening cancels a pending Calabrezzo volley and retry shots get a new windup', () => {
    const stage = stageById('5-5')!, boss = new BossEncounter('C2'), o = new WorldObjects(stage.mechanisms), l = new WorldLevel(stage.level), p = { x: 30, y: 200, width: 14, height: 24 };
    boss.phase = 'attack';
    boss.pattern = 'volley';
    boss.cycle = 1;
    boss.timer = 1195;
    o.get('iceRight')!.active = true;
    boss.update(16, p, o, l);
    assert.equal(boss.phase, 'open');
    assert.equal(o.barrels.length, 0);
    assert.equal(boss.released, false);
    const retry = new BossEncounter('C2');
    retry.phase = 'attack';
    retry.timer = 1850;
    o.get('iceLeft')!.active = false;
    o.get('iceRight')!.active = false;
    retry.update(16, p, o, l);
    assert.equal(retry.pose, 'windup');
    assert.equal(o.barrels.length, 0);
    retry.update(700, p, o, l);
    assert.equal(o.barrels.length, 0);
    retry.update(60, p, o, l);
    assert.equal(o.barrels.length, 1);
    assert.equal(retry.released, true);
});
test('final João shockwave has a warning interval with no active floor hitbox', () => {
    const stage = stageById('6-5')!, boss = new BossEncounter('J2'), o = new WorldObjects(stage.mechanisms), l = new WorldLevel(stage.level), p = { x: 239, y: 200, width: 14, height: 24 };
    boss.health = 2;
    boss.update(600, p, o, l);
    assert.equal(boss.shockWarning, true);
    assert.equal(boss.danger, null);
    assert.equal(boss.pose, 'windup');
    boss.update(60, p, o, l);
    assert.equal(boss.shockWarning, false);
    assert.ok(boss.danger);
    const x = (boss.danger as Rect | null)!.x;
    boss.update(100, p, o, l);
    assert.ok((boss.danger as Rect | null)!.x < x);
    boss.update(800, p, o, l);
    assert.equal(boss.danger, null);
});
test('a launcher waits through its visible warning and keeps its cycle frozen offscreen', () => {
    const stage = stageById('3-2')!, o = new WorldObjects(stage.mechanisms), l = new WorldLevel(stage.level), launcher = o.get('launch39')!;
    o.update(900, l, 3000);
    assert.equal(launcher.timer, 1200);
    assert.equal(o.barrels.length, 0);
    o.update(600, l, launcher.x);
    assert.equal(launcher.timer, 600);
    assert.equal(o.barrels.length, 0);
    assert.ok(o.events.some(e => e.kind === 'warning'));
    o.update(500, l, launcher.x);
    assert.equal(o.barrels.length, 0);
    o.update(110, l, launcher.x);
    assert.equal(o.barrels.length, 1);
});
