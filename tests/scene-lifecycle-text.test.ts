import assert from 'node:assert/strict';
import test from 'node:test';
import { LifecycleElement, sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';

test('createTextNode preserves literal text without creating an element', t => {
    const { document } = sceneLifecycleBrowser(t), text = document.createTextNode(' <b>Ação</b> & ↑ ');
    assert.equal(text.nodeType, 3); assert.equal(text.nodeName, '#text');
    assert.equal(text.data, ' <b>Ação</b> & ↑ ');
    assert.equal(text.nodeValue, text.data); assert.equal(text.textContent, text.data);
    assert.equal(text instanceof LifecycleElement, false); assert.equal('tagName' in text, false);
    assert.equal('children' in text, false); assert.deepEqual(text.childNodes, []);
    assert.equal(text.parentNode, null); assert.equal(text.parentElement, null);
});

test('labels retain text-node order while children contains only their controls', t => {
    const { document } = sceneLifecycleBrowser(t), label = document.createElement('label');
    const text = document.createTextNode('Ação '), input = document.createElement('input'), note = document.createElement('span');
    note.textContent = 'opcional'; label.append(text, input, note);
    assert.deepEqual(label.childNodes, [text, input, note]); assert.deepEqual(label.children, [input, note]);
    assert.equal(label.textContent, 'Ação opcional');
    assert.equal(text.parentNode, label); assert.equal(text.parentElement, label);
    assert.equal(input.parentNode, label); assert.equal(note.parentElement, label);
});

test('text data, nodeValue and textContent edits remain visible in the parent', t => {
    const { document } = sceneLifecycleBrowser(t), label = document.createElement('label'), text = document.createTextNode('A');
    label.append(text);
    text.data = 'B'; assert.equal(text.nodeValue, 'B'); assert.equal(label.textContent, 'B');
    text.nodeValue = 'C'; assert.equal(text.data, 'C'); assert.equal(label.textContent, 'C');
    text.textContent = 'D'; assert.equal(text.data, 'D'); assert.equal(label.textContent, 'D');
    text.nodeValue = null; assert.equal(text.data, '');
    text.textContent = null; assert.equal(label.textContent, '');
    assert.deepEqual(label.childNodes, [text], 'clearing a text node does not remove it');
});

test('append moves existing nodes between parents without duplicating either child list', t => {
    const { document } = sceneLifecycleBrowser(t), first = document.createElement('label'), second = document.createElement('label');
    const text = document.createTextNode('Texto'), input = document.createElement('input');
    first.append(text, input); const nodes = first.childNodes, elements = first.children;
    second.append(text, input);
    assert.deepEqual(nodes, []); assert.deepEqual(elements, []); assert.equal(first.textContent, '');
    assert.deepEqual(second.childNodes, [text, input]); assert.deepEqual(second.children, [input]);
    assert.equal(text.parentNode, second); assert.equal(input.parentNode, second);
    second.append(text); assert.deepEqual(second.childNodes, [input, text]);
    text.remove(); input.remove(); assert.deepEqual(second.childNodes, []); assert.deepEqual(second.children, []);
    assert.equal(text.parentNode, null); assert.equal(input.parentNode, null);
});

test('replaceChildren detaches text and elements and supports literal string children', t => {
    const { document } = sceneLifecycleBrowser(t), label = document.createElement('label');
    const text = document.createTextNode('Antes'), input = document.createElement('input'); label.append(text, input);
    label.replaceChildren('Depois ', input, '!');
    assert.equal(text.parentNode, null); assert.equal(input.parentNode, label);
    assert.deepEqual(label.childNodes.map(node => node.nodeType), [3, 1, 3]);
    assert.deepEqual(label.children, [input]); assert.equal(label.textContent, 'Depois !');
    const children = [...label.childNodes]; label.replaceChildren();
    assert.deepEqual(label.childNodes, []); assert.deepEqual(label.children, []); assert.equal(label.textContent, '');
    for (const child of children) assert.equal(child.parentNode, null);
});

test('setting element textContent replaces descendants and empty or null removes them', t => {
    const { document } = sceneLifecycleBrowser(t), label = document.createElement('label'), input = document.createElement('input');
    label.append(input); label.textContent = '<novo>';
    assert.equal(input.parentNode, null); assert.deepEqual(label.children, []);
    assert.equal(label.childNodes.length, 1); assert.equal(label.childNodes[0].nodeType, 3);
    assert.equal(label.textContent, '<novo>');
    const text = label.childNodes[0]; label.textContent = '';
    assert.deepEqual(label.childNodes, []); assert.equal(text.parentNode, null);
    label.append(''); assert.equal(label.childNodes.length, 1, 'append keeps even an empty text node');
    label.textContent = null; assert.deepEqual(label.childNodes, []);
});
