import assert from 'node:assert/strict';
import test from 'node:test';
import {
    GuairaChapterSession,
    type GuairaChapterAttempt, type GuairaChapterLiveResult, type GuairaChapterOpening,
    type GuairaChapterResult, type GuairaChapterSceneId
} from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';

const openings: readonly GuairaChapterOpening[] = ['guaira-travessia', 'guaira-patio-comportas'];
function completion(attempt: GuairaChapterAttempt): GuairaChapterResult {
    if (attempt.sceneId === 'guaira-lab') return { sceneId: attempt.sceneId, kind: 'defeated-bull' };
    if (attempt.sceneId === 'guaira-prefeito') return { sceneId: attempt.sceneId, kind: 'mayor-water-released' };
    return { sceneId: attempt.sceneId, kind: 'reached-finish' };
}
function live(attempt: GuairaChapterAttempt, complete = true,
    changes: Partial<GuairaChapterLiveResult> = {}): GuairaChapterLiveResult {
    return { attempt, state: 'playing', alive: true, result: complete ? completion(attempt) : null, ...changes };
}
function enter(session: GuairaChapterSession, scene: GuairaChapterSceneId = session.snapshot().nextRecommendedScene!) {
    const selected = session.selectScene(scene, session.snapshot().generation);
    assert.ok(selected);
    const attempt = session.enterScene(scene, selected.generation);
    assert.ok(attempt);
    return attempt;
}

for (const opening of openings) test(`${opening}: all five actual results require explicit acceptance and preserve identity`, () => {
    const session = new GuairaChapterSession({ opening });
    const route: GuairaChapterSceneId[] = [opening, 'guaira-respiros', 'guaira-lab', 'guaira-subida', 'guaira-prefeito'];
    assert.deepEqual(session.snapshot().route, route);
    assert.deepEqual(session.snapshot().accepted, []);
    assert.equal(session.snapshot().activeAttempt, null);
    assert.equal(session.snapshot().selectedScene, opening);
    for (let index = 0; index < route.length; index++) {
        const scene = route[index];
        assert.equal(session.snapshot().nextRecommendedScene, scene);
        const attempt = enter(session);
        assert.equal(session.canContinue(attempt, live(attempt, false)), false);
        assert.equal(session.canContinue(attempt, live(attempt)), true);
        assert.equal(session.snapshot().accepted.length, index, 'observing success never accepts it');
        const transition = index % 2 === 0
            ? session.continueFrom(attempt, live(attempt)) : session.exitToMap(attempt, live(attempt));
        assert.ok(transition);
        assert.equal(transition.newlyAccepted, true);
        assert.equal(transition.receipt?.sceneId, scene);
        assert.deepEqual(transition.receipt?.result, completion(attempt));
        assert.equal(transition.receipt?.acceptedVia, index % 2 === 0 ? 'continue' : 'map');
        assert.equal(transition.snapshot.activeAttempt, null, 'continuation does not auto-mount a scene');
        assert.equal(transition.snapshot.selectedScene, route[index + 1] ?? scene);
        assert.equal(session.snapshot().nextRecommendedScene, route[index + 1] ?? null);
        assert.equal(session.continueFrom(attempt, live(attempt)), null);
        assert.equal(session.exitToMap(attempt, live(attempt)), null);
        assert.equal(session.retry(attempt), null);
        assert.equal(session.snapshot().accepted.length, index + 1);
    }
    assert.equal(session.snapshot().chapterComplete, true);
    assert.deepEqual(session.snapshot().accepted.map(receipt => receipt.sceneId), route);
    const otherOpening = openings.find(scene => scene !== opening)!;
    assert.equal(session.snapshot().accepted.some(receipt => receipt.sceneId === otherOpening), false);
    assert.equal(session.canSelectScene(otherOpening, session.snapshot().generation), false);
});

