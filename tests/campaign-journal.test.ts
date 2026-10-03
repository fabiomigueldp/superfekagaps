import test from 'node:test';
import assert from 'node:assert/strict';
import { freshSave, parseSave } from '../src/adventure/progress';
import { campaignJournal } from '../src/adventure/CampaignJournal';
import { guairaChapterRoute } from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import { FACTORY_SALON, recordSalonVictory } from '../src/adventure/factory/FactorySalon';
import { STAGES } from '../src/adventure/campaign';

test('journal counts five real receipts and three optional achievements independently', () => {
    const save = freshSave(); save.completed = STAGES.map(stage => stage.id);
    save.guaira.completed = guairaChapterRoute(save.guaira.opening);
    let journal = campaignJournal(save);
    assert.equal(journal.total, 35); assert.equal(journal.completed, 35);
    assert.equal(journal.waterReleased, true); assert.equal(journal.next, null);
    assert.equal(journal.optionalCompleted, 0);
    save.guaira.optional = { gallery: true, relief: true }; recordSalonVictory(save);
    journal = campaignJournal(parseSave(JSON.stringify(save)));
    assert.equal(journal.optionalCompleted, 3); assert.equal(journal.completed, 35);
    assert.equal(save.seals.length, 0); assert.ok(save.seen.includes(FACTORY_SALON.victory));
});

test('optional rooms and old Serra access never claim the water was released', () => {
    const save = freshSave(); save.completed = ['3-5']; save.legacySerraAccess = true;
    save.guaira.optional = { gallery: true, relief: true };
    const journal = campaignJournal(save);
    assert.equal(journal.waterReleased, false); assert.equal(journal.guairaCompleted, 0);
    assert.match(journal.water, /acesso antigo/); assert.match(journal.objective, /Travessia/);
    assert.equal(journal.completed, 1);
});

test('alternate opening and revisit selection retain the next real objective', () => {
    const save = freshSave(); save.completed = ['3-5']; save.guaira.opening = 'guaira-patio-comportas';
    save.guaira.completed = ['guaira-patio-comportas', 'guaira-respiros'];
    save.guaira.selectedScene = 'guaira-patio-comportas';
    const before = JSON.stringify(save), journal = campaignJournal(save);
    assert.equal(journal.entries.length, 5); assert.equal(journal.entries[0].title, 'Pátio das Comportas');
    assert.equal(journal.next?.id, 'guaira-lab'); assert.match(journal.objective, /Ossabravo/);
    assert.equal(JSON.stringify(save), before);
});
