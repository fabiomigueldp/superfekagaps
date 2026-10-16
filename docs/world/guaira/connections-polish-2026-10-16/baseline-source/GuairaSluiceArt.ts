import { box as r, oval, pixelLine as line, polygon } from '../../WorldPainting';
import type { MovingBody } from '../../WorldPhysics';
import { drawGuairaPoolFlow, drawGuairaSluiceFlow } from './GuairaWaterworksArt';

/** Presentation of the two native bridges; their bodies remain the sole source of motion. */
export function guairaSluiceRise(body: MovingBody): number {
    const home = body.home?.y ?? body.y, end = body.to?.y ?? home;
    return home === end ? 0 : Math.max(0, Math.min(1, (home - body.y) / (home - end)));
}

/** Small upstream basin, embedded in a clay berm behind the gate masonry. */
export function drawGuairaSluiceReservoir(c: CanvasRenderingContext2D, x: number, y: number) {
    polygon(c, [[x-14,y+55],[x-4,y+18],[x+14,y+4],[x+82,y+4],[x+109,y+49],[x+117,y+64]], '#b77756');
    oval(c, x, y, 83, 24, '#ae8a69');
    oval(c, x+3, y+1, 77, 19, '#d4ba91');
    oval(c, x+7, y+4, 69, 12, '#326f81');
    oval(c, x+9, y+4, 65, 9, '#83c0bb');
    r(c, x+15, y+7, 18, 1, '#c5dfc8');
    r(c, x+60, y+8, 7, 1, '#c5dfc8');
    // A dark outlet throat connects the basin to the recessed gate, without a platform lip.
    r(c, x+26, y+18, 28, 8, '#96755b');
    r(c, x+31, y+20, 18, 6, '#638f8d');
}

/** Gate, spill and receiving pool share the real bridge's valve and travel fraction. */
export function drawGuairaSluice(c: CanvasRenderingContext2D, body: MovingBody,
    wx: number, wy: number, cx: number, cy: number, time: number, reduced: boolean) {
    const x = wx-cx, top = wy-cy, bottom = 260-cy;
    const rise = guairaSluiceRise(body), wet = body.active;
    r(c, x, top, 50, bottom-top, '#92745f');
    r(c, x+6, top+5, 38, bottom-top-5, '#705950');
    r(c, x+9, top+6, 32, bottom-top-6, '#a08164');
    r(c, x+7, top+5, 2, bottom-top-5, '#65594f');
    r(c, x+41, top+5, 2, bottom-top-5, '#816c56');
    r(c, x+6, top+3, 38, 2, '#b09775');
    r(c, x+1, top+1, 4, bottom-top-2, '#c3ac89');
    r(c, x+45, top+1, 4, bottom-top-2, '#b49b7a');
    for (let yy=top+18; yy<bottom-4; yy+=19) {
        r(c, x+1, yy, 4, 1, '#9a8068'); r(c, x+45, yy+7, 4, 1, '#8a735f');
    }
    const gateY = top+14-Math.round(rise*11);
    for (let yy=0; yy<35; yy+=7) {
        r(c, x+8, gateY+yy, 34, 6, yy%14===0 ? '#a7825d' : '#926c50');
        r(c, x+9, gateY+yy, 32, 1, '#c4a074');
    }
    for (const dx of [13,35]) {
        r(c, x+dx, gateY, 3, 33, '#665951');
        for (const dy of [3,17,29]) r(c, x+dx+1, gateY+dy, 1, 1, '#b5a083');
    }
    // The stem remains attached to the shutter throughout its actual lift.
    r(c, x+23, top-9, 3, gateY+12-(top-9), '#b78a56');
    r(c, x+24, top-8, 1, gateY+10-(top-8), '#d1ac77');
    r(c, x+14, top-10, 20, 3, '#745d4f');
    r(c, x+14, top-11, 20, 1, '#c7a477');
    const poolX = Math.round(body.x)+8-cx, poolW = Math.round(body.width)-16, poolY = 265-cy;
    if (wet) {
        const spillY = gateY+35;
        r(c, x+10, spillY, 30, 269-cy-spillY, '#326f81');
        r(c, x+13, spillY, 23, 269-cy-spillY, '#63b6bf');
        r(c, x+14, spillY, 3, 269-cy-spillY, '#8bcec7');
        // Fixed world anchor: raising the shutter reveals water, without dragging falling streaks upward.
        drawGuairaSluiceFlow(c, x, spillY, poolY, true, time, reduced, top+49);
        r(c, poolX, poolY, poolW, 23, '#326f81');
        r(c, poolX+4, poolY, poolW-8, 3, '#63b6bf');
        drawGuairaPoolFlow(c, poolX+4, poolX+poolW-4, poolY, true, time, reduced, x+25);
    } else {
        // Mineral runs stay within the dry race, below the closed timber shutter.
        for (const [dx,length] of [[12,18],[25,25],[35,13]]) {
            r(c, x+dx, gateY+36, 2, Math.min(length,bottom-gateY-38), '#94765b');
            r(c, x+dx, gateY+36, 1, Math.min(8,bottom-gateY-38), '#b0966f');
        }
        r(c, poolX, poolY, poolW, 23, '#8c5e4b');
        for (let xx=poolX+8; xx<poolX+poolW-6; xx+=31) {
            line(c, xx, poolY+4, xx+7, poolY+11, '#684b42');
            line(c, xx+7, poolY+11, xx+3, poolY+19, '#684b42');
        }
    }
}

