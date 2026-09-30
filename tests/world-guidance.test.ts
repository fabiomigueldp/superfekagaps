import assert from 'node:assert/strict';
import test from 'node:test';
import { STAGES, stageById } from '../src/adventure/campaign';
import { ProgressStore, resetPreviewGuidance, SAVE_KEY } from '../src/adventure/progress';
import { WorldGame } from '../src/adventure/WorldGame';
import { WorldTutorial } from '../src/adventure/WorldTutorial';
import type { AdventureStage, Dialogue } from '../src/adventure/types';
import { PLAYER_SPEED, PLAYER_RESPAWN_REVEAL_MS, SPRING_BOOST, TileType } from '../src/constants';
import { Player } from '../src/entities/Player';
import { textWidth } from '../src/graphics/BitmapFont';
import type { InputState } from '../src/types';

const DT = 1000 / 60;
const idle: InputState = {
    left: false, right: false, jump: false, run: false, down: false,
    start: false, pause: false, mute: false,
    jumpPressed: false, jumpReleased: false, downPressed: false
};

function memoryStorage() {
    const values = new Map<string, string>();
    const writes: string[] = [];
    return {
        values, writes,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); writes.push(value); }
    };
}

function stage(id = '1-1'): AdventureStage {
    return structuredClone(stageById(id)!);
}

function quietStage(id = '1-1'): AdventureStage {
    return { ...stage(id), dialogues: [], foes: [], pickups: [] };
}

function worldHarness(authored = stage(), storage = memoryStorage(), resume = false) {
    // Exercise the production load/update/restart methods and real physics without DOM/audio devices.
    const game = Object.create(WorldGame.prototype) as any;
    const store = new ProgressStore(storage);
    const speech: string[] = [], effects: string[] = [];
    let controls = { ...idle }, resets = 0, menuMode = true;
    Object.assign(game, {
        store, tutorial: new WorldTutorial(store), touch: false,
        state: 'title', time: 0, elapsed: 0, coins: 0, toast: '', toastTimer: 0,
        selection: 0, mapMarkerX: 40, menuSelection: 0, buttons: [],
        camera: { x: 0, y: 0, targetX: 0, targetY: 0, shakeTimer: 0, shakeMagnitude: 0, bounds: { minX: 0, minY: 0, maxX: 2560, maxY: 368 } },
        input: {
            reset() { resets++; controls = { ...idle }; },
            setMenuMode(value: boolean) { menuMode = value; },
            update() {}, consumeMute: () => false, consumePause: () => false,
            getState: () => controls
        },
        audio: {
            cancelSpeech() {}, setDying() {}, pause() {}, select() {}, tick() {}, toggle() {},
            say(_speaker: string, text: string) { speech.push(text); },
            sfx(effect: string) { effects.push(effect); }
        },
        renderer: { advanceClock() {}, addImpact() {} }
    });
    game.load(authored.id, resume, authored);
    return {
        game, store, storage, speech, effects,
        get resets() { return resets; }, get menuMode() { return menuMode; },
        step(input: Partial<InputState> = {}, dt = DT) { controls = { ...idle, ...input }; game.update(dt); }
    };
}

function position(game: any, x: number, feet = 14) {
    game.player = new Player(x, feet);
    game.player.data.isGrounded = true;
}

function landJump(h: ReturnType<typeof worldHarness>, pound = false) {
    h.step();
    h.step({ jump: true, jumpPressed: true });
    assert.equal(h.game.player.data.isGrounded, false, 'The action must leave the ground.');
    for (let frame = 1; frame < 120; frame++) {
        h.step({ jump: frame < 7, jumpReleased: frame === 7, down: pound && frame >= 5, downPressed: pound && frame === 5 });
        assert.equal(h.game.player.data.isDead, false);
        if (h.game.player.data.isGrounded)
            return;
    }
    assert.fail('The real player should land within two seconds.');
}

function blockingStage(id = '1-1'): AdventureStage {
    const result = quietStage(id);
    result.dialogues = [{ id: `${id}:test-blocking`, x: 3 * 16, speaker: 'feka', text: 'Uma fala importante antes de seguir.' }];
    return result;
}

function commentStage(id = '1-1'): AdventureStage {
    const result = quietStage(id);
    result.dialogues = [{ id: `${id}:test-comment`, x: 3 * 16, speaker: 'feka', text: 'Yasmin, estou chegando!', presentation: 'comment' }];
    return result;
}

