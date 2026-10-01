import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldGame } from '../src/adventure/WorldGame';
import { ProgressStore, freshSave, parseSave, SAVE_KEY } from '../src/adventure/progress';
import { WorldTutorial } from '../src/adventure/WorldTutorial';
import { stageById } from '../src/adventure/campaign';

const idle = { left:false, right:false, run:false, jump:false, down:false, start:false, pause:false,
    mute:false, jumpPressed:false, jumpReleased:false, downPressed:false };
const noop = () => {};
function storage(raw: string | null = null) {
    return { getItem: (_key: string) => raw, setItem: (_key: string, value: string) => { raw = value; } };
}
function harness(memory = storage(), id = '1-1', resume = false) {
    const game = Object.create(WorldGame.prototype) as any;
    const store = new ProgressStore(memory);
    Object.assign(game, { store, tutorial: new WorldTutorial(store),
        input: { reset:noop, setMenuMode:noop, update:noop, consumeMute:()=>false, consumePause:()=>false, getState:()=>idle },
        audio: new Proxy({}, { get:()=>noop }), renderer: { advanceClock:noop, addImpact:noop },
        camera: { x:0, y:0, shakeTimer:0 }, state:'title', time:0, toastTimer:0, buttons:[] });
    game.load(id, resume, { ...stageById(id)!, dialogues:[], foes:[] });
    return game;
}
function pickup(game: any, kind = 'coin') {
    const item = game.stage.pickups.find((p: any) => p.kind === kind)!;
    game.player.data.position = { x:item.x, y:item.y };
    game.player.data.velocity = { x:0, y:0 };
    game.player.data.respawnRevealTimer = 0;
    game.update(1000/60);
    return item.id;
}
function checkpoint(game: any) {
    game.checkpoint = 0;
    game.store.save.checkpoint = { stage:game.stage.id, index:0, helmet:false };
    game.store.persist();
}

test('retry preserves unique coin IDs and clock; equipment remains available and seals stay permanent', () => {
    const game = harness();
    const coin = pickup(game);
    const seal = pickup(game, 'seal');
    pickup(game, 'helmet');
    checkpoint(game);
    game.elapsed = 80;
    for (let retry = 0; retry < 3; retry++) {
        game.restart();
        assert.equal(game.elapsed, 80 + retry / 60);
        assert.equal(game.coins, 1);
        assert.equal(game.collected.has(coin), true);
        assert.equal(game.collected.has(game.stage.pickups.find((p: any) => p.kind === 'helmet').id), false);
        pickup(game);
        assert.equal(game.coins, 1);
    }
    assert.deepEqual(game.store.save.seals, [seal]);
    game.elapsed = 84;
    game.complete(false);
    assert.equal(game.store.save.times['1-1'], 84);
});

test('real death and respawn cannot award the same coin twice', () => {
    const game = harness();
    pickup(game);
    const original = game.player;
    game.player.die('fall');
    for (let frame = 0; frame < 240 && game.player === original; frame++) game.update(1000/60);
    assert.notEqual(game.player, original);
    pickup(game);
    assert.equal(game.coins, 1);
});

test('map checkpoint reentry cannot record only the last segment, and fresh start restores eligibility', () => {
    const game = harness();
    pickup(game);
    checkpoint(game);
    game.elapsed = 80;
    game.store.save.times['1-1'] = 70;
    game.toMap();
    game.load('1-1', true);
    assert.equal(game.coins, 0, 'A checkpoint resume starts a new, coherent coin tally');
    pickup(game);
    assert.equal(game.coins, 1);
    game.restart();
    pickup(game);
    assert.equal(game.coins, 1);
    game.elapsed = 4;
    game.complete(false);
    assert.equal(game.store.save.times['1-1'], 70);
    assert.ok(game.store.save.completed.includes('1-1'));
    game.load('1-1');
    assert.equal(game.coins, 0);
    assert.equal(game.elapsed, 0);
    game.elapsed = 60;
    game.complete(false);
    assert.equal(game.store.save.times['1-1'], 60);
});

test('old exported checkpoints and reload preserve existing records and secret completion semantics', () => {
    const save = freshSave();
    save.checkpoint = { stage:'1-3', index:0, helmet:true };
    save.times['1-1'] = 45;
    save.seals = ['1-3:s1'];
    const memory = storage(JSON.stringify(save));
    const game = harness(memory, '1-3', true);
    assert.equal(game.player.data.hasHelmet, true);
    game.elapsed = 4;
    game.restart();
    game.complete(true);
    assert.equal(game.store.save.times['1-3'], undefined);
    assert.equal(game.store.save.times['1-1'], 45);
    assert.deepEqual(game.store.save.seals, ['1-3:s1']);
    assert.deepEqual(game.store.save.secrets, ['1-3']);
    assert.deepEqual(game.store.save.completed, ['1-3']);
    const reloaded = parseSave(memory.getItem(SAVE_KEY)!);
    assert.equal(reloaded.checkpoint, null);
    game.toMap();
    game.load('1-3');
    game.elapsed = 40;
    game.complete(true);
    game.load('1-3');
    game.elapsed = 50;
    game.complete(true);
    assert.deepEqual(game.store.save.secrets, ['1-3']);
    assert.deepEqual(game.store.save.completed, ['1-3']);
    assert.equal(game.store.save.times['1-3'], 40);
});

test('resume without an applicable checkpoint is a full fresh run', () => {
    const game = harness();
    game.store.save.checkpoint = { stage:'1-1', index:19, helmet:false };
    game.load('1-1', true);
    game.elapsed = 10;
    game.complete(false);
    assert.equal(game.store.save.times['1-1'], 10);
});

test('custom editor preview fresh loads reset only run accounting, retaining persistent seals', () => {
    const game = harness();
    pickup(game);
    const seal = pickup(game, 'seal');
    checkpoint(game);
    game.load('1-1', true);
    const custom = { ...stageById('1-1')!, dialogues:[], foes:[], name:'Preview QA' };
    game.load(custom.id, false, custom);
    assert.equal(game.stage, custom);
    assert.equal(game.coins, 0);
    assert.equal(game.elapsed, 0);
    assert.equal(game.store.save.checkpoint, null);
    assert.deepEqual(game.store.save.seals, [seal]);
    game.elapsed = 30;
    game.complete(false);
    assert.equal(game.store.save.times['1-1'], 30);
});