/** Bank-mounted cantilevers, fixed bearings and chains terminating at the real deck.
 * Link translation and pulley rotation use displacement, never decorative time.
 */
export function drawGuairaBridgeHoists(c: CanvasRenderingContext2D, body: MovingBody,
    leftBankY: number, rightBankY: number, cx: number, cy: number) {
    c.save();
    cx = Math.round(cx); cy = Math.round(cy);
    const left = Math.round(body.home?.x ?? body.x), right = left+Math.round(body.width);
    const deckY = Math.round(body.y), axleY = Math.min(leftBankY,rightBankY)-37;
    const displacement = (body.home?.y ?? body.y)-body.y;
    for (const side of [1,-1] as const) {
        const bankY = side===1 ? leftBankY : rightBankY;
        const post = side===1 ? left-9 : right+8;
        const cable = Math.round(body.x)+(side===1 ? 5 : Math.round(body.width)-6);
        const axle = cable-side*4;
        const x = post-cx, y = axleY-cy;
        // Footings sit entirely on the banks, preserving every native terrain cap.
        r(c, x-8, bankY-9-cy, 17, 9, '#92795d');
        r(c, x-6, bankY-8-cy, 13, 2, '#b59b73');
        r(c, x-3, y-8, 7, bankY-2-axleY+8, '#786554');
        r(c, x-2, y-7, 4, bankY-3-axleY+7, '#b1966e');
        r(c, x-2, y-7, 1, bankY-4-axleY+7, '#c5ab7e');
        line(c, post-cx, axleY+20-cy, axle-cx, axleY-5-cy, '#796b59', 3);
        line(c, post-cx, axleY+18-cy, axle-cx, axleY-5-cy, '#ad9570');
        const beamLeft = Math.min(post,axle)-4, beamRight = Math.max(post,axle)+5;
        r(c, beamLeft-cx, y-8, beamRight-beamLeft, 5, '#756654');
        r(c, beamLeft+1-cx, y-7, beamRight-beamLeft-2, 2, '#b19a73');
        for (const yy of [axleY+9,bankY-14]) {
            r(c, x-4, yy-cy, 9, 3, '#7c8170'); r(c, x-2, yy+1-cy, 1, 1, '#c3b48e');
        }
        // Full length to the attachment, with no loose tail below a rising bridge.
        const chainTop = axleY+1, chainBottom = Math.max(chainTop,deckY+2);
        r(c, cable-1-cx, chainTop-cy, 2, chainBottom-chainTop, '#817563');
        for (let yy=deckY-3; yy>=chainTop; yy-=6) {
            r(c, cable-1-cx, yy-cy, 2, 2, '#b9a78b');
            r(c, cable-cx, yy+2-cy, 1, 2, '#9b8c73');
        }
        oval(c, axle-5-cx, y-5, 11, 11, '#665c50');
        oval(c, axle-4-cx, y-4, 9, 9, '#b49a6e');
        oval(c, axle-2-cx, y-2, 5, 5, '#7c705a');
        const turn = -side*displacement/4;
        for (let spoke=0; spoke<3; spoke++) {
            const a = turn+spoke*Math.PI*2/3;
            line(c, axle-cx, y, axle-cx+Math.round(Math.cos(a)*3), y+Math.round(Math.sin(a)*3), '#d0b889');
        }
        r(c, axle-cx, y, 1, 1, '#ede0b3');
    }
    c.restore();
}