function dismiss(game: any) {
    game.closeDialogue(); // Reveal all of the text first.
    game.closeDialogue(); // Then acknowledge the fully revealed scene.
    assert.equal(game.state, 'playing');
}

test('World guidance records persist once and survive a new ProgressStore', () => {
    const storage = memoryStorage(), store = new ProgressStore(storage);
    assert.equal(store.markSeen('control:jump'), true);
    assert.equal(store.markSeen('control:jump'), false);
    assert.equal(store.markSeen('dialogue:1-1:d0'), true);
    assert.equal(storage.writes.length, 2, 'Repeated observations should not rewrite browser storage.');
    assert.deepEqual(new ProgressStore(storage).save.seen, ['control:jump', 'dialogue:1-1:d0']);
    assert.deepEqual(JSON.parse(storage.values.get(SAVE_KEY)!).seen, store.save.seen);
});

test('unavailable storage retains learned guidance for the session without repeated writes', () => {
    let writes = 0;
    const store = new ProgressStore({ getItem: () => null, setItem: () => { writes++; throw Error('full'); } });
    assert.equal(store.markSeen('control:run'), true);
    assert.equal(store.markSeen('control:run'), false);
    assert.equal(writes, 1);
    assert.equal(new WorldTutorial(store).learned('run'), true);
    assert.ok(store.warning);
});

test('opening cues stay on safe World 1 ground and use fitting keyboard and touch labels', () => {
    const tutorial = new WorldTutorial(new ProgressStore(null));
    for (const touch of [false, true]) {
        for (const [id, x, feet] of [['1-1', 3, 14], ['1-1', 64, 14], ['1-2', 3, 14]] as const) {
            const player = new Player(x, feet); player.data.isGrounded = true;
            const cue = tutorial.cue(stage(id), player.data, touch)!;
            assert.equal(cue.lesson, 'jump');
            assert.ok(cue.lines.every(line => textWidth(line) <= 272));
            assert.equal(cue.lines[0].includes('ESPAÇO'), !touch);
        }
        for (const [id, x, feet] of [['1-1', 27, 18], ['1-1', 79, 18], ['1-1', 91, 13], ['1-2', 18, 14], ['1-3', 3, 14], ['1-5', 3, 14]] as const) {
            assert.equal(tutorial.cue(stage(id), new Player(x, feet).data, touch), null, `${id} at ${x},${feet} is not a safe tutorial opening.`);
        }
    }
    const player = new Player(3, 14);
    player.data.isDead = true;
    assert.equal(tutorial.cue(stage(), player.data, false), null);
    player.data.isDead = false; player.data.respawnRevealTimer = 1;
    assert.equal(tutorial.cue(stage(), player.data, false), null);
});

test('run and pound keyboard and touch cues fit their World guidance panel', () => {
    const store = new ProgressStore(null), tutorial = new WorldTutorial(store);
    store.markSeen('control:jump');
    for (const touch of [false, true]) {
        const runner = new Player(3, 14); runner.data.isGrounded = true;
        const run = tutorial.cue(stage(), runner.data, touch)!;
        assert.equal(run.lesson, 'run');
        assert.equal(run.lines[0].includes('SHIFT'), !touch);
        assert.ok(run.lines.every(line => textWidth(line) <= 272));
        runner.data.isGrounded = false;
        assert.equal(tutorial.cue(stage(), runner.data, touch), null);
        for (const id of ['2-2', '3-2']) {
            const authored = stage(id), button = authored.mechanisms.find(m => m.kind === 'switch')!;
            const player = new Player(button.x / 16, (button.y + button.height) / 16);
            const pound = tutorial.cue(authored, player.data, touch)!;
            assert.equal(pound.lesson, 'pound');
            assert.equal(pound.lines[0].includes('S /'), !touch);
            assert.ok(pound.lines.every(line => textWidth(line) <= 272));
            player.data.position.x -= 200;
            assert.equal(tutorial.cue(authored, player.data, touch), null);
        }
    }
});

test('typing jump, run or pound controls without successful movement teaches nothing', () => {
    const store = new ProgressStore(null), tutorial = new WorldTutorial(store), player = new Player(3, 14);
    player.data.isGrounded = true;
    for (let frame = 0; frame < 120; frame++)
        tutorial.observe(player.data, player.getRect(), { ...idle, jump: true, jumpPressed: true, run: true, right: true, down: true, downPressed: true }, false, false);
    assert.deepEqual(store.save.seen, []);
    assert.equal(tutorial.cue(stage(), player.data, false)?.lesson, 'jump');
});

