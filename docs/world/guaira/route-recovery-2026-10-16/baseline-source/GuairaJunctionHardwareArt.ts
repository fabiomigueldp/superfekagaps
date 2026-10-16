import { box as r, oval } from '../../../WorldPainting';
import type { MovingBody } from '../../../WorldPhysics';

const P = {
    edge: '#735b4b', brass: '#b99465', light: '#d4b680', shade: '#997650',
    water: '#68b6bf', glint: '#b7dfd3', dry: '#bd9165', iron: '#65796f',
} as const;

export { drawGuairaPipe as drawJunctionPipe, drawGuairaPipeElbow as drawJunctionElbow } from '../GuairaPipeArt';

/** Municipal inlet seated on the bank, with a bolted cover and inset water gauge. */
export function drawJunctionIntake(c: CanvasRenderingContext2D, x:number,y:number,time:number,reduced:boolean) {
    c.save();x=Math.round(x);y=Math.round(y);
    r(c,x-3,y+33,36,6,'#927c60');r(c,x-1,y+34,32,2,'#b69b74');
    r(c,x,y+3,30,32,P.edge);r(c,x+2,y+4,26,29,'#bda077');
    r(c,x+3,y+5,3,27,'#d0b58b');r(c,x+25,y+5,3,27,'#9c815f');
    oval(c,x,y,30,8,P.edge);oval(c,x+2,y+1,26,5,'#d6b98b');
    r(c,x+7,y+9,16,17,'#75664f');r(c,x+8,y+10,14,15,'#377783');
    r(c,x+9,y+11,12,12,P.water);r(c,x+10,y+11,2,12,'#8ac7c3');
    const drift=Math.floor((reduced||!Number.isFinite(time)?0:Math.max(0,time))/140)%11;
    c.save();c.beginPath();c.rect(x+9,y+11,12,12);c.clip();
    for(let step=-11;step<23;step+=11) r(c,x+14,y+11+step+drift,4,1,P.glint);
    c.restore();
    for(const yy of [8,27])for(const xx of [4,25]) {
        r(c,x+xx,y+yy,2,2,P.edge);r(c,x+xx,y+yy,1,1,P.light);
    }
    r(c,x+27,y+25,3,3,P.light);r(c,x+27,y+33,3,3,P.shade);
    c.restore();
}

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
