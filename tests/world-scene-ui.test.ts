import assert from 'node:assert/strict';
import test from 'node:test';
import { STAGES } from '../src/adventure/campaign';
import { ALL_DELICIA_STAGES, DELICIA_ENDING } from '../src/adventure/delicia/DeliciaContent';
import { DeliciaBoss, type BossAttack, type BossBeat } from '../src/adventure/delicia/DeliciaBoss';
import { drawWorldDialogue, drawWorldEncounterHud, worldDialogueLayout, WORLD_DIALOGUE_ACTION } from '../src/adventure/WorldSceneUI';
import { pixelText } from '../src/graphics/BitmapFont';

const canvas = () => {
    const rectangles: number[][] = [];
    const context = { fillStyle: '', fillRect: (...rect: number[]) => rectangles.push(rect) } as unknown as CanvasRenderingContext2D;
    return { context, rectangles };
};

test('every campaign and Delícia conversation fits above the shared Continue control', () => {
    const lines = [...STAGES.flatMap(stage => stage.dialogues), ...ALL_DELICIA_STAGES.flatMap(stage => [...stage.intro, ...stage.outro]), ...DELICIA_ENDING];
    assert.ok(lines.length > 0);
    for (const line of lines) {
        const box = worldDialogueLayout(line.text);
        assert.ok(box.top >= 18, `${line.speaker}: ${line.text}`);
        assert.equal(box.top + box.height, 173);
        assert.ok(box.top + 23 + (box.lines.length - 1) * 10 + 7 < WORLD_DIALOGUE_ACTION.y);
        const first = canvas(), complete = canvas();
        drawWorldDialogue(first.context, line.speaker, line.text, '#80d4c4', 1);
        drawWorldDialogue(complete.context, line.speaker, line.text, '#80d4c4');
        assert.deepEqual(first.rectangles.slice(0, 5), complete.rectangles.slice(0, 5), 'Revealing text cannot move the frame');
    }
});

test('all boss cues, phases and gauges remain on the native grid above chapter feedback', () => {
    const attacks: BossAttack[] = ['cup','wave','charge','whirlpool','geyser','gap','court','press','overload'];
    const beats: BossBeat[] = ['intro','idle','tell','attack','recover','stagger','transition','defeated'];
    for (const character of ['jaja', 'guina'] as const) for (const beat of beats) for (const attack of attacks) {
        const boss = new DeliciaBoss(character); boss.beat = beat; boss.attack = attack;
        const { context, rectangles } = canvas();
        drawWorldEncounterHud(context, boss.title, boss.hp, boss.maxHp, boss.cue, character === 'guina' ? 87 : undefined);
        for (const [x, y, w, h] of rectangles) {
            assert.ok([x,y,w,h].every(Number.isInteger));
            assert.ok(x >= 64 && x + w <= 256 && y >= 20 && y + h < 76, `${character}: ${boss.cue}`);
        }
    }
});

test('controller shapes have distinct native glyphs instead of question-mark fallbacks', () => {
    const glyph = (text: string) => { const c = canvas(); pixelText(c.context, text, 0, 0); return c.rectangles; };
    const fallback = glyph('?');
    const shapes = ['□', '○', '△'].map(glyph);
    shapes.forEach(shape => assert.notDeepEqual(shape, fallback));
    assert.equal(new Set(shapes.map(shape => JSON.stringify(shape))).size, 3);
});
