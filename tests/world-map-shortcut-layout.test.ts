import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('campaign chapter navigation never reintroduces external pages or a duplicate promotion in the footer', () => {
    const view = source('adventure/WorldMapView.ts'), game = source('adventure/WorldGame.ts');
    assert.doesNotMatch(view, /chapterLinks\.append|DELICIA_ENTRY|showGuairaRegion/);
    assert.doesNotMatch(game, /location\.assign\(['"].*guaira-capitulo/);
    assert.match(game, /mountChapter\(chapter, stage\)/);
    assert.match(view, /this\.hud\.footer\.getBoundingClientRect\(\)\.top/);
});