test('World update learns jump only after a real jump lands, then offers run', () => {
    const h = worldHarness(quietStage());
    h.step();
    assert.equal(h.game.tutorial.cue(h.game.stage, h.game.player.data, false)?.lesson, 'jump');
    h.step({ jump: true, jumpPressed: true });
    assert.equal(h.game.player.data.isGrounded, false);
    assert.equal(h.game.tutorial.learned('jump'), false);
    for (let frame = 1; frame < 120 && !h.game.player.data.isGrounded; frame++)
        h.step({ jump: frame < 7, jumpReleased: frame === 7 });
    assert.equal(h.game.player.data.isGrounded, true);
    assert.equal(h.game.tutorial.learned('jump'), true);
    assert.equal(h.game.tutorial.cue(h.game.stage, h.game.player.data, false)?.lesson, 'run');
    assert.equal(new WorldTutorial(new ProgressStore(h.storage)).learned('jump'), true);
});

test('a jump pressed and released within one frame still teaches jump after its actual landing', () => {
    const h = worldHarness(quietStage());
    h.step();
    h.step({ jumpPressed: true, jumpReleased: true });
    assert.equal(h.game.player.data.isGrounded, false);
    assert.ok(h.game.player.data.velocity.y < 0, 'The short tap must execute a real jump.');
    assert.equal(h.game.player.data.isJumping, false, 'Release already ended the held-jump state in this frame.');
    for (let frame = 0; frame < 120 && !h.game.player.data.isGrounded; frame++) {
        assert.equal(h.game.tutorial.learned('jump'), false);
        assert.equal(h.game.tutorial.cue(h.game.stage, h.game.player.data, false)?.lesson, 'jump');
        h.step();
    }
    assert.equal(h.game.player.data.isGrounded, true);
    assert.equal(h.game.tutorial.learned('jump'), true);
    assert.equal(h.game.tutorial.cue(h.game.stage, h.game.player.data, false)?.lesson, 'run');
});

test('a released jump tap buffered before landing learns only after the buffered jump lands', () => {
    const h = worldHarness(quietStage());
    h.game.player.data.position.y -= 2;
    h.game.player.data.velocity.y = 2;
    assert.equal(h.game.player.data.isGrounded, false);
    h.step({ jumpPressed: true, jumpReleased: true });
    assert.equal(h.game.player.data.isGrounded, true, 'The initial descent lands before the buffered jump executes.');
    assert.ok(h.game.player.data.jumpBufferTimer > 0);
    assert.equal(h.game.tutorial.learned('jump'), false, 'An input before the initial fall lands is not a completed jump.');
    h.step();
    assert.equal(h.game.input.getState().jump, false);
    assert.equal(h.game.input.getState().jumpPressed, false);
    assert.equal(h.game.player.data.isGrounded, false);
    assert.ok(h.game.player.data.velocity.y < 0, 'The saved input must execute the buffered jump without another press.');
    for (let frame = 0; frame < 120 && !h.game.player.data.isGrounded; frame++) {
        assert.equal(h.game.tutorial.learned('jump'), false);
        assert.equal(h.game.tutorial.cue(h.game.stage, h.game.player.data, false)?.lesson, 'jump');
        h.step();
    }
    assert.equal(h.game.player.data.isGrounded, true);
    assert.equal(h.game.tutorial.learned('jump'), true);
    assert.equal(h.game.tutorial.cue(h.game.stage, h.game.player.data, false)?.lesson, 'run');
});

test('an automatic spring bounce and landing cannot teach jump without a jump input', () => {
    const authored = quietStage();
    authored.level.tiles[14][3] = TileType.SPRING;
    const h = worldHarness(authored);
    h.step();
    assert.equal(h.game.player.data.velocity.y, SPRING_BOOST);
    assert.equal(h.game.player.data.isGrounded, false);
    assert.equal(h.game.player.data.isJumping, true);
    for (let frame = 0; frame < 180 && !h.game.player.data.isGrounded; frame++) {
        assert.equal(h.game.tutorial.learned('jump'), false);
        // Move away from the spring to land on ordinary ground, without any jump press.
        h.step({ right: frame < 20 });
    }
    assert.equal(h.game.player.data.isGrounded, true);
    assert.equal(h.game.player.data.isDead, false);
    assert.equal(h.game.tutorial.learned('jump'), false);
    assert.equal(h.game.tutorial.cue(authored, h.game.player.data, false)?.lesson, 'jump');
});

