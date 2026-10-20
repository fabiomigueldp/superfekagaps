import {box,oval,pixelLine,polygon,type Point} from '../WorldPainting';
import {pixelText} from '../../graphics/BitmapFont';
import type {WorldObjects} from '../WorldPhysics';
import type {HypotheticalModel} from './HypotheticalModel';
import {CHASE_COUNTERS} from './HypotheticalLayout';
import {drawChaseLandingDust} from './HypotheticalChaseImpactArt';

const P={ink:'#203b46',shade:'#405e63',steel:'#6f8a88',edge:'#a3b5a0',gold:'#dfb477',light:'#f4deb0',mint:'#9ed3b6',wood:'#9b805f',grain:'#6e6256'};

/** Slats, bands and fasteners share the rigid load's transform. */
function load(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,angle:number,wood:boolean){
    const co=Math.cos(angle),si=Math.sin(angle),p=(u:number,v:number):Point=>[x+w/2+(u-w/2)*co-(v-h/2)*si,y+h/2+(u-w/2)*si+(v-h/2)*co];
    const rect=(u:number,v:number,ww:number,hh:number,color:string)=>polygon(c,[p(u,v),p(u+ww,v),p(u+ww,v+hh),p(u,v+hh)],color);
    const line=(u:number,v:number,uu:number,vv:number,color:string,n=1)=>pixelLine(c,...p(u,v),...p(uu,vv),color,n);
    rect(0,0,w,h,P.ink);rect(2,2,w-4,h-4,wood?P.wood:P.steel);
    rect(2,h-6,w-4,4,wood?P.grain:P.shade);line(2,1,w-3,1,P.edge);
    for(let v=6;v<h-4;v+=6){line(3,v,w-4,v,wood?P.grain:P.shade);line(4,v+1,w-5,v+1,wood?'#b99b72':'#839c94');}
    for(const u of [4,w-8]){rect(u,1,4,h-2,P.shade);line(u,2,u,h-3,P.edge);rect(u+1,3,2,1,P.light);rect(u+1,h-5,2,1,P.edge);}
    if(wood){line(9,4,w-10,h-6,P.grain,2);line(10,4,w-9,h-6,'#c3a67b');}
    else{rect(10,7,w-20,8,P.shade);rect(12,9,w-24,4,P.edge);}
    line(w/2-3,3,w/2+3,3,P.gold);line(w/2,3,w/2,6,P.gold);
}

export function drawChaseCounters(c:CanvasRenderingContext2D,b:HypotheticalModel,o:WorldObjects,cx:number,cy:number,reduced:boolean){
    for(const [i,s]of CHASE_COUNTERS.entries()){
        if(s.pad.x<cx-180||s.load.x>cx+350)continue;
        const state=b.counters.loads[i],pose=b.counters.poseAt(i,b.tick),x=s.load.x-cx,rail=s.pad.x+s.pad.width-cx;
        const top=94-cy,base=240-cy,wood=s.material==='timber';
        // The hoist is bolted to separate quay piles, not to the crumbling road.
        for(const xx of [x-9,rail]){
            box(c,xx-3,top,6,base-top,P.ink);box(c,xx-2,top+2,3,base-top-3,P.shade);
            pixelLine(c,xx-1,top+4,xx-1,base-5,P.steel);
            box(c,xx-6,base-6,12,6,P.shade);pixelLine(c,xx-6,base-6,xx+5,base-6,P.edge);
            for(const yy of [top+10,base-21]){box(c,xx-2,yy,4,6,P.steel);box(c,xx-1,yy+1,1,1,P.edge);}
        }
        box(c,x-12,top,rail-x+16,6,P.ink);box(c,x-10,top+1,rail-x+12,3,P.steel);
        for(let u=x-4;u<rail-3;u+=13)pixelLine(c,u,top+2,u+7,top+2,P.edge);
        pixelLine(c,x-8,top+19,x+9,top+5,P.shade,3);pixelLine(c,rail-18,top+5,rail-1,top+21,P.shade,3);
        const drum=x+s.load.width/2;
        oval(c,drum-5,top+2,10,10,P.ink);oval(c,drum-3,top+4,6,6,P.steel);box(c,drum,top+5,1,4,P.gold);
        const released=state.released>=0||state.spent;
        const cableEnd=released?top+14:pose.y-cy;
        pixelLine(c,drum,top+11,drum,cableEnd,P.ink,3);pixelLine(c,drum,top+11,drum,cableEnd,P.edge);
        // The treadle's return cable visibly joins the same winch.
        pixelLine(c,drum+5,top+6,rail,top+6,P.gold);
        pixelLine(c,rail,top+6,rail,s.pad.y-cy,P.grain);
        const deck=o.bodies.some(p=>p.id===s.deck);
        if(deck){
            const px=s.pad.x-cx,py=s.pad.y-cy,press=released?2:0;
            box(c,px-2,py-2,s.pad.width+4,4,P.ink);box(c,px,py-4+press,s.pad.width,3,released?P.mint:P.gold);
            pixelLine(c,px+1,py-4+press,px+s.pad.width-2,py-4+press,P.light);
            for(let u=3;u<s.pad.width-2;u+=5)box(c,px+u,py-2+press,2,1,P.shade);
            box(c,px+s.pad.width+1,py-1,2,2,released?P.mint:P.shade);
            if(!released&&b.counters.playerX>s.pad.x-140&&b.counters.playerX<s.pad.x+s.pad.width){
                const dy=reduced?0:Math.round(Math.sin(b.tick/11));
                pixelLine(c,px+10,py-13+dy,px+10,py-8+dy,P.light);
                pixelLine(c,px+7,py-11+dy,px+10,py-8+dy,P.light);pixelLine(c,px+10,py-8+dy,px+13,py-11+dy,P.light);
                pixelText(c,'PISE',px+1,py-23,P.gold);
            }
        }
        if(state.spent)continue;
        if(state.struck<0){
            // After release the sling follows the load; it never stretches back
            // to a pulley which has already let go.
            const yy=pose.y-cy;
            c.save();c.beginPath();c.rect(x-8,top,48,240-cy-top);c.clip();
            const co=Math.cos(pose.turn),si=Math.sin(pose.turn);
            const anchor=(u:number,v:number):Point=>[x+14+(u-14)*co-(v-12)*si,yy+12+(u-14)*si+(v-12)*co];
            pixelLine(c,...anchor(4,0),...anchor(14,-6),P.edge);pixelLine(c,...anchor(14,-6),...anchor(24,0),P.edge);
            load(c,x,yy,pose.width,pose.height,pose.turn,wood);
            c.restore();
            if(pose.splashAge>=0&&pose.splashAge<25){
                const r=5+pose.splashAge*.65;
                pixelLine(c,x+14-r,240-cy,x+14+r,240-cy,P.edge);
                pixelLine(c,x+17-r,242-cy,x+12+r,242-cy,'#76a49a');
            }
        }
    }
}

