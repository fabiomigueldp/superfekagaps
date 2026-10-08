import { ART, hashAt } from '../../graphics/palette';
import { pixelText } from '../../graphics/BitmapFont';
import type { Box, StageMachine } from './DeliciaContent';
import { steamPhase, type DeliciaSimulation } from './DeliciaSimulation';
import { DELICIA_UNIT as U } from './DeliciaNative';
import { line, oval, polygon, px, type PixelContext as C } from './DeliciaSceneryPrimitives';

function bolt(c:C,x:number,y:number):void {
    px(c,x,y,3,3,ART.ink);px(c,x,y,2,2,ART.rockTop);px(c,x+1,y+1,1,1,ART.rockDark);
}

function check(c:C,x:number,y:number):void {
    px(c,x-4,y,9,8,ART.ink);
    for(const offset of [0,1]){
        line(c,x-3,y+3+offset,x-1,y+5+offset,ART.tealLight);
        line(c,x-1,y+5+offset,x+3,y+1+offset,ART.tealLight);
    }
}

/** Closed/open are different wheel and needle positions as well as different colors. */
export function drawDeliciaValve(c:C,x:number,y:number,open:boolean):void {
    px(c,x-8,y-4,18,4,ART.ink);px(c,x-7,y-3,16,2,ART.rock);
    px(c,x-6,y-4,13,1,ART.rockTop);px(c,x-3,y-13,7,10,ART.ink);
    px(c,x-2,y-13,5,10,ART.rock);px(c,x-2,y-12,2,8,ART.rockLight);
    px(c,x+3,y-12,10,5,ART.ink);px(c,x+4,y-11,8,3,ART.goldDark);px(c,x+4,y-11,7,1,ART.gold);
    px(c,x+10,y-24,4,15,ART.ink);px(c,x+11,y-24,2,14,ART.goldDark);px(c,x+11,y-23,1,13,ART.gold);
    px(c,x+8,y-13,7,2,ART.rockDark);px(c,x+8,y-13,6,1,ART.rockLight);
    oval(c,x+7,y-31,11,10,ART.ink);oval(c,x+8,y-30,9,8,ART.rockLight);oval(c,x+9,y-29,7,6,ART.paper);
    px(c,x+10,y-28,1,1,ART.goldDark);px(c,x+14,y-28,1,1,ART.redDark);
    line(c,x+12,y-25,x+(open?14:10),y-28,ART.ink);px(c,x+12,y-25,1,1,ART.red);
    const wheel=y-16,base=open?ART.teal:ART.gold,light=open?ART.tealLight:ART.goldLight,dark=open?ART.tealDark:ART.goldDark;
    oval(c,x-10,wheel-10,21,21,ART.ink);oval(c,x-9,wheel-9,19,19,dark);oval(c,x-9,wheel-9,17,17,base);
    oval(c,x-6,wheel-6,13,13,ART.ink);oval(c,x-5,wheel-5,11,11,ART.rockDark);
    line(c,x-6,wheel-7,x-2,wheel-9,light);px(c,x-9,wheel-3,1,5,light);px(c,x+6,wheel+5,1,2,dark);
    for(const [dx,dy] of open?[[6,6],[-6,-6],[6,-6],[-6,6]]:[[0,8],[0,-8],[8,0],[-8,0]]){
        line(c,x,wheel,x+dx,wheel+dy,dark);line(c,x-1,wheel,x+dx-1,wheel+dy,base);px(c,x+dx-1,wheel+dy-1,2,2,light);
    }
    oval(c,x-3,wheel-3,7,7,ART.ink);oval(c,x-2,wheel-2,5,5,dark);px(c,x-2,wheel-2,4,1,light);px(c,x,wheel-1,1,3,ART.ink);
    px(c,x-6,y-2,2,1,ART.ink);px(c,x+5,y-2,2,1,ART.ink);
    if(open)check(c,x,y-37);
}