test('World update requires 48 pixels of actual above-walking grounded run travel', () => {
    const h = worldHarness(quietStage());
    h.store.markSeen('control:jump');
    h.step();
    let qualifyingTravel = 0;
    for (let frame = 0; frame < 100; frame++) {
        const previous = h.game.player.getRect();
        h.step({ right: true, run: true });
        if (h.game.player.data.isGrounded && Math.abs(h.game.player.data.velocity.x) > PLAYER_SPEED)
            qualifyingTravel += Math.abs(h.game.player.data.position.x - previous.x);
        assert.equal(h.game.tutorial.learned('run'), qualifyingTravel >= 48);
        if (qualifyingTravel >= 48)
            break;
    }
    assert.ok(qualifyingTravel >= 48);
    assert.equal(h.game.tutorial.cue(h.game.stage, h.game.player.data, false), null);
    assert.equal(new WorldTutorial(new ProgressStore(h.storage)).learned('run'), true);
});

test('walking, airborne run, teleports and running into a wall do not complete run guidance', () => {
    const store = new ProgressStore(null), tutorial = new WorldTutorial(store), player = new Player(3, 14);
    const running = { ...idle, right: true, run: true };
    for (const mode of ['walking', 'airborne', 'teleport', 'wall']) {
        tutorial.resetAttempt();
        for (let frame = 0; frame < 40; frame++) {
            const previous = player.getRect();
            player.data.isGrounded = mode !== 'airborne';
            player.data.velocity.x = mode === 'walking' ? PLAYER_SPEED : PLAYER_SPEED + 1;
            player.data.position.x += mode === 'wall' ? 0 : mode === 'teleport' ? 100 : 3;
            tutorial.observe(player.data, previous, running, false, false);
        }
        assert.equal(tutorial.learned('run'), false, mode);
    }
});

test('attempt resets discard partial jump and run progress, while keeping completed lessons', () => {
    const h = worldHarness(quietStage());
    h.step(); h.step({ jump: true, jumpPressed: true });
    assert.equal(h.game.tutorial.learned('jump'), false);
    h.game.load('1-1', false, quietStage()); h.step();
    assert.equal(h.game.tutorial.learned('jump'), false, 'Spawning grounded after an interrupted jump is not a landing.');
    landJump(h);
    for (let frame = 0; frame < 15; frame++) h.step({ right: true, run: true });
    assert.equal(h.game.tutorial.learned('run'), false);
    h.game.load('1-1', false, quietStage()); h.step();
    for (let frame = 0; frame < 15; frame++) h.step({ right: true, run: true });
    assert.equal(h.game.tutorial.learned('run'), false, 'Two partial runs separated by reload are not one successful run.');
    assert.equal(h.game.tutorial.learned('jump'), true);
});

for (const id of ['2-2', '3-2']) {
    test(`World ${id} pound cue survives an ordinary landing and disappears after a real switch pound`, () => {
        const h = worldHarness(quietStage(id)), button = h.game.objects.bodies.find((m: any) => m.kind === 'switch')!;
        position(h.game, (button.x + button.width / 2 - h.game.player.data.width / 2) / 16, (button.y + button.height) / 16);
        assert.equal(h.game.tutorial.cue(h.game.stage, h.game.player.data, false)?.lesson, 'pound');
        h.step({ down: true, downPressed: true });
        assert.equal(h.game.tutorial.learned('pound'), false);
        landJump(h);
        assert.equal(h.game.tutorial.learned('pound'), false);
        assert.equal(button.active, false);
        assert.equal(h.game.tutorial.cue(h.game.stage, h.game.player.data, false)?.lesson, 'pound');
        landJump(h, true);
        assert.equal(button.active, true);
        assert.equal(h.game.objects.get(button.link)!.active, true);
        assert.equal(h.game.tutorial.learned('pound'), true);
        assert.equal(h.game.tutorial.cue(h.game.stage, h.game.player.data, false), null);
        assert.equal(new WorldTutorial(new ProgressStore(h.storage)).learned('pound'), true);
    });
}

