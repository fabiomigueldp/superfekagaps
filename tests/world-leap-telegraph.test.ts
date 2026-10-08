import assert from 'node:assert/strict';
import test from 'node:test';
import { BossEncounter } from '../src/adventure/BossEncounter';
import { WorldArt } from '../src/adventure/WorldArt';
import { WorldGame } from '../src/adventure/WorldGame';
import { stageById } from '../src/adventure/campaign';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { guairaBrowser } from './helpers/guairaLabHarness';

type Mark = { x: number; y: number; width: number; height: number; color: string };
function marks(boss: BossEncounter, cx = 0, cy = 0) {
    const art = new WorldArt(), calls: Mark[] = [];
    art.atlas.draw = () => {};
    const context = { fillStyle: '', save() {}, restore() {},
        fillRect(this: { fillStyle: string }, x: number, y: number, width: number, height: number) {
            calls.push({ x, y, width, height, color: this.fillStyle });
        }
    } as unknown as CanvasRenderingContext2D;
    const before = structuredClone(boss);
    art.boss(context, boss, cx, cy, 100);
    assert.deepEqual(structuredClone(boss), before, 'Rendering must not change the encounter.');
    return calls.filter(call => call.y === Math.round(222 - cy) && call.height === 2);
}

for (const target of [110, 160, 262]) test(`leap warning and airborne shadow cover the actual landing at ${target}`, () => {
    const boss = new BossEncounter('J1'), stage = stageById('1-5')!;
    const level = new WorldLevel(stage.level), objects = new WorldObjects(stage.mechanisms);
    const player = { x: target - 7, y: 200, width: 14, height: 24 };
    boss.health = 2; boss.cycle = 1;
    boss.update(1101, player, objects, level);
    assert.equal(boss.pattern, 'leap'); assert.equal(boss.targetX, target);
    const warning = marks(boss, 17, 19);
    boss.update(951, player, objects, level);
    const airborne = marks(boss, 17, 19);
    boss.update(650, player, objects, level);
    const danger = boss.danger!;
    assert.deepEqual(danger, { x: target - 28, y: 211, width: 56, height: 13 });
    for (const [phase, lines] of [['warning', warning], ['airborne', airborne]] as const) {
        assert.ok(lines.length > 0);
        for (const line of lines) assert.deepEqual([line.x, line.width], [danger.x - 17, danger.width], `${phase} must show the whole landing width`);
    }
    assert.deepEqual(marks(boss, 17, 19), marks(boss, 17, 19), 'Paused redraws remain stable.');
});

for (const reducedMotion of [false, true]) test(`real leap damage stays inside its preceding tell (${reducedMotion ? 'reduced' : 'normal'} motion)`, t => {
    const h = guairaBrowser(t, { reducedMotion });
    const game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
    game.store.save.seen.push('intro:1-5'); game.load('1-5');
    t.mock.method(game.audio, 'say', () => {});
    const boss = game.boss!, tick = 1000 / 60;
    boss.health = 2; boss.cycle = 1; boss.timer = 1100;
    game.player.data.position = { x: 153, y: 200 };
    game.player.data.velocity = { x: 0, y: 0 }; game.player.data.isGrounded = true;
    game.update(tick);
    const tell = marks(boss).find(mark => mark.color === '#eabd7f')!;
    // This full player box was outside both old tells (135..185 and 138..182),
    // but the existing landing hitbox extends to 132. Keep that gameplay intact.
    game.player.data.position = { x: 120, y: 200 };
    game.player.data.velocity = { x: 0, y: 0 };
    game.player.data.hasHelmet = true;
    assert.ok(game.player.getRect().x + game.player.getRect().width > tell.x);
    for (let frame = 0; frame < 112; frame++) game.update(tick);
    assert.equal(game.player.data.hasHelmet, false, 'Production landing still consumes protection.');
    assert.equal(boss.phase, 'attack');
});

test('other boss patterns retain their existing warning dimensions', () => {
    for (const [id, pattern] of [['J1', 'gap'], ['J2', 'structure'], ['B1', 'cargo'], ['B1', 'doubleCargo'], ['B2', 'sweep']] as const) {
        const boss = new BossEncounter(id); boss.phase = 'warning'; boss.pattern = pattern; boss.targetX = 160;
        const line = marks(boss).find(mark => mark.color === '#ffdb8c')!;
        assert.deepEqual([line.x, line.width], [135, 50], `${id} ${pattern}`);
    }
});