function nozzle(c:C,x:number,y:number,w:number,kind:'wind'|'jet'|'steam'):void {
    const trim=kind==='wind'?ART.teal:ART.goldDark;
    px(c,x-2,y-7,w+4,8,ART.ink);px(c,x-1,y-6,w+2,6,ART.rockDark);
    px(c,x,y-6,w,4,ART.rock);px(c,x,y-6,w,1,ART.rockTop);
    px(c,x-3,y-3,w+6,3,ART.ink);px(c,x-2,y-3,w+4,1,trim);px(c,x-1,y-2,w+2,1,ART.rockLight);
    for(let xx=3;xx<w-2;xx+=4){px(c,x+xx,y-5,2,3,ART.ink);px(c,x+xx,y-5,1,1,ART.rockLight);}
    bolt(c,x-1,y-2);bolt(c,x+w-2,y-2);
}

export function drawDeliciaMachine(c:C,m:StageMachine,sim:DeliciaSimulation,time:number):void {
    const x=Math.round((m.x-sim.cameraX)/U),y=Math.round((m.y-sim.cameraY)/U),w=Math.round(m.w/U),h=Math.round(m.h/U);
    const disabled=!!m.disabledBy&&sim.valves.has(m.disabledBy),phase=disabled?'safe':steamPhase(sim.time,m.period,m.phase);
    if(m.kind==='press'){
        for(const xx of [x+1,x+w-6]){
            px(c,xx,y,5,h,ART.ink);px(c,xx+1,y,3,h,ART.rockDark);px(c,xx+1,y,1,h,ART.rockLight);
            for(let yy=5;yy<h-4;yy+=8){px(c,xx+1,y+yy,3,2,ART.rock);px(c,xx+1,y+yy,1,1,ART.rockTop);}
        }
        // Fixed crown, piston seal and attached side housing give the press a readable mechanism.
        px(c,x-4,y-10,w+8,13,ART.ink);px(c,x-3,y-9,w+6,11,ART.rockDark);
        px(c,x-2,y-9,w+4,7,ART.rock);px(c,x-2,y-9,w+4,1,ART.rockTop);px(c,x-3,y-1,w+6,2,ART.goldDark);
        bolt(c,x-2,y-7);bolt(c,x+w-1,y-7);
        px(c,x+w/2-4,y-7,8,5,ART.ink);px(c,x+w/2-3,y-6,6,3,disabled?ART.tealDark:phase==='tell'?ART.gold:phase==='active'?ART.red:ART.rockDark);
        if(disabled)check(c,Math.round(x+w/2),y-8);
        else if(phase==='tell')px(c,x+w/2,y-6,1,2,ART.goldLight);
        const head=phase==='active'?y+h-10:y+7;
        px(c,x+w/2-4,y+1,8,head-y,ART.ink);px(c,x+w/2-3,y+1,6,head-y,ART.rock);
        px(c,x+w/2-2,y+2,2,head-y-1,ART.rockTop);px(c,x+w/2+2,y+2,1,head-y-1,ART.rockDark);
        px(c,x+w/2-5,y+2,10,3,ART.rockDark);px(c,x+w/2-4,y+2,8,1,ART.gold);
        px(c,x,head,w,10,ART.ink);px(c,x+1,head+1,w-2,7,ART.rock);px(c,x+1,head+1,w-2,2,ART.rockTop);
        px(c,x+1,head+5,w-2,3,ART.goldDark);px(c,x+1,head+8,w-2,1,ART.rockDark);
        for(let xx=1;xx<w-4;xx+=6){line(c,x+xx,head+5,x+xx+2,head+7,ART.ink);line(c,x+xx+1,head+5,x+xx+3,head+7,ART.ink);}
        bolt(c,x+2,head+1);bolt(c,x+w-5,head+1);
        if(phase==='tell'){
            for(let yy=19;yy<h-3;yy+=7){px(c,x,y+yy,1,3,ART.gold);px(c,x+w-1,y+yy,1,3,ART.gold);}
            pixelText(c,'!',x+w/2,y+h-14,ART.goldLight,1,'center');
            px(c,x+2,y+h-2,w-4,1,ART.goldLight);
        }
        if(phase==='active'){
            for(let yy=20;yy<h-11;yy+=9){
                line(c,x,y+yy,x+2,y+yy+2,ART.redLight);line(c,x+w-1,y+yy,x+w-3,y+yy+2,ART.redLight);
            }
            px(c,x,y+h-1,w,1,ART.orangeLight);
        }
        return;
    }
    const live=!disabled&&(phase==='active'||m.kind==='wind'),center=Math.round(x+w/2);
    if(m.kind==='wind'){
        const support=sim.stage.floors.find(f=>f.h>50&&f.x<=m.x+m.w/2&&f.x+f.w>=m.x+m.w/2&&f.y>=m.y+m.h);
        if(support){
            const ground=Math.round((support.y-sim.cameraY)/U),height=ground-y-h;
            px(c,center-4,y+h,9,height,ART.ink);px(c,center-3,y+h,7,height-2,ART.tealDark);px(c,center-3,y+h,2,height-2,ART.rockLight);
            for(let yy=7;yy<height-2;yy+=10){px(c,center-5,y+h+yy,11,3,ART.rockDark);px(c,center-4,y+h+yy,9,1,ART.rockLight);}
            px(c,center-8,ground-3,17,3,ART.ink);px(c,center-7,ground-3,15,1,ART.rockTop);
        }
        oval(c,center-9,y+h-18,19,18,ART.ink);oval(c,center-8,y+h-17,17,16,ART.rock);oval(c,center-6,y+h-15,13,12,ART.tealDark);
        for(let i=0;i<3;i++){
            const angle=i*Math.PI*2/3+(live?Math.floor(time*7)%4:0)*Math.PI/6;
            const dx=Math.round(Math.cos(angle)*5),dy=Math.round(Math.sin(angle)*5);
            line(c,center,y+h-9,center+dx,y+h-9+dy,ART.tealLight);px(c,center+dx,y+h-9+dy,2,2,ART.teal);
        }
        px(c,center-1,y+h-10,3,3,ART.gold);px(c,center-1,y+h-10,1,1,ART.goldLight);
        nozzle(c,center-10,y+h,20,'wind');
    }else nozzle(c,x,y+h,w,m.kind);
    if(live){
        const color=m.kind==='wind'?ART.tealLight:ART.goldLight;
        for(let i=0;i<6;i++){
            const yy=y+((i*13-Math.floor(time*29))%Math.max(1,h-10)+(h-10))%Math.max(1,h-10);
            const xx=x+2+(i*7)%Math.max(1,w-6);
            px(c,xx,yy,1,4,color);px(c,xx-1,yy+1,3,1,color);
            if(m.kind==='jet')px(c,xx,yy+4,1,3,ART.orange);
        }
        for(let side=-1;side<=1;side+=2){
            const xx=center+side*Math.max(3,Math.floor(w*.3));
            line(c,xx,y+h-9,xx+side*2,y+h-14,m.kind==='wind'?ART.teal:ART.orange);
            px(c,xx+side*2,y+h-19,1,5,color);
        }
        // Open vent and directional symbol distinguish helpful lift from harmful steam.
        pixelText(c,'↑',center,y+h-(m.kind==='wind'?27:20),color,1,'center');
    }else if(!disabled){
        pixelText(c,'↑',center,y+h-19,phase==='tell'?ART.goldLight:ART.rockLight,1,'center');
        if(phase==='tell'){px(c,x+1,y+h-8,w-2,1,ART.goldLight);px(c,center-5,y+h-22,1,2,ART.gold);px(c,center+5,y+h-22,1,2,ART.gold);}
    }
    if(disabled)check(c,center,y+h-18);
}