test('ground pounding beside a real switch does not dismiss its tutorial', () => {
    const h = worldHarness(quietStage('2-2'));
    position(h.game, 17, 14);
    assert.equal(h.game.tutorial.cue(h.game.stage, h.game.player.data, false)?.lesson, 'pound');
    landJump(h, true);
    assert.ok(h.effects.includes('pound'), 'The player must really perform a pound impact.');
    assert.equal(h.game.objects.get('s1').active, false);
    assert.equal(h.game.tutorial.learned('pound'), false);
    assert.equal(h.game.tutorial.cue(h.game.stage, h.game.player.data, false)?.lesson, 'pound');
});

test('a first blocking dialogue pauses gameplay and only full-text dismissal persists it', () => {
    const h = worldHarness(blockingStage());
    h.step({ right: true });
    assert.equal(h.game.state, 'dialogue');
    assert.equal(h.menuMode, true);
    const elapsed = h.game.elapsed, previous = h.game.player.getRect();
    h.step({ right: true, jump: true }, 200);
    assert.deepEqual(h.game.player.getRect(), previous);
    assert.equal(h.game.elapsed, elapsed);
    h.game.closeDialogue();
    assert.equal(h.game.state, 'dialogue', 'First continue reveals the remaining text.');
    assert.equal(h.store.save.seen.includes('dialogue:1-1:test-blocking'), false);
    h.game.closeDialogue();
    assert.equal(h.game.state, 'playing');
    assert.equal(h.menuMode, false);
    assert.equal(new ProgressStore(h.storage).save.seen.includes('dialogue:1-1:test-blocking'), true);
    h.step(); assert.equal(h.game.state, 'playing');
});

test('naturally revealed blocking text can be dismissed with one continue', () => {
    const h = worldHarness(blockingStage());
    h.step(); h.step({}, h.game.dialog.text.length * 34);
    h.game.closeDialogue();
    assert.equal(h.game.state, 'playing');
    assert.equal(h.store.save.seen.includes('dialogue:1-1:test-blocking'), true);
});

test('abandoning or reloading an unfinished blocking dialogue leaves it eligible', () => {
    const authored = blockingStage(), h = worldHarness(authored);
    h.step(); h.game.closeDialogue();
    assert.equal(h.game.state, 'dialogue');
    h.game.toMap();
    assert.equal(h.game.state, 'map');
    assert.equal(h.store.save.seen.includes('dialogue:1-1:test-blocking'), false);
    h.game.load(authored.id, true, authored); h.step();
    assert.equal(h.game.state, 'dialogue');
    const reloaded = worldHarness(authored, h.storage);
    reloaded.step();
    assert.equal(reloaded.game.state, 'dialogue', 'A browser reload cannot skip an unfinished scene.');
    dismiss(reloaded.game);
    reloaded.game.toMap(); reloaded.game.load(authored.id, true, authored); reloaded.step();
    assert.equal(reloaded.game.state, 'playing');
    const reopened = worldHarness(authored, h.storage); reopened.step();
    assert.equal(reopened.game.state, 'playing', 'Acknowledged scenes remain skipped after a browser reload.');
});

test('authored mechanic explanations block once while flavor comments remain nonblocking', () => {
    for (const [id, dialogueId] of [['2-2', '2-2:d0'], ['3-2', '3-2:d0'], ['3-3', '3-3:d0'], ['5-1', '5-1:d0']]) {
        const authored = stage(id), d = authored.dialogues.find(d => d.id === dialogueId)!;
        assert.equal(d.presentation, 'dialogue');
        const h = worldHarness(authored);
        position(h.game, d.x / 16, 14); h.step();
        assert.equal(h.game.state, 'dialogue', dialogueId);
        dismiss(h.game);
        h.game.restart(); h.step({}, PLAYER_RESPAWN_REVEAL_MS);
        position(h.game, d.x / 16, 14); h.step();
        assert.equal(h.game.state, 'playing', `${dialogueId} should not block on retry.`);
    }
    assert.equal(stage('1-1').dialogues[0].presentation, 'comment');
    assert.equal(stage('3-2').dialogues[1].presentation, 'comment');
});

