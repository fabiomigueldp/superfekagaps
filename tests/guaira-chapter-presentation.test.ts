import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterExitPresentation, chapterGuidance, chapterTitle } from '../src/adventure/experimental/guaira/chapter/GuairaChapterPresentation';

test('chapter presentation identifies the game and preserves explicit return destinations', () => {
    assert.equal(chapterTitle('Ossabravo'), 'Super Feka Gaps · Guaíra · Ossabravo');
    assert.equal(chapterExitPresentation(true).label, 'FÁBRICA');
    assert.equal(chapterExitPresentation(false).description, 'Voltar ao jogo');
});
test('host guidance preserves mechanism instructions while replacing standalone prototype copy', () => {
    assert.equal(chapterGuidance('Guaíra fictícia · setas/A D: mover', 'Abra a comporta'), 'Abra a comporta');
    assert.equal(chapterGuidance('Protótipo experimental · Guaíra', 'Enfrente Ossabravo'), 'Enfrente Ossabravo');
    assert.equal(chapterGuidance('Siga à direita até o arrozal · sair e reentrar reinicia o protótipo', ''), 'Siga à direita até o arrozal · reentrar reinicia esta tentativa');
    assert.equal(chapterGuidance('No tabuleiro A · subindo · água no ramal A · pode esperar apoiado', ''), 'No tabuleiro A · subindo · água no ramal A · pode esperar apoiado');
});

import { chapterAttemptSummary, chapterResumeGuidance } from '../src/adventure/experimental/guaira/chapter/GuairaChapterPresentation';
test('attempt summary never implies banked currency or a restored checkpoint', () => {
    assert.equal(chapterAttemptSummary(1), '1 moeda coletada nesta tentativa');
    assert.equal(chapterAttemptSummary(12), '12 moedas coletadas nesta tentativa');
    for (const value of [NaN, Infinity, -3]) assert.equal(chapterAttemptSummary(value), '0 moedas coletadas nesta tentativa');
    assert.match(chapterResumeGuidance(), /recarregar reinicia o trecho/);
    assert.match(chapterResumeGuidance(), /checkpoint só nesta tentativa/);
});