test('selection, physical-entry boundary and delayed map buttons use separate generations', () => {
    const session = new GuairaChapterSession();
    const initial = session.snapshot();
    assert.equal(session.selectScene('guaira-lab', initial.generation), null);
    assert.equal(session.enterScene('guaira-respiros', initial.generation), null);
    const selected = session.selectScene('guaira-travessia', initial.generation)!;
    assert.ok(selected);
    assert.equal(selected.activeAttempt, null);
    assert.deepEqual(selected.accepted, []);
    assert.equal(session.selectScene('guaira-travessia', initial.generation), null);
    assert.equal(session.enterScene('guaira-travessia', initial.generation), null);
    const first = session.enterScene('guaira-travessia', selected.generation)!;
    assert.ok(first);
    assert.equal(session.selectScene('guaira-travessia', session.snapshot().generation), null);
    assert.equal(session.enterScene('guaira-travessia', selected.generation), null);
    session.continueFrom(first, live(first));
    const map = session.snapshot();
    assert.equal(map.selectedScene, 'guaira-respiros');
    assert.equal(session.canSelectScene('guaira-travessia', map.generation), true);
    assert.equal(session.canEnterScene('guaira-travessia', map.generation), false, 'replay needs its own selection');
    const replaySelection = session.selectScene('guaira-travessia', map.generation)!;
    assert.equal(session.enterScene('guaira-respiros', map.generation), null, 'old contextual entry is retired');
    assert.equal(session.enterScene('guaira-respiros', replaySelection.generation), null, 'entry must match selection');
    assert.ok(session.enterScene('guaira-travessia', replaySelection.generation));
});

for (const opening of openings) test(`${opening}: retry retires readiness and all previous callbacks at every scene`, () => {
    const session = new GuairaChapterSession({ opening });
    for (const scene of session.snapshot().route) {
        const first = enter(session, scene);
        const readyBeforeRetry = live(first);
        assert.equal(session.canContinue(first, readyBeforeRetry), true);
        const retried = session.retry(first)!;
        assert.ok(retried);
        assert.equal(retried.sceneId, first.sceneId);
        assert.ok(retried.attemptGeneration > first.attemptGeneration);
        const beforeStale = session.snapshot();
        assert.equal(session.retry(first), null);
        assert.equal(session.continueFrom(first, readyBeforeRetry), null);
        assert.equal(session.exitToMap(first, readyBeforeRetry), null);
        assert.equal(session.continueFrom(retried, readyBeforeRetry), null, 'old evidence cannot use a new action token');
        assert.equal(session.exitToMap(retried, readyBeforeRetry), null);
        assert.equal(session.restartChapter(first), null);
        assert.deepEqual(session.snapshot(), beforeStale);
        assert.equal(session.canContinue(retried, live(retried, false)), false);
        assert.equal(session.snapshot().accepted.length, session.snapshot().route.indexOf(scene));
        assert.ok(session.continueFrom(retried, live(retried)));
    }
});

for (const state of ['paused', 'settings', 'map', 'clear', 'title', 'dialogue']) {
    test(`${state}: Continue never accepts; map exit preserves only an alive playing/paused result`, () => {
        const session = new GuairaChapterSession();
        const attempt = enter(session);
        const sample = live(attempt, true, { state });
        assert.equal(session.canContinue(attempt, sample), false);
        assert.equal(session.continueFrom(attempt, sample), null);
        assert.equal(session.snapshot().activeAttempt, attempt);
        const exited = session.exitToMap(attempt, sample)!;
        assert.ok(exited);
        assert.equal(exited.newlyAccepted, state === 'paused');
        assert.equal(exited.receipt !== null, state === 'paused');
        assert.equal(session.snapshot().accepted.length, state === 'paused' ? 1 : 0);
    });
}

test('death, checkpoint-only evidence and changing readiness never become completion', () => {
    const session = new GuairaChapterSession();
    let attempt = enter(session);
    assert.equal(session.canContinue(attempt, live(attempt)), true);
    assert.equal(session.canContinue(attempt, live(attempt, false)), false, 'ready state is never latched');
    for (const state of ['playing', 'paused']) {
        const dead = live(attempt, true, { alive: false, state });
        assert.equal(session.canContinue(attempt, dead), false);
        assert.equal(session.continueFrom(attempt, dead), null);
    }
    const recovered = session.retry(attempt)!;
    assert.equal(session.continueFrom(attempt, live(attempt)), null);
    attempt = recovered;
    assert.equal(session.continueFrom(attempt, live(attempt, false)), null, 'checkpoint recovery has no result');
    assert.equal(session.exitToMap(attempt, live(attempt, true, { alive: false }))?.receipt, null);
    assert.deepEqual(session.snapshot().accepted, []);
    const reentered = enter(session);
    assert.notEqual(reentered.attemptGeneration, attempt.attemptGeneration);
    assert.equal(session.canContinue(reentered, live(attempt)), false);
    assert.equal(session.exitToMap(reentered, live(reentered, false))?.receipt, null);
    assert.deepEqual(session.snapshot().accepted, []);
});

