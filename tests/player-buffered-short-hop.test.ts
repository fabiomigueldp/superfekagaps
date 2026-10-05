import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { GuairaTraversal } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { GuairaJunction } from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import { COYOTE_TIME, GRAVITY, JUMP_BUFFER_TIME, PLAYER_JUMP_FORCE, TileType } from '../src/constants';
import { Input } from '../src/engine/Input';
import { Player } from '../src/entities/Player';
import { Level } from '../src/world/Level';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

const DT = 1000 / 60;

function physics(t: TestContext, spawnY = 20, cliff = false) {
    const h = sceneLifecycleBrowser(t), input = new Input(h.canvas as unknown as HTMLCanvasElement);
    const player = new Player(5, spawnY);
    const level = new Level({ id: 'jump-bounds', name: 'Jump bounds', width: 60, height: 60,
        tiles: Array.from({ length: 60 }, (_, y) => Array.from({ length: 60 }, (_, x) => y >= 20 && (!cliff || x < 6) ? TileType.GROUND : TileType.EMPTY)),
        playerSpawn: { x: 5, y: spawnY }, enemies: [], collectibles: [], triggers: [], checkpoints: [],
        goalPosition: { x: 58, y: 20 }, timeLimit: 180, isBossLevel: false });
    t.after(() => input.dispose());
    return { ...h, player, input, step() { input.update(); return player.update(DT, input.getState(), level); } };
}

for (const Scene of [GuairaTraversal, GuairaJunction]) {
    for (const control of ['keyboard', 'canvas touch', 'action source'] as const) {
        for (const intent of ['released', 'held', 'released then repressed', 'release/repress on launch'] as const) {
            test(`${Scene.name}: ${intent} ${control} landing buffer keeps the matching ordinary arc`, t => {
                const h = sceneLifecycleBrowser(t), game = h.create<GuairaTraversal | GuairaJunction>(Scene);
                const source = game.input.createActionSource();
                const touch = { identifier: 1, target: h.canvas, clientX: 600, clientY: 330 };
                function press() {
                    if (control === 'keyboard') h.key('keydown', ' ');
                    else if (control === 'canvas touch') h.canvas.dispatch('touchstart', { touches: [touch], changedTouches: [touch] });
                    else source.press('jump');
                }
                function release() {
                    if (control === 'keyboard') h.key('keyup', ' ');
                    else if (control === 'canvas touch') h.canvas.dispatch('touchend', { touches: [], changedTouches: [touch] });
                    else source.release();
                }
                let starts = 0;
                const nativeUpdate = game.player.update.bind(game.player);
                game.player.update = (...args) => {
                    const result = nativeUpdate(...args);
                    if (result.jumpStarted) starts++;
                    return result;
                };
                const step = () => {
                    game.update(DT);
                    assert.equal(game.player.data.isDead, false);
                    assert.equal(game.state, 'playing');
                };
                step();
                const player = game.player, floorY = player.getFeetPosition().y;
                const save = structuredClone(game.store.save);
                function arc() {
                    const points: Array<[number, number]> = [];
                    for (let frame = 0; frame < 120; frame++) {
                        points.push([floorY - player.getFeetPosition().y, player.data.velocity.y]);
                        if (player.data.isGrounded) return points;
                        step();
                    }
                    assert.fail('A jump must land within two seconds.');
                }

                press();
                if (intent === 'released') release();
                step();
                const ordinary = arc();
                assert.equal(ordinary[0][1], PLAYER_JUMP_FORCE * (intent === 'released' ? .5 : 1) + GRAVITY);
                assert.equal(starts, 1);
                release(); step();

                // Jump normally, then tap again just before the native collision lands.
                press(); step(); release(); step();
                let queued = false;
                for (let frame = 0; frame < 120; frame++) {
                    const gap = floorY - player.getFeetPosition().y;
                    if (!player.data.isGrounded && player.data.velocity.y > 0 && gap > 0 && gap <= player.data.velocity.y + GRAVITY) {
                        press();
                        if (intent === 'released' || intent === 'released then repressed') release();
                        step();
                        queued = true;
                        break;
                    }
                    step();
                }
                assert.equal(queued, true, 'Reach the buffer through native jump physics, without teleporting.');
                assert.equal(player.data.isGrounded, true);
                assert.ok(player.data.jumpBufferTimer > 0);
                if (intent === 'released then repressed') press();
                if (intent === 'release/repress on launch') { release(); press(); }
                step();
                assert.equal(game.input.getState().jumpReleased, intent === 'release/repress on launch');
                assert.equal(game.input.getState().jump, intent !== 'released');
                assert.equal(player.data.velocity.y, ordinary[0][1], 'The buffered launch must honor the latest held intent.');
                assert.deepEqual(arc(), ordinary, 'The entire buffered arc must match an ordinary jump with the same held intent.');
                for (let frame = 0; frame < 12; frame++) step();
                assert.equal(starts, 3, 'The buffer executes exactly once and cannot repeat on landing.');
                assert.equal(player.data.jumpBufferTimer, 0);
                assert.deepEqual(game.store.save, save, 'Jump input cannot change saves or progression.');
                source.dispose(); game.dispose();
            });
        }
    }
}

