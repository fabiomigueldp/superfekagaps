import { box, oval, pixelLine, polygon } from '../WorldPainting';
import { smoothMotion } from './HypotheticalMotion';
import { drawBystanders } from './HypotheticalBystanders';
import type { Bystander } from './HypotheticalBackdrop';
import type { HypotheticalModel } from './HypotheticalModel';

/** The arrival crowd occupies Feka's street, in front of the retaining wall.
 * Refuge doors are on this street as well; nobody walks through a closed gate. */
export function forecourtPeople(tick:number):Bystander[]{
    return [140,158,180,203,232,254,278,303].map((originX,i)=>{
        const shelter=i<4?118:332,alertAt=(i>=6?130:34)+i*9,runTicks=58+Math.abs(shelter-originX)*.55;
        const u=Math.max(0,Math.min(1,(tick-alertAt-18)/runTicks));
        const x=originX+(shelter-originX)*smoothMotion(u);
        return {x,originX,shelter,alertAt,runTicks,escaped:u===1,fleeing:tick>=alertAt,
            hitAt:null,color:i%4,clothes:i===2?'scarf':i===6?'satchel':'star-shirt',
            distance:Math.abs(x-originX),velocity:(shelter-originX)*6*u*(1-u)/runTicks,
            speed:1,district:0,stoppedAt:null,threatenedAt:alertAt,startledAt:alertAt,
            reactionTimes:i>=6?[40,alertAt]:[alertAt],appearance:3+i,depth:i%2?-2:0,exitAtShelter:true,
            belonging:i===2?'papers':undefined};
    });
}

export function drawForecourt(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number,reduced=false){
    if(cx>360)return;
    const y=224-cy,t=b.arrivalSkipped?800:b.backdrop.tick;
    // Stone portals are embedded in the wall, with a threshold exactly at the player floor.
    for(const door of [118,332]){
        const x=door-cx;
        polygon(c,[[x-12,y],[x-12,y-29],[x-8,y-35],[x+8,y-35],[x+12,y-29],[x+12,y]],'#78938c');
        polygon(c,[[x-8,y],[x-8,y-27],[x-5,y-31],[x+5,y-31],[x+8,y-27],[x+8,y]],'#2f505c');
        box(c,x-11,y-28,2,27,'#a7b19a');box(c,x+9,y-28,2,27,'#526f73');
        box(c,x-13,y-1,26,1,'#b3baa1');box(c,x-4,y-36,8,2,'#c6ba8c');
    }
    // A banner, fold-out table and portable speaker explain the gathering.
    for(const post of [190,274]){box(c,post-cx,y-39,2,37,'#4e6668');box(c,post-cx-2,y-3,6,3,'#70847d');}
    const sway=reduced?0:Math.sin(b.tick/45)*1.2,fall=t<80?0:smoothMotion((t-80)/50);
    polygon(c,[[192-cx,y-36],[274-cx,y-36+fall*18],[272-cx,y-23+fall*21],[194-cx,y-23+sway]],'#9c5152');
    pixelLine(c,194-cx,y-35,272-cx,y-35+fall*18,'#d28e75');
    const starX=228-cx,starY=y-31+fall*9;
    polygon(c,[[starX,starY-4],[starX+2,starY],[starX+6,starY],[starX+3,starY+3],
        [starX+4,starY+6],[starX,starY+4],[starX-4,starY+6],[starX-3,starY+2],[starX-6,starY],[starX-2,starY]],'#e4d5bc');
    box(c,210-cx,y-8,26,3,'#b08e71');pixelLine(c,214-cx,y-5,232-cx,y-1,'#586e6c',2);
    pixelLine(c,232-cx,y-5,214-cx,y-1,'#586e6c',2);box(c,212-cx,y-10,11,2,'#dad0af');
    box(c,282-cx,y-16,12,16,'#294653');box(c,283-cx,y-15,10,14,'#45616a');
    oval(c,285-cx,y-10,6,6,'#213b48');box(c,285-cx,y-13,6,1,'#b3a486');
    if(t<350){
        c.save();c.translate(-Math.round(cx),0);
        drawBystanders(c,b.backdrop,y,reduced,false,forecourtPeople(t));c.restore();
    }
}