export function drawDeliciaSteam(c:C,b:Box,phase:string,time:number,cx=0,cy=0):void {
    const x=Math.round(b.x/U)-cx,y=Math.round(b.y/U)-cy,w=Math.round(b.w/U),h=Math.round(b.h/U),center=Math.round(x+w/2);
    if(phase==='active'){
        c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
        px(c,x+1,y,w-2,h-5,ART.orangeDark);
        for(let i=-1;i<Math.ceil(h/10)+1;i++){
            const yy=y+i*10-Math.floor(time*26)%10,inset=[1,2,0][((i%3)+3)%3];
            oval(c,x+inset,yy,w-inset*2,13,ART.orangeLight);
            oval(c,x+inset+2,yy+1,Math.max(2,w-inset*2-4),9,ART.goldLight);
            px(c,center-1,yy+2,2,5,ART.paper);
        }
        c.restore();
    }
    nozzle(c,x,y+h,w,'steam');
    // A hot vent has a serrated warning badge; helpful lift has an arrow instead.
    polygon(c,center,y+h-14,[[-5,5],[-2,-2],[2,-2],[5,5]],ART.ink);
    polygon(c,center,y+h-14,[[-4,4],[-1,-1],[1,-1],[4,4]],phase==='safe'?ART.goldDark:ART.gold);
    px(c,center,y+h-14,1,2,ART.ink);px(c,center,y+h-11,1,1,ART.ink);
    if(phase==='tell'){pixelText(c,'!',center,y+h-27,ART.goldLight,1,'center');px(c,x,y+h-8,w,1,ART.orangeLight);}
}

