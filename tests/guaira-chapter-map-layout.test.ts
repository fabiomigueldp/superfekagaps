/** Source/cascade and geometry contracts only; no browser layout or notch emulation. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/adventure/experimental/guaira/chapter/guaira-chapter-map.css', import.meta.url), 'utf8');
function rule(source: string, selector: string): string {
    const start = source.indexOf(`${selector} {`);
    assert.notEqual(start, -1, `Missing ${selector}`);
    return source.slice(start + selector.length + 2, source.indexOf('}', start));
}
const dialog = rule(css, '.guaira-chapter-map .chapter-map-dialog');
const sides = ['top', 'right', 'bottom', 'left'] as const;
type Insets = Record<typeof sides[number], number>;
function dialogRectangle(width: number, height: number, insets: Insets, naturalHeight = 1000) {
    const gutters = Object.fromEntries(sides.map(side => {
        const match = dialog.match(new RegExp(`--chapter-dialog-${side}: max\\((\\d+)px, env\\(safe-area-inset-${side}, 0px\\)\\)`));
        assert.ok(match, `Missing safe ${side} gutter`);
        return [side, Math.max(Number(match[1]), insets[side])];
    })) as Insets;
    const maxWidth = dialog.match(/width: min\((\d+)px,/); assert.ok(maxWidth);
    const availableWidth = width - gutters.left - gutters.right;
    const availableHeight = height - gutters.top - gutters.bottom;
    const boxWidth = Math.min(Number(maxWidth[1]), availableWidth);
    const boxHeight = Math.min(naturalHeight, availableHeight);
    return { x: gutters.left + (availableWidth - boxWidth) / 2, y: gutters.top + (availableHeight - boxHeight) / 2,
        width: boxWidth, height: boxHeight };
}

test('Jornada uses the same four-sided safe rectangle for position and scroll bounds', () => {
    assert.match(dialog, /position: fixed/);
    assert.match(dialog, /inset: var\(--chapter-dialog-top\) var\(--chapter-dialog-right\) var\(--chapter-dialog-bottom\) var\(--chapter-dialog-left\)/);
    assert.match(dialog, /width: min\(560px, calc\(100vw - var\(--chapter-dialog-left\) - var\(--chapter-dialog-right\)\)\)/);
    assert.match(dialog, /max-height: calc\(100dvh - var\(--chapter-dialog-top\) - var\(--chapter-dialog-bottom\)\)/);
    assert.match(dialog, /height: fit-content/); assert.match(dialog, /max-width: none/);
    assert.match(dialog, /margin: auto/); assert.match(dialog, /overflow: auto/);
    assert.match(css, /\.guaira-chapter-map \*[^\n]*box-sizing: border-box/);
    const cases: Array<[number, number, Insets]> = [
        [480, 240, { top: 0, right: 0, bottom: 21, left: 59 }],
        [480, 240, { top: 0, right: 59, bottom: 21, left: 0 }],
        [568, 240, { top: 0, right: 44, bottom: 21, left: 44 }],
        [320, 568, { top: 59, right: 0, bottom: 34, left: 0 }],
    ];
    for (const [width, height, insets] of cases) {
        const box = dialogRectangle(width, height, insets);
        assert.ok(box.x >= Math.max(12, insets.left)); assert.ok(box.y >= Math.max(12, insets.top));
        assert.ok(box.x + box.width <= width - Math.max(12, insets.right));
        assert.ok(box.y + box.height <= height - Math.max(12, insets.bottom));
        assert.ok(box.height > 44 + 2 * 16 + 4, 'The scrolling dialog retains room for a full native control');
    }
    assert.deepEqual(dialogRectangle(480, 240, cases[0][2]), { x: 59, y: 12, width: 409, height: 207 });
    assert.deepEqual(dialogRectangle(1024, 768, { top: 0, right: 0, bottom: 0, left: 0 }, 420),
        { x: 232, y: 174, width: 560, height: 420 });
    assert.ok(12 + 2 + 12 < 59, 'Previous centered dialog content entered the left cutout');
});

test('short map footer retains bottom safe-area padding and its six-pixel focus ring', () => {
    const compact = rule(css.slice(css.indexOf('@media (max-height: 420px)')), '.guaira-chapter-map .chapter-map-footer');
    assert.match(compact, /padding-top: 4px/);
    assert.doesNotMatch(compact, /padding-block:/);
    const bottom = compact.match(/padding-bottom: calc\((\d+)px \+ env\(safe-area-inset-bottom, 0px\)\)/);
    assert.ok(bottom);
    const focus = rule(css, '.guaira-chapter-map button:focus-visible');
    const thickness = focus.match(/outline: (\d+)px/), offset = focus.match(/outline-offset: (\d+)px/);
    assert.ok(thickness); assert.ok(offset);
    const reach = Number(thickness[1]) + Number(offset[1]);
    for (const height of [240, 390, 420]) for (const inset of [0, 21, 34]) {
        const padding: number = Number(bottom[1]) + inset;
        const actionBottom = height - padding;
        assert.ok(actionBottom <= height - inset, 'Action remains above the unsafe bottom zone');
        assert.ok(actionBottom + reach <= height - inset, 'Focus ring remains above the unsafe bottom zone');
    }
    assert.ok(390 - 4 > 390 - 21, 'Old compact padding placed 17px of the action in the unsafe zone');
    assert.ok(390 - 4 + reach > 390, 'Old compact padding clipped the focus ring');
});

test('tall map footer also keeps the full focus ring outside the 34px home-indicator inset', () => {
    const base = rule(css.slice(css.indexOf('/* Same quiet Oficina framing')), '.guaira-chapter-map .chapter-map-footer');
    const bottom = base.match(/padding-bottom: calc\((\d+)px \+ env\(safe-area-inset-bottom, 0px\)\)/);
    assert.ok(bottom);
    const focus = rule(css, '.guaira-chapter-map button:focus-visible');
    const thickness = focus.match(/outline: (\d+)px/), offset = focus.match(/outline-offset: (\d+)px/);
    assert.ok(thickness); assert.ok(offset);
    const reach = Number(thickness[1]) + Number(offset[1]);
    for (const height of [421, 568, 844]) for (const inset of [0, 21, 34]) {
        const padding: number = Number(bottom[1]) + inset;
        assert.ok(height - padding + reach <= height - inset);
        if (!inset) assert.equal(padding, 6, 'Preserve the original tall zero-inset geometry');
    }
    assert.equal(844 - Math.max(6, 34) + reach - (844 - 34), 6,
        'Previous tall footer put all six pixels of its focus ring in the unsafe zone');
});

test('edge-aligned header and footer controls reserve horizontal safe-inset focus clearance', () => {
    const safeRules = css.slice(css.indexOf('/* Same quiet Oficina framing'));
    for (const area of ['header', 'footer']) {
        const block = rule(safeRules, `.guaira-chapter-map .chapter-map-${area}`);
        for (const side of ['left', 'right']) {
            const padding = block.match(new RegExp(`padding-${side}: max\\((\\d+)px, calc\\(env\\(safe-area-inset-${side}, 0px\\) \\+ (\\d+)px\\)\\)`));
            assert.ok(padding);
            for (const inset of [0, 44, 59]) {
                const gutter: number = Math.max(Number(padding[1]), inset + Number(padding[2]));
                assert.ok(gutter - 6 >= inset, `${area} ${side} focus ring clears the safe edge`);
                if (!inset) assert.equal(gutter, 8, 'Preserve original zero-inset side spacing');
            }
        }
    }
});

test('header top padding reserves its full focus ring with zero inset and a tall portrait notch', () => {
    const header = rule(css.slice(css.indexOf('/* Same quiet Oficina framing')), '.guaira-chapter-map .chapter-map-header');
    const top = header.match(/padding-top: calc\((\d+)px \+ env\(safe-area-inset-top, 0px\)\)/);
    assert.ok(top);
    for (const inset of [0, 44, 59]) {
        const padding: number = Number(top[1]) + inset;
        assert.equal(padding - 6, inset, 'The six-pixel ring meets but never crosses the safe top');
        if (!inset) assert.equal(padding, 6, 'Only one pixel more than the old zero-inset top padding');
    }
    assert.equal(Math.max(5, 59) - 6, 53, 'Old notch padding placed the ring six pixels inside the unsafe top');
});
