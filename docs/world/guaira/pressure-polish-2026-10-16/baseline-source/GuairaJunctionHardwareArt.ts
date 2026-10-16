import { box as r } from '../../../WorldPainting';
import type { MovingBody } from '../../../WorldPhysics';

const P = {
    edge: '#735b4b', brass: '#b99465', light: '#d4b680', shade: '#997650',
    water: '#68b6bf', glint: '#b7dfd3', dry: '#bd9165', iron: '#65796f',
} as const;

/** A bronze inspection pipe with a continuous, recessed 3px sight channel.
 * Every coordinate is local to the pipe; camera movement cannot reseed its flow. */
export function drawJunctionPipe(c: CanvasRenderingContext2D, x: number, y: number, length: number,
    wet: boolean, time: number, reduced: boolean, vertical = false, direction: -1 | 1 = 1) {
    if (![x,y,length].every(Number.isFinite)) return;
    x = Math.round(x); y = Math.round(y); length = Math.round(length);
    if (length < 7) return;
    const at = (along: number, across: number, width: number, height: number, color: string) =>
        r(c, x + (vertical ? across : along), y + (vertical ? along : across),
            vertical ? height : width, vertical ? width : height, color);
    c.save();
    at(0,0,length,9,P.edge); at(0,1,length,7,P.brass);
    at(1,1,length-2,1,P.light); at(1,7,length-2,1,P.shade);
    // Small gasketed collars grip the casing, leaving its inspection glass visible.
    for (let offset=22;offset<length-6;offset+=40) {
        at(offset,-1,5,11,P.edge); at(offset+1,0,3,9,P.brass);
        at(offset+1,0,2,1,P.light); at(offset+3,1,1,7,P.shade);
        at(offset+1,1,1,1,'#e0c391'); at(offset+1,7,1,1,P.edge);
    }
    at(0,3,length,3,wet?P.water:P.dry);
    if (wet) {
        const t=reduced||!Number.isFinite(time)?0:Math.max(0,time);
        const drift=Math.floor(t/140)%20;
        // Matching spacing and period, including the piece entering at either end.
        for(let offset=-20;offset<length+20;offset+=20) {
            const head=offset+direction*drift, start=Math.max(0,head), end=Math.min(length,head+3);
            if(end>start)at(start,4,end-start,1,P.glint);
        }
    }
    c.restore();
}

/** Quarter-turn fittings occupy the old 9px footprint. Their two open throats
 * align exactly with the horizontal/vertical sight channels. */
export function drawJunctionElbow(c: CanvasRenderingContext2D,x:number,y:number,wet:boolean,left=false) {
    const rows=['___kkkkkk','_kkHHHHHH','_kHbbbbbb','kkbwwwwww','kHbwwwwww',
        'kHbwwwwww','kHbwwwbbk','kHbwwwbk_','kHbwwwk__'];
    const colors:Record<string,string>={k:P.edge,H:P.light,b:P.brass,w:wet?P.water:P.dry};
    c.save(); x=Math.round(x);y=Math.round(y);
    rows.forEach((row,yy)=>[...row].forEach((key,xx)=>{
        if(colors[key])r(c,x+(left?8-xx:xx),y+yy,1,1,colors[key]);
    }));
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
