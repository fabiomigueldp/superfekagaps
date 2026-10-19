import {box} from '../WorldPainting';
import type {BloodContact,HypotheticalBackdrop} from './HypotheticalBackdrop';

/** Stylized droplets inherit the actual contact and settle on the same rear street. */
export function bloodDrop(hit:BloodContact,index:number,tick:number){
    const age=Math.max(0,tick-hit.born),gravity=.13,vy=-.65-index%3*.42;
    const floor=hit.floor,landing=(-vy+Math.sqrt(vy*vy+2*gravity*Math.max(0,floor-hit.y)))/gravity;
    const t=Math.min(age,landing),vx=hit.direction*(.3+index*.14),grounded=age>=landing;
    return {x:hit.x+vx*t,y:grounded?floor:Math.min(floor,hit.y+vy*t+.5*gravity*t*t),grounded,
        width:grounded?2+index%2:1,age};
}

/** Ground marks remain; only the airborne spray disappears. Neither drawing pass advances time. */
export function drawBlood(c:CanvasRenderingContext2D,b:HypotheticalBackdrop,street:number,reduced:boolean,airborne:boolean){
    if(airborne&&reduced)return;
    for(const hit of b.blood)for(let i=0;i<6;i++){
        const drop=bloodDrop(hit,i,b.tick);if(drop.grounded===airborne)continue;
        box(c,drop.x,street+drop.y,drop.width,1,drop.grounded?(i%2?'#75454a':'#8e4e4e'):'#b96358');
        if(drop.grounded&&i%2===0)box(c,drop.x+1,street+drop.y-1,1,1,'#a35d54');
    }
}
