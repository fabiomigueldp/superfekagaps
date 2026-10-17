import test from 'node:test';
import assert from 'node:assert/strict';
import { freshSave, isUnlocked, ProgressStore, SAVE_KEY } from '../src/adventure/progress';
import { freshDeliciaSave } from '../src/adventure/delicia/DeliciaProgress';
import { GUAIRA_CAMPAIGN_ART } from '../src/adventure/GuairaCampaignArt';
import { GUAIRA_MAP_DEPTH } from '../src/adventure/GuairaMapJourney';
import { chapterMapStages } from '../src/adventure/WorldChapterMap';
import { GuairaChapterSession, type GuairaChapterLiveResult } from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import { freshGuairaChapterProgress, guairaAlternateOpening, mergeGuairaChapterProgress, sanitizeGuairaChapterProgress } from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';

for (const opening of ['guaira-travessia', 'guaira-patio-comportas'] as const) {
    const alternate = guairaAlternateOpening(opening);
    test(`${opening}: the second entrance is exploration, not a sixth required receipt or a shortcut to the boss`, () => {
        const save = freshSave(); save.completed = ['3-5'];
        save.guaira = { ...save.guaira, opening, completed: [opening], selectedScene: 'guaira-respiros' };
        const session = new GuairaChapterSession({ progress: save.guaira });
        const stages = chapterMapStages('guaira', save, freshDeliciaSave());
        assert.equal(stages.length, 8);
        assert.equal(stages.find(s => s.id === alternate)?.open, true);
        assert.equal(stages.find(s => s.id === alternate)?.label, 'D');
        session.selectScene(alternate, session.snapshot().generation);
        const attempt = session.enterScene(alternate, session.snapshot().generation)!;
        const live: GuairaChapterLiveResult = { attempt, state: 'playing', alive: true, result: { sceneId: alternate, kind: 'reached-finish' } };
        assert.equal(session.acceptCompletion(attempt, { ...live, alive: false }), false);
        assert.equal(session.acceptCompletion(attempt, { ...live, result: null }), false);
        assert.equal(session.acceptCompletion(attempt, live), true);
        const snapshot = session.continueFrom(attempt, live)!.snapshot;
        assert.equal(snapshot.alternateCompleted, true);
        assert.deepEqual(snapshot.accepted.map(r => r.sceneId), [opening]);
        assert.equal(snapshot.nextRecommendedScene, 'guaira-respiros');
        assert.equal(snapshot.selectedScene, 'guaira-respiros');
        assert.equal(session.canSelectScene('guaira-lab', snapshot.generation), false);
        assert.equal(session.acceptCompletion(attempt, live), false, 'stale completion cannot run twice');
        save.guaira = { ...save.guaira, alternateCompleted: true };
        assert.equal(isUnlocked('4-1', save), false, 'only the actual Prefeito outcome opens Serra');
        assert.equal(chapterMapStages('guaira', save, freshDeliciaSave()).find(s => s.id === alternate)?.completed, true);
    });
    test(`${opening}: reload, abandoned retry and stale tab merges retain only the earned side visit`, () => {
        const earned = { ...freshGuairaChapterProgress(), opening, completed: [opening], alternateCompleted: true as const,
            selectedScene: alternate, resumeScene: alternate };
        const restored = sanitizeGuairaChapterProgress(earned);
        assert.deepEqual(restored, earned);
        const session = new GuairaChapterSession({ progress: restored });
        assert.equal(session.snapshot().alternateCompleted, true);
        const attempt = session.enterScene(alternate, session.snapshot().generation)!;
        assert.ok(attempt); session.exitToMap(attempt, { attempt, state: 'paused', alive: true, result: null });
        assert.equal(session.snapshot().alternateCompleted, true);
        const stale = { ...freshGuairaChapterProgress(), opening, completed: [opening] };
        assert.equal(mergeGuairaChapterProgress(earned, stale).alternateCompleted, true);
        let stored = JSON.stringify({ ...freshSave(), completed: ['3-5'], guaira: earned });
        const storage = { getItem: (key: string) => key === SAVE_KEY ? stored : null, setItem: (_key: string, value: string) => { stored = value; } };
        const store = new ProgressStore(storage, false); store.updateGuaira(stale);
        assert.equal(new ProgressStore(storage, false).save.guaira.alternateCompleted, true);
        assert.deepEqual(new ProgressStore(storage, false).save.guaira.completed, [opening]);
    });
}

test('a malformed alternate flag cannot unlock or select a route before the opening is completed', () => {
    const progress = sanitizeGuairaChapterProgress({ ...freshGuairaChapterProgress(), alternateCompleted: true,
        completed: ['guaira-patio-comportas', 'guaira-prefeito'], selectedScene: 'guaira-patio-comportas', resumeScene: 'guaira-patio-comportas' });
    assert.deepEqual(progress, freshGuairaChapterProgress());
    const session = new GuairaChapterSession();
    assert.equal(session.canSelectScene('guaira-patio-comportas', session.snapshot().generation), false);
});

test('the island beauty and walk-occlusion assets invalidate the same geometry revision', () => {
    const beauty = new URL(GUAIRA_CAMPAIGN_ART.guaira.path, 'https://example.test');
    const depth = new URL(GUAIRA_MAP_DEPTH, 'https://example.test');
    assert.ok(beauty.searchParams.get('v'));
    assert.equal(beauty.searchParams.get('v'), depth.searchParams.get('v'));
});
