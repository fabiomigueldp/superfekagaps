import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Window } from 'happy-dom';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function documentFor(t) {
    const window = new Window();
    t.after(() => window.close());
    return new window.DOMParser().parseFromString(html, 'text/html');
}

test('editor dimension buttons name both the action and the affected axis', t => {
    const document = documentFor(t);
    for (const [target, axis] of [['bounds-width', 'largura'], ['bounds-height', 'altura']]) {
        const buttons = document.querySelectorAll(`#tab-bounds button[data-target="${target}"]`);
        assert.equal(buttons.length, 2);
        for (const button of buttons) {
            const action = button.classList.contains('increment') ? 'Aumentar' : 'Diminuir';
            assert.equal(button.getAttribute('aria-label'), `${action} ${axis}`);
        }
    }
});

test('editor dimension fields are associated with their visible labels', t => {
    const document = documentFor(t);
    for (const [id, text] of [['bounds-width', 'Width (tiles)'], ['bounds-height', 'Height (tiles)']]) {
        const input = document.getElementById(id);
        assert.equal(input.type, 'number');
        assert.equal(input.labels.length, 1);
        assert.equal(input.labels[0].textContent, text);
        assert.equal(input.labels[0].control, input);
    }
});
