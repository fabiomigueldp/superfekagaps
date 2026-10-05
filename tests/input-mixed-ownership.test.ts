import assert from 'node:assert/strict';
import test from 'node:test';
import { GuairaJunction, GUAIRA_JUNCTION as G } from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import { Input, type InputAction } from '../src/engine/Input';
import { Player } from '../src/entities/Player';
import { PLAYER_ACCELERATION } from '../src/constants';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';
import recording from './helpers/guairaJunctionReplay.json';

const DT = 1000 / 60;
type Harness = ReturnType<typeof sceneLifecycleBrowser>;
type Owner = 'keyboard' | 'keyboard alias' | 'canvas' | 'action source';
const keys: Record<InputAction, string> = { left: 'ArrowLeft', right: 'ArrowRight', jump: ' ', down: 'ArrowDown', run: 'ShiftLeft' };
const aliases: Record<InputAction, string> = { left: 'a', right: 'd', jump: 'w', down: 's', run: 'x' };
const touchX: Record<InputAction, number> = { left: 50, right: 140, jump: 595, down: 320, run: 500 };

/** Only browser boundaries are replaced. All presses enter production Input and Player. */
function controls(h: Harness, game: GuairaJunction) {
    let id = 0;
    const touches = new Map<number, { identifier: number; target: typeof h.canvas; clientX: number; clientY: number }>();
    function owner(kind: Owner, action: InputAction) {
        if (kind === 'keyboard' || kind === 'keyboard alias') {
            const key = (kind === 'keyboard' ? keys : aliases)[action];
            return { press: () => { h.key('keydown', key); }, release: () => { h.key('keyup', key); },
                cancel: () => { h.key('keyup', key); } };
        }
        if (kind === 'action source') {
            const source = game.input.createActionSource();
            return { press: () => source.press(action), release: () => source.release(), cancel: () => source.cancel() };
        }
        const finger = { identifier: ++id, target: h.canvas, clientX: touchX[action], clientY: 330 };
        const finish = (type: 'touchend' | 'touchcancel') => {
            touches.delete(finger.identifier);
            h.canvas.dispatch(type, { touches: [...touches.values()], changedTouches: [finger] });
        };
        return {
            press() { touches.set(finger.identifier, finger); h.canvas.dispatch('touchstart', { touches: [...touches.values()], changedTouches: [finger] }); },
            release: () => finish('touchend'), cancel: () => finish('touchcancel')
        };
    }
    return { owner };
}

for (const direction of ['left', 'right'] as const) {
    for (const kind of ['keyboard', 'keyboard alias', 'canvas', 'action source'] as const) {
        for (const oppositeKind of ['keyboard', 'keyboard alias'] as const) {
            test(`${kind} ${direction} survives a released opposite ${oppositeKind} tap at the simulation boundary`, t => {
                const h = sceneLifecycleBrowser(t), game = h.create(GuairaJunction), c = controls(h, game);
                game.update(DT);
                const save = structuredClone(game.store.save), startX = game.player.data.position.x;
                const survivor = c.owner(kind, direction), tap = c.owner(oppositeKind, direction === 'left' ? 'right' : 'left');
                survivor.press(); tap.press(); tap.release();
                assert.equal(game.input.getState()[direction], true, 'The live owner already regained control before update.');
                game.update(DT);
                const sign = direction === 'right' ? 1 : -1;
                assert.equal(game.input.getState()[direction], true, 'A finished tap cannot steal the survivor’s simulation step.');
                assert.equal(game.player.data.velocity.x, sign * PLAYER_ACCELERATION);
                assert.equal(game.player.data.position.x, startX + sign * PLAYER_ACCELERATION);
                assert.equal(game.player.data.facingRight, direction === 'right');
                game.update(DT);
                assert.equal(game.player.data.velocity.x, sign * PLAYER_ACCELERATION * 2);
                assert.deepEqual(game.store.save, save);
                survivor.release(); game.dispose();
            });
        }
    }
}

for (const [released, survivor] of [['a', 'ArrowLeft'], ['ArrowLeft', 'a']]) {
    test(`releasing ${released} before the frame preserves its ${survivor} alias`, t => {
        const h = sceneLifecycleBrowser(t), game = h.create(GuairaJunction);
        game.update(DT);
        h.key('keydown', released); h.key('keydown', survivor);
        h.key('keydown', 'd'); h.key('keyup', 'd'); h.key('keyup', released);
        game.update(DT);
        assert.equal(game.input.getState().left, true);
        assert.equal(game.player.data.velocity.x, -PLAYER_ACCELERATION);
        h.key('keyup', survivor); game.update(DT);
        assert.equal(game.input.getState().left, false);
        game.dispose();
    });
}