export function drawChaseCounterEffects(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number,reduced:boolean){
    for(const [i,s]of CHASE_COUNTERS.entries()){
        const state=b.counters.loads[i];if(state.spent||state.struck<0)continue;
        const age=b.tick-state.struck;if(age<0||age>80)continue;
        const x=state.hitX-cx,y=state.hitY-cy,wood=s.material==='timber';
        if(x<-80||x>400)continue;
        drawChaseLandingDust(c,x,y,age,s.material,reduced);
        c.save();c.globalAlpha*=Math.min(1,(80-age)/18);
        for(let j=0;j<(reduced?3:6);j++){
            // The recoil throws chips back toward the already failing rear bank.
            const vx=-.9-j*.2,vy=-1.8-j%3*.4,g=.12;
            const height=240-state.hitY,land=(-vy+Math.sqrt(vy*vy+4*g*Math.max(0,height)))/(2*g);
            const t=Math.min(age,land),after=Math.max(0,age-land);
            const xx=x+(j<2?(j?5:-6):0)+vx*t+vx*4*(1-Math.exp(-after/8)),yy=y+vy*t+g*t*t;
            const angle=(j*.8+t*(j%2?.17:-.16))*(1-Math.min(1,after/12));
            const dx=Math.cos(angle)*(wood?6:4),dy=Math.sin(angle)*(wood?6:4);
            if(after===0){
                c.save();c.beginPath();c.rect(x-120,y-65,150,240-cy-y+65);c.clip();
                if(j<2){
                    // Two readable pieces retain the load's bands and slats.
                    // Smaller splinters support the fracture instead of making
                    // a full crate disappear into a handful of tiny dots.
                    const co=Math.cos(angle),si=Math.sin(angle);
                    const p=(u:number,v:number):Point=>[xx+u*co-v*si,yy-7+u*si+v*co];
                    polygon(c,[p(-5,-6),p(4,-6),p(6,-2),p(3,0),p(5,6),p(-5,5)],P.ink);
                    polygon(c,[p(-4,-5),p(3,-5),p(4,-2),p(2,1),p(3,4),p(-4,4)],wood?P.wood:P.steel);
                    pixelLine(c,...p(-3,-2),...p(3,-2),wood?P.grain:P.shade);
                    pixelLine(c,...p(-2,-5),...p(-2,4),P.shade,2);
                    pixelLine(c,...p(-3,-5),...p(-3,4),P.edge);
                    pixelLine(c,...p(-2,-4),...p(-1,-4),P.light);
                }else{
                    pixelLine(c,xx,yy-2,xx+dx,yy+dy-2,wood?P.grain:P.shade,3);
                    pixelLine(c,xx,yy-3,xx+dx,yy+dy-3,wood?P.gold:P.edge);
                }
                c.restore();
            }else if(after<20){
                const r=2+after*.45;
                pixelLine(c,xx-r,240-cy,xx+r,240-cy,j%2?P.edge:'#729d95');
                if(wood&&after<12)pixelLine(c,xx-2,240-cy,xx+3,240-cy,P.wood);
            }
            if(!reduced&&age<8&&!wood)pixelLine(c,x+vx*age*1.6,y+vy*age,x+vx*age*1.6+2,y+vy*age-2,P.light);
        }
        c.restore();
    }
}

/** Small world-space volley lamps complement the native line-of-fire tell. */
export function drawChaseVolleyCue(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number){
    if(b.pursuitCount<2||!['tell','attack'].includes(b.state))return;
    const x=b.x-cx+68,y=b.y-cy-88;
    for(let i=0;i<b.pursuitCount;i++){
        box(c,x+i*9,y,6,4,P.ink);box(c,x+i*9+1,y+1,4,2,i===b.pursuitStep?P.light:i<b.pursuitStep?P.steel:P.gold);
    }
    pixelText(c,b.pursuitKind==='high'?'ALTO':'BAIXO',x-2,y+7,P.gold);
}
