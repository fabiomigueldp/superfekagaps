import { PLAYER_PALETTE, PLAYER_SPRITES, PLAYER_WALK } from '../../assets/playerSpriteSpec';
import { pixelText, panel, wrapText } from '../../graphics/BitmapFont';
import { drawCalabrezzoStageBackground, drawCalabrezzoStageCast, drawCalabrezzoStageFloor, type CalabrezzoStageState } from './CalabrezzoStageArt';
import { drawJuiceMiniboss, drawJuiceLabBackground, drawJuiceLabFloor } from './JuiceMinibossArt';
import { JuiceMinibossModel } from './JuiceMinibossModel';
import { drawFluidImpact, fluidPuddle } from './JuiceFluid';
import { JUICE_INTRO_TIMING, type IntroFrame } from './JuiceIntroDirector';
const visualBoss = new JuiceMinibossModel();
function sprite(c: CanvasRenderingContext2D, rows: readonly string[], x: number, y: number) {
    rows.forEach((row, yy) => [...row].forEach((key, xx) => { const color = PLAYER_PALETTE[key]; if (color) { c.fillStyle = color; c.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1); } }));
}
function slimTorso(rows: readonly string[], torsoY = 11) {
    return rows.map((row, y) => {
        if (y < torsoY || y > 18) return row;
        const pixels = [...row];
        for (let x = 4; x <= 12; x++) pixels[x] = '_';
        pixels[6] = 'K'; pixels[7] = 'S'; pixels[8] = 'L'; pixels[9] = 'S'; pixels[10] = 'K';
        for (const x of [1,2,3,13,14,15]) if (['B','b','D'].includes(pixels[x])) pixels[x] = 'S';
        return pixels.join('');
    });
}
const SLIM_IDLE = slimTorso(PLAYER_SPRITES.idle), SLIM_POSE = slimTorso(PLAYER_SPRITES.celebrate), SLIM_BLINK = slimTorso(PLAYER_SPRITES.blink);
const SLIM_WALK = PLAYER_WALK.map((rows, i) => slimTorso(rows, i % 3 === 1 ? 12 : 11));
// Remove only lowered arms during the garment action; the authored head stays intact.
const SLIM_LIFT = SLIM_IDLE.map((row, y) => y < 12 || y > 18 ? row : '______' + row.slice(6, 11) + '_____');
const clamp = (n: number) => Math.max(0, Math.min(1, n));
function shirt(c: CanvasRenderingContext2D, x: number, y: number, height: number) {
    c.fillStyle = PLAYER_PALETTE.K!; c.fillRect(x, y, 9, height);
    c.fillStyle = PLAYER_PALETTE.B!; c.fillRect(x + 1, y + 1, 7, height - 2);
    c.fillStyle = PLAYER_PALETTE.b!; c.fillRect(x + 1, y + 1, 5, 1);
}
function shirtHands(c: CanvasRenderingContext2D, x: number, clothX: number, clothY: number, tuck: number) {
    // Hands follow the same garment through the lift and tuck, never a free-floating prop.
    for (const side of [-1, 1]) {
        const release = side > 0 && tuck > 0;
        const gripX = release ? x + 16 : clothX + (side < 0 ? 0 : 8), handY = release ? 141 : clothY + 2;
        const shoulderX = x + (side < 0 ? 5 : 9);
        const elbowX = x + (side < 0 ? -1 : 15), elbowY = Math.round((147 + handY) / 2 + 2);
        const line = (ax: number, ay: number, bx: number, by: number, size: number) => {
            const length = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
            for (let i = 0; i <= length; i++) c.fillRect(Math.round(ax + (bx - ax) * i / length) - (size >> 1), Math.round(ay + (by - ay) * i / length) - (size >> 1), size, size);
        };
        for (const [color, size] of [[PLAYER_PALETTE.K!, 3], [PLAYER_PALETTE.S!, 1]] as const) {
            c.fillStyle = color;
            line(shoulderX, 147, elbowX, elbowY, size); line(elbowX, elbowY, gripX, handY, size);
        }
    }
}
/** Hand to heart for the vow; a small raised fist delivers the self-deprecating payoff. */
function defiantHands(c: CanvasRenderingContext2D, x: number, f: IntroFrame) {
    const emphasis = f.beat === 'transition' ? 1 : clamp((f.elapsedMs - JUICE_INTRO_TIMING.defyEmphasisMs) / 300);
    const settle = f.beat === 'transition' ? clamp(f.elapsedMs / 750) : 0;
    const limb = (ax: number, ay: number, bx: number, by: number, size: number) => {
        const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
        for (let i = 0; i <= steps; i++) c.fillRect(Math.round(x + ax + (bx - ax) * i / steps) - (size >> 1),
            Math.round(ay + (by - ay) * i / steps) - (size >> 1), size, size);
    };
    for (const side of [-1, 1]) {
        const shoulder = side < 0 ? 5 : 9;
        const elbow = side < 0 ? 1 : 15;
        const handX = side < 0 ? 7 - settle * 3 : 14 + emphasis * 4;
        const handY = side < 0 ? 146 + settle * 8 : 153 - emphasis * 16 * (1 - settle);
        for (const [color, size] of [[PLAYER_PALETTE.K!, 3], [PLAYER_PALETTE.S!, 1]] as const) {
            c.fillStyle = color;
            limb(shoulder, 147, elbow, 151 - (side > 0 ? emphasis * 4 * (1 - settle) : 0), size);
            limb(elbow, 151 - (side > 0 ? emphasis * 4 * (1 - settle) : 0), handX, handY, size);
        }
        c.fillStyle = PLAYER_PALETTE.K!; c.fillRect(Math.round(x + handX) - 1, Math.round(handY) - 1, 3, 3);
        c.fillStyle = PLAYER_PALETTE.L!; c.fillRect(Math.round(x + handX), Math.round(handY), 1, 1);
    }
}
/** Scenic acting derives directly from Feka's authored palette/head/clothes. */
function feka(c: CanvasRenderingContext2D, f: IntroFrame, reduced: boolean) {
    const x = Math.round(f.fekaX), floor = 160;
    const stepping = f.fekaMoving && !reduced;
    const step = Math.floor(f.fekaWalkDistance / 5.5) % PLAYER_WALK.length;
    const lifting = f.beat === 'reveal' && f.elapsedMs >= 100 && f.elapsedMs < 550;
    const flex = f.beat === 'reveal' && f.elapsedMs >= 550 || f.beat === 'judges';
    const defiant = f.beat === 'defy' || f.beat === 'transition' && f.elapsedMs < 750;
    const down = f.beat === 'resolve' && f.elapsedMs < 650;
    c.fillStyle = '#17132388'; c.fillRect(x + 2, floor - 1, 14, 2);
    const bare = ['reveal','judges','resolve','emerge','invite','defy','transition'].includes(f.beat)
        && !(f.beat === 'reveal' && f.elapsedMs < 100)
        && !(f.beat === 'transition' && f.elapsedMs >= 750);
    const frame = lifting || defiant ? SLIM_LIFT : bare ? down ? SLIM_BLINK : flex ? SLIM_POSE : stepping ? SLIM_WALK[step] : SLIM_IDLE
        : down ? PLAYER_SPRITES.blink : flex || defiant ? PLAYER_SPRITES.celebrate : stepping ? PLAYER_WALK[step] : PLAYER_SPRITES.idle;
    // Walk frames already contain the authored head/leg motion; keep the feet on their floor.
    sprite(c, frame, x - 1, floor - 26);
    if (bare) {
        const lift = clamp((f.elapsedMs - 100) / 200), tuck = clamp((f.elapsedMs - 300) / 250);
        const dressing = f.beat === 'transition' ? clamp(f.elapsedMs / 750) : 0;
        const clothX = Math.round(x + (lifting ? 3 - tuck - Math.sin(tuck * Math.PI) * 11 : 2 + dressing));
        const clothY = Math.round(lifting ? floor - 15 - lift * 17 + tuck * 23 : floor - 9 - dressing * 6);
        const clothH = Math.round(lifting ? 9 - lift * 4 : 5 + dressing * 4);
        if (lifting) shirtHands(c, x, clothX, clothY, tuck);
        // At the first lift pixel this covers the whole torso, then exposes it from the hem up.
        shirt(c, clothX, clothY, clothH);
    }
    if (defiant) defiantHands(c, x, f);
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
// The escort is a small, authored pixel puppet, not a stretched rectangle. All
// skin, cloth and shoes share this limited ramp; limbs articulate behind the torso.
const ESCORT = {
    K: '#211a29', H: '#392b30', h: '#665044', D: '#86513f', S: '#b97954',
    M: '#d59a68', L: '#f1be87', F: '#ffdcaa', T: '#274a53', t: '#3d7074',
    A: '#68a3a1', W: '#e5d4ad', B: '#8a765f', _: '',
};
const ESCORT_HEAD = [
    '___KKKKKKK___',
    '__KHHhhHHHK__',
    '_KHHHHHHHHHK_',
    '_KHHHHHhHHHK_',
    '_KHHDMMMMMMK_',
    '_KHDSLLMLKKK_',
    '_KHDMLLMFKSK_',
    '__KDMLMMMLMSK',
    '__KDDSMMMMSK_',
    '___KDDMMKKK__',
    '____KDDMMK___',
    '____KDSMLK___',
] as const;
const ESCORT_TORSO = [
    '______KKKKKKKKK______',
    '___KKKSDDMLLMMDKKK___',
    '__KSMLLLMDDMLLLLMSK__',
    '_KSMLLFFLMDMLFFLLMSK_',
    'KDSMLLLLMDDMLLLLMSDKK',
    'KDSMMMLLMDDMLLMMMSDKK',
    '_KDSSMMMSDDSSMMMSDKK_',
    '__KDSSSSDDDDSSSSDKK__',
    '___KDSMMLDDLMMSDKK___',
    '___KDDMLMDDMLMDDK____',
    '____KDSMMDDSMSDK_____',
    '____KDMLMDDMLMDK_____',
    '_____KSMMDDSMSK______',
    '_____KDSMMMMDSK______',
    '_____KDDSSSSDDK______',
] as const;
function escortSprite(c: CanvasRenderingContext2D, rows: readonly string[], x: number, y: number) {
    rows.forEach((row, yy) => [...row].forEach((key, xx) => {
        const color = ESCORT[key as keyof typeof ESCORT];
        if (color) { c.fillStyle = color; c.fillRect(x + xx, y + yy, 1, 1); }
    }));
}
/** Stepped, tapered bones preserve a single connected pixel silhouette at any pose. */
function escortBone(c: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, width: number, color: string) {
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
    c.fillStyle = color;
    for (let i = 0; i <= steps; i++) {
        const size = Math.max(1, Math.round(width - i / steps));
        c.fillRect(Math.round(ax + (bx - ax) * i / steps) - Math.floor(size / 2),
            Math.round(ay + (by - ay) * i / steps) - Math.floor(size / 2), size, size);
    }
}
/** Foreground actor shares Feka's floor; the shove comes from a connected hand. */
export function drawJuiceIntroEscort(c: CanvasRenderingContext2D, frame: IntroFrame, reducedMotion = false) {
    if (!['establish', 'walk', 'push', 'prepare'].includes(frame.beat)) return;
    if (frame.beat === 'prepare' && frame.elapsedMs > 750) return;
    const leaving = frame.beat === 'prepare';
    const retreat = clamp((frame.elapsedMs - 100) / 650);
    const retreatDistance = leaving ? retreat * retreat * (3 - 2 * retreat) * 108 : 0;
    // Continuous x at every authored cut: walk -> shove -> turn -> exit.
    const x = (leaving ? 86 : frame.fekaX - 26) - retreatDistance;
    const moving = leaving ? retreat > 0 && retreat < 1 : frame.beat === 'walk' && frame.fekaMoving
        || frame.beat === 'push' && frame.fekaMoving;
    const distance = leaving ? retreatDistance : frame.fekaX - 36;
    const gait = moving && !reducedMotion ? distance * Math.PI / 10 : 0;
    const stride = moving && !reducedMotion ? Math.sin(gait) : 0;
    const turn = leaving && frame.elapsedMs >= 100 ? -1 : 1;
    const bob = moving && !reducedMotion ? Math.round(Math.abs(Math.sin(gait)) * .7) : 0;
    const pushing = frame.beat === 'push';
    const reach = pushing ? 1 : frame.beat === 'walk' ? clamp((frame.fekaX - 86) / 12)
        : leaving ? 1 - clamp(frame.elapsedMs / 100) : 0;
    const push = pushing ? Math.sin(clamp(frame.elapsedMs / 650) * Math.PI) : 0;
    c.save(); c.translate(Math.round(x), 160); c.scale(turn, 1);
    const r = (xx: number, y: number, w: number, h: number, color: string) => {
        c.fillStyle = color; c.fillRect(Math.round(xx), Math.round(y), w, h);
    };
    r(-12, -1, 25, 2, '#15132170');
    const leg = (side: -1 | 1, rear: boolean) => {
        const phase = ((distance / 20 + (rear ? .5 : 0)) % 1 + 1) % 1;
        const walking = moving && !reducedMotion;
        // During stance, the foot moves back by exactly the body's displacement.
        // The other foot clears the floor on its return arc; one sole always plants.
        const offset = !walking ? 0 : phase < .5 ? 5 - phase * 20 : -5 + (phase - .5) * 20;
        const lift = walking && phase >= .5 ? Math.round(Math.sin((phase - .5) * Math.PI * 2) * 4) : 0;
        const hip = side * 4, foot = hip + Math.round(offset);
        const knee = hip + Math.round(offset * .4), ky = -7 - lift;
        for (const [color, width] of [[ESCORT.K, 6], [rear ? ESCORT.D : ESCORT.M, 4]] as const) {
            escortBone(c, hip, -12 - bob, knee, ky, width, color);
            escortBone(c, knee, ky, foot, -3 - lift, width - 1, color);
        }
        // Socks and low trainers have a heel, instep, toe and a continuous sole.
        r(foot - 2, -5 - lift, 4, 3, rear ? ESCORT.B : ESCORT.W);
        r(foot - 3, -3 - lift, 8, 3, ESCORT.K);
        r(foot - 2, -3 - lift, 5, 2, rear ? ESCORT.T : ESCORT.t);
        r(foot + 3, -2 - lift, 2, 1, ESCORT.W);
        r(foot - 2, -1 - lift, 8, 1, rear ? ESCORT.B : ESCORT.W);
        if (!rear) r(foot, -3 - lift, 2, 1, ESCORT.W);
    };
    const arm = (rear: boolean) => {
        const side = rear ? -1 : 1;
        const shoulderX = rear ? -7 : 7, shoulderY = -29 - bob;
        const swing = stride * (rear ? 1 : -1);
        const elbowX = rear ? -11 + Math.round(swing * 2) : Math.round(10 + swing * 2 + reach * (5 - swing * 2));
        const elbowY = !rear && reach > 0 ? -22 - Math.round(push * 2) : -22 - bob;
        // Feka is 26 px in front. The palm meets the authored shoulder at x+3.
        const restingHandX = side * 10 + Math.round(swing * 5);
        const handX = rear ? restingHandX : Math.round(restingHandX + (29 - restingHandX) * reach);
        const handY = !rear && reach > 0 ? -16 : -15 - bob;
        for (const [color, width] of [[ESCORT.K, 7], [rear ? ESCORT.S : ESCORT.M, 5]] as const) {
            escortBone(c, shoulderX, shoulderY, elbowX, elbowY, width, color);
            escortBone(c, elbowX, elbowY, handX, handY, width - 1, color);
        }
        escortBone(c, shoulderX - 1, shoulderY - 1, elbowX - 1, elbowY - 1, 2, rear ? ESCORT.M : ESCORT.L);
        escortBone(c, elbowX, elbowY - 1, handX, handY - 1, 2, rear ? ESCORT.S : ESCORT.L);
        r(handX - 2, handY - 2, 4, 4, ESCORT.K);
        r(handX - 1, handY - 2, 3, 3, rear ? ESCORT.M : ESCORT.L);
        r(handX, handY, 2, 1, ESCORT.S);
    };
    leg(-1, true); arm(true); leg(1, false);
    escortSprite(c, ESCORT_TORSO, -10, -33 - bob);
    // Tailored shorts, curved leg openings, side seam and a tiny competition badge.
    r(-7, -19 - bob, 15, 8, ESCORT.K); r(-6, -18 - bob, 13, 6, ESCORT.T);
    r(-6, -18 - bob, 13, 2, ESCORT.W); r(-5, -15 - bob, 5, 3, ESCORT.t);
    r(2, -15 - bob, 4, 3, ESCORT.t); r(-6, -16 - bob, 1, 4, ESCORT.A);
    r(6, -16 - bob, 1, 4, ESCORT.A); r(0, -14 - bob, 2, 3, ESCORT.K);
    r(2, -17 - bob, 3, 3, ESCORT.W); r(3, -16 - bob, 1, 1, ESCORT.K);
    escortSprite(c, ESCORT_HEAD, -6, -43 - bob);
    arm(false);
    c.restore();
}
export function drawJuiceIntro(c: CanvasRenderingContext2D, frame: IntroFrame, reducedMotion = false) {
    const { beat, timeMs, stageExit } = frame;
    const s: CalabrezzoStageState = { time: timeMs, floorY: 160, reducedMotion,
        // Clear the cast before the lab is exposed, avoiding lingering translucent people.
        castOpacity: Math.max(0, 1 - stageExit * 3),
        reaction: beat === 'judges' && frame.elapsedMs >= JUICE_INTRO_TIMING.judgeLaughMs || beat === 'resolve' ? 'mock'
            : ['emerge', 'invite', 'defy', 'transition'].includes(beat) ? 'shock' : 'neutral' };
    const closeFeka = ['reveal', 'resolve', 'defy'].includes(beat);
    const zoom = reducedMotion ? 1 : beat === 'transition' ? 1 + (1 - stageExit) : closeFeka ? 2 : beat === 'invite' ? 1.5 : 1;
    const focus = reducedMotion ? 160 : beat === 'transition' ? (frame.fekaX + 7) * (1 - stageExit) + 160 * stageExit
        : closeFeka ? frame.fekaX + 7 : beat === 'invite' ? 244 : 160;
    c.fillStyle = '#211a31'; c.fillRect(0, 0, 320, 180);
    c.save(); c.translate(160, 150); c.scale(zoom, zoom); c.translate(-focus, -150);
    drawJuiceLabBackground(c, reducedMotion ? 0 : timeMs);
    c.save(); c.translate(0, -Math.round(stageExit * 180)); drawCalabrezzoStageBackground(c, s); c.restore();
    drawJuiceLabFloor(c, 64);
    if (stageExit < 1) { c.save(); c.globalAlpha = 1 - stageExit; drawCalabrezzoStageFloor(c, 160, s); c.restore(); }
    // Warm followspot gives the player's action hierarchy without hiding the stage.
    if (['prepare', 'reveal', 'judges', 'resolve', 'defy'].includes(beat)) {
        c.fillStyle = '#ffe4a315'; c.beginPath(); c.moveTo(frame.fekaX - 10, 25); c.lineTo(frame.fekaX + 24, 25);
        c.lineTo(frame.fekaX + 43, 160); c.lineTo(frame.fekaX - 28, 160); c.fill();
    }
    if (s.castOpacity! > 0) drawCalabrezzoStageCast(c, s);
    // A quiet speaker mark connects each caption to its judge, even without sound.
    if (beat === 'judges' && frame.subtitle) {
        const judgeX = frame.elapsedMs < JUICE_INTRO_TIMING.secondJudgeMs ? 205 : 237;
        c.fillStyle = '#edc785';
        c.fillRect(judgeX - 2, 84, 5, 1); c.fillRect(judgeX - 1, 85, 3, 1); c.fillRect(judgeX, 86, 1, 1);
    }
    drawJuiceIntroEscort(c, frame, reducedMotion);
    feka(c, frame, reducedMotion);
    if (frame.bossReveal > 0) {
        visualBoss.time = timeMs; visualBoss.phase = 'intro'; visualBoss.phaseTime = 0;
        const reveal = frame.bossReveal;
        const scale = (beat === 'emerge' ? 1.35 : beat === 'transition' ? 1.35 - .35 * stageExit : 1.35);
        const bossCenter = visualBoss.x + visualBoss.width / 2;
        if (beat === 'emerge') {
            // The silhouette rises out of the same heavy pool, with a settling wake.
            c.save(); c.globalAlpha = Math.min(1, reveal * 5);
            fluidPuddle(c, bossCenter, 159, 20 + reveal * 9, 2.6, 42);
            if (!reducedMotion && frame.elapsedMs >= 1500 && frame.elapsedMs < 2150)
                drawFluidImpact(c, bossCenter, 159, frame.elapsedMs - 1500, 'landing', 42, 650);
            c.restore();
        }
        c.save(); c.translate(bossCenter, 160); c.scale(scale, Math.max(.08, reveal) * scale); c.translate(-bossCenter, -160);
        c.globalAlpha = Math.min(1, reveal * 3); drawJuiceMiniboss(c, visualBoss, 0, 64, reducedMotion); c.restore();
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
