import test from 'node:test';
import assert from 'node:assert/strict';
import { FACTORY_SALON, atFactorySalon, recordSalonVictory } from '../src/adventure/factory/FactorySalon';
import { FactorySalonSession } from '../src/adventure/factory/FactorySalonSession';
import { freshSave, parseSave, isUnlocked, finishStage } from '../src/adventure/progress';
import { STAGES } from '../src/adventure/campaign';
import { TileType } from '../src/constants';
import { juiceEpilogueBrowser, replayJuiceVictory, STEP } from './helpers/juiceEpilogueHarness';

test('salon entrance occupies an existing safe checkpoint landing; campaign boss and secret remain intact', () => {
    const stage = STAGES.find(s => s.id === FACTORY_SALON.stage)!;
    const { door, support } = FACTORY_SALON;
    for (let x = support.x; x < support.x + support.width; x += 16)
        assert.equal(stage.level.tiles[support.y / 16][x / 16], TileType.GROUND);
    assert.ok(stage.checkpoints.some(cp => cp.x * 16 >= support.x && cp.x * 16 < door.x));
    assert.equal(atFactorySalon('3-3', door, true), true);
    assert.equal(atFactorySalon('3-3', door, false), false);
    assert.equal(atFactorySalon('3-5', door, true), false);
    assert.equal(atFactorySalon('3-3', { ...door, x: 20 }, true), false);
    assert.equal(STAGES.find(s => s.id === '3-5')!.encounter, 'C1');
    assert.equal(stage.exits.filter(e => e.id === 'secret').length, 1);
});

test('v1 save preserves checkpoint, records, seals and unlocks; optional result is idempotent and exported', () => {
    const old = freshSave();
    old.completed = ['2-5', '3-1', '3-2']; old.selected = '3-3';
    old.checkpoint = { stage: '3-3', index: 1, helmet: true };
    old.seals = ['3-3:s1']; old.times = { '3-2': 80 };
    const save = parseSave(JSON.stringify(old));
    assert.equal(isUnlocked('3-3', save), true);
    assert.equal(isUnlocked('3-4', save), false);
    assert.equal(recordSalonVictory(save), true);
    assert.equal(recordSalonVictory(save), false);
    assert.deepEqual({ ...save, seen: [] }, old);
    assert.deepEqual(parseSave(JSON.stringify(save)), save);
    assert.equal(isUnlocked('3-4', save), false);
    finishStage(save, '3-3', 'normal', 99);
    assert.equal(isUnlocked('3-4', save), true);
    assert.equal(save.selected, '3-4');
    const secret = parseSave(JSON.stringify(old));
    finishStage(secret, '3-3', 'secret', 99);
    assert.equal(isUnlocked('3-5', secret), true);
    const full = freshSave(); full.seen = Array.from({length: 200}, (_, i) => `legacy:${i}`);
    const flags = full.seen.slice(); recordSalonVictory(full);
    assert.deepEqual(parseSave(JSON.stringify(full)).seen, [FACTORY_SALON.victory, ...flags]);
});

test('campaign session earns result through six real hits, landing and existing epilogue; pause/retry invalidate stale results', t => {
    const h = juiceEpilogueBrowser(t);
    const game = new FactorySalonSession(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
    assert.equal(game.victorious, false);
    assert.equal(game.epilogue.skip(), false);
    game.skipIntro();
    replayJuiceVictory(h, game);
    assert.equal(game.victorious, false);
    assert.equal(game.earnedVictory, true, 'A real defeated boss remains earned during the final bounce');
    for (let n = 0; n < 120 && !game.epilogue.frame; n++) game.update(STEP);
    assert.ok(game.epilogue.frame);
    h.window.dispatch('blur');
    const before = game.epilogue.frame;
    game.update(100);
    assert.deepEqual(game.epilogue.frame, before);
    assert.equal(game.epilogue.skip(), false);
    game.toggleLabPause();
    for (let n = 0; n < 65; n++) game.update(100);
    assert.equal(game.victorious, true);
    let liveText = '', liveWrites = 0;
    const liveStatus = {
        get textContent() { return liveText; },
        set textContent(value: string) { liveText = value; liveWrites++; }
    };
    for (let n = 0; n < 5; n++) {
        game.render();
        game.reflectCampaignStatus(liveStatus, h.status.textContent);
    }
    assert.equal(liveWrites, 1, 'completed epilogue must not repeatedly mutate the live region');
    assert.match(liveText, /Voltando à fase/);
    assert.notEqual(h.status.textContent, liveText, 'native lab and campaign status remain separate');
    game.load('juice-lab');
    assert.equal(game.victorious, false);
    assert.equal(game.readyToReturn, false);
    assert.equal(game.earnedVictory, true, 'Retry cannot revoke an earned win');
    assert.equal(game.epilogue.skip(), false);
    game.replayIntro();
    assert.equal(game.labMode, 'intro');
    game.dispose();
    assert.equal(game.victorious, false);
});

test('salon inherits campaign mute and isolated preferences, including reduced motion', t => {
    const h = juiceEpilogueBrowser(t, true);
    const game = new FactorySalonSession(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
    const campaign = { enabled: false, preferences: { ...freshSave().preferences, shake: true } };
    game.inheritCampaignAudio(campaign);
    assert.equal(game.audio.enabled, false);
    assert.equal(game.audio.preferences.shake, false);
    assert.equal(campaign.preferences.shake, true);
    assert.notEqual(game.audio.preferences, campaign.preferences);
    assert.equal(game.audio.preferences, game.store.save.preferences);
    game.audio.toggle();
    game.audio.preferences.music = 0;
    assert.equal(campaign.enabled, false);
    assert.notEqual(campaign.preferences.music, 0);
    game.inheritCampaignAudio({ ...campaign, enabled: true });
    assert.equal(game.audio.enabled, true);
    game.dispose();
});
