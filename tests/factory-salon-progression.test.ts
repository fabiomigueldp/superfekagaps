import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldGame } from '../src/adventure/WorldGame';
import { FactorySalonSession } from '../src/adventure/factory/FactorySalonSession';
import { FACTORY_SALON, hasSalonPassage, recordSalonPassage, requiresSalonPassage } from '../src/adventure/factory/FactorySalon';
import { freshSave, parseSave, ProgressStore, SAVE_KEY } from '../src/adventure/progress';
import { campaignJournal } from '../src/adventure/CampaignJournal';
import { STAGES } from '../src/adventure/campaign';
import { juiceEpilogueBrowser, STEP } from './helpers/juiceEpilogueHarness';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';
import { auditRoute } from './helpers/worldRoutes';

// Exercise the shared production completion/flag hooks without a DOM host.
// FactoryCampaign alone opts in; a bare editor WorldGame deliberately does not.
class PassageCampaign extends WorldGame {
    protected override requiresCampaignPassage() { return requiresSalonPassage(this.stage.id, this.store.save); }
}

test('only actual participation grants passage; selected stage and ordinary unlocks do not', () => {
    const save = freshSave();
    save.completed = ['2-5', '3-1', '3-2']; save.selected = '6-5';
    const before = JSON.stringify(save);
    assert.equal(requiresSalonPassage('3-3', save), true);
    assert.equal(requiresSalonPassage('3-4', save), false);
    assert.equal(hasSalonPassage(save), false);
    assert.equal(JSON.stringify(save), before, 'reading the gate never fabricates a milestone');
    assert.equal(recordSalonPassage(save), true);
    assert.equal(recordSalonPassage(save), false);
    assert.equal(requiresSalonPassage('3-3', save), false);
    assert.deepEqual({ ...save, seen: [] }, JSON.parse(before));
    assert.equal(save.seen.includes(FACTORY_SALON.victory), false);
    assert.deepEqual(save.seen, [FACTORY_SALON.passage]);
});

test('old completed routes, secret routes and actual victories stay earned without retroactive flags', () => {
    for (const completed of ['3-3', '3-4', '3-5', '4-1', '6-5']) {
        const save = freshSave(); save.completed.push(completed);
        assert.equal(requiresSalonPassage('3-3', save), false, completed);
        assert.equal(hasSalonPassage(save), false);
        assert.deepEqual(save.seen, []);
    }
    const secret = freshSave(); secret.secrets = ['3-3'];
    assert.equal(requiresSalonPassage('3-3', secret), false);
    const victory = freshSave(); victory.seen = [FACTORY_SALON.victory];
    assert.equal(hasSalonPassage(victory), true);
    assert.equal(recordSalonPassage(victory), false, 'an already-proven visit needs no invented new flag');
    assert.deepEqual(victory.seen, [FACTORY_SALON.victory]);
});

test('both 3-3 exits block before participation and complete normally afterwards', t => {
    const h = sceneLifecycleBrowser(t), game = new PassageCampaign(h.canvas as unknown as HTMLCanvasElement, true);
    t.after(() => game.dispose());
    for (const kind of ['normal', 'secret'] as const) {
        game.store.save = freshSave(); game.load('3-3');
        const exit = game.stage.exits.find(exit => exit.id === kind)!;
        Object.assign(game.player.data.position, { x: exit.x, y: exit.y + exit.height - game.player.data.height });
        Object.assign(game.player.data, { isGrounded: true, respawnRevealTimer: 0 });
        for (let n = 0; n < 3; n++) game.update(STEP);
        assert.equal(game.state, 'playing', `${kind} must be locked`);
        assert.deepEqual(game.store.save.completed, []);
        assert.deepEqual(game.store.save.secrets, []);
        assert.match((game as unknown as { toast: string }).toast, /SALÃO/);
        recordSalonPassage(game.store.save);
        game.update(STEP);
        assert.equal(game.state, 'clear', `${kind} becomes usable in the same attempt`);
        assert.deepEqual(game.store.save.completed, ['3-3']);
        assert.deepEqual(game.store.save.secrets, kind === 'secret' ? ['3-3'] : []);
    }
});

test('bare WorldGame editor preview has no impossible salon requirement', t => {
    const h = sceneLifecycleBrowser(t), game = new WorldGame(h.canvas as unknown as HTMLCanvasElement, true);
    t.after(() => game.dispose()); game.load('3-3');
    const exit = game.stage.exits.find(exit => exit.id === 'normal')!;
    Object.assign(game.player.data.position, { x: exit.x, y: exit.y + exit.height - game.player.data.height });
    Object.assign(game.player.data, { isGrounded: true, respawnRevealTimer: 0 });
    game.update(STEP);
    assert.equal(game.state, 'clear');
    assert.deepEqual(game.store.save.seen, []);
});

