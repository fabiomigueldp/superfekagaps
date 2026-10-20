import {box,oval,pixelLine,polygon,type Point} from '../WorldPainting';
import type {WorldObjects} from '../WorldPhysics';
import type {HypotheticalModel} from './HypotheticalModel';
import {CHASE_COUNTERS} from './HypotheticalLayout';
import {drawChaseLandingDust} from './HypotheticalChaseImpactArt';
import {smoothMotion} from './HypotheticalMotion';

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

export function drawChaseCounters(c:CanvasRenderingContext2D,b:HypotheticalModel,o:WorldObjects,cx:number,cy:number){
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
        const stroke=state.spent?1:pose.age<0?0:smoothMotion(pose.age/4),released=state.spent||pose.age>=4;
        const drum=x+s.load.width/2,cam=-.3+stroke*.85;
        oval(c,drum-5,top+2,10,10,P.ink);oval(c,drum-3,top+4,6,6,P.steel);
        for(let j=0;j<3;j++){
            const a=cam+j*Math.PI*2/3;
            pixelLine(c,drum,top+7,drum+Math.cos(a)*3,top+7+Math.sin(a)*3,P.edge);
        }
        box(c,drum,top+6,1,2,P.gold);
        const cableEnd=released?top+14:pose.y-cy-6;
        pixelLine(c,drum,top+11,drum,cableEnd,P.ink,3);pixelLine(c,drum,top+11,drum,cableEnd,P.edge);
        // Opening the clasp precedes the fall. The sling's apex sits inside
        // this same hook until the four-tick compression has completed.
        pixelLine(c,drum,cableEnd,drum+2+stroke*2,cableEnd-2,P.gold);
        // The treadle's return cable visibly joins the same winch.
        pixelLine(c,drum+5,top+6,rail,top+6,P.gold);
        pixelLine(c,rail,top+6,rail,s.pad.y-cy+2,P.grain);
        pixelLine(c,rail-1,top+9,rail-1,s.pad.y-cy-7,P.edge);
        const deck=o.bodies.some(p=>p.id===s.deck);
        if(deck){
            const px=s.pad.x-cx,py=s.pad.y-cy,w=s.pad.width,left=py-5+stroke*3,right=py-2;
            // A worn brass footplate, hinge, dark recess and compressed spring
            // explain the interaction through construction and visible travel.
            box(c,px-2,py-1,w+4,4,P.ink);box(c,px,py+1,w,1,P.shade);
            for(let j=0;j<3;j++){
                const sy=left+2+(py-left-1)*j/3;
                pixelLine(c,px+4+(j%2)*2,sy,px+6-(j%2)*2,sy+1,P.steel);
            }
            polygon(c,[[px,left],[px+w-1,right],[px+w-1,right+2],[px,left+2]],stroke<1?'#b78c57':'#8f9d83');
            pixelLine(c,px,left,px+w-1,right,stroke<1?P.light:P.mint);
            for(let u=4;u<w-3;u+=4){
                const yy=left+(right-left)*u/(w-1);
                pixelLine(c,px+u,yy,px+u,yy+1,P.grain);
            }
            for(const u of [1,w-3])box(c,px+u,left+(right-left)*u/(w-1)+1,1,1,P.light);
            oval(c,px+w-3,py-3,5,5,P.ink);box(c,px+w-1,py-2,1,2,P.edge);
            pixelLine(c,px+6,left+2,px+w+1,py+2,P.steel);
            pixelLine(c,px+w+1,py+2,rail,py-5+stroke*3,P.gold);
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

