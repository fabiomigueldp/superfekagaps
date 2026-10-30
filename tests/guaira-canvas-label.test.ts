import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { chapterCanvasLabel } from '../src/adventure/experimental/guaira/chapter/GuairaChapterPresentation';
import { controlPreferences, DEFAULT_KEYS } from '../src/engine/ControlPreferences';

function keys(t: TestContext) {
    const previous = controlPreferences.keys;
    controlPreferences.keys = structuredClone(DEFAULT_KEYS);
    t.after(() => { controlPreferences.keys = previous; });
    return controlPreferences.keys;
}

test('chapter canvas retains its objective and only advertises supported native actions', t => {
    keys(t);
    const label = chapterCanvasLabel('Travessia. Abra a comporta.');
    assert.equal(label, 'Travessia. Abra a comporta. Teclado: Esquerda: ←; Direita: →; Pular: Espaço; Correr: Shift esq.; Sentada no ar: ↓; Pausar: Esc; Som: M.');
    assert.ok(label.length < 180);
    assert.doesNotMatch(label, /Sementes|Rebater|Cima nos menus|Key[A-Z]/);
});

test('conflicting imported bindings and Escape do not advertise an inactive gameplay action', t => {
    const controls = keys(t);
    controls.jump = ['Escape', 'KeyH', 'Numpad2']; controls.left = ['KeyH'];
    controls.run = ['KeyH', 'ShiftRight']; controls.mute = ['KeyH']; controls.pause = [];
    const before = JSON.stringify(controlPreferences), label = chapterCanvasLabel('Galeria, percurso opcional.');
    assert.match(label, /Esquerda: H; Direita: →; Pular: Num 2; Correr: Shift dir\./);
    assert.match(label, /Pausar: Esc/); assert.doesNotMatch(label, /Pular: Esc|Som:/);
    assert.equal(JSON.stringify(controlPreferences), before);
});

test('unassigned actions stay absent, extra aliases stay concise, and restoration uses defaults', t => {
    const controls = keys(t), original = chapterCanvasLabel('Guaíra.');
    controls.jump = ['KeyK', 'KeyN', 'KeyV', 'KeyB', 'KeyG', 'KeyT'];
    assert.match(chapterCanvasLabel('Guaíra.'), /Pular: K; Correr:/);
    for (const action of Object.keys(controls) as Array<keyof typeof controls>) controls[action] = [];
    assert.equal(chapterCanvasLabel('Guaíra.'), 'Guaíra. Teclado: Pausar: Esc.');
    controlPreferences.keys = structuredClone(DEFAULT_KEYS);
    assert.equal(chapterCanvasLabel('Guaíra.'), original);
});
