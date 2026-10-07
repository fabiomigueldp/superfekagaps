/** CSS/source contracts; actual browser geometry is a separate release check. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/adventure/map.css', import.meta.url), 'utf8');
const linkCss = readFileSync(new URL('../src/adventure/delicia/map-link.css', import.meta.url), 'utf8');
const view = readFileSync(new URL('../src/adventure/WorldMapView.ts', import.meta.url), 'utf8');

test('chapter shortcut reserves intrinsic space in the measured footer instead of a fixed viewport offset', () => {
    assert.match(linkCss, /\.world-map-delicia \{ position: static;[^}]*margin-bottom: 6px;/);
    assert.doesNotMatch(linkCss, /(?:^|[;{]\s*)bottom:/);
    assert.match(css, /\.world-map-chapter-links \{ grid-column: 1 \/ -1; display: flex; min-width: 0; \}/);
    assert.match(view, /this\.hud\.chapterLinks\.append\(deliciaLink\)/);
    assert.match(view, /this\.resizeObserver\.observe\(surface\)/);
    assert.match(view, /this\.hud\.footer\.getBoundingClientRect\(\)\.top/);
});

test('hidden or absent links reserve no fixed height or margin and keep the map pin independent', () => {
    assert.match(css, /\.world-map \[hidden\] \{ display: none !important; \}/);
    const slot = css.match(/\.world-map-chapter-links \{([^}]+)\}/)![1];
    assert.doesNotMatch(slot, /(?:height|padding|margin|gap):/);
    assert.match(linkCss, /\.world-map-delicia-island \{ transform: translate\(-50%, -50%\); \}/);
    assert.match(linkCss, /\.world-map-delicia, \.world-map-delicia-island \{ position: absolute;/);
});

test('short landscape reserves the first row for the shortcut without overlaying title, copy or action', () => {
    const landscape = css.slice(css.indexOf('@media (max-height: 480px) {'));
    assert.match(landscape, /\.world-map-chapter-links \{ grid-row: 1; \}/);
    assert.match(landscape, /\.world-map-stage-title \{[^}]*grid-row: 2;/);
    assert.match(landscape, /\.world-map-stage-copy \{ grid-column: 1; grid-row: 3; \}/);
    assert.match(landscape, /\.world-map-stage-actions \{ grid-column: 2; grid-row: 2 \/ span 2; \}/);
});

test('narrow and safe-area layouts bound the whole footer and shrink only the bitmap inside the full-height link', () => {
    assert.match(linkCss, /min-height: 44px/);
    assert.match(linkCss, /max-width: min\(204px, 100%\)/);
    assert.match(linkCss, /@container map \(max-width: 620px\)/);
    assert.match(linkCss, /max-width: min\(162px, 100%\)/);
    assert.match(css, /width: min\(470px, calc\(100% - max\(12px, env\(safe-area-inset-left\)\) - max\(12px, env\(safe-area-inset-right\)\)\)\)/);
    assert.match(css, /left: max\(9px, env\(safe-area-inset-left\)\); width: calc\(100% - max\(9px, env\(safe-area-inset-left\)\) - max\(9px, env\(safe-area-inset-right\)\)\)/);
});
