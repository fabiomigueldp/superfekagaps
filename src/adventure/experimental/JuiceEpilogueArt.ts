import { PLAYER_PALETTE, PLAYER_SPRITES } from '../../assets/playerSpriteSpec';
import { pixelText } from '../../graphics/BitmapFont';
import { drawCalabrezzoStageBackground, drawCalabrezzoStageCast, drawCalabrezzoStageFloor, type CalabrezzoStageState } from './CalabrezzoStageArt';
import type { JuiceEpilogueFrame } from './JuiceEpilogue';

function sprite(c: CanvasRenderingContext2D, rows: readonly string[], x: number, y: number) {
    rows.forEach((row, yy) => [...row].forEach((key, xx) => {
        const color = PLAYER_PALETTE[key];
        if (color) { c.fillStyle = color; c.fillRect(x + xx, y + yy, 1, 1); }
    }));
}

/** Native 320×180 tableau. Reuses the championship cast and Feka's authored
 * sprites, without inventing a score, dialogue, ingredient, trophy or route.
 * The visible hero is scenic; the real Player is never repositioned. */
export function drawJuiceEpilogue(c: CanvasRenderingContext2D, frame: Readonly<JuiceEpilogueFrame>, reducedMotion = false): void {
    const final = frame.beat === 'insist' || frame.beat === 'complete';
    const celebrate = frame.beat === 'boast' || final;
    const s: CalabrezzoStageState = { time: 0, floorY: 160, reducedMotion: true,
        reaction: frame.beat === 'return' || frame.beat === 'boast' ? 'shock' : 'neutral' };
    c.save();
    c.fillStyle = '#171523'; c.fillRect(0, 0, 320, 180);
    c.save();
    // Two editorial cuts make the existing small poses readable: Feka expects
    // applause, then the desk settles. No travelling camera or gameplay zoom.
    if (!reducedMotion && (frame.beat === 'boast' || frame.beat === 'judges')) {
        const focusX = frame.beat === 'boast' ? 119 : 237;
        c.translate(160, 140); c.scale(2, 2); c.translate(-focusX, -140);
    }
    drawCalabrezzoStageBackground(c, s);
    drawCalabrezzoStageCast(c, s);
    drawCalabrezzoStageFloor(c, 160, s);
    // Preserve the original central mark and separation from the judges' desk.
    c.fillStyle = '#17132388'; c.fillRect(113, 159, 14, 2);
    const pose = celebrate ? PLAYER_SPRITES.celebrate
        : frame.beat === 'judges' && (reducedMotion || frame.elapsedMs < 200) ? PLAYER_SPRITES.blink : PLAYER_SPRITES.idle;
    sprite(c, pose, 111, 134);
    if (frame.hasHelmet) sprite(c, PLAYER_SPRITES.helmet, 111, 132);
    c.restore();
    // The earned result survives the indifferent judging. No championship title
    // is awarded: this was victory over Turbosuco, not a bodybuilding score.
    c.fillStyle = '#171523'; c.fillRect(0, 0, 320, 22);
    pixelText(c, 'TURBOSUCO DERROTADO!', 160, 9, '#f6d896', 1, 'center');
    if (!reducedMotion && frame.beat === 'return' && frame.elapsedMs < 250) {
        c.fillStyle = '#171523'; c.globalAlpha *= .65 * (1 - frame.elapsedMs / 250);
        c.fillRect(0, 0, 320, 180);
    }
    c.restore();
}
