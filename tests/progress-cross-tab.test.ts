import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgressStore, finishStage, freshSave, parseSave, resetPreviewGuidance, SAVE_KEY } from '../src/adventure/progress';

import { FACTORY_SALON, recordSalonPassage, recordSalonVictory } from '../src/adventure/factory/FactorySalon';

const sharedStorage = () => {
    const values = new Map<string, string>();
    return { getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); } };
};

test('stale campaign tab preserves earned facts and best times from both tabs', () => {
    const storage = sharedStorage();
    const first = new ProgressStore(storage, false), stale = new ProgressStore(storage, false);
    first.collect('1-1:s1');
    finishStage(first.save, '1-3', 'secret', 40); first.persist();
    stale.collect('1-2:s2');
    finishStage(stale.save, '1-1', 'normal', 80);
    stale.save.times['1-3'] = 60;
    stale.save.selected = '1-2'; stale.save.checkpoint = { stage: '1-2', index: 2, helmet: true };
    assert.equal(stale.persist(), true);
    const saved = parseSave(storage.getItem(SAVE_KEY)!);
    assert.deepEqual(new Set(saved.seals), new Set(['1-1:s1', '1-2:s2']));
    assert.deepEqual(new Set(saved.completed), new Set(['1-3', '1-1']));
    assert.deepEqual(saved.secrets, ['1-3']);
    assert.deepEqual(saved.times, { '1-3': 40, '1-1': 80 });
    assert.equal(saved.selected, '1-2');
    assert.deepEqual(saved.checkpoint, { stage: '1-2', index: 2, helmet: true });
});

for (const replace of ['import', 'reset'] as const) {
    test(`${replace} replaces earned progress and blocks stale campaign and chapter writers`, () => {
        const storage = sharedStorage(), first = new ProgressStore(storage, false);
        recordSalonPassage(first.save); recordSalonVictory(first.save);
        first.collect('1-1:s1'); finishStage(first.save, '1-3', 'secret', 20); first.persist();
        const stale = new ProgressStore(storage, false), chapter = stale.save.guaira;
        chapter.completed.push('guaira-travessia');
        if (replace === 'import') assert.equal(first.import(JSON.stringify(freshSave())), true);
        else { first.save = freshSave(); assert.equal(first.persist(false), true); }
        const replaced = storage.getItem(SAVE_KEY);
        stale.save.completed.push('2-1');
        assert.equal(stale.persist(), false);
        assert.match(stale.warning, /outra aba/);
        assert.equal(stale.updateGuaira(chapter), false);
        assert.equal(storage.getItem(SAVE_KEY), replaced);
        const reloaded = new ProgressStore(storage, false);
        reloaded.collect('1-2:s2');
        const result = parseSave(storage.getItem(SAVE_KEY)!);
        assert.deepEqual(result.completed, []); assert.deepEqual(result.secrets, []);
        assert.deepEqual(result.times, {}); assert.deepEqual(result.seals, ['1-2:s2']);
        assert.deepEqual(result.guaira.completed, []);
        assert.deepEqual(result.seen, []);
        // The tab that performed the explicit replacement continues normally.
        assert.equal(first.persist(), true);
        assert.deepEqual(parseSave(storage.getItem(SAVE_KEY)!).seals, ['1-2:s2']);
    });
}

test('even importing identical bytes invalidates older sessions, while exports exclude the marker', () => {
    const storage = sharedStorage(), first = new ProgressStore(storage, false);
    first.persist(); const stale = new ProgressStore(storage, false);
    const exported = JSON.stringify(first.save);
    assert.equal(first.import(exported), true);
    assert.equal(JSON.stringify(first.save), exported);
    assert.equal(stale.persist(), false);
    assert.equal(first.persist(), true);
});

test('failed replacement does not invalidate other tabs or change replacement ownership', () => {
    const backing = sharedStorage(); let fail = false;
    const storage = { getItem: backing.getItem, setItem: (key: string, raw: string) => {
        if (fail) throw Error('QuotaExceededError'); backing.setItem(key, raw);
    } };
    const first = new ProgressStore(storage, false); first.collect('1-1:s1');
    const second = new ProgressStore(storage, false); fail = true;
    assert.equal(first.import(JSON.stringify(freshSave())), false);
    assert.equal(first.persist(false), false);
    fail = false;
    assert.equal(second.persist(), true); assert.equal(first.persist(), true);
    assert.deepEqual(parseSave(backing.getItem(SAVE_KEY)!).seals, ['1-1:s1']);
});

test('developer imports and cross-tab merges never change the normal profile', () => {
    const storage = sharedStorage(), normal = new ProgressStore(storage, false);
    normal.collect('1-1:s1'); const normalBytes = storage.getItem(SAVE_KEY);
    const first = new ProgressStore(storage, true), stale = new ProgressStore(storage, true);
    first.collect('6-1:s1'); stale.collect('6-2:s2');
    assert.deepEqual(new Set(new ProgressStore(storage, true).save.seals), new Set(['1-1:s1', '6-1:s1', '6-2:s2']));
    assert.equal(first.import(JSON.stringify(freshSave())), true);
    assert.equal(stale.persist(), false);
    assert.equal(storage.getItem(SAVE_KEY), normalBytes);
    assert.equal(normal.persist(), true);
    assert.deepEqual(new ProgressStore(storage, true).save.seals, []);
});

