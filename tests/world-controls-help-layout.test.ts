/** Source/geometry contracts, not browser layout or safe-area emulation. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/adventure/world-controls-help.css', import.meta.url), 'utf8');
function rule(selector: string): string {
    const start = css.indexOf(`${selector} {`);
    assert.notEqual(start, -1, `Missing ${selector}`);
    return css.slice(start + selector.length + 2, css.indexOf('}', start));
}
const dialog = rule('.world-controls-help');
const sides = ['top', 'right', 'bottom', 'left'] as const;
type Insets = Record<typeof sides[number], number>;

test('chapter help shares this stylesheet in a viewport that exposes safe-area insets', () => {
    const entry = readFileSync(new URL('../guaira-capitulo.html', import.meta.url), 'utf8');
    const chapterCss = readFileSync(new URL('../src/adventure/experimental/guaira/chapter/guaira-chapter-game.css', import.meta.url), 'utf8');
    const chapterHelp = readFileSync(new URL('../src/adventure/experimental/guaira/chapter/GuairaChapterControlsHelp.ts', import.meta.url), 'utf8');
    assert.match(entry, /name="viewport"[^>]*viewport-fit=cover/);
    assert.match(chapterCss, /@import "\.\.\/\.\.\/\.\.\/world-controls-help\.css"/);
    assert.match(chapterHelp, /new WorldControlsHelp\(/);
});

function safeRectangle(width: number, height: number, insets: Insets, naturalHeight = 1000) {
    // Read the production gutter floor, then apply the size/position contract below.
    const gutter = (side: typeof sides[number]) => {
        const match = dialog.match(new RegExp(`--controls-help-${side}: max\\((\\d+)px, env\\(safe-area-inset-${side}, 0px\\)\\)`));
        assert.ok(match, `Missing safe ${side} gutter`);
        return Math.max(Number(match[1]), insets[side]);
    };
    const top = gutter('top'), right = gutter('right'), bottom = gutter('bottom'), left = gutter('left');
    const maxWidth = dialog.match(/width: min\((\d+)px,/);
    assert.ok(maxWidth);
    const availableWidth = width - left - right, availableHeight = height - top - bottom;
    const boxWidth = Math.min(Number(maxWidth[1]), availableWidth);
    const boxHeight = Math.min(naturalHeight, availableHeight);
    return { x: left + (availableWidth - boxWidth) / 2, y: top + (availableHeight - boxHeight) / 2,
        width: boxWidth, height: boxHeight };
}

test('help is sized and centered inside the same four-sided safe rectangle', () => {
    assert.match(dialog, /position: fixed/);
    assert.match(dialog, /inset: var\(--controls-help-top\) var\(--controls-help-right\) var\(--controls-help-bottom\) var\(--controls-help-left\)/);
    assert.match(dialog, /width: min\(480px, calc\(100vw - var\(--controls-help-left\) - var\(--controls-help-right\)\)\)/);
    assert.match(dialog, /max-height: calc\(100dvh - var\(--controls-help-top\) - var\(--controls-help-bottom\)\)/);
    assert.match(dialog, /height: fit-content/);
    assert.match(dialog, /max-width: none/);
    assert.match(dialog, /margin: auto/);
    assert.match(dialog, /box-sizing: border-box/);
});

test('short landscape, both notch sides and portrait leave the entire help panel usable', () => {
    const cases: Array<[number, number, Insets]> = [
        [480, 240, { top: 0, right: 0, bottom: 21, left: 59 }],
        [480, 240, { top: 0, right: 59, bottom: 21, left: 0 }],
        [568, 240, { top: 0, right: 44, bottom: 21, left: 44 }],
        [320, 480, { top: 59, right: 0, bottom: 34, left: 0 }],
        [320, 568, { top: 0, right: 0, bottom: 0, left: 0 }],
    ];
    for (const [width, height, insets] of cases) {
        const box = safeRectangle(width, height, insets);
        assert.ok(box.x >= Math.max(12, insets.left));
        assert.ok(box.y >= Math.max(12, insets.top));
        assert.ok(box.x + box.width <= width - Math.max(12, insets.right));
        assert.ok(box.y + box.height <= height - Math.max(12, insets.bottom));
        // 48px heading + 61px footer + 6px border still leave a scrollable body.
        assert.ok(box.height - 115 > 0);
    }
    const oldContentLeft = (480 - (480 - 24)) / 2 + 3 + 16;
    assert.ok(oldContentLeft < 59, 'The previous full-viewport centering puts left text under this cutout');
    const corrected = safeRectangle(480, 240, cases[0][2]);
    assert.deepEqual(corrected, { x: 59, y: 12, width: 409, height: 207 });
});

test('desktop natural sizing, scrollable text and the fixed 44px exit are preserved', () => {
    assert.deepEqual(safeRectangle(1024, 768, { top: 0, right: 0, bottom: 0, left: 0 }, 420),
        { x: 272, y: 174, width: 480, height: 420 });
    assert.match(rule('.world-controls-content'), /overflow: auto/);
    assert.match(rule('.world-controls-content'), /min-height: 0/);
    assert.match(rule('.world-controls-help footer'), /flex: none/);
    assert.match(rule('.world-controls-help button'), /min-height: 44px/);
});
