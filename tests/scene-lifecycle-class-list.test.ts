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