export function drawDeliciaThorns(c:C,b:Box,cx:number,cy:number):void {
    const x=Math.round(b.x/U)-cx,y=Math.round(b.y/U)-cy,w=Math.round(b.w/U),h=Math.max(6,Math.round(b.h/U));
    px(c,x,y+h-3,w,3,ART.ink);px(c,x,y+h-3,w,1,ART.rockDark);
    for(let xx=0;xx<w-4;xx+=6){
        polygon(c,x+xx,y,[[0,h-2],[2,0],[4,0],[6,h-2]],ART.ink);
        polygon(c,x+xx,y,[[1,h-3],[3,2],[5,h-3]],ART.rock);
        line(c,x+xx+3,y+2,x+xx+2,y+h-4,ART.rockTop);
    }
}

export function drawDeliciaLiquid(c:C,b:Box,sim:DeliciaSimulation,time:number):void {
    const x=Math.round((b.x-sim.cameraX)/U),y=Math.round((b.y-sim.cameraY)/U),w=Math.round(b.w/U),h=Math.round(b.h/U);
    px(c,x,y,w,h,ART.orangeDark);px(c,x,y,w,Math.min(h,9),ART.orange);px(c,x,y,w,1,ART.goldLight);
    c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
    for(let xx=2;xx<w;xx+=15){
        const n=hashAt(Math.round(b.x/U)+xx,Math.round(b.y/U),8),bob=[0,1,1,0][(Math.floor(time*5)+n)%4];
        px(c,x+xx,y+1+bob,5+n%4,1,ART.orangeLight);px(c,x+xx+2,y+2+bob,4,1,ART.goldLight);
        px(c,x+xx+7,y+7+bob,5,1,ART.goldDark);
        if(n%3===0){oval(c,x+xx,y+11+bob,4,5,ART.goldDark);px(c,x+xx+1,y+11+bob,2,1,ART.orangeLight);}
    }
    for(let yy=18;yy<Math.min(h,185-y);yy+=15)for(let xx=3;xx<w-3;xx+=25){
        const offset=hashAt(xx,yy,4)%12;px(c,x+xx+offset,y+yy,8,1,ART.goldDark);px(c,x+xx+offset+5,y+yy+1,5,1,ART.goldDark);
    }
    c.restore();
}