test('boss intros stay eligible until dismissed and respect legacy intro save markers', () => {
    for (const authored of STAGES.filter(s => s.encounter)) {
        const h = worldHarness(structuredClone(authored)), d = authored.dialogues[0];
        assert.equal(h.game.state, 'dialogue', authored.id);
        assert.equal(h.store.save.seen.includes(`intro:${authored.id}`), false);
        h.game.closeDialogue();
        assert.equal(h.game.state, 'dialogue');
        h.game.load(authored.id);
        assert.equal(h.game.state, 'dialogue', 'Loading again must preserve an unfinished intro.');
        dismiss(h.game);
        assert.equal(h.store.save.seen.includes(`dialogue:${d.id}`), true);
        assert.equal(h.store.save.seen.includes(`intro:${authored.id}`), true);
        h.game.restart();
        assert.equal(h.game.state, 'playing');
        const legacy = worldHarness(structuredClone(authored));
        legacy.store.save.seen = [`intro:${authored.id}`];
        legacy.game.load(authored.id);
        assert.equal(legacy.game.state, 'playing', 'Old saves must not replay their already seen boss intro.');
    }
});

test('comments preserve held controls and wait without persisting or speaking behind tutorials', () => {
    const h = worldHarness(commentStage()), resets = h.resets;
    h.step({ right: true });
    assert.equal(h.game.state, 'playing');
    assert.equal(h.menuMode, false);
    assert.equal(h.resets, resets);
    assert.equal(h.game.input.getState().right, true);
    assert.equal(h.game.comment?.id, '1-1:test-comment');
    assert.equal(h.game.commentTimer, 0);
    assert.equal(h.store.save.seen.includes('dialogue:1-1:test-comment'), false);
    assert.deepEqual(h.speech, []);
    h.step({}, 1000);
    assert.equal(h.game.commentTimer, 0, 'The comment must not expire unseen while a cue has priority.');
    h.store.markSeen('control:jump'); h.store.markSeen('control:run');
    h.step({ right: true });
    assert.equal(h.game.state, 'playing');
    assert.equal(h.resets, resets);
    assert.equal(h.game.input.getState().right, true);
    assert.ok(h.game.commentTimer > 0);
    assert.deepEqual(h.speech, [h.game.comment.text]);
    assert.equal(new ProgressStore(h.storage).save.seen.includes('dialogue:1-1:test-comment'), true);
    h.step(); assert.equal(h.speech.length, 1, 'A displayed comment speaks only once.');
});

test('a queued but undisplayed comment survives map interruption and browser reload eligibility', () => {
    const authored = commentStage(), h = worldHarness(authored);
    h.step(); assert.equal(h.game.commentTimer, 0);
    h.game.toMap(); h.game.load(authored.id, true, authored); h.step();
    assert.equal(h.game.comment?.id, authored.dialogues[0].id);
    assert.equal(h.store.save.seen.includes(`dialogue:${authored.dialogues[0].id}`), false);
    const reloaded = worldHarness(authored, h.storage);
    reloaded.store.markSeen('control:jump'); reloaded.store.markSeen('control:run');
    reloaded.step();
    assert.deepEqual(reloaded.speech, [authored.dialogues[0].text]);
    assert.equal(reloaded.store.save.seen.includes(`dialogue:${authored.dialogues[0].id}`), true);
});

test('checkpoint toasts delay first comment display and freeze an already visible comment lifetime', () => {
    const h = worldHarness(commentStage());
    h.store.markSeen('control:jump'); h.store.markSeen('control:run');
    h.game.toast = 'CAMINHO GUARDADO'; h.game.toastTimer = 1500;
    h.step({}, 500);
    assert.equal(h.game.commentTimer, 0);
    assert.deepEqual(h.speech, []);
    assert.equal(h.store.save.seen.includes('dialogue:1-1:test-comment'), false);
    h.step({}, 500);
    assert.equal(h.game.commentTimer, 0);
    h.step({}, 500);
    assert.equal(h.game.commentTimer, 500);
    assert.equal(h.speech.length, 1);
    h.game.toastTimer = 5000;
    for (let i = 0; i < 4; i++) h.step({}, 1000);
    assert.equal(h.game.commentTimer, 500, 'An unseen comment must not consume its display time behind another toast.');
    assert.equal(h.game.comment?.id, '1-1:test-comment');
    h.step({}, 1000);
    assert.equal(h.game.commentTimer, 1500);
    assert.equal(h.speech.length, 1);
    h.step({}, 1100);
    assert.equal(h.game.comment, null, 'Visible time eventually expires the comment.');
});