test('external storage removal and corrupt replacements cannot be overwritten by a stale tab', () => {
    let raw: string | null = null;
    const storage = { getItem: () => raw, setItem: (_key: string, next: string) => { raw = next; } };
    const store = new ProgressStore(storage, false); store.collect('1-1:s1');
    raw = null; assert.equal(store.persist(), false); assert.equal(raw, null);
    raw = '{broken'; assert.equal(store.persist(), false); assert.equal(raw, '{broken');
});

test('legacy saves without markers still merge and reload; replacement markers survive chapter writes', () => {
    const storage = sharedStorage(), initial = freshSave(); initial.completed.push('1-1');
    storage.setItem(SAVE_KEY, JSON.stringify(initial));
    const first = new ProgressStore(storage, false), second = new ProgressStore(storage, false);
    first.collect('1-1:s1'); second.collect('1-2:s2');
    assert.deepEqual(new ProgressStore(storage, false).save.completed, ['1-1']);
    assert.equal(first.import(JSON.stringify(first.save)), true);
    const marker = JSON.parse(storage.getItem(SAVE_KEY)!).replacementId;
    const chapter = new ProgressStore(storage, false);
    chapter.save.guaira.completed.push('guaira-travessia');
    assert.equal(chapter.updateGuaira(chapter.save.guaira), true);
    assert.equal(JSON.parse(storage.getItem(SAVE_KEY)!).replacementId, marker);
    assert.equal(first.persist(), true);
    assert.equal(JSON.parse(storage.getItem(SAVE_KEY)!).replacementId, marker);
    assert.deepEqual(first.save.guaira.completed, ['guaira-travessia']);
});

for (const replacementId of [null, 3, {}, '', 'v2:unknown', 'v1:' + 'x'.repeat(129)]) {
    test(`unrecognized replacement marker is protected: ${JSON.stringify(replacementId)}`, () => {
        const storage = sharedStorage(), active = new ProgressStore(storage, false);
        const invalid = JSON.stringify({ ...freshSave(), replacementId });
        storage.setItem(SAVE_KEY, invalid);
        assert.equal(active.persist(), false);
        const reloaded = new ProgressStore(storage, false);
        assert.equal(reloaded.persist(), false);
        assert.equal(storage.getItem(SAVE_KEY), invalid);
        // Explicit portable import is the supported way to replace protected data.
        assert.equal(reloaded.import(JSON.stringify(freshSave())), true);
        assert.equal(reloaded.persist(), true);
    });
}

for (const earned of [FACTORY_SALON.passage, FACTORY_SALON.victory]) {
    test(`stale campaign writes preserve dedicated salon fact ${earned} without restoring guidance`, () => {
        const storage = sharedStorage(), first = new ProgressStore(storage, false);
        first.save.seen = ['dialogue:factory', 'control:jump', 'ordinary:kept']; first.persist();
        const stale = new ProgressStore(storage, false);
        first.markSeen(earned);
        resetPreviewGuidance(stale.save);
        assert.equal(stale.persist(), true);
        const result = parseSave(storage.getItem(SAVE_KEY)!);
        assert.deepEqual(new Set(result.seen), new Set(['ordinary:kept', earned]));
        assert.equal(stale.persist(), true);
        assert.equal(stale.save.seen.filter(id => id === earned).length, 1);
    });
}

test('chapter update after storage recovery preserves session-only earnings and latest campaign navigation', () => {
    const backing = sharedStorage(); let fail = false;
    const storage = { getItem: backing.getItem, setItem: (key: string, raw: string) => {
        if (fail) throw Error('QuotaExceededError'); backing.setItem(key, raw);
    } };
    const campaign = new ProgressStore(storage, false); campaign.persist();
    const chapter = new ProgressStore(storage, false);
    fail = true;
    chapter.collect('1-1:s1'); recordSalonPassage(chapter.save); recordSalonVictory(chapter.save);
    finishStage(chapter.save, '1-3', 'secret', 35);
    assert.equal(chapter.persist(), false);
    fail = false;
    campaign.save.selected = '2-2'; campaign.save.preferences.music = .1;
    campaign.save.checkpoint = { stage: '2-2', index: 3, helmet: false };
    assert.equal(campaign.persist(), true);
    chapter.save.guaira.completed.push('guaira-travessia');
    assert.equal(chapter.updateGuaira(chapter.save.guaira), true);
    const saved = parseSave(backing.getItem(SAVE_KEY)!);
    assert.deepEqual(saved.seals, ['1-1:s1']);
    assert.deepEqual(saved.completed, ['1-3']); assert.deepEqual(saved.secrets, ['1-3']);
    assert.equal(saved.times['1-3'], 35);
    assert.ok(saved.seen.includes(FACTORY_SALON.passage)); assert.ok(saved.seen.includes(FACTORY_SALON.victory));
    assert.deepEqual(saved.guaira.completed, ['guaira-travessia']);
    assert.equal(saved.selected, '2-2'); assert.equal(saved.preferences.music, .1);
    assert.deepEqual(saved.checkpoint, { stage: '2-2', index: 3, helmet: false });
});