for (const direction of ['left', 'right'] as const) for (const finish of ['release', 'cancel', 'dispose'] as const) {
    test(`opposite action-source ${finish} before a frame preserves held ${direction}`, t => {
        const h = sceneLifecycleBrowser(t), game = h.create(GuairaJunction);
        game.update(DT);
        const survivor = game.input.createActionSource(), opposite = game.input.createActionSource();
        survivor.press(direction); opposite.press(direction === 'left' ? 'right' : 'left');
        assert.equal(game.input.getState().left, false); assert.equal(game.input.getState().right, false);
        opposite[finish](); game.update(DT);
        assert.equal(game.input.getState()[direction], true);
        assert.equal(game.player.data.velocity.x, (direction === 'right' ? 1 : -1) * PLAYER_ACCELERATION);
        survivor.release(); game.dispose();
    });
}

test('native pause/reset discards keyboard and source fallback queues without reviving cancelled gestures', t => {
    const h = sceneLifecycleBrowser(t), game = h.create(GuairaJunction);
    game.update(DT);
    const direction = game.input.createActionSource(), jump = game.input.createActionSource();
    h.key('keydown', 'a'); h.key('keyup', 'a'); direction.press('right'); direction.release(); jump.press('jump');
    const start = { ...game.player.data.position };
    game.toggleJunctionPause(); game.toggleJunctionPause();
    direction.cancel(); jump.release(); h.key('keyup', 'a');
    for (let frame = 0; frame < 3; frame++) {
        game.update(DT);
        const state = game.input.getState();
        assert.equal(state.left, false); assert.equal(state.right, false);
        assert.equal(state.jump, false); assert.equal(state.jumpPressed, false); assert.equal(state.jumpReleased, false);
        assert.deepEqual(game.player.data.position, start);
    }
    game.dispose();
});

for (const finish of ['release', 'cancel', 'dispose'] as const) {
    test(`action-source ${finish} preserves keyboard direction, run and jump owners`, t => {
        const h = sceneLifecycleBrowser(t), game = h.create(GuairaJunction);
        game.update(DT);
        const movement = game.input.createActionSource(), run = game.input.createActionSource(), jump = game.input.createActionSource();
        movement.press('left'); run.press('run'); jump.press('jump');
        h.key('keydown', 'ArrowRight'); h.key('keydown', 'd'); h.key('keydown', 'x'); h.key('keydown', ' '); h.key('keydown', 'w');
        movement[finish](); run[finish](); jump[finish]();
        h.key('keyup', 'ArrowRight'); h.key('keyup', ' ');
        game.update(DT);
        const state = game.input.getState();
        assert.equal(state.right, true); assert.equal(state.left, false); assert.equal(state.run, true);
        assert.equal(state.jump, true); assert.equal(state.jumpPressed, true); assert.equal(state.jumpReleased, false);
        assert.equal(game.player.data.velocity.x, PLAYER_ACCELERATION);
        assert.ok(game.player.data.velocity.y < 0); assert.equal(game.player.data.isRunning, true);
        game.update(DT);
        assert.equal(game.input.getState().jumpPressed, false); assert.equal(game.input.getState().jumpReleased, false);
        h.key('keyup', 'd'); h.key('keyup', 'x'); h.key('keyup', 'w'); game.update(DT);
        assert.equal(game.input.getState().jumpReleased, true);
        game.dispose();
    });
}

for (const tapKind of ['keyboard', 'action source'] as const) {
    test(`a ${tapKind} tap cannot override the existing neutral policy of opposite live touch owners`, t => {
        const h = sceneLifecycleBrowser(t), game = h.create(GuairaJunction), c = controls(h, game);
        game.update(DT);
        c.owner('canvas', 'left').press(); c.owner('canvas', 'right').press();
        const tap = c.owner(tapKind, 'left'); tap.press(); tap.release();
        const startX = game.player.data.position.x;
        game.update(DT);
        assert.equal(game.input.getState().left, false); assert.equal(game.input.getState().right, false);
        assert.equal(game.player.data.position.x, startX); assert.equal(game.player.data.velocity.x, 0);
        game.dispose();
    });
}

for (const kind of ['keyboard', 'action source'] as const) {
    test(`a solitary ${kind} horizontal tap still moves for exactly one input step`, t => {
        const h = sceneLifecycleBrowser(t), game = h.create(GuairaJunction), c = controls(h, game);
        game.update(DT);
        const tap = c.owner(kind, 'right'); tap.press(); tap.release(); game.update(DT);
        assert.equal(game.input.getState().right, true); assert.equal(game.player.data.velocity.x, PLAYER_ACCELERATION);
        game.update(DT); assert.equal(game.input.getState().right, false);
        game.dispose();
    });
}

