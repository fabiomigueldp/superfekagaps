import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldGame } from '../src/adventure/WorldGame';
import { stageById } from '../src/adventure/campaign';
import { ProgressStore } from '../src/adventure/progress';
import { WorldTutorial } from '../src/adventure/WorldTutorial';
import { TileType } from '../src/constants';
import type { AdventureStage } from '../src/adventure/types';

const dt = 1000 / 60, noop = () => {};
const idle = { left: false, right: false, run: false, jump: false, down: false, start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
/** Local basin arrival, real production update including foes, carriers and pickup.
 * No invulnerability, teleport between steps, disabled machines or forged seal. */
function basin(stage: AdventureStage, phase: number) {
    const game = Object.create(WorldGame.prototype) as any;
    const store = new ProgressStore({ getItem: () => null, setItem: noop });
    let input = { ...idle };
    Object.assign(game, { store, tutorial: new WorldTutorial(store),
        input: { reset: noop, setMenuMode: noop, update: noop, consumeMute: () => false, consumePause: () => false, getState: () => ({ ...input }) },
        audio: new Proxy({}, { get: () => noop }), renderer: { advanceClock: noop, addImpact: noop },
        camera: { x: 0, y: 0, shakeTimer: 0 }, state: 'title', time: 0, toastTimer: 0, buttons: [] });
    game.load(stage.id, false, stage); game.spoken = new Set(stage.dialogues.map(d => d.id));
    const seal = stage.pickups.find(p => p.id === `${stage.id}:s2`)!;
    game.player.data.position = { x: seal.x - 24, y: 336 - game.player.data.height };
    game.player.data.isGrounded = true; game.player.data.respawnRevealTimer = 0;
    game.objects.time = phase; game.objects.update(0, game.level, game.player.data.position.x);
    const feet = () => game.player.getFeetPosition().y;
    const step = (next: Partial<typeof idle>) => {
        input = { ...idle, ...next }; game.update(dt);
        assert.equal(game.state, 'playing');
        assert.equal(game.player.data.isDead, false);
        assert.equal(game.player.data.invincibleTimer, 0, 'The optional return does not require damage.');
    };
    const steer = (x: number) => ({ right: game.player.data.position.x < x - 1, left: game.player.data.position.x > x + 1 });
    const walk = (x: number) => {
        for (let i = 0; i < 200; i++) {
            step(steer(x));
            if (Math.abs(game.player.data.position.x - x) < 2 && Math.abs(game.player.data.velocity.x) < .5) return;
        }
        assert.fail('Walking approach did not settle.');
    };
    const jump = (x: number, floor: number, hold = 9) => {
        assert.equal(game.player.data.isGrounded, true, 'No coyote launch is needed.');
        for (let i = 0; i < 100; i++) {
            step({ ...steer(x), jump: i < hold, jumpPressed: i === 0, jumpReleased: i === hold });
            if (i > hold && game.player.data.isGrounded && feet() <= floor + .01 && Math.abs(game.player.data.position.x - x) < 8) return true;
            if (i > hold && game.player.data.isGrounded && feet() > floor + .01) return false;
        }
        return false;
    };
    return { game, seal, step, walk, jump, feet };
}
function historical(stage: AdventureStage) {
    const old = structuredClone(stage);
    for (let x = 107; x <= 109; x++) old.level.tiles[13][x] = TileType.EMPTY;
    return old;
}
for (const id of ['4-3', '4-4']) {
    test(`${id}: only the three-tile intermediate return ledge changes`, () => {
        const stage = stageById(id)!;
        for (let x = 107; x <= 109; x++) assert.equal(stage.level.tiles[13][x], TileType.PLATFORM);
        for (let x = 106; x <= 109; x++) assert.equal(stage.level.tiles[17][x], TileType.PLATFORM);
        assert.deepEqual(stage.pickups.find(p => p.id === `${id}:s2`), { id: `${id}:s2`, kind: 'seal', x: (id === '4-3' ? 99 : 100) * 16, y: 304 });
    });
    test(`${id}: the return ledge stays below the entire cabin and rider sweep`, () => {
        const stage = stageById(id)!, body = stage.mechanisms.find(m => m.id === (id === '4-3' ? 'cab2' : 'p2'))!;
        assert.equal(stage.level.tiles.flat().includes(TileType.SPRING), false, 'There is no hidden spring exit in this basin.');
        let minimumGap = Infinity;
        for (let i = 0; i <= 2048; i++) {
            const t = i / 2048, x = body.x + (body.to!.x - body.x) * t, y = body.y + (body.to!.y - body.y) * t;
            // Includes one-way tiles: a solid-only clearance check would miss this.
            if (x + body.width > 1712 && x < 1760) {
                assert.ok(y + body.height < 208);
                assert.ok(y - 24 < 208, 'The entire rider volume is above the ledge too.');
                minimumGap = Math.min(minimumGap, 208 - y - body.height);
            }
        }
        assert.ok(minimumGap > 56, `Smallest deck-to-ledge clearance: ${minimumGap}`);
    });
    test(`${id}: the historical ordinary staircase attempt cannot reach the upper bank`, () => {
        const h = basin(historical(stageById(id)!), 0);
        h.walk(1664); assert.ok(h.game.store.save.seals.includes(h.seal.id));
        assert.equal(h.jump(1712, 272), true);
        assert.equal(h.jump(1732, 208), false, 'The old layout has no middle step; this does not prove all timed-cabin returns impossible.');
    });
    test(`${id}: a historical timed coyote return really sustains contact and exits the cabin`, () => {
        const h = basin(historical(stageById(id)!), id === '4-3' ? 1300 : 1340);
        // A legitimate 12-frame runup reaches the partly overhanging takeoff;
        // it is not a teleported full-speed launch. This is a local return-step fixture.
        h.game.player.data.position = { x: 1709.3, y: 272 - h.game.player.data.height };
        for (let i = 0; i < 12 + (id === '4-3' ? 2 : 3); i++) h.step({ left: true, run: true });
        assert.equal(h.game.player.data.isGrounded, false, 'This old return requires the off-edge grace period.');
        assert.ok(h.game.player.data.coyoteTimer > 0);
        const body = h.game.objects.get(id === '4-3' ? 'cab2' : 'p2');
        let boarded = false;
        for (let i = 0; i < 80; i++) {
            const dx = body.x + body.width / 2 - 7 - h.game.player.data.position.x;
            h.step({ left: dx < 0, right: dx > 0, run: true, jump: true, jumpPressed: i === 0 });
            if (i > 2 && h.game.player.data.isGrounded && Math.abs(h.feet() - body.y) < .01) { boarded = true; break; }
        }
        assert.equal(boarded, true, 'The old basin is difficult, not mathematically inescapable.');
        for (let i = 0; i < 240 && body.x < body.to.x - .01; i++) {
            h.step({}); assert.equal(h.game.player.data.isGrounded, true); assert.ok(Math.abs(h.feet() - body.y) < .01);
        }
        assert.ok(Math.abs(body.x - body.to.x) < .01);
        h.walk(1792); assert.equal(h.feet(), 144);
    });
    for (const phase of [0, 450, 900, 1350, 1800, 2250, 2700, 3150, 3600, 4050, 4500, 4950, 5400, 5850, 6300, 6750, 7200, 7650, 8100, 8550]) for (const offset of [-8, 0, 8]) {
        test(`${id}: seal + ordinary return at carrier phase ${phase} ms, approach offset ${offset} px`, () => {
            for (const hold of [9, 10, 11]) {
                const h = basin(stageById(id)!, phase);
                h.walk(1664 + offset); assert.ok(h.game.store.save.seals.includes(h.seal.id));
                assert.equal(h.jump(1712 + offset / 2, 272, hold), true, 'Existing lower step.');
                assert.equal(h.jump(1732 + offset / 2, 208, hold), true, 'Added middle ledge or passing carrier.');
                assert.equal(h.jump(1792, 144, hold), true, 'Return to original main bank.');
                assert.ok(h.game.player.data.position.x >= 1760);
                assert.equal(h.feet(), 144);
                for (let i = 0; i < 30; i++) h.step({});
                assert.equal(h.feet(), 144, 'The return remains grounded after landing.');
            }
        });
    }
}