test('real walk and pose, not doorway arrival or waiting, grants a sticky campaign passage', t => {
    let game: FactorySalonSession;
    t.after(() => game?.dispose());
    const h = juiceEpilogueBrowser(t);
    game = new FactorySalonSession(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
    assert.equal(game.presentedAtChampionship, false);
    for (let n = 0; n < 31; n++) game.update(100);
    assert.equal(game.intro?.beat, 'walk');
    assert.equal(game.presentedAtChampionship, false);
    h.window.dispatch('keydown', { key: 'ArrowRight', code: 'ArrowRight', target: h.canvas });
    for (let n = 0; n < 25; n++) game.update(100);
    h.window.dispatch('keyup', { key: 'ArrowRight', code: 'ArrowRight', target: h.canvas });
    assert.equal(game.intro?.beat, 'prepare');
    assert.equal(game.presentedAtChampionship, false);
    game.presentIntro(); game.update(100);
    assert.equal(game.intro?.beat, 'reveal');
    assert.equal(game.presentedAtChampionship, true);
    assert.equal(game.victorious, false);
    game.load('juice-lab');
    assert.equal(game.presentedAtChampionship, true, 'retry cannot revoke the pass');
    game.replayIntro();
    assert.equal(game.presentedAtChampionship, true, 'replaying cannot revoke the pass');
});

test('early return, explicit skip, interruption and reentry have distinct outcomes', t => {
    const h = juiceEpilogueBrowser(t), make = () => new FactorySalonSession(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
    const abandoned = make(); abandoned.update(100); abandoned.dispose();
    assert.equal(abandoned.presentedAtChampionship, false);
    const retry = make();
    assert.equal(retry.presentedAtChampionship, false);
    retry.skipIntro();
    assert.equal(retry.presentedAtChampionship, true);
    assert.equal(retry.victorious, false);
    const save = freshSave(); recordSalonPassage(save);
    retry.dispose();
    const returned = make(); returned.inheritCampaignPassage(hasSalonPassage(parseSave(JSON.stringify(save))));
    assert.equal(returned.presentedAtChampionship, true);
    returned.replayIntro(); assert.equal(returned.presentedAtChampionship, true);
    returned.dispose();
    const arbitraryRetry = make(); arbitraryRetry.load('juice-lab');
    assert.equal(arbitraryRetry.presentedAtChampionship, false, 'loading the combat scene is not a presentation');
    arbitraryRetry.dispose();
    const legacy = make(); legacy.inheritCampaignPassage(false, false);
    assert.equal(legacy.needsCampaignPresentation, false, 'earned legacy route carries no new obligation');
    assert.equal(legacy.presentedAtChampionship, false, 'earned access is not a newly recorded presentation');
    legacy.dispose();
});

test('full legacy journals retain all ordinary flags plus both salon facts in any order', () => {
    const ordinary = Array.from({ length: 201 }, (_, i) => `legacy:${i}`);
    for (const seen of [[...ordinary, FACTORY_SALON.passage, FACTORY_SALON.victory],
        [FACTORY_SALON.passage, FACTORY_SALON.victory, ...ordinary]]) {
        const save = freshSave(); save.seen = seen;
        save.checkpoint = { stage: '3-3', index: 1, helmet: true };
        save.seals = ['3-3:s1']; save.times = { '3-2': 80 };
        assert.deepEqual(parseSave(JSON.stringify(save)), save);
        let raw = JSON.stringify(save);
        const store = new ProgressStore({ getItem: key => key === SAVE_KEY ? raw : null, setItem: (_key, value) => { raw = value; } });
        assert.equal(store.persist(), true);
        assert.equal(store.import(raw), true);
        assert.deepEqual(store.save, save);
    }
});

test('authored guidance precedes both route endings and journal points to the required presentation', () => {
    const stage = STAGES.find(stage => stage.id === '3-3')!;
    const reason = stage.dialogues.find(dialogue => /Só passa ao Controle de Qualidade/.test(dialogue.text))!;
    assert.ok(reason.x < FACTORY_SALON.door.x);
    assert.ok(stage.exits.every(exit => reason.x < exit.x));
    assert.ok(stage.dialogues.some(dialogue => /Yasmin/.test(dialogue.text)));
    const save = freshSave(); save.selected = '3-3';
    assert.match(campaignJournal(save).objective, /Apresente-se no salão/);
    recordSalonPassage(save);
    assert.match(campaignJournal(save).objective, /Conclua Controle de Qualidade/);
});


test('both authored routes can return to the salon and continue after presenting', () => {
    const original = STAGES.find(stage => stage.id === FACTORY_SALON.stage)!;
    const starts = [{ x: FACTORY_SALON.door.x, y: FACTORY_SALON.support.y },
        ...original.exits.map(exit => ({ x: exit.x, y: exit.y + exit.height }))];
    for (const start of starts) {
        const stage = structuredClone(original);
        stage.level.playerSpawn = { x: start.x / 16, y: start.y / 16 };
        // Real Player/collision local jumps plus authored carrier endpoints. This
        // checks recovery geometry; timed moving-carrier play remains a browser QA.
        const route = auditRoute(stage);
        const reachable = (x: number, floor: number) => route.surfaces.some((surface, i) =>
            route.reached.includes(i) && x >= surface.x && x < surface.x + surface.width && Math.abs(floor - surface.y) < 9);
        assert.equal(reachable(FACTORY_SALON.door.x, FACTORY_SALON.support.y), true, `salon reachable from ${start.x}`);
        assert.equal(route.ok, true, `normal continuation from ${start.x}`);
        const secret = stage.exits.find(exit => exit.id === 'secret')!;
        assert.equal(reachable(secret.x, secret.y + secret.height), true, `secret continuation from ${start.x}`);
    }
});
