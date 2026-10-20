import {box,pixelLine,polygon} from '../WorldPainting';
import {chaseFragmentAt,CHASE_DECK_Y,CHASE_WATER_Y,chaseMaterialAt,type ChaseMaterial} from './HypotheticalChaseDetails';
import {CHASE_FIRST_SUPPORT,chaseStructureTiming,type ChaseStructureKind} from './HypotheticalChasePerformance';

/** A finite fall starts at the shaken upper joint before the main collision.
 * Its clock is recorded by the pursuit, independent of frame rate or camera. */
export function drawChaseApproachEffects(c:CanvasRenderingContext2D,x:number,base:number,age:number,kind:ChaseStructureKind,reduced:boolean){
    if(age<0||age>110)return;
    const height=kind==='crane'?78:kind==='sluice'?58:69,metal=kind==='sluice'||kind==='gantry';
    for(let j=0;j<(reduced?2:4);j++){
        const t=age-4-j*4;if(t<0)continue;
        const origin=base-height+7+j%2*3,g=.05,land=Math.sqrt((base-2-origin)/g),after=t-land;
        const xx=x+(j%2?32:CHASE_FIRST_SUPPORT+2)+(j%2?.22:-.25)*Math.min(t,land);
        if(after<0){
            box(c,xx,origin+g*t*t,1,j%2?1:2,metal?'#9ba99c':'#b4a387');
        }else if(after<13){
            c.save();c.globalAlpha*=1-after/13;
            pixelLine(c,xx-after*.15,base-2,xx+after*.2+1,base-2,metal?'#748c85':'#918e78');c.restore();
        }
    }
}

/** These effects occupy the struck structure's plane, behind the dinosaur.
 * Sparks are local to the joint; the escape corridor never gets a full flash. */
export function drawChaseStructureEffects(c:CanvasRenderingContext2D,x:number,base:number,age:number,kind:ChaseStructureKind,reduced:boolean){
    if(age<0)return;
    const metal=kind==='sluice'||kind==='gantry',ink=metal?'#4e6b70':'#6b6b58',light=metal?'#9faf9b':'#b5a17c';
    // The first spray belongs to the skull/upright contact, above the socket
    // fracture. It sheds a handful of chips forward, with a full path to rest.
    if(age<84)for(let j=0;j<(reduced?2:5);j++){
        const t=age-j,origin=base-47+j%2*3;if(t<0)continue;
        const vx=.8+j*.23,vy=-.7-j%3*.38,g=.075;
        const land=(-vy+Math.sqrt(vy*vy+4*g*(base-2-origin)))/(2*g),after=Math.max(0,t-land);
        const px=x+CHASE_FIRST_SUPPORT+vx*Math.min(t,land)+vx*3*(1-Math.exp(-after/7));
        const py=t<land?origin+vy*t+g*t*t:base-2-(after<9?Math.sin(after/9*Math.PI)*1.2:0);
        const spin=(j*.8+t*(j%2?.16:-.13))*Math.exp(-after/7),length=metal?1.5:3+j%2;
        c.save();c.globalAlpha*=Math.min(1,(84-age)/18);
        pixelLine(c,px,py,px+Math.cos(spin)*length,py+Math.sin(spin)*length,ink,2);
        pixelLine(c,px,py-1,px+Math.cos(spin)*length,py+Math.sin(spin)*length-1,light);
        c.restore();
    }
    if(!reduced&&age<15){
        const spread=2+age*.45,py=base-47-age*.14,px=x+CHASE_FIRST_SUPPORT;
        c.save();c.globalAlpha*=(1-age/15)*.45;
        polygon(c,[[px-2,py],[px+spread*.5,py-spread],[px+spread+2,py-2],[px+spread,py+spread*.5]],metal?'#b5c4ae':'#c6b695');
        c.restore();
    }
    for(let j=0;j<(reduced?4:10);j++){
        const p=chaseFragmentAt(kind,j,age);if(!p.visible)continue;
        const px=x+CHASE_FIRST_SUPPORT+p.x,py=base-33+p.y,length=metal?2+j%2:3+j%3;
        const dx=Math.cos(p.turn)*length,dy=Math.sin(p.turn)*length;
        pixelLine(c,px,py,px+dx,py+dy,ink,2);
        pixelLine(c,px,py-1,px+dx,py+dy-1,light);
    }
    if(!reduced&&age<27&&metal){
        const score=chaseStructureTiming(kind);
        for(let j=0;j<6;j++){
            const right=j%2,t=age-(right?score.right:score.left)-Math.floor(j/2);if(t<0||t>9)continue;
            const px=x+(right?35:CHASE_FIRST_SUPPORT)+t*(.6+j*.2),py=base-25-t*(.9+j%3*.4)+t*t*.045;
            pixelLine(c,px,py,px-2,py+1,t<4?'#e3c78e':'#b49e79');
        }
    }
    if(!reduced&&age>1&&age<33){
        const u=(age-1)/32,alpha=Math.sin(u*Math.PI)*.38;
        c.save();c.globalAlpha*=alpha;
        for(let j=0;j<4;j++){
            const px=x+CHASE_FIRST_SUPPORT+(j-1.5)*age*.35,py=base-24-age*.18-j%2*4,w=3+u*5;
            polygon(c,[[px-w,py],[px-w,py-3],[px-2,py-5],[px+w-1,py-4],[px+w,py],[px+1,py+2]],j%2?'#a7ae95':'#bdbaa0');
        }
        c.restore();
    }
    if(kind==='sluice'){
        const release=chaseStructureTiming(kind).release,water=base+CHASE_WATER_Y-CHASE_DECK_Y+3;
        // The broken outlet points back into the failed gate. Packets fall all
        // the way to the channel, then widen into rings on that exact surface.
        for(let j=0;j<(reduced?5:18);j++){
            const t=age-release-j*2;if(t<0)continue;
            const vy=-.6-j%3*.2,vx=-.85-j%4*.25,height=water-(base-28);
            const land=(-vy+Math.sqrt(vy*vy+4*.06*height))/.12;
            const px=x+39+vx*Math.min(t,land),py=base-28+vy*t+.06*t*t;
            if(t<land){
                const prior=Math.max(0,t-1.5);
                pixelLine(c,px,py,x+39+vx*prior,base-28+vy*prior+.06*prior*prior,j%3?'#a6c6b0':'#d0d9b8');
            }else if(t<land+19){
                const r=2+(t-land)*.45;
                pixelLine(c,px-r,water,px-1,water,'#81ada3');pixelLine(c,px+1,water+1,px+r,water+1,'#689b96');
            }
        }
    }
}

