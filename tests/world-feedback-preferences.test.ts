import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { WorldGame } from '../src/adventure/WorldGame';
import { STAGES } from '../src/adventure/campaign';
import { COYOTE_TIME, GRAVITY, PLAYER_JUMP_FORCE, TileType } from '../src/constants';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

const DT = 1000 / 60;
function harness(t: TestContext) {
    const h = sceneLifecycleBrowser(t), game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
    const effects: string[] = [];
    t.mock.method(game.audio, 'sfx', (effect: Parameters<typeof game.audio.sfx>[0]) => { effects.push(effect); });
    t.after(() => game.dispose());
    return { ...h, game, effects, jumps: () => effects.filter(effect => effect === 'jump').length,
        step: () => game.update(DT) };
}

for (const released of [false, true]) test(`World 5-3 ${released ? 'released' : 'held'} landing buffer sounds exactly once per launch`, t => {
    const h = harness(t), { game } = h;
    game.load('5-3', false);
    const cp = game.stage.checkpoints[0];
    game.player.reset(cp.x, cp.y);
    h.step();
    assert.equal(game.player.data.isGrounded, true);
    const floor = game.player.getFeetPosition().y;
    h.key('keydown', ' '); h.step();
    assert.equal(h.jumps(), 1);
    h.key('keyup', ' '); h.step();
    let buffered = false;
    for (let frame = 0; frame < 120; frame++) {
        const p = game.player.data, gap = floor - game.player.getFeetPosition().y;
        if (!p.isGrounded && p.velocity.y > 0 && gap > 0 && gap <= p.velocity.y + GRAVITY) {
            h.key('keydown', ' ');
            if (released) h.key('keyup', ' ');
            h.step(); buffered = true; break;
        }
        h.step();
    }
    assert.equal(buffered, true);
    assert.equal(game.player.data.isGrounded, true);
    assert.equal(h.jumps(), 1, 'The airborne buffered press is not a launch.');
    h.step();
    assert.equal(game.input.getState().jumpPressed, false);
    assert.equal(game.player.data.velocity.y, PLAYER_JUMP_FORCE * (released ? .5 : 1) + GRAVITY);
    assert.equal(h.jumps(), 2, 'The later launch must sound without a fresh input edge.');
    for (let frame = 0; frame < 120; frame++) h.step();
    assert.equal(game.player.data.isDead, false);
    assert.equal(game.player.data.isGrounded, true);
    assert.equal(h.jumps(), 2, 'Holding or landing again cannot repeat the cue.');
});

function fixture(t: TestContext, spring = false) {
    const h = harness(t), stage = structuredClone(STAGES[0]);
    stage.level.width = 60; stage.level.height = 60;
    stage.level.originX = 0; stage.level.originY = 0;
    stage.level.tiles = Array.from({ length: 60 }, (_, y) => Array.from({ length: 60 }, (_, x) =>
        y >= 20 && (spring || x < 6) ? (spring && y === 20 ? TileType.SPRING : TileType.GROUND) : TileType.EMPTY));
    stage.level.playerSpawn = { x: 5, y: spring ? 19 : 20 };
    stage.level.enemies = []; stage.level.collectibles = []; stage.level.triggers = [];
    stage.mechanisms = []; stage.foes = []; stage.pickups = []; stage.exits = []; stage.checkpoints = []; stage.dialogues = [];
    h.game.load(stage.id, false, stage);
    return h;
}

for (const wait of [3, 8]) test(`World coyote jump audio after ${wait} airborne steps follows the real launch`, t => {
    const h = fixture(t), p = h.game.player.data;
    h.step(); h.key('keydown', 'd');
    for (let frame = 0; frame < 60 && p.isGrounded; frame++) h.step();
    assert.equal(p.isGrounded, false);
    assert.equal(p.coyoteTimer, COYOTE_TIME);
    h.key('keyup', 'd');
    for (let frame = 0; frame < wait; frame++) h.step();
    h.key('keydown', ' '); h.step();
    const expected = (wait + 1) * DT < COYOTE_TIME ? 1 : 0;
    assert.equal(h.jumps(), expected);
    if (expected) assert.ok(p.velocity.y < 0);
    else assert.ok(p.velocity.y > 0);
    for (let frame = 0; frame < 5; frame++) h.step();
    assert.equal(h.jumps(), expected);
});

test('World spring bounce with an airborne jump press does not play a jump cue', t => {
    const h = fixture(t, true), p = h.game.player.data;
    for (let frame = 0; frame < 60; frame++) {
        const gap = 320 - h.game.player.getFeetPosition().y;
        if (p.velocity.y > 0 && gap > 0 && gap <= p.velocity.y + GRAVITY) {
            h.key('keydown', ' '); h.step();
            assert.ok(p.velocity.y < 0, 'The actual spring collision launches the player.');
            assert.equal(h.jumps(), 0);
            for (let i = 0; i < 5; i++) h.step();
            assert.equal(h.jumps(), 0);
            return;
        }
        h.step();
    }
    assert.fail('Reach the spring through native falling physics.');
});

for (const savedShake of [false, true]) test(`World camera shake respects live reduced motion with saved shake ${savedShake}`, t => {
    const h = harness(t), { game } = h;
    h.media.matches = true;
    game.load('1-1', false);
    game.store.save.preferences.shake = savedShake;
    const preferences = structuredClone(game.store.save.preferences);
    game.camera.x = 80; game.camera.shakeTimer = 130;
    const xs: number[] = [];
    const drawPlayer = game.renderer.drawPlayer.bind(game.renderer);
    t.mock.method(game.renderer, 'drawPlayer', (player: Parameters<typeof drawPlayer>[0], view: Parameters<typeof drawPlayer>[1]) => { xs.push(view.x); drawPlayer(player, view); });
    for (const reduced of [true, false, true, false]) {
        h.media.matches = reduced;
        h.media.dispatch('change', { matches: reduced });
        xs.length = 0;
        game.time = 0; game.render(); game.time = 40; game.render();
        assert.deepEqual(xs, savedShake && !reduced ? [79, 81] : [80, 80]);
        assert.deepEqual(game.store.save.preferences, preferences, 'System preference changes cannot rewrite saved choices.');
    }
    game.camera.shakeTimer = 0;
    xs.length = 0; game.render();
    assert.deepEqual(xs, [80]);
});
