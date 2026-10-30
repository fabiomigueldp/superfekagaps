import assert from 'node:assert/strict';
import test from 'node:test';
import { LifecycleElement } from './helpers/sceneLifecycleHarness';

test('classList reads live className and treats only ASCII whitespace as separators', () => {
    const node = new LifecycleElement(), list = node.classList;
    node.className = 'base\ttouch\nbase\rwide\fcompact  ';
    for (const name of ['base', 'touch', 'wide', 'compact']) assert.equal(list.contains(name), true);
    assert.equal(list.contains(''), false); assert.equal(list.contains('base touch'), false);
    node.className = 'one\u00a0token'; assert.equal(list.contains('one\u00a0token'), true); assert.equal(list.contains('one'), false);
    node.className = 'new'; assert.equal(list.contains('base'), false); assert.equal(list.contains('new'), true);
});

test('classList changes membership without duplicate classes and forced toggles are idempotent', () => {
    const node = new LifecycleElement(), list = node.classList;
    node.className = 'base base\twide'; list.add('touch', 'wide', 'touch');
    assert.equal(node.className, 'base wide touch');
    assert.equal(list.toggle('touch', true), true); assert.equal(node.className, 'base wide touch');
    assert.equal(list.toggle('touch', false), false); assert.equal(list.contains('touch'), false);
    assert.equal(list.toggle('touch', false), false);
    assert.equal(list.toggle('touch'), true); assert.equal(list.toggle('touch'), false);
    list.remove('base', 'wide', 'missing'); assert.equal(node.className, '');
    node.className = ' base\tbase '; list.toggle('base', true); assert.equal(node.className, ' base\tbase ');
});

test('classList rejects invalid mutation tokens before changing any class', () => {
    const node = new LifecycleElement(); node.className = 'base';
    for (const method of ['add', 'remove', 'toggle'] as const) {
        assert.throws(() => node.classList[method](''), { name: 'SyntaxError' });
        assert.throws(() => node.classList[method]('bad token'), { name: 'InvalidCharacterError' });
    }
    assert.throws(() => node.classList.add('new', 'bad\ttoken'), { name: 'InvalidCharacterError' });
    assert.throws(() => node.classList.remove('base', ''), { name: 'SyntaxError' });
    assert.equal(node.className, 'base');
});

test('one classList object stays live across className, class attributes and attribute removal', () => {
    const node = new LifecycleElement(), list = node.classList;
    assert.equal(node.classList, list); assert.equal(node.getAttribute('class'), null);
    node.className = 'dl-panel'; assert.equal(node.getAttribute('class'), 'dl-panel');
    list.add('dl-overlay'); assert.equal(node.getAttribute('class'), 'dl-panel dl-overlay');
    node.setAttribute('class', 'selected\tselected active');
    assert.equal(node.className, 'selected\tselected active'); assert.equal(list.contains('selected'), true);
    assert.equal(list.contains('dl-overlay'), false);
    assert.equal(list.toggle('selected', false), false);
    assert.equal(node.className, 'active'); assert.equal(node.getAttribute('class'), 'active');
    node.removeAttribute('class'); assert.equal(node.className, ''); assert.equal(list.contains('active'), false);
    assert.equal(list.toggle('dl-has-touch'), true); assert.equal(node.getAttribute('class'), 'dl-has-touch');
    assert.equal(node.classList, list);
});

test('forced no-ops preserve absent and verbatim attributes, while mutation serializes tokens', () => {
    const node = new LifecycleElement(), list = node.classList;
    assert.equal(list.toggle('dl-has-touch', false), false); assert.equal(node.getAttribute('class'), null);
    list.remove('missing'); assert.equal(node.getAttribute('class'), null);
    node.setAttribute('class', ' base\tbase ');
    assert.equal(list.toggle('base', true), true); assert.equal(node.getAttribute('class'), ' base\tbase ');
    assert.equal(list.toggle('missing', false), false); assert.equal(node.getAttribute('class'), ' base\tbase ');
    list.add('base'); assert.equal(node.getAttribute('class'), 'base');
    list.remove('base'); assert.equal(node.getAttribute('class'), '');
});

test('toggle defaults and force conversion return booleans and keep each element isolated', () => {
    const first = new LifecycleElement(), second = new LifecycleElement();
    assert.equal(first.classList.toggle('touch', undefined), true);
    assert.equal(first.classList.toggle('touch', undefined), false);
    // Exercise Web IDL boolean conversion without lying to the TypeScript signature.
    for (const value of [null, 0, '', false]) {
        first.className = 'touch';
        assert.equal(Reflect.apply(first.classList.toggle, first.classList, ['touch', value]), false);
        assert.equal(first.className, '');
    }
    for (const value of [1, 'false', {}, true]) {
        first.className = '';
        assert.equal(Reflect.apply(first.classList.toggle, first.classList, ['touch', value]), true);
        assert.equal(first.className, 'touch');
    }
    assert.equal(second.classList.contains('touch'), false); assert.equal(second.getAttribute('class'), null);
});

test('invalid toggles reject even forced no-ops and never partially update the attribute', () => {
    const node = new LifecycleElement(); node.className = ' base\tbase ';
    for (const force of [true, false]) {
        assert.throws(() => node.classList.toggle('', force), { name: 'SyntaxError' });
        for (const whitespace of [' ', '\t', '\n', '\r', '\f'])
            assert.throws(() => node.classList.toggle(`bad${whitespace}token`, force), { name: 'InvalidCharacterError' });
    }
    assert.throws(() => node.classList.add('valid', 'bad\ntoken'), { name: 'InvalidCharacterError' });
    assert.throws(() => node.classList.remove('base', ''), { name: 'SyntaxError' });
    assert.equal(node.className, ' base\tbase '); assert.equal(node.getAttribute('class'), ' base\tbase ');
    node.classList.add('one\u00a0token'); assert.equal(node.className, 'base one\u00a0token');
});