/** Landing particles follow the first touching corner, never the old support. */
export function drawChaseLandingDust(c:CanvasRenderingContext2D,x:number,base:number,age:number,material:ChaseMaterial,reduced:boolean){
    if(age<0||age>=27)return;
    const light=material==='timber'?'#b3a187':'#a4b2a1',grain=material==='timber'?'#6e7264':'#59767a';
    c.save();c.globalAlpha*=1-age/27;
    for(let j=0;j<(reduced?2:6);j++){
        const dir=j%2?1:-1,speed=.35+Math.floor(j/2)*.35,t=Math.min(age,16);
        const xx=x+dir*t*speed,dy=Math.max(0,(.85+j%3*.13)*t-.075*t*t);
        box(c,xx,base-2-dy,j%2?2:3,1,j%2?light:grain);
    }
    c.restore();
}

/** Weight is read at the same sole contact that emits the footstep sound. */
export function drawChaseFootfall(c:CanvasRenderingContext2D,worldX:number,y:number,age:number,cx:number,reduced:boolean){
    if(age<0||age>=30)return;
    const x=worldX-cx,material=chaseMaterialAt(worldX),light=material==='timber'?'#b5a07a':'#afbaa0';
    c.save();c.globalAlpha*=1-age/30;
    if(age<9)pixelLine(c,x-10-age*.2,y-1,x+7+age*.3,y-1,'#718574');
    for(let j=0;j<(reduced?2:5);j++){
        const t=Math.min(age,18),dx=(j-2)*t*.31,up=Math.max(0,(.65+j%2*.2)*t-.045*t*t);
        polygon(c,[[x+dx-2,y-1-up],[x+dx-1,y-3-up],[x+dx+2,y-2-up],[x+dx+3,y-up]],j%2?light:'#84967e');
    }
    c.restore();
}