test('live result identity and kind must match the actual scene, including both bosses', () => {
    const session = new GuairaChapterSession();
    for (const scene of session.snapshot().route) {
        const attempt = enter(session, scene);
        const mismatches: GuairaChapterResult[] = [
            { sceneId: 'guaira-prefeito', kind: 'mayor-water-released' },
            { sceneId: 'guaira-lab', kind: 'defeated-bull' },
            { sceneId: 'guaira-patio-comportas', kind: 'reached-finish' }
        ].filter(result => result.sceneId !== scene) as GuairaChapterResult[];
        for (const result of mismatches) assert.equal(session.continueFrom(attempt, live(attempt, true, { result })), null);
        const wrongKind = { sceneId: scene, kind: scene === 'guaira-prefeito' ? 'defeated-bull' : 'mayor-water-released' };
        assert.equal(session.canContinue(attempt, live(attempt, true, { result: wrongKind as GuairaChapterResult })), false);
        for (const key of ['sessionId', 'generation', 'attemptGeneration'] as const) {
            const wrongAttempt = { ...attempt, [key]: attempt[key] + 1 };
            assert.equal(session.continueFrom(wrongAttempt, live(attempt)), null);
            assert.equal(session.exitToMap(attempt, live(wrongAttempt)), null);
        }
        assert.ok(session.continueFrom(attempt, live(attempt)));
    }
});

test('abandoning and replaying any completed scene preserve the original chapter receipts', () => {
    const session = new GuairaChapterSession();
    for (const scene of session.snapshot().route) {
        const attempt = enter(session, scene);
        session.continueFrom(attempt, live(attempt));
        const original = session.snapshot().accepted;
        const next = session.snapshot().nextRecommendedScene;
        for (const replayScene of original.map(receipt => receipt.sceneId)) {
            let replay = enter(session, replayScene);
            assert.equal(session.exitToMap(replay, live(replay, false))?.receipt, null);
            assert.deepEqual(session.snapshot().accepted, original);
            replay = enter(session, replayScene);
            const transition = session.continueFrom(replay, live(replay))!;
            assert.equal(transition.newlyAccepted, false);
            assert.equal(transition.receipt, original.find(receipt => receipt.sceneId === replayScene));
            assert.deepEqual(session.snapshot().accepted, original);
            assert.equal(session.snapshot().nextRecommendedScene, next);
        }
    }
    assert.equal(session.snapshot().chapterComplete, true);
    const replay = enter(session, 'guaira-prefeito');
    session.retry(replay);
    assert.equal(session.snapshot().chapterComplete, true, 'replaying/retrying never erases final receipt');
});

test('session restart is explicitly empty, changes identity, and permanently closes the old owner', () => {
    const session = new GuairaChapterSession();
    const first = enter(session);
    session.continueFrom(first, live(first));
    const attempt = enter(session);
    const before = session.snapshot();
    const replacement = session.restartChapter(before.generation, { opening: 'guaira-patio-comportas' })!;
    assert.ok(replacement);
    assert.notEqual(replacement.snapshot().generation.sessionId, before.generation.sessionId);
    assert.equal(session.snapshot().disposed, true);
    assert.equal(session.snapshot().activeAttempt, null);
    assert.equal(session.snapshot().accepted.length, 1);
    assert.deepEqual(replacement.snapshot().accepted, []);
    assert.equal(replacement.snapshot().selectedScene, 'guaira-patio-comportas');
    assert.equal(replacement.snapshot().nextRecommendedScene, 'guaira-patio-comportas');
    assert.equal(replacement.snapshot().activeAttempt, null);
    for (const owner of [session, replacement]) {
        assert.equal(owner.continueFrom(attempt, live(attempt)), null);
        assert.equal(owner.exitToMap(attempt, live(attempt)), null);
        assert.equal(owner.retry(attempt), null);
        assert.equal(owner.restartChapter(before.generation), null);
        assert.equal(owner.selectScene('guaira-respiros', before.generation), null);
        assert.equal(owner.enterScene('guaira-respiros', before.generation), null);
    }
    session.dispose();
    const closed = session.snapshot();
    session.dispose();
    assert.deepEqual(session.snapshot(), closed);
    assert.equal(session.restartChapter(closed.generation), null, 'closed models never reopen');
    const fresh = new GuairaChapterSession();
    assert.deepEqual(fresh.snapshot().accepted, [], 'construction has no restore path');
    const preserveOpening = replacement.restartChapter(replacement.snapshot().generation)!;
    assert.equal(preserveOpening.snapshot().opening, 'guaira-patio-comportas');
});

