import { PLAYER_PALETTE, PLAYER_SPRITES } from '../../assets/playerSpriteSpec';
import { pixelText, panel, wrapText } from '../../graphics/BitmapFont';
import { drawCalabrezzoStageBackground, drawCalabrezzoStageCast, drawCalabrezzoStageFloor, type CalabrezzoStageState } from './CalabrezzoStageArt';
import { drawJuiceMiniboss, drawJuiceLabBackground, drawJuiceLabFloor } from './JuiceMinibossArt';
import { JuiceMinibossModel } from './JuiceMinibossModel';
import type { IntroFrame } from './JuiceIntroDirector';
const visualBoss = new JuiceMinibossModel();
function sprite(c: CanvasRenderingContext2D, rows: readonly string[], x: number, y: number) {
    rows.forEach((row, yy) => [...row].forEach((key, xx) => { const color = PLAYER_PALETTE[key]; if (color) { c.fillStyle = color; c.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1); } }));
}
function slimTorso(rows: readonly string[]) {
    return rows.map((row, y) => {
        if (y < 11 || y > 18) return row;
        const pixels = [...row];
        for (let x = 4; x <= 12; x++) pixels[x] = '_';
        pixels[6] = 'K'; pixels[7] = 'S'; pixels[8] = 'L'; pixels[9] = 'S'; pixels[10] = 'K';
        for (const x of [1,2,3,13,14,15]) if (['B','b','D'].includes(pixels[x])) pixels[x] = 'S';
        return pixels.join('');
    });
}
const SLIM_IDLE = slimTorso(PLAYER_SPRITES.idle), SLIM_POSE = slimTorso(PLAYER_SPRITES.celebrate), SLIM_BLINK = slimTorso(PLAYER_SPRITES.blink);
/** Scenic acting derives directly from Feka's authored palette/head/clothes. */
function feka(c: CanvasRenderingContext2D, f: IntroFrame, reduced: boolean) {
    const x = Math.round(f.fekaX), floor = 160;
    const stepping = f.beat === 'walk' || f.beat === 'push' || f.beat === 'emerge' && f.elapsedMs < 2300;
    const bob = stepping && !reduced ? Math.floor(f.timeMs / 130) % 2 : 0;
    const flex = f.beat === 'reveal' || f.beat === 'judges';
    const defiant = f.beat === 'defy' || f.beat === 'transition' && f.elapsedMs < 750;
    const down = f.beat === 'resolve' && f.elapsedMs < 650;
    c.fillStyle = '#17132388'; c.fillRect(x + 2, floor - 1, 14, 2);
    const bare = ['reveal','judges','resolve','emerge','invite','defy','transition'].includes(f.beat)
        && !(f.beat === 'transition' && f.elapsedMs >= 750);
    const frame = bare ? down ? SLIM_BLINK : flex || defiant ? SLIM_POSE : SLIM_IDLE
        : down ? PLAYER_SPRITES.blink : flex || defiant ? PLAYER_SPRITES.celebrate : PLAYER_SPRITES.idle;
    sprite(c, frame, x - 1, floor - 26 + bob);
    if (bare) {
        // Shirt is visibly lifted, then tucked at the waist; the same garment returns before combat.
        const removal = f.beat === 'reveal' ? Math.min(1, f.elapsedMs / 550) : 1;
        const dressing = f.beat === 'transition' ? Math.min(1, f.elapsedMs / 750) : 0;
        const clothY = f.beat === 'transition' ? floor - 12 - dressing * 13
            : removal < .5 ? floor - 20 - removal * 24 : floor - 32 + (removal - .5) * 40;
        const clothX = f.beat === 'transition' ? x + 2 + dressing * 2 : x + 2 - Math.max(0,removal-.5)*8;
        c.fillStyle = PLAYER_PALETTE.K!; c.fillRect(Math.round(clothX), Math.round(clothY), 9, 5);
        c.fillStyle = PLAYER_PALETTE.B!; c.fillRect(Math.round(clothX)+1, Math.round(clothY)+1, 7, 3);
        c.fillStyle = PLAYER_PALETTE.b!; c.fillRect(Math.round(clothX)+1, Math.round(clothY)+1, 5, 1);
    }
    // Thin upward forearms extend the existing celebration pose without replacing identity.
    if (flex) {
        const tremble = !reduced && f.elapsedMs > 900 ? Math.floor(f.timeMs / 120) % 2 : 0;
        for (const side of [-1, 1]) {
            const ax = x + (side < 0 ? -4 : 14), ay = floor - 17 + (side < 0 ? tremble : 0);
            c.fillStyle = PLAYER_PALETTE.K!; c.fillRect(ax, ay, 5, 3); c.fillRect(ax + (side < 0 ? 0 : 3), ay - 5, 3, 7);
            c.fillStyle = PLAYER_PALETTE.S!; c.fillRect(ax + 1, ay + 1, 3, 1); c.fillRect(ax + (side < 0 ? 1 : 4), ay - 4, 1, 5);
        }
    }
    if (f.beat === 'resolve' && f.elapsedMs > 750 && f.elapsedMs < 1000) { c.fillStyle = '#e6bd79'; c.fillRect(x + 9, floor - 1, 8, 1); }
}
/** Foreground escort shares the hero's floor so the shove has a visible source. */
function usher(c: CanvasRenderingContext2D, frame: IntroFrame) {
    if (!['establish', 'walk', 'push', 'prepare'].includes(frame.beat)) return;
    if (frame.beat === 'prepare' && frame.elapsedMs > 750) return;
    const x = frame.beat === 'establish' ? 8 : frame.beat === 'walk' ? frame.fekaX - 30
        : frame.beat === 'push' ? 76 : 76 - Math.min(1, frame.elapsedMs / 750) * 108;
    c.save(); c.translate(Math.round(x), 160);
    const r = (x: number,y: number,w: number,h: number,color: string) => { c.fillStyle=color;c.fillRect(x,y,w,h); };
    r(-10,-33,21,22,'#171523'); r(-9,-32,19,19,'#ba8265'); r(-8,-31,8,7,'#dfa47b');
    r(-5,-43,12,11,'#171523'); r(-4,-41,10,8,'#c78d68'); r(-4,-43,10,3,'#43302d'); r(3,-37,2,1,'#171523');
    r(-8,-14,16,6,'#566e7d'); r(-8,-9,6,9,'#b58268'); r(3,-9,6,9,'#b58268');
    r(-10,-2,9,3,'#2a2332');r(2,-2,10,3,'#2a2332');
    const reach = frame.beat === 'push' ? Math.round(10 + 8 * Math.sin(Math.min(1,frame.elapsedMs / 650)*Math.PI)) : 6;
    r(9,-29,reach,6,'#171523');r(10,-28,reach-1,4,'#dfa47b');
    c.restore();
}
export function drawJuiceIntro(c: CanvasRenderingContext2D, frame: IntroFrame, reducedMotion = false) {
    const { beat, timeMs, stageExit } = frame;
    const s: CalabrezzoStageState = { time: timeMs, floorY: 160, reducedMotion,
        reaction: beat === 'judges' || beat === 'resolve' ? 'mock' : ['emerge', 'invite', 'defy', 'transition'].includes(beat) ? 'shock' : 'neutral' };
    const closeFeka = ['reveal', 'resolve', 'defy'].includes(beat);
    const zoom = reducedMotion ? 1 : beat === 'transition' ? 1 + (1 - stageExit) : closeFeka ? 2 : beat === 'invite' ? 1.5 : 1;
    const focus = reducedMotion ? 160 : beat === 'transition' ? (frame.fekaX + 7) * (1 - stageExit) + 160 * stageExit
        : closeFeka ? frame.fekaX + 7 : beat === 'invite' ? 244 : 160;
    c.fillStyle = '#211a31'; c.fillRect(0, 0, 320, 180);
    c.save(); c.translate(160, 150); c.scale(zoom, zoom); c.translate(-focus, -150);
    drawJuiceLabBackground(c, timeMs);
    c.save(); c.translate(0, -Math.round(stageExit * 180)); drawCalabrezzoStageBackground(c, s); c.restore();
    drawJuiceLabFloor(c, 64);
    if (stageExit < 1) { c.save(); c.globalAlpha = 1 - stageExit; drawCalabrezzoStageFloor(c, 160, s); c.restore(); }
    // Warm followspot gives the player's action hierarchy without hiding the stage.
    if (['prepare', 'reveal', 'judges', 'resolve', 'defy'].includes(beat)) {
        c.fillStyle = '#ffe4a315'; c.beginPath(); c.moveTo(frame.fekaX - 10, 25); c.lineTo(frame.fekaX + 24, 25);
        c.lineTo(frame.fekaX + 43, 160); c.lineTo(frame.fekaX - 28, 160); c.fill();
    }
    c.save(); c.translate(Math.round(stageExit * 340), 0); drawCalabrezzoStageCast(c, s); c.restore();
    usher(c, frame);
    feka(c, frame, reducedMotion);
    if (frame.bossReveal > 0) {
        visualBoss.time = timeMs; visualBoss.phase = 'intro'; visualBoss.phaseTime = 0;
        const reveal = frame.bossReveal;
        const scale = (beat === 'emerge' ? 1.35 : beat === 'transition' ? 1.35 - .35 * stageExit : 1.35);
        c.save(); c.translate(271, 160); c.scale(scale, Math.max(.08, reveal) * scale); c.translate(-271, -160);
        c.globalAlpha = Math.min(1, reveal * 3); drawJuiceMiniboss(c, visualBoss, 0, 64); c.restore();
    }
    c.restore();
    // Letterbox is thin and retracts fully before the first attack.
    c.fillStyle = '#171323'; c.fillRect(0, 0, 320, Math.round(7 * (1 - stageExit)));
    c.fillRect(0, 174 + Math.round(stageExit * 6), 320, 6);
    if (frame.subtitle) {
        panel(c, 12, 18, 296, 45, '#211b30ee', '#ae8c61');
        pixelText(c, frame.subtitle.speaker, 22, 25, '#edc785');
        wrapText(frame.subtitle.text, 270).slice(0, 2).forEach((line, i) => pixelText(c, line, 22, 38 + i * 10, '#fff0d4'));
    }
    if (beat === 'walk') {
        pixelText(c, '←', 21, 167, '#fff0d4', 1); pixelText(c, '→', 72, 167, '#fff0d4', 1);
    }
    if (frame.prompt) {
        panel(c, 100, 164, 208, 13, '#211b30', '#ae8c61');
        pixelText(c, frame.prompt, 204, 168, '#fff0d4', 1, 'center');
    }
    if (beat === 'transition' && frame.elapsedMs > 1000) {
        pixelText(c, 'TURBOSUCO', 160, 32, '#ecc6ff', 2, 'center');
    }
}
