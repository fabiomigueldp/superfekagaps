import { box as r, oval, pixelLine as line, polygon } from '../../WorldPainting';
import type { MovingBody } from '../../WorldPhysics';
import { drawGuairaPoolFlow, drawGuairaReservoirFlow, drawGuairaSluiceFlow, drawGuairaSluiceImpact } from './GuairaWaterworksArt';

/** Presentation of the two native bridges; their bodies remain the sole source of motion. */
export function guairaSluiceRise(body: MovingBody): number {
    const home = body.home?.y ?? body.y, end = body.to?.y ?? home;
    return home === end ? 0 : Math.max(0, Math.min(1, (home - body.y) / (home - end)));
}

/** Small upstream basin, embedded in a clay berm behind the gate masonry. */
export function drawGuairaSluiceReservoir(c: CanvasRenderingContext2D, x: number, y: number,
    flowing = false, time = 0, reduced = false) {
    c.save(); x=Math.round(x); y=Math.round(y);
    polygon(c, [[x-14,y+55],[x-4,y+18],[x+14,y+4],[x+82,y+4],[x+109,y+49],[x+117,y+64]], '#b77756');
    // Broad clay facets meet the surrounding bank; no speckled texture or false platform edge.
    polygon(c, [[x-13,y+52],[x-4,y+19],[x+10,y+8],[x+17,y+22],[x+5,y+47],[x-2,y+56]], '#c18a60');
    polygon(c, [[x+75,y+8],[x+83,y+6],[x+108,y+49],[x+117,y+64],[x+88,y+57],[x+70,y+26]], '#a76b51');
    polygon(c, [[x-14,y+55],[x+7,y+49],[x+20,y+52],[x+84,y+54],[x+105,y+51],[x+117,y+64]], '#b47b56');
    line(c,x-5,y+39,x+6,y+32,'#ce9868');
    line(c,x+82,y+32,x+96,y+41,'#bd815a');
    oval(c, x+1, y+5, 81, 23, '#916e54');
    oval(c, x, y, 83, 24, '#ae8a69');
    oval(c, x+3, y+1, 77, 19, '#d4ba91');
    oval(c, x+7, y+4, 69, 12, '#326f81');
    oval(c, x+9, y+4, 65, 9, '#83c0bb');
    for (const [dx,dy,ex,ey] of [[12,5,9,3],[28,2,27,0],[58,2,59,0],[73,5,77,3],
        [10,15,6,18],[23,18,21,23],[63,18,65,23],[74,15,78,18]]) {
        line(c,x+dx,y+dy,x+ex,y+ey,'#a58a69');
    }
    r(c,x+12,y+13,9,1,'#608f80'); r(c,x+63,y+12,7,1,'#608f80');
    r(c,x+17,y+6,12,1,'#b3d6c5'); r(c,x+59,y+8,6,1,'#b3d6c5');
    // A cut in the front coping gives the water a continuous route to the shutter.
    r(c,x+29,y+16,26,11,'#886e56');
    r(c,x+31,y+14,22,13,'#a78a65');
    r(c,x+33,y+13,18,14,'#477e82');
    r(c,x+35,y+13,14,14,'#79b1ad');
    drawGuairaReservoirFlow(c,x,y,flowing,time,reduced);
    r(c,x+29,y+16,3,10,'#c6aa7f'); r(c,x+52,y+16,3,10,'#b79970');
    r(c,x+30,y+18,1,6,'#d1b78b'); r(c,x+53,y+18,1,6,'#997b59');
    c.restore();
}

/** A recessed stone seat and split ferrule straddle the wall. The three-pixel
 * inspection glass outside the masonry is left intact, preserving the route's phase. */
function pipeSocket(c: CanvasRenderingContext2D, wall: number, y: number, side: -1 | 1) {
    const at=(u:number,v:number,w:number,h:number,color:string)=>
        r(c,wall+side*u-(side<0?w-1:0),y+v,w,h,color);
    at(-5,-10,8,4,'#806c58'); at(-5,7,8,4,'#806c58');
    at(-5,-6,5,13,'#806c58');
    at(-4,-9,6,3,'#bca17d'); at(-4,7,6,3,'#a58b68');
    at(-4,-6,4,13,'#a58b68');
    // Gasket and flange frame the exposed pipe, never its water-filled centre.
    at(1,-6,5,3,'#665b4d'); at(1,4,5,3,'#665b4d');
    at(2,-7,3,3,'#b49a70'); at(2,5,3,3,'#997c57');
    at(2,-7,3,1,'#cfb58a');
    at(3,-6,1,1,'#e0c49a'); at(3,6,1,1,'#c3a57b');
    at(0,-4,1,9,'#6f604f');
}

