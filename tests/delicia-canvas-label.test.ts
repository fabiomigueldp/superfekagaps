import assert from 'node:assert/strict';
import test, {type TestContext} from 'node:test';
import {deliciaCanvasLabel} from '../src/adventure/delicia/DeliciaUI';
import {controlPreferences, DEFAULT_KEYS, keyAction, keyLabel} from '../src/engine/ControlPreferences';

function controls(t:TestContext){
    const previous=controlPreferences.keys;
    controlPreferences.keys=structuredClone(DEFAULT_KEYS);
    t.after(()=>{controlPreferences.keys=previous;});
    return controlPreferences.keys;
}

test('canvas name preserves the experience and gives one active key per supported action',t=>{
    controls(t);
    const label=deliciaCanvasLabel();
    assert.equal(label,'Feka na ilha da Delícia. Esquerda: ←; Direita: →; Pular: Espaço; Correr: Shift esq.; Sentada: ↓; Sementes: J; Rebater: Q; Válvulas próximas: E.');
    assert.ok(label.length<180);
    assert.doesNotMatch(label,/Dash|Cima nos menus|Key[A-Z]|Shift dir\./);
});

test('jump and special actions reflect remapping and restoration immediately',t=>{
    const keys=controls(t),original=deliciaCanvasLabel();
    Object.assign(keys,{jump:['KeyV'],seed:['KeyB'],parry:['KeyN'],interact:['KeyF']});
    const label=deliciaCanvasLabel();
    for(const fragment of ['Pular: V','Sementes: B','Rebater: N','Válvulas próximas: F'])assert.ok(label.includes(fragment));
    assert.doesNotMatch(label,/Espaço|Sementes: J|Rebater: Q|Válvulas próximas: E/);
    controlPreferences.keys=structuredClone(DEFAULT_KEYS);
    assert.equal(deliciaCanvasLabel(),original);
});

test('movement and pound use configured keys and the shared display labels',t=>{
    const keys=controls(t);
    Object.assign(keys,{left:['KeyH'],right:['KeyL'],run:['ShiftRight'],down:['Numpad2']});
    const label=deliciaCanvasLabel();
    for(const [name,code]of [['Esquerda','KeyH'],['Direita','KeyL'],['Correr','ShiftRight'],['Sentada','Numpad2']])
        assert.ok(label.includes(`${name}: ${keyLabel(code)}`));
});

test('shadowed saved bindings fall back to a key the gameplay action actually owns',t=>{
    const keys=controls(t);
    keys.seed=['Space','KeyB'];keys.parry=['KeyB','KeyN'];
    assert.equal(keyAction('Space'),'jump');assert.equal(keyAction('KeyB'),'seed');
    assert.match(deliciaCanvasLabel(),/Sementes: B; Rebater: N/);
});

test('Escape is not advertised as gameplay when the host reserves it for going back',t=>{
    const keys=controls(t);keys.jump=['Escape','KeyV'];
    assert.equal(keyAction('Escape'),'jump');assert.match(deliciaCanvasLabel(),/Pular: V/);
    keys.jump=['Escape'];assert.doesNotMatch(deliciaCanvasLabel(),/Pular:|Esc;/);
});

test('unbound actions are omitted without inventing default keys',t=>{
    const keys=controls(t);keys.jump=[];keys.seed=[];keys.parry=[];keys.interact=[];
    const label=deliciaCanvasLabel();assert.match(label,/Feka na ilha da Delícia\./);
    assert.doesNotMatch(label,/Pular:|Sementes:|Rebater:|Válvulas próximas:|undefined/);
    for(const action of Object.keys(keys) as Array<keyof typeof keys>)keys[action]=[];
    assert.equal(deliciaCanvasLabel(),'Feka na ilha da Delícia.');
});

test('additional aliases do not lengthen the announcement or mutate preferences',t=>{
    const keys=controls(t);keys.jump=['KeyV','KeyB','KeyN','KeyC','KeyG','KeyT'];
    const before=JSON.stringify(controlPreferences),label=deliciaCanvasLabel();
    assert.match(label,/Pular: V;/);assert.ok(label.length<180);
    assert.equal(deliciaCanvasLabel(),label);assert.equal(JSON.stringify(controlPreferences),before);
});
