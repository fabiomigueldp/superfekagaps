import { box as r } from '../../../WorldPainting';
import type { MovingBody } from '../../../WorldPhysics';

const P = {
    edge: '#735b4b', brass: '#b99465', light: '#d4b680', shade: '#997650',
    water: '#68b6bf', glint: '#b7dfd3', dry: '#bd9165', iron: '#65796f',
} as const;

export { drawGuairaPipe as drawJunctionPipe, drawGuairaPipeElbow as drawJunctionElbow } from '../GuairaPipeArt';

/** Fixed feet and cylinder barrel, with a polished rod reaching the real deck.
 * The deck occludes the hardware as it docks; no piece projects above its top. */
export function drawJunctionCylinder(c:CanvasRenderingContext2D,b:MovingBody,cx:number,cy:number,floor:number) {
    const center=Math.round(b.x+b.width/2)-Math.round(cx);
    const top=Math.round(b.y+b.height)-Math.round(cy), bottom=Math.round(floor)-Math.round(cy);
    if(bottom<=top)return;
    c.save();c.beginPath();c.rect(center-13,top,26,bottom-top);c.clip();
    r(c,center-6,top,12,bottom-top,P.edge);
    r(c,center-5,top,9,bottom-top,'#81958a');
    r(c,center-3,top,2,bottom-top,'#bed0b6');
    r(c,center+3,top,2,bottom-top,'#526b66');
    // Socket travels with the deck; the ram and foot below stay bolted to the floor.
    r(c,center-10,top,20,3,P.edge);r(c,center-8,top,16,1,P.brass);
    for(const dx of [-8,7])r(c,center+dx,top+1,1,1,P.light);
    r(c,center-9,bottom-29,18,25,P.edge);
    r(c,center-8,bottom-28,16,23,P.iron);
    r(c,center-6,bottom-27,3,21,'#9ea98d');
    r(c,center+6,bottom-27,2,21,'#536a61');
    for(const yy of [bottom-28,bottom-9]) {
        r(c,center-10,yy,20,4,P.edge);r(c,center-9,yy+1,18,2,P.brass);
        r(c,center-8,yy+1,2,1,P.light);r(c,center+7,yy+2,1,1,P.shade);
    }
    r(c,center-12,bottom-5,24,5,P.edge);r(c,center-11,bottom-4,22,3,P.iron);
    for(const dx of [-9,8])r(c,center+dx,bottom-4,2,1,'#a7b49b');
    c.restore();
}
