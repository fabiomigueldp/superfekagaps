import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterExitPresentation, chapterGuidance, chapterTitle } from '../src/adventure/experimental/guaira/chapter/GuairaChapterPresentation';

test('chapter presentation identifies the game and preserves explicit return destinations', () => {
    assert.equal(chapterTitle('Ossabravo'), 'Super Feka Gaps · Guaíra · Ossabravo');
    assert.equal(chapterExitPresentation(true).label, 'FÁBRICA');
    assert.match(chapterExitPresentation(false).description, /extras/);
});
test('host guidance preserves mechanism instructions while replacing standalone prototype copy', () => {
    assert.equal(chapterGuidance('Guaíra fictícia · setas/A D: mover', 'Abra a comporta'), 'Abra a comporta');
    assert.equal(chapterGuidance('Protótipo experimental · Guaíra', 'Enfrente Ossabravo'), 'Enfrente Ossabravo');
    assert.equal(chapterGuidance('Siga à direita até o arrozal · sair e reentrar reinicia o protótipo', ''), 'Siga à direita até o arrozal · reentrar reinicia esta tentativa');
    assert.equal(chapterGuidance('No tabuleiro A · subindo · água no ramal A · pode esperar apoiado', ''), 'No tabuleiro A · subindo · água no ramal A · pode esperar apoiado');
});