test('World overlay renders checkpoint toast before tutorial, and tutorial before comment', () => {
    const h = worldHarness(commentStage()), rectangles: number[][] = [];
    const context = { fillStyle: '', fillRect(...rect: number[]) { rectangles.push(rect); } };
    Object.assign(h.game.renderer, {
        startScene() {}, getContext: () => context, drawTouchControls() {}, drawPlayerTransition() {}, present() {}
    });
    h.game.renderLevel = () => {}; // Keep the real overlay renderer; unrelated stage painting is not under test.
    h.step();
    h.game.commentTimer = 1;
    h.game.toast = 'CAMINHO GUARDADO'; h.game.toastTimer = 1500;
    h.game.render();
    assert.ok(rectangles.some(r => r[0] === 37 && r[1] === 31 && r[2] === 250 && r[3] === 19));
    assert.equal(rectangles.some(r => r[2] === 296), false, 'Guidance and comments must not cover checkpoint feedback.');
    rectangles.length = 0; h.game.toastTimer = 0; h.game.render();
    assert.ok(rectangles.some(r => r[0] === 14 && r[1] === 31 && r[2] === 296 && r[3] === 32), 'The two-line jump cue has priority over the one-line comment.');
    assert.equal(rectangles.some(r => r[2] === 296 && r[3] === 22), false);
    rectangles.length = 0;
    h.store.markSeen('control:jump'); h.store.markSeen('control:run'); h.game.render();
    assert.ok(rectangles.some(r => r[0] === 14 && r[1] === 31 && r[2] === 296 && r[3] === 22), 'The comment appears once no tutorial is due.');
});

test('death during a jump cannot turn the retry spawn into a successful tutorial landing', () => {
    const h = worldHarness(quietStage());
    h.step(); h.step({ jump: true, jumpPressed: true });
    assert.equal(h.game.player.data.isGrounded, false);
    h.game.player.die('fall'); h.step({}, 2000);
    h.step({}, PLAYER_RESPAWN_REVEAL_MS); h.step();
    assert.equal(h.game.player.data.isGrounded, true);
    assert.equal(h.game.tutorial.learned('jump'), false);
    assert.equal(h.game.tutorial.cue(h.game.stage, h.game.player.data, false)?.lesson, 'jump');
});

test('a browser resume at the first checkpoint still offers any unlearned opening control', () => {
    const authored = quietStage(), storage = memoryStorage(), store = new ProgressStore(storage);
    store.save.checkpoint = { stage: authored.id, index: 0, helmet: false }; store.persist();
    const h = worldHarness(authored, storage, true);
    h.step();
    assert.equal(h.game.player.data.position.x, authored.checkpoints[0].x * 16);
    assert.equal(h.game.tutorial.cue(authored, h.game.player.data, false)?.lesson, 'jump');
    landJump(h);
    assert.equal(h.game.tutorial.cue(authored, h.game.player.data, false)?.lesson, 'run');
});

test('death and restart do not repeat an already displayed comment or acknowledged dialogue', () => {
    for (const presentation of ['comment', 'dialogue'] as const) {
        const authored = presentation === 'comment' ? commentStage() : blockingStage();
        const h = worldHarness(authored);
        h.store.markSeen('control:jump'); h.store.markSeen('control:run');
        h.step();
        if (presentation === 'dialogue') dismiss(h.game);
        const speech = h.speech.length;
        h.game.player.die('fall'); h.step({}, 2000);
        assert.equal(h.game.player.data.isDead, false);
        assert.equal(h.game.player.data.respawnRevealTimer, PLAYER_RESPAWN_REVEAL_MS);
        h.step({}, PLAYER_RESPAWN_REVEAL_MS); h.step();
        assert.equal(h.game.state, 'playing');
        assert.equal(h.game.comment, null);
        assert.equal(h.speech.length, speech);
        assert.equal(h.game.tutorial.learned('jump'), true);
        assert.equal(h.game.tutorial.learned('run'), true);
    }
});