test('all public state is immutable and receipts copy adapter evidence', () => {
    const session = new GuairaChapterSession();
    const attempt = enter(session);
    const result = completion(attempt);
    const transition = session.continueFrom(attempt, live(attempt, true, { result }))!;
    const receipt = transition.receipt!;
    assert.notEqual(receipt.result, result);
    for (const object of [attempt, transition, receipt, receipt.result, transition.snapshot,
        transition.snapshot.route, transition.snapshot.accepted, transition.snapshot.generation]) {
        assert.equal(Object.isFrozen(object), true);
    }
    (result as { sceneId: string }).sceneId = 'not-a-scene';
    assert.equal(receipt.result.sceneId, 'guaira-travessia', 'later adapter mutation cannot alter the receipt');
});

test('invalid opening cannot replace a live chapter', () => {
    const session = new GuairaChapterSession();
    const attempt = enter(session);
    const before = session.snapshot();
    assert.throws(() => session.restartChapter(before.generation, { opening: 'invalid' as GuairaChapterOpening }));
    assert.deepEqual(session.snapshot(), before);
    assert.ok(session.continueFrom(attempt, live(attempt)));
});

test('disposal blocks current and old map/attempt callbacks, including a ready unfinished scene', () => {
    const session = new GuairaChapterSession();
    const initial = session.snapshot();
    const attempt = enter(session);
    assert.equal(session.canContinue(attempt, live(attempt)), true);
    session.dispose();
    const closed = session.snapshot();
    assert.equal(closed.disposed, true);
    assert.equal(closed.activeAttempt, null);
    assert.deepEqual(closed.accepted, []);
    for (const generation of [initial.generation, attempt, closed.generation]) {
        assert.equal(session.canSelectScene('guaira-travessia', generation), false);
        assert.equal(session.selectScene('guaira-travessia', generation), null);
        assert.equal(session.canEnterScene('guaira-travessia', generation), false);
        assert.equal(session.enterScene('guaira-travessia', generation), null);
        assert.equal(session.restartChapter(generation), null);
    }
    assert.equal(session.canContinue(attempt, live(attempt)), false);
    assert.equal(session.continueFrom(attempt, live(attempt)), null);
    assert.equal(session.exitToMap(attempt, live(attempt)), null);
    assert.equal(session.retry(attempt), null);
    session.dispose();
    assert.deepEqual(session.snapshot(), closed);
});

test('deterministic callback storms across multiple journeys cannot duplicate or erase receipts', () => {
    for (let seed = 1; seed <= 24; seed++) {
        const opening = openings[seed % 2];
        const session = new GuairaChapterSession({ opening });
        const stale: GuairaChapterAttempt[] = [];
        const expected = new Set<GuairaChapterSceneId>();
        let random = seed;
        const choose = (size: number) => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random % size; };
        for (let step = 0; step < 180; step++) {
            const snapshot = session.snapshot();
            let attempt = snapshot.activeAttempt;
            if (!attempt) {
                const candidates = [...expected, ...(snapshot.nextRecommendedScene ? [snapshot.nextRecommendedScene] : [])];
                attempt = enter(session, candidates[choose(candidates.length)]);
            }
            const command = choose(5);
            if (command === 0) {
                stale.push(attempt);
                assert.ok(session.retry(attempt));
            } else if (command === 1) {
                assert.ok(session.exitToMap(attempt, live(attempt, false)));
                stale.push(attempt);
            } else if (command === 2) {
                assert.equal(session.continueFrom(attempt, live(attempt, true, { state: 'paused' })), null);
            } else {
                expected.add(attempt.sceneId);
                assert.ok(command === 3 ? session.continueFrom(attempt, live(attempt))
                    : session.exitToMap(attempt, live(attempt, true, { state: 'paused' })));
                stale.push(attempt);
            }
            const beforeStale = session.snapshot();
            for (const old of stale.slice(-8)) {
                assert.equal(session.continueFrom(old, live(old)), null);
                assert.equal(session.exitToMap(old, live(old)), null);
                assert.equal(session.retry(old), null);
            }
            assert.deepEqual(session.snapshot(), beforeStale);
            assert.deepEqual(new Set(beforeStale.accepted.map(receipt => receipt.sceneId)), expected);
            assert.equal(beforeStale.accepted.length, expected.size);
            assert.equal(beforeStale.nextRecommendedScene, beforeStale.route.find(scene => !expected.has(scene)) ?? null);
            assert.equal(beforeStale.chapterComplete, expected.size === 5);
        }
        assert.equal(session.snapshot().chapterComplete, true, 'each seed reaches all five actual results');
    }
});
