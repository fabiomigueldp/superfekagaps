/** CSS contracts and production fitter geometry; not a browser line-wrap or pixel test. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fitGuairaLabCanvas, guairaLabCanvasSize, guairaLabToolbarMaxHeight } from '../src/guaira-lab-layout';

const gameCss = readFileSync(new URL('../src/adventure/experimental/guaira/chapter/guaira-chapter-game.css', import.meta.url), 'utf8');
const touchCss = readFileSync(new URL('../src/adventure/experimental/guaira/guaira-touch-controls.css', import.meta.url), 'utf8');
function rule(css: string, selector: string) {
    const start = css.indexOf(`${selector} {`);
    assert.notEqual(start, -1, `Missing ${selector}`);
    return css.slice(start + selector.length + 2, css.indexOf('}', start));
}
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} differs from ${expected}`);

test('compact toolbar retains top and side safe-area insets instead of replacing its padding', () => {
    const toolbar = rule(gameCss, '.chapter-game-toolbar');
    assert.match(toolbar, /max\(var\(--chapter-toolbar-padding\), env\(safe-area-inset-top\)\)/);
    for (const side of ['left', 'right']) assert.match(toolbar,
        new RegExp(`max\\(var\\(--chapter-toolbar-gutter\\), env\\(safe-area-inset-${side}\\)\\)`));
    const compact = rule(gameCss.slice(gameCss.indexOf('@media (max-width: 620px)')), '.chapter-game-toolbar');
    assert.match(compact, /--chapter-toolbar-padding: 6px/);
    assert.match(compact, /--chapter-toolbar-gutter: 6px/);
    assert.doesNotMatch(compact, /(?:^|[;\s])padding(?:-[a-z]+)?:/);
    assert.match(rule(gameCss, '.chapter-game-toolbar #lab-status'), /overflow-wrap: anywhere/);
    assert.match(rule(gameCss, '.chapter-game-toolbar #chapter-keyboard-hint'), /overflow-wrap: anywhere/);
});

test('touch controls wrap after safe-area padding without shrinking their 44px targets', () => {
    const bar = rule(touchCss, '.guaira-touch-controls'), button = rule(touchCss, '.guaira-touch-button');
    assert.match(bar, /flex-wrap: wrap/); assert.match(bar, /gap: 8px/);
    for (const side of ['left', 'right', 'bottom']) assert.ok(bar.includes(`env(safe-area-inset-${side})`));
    assert.match(button, /flex: 0 0 44px/);
    for (const property of ['width', 'height', 'min-width', 'min-height']) assert.ok(button.includes(`${property}: 44px`));
    // Contract arithmetic only: actual CSS wrapping is a separate browser check.
    const rows = (width: number, left = 6, right = 6) => Math.ceil(5 / Math.max(1, Math.floor((width - left - right + 8) / 52)));
    assert.equal(rows(320), 1, '320px portrait keeps its existing single row');
    assert.equal(rows(472, 44, 44), 1, 'short notched landscape keeps its single row');
    assert.equal(rows(320, 44, 44), 2, 'reserved safe areas must not squeeze or clip targets');
    assert.equal(rows(240), 2, 'narrow effective viewport wraps instead of overflowing');
});

test('forced-colors exposes wrapping full control names within the toolbar width', () => {
    assert.match(rule(gameCss, '.chapter-game-toolbar button'), /max-width: 100%/);
    assert.match(rule(gameCss, '.chapter-game-toolbar .lab-action-art'), /max-width: 100%/);
    const forced = gameCss.slice(gameCss.indexOf('@media (forced-colors: active)'));
    const text = rule(forced, '.chapter-game-toolbar .lab-sr');
    assert.match(text, /white-space: normal/); assert.match(text, /overflow-wrap: anywhere/);
    assert.match(text, /min-width: 0/); assert.match(text, /margin: 0/);
    assert.match(rule(forced, '.chapter-game-toolbar button'), /border: 1px solid ButtonText/);
});

test('long guidance cannot consume every gameplay pixel when a toolbar target and touch row fit', () => {
    assert.equal(guairaLabCanvasSize(472, 303, 245, 58).height, 0,
        'the previous full-height toolbar cap could consume all gameplay space');
    for (const [width, height, controls, toolbarFloor] of [
        [320, 480, 58, 58], [472, 303, 58, 58], [568, 240, 78, 96],
        [240, 320, 110, 58], [320, 480, 78, 96], [812, 375, 78, 64]
    ]) {
        const maxToolbar = guairaLabToolbarMaxHeight(height, controls, toolbarFloor);
        const size = guairaLabCanvasSize(width, height, maxToolbar, controls);
        assert.ok(maxToolbar >= toolbarFloor, 'one 44px toolbar control plus safe-area padding fits');
        assert.ok(size.height > 0, 'scrolling long completion/pause text leaves visible gameplay');
        assert.ok(size.height <= height - maxToolbar - controls - 12 + 1e-8);
        assert.ok(size.width <= width + 1e-8);
        close(size.width * 9, size.height * 16);
    }
    assert.equal(guairaLabToolbarMaxHeight(303, 58, 58), 143);
    assert.equal(guairaLabToolbarMaxHeight(240, 78, 96), 96, 'safe top inset takes priority over the 90px play reserve');
    assert.equal(guairaLabToolbarMaxHeight(40, 58, 96), 0, 'impossible viewport never produces a negative size');
});

test('production fitter remeasures long status, wrapped controls, safe padding and restored short guidance', t => {
    const saved = new Map<string, PropertyDescriptor | undefined>();
    const install = (name: string, value: unknown) => {
        saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    };
    t.after(() => { for (const [name, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
    } });
    // Heights are injected boundary measurements, not estimates of browser font wrapping.
    // Cover the longer story completion copy plus existing coin/navigation/storage suffixes.
    const statuses = [
        'Ossabravo descansou. A água ainda falta no bairro. Suba à Casa da Vazão.',
        'Ramal público aberto. Os moradores têm água na bica outra vez. Os gaps continuam.',
        'Pausa. Sua tentativa continua aqui.'
    ].map(status => `${status} Moedas: 9. Volte ao mapa para seguir. Conclusões salvas neste navegador.`);
    let naturalToolbar = 300, controlsHeight = 58, paddingTop = '6px';
    const nav = { style: { maxHeight: '' }, getBoundingClientRect: () => ({ height: Math.min(naturalToolbar, parseFloat(nav.style.maxHeight)) }) };
    const body = { style: { paddingTop: '', paddingBottom: '' } };
    install('document', { body, querySelector: () => nav,
        getElementById: () => ({ getBoundingClientRect: () => ({ height: controlsHeight }) }) });
    install('innerWidth', 472); install('innerHeight', 303);
    install('getComputedStyle', () => ({ paddingTop, paddingBottom: '6px', borderTopWidth: '0px', borderBottomWidth: '2px' }));
    const canvas = { style: { width: '', height: '' } } as HTMLCanvasElement;
    for (const status of statuses) {
        Object.assign(nav, { textContent: status });
        fitGuairaLabCanvas(canvas);
        assert.equal(nav.style.maxHeight, '143px'); assert.equal(canvas.style.height, '90px');
        const dimensions = JSON.stringify({ nav: nav.style, canvas: canvas.style, body: body.style });
        fitGuairaLabCanvas(canvas);
        assert.equal(JSON.stringify({ nav: nav.style, canvas: canvas.style, body: body.style }), dimensions,
            'repeated ResizeObserver measurements settle on the same dimensions');
    }
    assert.equal(body.style.paddingTop, '143px'); assert.equal(body.style.paddingBottom, '58px');
    // A wrapping control row and notch padding are measured independently of text length.
    controlsHeight = 110; paddingTop = '44px'; Object.assign(globalThis, { innerWidth: 240 });
    fitGuairaLabCanvas(canvas);
    assert.equal(nav.style.maxHeight, '96px'); assert.equal(canvas.style.height, '85px');
    close(parseFloat(canvas.style.width) * 9, 85 * 16);
    naturalToolbar = 58; controlsHeight = 58; paddingTop = '6px';
    Object.assign(globalThis, { innerWidth: 320, innerHeight: 480 });
    fitGuairaLabCanvas(canvas);
    assert.equal(canvas.style.width, '320px'); assert.equal(canvas.style.height, '180px');
    assert.equal(body.style.paddingTop, '58px'); assert.equal(body.style.paddingBottom, '58px');
});