/** Gate, spill and receiving pool share the real bridge's valve and travel fraction. */
export function drawGuairaSluice(c: CanvasRenderingContext2D, body: MovingBody,
    wx: number, wy: number, cx: number, cy: number, time: number, reduced: boolean) {
    c.save(); cx=Math.round(cx); cy=Math.round(cy);
    const x = Math.round(wx)-cx, top = Math.round(wy)-cy, bottom = 260-cy;
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
        r(c, x+2, yy+1, 3, 1, '#b49b78'); r(c, x+45, yy+8, 3, 1, '#c2aa82');
    }
    pipeSocket(c,x,top+23,-1); pipeSocket(c,x+49,top+23,1);
    const gateY = top+14-Math.round(rise*11);
    r(c,x+8,gateY,34,35,'#69574c');
    for (let yy=0; yy<35; yy+=7) {
        r(c, x+9, gateY+yy, 32, 6, yy%14===0 ? '#a7825d' : '#926c50');
        r(c, x+9, gateY+yy, 32, 1, '#c4a074');
        r(c,x+18+yy%3,gateY+yy+3,yy%14===0?9:5,1,'#b08a60');
    }
    for (const dx of [13,35]) {
        r(c, x+dx, gateY, 3, 33, '#665951');
        for (const dy of [3,17,29]) r(c, x+dx+1, gateY+dy, 1, 1, '#b5a083');
    }
    r(c,x+9,gateY+33,32,2,'#756652'); r(c,x+10,gateY+33,30,1,'#a89a73');
    // Fixed guides receive the shutter; a travelling nut stays attached to the wood.
    for (const dx of [6,41]) {
        r(c,x+dx,top+4,3,bottom-top-4,'#746854');
        r(c,x+dx,top+5,1,bottom-top-6,'#b7a17b');
        for (const dy of [10,37]) {
            r(c,x+dx-1,top+dy,5,4,'#827861');
            r(c,x+dx+1,top+dy+1,1,1,'#c8b28c');
        }
    }
    r(c,x+23,top-6,3,gateY+12-(top-6),'#967a54');
    r(c,x+24,top-6,1,gateY+10-(top-6),'#c6a675');
    for (let yy=top-3;yy<gateY+7;yy+=4) r(c,x+23,yy,3,1,'#6e6250');
    r(c,x+18,gateY+8,14,4,'#766750'); r(c,x+19,gateY+8,12,1,'#bca077');
    r(c,x+20,gateY+10,1,1,'#d3b88a'); r(c,x+29,gateY+10,1,1,'#d3b88a');
    // The yoke is anchored in both jambs; the wheel only turns with actual lift.
    r(c,x+5,top-6,4,9,'#857357'); r(c,x+41,top-6,4,9,'#857357');
    r(c,x+5,top-7,40,3,'#9c8561'); r(c,x+6,top-7,38,1,'#c1a77a');
    oval(c,x+16,top-12,18,6,'#6f604d'); oval(c,x+18,top-11,14,4,'#b49a6c');
    const turn=rise*Math.PI*4;
    for (let spoke=0;spoke<3;spoke++) {
        const a=turn+spoke*Math.PI*2/3;
        line(c,x+25,top-9,x+25+Math.round(Math.cos(a)*7),top-9+Math.round(Math.sin(a)*2),'#d0b785');
    }
    r(c,x+23,top-10,4,3,'#8f7b59'); r(c,x+24,top-10,2,1,'#dec395');
    const poolX = Math.round(body.x)+8-cx, poolW = Math.round(body.width)-16, poolY = 265-cy;
    if (wet) {
        const spillY = gateY+35;
        r(c, x+10, spillY, 30, 269-cy-spillY, '#326f81');
        r(c, x+13, spillY, 23, 269-cy-spillY, '#63b6bf');
        r(c, x+14, spillY, 3, 269-cy-spillY, '#8bcec7');
        r(c,x+14,spillY,21,1,'#98cfc3');
        // Fixed world anchor: raising the shutter reveals water, without dragging falling streaks upward.
        drawGuairaSluiceFlow(c, x, spillY, poolY, true, time, reduced, top+49);
        r(c, poolX, poolY, poolW, 23, '#326f81');
        r(c, poolX+4, poolY, poolW-8, 3, '#63b6bf');
        drawGuairaPoolFlow(c, poolX+4, poolX+poolW-4, poolY, true, time, reduced, x+25);
        drawGuairaSluiceImpact(c, poolX+4, poolX+poolW-4, poolY, x+25, true, time, reduced);
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
    c.restore();
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