test('an already-airborne release keeps its existing cut even if repressed in the same step', t => {
    const h = physics(t); h.step(); h.key('keydown', ' '); h.step();
    const previousVelocity = h.player.data.velocity.y;
    h.key('keyup', ' '); h.key('keydown', ' ');
    const result = h.step();
    assert.equal(h.input.getState().jump, true);
    assert.equal(h.input.getState().jumpReleased, true);
    assert.equal(result.jumpStarted, false);
    assert.equal(h.player.data.velocity.y, previousVelocity * .5 + GRAVITY);
});

test('an expired released buffer cannot become a late jump after a longer fall', t => {
    const h = physics(t, 14);
    h.key('keydown', ' '); h.key('keyup', ' ');
    let starts = 0, elapsed = 0;
    for (let frame = 0; frame < 120; frame++) {
        if (h.step().jumpStarted) starts++;
        elapsed += DT;
        if (h.player.data.isGrounded) break;
    }
    assert.ok(elapsed > JUMP_BUFFER_TIME + DT);
    assert.equal(h.player.data.isGrounded, true);
    assert.equal(h.player.data.jumpBufferTimer, 0);
    for (let frame = 0; frame < 8; frame++) if (h.step().jumpStarted) starts++;
    assert.equal(starts, 0);
    h.key('keydown', 'w');
    assert.equal(h.step().jumpStarted, true, 'A fresh input still launches after the old buffer expires.');
    assert.equal(h.player.data.velocity.y, PLAYER_JUMP_FORCE + GRAVITY);
});

for (const wait of [3, 8]) {
    test(`coyote input after ${wait} airborne steps keeps the existing ${COYOTE_TIME} ms window`, t => {
        const h = physics(t, 20, true); h.step(); h.key('keydown', 'd');
        for (let frame = 0; frame < 60 && h.player.data.isGrounded; frame++) h.step();
        assert.equal(h.player.data.isGrounded, false);
        assert.equal(h.player.data.coyoteTimer, COYOTE_TIME);
        for (let frame = 0; frame < wait; frame++) h.step();
        h.key('keydown', ' '); h.key('keyup', ' ');
        const result = h.step(), withinWindow = (wait + 1) * DT < COYOTE_TIME;
        assert.equal(result.jumpStarted, withinWindow);
        if (withinWindow) assert.equal(h.player.data.velocity.y, PLAYER_JUMP_FORCE * .5 + GRAVITY);
        else assert.ok(h.player.data.velocity.y > 0);
    });
}

test('keyboard aliases and held repeats never create an extra buffered launch', t => {
    const h = physics(t); h.step();
    h.key('keydown', ' '); h.key('keydown', 'w');
    assert.equal(h.step().jumpStarted, true);
    h.key('keyup', ' '); h.step();
    assert.equal(h.input.getState().jump, true);
    assert.equal(h.input.getState().jumpReleased, false);
    for (let frame = 0; frame < 120; frame++) {
        h.window.dispatch('keydown', { code: 'KeyW', key: 'w', repeat: true, target: h.canvas });
        assert.equal(h.step().jumpStarted, false);
    }
    assert.equal(h.player.data.isGrounded, true);
    assert.equal(h.player.data.jumpBufferTimer, 0);
});
