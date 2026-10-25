import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { stageById } from '../src/adventure/campaign';
import { ProgressStore } from '../src/adventure/progress';
import { WorldTutorial, type Lesson } from '../src/adventure/WorldTutorial';
import { controlPreferences, DEFAULT_KEYS, keyAction, keyLabel } from '../src/engine/ControlPreferences';
import { Player } from '../src/entities/Player';
import { textWidth } from '../src/graphics/BitmapFont';

function preferences(t: TestContext) {
    const previous = controlPreferences.keys;
    controlPreferences.keys = structuredClone(DEFAULT_KEYS);
    t.after(() => { controlPreferences.keys = previous; });
    return controlPreferences.keys;
}

function fixture(lesson: Lesson, store = new ProgressStore(null)) {
    const tutorial = new WorldTutorial(store);
    const stage = stageById(lesson === 'pound' ? '2-2' : '1-1')!;
    const button = stage.mechanisms.find(m => m.kind === 'switch');
    const player = lesson === 'pound'
        ? new Player(button!.x / 16, (button!.y + button!.height) / 16) : new Player(3, 14);
    player.data.isGrounded = true;
    if (lesson === 'run') store.markSeen('control:jump');
    return { store, tutorial, stage, player, cue: (touch = false) => tutorial.cue(stage, player.data, touch)! };
}

test('an existing tutorial reflects remapping and restoring defaults on the next cue', t => {
    const keys = preferences(t), h = fixture('jump');
    assert.equal(h.cue().lines[0], 'ESPAÇO PARA PULAR');
    keys.jump = ['Numpad7', 'KeyV'];
    assert.equal(h.cue().lines[0], 'NUM 7 PARA PULAR');
    controlPreferences.keys = structuredClone(DEFAULT_KEYS);
    assert.equal(h.cue().lines[0], 'ESPAÇO PARA PULAR');
});

test('keyboard examples use the shared labels and one configured alternative per action', t => {
    const keys = preferences(t);
    keys.run = ['ShiftRight', 'KeyC']; keys.right = ['Numpad6', 'KeyL'];
    assert.equal(fixture('run').cue().lines[0], 'SEGURE SHIFT DIR. + NUM 6 PARA CORRER');
    keys.jump = ['Digit7', 'Space']; keys.down = ['ArrowLeft', 'KeyB'];
    keys.left = ['KeyA'];
    assert.equal(fixture('pound').cue().lines[0], 'PULE 7, DEPOIS ← NO AR');
});

test('long configured labels wrap inside 272 pixels without truncation or excessive height', t => {
    const keys = preferences(t);
    // Saved controls accept at most 31 characters per code and six alternatives.
    keys.jump = ['J'.repeat(31), 'KeyV']; keys.run = ['R'.repeat(31), 'KeyC'];
    keys.right = ['D'.repeat(31), 'KeyL']; keys.down = ['B'.repeat(31), 'KeyN'];
    const expected = {
        jump: `${keyLabel(keys.jump[0])} PARA PULAR`,
        run: `SEGURE ${keyLabel(keys.run[0])} + ${keyLabel(keys.right[0])} PARA CORRER`,
        pound: `PULE ${keyLabel(keys.jump[0])}, DEPOIS ${keyLabel(keys.down[0])} NO AR`,
    };
    for (const lesson of ['jump', 'run', 'pound'] as const) {
        const cue = fixture(lesson).cue();
        assert.equal(cue.lines.slice(0, -1).join(' '), expected[lesson]);
        assert.ok(cue.lines.every(line => textWidth(line) <= 272));
        assert.ok(cue.lines.length <= 4, 'The hint must remain a small overlay.');
    }
    assert.ok(fixture('run').cue().lines.length > 2, 'Exercise the wrapped instruction.');
});

for (const [lesson, action, label] of [
    ['jump', 'jump', 'PULAR'], ['run', 'run', 'CORRER'], ['run', 'right', 'DIREITA'],
    ['pound', 'jump', 'PULAR'], ['pound', 'down', 'SENTADA / BAIXO'],
] as const) {
    test(`${lesson} identifies unbound ${action} without inventing a default key`, t => {
        const keys = preferences(t); keys[action] = [];
        assert.equal(fixture(lesson).cue().lines[0], `${label}: SEM TECLA CONFIGURADA`);
    });
}

test('touch instructions and lesson details stay unchanged for remapped and unbound keyboards', t => {
    const keys = preferences(t);
    const expected = {
        jump: ['↑ PARA PULAR', 'Pule e aterrisse no chão seguro.'],
        run: ['SEGURE X + → PARA CORRER', 'Experimente neste chão seguro.'],
        pound: ['PULE ↑, DEPOIS ↓ NO AR', 'Acerte o botão com uma sentada.'],
    };
    for (const binding of [['KeyV'], []]) {
        for (const action of ['jump', 'run', 'right', 'down'] as const) keys[action] = [...binding];
        for (const lesson of ['jump', 'run', 'pound'] as const) {
            const h = fixture(lesson);
            assert.deepEqual(h.cue(true).lines, expected[lesson]);
            const keyboard = h.cue().lines;
            assert.equal(keyboard[keyboard.length - 1], expected[lesson][1]);
        }
    }
});

test('reading remapped hints cannot write progress, learn lessons or change control preferences', t => {
    const keys = preferences(t); keys.jump = ['KeyV'];
    let writes = 0;
    const values = new Map<string, string>();
    const store = new ProgressStore({ getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); writes++; } });
    const h = fixture('jump', store), save = JSON.stringify(store.save), controls = JSON.stringify(keys);
    for (let frame = 0; frame < 100; frame++) { h.cue(); h.cue(true); }
    assert.equal(JSON.stringify(store.save), save);
    assert.equal(JSON.stringify(controlPreferences.keys), controls);
    assert.equal(writes, 0);
    store.markSeen('control:jump'); store.markSeen('control:run');
    keys.jump = ['Numpad7'];
    assert.equal(h.cue(), null, 'Remapping cannot reset learned lessons.');
    assert.equal(writes, 2, 'Only the explicit learning events may save progress.');
});

for (const [lesson, instruction] of [
    ['jump', 'V PARA PULAR'],
    ['run', 'SEGURE C + L PARA CORRER'],
    ['pound', 'PULE V, DEPOIS B NO AR'],
] as const) {
    test(`${lesson} tutorial follows the configured keyboard actions`, t => {
        const keys = preferences(t);
        keys.jump = ['KeyV']; keys.run = ['KeyC']; keys.right = ['KeyL']; keys.down = ['KeyB'];
        for (const action of ['jump', 'run', 'right', 'down'] as const)
            assert.equal(keyAction(keys[action][0]), action, 'Input already resolves this configured key.');
        const h = fixture(lesson);
        assert.equal(h.cue().lesson, lesson);
        assert.equal(h.cue().lines[0], instruction);
    });
}
