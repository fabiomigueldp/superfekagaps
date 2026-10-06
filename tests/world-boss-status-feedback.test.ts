import assert from 'node:assert/strict';
import test from 'node:test';
import { BossEncounter } from '../src/adventure/BossEncounter';
import { WorldGame } from '../src/adventure/WorldGame';
import { fitText, pixelText } from '../src/graphics/BitmapFont';
import { guairaBrowser } from './helpers/guairaLabHarness';

const tick = 1000 / 60;
const victory = 'CHEFE VENCIDO!';
const activeHints = [
    ['J1', 'SAIA DA MARCAÇÃO'], ['B1', 'LEVANTE UM APOIO'], ['C1', 'INVERTA A ESTEIRA'],
    ['B2', 'ATIVE OS APOIOS E SUBA'], ['C2', 'GELO DA ESQUERDA'], ['J2', 'ATRAIA O GOLPE ATÉ O APOIO']
] as const;

test('active campaign fight instructions keep their existing phase and warning priorities', () => {
    for (const [id, hint] of activeHints) {
        const boss = new BossEncounter(id);
        for (const phase of ['rest', 'warning', 'attack', 'hurt'] as const) {
            boss.phase = phase;
            assert.equal(boss.hint, hint);
        }
        boss.phase = 'open';
        assert.equal(boss.hint, 'AGORA! PULE NA CABEÇA');
    }
    const joao = new BossEncounter('J1');
    joao.pattern = 'leap'; joao.phase = 'warning';
    assert.equal(joao.hint, 'SALTO! SAIA DA SOMBRA');
    const biel = new BossEncounter('B1');
    biel.pattern = 'doubleCargo'; biel.phase = 'attack';
    assert.equal(biel.hint, 'DUAS CARGAS. DOIS AVISOS');
    const cold = new BossEncounter('C2');
    cold.cycle = 1;
    assert.equal(cold.hint, 'GELO DA DIREITA');
    const final = new BossEncounter('J2');
    final.health = 2;
    assert.equal(final.hint, 'ONDA NO CHÃO! PULE');
});

for (const reducedMotion of [false, true]) for (const world of [1, 2, 3, 4, 5, 6])
    test(`${world}-5 shows victory through the real final-hit transition (${reducedMotion ? 'reduced' : 'normal'} motion)`, t => {
        const h = guairaBrowser(t, { reducedMotion });
        const game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true), id = `${world}-5`;
        game.store.save.seen.push(`intro:${id}`); game.load(id);
        // Only the browser speech boundary is stubbed; contact, update, render,
        // hit-stop and the delayed campaign completion are production code.
        t.mock.method(game.audio, 'say', () => {});
        const boss = game.boss!;
        boss.phase = 'open'; boss.health = 1;
        game.player.data.position = { x: boss.x + 4, y: boss.y - game.player.data.height - 1 };
        game.player.data.velocity = { x: 0, y: 2 }; game.player.data.isGrounded = false;
        game.update(tick);
        assert.equal(boss.phase, 'defeated'); assert.equal(boss.health, 0);
        assert.equal(game.state, 'playing', 'Victory feedback precedes the delayed results screen.');
        assert.equal(boss.hint, victory);
        assert.equal(fitText(victory, 184), victory);
        assert.equal(game.store.save.completed.includes(id), false);

        const context = game.renderer.getContext(), pixels: number[][] = [], expected: number[][] = [];
        const fill = context.fillRect.bind(context);
        context.fillRect = (x: number, y: number, width: number, height: number) => {
            if (context.fillStyle === '#e5d6c3' && y >= 40 && y <= 46) pixels.push([x, y, width, height]);
            fill(x, y, width, height);
        };
        t.after(() => { context.fillRect = fill; });
        pixelText({ fillRect: (...rect: number[]) => expected.push(rect) } as unknown as CanvasRenderingContext2D,
            victory, 160, 40, '#e5d6c3', 1, 'center');
        assert.ok(expected.every(([x, y, width, height]) => x >= 68 && x + width <= 252 && y >= 40 && y + height <= 47));

        let frames = 0;
        while (game.state === 'playing' && frames++ < 90) {
            // Sample the hit-stop, its release, the middle and the final hold.
            if ([1, 6, 38, 74].includes(frames)) {
                const before: string = JSON.stringify({ boss, player: game.player.data, save: game.store.save,
                    time: game.time, elapsed: game.elapsed, state: game.state });
                pixels.length = 0; game.render();
                assert.deepEqual(pixels, expected, 'The full victory message is painted inside the existing native HUD.');
                assert.equal(JSON.stringify({ boss, player: game.player.data, save: game.store.save,
                    time: game.time, elapsed: game.elapsed, state: game.state }), before, 'Feedback must remain read-only.');
            }
            assert.equal(game.store.save.completed.includes(id), false);
            assert.equal(boss.hint, victory);
            game.update(tick);
        }
        assert.equal(game.state, 'clear');
        assert.ok(frames >= 73 && frames <= 75, 'The original 70 ms hit-stop and 1150 ms defeat delay remain intact.');
        assert.equal(game.store.save.completed.filter(stage => stage === id).length, 1);

        game.load(id);
        assert.equal(game.boss!.health, game.boss!.maxHealth);
        assert.equal(game.boss!.hint, activeHints[world - 1][1], 'Replay restores the live encounter instruction.');
    });
