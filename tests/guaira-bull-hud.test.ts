import assert from 'node:assert/strict';
import test from 'node:test';
import { GuairaBullEncounter, GuairaBullLab } from '../src/adventure/experimental/guaira/GuairaBullLab';
import { BULL_RULES } from '../src/adventure/experimental/guaira/SkeletonBullModel';
import { PLAYER_RENDER_OFFSET_Y } from '../src/assets/playerSpriteSpec';
import { pixelText, textWidth } from '../src/graphics/BitmapFont';
import { guairaBrowser } from './helpers/guairaLabHarness';

function raster() {
    const pixels = new Map<string, string>(), rectangles: number[][] = [];
    let color = '';
    const c = {
        get fillStyle() { return color; }, set fillStyle(value: string) { color = value; },
        fillRect(x: number, y: number, width: number, height: number) {
            rectangles.push([x, y, width, height]);
            for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++)
                pixels.set(`${xx},${yy}`, color);
        },
        drawImage() {},
    } as unknown as CanvasRenderingContext2D;
    return { c, pixels, rectangles };
}
function drawHud(game: GuairaBullLab, c: CanvasRenderingContext2D) {
    (game as unknown as { renderEncounterHud(c: CanvasRenderingContext2D): void }).renderEncounterHud(c);
}
function state(game: GuairaBullLab) {
    return structuredClone({ player: game.player.data, boss: (game.boss as GuairaBullEncounter).model,
        camera: game.camera, time: game.time, elapsed: game.elapsed, state: game.state });
}

test('all Ossabravo warnings, name and six health marks fit the existing header at native bitmap scale', t => {
    const h = guairaBrowser(t), game = h.create(), boss = game.boss as GuairaBullEncounter;
    const hints = new Set<string>();
    for (const phase of ['intro', 'idle', 'tell', 'charge', 'brake', 'recover', 'rattle', 'bones', 'hurt', 'defeated'] as const) {
        boss.model.state = phase;
        const before = state(game), actual = raster(), expected = raster();
        drawHud(game, actual.c);
        assert.deepEqual(state(game), before, 'HUD cannot modify the simulation');
        for (const [x, y, width, height] of actual.rectangles) {
            assert.ok([x, y, width, height].every(Number.isInteger));
            assert.ok(x >= 0 && x + width <= 320 && y >= 0 && y + height <= 23,
                `${phase}: header paint must never enter the arena`);
        }
        pixelText(expected.c, boss.hint, 8, 13, '#f0ddae');
        pixelText(expected.c, 'OSSABRAVO', 60, 3, '#f0ddae');
        for (const [pixel, color] of expected.pixels) assert.equal(actual.pixels.get(pixel), color, `${phase}: full glyph at ${pixel}`);
        assert.ok(textWidth(boss.hint) <= 267, 'full hint fits before helmet/pause with no truncation');
        for (let i = 0; i < 6; i++) assert.equal(actual.pixels.get(`${123 + i * 16},5`), '#f1a479');
        hints.add(boss.hint);
        game.render(); assert.ok(h.status.textContent.includes(boss.hint), 'active status retains the same actionable hint');
    }
    assert.equal(hints.size, 5);
});

test('spent health stays countable and helmet marker follows real helmet loss', t => {
    const h = guairaBrowser(t), game = h.create(), boss = game.boss as GuairaBullEncounter;
    const helmets: number[][] = [];
    game.renderer.drawHelmet = (x, y) => { helmets.push([x, y]); };
    for (let health = 6; health >= 0; health--) {
        boss.health = health;
        const actual = raster(); drawHud(game, actual.c);
        for (let i = 0; i < 6; i++) assert.equal(actual.pixels.get(`${123 + i * 16},5`), i < health ? '#f1a479' : '#66505a');
    }
    assert.deepEqual(helmets, Array.from({ length: 7 }, () => [279, 4]));
    game.player.takeDamage(); drawHud(game, raster().c); assert.equal(helmets.length, 7);
});

for (const hold of [1, 34]) test(`ordinary ${hold === 1 ? 'short' : 'held'} jump keeps helmet/body below every HUD pixel`, t => {
    const h = guairaBrowser(t), game = h.create();
    h.window.dispatch('keydown', { key: ' ', code: 'Space', target: h.canvas });
    for (let frame = 1; frame <= 65; frame++) {
        if (frame === hold + 1) h.window.dispatch('keyup', { key: ' ', code: 'Space', target: h.canvas });
        game.update(BULL_RULES.tickMs);
        const before = state(game), actual = raster(); drawHud(game, actual.c); game.render();
        assert.deepEqual(state(game), before);
        const visualTop = Math.round(game.player.data.position.y) - Math.round(game.camera.y) + PLAYER_RENDER_OFFSET_Y - 2;
        assert.ok(visualTop >= 23, `helmet and full native body clear the existing header at frame ${frame}`);
        for (const [, y, , height] of actual.rectangles) assert.ok(y + height <= visualTop);
    }
});

test('paused and chapter victory summaries remain local and rendering stays read-only', t => {
    const h = guairaBrowser(t), game = new GuairaBullLab(h.canvas as unknown as HTMLCanvasElement,
        h.status as unknown as HTMLElement, 'CONTINUAR: VOLTAR A MAQUETE');
    game.toggleLabPause(); const paused = state(game);
    for (let i = 0; i < 4; i++) { game.update(100); game.render(); }
    assert.deepEqual(state(game), paused); assert.match(h.status.textContent, /Pausado/);
    game.toggleLabPause();
    const boss = game.boss as GuairaBullEncounter;
    boss.model.health = 1; boss.model.state = 'recover';
    game.player.data.position = { x: boss.model.x + 12, y: boss.model.y - game.player.data.height - 1 };
    game.player.data.velocity = { x: 0, y: 2 }; game.player.data.isGrounded = false;
    game.update(BULL_RULES.tickMs); assert.equal(boss.phase, 'defeated');
    const before = state(game); game.render(); assert.deepEqual(state(game), before);
    assert.match(h.status.textContent, /Vitória/); assert.equal(game.canAdvanceToAscent, true);
});


test('local header remains above the native player transition as before', t => {
    const h = guairaBrowser(t), game = h.create(), calls: string[] = [];
    const hud = game as unknown as { renderEncounterHud(c: CanvasRenderingContext2D): void };
    const renderHud = hud.renderEncounterHud.bind(game);
    hud.renderEncounterHud = c => { calls.push('header'); renderHud(c); };
    game.renderer.drawPlayerTransition = () => { calls.push('transition'); };
    game.render();
    assert.ok(calls.includes('transition'));
    assert.ok(calls.lastIndexOf('header') > calls.lastIndexOf('transition'));
});