test('when only finished taps remain, keyboard retains its existing priority over action-source taps', t => {
    const h = sceneLifecycleBrowser(t), game = h.create(GuairaJunction), c = controls(h, game);
    game.update(DT);
    const source = c.owner('action source', 'right'), keyboard = c.owner('keyboard', 'left');
    source.press(); source.release(); keyboard.press(); keyboard.release(); game.update(DT);
    assert.equal(game.input.getState().left, true); assert.equal(game.input.getState().right, false);
    assert.equal(game.player.data.velocity.x, -PLAYER_ACCELERATION);
    game.dispose();
});

test('mixed ownership completes the exact native two-lift journey without changing its trajectory, jumps or checkpoint', t => {
    const h = sceneLifecycleBrowser(t);
    const keyAction: Record<string, InputAction> = { ArrowLeft: 'left', ArrowRight: 'right', Space: 'jump', ArrowDown: 'down', ShiftLeft: 'run' };
    function journey(mixed: boolean) {
        const game = h.create(GuairaJunction), c = controls(h, game);
        assert.ok(game.input instanceof Input); assert.ok(game.player instanceof Player);
        const held = new Map<InputAction, ReturnType<typeof c.owner>>(), trace = [];
        let frame = 0, carriesA = 0, carriesB = 0;
        for (const [segment, [count, codes]] of (recording.runs as Array<[number, string[]]>).entries()) {
            const next = new Set(codes.map(code => keyAction[code]));
            for (const [action, owner] of held) if (!next.has(action)) { owner.release(); held.delete(action); }
            for (const action of next) {
                if (!mixed && held.has(action)) continue;
                const kind: Owner = mixed ? (['keyboard', 'canvas', 'action source'] as const)[segment % 3] : 'keyboard';
                const owner = c.owner(kind, action);
                // Acquire the replacement before ending its predecessor, exactly
                // as overlapping fingers/keys do. Never reset input or player state.
                owner.press(); held.get(action)?.cancel(); held.set(action, owner);
            }
            for (let step = 0; step < count; step++, frame++) {
                if (mixed && next.has('right') && step % 17 === 0) { h.key('keydown', 'a'); h.key('keyup', 'a'); }
                if (mixed && step === 5) {
                    for (const action of next) {
                        const extra = c.owner('action source', action); extra.press(); extra.cancel();
                    }
                }
                game.update(recording.stepMs);
                const p = game.player.data;
                assert.equal(p.isDead, false, `alive at frame ${frame}`); assert.equal(p.hasHelmet, true);
                const feet = p.position.y + p.height;
                for (const id of [G.liftAId, G.liftBId]) {
                    const deck = game.objects.get(id)!;
                    if (p.isGrounded && Math.abs(feet - deck.y) < .001 && deck.py !== deck.y && p.position.x >= deck.x && p.position.x + p.width <= deck.x + deck.width) {
                        if (id === G.liftAId) carriesA++; else carriesB++;
                    }
                }
                trace.push(structuredClone({ x: p.position.x, y: p.position.y, vx: p.velocity.x, vy: p.velocity.y,
                    grounded: p.isGrounded, pound: p.groundPoundState, buffer: p.jumpBufferTimer, coyote: p.coyoteTimer,
                    routing: game.routing, checkpoint: game.store.save.checkpoint, finished: game.finished }));
            }
        }
        assert.equal(frame, recording.frames); assert.equal(game.finished, true);
        assert.ok(carriesA > 70); assert.ok(carriesB > 100);
        assert.equal(game.store.save.checkpoint?.index, 0);
        assert.deepEqual(game.store.save.completed, []); assert.deepEqual(game.store.save.times, {});
        assert.equal(game.mapReturnHref, './guaira.html?at=rice&visit=junction-clear');
        game.render(); assert.match(h.status.textContent, /Pátio concluído/);
        for (const owner of held.values()) owner.release();
        const save = structuredClone(game.store.save); game.dispose();
        return { trace, carriesA, carriesB, save };
    }
    const mixed = journey(true), baseline = journey(false);
    assert.deepEqual(mixed, baseline, 'Every native movement, jump, routing and checkpoint step matches ordinary controls.');
    t.diagnostic(`${mixed.trace.length} identical native frames; lift A: ${mixed.carriesA} carried frames; lift B: ${mixed.carriesB}; checkpoint 0; native completion.`);
});
