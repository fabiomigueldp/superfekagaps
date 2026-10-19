import {box,oval,pixelLine} from '../WorldPainting';
import {ARRIVAL,arrivalDeployment} from './HypotheticalArrival';
import type {HypotheticalModel} from './HypotheticalModel';
import {smoothMotion} from './HypotheticalMotion';

/** Real exit recesses, ground contact and small reactions frame the crowd's two escape routes. */
export function drawArrivalCourtyard(c:CanvasRenderingContext2D,x:number,base:number,tick:number,damageAge:number){
    // Left refuge: an open arch, side jambs and a worn threshold, with no post through the doorway.
    box(c,x+112,base-32,20,28,'#4c6d6b');box(c,x+113,base-31,3,27,'#3e5d60');
    box(c,x+128,base-32,4,28,'#9ca991');box(c,x+110,base-5,24,2,'#b5b69b');
    pixelLine(c,x+115,base-3,x+129,base-3,'#6c877b');
    // The service alley on the right has enough depth for bodies to disappear behind its jamb.
    box(c,x+299,base-46,36,42,'#89998a');box(c,x+296,base-49,42,4,'#b5b59a');
    box(c,x+305,base-38,22,34,'#42666a');box(c,x+308,base-36,17,29,'#58786f');
    box(c,x+314,base-36,12,32,'#3e6065');box(c,x+326,base-40,5,36,'#b0b29a');
    for(let y=base-36;y<base-6;y+=9)box(c,x+327,y,4,1,'#758e7f');
    box(c,x+302,base-5,30,3,'#b4b299');box(c,x+300,base-3,34,1,'#647f75');
    box(c,x+307,base-46,17,5,'#6d8f80');pixelLine(c,x+313,base-45,x+318,base-43,'#d0c5a1');
    pixelLine(c,x+318,base-43,x+313,base-41,'#d0c5a1');
    // Drain grates and curb stones connect the facades to one continuous rear street.
    for(const xx of [145,277]){
        box(c,x+xx,base-1,13,2,'#526f6e');for(let j=0;j<4;j++)box(c,x+xx+j*3,base-1,1,2,'#91a28d');
    }
    for(const xx of [84,166,268]){box(c,x+xx,base-4,12,1,'#b6b698');box(c,x+xx+1,base-3,10,1,'#657f73');}
    // A suspended lamp reacts to the ram; the shock decays instead of looping forever.
    const shock=damageAge<0?0:Math.sin(damageAge*.25)*3*Math.exp(-damageAge/28);
    pixelLine(c,x+143,base-59,x+157,base-59,'#5e7d75',2);
    pixelLine(c,x+156,base-59,x+156+shock,base-50,'#627d74');
    box(c,x+153+shock,base-50,6,7,'#657d70');box(c,x+154+shock,base-49,4,4,damageAge<0?'#c8ba91':'#a99e7f');
    box(c,x+152+shock,base-51,8,2,'#a4aa8e');
    // A small shutter is pulled shut after the last runner has crossed the right threshold.
    const close=smoothMotion((tick-206)/28);
    if(close>0){
        const h=Math.round(close*29);box(c,x+306,base-37,20,h,'#6e8a7b');
        for(let y=base-35;y<base-37+h;y+=4)box(c,x+307,y,18,1,'#a1ac91');
    }
}

export function drawArrivalFittings(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number){
    const x=ARRIVAL.gateX-cx,top=ARRIVAL.gateY-cy,floor=224-cy,{height,travel}=b.arrival;
    // The visible lower edge is exactly the native collision rectangle's lower edge.
    for(const px of [x-5,x+14]){
        box(c,px,top-5,4,floor-top+5,'#334c59');box(c,px+1,top-4,1,floor-top+2,'#9ba99a');
        box(c,px-2,floor-4,8,4,'#526974');
        for(let y=top+9;y<floor-7;y+=18){box(c,px-1,y,6,3,'#617f82');box(c,px,y,1,1,'#c1b58e');}
    }
    box(c,x-8,top-8,30,7,'#3d5964');box(c,x-7,top-8,28,2,'#bbaf8d');
    if(height>0){
        for(let xx=0;xx<12;xx+=4){box(c,x+xx,top,2,height,'#365560');box(c,x+xx,top,1,height,'#8da59a');}
        for(let y=top+height-5;y>top;y-=12){box(c,x,y,12,2,'#526e75');box(c,x,y,12,1,'#b1ad8e');}
        box(c,x,top+height-3,12,3,'#c1ae83');box(c,x,top+height-1,12,1,'#3b555f');
    }
    const counter=top+12+travel*64;
    pixelLine(c,x-10,top-3,x-10,counter,'#7e9690');box(c,x-13,counter,6,13,'#496774');
    box(c,x-12,counter+1,1,11,'#a5af9b');oval(c,x-13,top-6,7,7,'#7c9189');box(c,x-10,top-4,1,2,'#d4c49b');
    const ready=b.arrival.ready;
    box(c,x-22,floor-40,11,15,'#3c5964');box(c,x-21,floor-39,9,2,'#a6a88b');
    box(c,x-18,floor-35,4,4,ready?'#9dd6b8':'#ddb974');
    if(ready){pixelLine(c,x-20,floor-28,x-15,floor-28,'#b9d2ae');pixelLine(c,x-17,floor-30,x-14,floor-28,'#b9d2ae');}
    const deployment=arrivalDeployment(b.tick,b.arrivalSkipped);
    for(const gx of [180,276]){
        const dx=gx-cx-6,dy=floor-32;
        // Recessed garrison doors, distinct from the solid gates and climbable scaffold lips.
        box(c,dx-2,dy-3,32,35,'#526c70');box(c,dx,dy,28,32,'#2c4a58');
        box(c,dx+2,dy+2,24,29,'#3c5c63');box(c,dx-2,dy-3,32,2,'#8d9c8e');
        const shutter=Math.round(30*(1-deployment));
        if(shutter>0){
            box(c,dx+2,dy+1,24,shutter,'#59766f');
            for(let y=dy+3;y<dy+shutter;y+=5)box(c,dx+3,y,22,1,'#8c9e88');
            box(c,dx+2,dy+shutter,24,2,'#abb08e');
        }
        box(c,dx,floor-1,28,1,'#7d9182');
    }
}
