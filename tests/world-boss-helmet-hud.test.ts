import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldGame } from '../src/adventure/WorldGame';
import { FactorySalonSession } from '../src/adventure/factory/FactorySalonSession';
import { PLAYER_SPRITES } from '../src/assets/playerSpriteSpec';
import { fitText, textWidth } from '../src/graphics/BitmapFont';
import { guairaBrowser } from './helpers/guairaLabHarness';
import { juiceEpilogueBrowser } from './helpers/juiceEpilogueHarness';

function recordHelmetDraws(game: WorldGame) {
    const draws: number[][] = [], draw = game.renderer.drawHelmet.bind(game.renderer);
    game.renderer.drawHelmet = (x, y, context) => { draws.push([x, y]); draw(x, y, context); };
    return () => {
        const before = JSON.stringify({ player: game.player.data, boss: game.boss,
            save: game.store.save, time: game.time, elapsed: game.elapsed, state: game.state });
        draws.length = 0; game.render();
        assert.equal(JSON.stringify({ player: game.player.data, boss: game.boss,
            save: game.store.save, time: game.time, elapsed: game.elapsed, state: game.state }), before,
        'Rendering equipment status must not alter the simulation or save.');
        return draws.filter(([, y]) => y === 0 || y === 4);
    };
}

for (const reducedMotion of [false, true]) for (const world of [1, 2, 3, 4, 5, 6])
    test(`campaign boss ${world}-5 keeps its existing helmet marker through pickup/loss (${reducedMotion ? 'reduced' : 'normal'} motion)`, t => {
        const h = guairaBrowser(t, { reducedMotion });
        const game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true), id = `${world}-5`;
        game.store.save.seen.push(`intro:${id}`); game.load(id);
        const render = recordHelmetDraws(game);
        assert.equal(game.player.data.hasHelmet, false);
        assert.deepEqual(render(), []);

        // The authored helmet is four ordinary right-key frames from the spawn.
        h.window.dispatch('keydown', { code: 'ArrowRight', key: 'ArrowRight', target: h.canvas });
        for (let frame = 0; frame < 20 && !game.player.data.hasHelmet; frame++) game.update(1000 / 60);
        h.window.dispatch('keyup', { code: 'ArrowRight', key: 'ArrowRight', target: h.canvas });
        assert.equal(game.player.data.hasHelmet, true, 'Collect the real authored pickup using production input and physics.');
        for (let repeat = 0; repeat < 3; repeat++) assert.deepEqual(render(), [[143, 0]]);

        // The boss name moved to its contextual row; equipment fits the compact plaque.
        const label = fitText(game.boss!.name, 70);
        assert.equal(label, game.boss!.name);
        assert.ok(72 + textWidth(label) < 169);
        assert.ok(143 + PLAYER_SPRITES.helmet[0].length < 164);
        assert.ok(4 + PLAYER_SPRITES.helmet.length < 16);

        assert.deepEqual(game.player.takeDamage(), { damaged: false, helmetUsed: true });
        assert.equal(game.player.data.hasHelmet, false);
        assert.deepEqual(render(), [], 'Spent protection must immediately disappear from the header.');
        assert.deepEqual(game.player.takeDamage(), { damaged: false, helmetUsed: false });
        assert.deepEqual(render(), [], 'Invincibility after the hit must not restore a spent helmet marker.');
    });

test('ordinary campaign stage retains the same single marker for pickup and damage', t => {
    const h = guairaBrowser(t), game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
    game.load('1-1');
    const render = recordHelmetDraws(game);
    assert.deepEqual(render(), []);
    const item = game.stage.pickups.find(pickup => pickup.kind === 'helmet')!;
    game.player.data.position = { x: item.x, y: item.y };
    game.player.data.velocity = { x: 0, y: 0 };
    game.update(1000 / 60);
    assert.equal(game.player.data.hasHelmet, true);
    assert.deepEqual(render(), [[143, 0]]);
    assert.deepEqual(game.player.takeDamage(), { damaged: false, helmetUsed: true });
    assert.deepEqual(render(), []);
});

test('Ossabravo keeps only its existing custom helmet position', t => {
    const h = guairaBrowser(t), game = h.create(), render = recordHelmetDraws(game);
    assert.equal(game.player.data.hasHelmet, true);
    // This scene repaints its own header after the native transition, as before.
    assert.deepEqual(render(), [[279, 4], [279, 4]]);
    game.player.takeDamage();
    assert.deepEqual(render(), []);
});

test('the salon custom HUD does not acquire an underlying campaign helmet marker', t => {
    const h = juiceEpilogueBrowser(t);
    const game = new FactorySalonSession(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
    game.skipIntro();
    const render = recordHelmetDraws(game);
    assert.equal(game.player.data.hasHelmet, false);
    assert.deepEqual(render(), []);
    // This optional arena authors no equipment pickup. Also protect the custom
    // HUD override if an equipped player is ever supplied by a host.
    game.player.collectHelmet();
    assert.deepEqual(render(), []);
    game.player.takeDamage();
    assert.deepEqual(render(), []);
});
