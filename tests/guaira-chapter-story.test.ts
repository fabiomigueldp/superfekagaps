import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterCompletionStory, chapterJourneyStory } from '../src/adventure/experimental/guaira/chapter/GuairaChapterStory';
import { freshGuairaChapterProgress, guairaChapterRoute } from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import { GuairaChapterSession, type GuairaChapterOpening, type GuairaChapterReceipt } from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';

function restored(count: number, opening: GuairaChapterOpening = 'guaira-travessia') {
    const route = guairaChapterRoute(opening);
    return new GuairaChapterSession({ progress: { ...freshGuairaChapterProgress(), opening,
        completed: route.slice(0, count), selectedScene: route[Math.min(count, 4)] } });
}

for (const opening of ['guaira-travessia', 'guaira-patio-comportas'] as const) {
    test(`${opening}: only earned transitions explain the remaining water problem and neighborhood payoff`, () => {
        for (const count of [0, 1, 2, 4]) assert.equal(chapterJourneyStory(restored(count, opening).snapshot()), null);
        const bull = restored(3, opening), snapshot = bull.snapshot(), before = JSON.stringify(snapshot);
        const story = chapterJourneyStory(snapshot);
        assert.match(story!, /Ossabravo descansou.*água ainda falta.*Casa da Vazão/);
        assert.doesNotMatch(story!, /particular|desvio|lacres/, 'The ascent owns its existing reveal');
        assert.equal(chapterCompletionStory(snapshot, 'guaira-lab'), story);
        assert.equal(chapterCompletionStory(snapshot, opening), null);
        for (let call = 0; call < 100; call++) assert.equal(chapterJourneyStory(snapshot), story);
        assert.equal(JSON.stringify(snapshot), before, 'Rendering is idempotent and never writes progress');
        const selected = bull.selectScene(opening, snapshot.generation)!;
        assert.equal(chapterJourneyStory(selected), story, 'A replay selection does not erase earned context');
        const complete = restored(5, opening), water = chapterJourneyStory(complete.snapshot());
        assert.match(water!, /Ramal público aberto.*moradores.*bica outra vez.*Os gaps continuam/);
        assert.equal(chapterCompletionStory(complete.snapshot(), 'guaira-prefeito'), water);
        assert.equal(chapterCompletionStory(complete.snapshot(), 'guaira-lab'), null, 'A later bull replay never claims the neighborhood is dry');
        const attempt = complete.enterScene('guaira-prefeito', complete.snapshot().generation)!;
        const retry = complete.retry(attempt)!;
        complete.exitToMap(retry, { attempt: retry, state: 'playing', alive: true, result: null });
        assert.equal(chapterJourneyStory(complete.snapshot()), water, 'Abandoning a replay preserves real public water');
        assert.equal(complete.snapshot().accepted.length, 5);
        complete.dispose(); assert.equal(chapterJourneyStory(complete.snapshot()), null);
    });
}

test('a foreign or wrong-kind receipt cannot supply a causal story', () => {
    for (const count of [3, 5]) {
        const snapshot = restored(count).snapshot(), last = snapshot.accepted.at(-1)!;
        for (const receipt of [
            { ...last, attempt: { ...last.attempt, sessionId: last.attempt.sessionId + 1 } },
            { ...last, result: { sceneId: last.sceneId, kind: 'reached-finish' } }
        ] as GuairaChapterReceipt[]) {
            assert.equal(chapterJourneyStory({ ...snapshot, accepted: [...snapshot.accepted.slice(0, -1), receipt] }), null);
        }
    }
});
