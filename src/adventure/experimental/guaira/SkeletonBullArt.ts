import { BULL_RULES, type SkeletonBullModel } from './SkeletonBullModel';
import { pixelLine, polygon } from '../../WorldPainting';

export const BULL_PALETTE = { bone: '#F0DDAE', shade: '#AA8564', horn: '#302836', core: '#9D51E5', glow: '#DCAAF5' };
// Far hind/front, near hind/front: [horizontal reach, lift from the floor].
const GALLOP = [
    [[-4, 0], [4, 2], [4, 3], [-4, 0]],
    [[-2, 2], [5, 0], [2, 4], [-5, 0]],
    [[2, 4], [3, 0], [-2, 2], [-3, 0]],
    [[4, 3], [-4, 0], [-4, 0], [4, 2]],
    [[2, 4], [-5, 0], [-2, 2], [5, 0]],
    [[-2, 2], [-3, 0], [2, 4], [3, 0]],
] as const;

/** Native articulated poses driven by simulation state; no texture rotation or mutation. */
export function drawSkeletonBull(ctx: CanvasRenderingContext2D, b: SkeletonBullModel, reducedMotion = false) {
    const p = BULL_PALETTE, moving = b.state === 'charge', boneTell = b.state === 'rattle' || b.state === 'bones';
    const turning=b.state==='turn';
    const pivot = reducedMotion ? 5 : Math.min(5, Math.floor(b.stateTick * 6 / BULL_RULES.turn));
    const visualFacing = turning && !reducedMotion && pivot < 3 ? -b.facing : b.facing;
    const frontTurn = turning && !reducedMotion && (pivot === 2 || pivot === 3);
    const anticipation = b.state === 'tell'||turning, braking = b.state === 'brake', open = b.vulnerable;
    const hurt = b.state === 'hurt';
    const closing = b.rearming;
    const closure = reducedMotion ? 3 : Math.min(3, Math.floor(b.stateTick * 4 / BULL_RULES.rest));
    // Three deliberate beats, never a faster attack: all cues use the existing clocks.
    // Reduced motion holds the committed silhouette, without hoof/jaw oscillation.
    const preparation = reducedMotion ? 2 : Math.min(2, Math.floor(b.warningProgress * 3));
    const release = reducedMotion ? 2 : Math.min(2, Math.floor(b.boneReleaseAge / 4));
    const nextRib = b.state === 'bones' ? b.boneShots.find(shot => shot.delay > b.stateTick) : undefined;
    const reload = !reducedMotion && nextRib && nextRib.delay - b.stateTick <= 8;
    // Arrest, compress, settle inside the existing brake clock. Hooves stay on
    // the floor, and the final pose is recovery itself: no snap at the boundary.
    // Reduced motion holds that exposed-core pose throughout the opening.
    const settling = reducedMotion ? 2 : Math.min(2, Math.floor(b.stateTick * 3 / BULL_RULES.brake));
    const recoil = hurt ? (reducedMotion ? 1 : Math.max(0, 3 - Math.floor(b.stateTick / 10))) : 0;
    const stride = moving && !reducedMotion ? b.chargeDistance / 15 : 0;
    const frame = Math.floor(stride) % GALLOP.length, next = (frame + 1) % GALLOP.length;
    const between = stride % 1;
    const blend = (a: number, z: number) => Math.round(a + (z - a) * between);
    const pulse = !reducedMotion ? Math.floor(b.stateTick / 8) % 2 : 0;
    const bounce = [8, 7, 6, 7, 8, 8];
    const launchWeight = moving && !reducedMotion ? Math.max(0, 1 - b.chargeDistance / 12) : 0;
    const stopWeight = b.slowingCharge && !reducedMotion ? Math.min(1, Math.max(0, 1 - Math.abs(b.chargeVelocity) / 5.8)) : 0;
    const runningBody = Math.round(blend(bounce[frame], bounce[next]) * (1 - launchWeight) + 10 * launchWeight);
    const bodyY = turning?[7,10,9,9,10,10][pivot]:anticipation ? 8 + preparation : hurt ? 8 - recoil : moving ? Math.round(runningBody * (1 - stopWeight) + 7 * stopWeight) : braking ? [7, 10, 9][settling] : open ? 9
        : closing ? [9,9,8,8][closure] : b.state==='rattle' ? [8,7,10][preparation] : reload ? 7 : b.state==='bones' ? [10,9,8][release] : 8;
    const headDrop = turning?[1,-1,-3,-3,2,6][pivot]:anticipation ? 2 + preparation * 2 : hurt ? -2 - recoil : moving ? Math.round(5 + launchWeight - 4 * stopWeight) : braking ? [1, 5, 8][settling] : open ? 8
        : closing ? [8,5,2,0][closure] : b.state==='rattle' ? [-2,-5,0][preparation] : reload ? -4 : b.state==='bones' ? [0,-1,-2][release] : 0;
    ctx.save(); ctx.translate(Math.round(b.x + b.width / 2), Math.round(b.y)); ctx.scale(visualFacing, 1);
    const r = (color: string, x: number, y: number, w: number, h: number) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
    const line = (x: number, y: number, xx: number, yy: number, color: string, size = 1) => pixelLine(ctx, x, y, xx, yy, color, size);
    r('#542A31', -22, 32, 45, 3);
    if (b.state === 'defeated') {
        const beat=reducedMotion?5:Math.min(5,Math.floor(b.stateTick/8));
        const back=[10,14,20,25,27,28][beat],head=[17,19,23,25,26,26][beat];
        const belly=Math.min(32,back+13);
        // Knees fold, the cage settles and the jaw comes to rest on the clay.
        // Every fragment remains tied to the actual actor and the arena floor.
        for(const hip of [-17,14]){
            line(hip,back+3,hip-5,30,p.shade,3);r(p.horn,hip-8,30,8,4);
            line(hip,back+3,hip-5,29,p.bone);r('#fff1cf',hip-7,30,5,1);
        }
        polygon(ctx,[[-22,back+2],[-18,back-2],[12,back-2],[18,back+2],[15,belly],[-17,belly],[-22,Math.min(belly,back+8)]],p.shade);
        polygon(ctx,[[-18,back+1],[12,back+1],[14,Math.min(belly-1,back+6)],[11,belly-1],[-16,belly-1],[-20,Math.min(belly-1,back+7)]],p.horn);
        if(beat<4){r(p.core,-13,back+3,23,Math.max(1,7-beat));r(p.glow,-7,back+3,6,2);}
        r(p.shade,-22,back-1,39,3);r(p.bone,-21,back-2,37,2);
        for(let rib=0;rib<5;rib++){
            const x=-18+rib*7;r(p.bone,x,back,3,Math.max(2,belly-back));r('#fff1cf',x,back,1,Math.max(1,belly-back-2));
            r(p.shade,x+1,belly-1,5,2);
        }
        const skullX=17-Math.max(0,beat-2);
        r(p.horn,skullX-2,head-1,17,8);r(p.bone,skullX,head,12,7);r('#fff1cf',skullX+1,head,8,1);
        r(p.horn,skullX+4,head+2,4,2);r(p.shade,skullX+9,head+3,3,2);
        r(p.horn,skullX-2,head-6,3,6);r(p.bone,skullX-4,head-7,4,2);
        r(p.horn,skullX+8,head-4,7,2);r(p.bone,skullX+13,head-5,3,2);
        if(beat<4&&!reducedMotion)for(let i=0;i<3;i++)r('#be936a',-28-i*5,30-i%2,3,2);
        ctx.restore(); return;
    }
    function leg(hip: number, index: number, near: boolean) {
        const gallopReach = blend(GALLOP[frame][index][0], GALLOP[next][index][0]);
        const gallopLift = blend(GALLOP[frame][index][1], GALLOP[next][index][1]);
        const loadedReach = gallopReach * (1 - launchWeight) - 4 * launchWeight;
        const [reach, lift] = moving ? [Math.round(loadedReach * (1 - stopWeight) + (hip > 0 ? 5 : -4) * stopWeight), Math.round(gallopLift * (1 - stopWeight) * (1 - launchWeight))]
            : braking ? [hip > 0 ? 5 - settling : settling === 2 ? -3 : -4, 0]
            : turning?[hip>0?[5,4,1,-1,-3,-4][pivot]:[-4,-3,-1,1,-3,-4][pivot],hip>0?[0,2,3,3,1,0][pivot]:0]:anticipation ? [hip > 0 ? -2 - preparation : -4, hip > 0 && preparation === 1 ? 3 : 0]
            : hurt ? [hip > 0 ? -3 : 3, 0]
            : open ? [hip > 0 ? 3 : -3, 0]
            : closing ? [(hip>0?1:-1)*[3,2,1,0][closure],0]
            : b.state==='rattle' ? [hip>0?-3:2,hip>0?[1,4,0][preparation]:0]
            : b.state==='bones' ? [(hip>0?-1:1)*[2,1,0][release],reload && hip>0 ? 3 : 0] : [0, 0];
        const knee = hip + (hip > 0 ? -2 : 3) + Math.round(reach / 2), foot = hip + reach;
        const kneeY = bodyY + 15 - Math.floor(lift / 2), footY = 30 - lift;
        line(hip, bodyY + 11, knee, kneeY, p.shade, 3);
        line(knee, kneeY, foot, footY, p.shade, 3);
        if (near) { line(hip, bodyY + 11, knee, kneeY, p.bone); line(knee, kneeY, foot, footY, p.bone); }
        r(near ? p.bone : p.shade, knee - 1, kneeY - 1, 4, 3);
        if (near) r('#fff1cf', knee, kneeY - 1, 2, 1);
        r(p.horn, foot - 2, footY, 6, 4); r('#826854', foot + 1, footY + 1, 1, 3);
    }
    leg(-12, 0, false); leg(10, 1, false);
    // A stepped rib cage narrows at the belly. Shoulder and hip read as bone,
    // rather than a rectangular body with vertical bars painted on top.
    polygon(ctx, [[-22,bodyY+4],[-18,bodyY], [12,bodyY], [18,bodyY+5],
        [16,bodyY+14],[10,bodyY+17],[-14,bodyY+17],[-21,bodyY+12]], p.shade);
    polygon(ctx, [[-18,bodyY+3],[11,bodyY+3],[15,bodyY+6],[12,bodyY+14],
        [-12,bodyY+15],[-19,bodyY+10]], p.horn);
    const breath = [6, 7, 8, 7, 6, 6];
    const coreHeight = open ? 9 : closing ? [9,8,7,7][closure] : anticipation ? 3 + preparation : moving ? blend(breath[frame], breath[next]) : 7;
    const coreY = bodyY + 6 + Math.floor((7 - coreHeight) / 2);
    r('#694082', -15, coreY - 1, 28, coreHeight + 2);
    r(hurt ? p.glow : p.core, -14, coreY, 25, coreHeight);
    r(p.glow, -10, coreY + 1, open ? 15 : closing ? [15,11,9,7][closure] : 7, open || closing&&closure===0 ? 3 : 2);
    r('#BB73E8', -8, coreY + coreHeight - 2, 13, 2);
    // Dark facets and one small highlight give the visible core depth, without
    // turning its whole box into a blinking warning or changing vulnerability.
    r('#694082', -14, coreY, 3, 2); r('#694082', 8, coreY + coreHeight - 2, 3, 2);
    r('#edcef4', -6, coreY + 1, 3, 1);
    r(p.bone, -20, bodyY, 38, 3);
    for (let x = -17; x < 14; x += 6) {
        r('#fff1cf', x, bodyY, 4, 1); r(p.shade, x + 4, bodyY + 1, 1, 2);
    }
    // Small old fractures reveal progress without covering the readable core.
    for(let i=0;i<Math.floor((BULL_RULES.health-b.health)/2);i++){
        r(p.horn,-13+i*16,bodyY+1,2,1);r(p.shade,-12+i*16,bodyY+2,2,1);
    }
    for (let x = -17, rib = 0; x <= 10; x += 7, rib++) {
        const flare = open ? (rib < 2 ? -2 : 2) : closing ? (rib<2?-1:1)*[2,1,1,0][closure] : hurt ? (rib < 2 ? -3 : 3)
            : boneTell && !reducedMotion ? (rib % 2 ? pulse : -pulse) : 0;
        const ribLength = 13-Math.abs(rib-2);
        const bend = x + flare + (rib < 2 ? -1 : 1), endY = bodyY + (open ? 7 : closing ? Math.round(7+(ribLength-7)*closure/3) : ribLength);
        line(x, bodyY + 2, bend, bodyY + 6, p.bone, 2);
        line(bend, bodyY + 6, x + flare + 1, endY, p.bone, 2);
        r('#fff1cf', x, bodyY + 3, 1, 3);
        r(p.shade, x + flare + 2, endY, 3, 2);
    }
    polygon(ctx, [[-21,bodyY+4],[-17,bodyY+3],[-15,bodyY+7],[-18,bodyY+12],[-21,bodyY+10]], p.bone);
    r('#fff1cf', -20, bodyY + 4, 2, 4);
    r(p.bone, -25, bodyY + 2, 6, 3); line(-25, bodyY + 4, -28, bodyY + 11, p.shade, 2);
    leg(-17, 2, true); leg(16, 3, true);
    if (frontTurn) {
        // Two front-facing pivot poses join the side silhouettes. Direction
        // still reads from the committed ground arrows throughout the turn.
        r(p.shade,-4,bodyY+3,8,12);r(p.bone,-2,bodyY+3,4,10);
        polygon(ctx,[[-10,7+headDrop],[10,7+headDrop],[12,12+headDrop],[9,21+headDrop],[5,25+headDrop],[-5,25+headDrop],[-9,21+headDrop],[-12,12+headDrop]],p.horn);
        polygon(ctx,[[-8,8+headDrop],[8,8+headDrop],[9,13+headDrop],[6,21+headDrop],[4,24+headDrop],[-4,24+headDrop],[-6,21+headDrop],[-9,13+headDrop]],p.bone);
        r('#fff1cf',-6,8+headDrop,12,2);r(p.shade,-1,11+headDrop,2,9);
        for(const side of [-1,1]){
            const eye=side<0?-7:3;r(p.horn,eye,13+headDrop,4,4);r(p.glow,eye+1,14+headDrop,2,1);
            line(side*8,10+headDrop,side*14,5+headDrop,p.horn,3);
            line(side*14,5+headDrop,side*13,1+headDrop,p.horn,3);
            line(side*8,10+headDrop,side*14,5+headDrop,'#796a68');
            line(side*14,5+headDrop,side*13,1+headDrop,'#796a68');
            r(p.bone,side<0?-15:12,headDrop,3,3);
        }
        r(p.shade,-4,21+headDrop,8,3);r(p.horn,-3,21+headDrop,2,2);r(p.horn,1,21+headDrop,2,2);
        r('#fff1cf',-3,24+headDrop,6,1);
    } else {
    ctx.save();ctx.translate(turning && !reducedMotion && (pivot===1||pivot===4)?-10:0,0);
    // Lowered horns signal the charge. The lifted forelegs and rattling cage
    // prepare the loose ribs; the stamp meets their actual launch on the clay.
    line(14, bodyY + 3, 21, 16 + headDrop, p.shade, 5);
    polygon(ctx, [[18,9+headDrop],[28,9+headDrop],[31,12+headDrop],
        [30,17+headDrop],[33,18+headDrop],[33,22+headDrop],[25,23+headDrop],
        [23,21+headDrop],[17,20+headDrop],[16,14+headDrop]], p.bone);
    r('#fff1cf', 19, 10 + headDrop, 8, 2); r('#fff1cf', 18, 12 + headDrop, 2, 4);
    r('#d7bd8b', 28, 13 + headDrop, 2, 6);
    r(p.shade, 18, 18 + headDrop, 8, 3);
    r(p.horn, 22, 13 + headDrop, 5, open || closing&&closure<2 ? 2 : 4);
    r(p.glow, 24, 14 + headDrop, 2, 1);
    r(p.shade, 27, 18 + headDrop, 5, 1); r(p.horn, 30, 19 + headDrop, 2, 2);
    const jaw = boneTell ? (b.state === 'rattle' ? 1 + preparation : 3) : 0;
    r(p.horn, 28, 20 + headDrop, 5, 2 + jaw);
    r(p.bone, 27, 22 + headDrop + jaw, 6, 2);
    r('#fff1cf', 27, 22 + headDrop + jaw, 4, 1);
    r(p.shade, 28, 23 + headDrop + jaw, 1, 1); r(p.shade, 31, 23 + headDrop + jaw, 1, 1);
    if (boneTell) r(p.core, 29, 21 + headDrop, 3, 2);
    r(p.horn, 18, 2 + headDrop, 4, 9); r(p.horn, 21, 1 + headDrop, 6, 3); r(p.bone, 25, headDrop, 3, 3);
    r(p.horn, 27, 5 + headDrop, 4, 6); r(p.horn, 30, 3 + headDrop, 5, 3);
    r('#796a68', 19, 3 + headDrop, 1, 5); r('#796a68', 22, 2 + headDrop, 3, 1);
    r('#796a68', 28, 6 + headDrop, 1, 3); r('#fff1cf', 33, 3 + headDrop, 2, 1);
    ctx.restore();
    }
    if (braking && settling < 2) for (let i = 0; i < 3 - settling; i++)
        r('#DB9C68', -27 - settling * 3 - i * 5, 31 - i % 2, 3 - settling, 2);
    if (open) {
        // Three small costal marks drain only in recovery's final 52 ticks.
        // Discrete information remains available with reduced motion; ribs and
        // the existing opening arrow stay open through the very last tick.
        const marks = Math.ceil(Math.min(BULL_RULES.recover, b.openingTicksRemaining) / (BULL_RULES.recover / 3));
        for (let i = 0; i < 3; i++) {
            r(p.horn, -12 + i * 8, bodyY - 4, 6, 4);
            r(i < marks ? '#fff1bf' : p.shade, -11 + i * 8, bodyY - 3, 4, 2);
        }
    }
    // A local impact notch, rather than a full-body flash or camera effect.
    if (hurt) {
        r('#fff1bf', -4, bodyY + 3, 3, 5);
        r('#fff1bf', -1, bodyY + 6, 4, 2);
    }
    ctx.restore();
}