test('checkpoint retry and browser resume keep learned cues and remembered commentary', () => {
    const authored = quietStage(), cp = authored.checkpoints[0];
    const d: Dialogue = { id: '1-1:checkpoint-comment', x: cp.x * 16, speaker: 'feka', text: 'Caminho guardado.', presentation: 'comment' };
    authored.dialogues = [d];
    const h = worldHarness(authored);
    h.store.markSeen('control:jump'); h.store.markSeen('control:run');
    position(h.game, cp.x, cp.y); h.game.player.data.hasHelmet = true;
    h.step();
    assert.deepEqual(h.store.save.checkpoint, { stage: '1-1', index: 0, helmet: true });
    h.step({}, 1600); // Let the checkpoint toast clear before commentary is allowed to appear.
    assert.equal(h.store.save.seen.includes(`dialogue:${d.id}`), true);
    const speech = h.speech.length;
    h.game.player.die('fall'); h.step({}, 2000);
    assert.equal(h.game.player.data.position.x, cp.x * 16);
    assert.equal(h.game.player.data.position.y + h.game.player.data.height, cp.y * 16);
    assert.equal(h.game.player.data.hasHelmet, true);
    assert.equal(h.game.tutorial.cue(authored, h.game.player.data, false), null);
    h.step({}, PLAYER_RESPAWN_REVEAL_MS); h.step();
    assert.equal(h.speech.length, speech);
    assert.equal(h.game.comment, null);
    h.game.toMap();
    const reload = worldHarness(authored, h.storage, true); reload.step();
    assert.equal(reload.game.player.data.position.x, cp.x * 16);
    assert.equal(reload.game.player.data.hasHelmet, true);
    assert.equal(reload.game.comment, null);
    assert.equal(reload.game.tutorial.learned('jump'), true);
    assert.equal(reload.game.tutorial.learned('run'), true);
});

test('editor preview resets only guidance markers and preserves story, progress and acquisitions', () => {
    const save = new ProgressStore(null).save;
    save.seen = ['opening', 'intro:1-5', 'dialogue:1-1:d0', 'control:jump', 'gallery:yasmin', 'control:run', 'intro:6-5', 'dialogue:2-2:d0', 'control:pound'];
    save.completed = ['1-1', '1-2', '1-3'];
    save.seals = ['1-1:s1', '1-1:s2'];
    save.secrets = ['1-3'];
    save.selected = '1-4';
    save.checkpoint = { stage: '1-4', index: 1, helmet: true };
    save.times = { '1-1': 37, '1-3': 51 };
    save.preferences = { music: .25, effects: .6, voice: .4, shake: false };
    const expected = structuredClone(save);
    expected.seen = ['opening', 'intro:1-5', 'gallery:yasmin', 'intro:6-5'];
    resetPreviewGuidance(save);
    assert.deepEqual(save, expected);
    resetPreviewGuidance(save);
    assert.deepEqual(save, expected, 'Repeated editor previews should not alter unrelated saved progress.');
});

for (const presentation of ['comment', 'dialogue'] as const) {
    test(`editor reload shows edited ${presentation} text with the same ID, but ordinary retry does not repeat it`, () => {
        // Use a real stage without opening cues so a freshly reset comment can be displayed immediately.
        const authored = presentation === 'comment' ? commentStage('1-3') : blockingStage('1-3');
        const h = worldHarness(authored), id = authored.dialogues[0].id, original = authored.dialogues[0].text;
        h.store.markSeen('control:jump'); h.store.markSeen('control:run');
        h.step();
        if (presentation === 'dialogue') dismiss(h.game);
        assert.deepEqual(h.speech, [original]);
        assert.equal(h.store.save.seen.includes(`dialogue:${id}`), true);

        h.game.restart(); h.step({}, PLAYER_RESPAWN_REVEAL_MS); h.step();
        assert.equal(h.game.state, 'playing');
        assert.equal(h.game.comment, null);
        assert.deepEqual(h.speech, [original], 'A runtime retry within this preview keeps first-time suppression.');

        const edited = structuredClone(authored), replacement = 'Texto revisado para esta nova prévia.';
        edited.dialogues[0].text = replacement;
        assert.equal(edited.dialogues[0].id, id);
        resetPreviewGuidance(h.store.save);
        assert.equal(h.game.tutorial.learned('jump'), false);
        assert.equal(h.game.tutorial.learned('run'), false);
        h.game.load(edited.id, false, edited); h.step();
        assert.deepEqual(h.speech, [original, replacement], 'An editor reload must test the edited content even when its ID is unchanged.');
        if (presentation === 'dialogue') {
            assert.equal(h.game.state, 'dialogue');
            assert.equal(h.game.dialog.text, replacement);
            dismiss(h.game);
        }
        else {
            assert.equal(h.game.state, 'playing');
            assert.equal(h.game.comment.text, replacement);
        }
        assert.equal(h.store.save.seen.includes(`dialogue:${id}`), true);
        h.game.restart(); h.step({}, PLAYER_RESPAWN_REVEAL_MS); h.step();
        assert.deepEqual(h.speech, [original, replacement], 'Runtime suppression also applies inside the newly edited preview.');
    });
}
