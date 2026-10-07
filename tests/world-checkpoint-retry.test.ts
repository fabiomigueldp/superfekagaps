import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldGame } from '../src/adventure/WorldGame';
import { STAGES, stageById } from '../src/adventure/campaign';
import { ProgressStore, parseSave } from '../src/adventure/progress';
import { WorldTutorial } from '../src/adventure/WorldTutorial';
import type { AdventureStage } from '../src/adventure/types';
import type { InputState } from '../src/types';
import { isSolidTile } from '../src/world/tileRules';
import { auditRoute } from './helpers/worldRoutes';

const DT = 1000 / 60;
const idle: InputState = { left: false, right: false, run: false, jump: false, down: false,
    start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
const noop = () => {};
/** Real WorldGame load, checkpoint contact, enemy/hazard update and death/restart.
 * The only position fixture is the short approach before checkpoint activation.
 * No damage, movement, terrain or enemy behavior is mocked. */
function checkpointHarness(stage: AdventureStage, index: number, helmet = false) {
    const game = Object.create(WorldGame.prototype) as any;
    let raw: string | null = null, controls = { ...idle };
    const store = new ProgressStore({ getItem: () => raw, setItem: (_key, value) => { raw = value; } });
    Object.assign(game, { store, tutorial: new WorldTutorial(store),
        input: { reset: () => { controls = { ...idle }; }, setMenuMode: noop, update: noop,
            consumeMute: () => false, consumePause: () => false, getState: () => ({ ...controls }) },
        audio: new Proxy({}, { get: () => noop }), renderer: { advanceClock: noop, addImpact: noop },
        camera: { x: 0, y: 0, shakeTimer: 0 }, state: 'title', time: 0, toastTimer: 0, buttons: [] });
    game.load(stage.id, false, stage);
    if (game.state === 'dialogue') { game.dialogueTime = 10000; game.closeDialogue(); }
    const step = (input: Partial<InputState> = {}) => { controls = { ...idle, ...input }; game.update(DT); };
    const cp = stage.checkpoints[index], player = game.player.data;
    player.position = { x: cp.x * 16 - 24, y: cp.y * 16 - player.height };
    player.velocity = { x: 0, y: 0 }; player.isGrounded = true; player.hasHelmet = helmet;
    for (let frame = 0; frame < 30 && game.checkpoint < index; frame++) step({ right: true });
    assert.equal(game.checkpoint, index, `${stage.id}:${index}: native approach must activate checkpoint`);
    const retry = () => {
        const previous = game.player;
        previous.die('fall');
        for (let frame = 0; frame < 240 && game.player === previous; frame++) step();
        assert.notEqual(game.player, previous, 'The death animation must reach the production restart.');
        assert.deepEqual(game.player.data.position, { x: cp.x * 16, y: cp.y * 16 - game.player.data.height });
        assert.equal(game.player.data.hasHelmet, helmet);
        assert.equal(game.store.save.checkpoint.index, index);
        assert.equal(game.state, 'playing', 'Retries must not replay a finished boss introduction.');
    };
    return { game, store, step, retry, saved: () => parseSave(raw!) };
}

function clearBody(game: any, key: string) {
    const p = game.player.getRect();
    for (let row = Math.floor(p.y / 16); row <= Math.floor((p.y + p.height - .001) / 16); row++)
        for (let col = Math.floor(p.x / 16); col <= Math.floor((p.x + p.width - .001) / 16); col++)
            assert.equal(isSolidTile(game.level.getTile(col, row)), false, `${key}: body intersects ${col},${row}`);
}

test('all 56 World checkpoints support repeated native retries without an immediate death trap', () => {
    let checked = 0;
    for (const stage of STAGES) for (const [index, cp] of stage.checkpoints.entries()) {
        const key = `${stage.id}:${index}`, h = checkpointHarness(stage, index);
        for (let attempt = 0; attempt < 2; attempt++) {
            h.retry(); clearBody(h.game, key);
            const { game } = h, player = game.player;
            // Opening reveal freezes hazards too; protection starts with controls.
            while ((player.data.respawnRevealTimer ?? 0) > 0) {
                assert.equal(game.objects.time, 0, `${key}: hazard clock advances during reveal`);
                assert.equal(player.data.invincibleTimer, 1500, `${key}: protection drains before control`);
                h.step();
            }
            for (let frame = 0; frame < 120; frame++) {
                h.step();
                assert.equal(player.data.isDead, false, `${key}: no two-second reaction window`);
                assert.equal(player.data.position.x, cp.x * 16, `${key}: idle spawn drifts`);
                assert.equal(player.data.position.y + player.data.height, cp.y * 16, `${key}: spawn loses support`);
                assert.equal(player.data.isGrounded, true, `${key}: no solid landing`);
            }
            assert.equal(game.player, player, `${key}: unexpected second restart`);
        }
        checked++;
    }
    assert.equal(checked, 56);
});

test('all campaign checkpoint saves retain identity and helmet on native retry and reload', () => {
    for (const stage of STAGES) for (const [index, cp] of stage.checkpoints.entries()) {
        const h = checkpointHarness(stage, index, true);
        assert.deepEqual(h.saved().checkpoint, { stage: stage.id, index, helmet: true });
        h.game.player.data.hasHelmet = false;
        h.retry();
        h.game.store.save = h.saved();
        h.game.load(stage.id, true, stage);
        clearBody(h.game, `${stage.id}:${index}`);
        assert.equal(h.game.player.data.hasHelmet, true);
        assert.equal(h.game.player.data.position.x, cp.x * 16);
        assert.equal(h.game.player.data.position.y + h.game.player.data.height, cp.y * 16);
    }
});

test('every course checkpoint is reachable and retains a normal-exit route after mechanisms reset', () => {
    // Complementary geometry check only. Dynamic carriers are represented by
    // endpoint/riding edges here; live retry hazards are covered above.
    let checked = 0;
    for (const stage of STAGES.filter(s => !s.encounter)) {
        const fromStart = auditRoute(stage);
        for (const [index, cp] of stage.checkpoints.entries()) {
            const surface = fromStart.surfaces.findIndex(s => cp.x * 16 >= s.x && cp.x * 16 + 14 <= s.x + s.width && Math.abs(s.y - cp.y * 16) < .001);
            assert.ok(surface >= 0 && fromStart.reached.includes(surface), `${stage.id}:${index}: checkpoint unreachable from start`);
            const resumed = structuredClone(stage); resumed.level.playerSpawn = { ...cp };
            assert.ok(auditRoute(resumed).ok, `${stage.id}:${index}: normal exit unreachable from checkpoint`);
            checked++;
        }
    }
    assert.equal(checked, 50);
});

// Pressure Maxima's final checkpoint faces an approaching barrel after several
// seconds. Prove resumed forward play, rather than treating indefinite idling as
// the design contract or moving its flag away from an otherwise fair challenge.
test('3-4 final checkpoint has a clean native route past the pressure cannon to the normal exit', () => {
    const h = checkpointHarness(stageById('3-4')!, 1), { game } = h;
    h.retry();
    const step = (input: Partial<InputState> = {}) => {
        h.step(input);
        assert.equal(game.player.data.isDead, false, `The resumed route cannot rely on a death: x=${game.player.data.position.x/16}, t=${game.objects.time}.`);
        assert.equal(game.player.data.hasHelmet, false, 'No helmet absorbs a mistake.');
    };
    while ((game.player.data.respawnRevealTimer ?? 0) > 0) step();
    // Let the whole protection window expire before attempting the challenge.
    for (let frame = 0; frame < 91; frame++) step();
    assert.equal(game.player.data.invincibleTimer, 0);
    const walk = (tile: number) => {
        for (let frame = 0; frame < 240; frame++) {
            const delta = tile * 16 - game.player.data.position.x;
            if (Math.abs(delta) < 2 && Math.abs(game.player.data.velocity.x) < .25) return;
            step({ left: delta < -1, right: delta > 1 });
        }
        assert.fail(`Walking failed at ${game.player.data.position.x / 16}`);
    };
    const jump = (tile: number, floor: number) => {
        for (let frame = 0; frame < 150; frame++) {
            const delta = tile * 16 - game.player.data.position.x;
            step({ left: delta < -2, right: delta > 2, run: true, jump: frame < 9,
                jumpPressed: frame === 0, jumpReleased: frame === 9 });
            if (frame > 2 && game.player.data.isGrounded) {
                assert.equal(game.player.data.position.y + game.player.data.height, floor * 16, `Jump at x=${game.player.data.position.x/16}, t=${game.objects.time}`);
                return;
            }
        }
        assert.fail(`Jump failed at ${game.player.data.position.x / 16}`);
    };
    walk(141); jump(147, 11); walk(151); jump(160, 11); jump(167, 12); jump(174, 14);
    for (let frame = 0; frame < 240 && game.state === 'playing'; frame++) step({ right: true });
    assert.equal(game.state, 'clear');
    assert.equal(game.clearSecret, false);
});
