import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldGame } from '../src/adventure/WorldGame';
import { STAGES } from '../src/adventure/campaign';
import { CAMPAIGN_FINISH_REWARDS } from '../src/adventure/campaignFinishRewards';
import { CAMPAIGN_JUMP_COINS } from '../src/adventure/campaignJumpCoins';
import { ProgressStore } from '../src/adventure/progress';
import { WorldTutorial } from '../src/adventure/WorldTutorial';
import { isSolidTile } from '../src/world/tileRules';
import baseline from './fixtures/campaign-pickups-before-jump-coins.json';
import type { AdventureStage } from '../src/adventure/types';

const noop = () => {};
const idle = { left: false, right: true, run: false, jump: false, down: false, start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
/** Real WorldGame pickup/completion ordering, real Player, objects and foes.
 * Start on the quiet final bank, not a claim of an entire-stage playthrough. */
function approach(stage: AdventureStage, run: boolean) {
    const game = Object.create(WorldGame.prototype) as any;
    const store = new ProgressStore({ getItem: () => null, setItem: noop });
    Object.assign(game, { store, tutorial: new WorldTutorial(store),
        input: { reset: noop, setMenuMode: noop, update: noop, consumeMute: () => false, consumePause: () => false, getState: () => ({ ...idle, run }) },
        audio: new Proxy({}, { get: () => noop }), renderer: { advanceClock: noop, addImpact: noop },
        camera: { x: 0, y: 0, shakeTimer: 0 }, state: 'title', time: 0, toastTimer: 0, buttons: [] });
    game.load(stage.id, false, stage);
    game.spoken = new Set(stage.dialogues.map(d => d.id));
    const exit = stage.exits.find(e => e.id === 'normal')!;
    const [id, x] = CAMPAIGN_FINISH_REWARDS[stage.id];
    let bankLeft = Math.floor(exit.x / 16);
    while (bankLeft > 0 && isSolidTile(stage.level.tiles[14][bankLeft - 1]) && !isSolidTile(stage.level.tiles[13][bankLeft - 1])) bankLeft--;
    // The final citadel bank begins at the moved coin: approach from its actual
    // preceding catwalk and drop 32 px, instead of spawning inside the reward.
    const fromCatwalk = x === bankLeft * 16;
    game.player.data.position = { x: fromCatwalk ? x - 16 : Math.max(bankLeft * 16, x - 24), y: (fromCatwalk ? 192 : 224) - game.player.data.height };
    game.player.data.respawnRevealTimer = 0;
    game.player.data.isGrounded = true;
    let collectedBeforeExit = false;
    for (let i = 0; i < 120 && game.state === 'playing'; i++) {
        game.update(1000 / 60);
        assert.equal(game.player.data.isDead, false);
        assert.equal(game.player.data.invincibleTimer, 0, 'The quiet approach does not require damage.');
        if (game.collected.has(id) && game.state === 'playing') collectedBeforeExit = true;
    }
    return { game, collectedBeforeExit };
}

test('24 reviewed finish coins preserve identities, rewards and safe approach spacing', () => {
    assert.equal(Object.keys(CAMPAIGN_FINISH_REWARDS).length, 24);
    for (const stage of STAGES.filter(s => !s.encounter)) {
        const [id, x, y] = CAMPAIGN_FINISH_REWARDS[stage.id], exit = stage.exits[0];
        const old = (baseline as Record<string, (string | number)[][]>)[stage.id];
        assert.deepEqual(old.find(p => p[0] === id), [id, 'coin', exit.x + 16, exit.y + 8]);
        assert.deepEqual(stage.pickups.find(p => p.id === id), { id, kind: 'coin', x, y });
        assert.ok(!(CAMPAIGN_JUMP_COINS[stage.id] ?? []).some(p => p[0] === id));
        assert.ok(x + 16 <= exit.x - 16, 'Leave flag cloth and trigger visually distinct.');
        assert.equal(y, exit.y + 8);
        assert.ok(isSolidTile(stage.level.tiles[14][Math.floor(x / 16)]));
        for (const other of stage.pickups.filter(p => p.id !== id))
            assert.ok(Math.hypot(x - other.x, y - other.y) >= 22, `${id}: overlaps ${other.id}`);
    }
});
for (const stage of STAGES.filter(s => !s.encounter)) for (const run of [false, true]) {
    test(`${stage.id}: ${run ? 'running' : 'walking'} earns the finish coin before automatic completion`, () => {
        const after = approach(stage, run);
        assert.equal(after.game.state, 'clear');
        assert.equal(after.collectedBeforeExit, true);
        const [id] = CAMPAIGN_FINISH_REWARDS[stage.id], before = structuredClone(stage);
        before.pickups.find(p => p.id === id)!.x = stage.exits[0].x + 16;
        const historical = approach(before, run);
        assert.equal(historical.game.state, 'clear');
        assert.equal(historical.game.collected.has(id), false, 'The old ordinary approach finishes before this reward.');
    });
}
