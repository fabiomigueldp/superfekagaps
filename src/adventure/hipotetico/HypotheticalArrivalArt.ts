import {box,oval,pixelLine,polygon} from '../WorldPainting';
import {SIEGE_SECTORS} from './HypotheticalSiege';
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

/** The added plaza is built on the same street, with two doors and an attached textile awning. */
export function drawArrivalPlaza(c:CanvasRenderingContext2D,x:number,base:number,tick:number,age:number,reduced:boolean){
    for(const [left,width] of [[360,38],[530,34]]){
        box(c,x+left,base-42,width,38,'#879c8c');box(c,x+left-3,base-45,width+6,4,'#b7b397');
        box(c,x+left+8,base-33,22,29,'#42666a');box(c,x+left+11,base-30,15,27,'#345960');
        box(c,x+left+width-4,base-42,4,38,'#b5b69b');
        for(let y=base-37;y<base-5;y+=8)box(c,x+left+width-4,y,4,1,'#789284');
        box(c,x+left+4,base-4,width-8,2,'#bfb99b');
        const shut=smoothMotion((tick-585)/30);
        if(shut){const h=shut*28;box(c,x+left+8,base-33,22,h,'#688578');for(let y=0;y<h;y+=4)box(c,x+left+9,base-33+y,20,1,'#a2ac93');}
    }
    // A low bench and recessed planting bed keep the walking strip continuous.
    box(c,x+408,base-7,20,3,'#7e8a75');box(c,x+410,base-4,2,4,'#55716e');box(c,x+424,base-4,2,4,'#55716e');
    box(c,x+579,base-8,27,7,'#7e9687');box(c,x+578,base-9,29,2,'#b1b499');
    for(let j=0;j<7;j++){const sway=reduced?0:Math.sin(tick/48+j)*.7;pixelLine(c,x+581+j*3,base-9,x+582+j*3+sway,base-13-j%3,'#60877a');}
    // The bite tears the mounted canopy out in panels; its fragments land and remain.
    const top=base-26,fall=Math.max(0,age-4),land=Math.min(30,fall),sag=age<0?(reduced?0:Math.sin(tick/50)*.6):Math.min(3,fall*.3);
    if(age<0){pixelLine(c,x+441,top-2,x+524,top-2,'#617a70',2);pixelLine(c,x+446,top,x+440,base-4,'#70816e',2);}
    for(let j=0;j<6;j++){
        const s=age<0?sag:(j%2?2:-1),xx=x+440+j*14+(age<0?0:(j-2)*land*.2);
        const drop=age<0?0:Math.min(19-s,land*land*.035+j*.4),yy=top+drop,color=j%2?'#aa8e70':'#6e9184';
        polygon(c,[[xx,yy],[xx+13,yy],[xx+14,yy+5+s],[xx+2,yy+6+s]],color);
        pixelLine(c,xx+2,yy+1,xx+11,yy+1,j%2?'#c7b190':'#9fb19a');
        if(age<0)box(c,xx+2,yy+6+s,11,2,j%2?'#8f7b65':'#5b7c74');
    }
    // The torn sign keeps one hinge. Its recoil decays while the sign remains attached.
    const swing=age<0?0:Math.sin(age*.2)*Math.exp(-age/30)*5;
    pixelLine(c,x+516,base-48,x+523,base-48,'#698076',2);
    pixelLine(c,x+523,base-48,x+523+swing,base-41,'#718477');
    box(c,x+517+swing,base-41,13,7,'#819b88');box(c,x+519+swing,base-39,9,1,'#c4bb9b');
    for(const xx of [348,570,622]){box(c,x+xx,base-1,12,2,'#4d706c');for(let j=0;j<4;j++)box(c,x+xx+j*3,base-1,1,2,'#98a891');}
}

export function drawArrivalFittings(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number){
    const top=ARRIVAL.gateY-cy,floor=224-cy;
    for(const [gx,pose] of [[ARRIVAL.firstGateX,b.forecourt],[ARRIVAL.gateX,b.arrival]] as const){
    const x=gx-cx,{height,travel}=pose;
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
    const ready=pose.ready;
    box(c,x-22,floor-40,11,15,'#3c5964');box(c,x-21,floor-39,9,2,'#a6a88b');
    box(c,x-18,floor-35,4,4,ready?'#9dd6b8':'#ddb974');
    if(ready){pixelLine(c,x-20,floor-28,x-15,floor-28,'#b9d2ae');pixelLine(c,x-17,floor-30,x-14,floor-28,'#b9d2ae');}
    }
    // Low inset lamps mark the traversable approach without covering the rear action.
    for(const gx of [164,244]){
        box(c,gx-cx,floor-3,17,3,'#4e6c71');box(c,gx+3-cx,floor-3,10,1,b.forecourt.ready?'#a9ceb4':'#8d9d87');
    }
    const deployment=arrivalDeployment(b.arrivalTime,b.arrivalSkipped);
    for(const {x:gx} of SIEGE_SECTORS[0].guards){
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
