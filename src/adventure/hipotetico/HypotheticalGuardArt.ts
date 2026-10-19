import { box, oval, pixelLine, polygon, type Point } from '../WorldPainting';
import { pixelText } from '../../graphics/BitmapFont';
import type { WorldFoe } from '../WorldEnemies';
import type { Barrel } from '../WorldPhysics';
import { HypotheticalGuard } from './HypotheticalGuards';
import { guardActionPose } from './HypotheticalGuardMotion';
import { HypotheticalVanguard } from './HypotheticalVanguard';
import { drawVanguard } from './HypotheticalVanguardArt';

const C = { ink:'#172c36', navy:'#304659', seam:'#607487', cloth:'#203644', brass:'#d3a75c', light:'#fff0ce',
    jade:'#627c78', jadeLight:'#9bb3a0', jadeShade:'#3e5958', wood:'#8c5149', grain:'#bd8263', leather:'#583f38',
    glass:'#99e0cf', hot:'#ffb267', steel:'#a9b7b3' };
const unit=(n:number)=>Math.max(0,Math.min(1,n));
const ease=(n:number)=>{const t=unit(n);return t*t*(3-2*t);};

/** Feet travel backward exactly as far as the body moves in stance. Swing lifts rather than stretches a boot. */
export function guardFoot(distance:number,side:0|1):Point {
    const t=((distance+side*10)%20+20)%20;
    if(t<12)return [6-t,0];
    const swing=(t-12)/8;
    return [-6+12*ease(swing),-Math.sin(swing*Math.PI)*3];
}
export function guardPose(e:WorldFoe,reduced=false){
    const action=e instanceof HypotheticalGuard?e.actionPose:guardActionPose(e);
    const warning=action.brace;
    const vault=e instanceof HypotheticalGuard&&e.vaultTarget;
    const airborne=Boolean(vault&&e.phase==='attack');
    const moving=Math.abs(e.motionX)>.01,walk=moving&&!airborne&&['walk','rest','attack'].includes(e.phase);
    const recovery=e.phase==='rest'||e.phase==='recoil';
    const thrust=action.thrust;
    const bob=walk?-(Math.sin(e.distance/20*Math.PI*2)**2):0;
    const breathing=reduced||moving?0:Math.sin(e.age/230)*.4;
    const direction=e.motionX*e.facing<0?-1:1;
    const foot=(side:0|1):Point=>{const p=guardFoot(e.distance,side);return [p[0]*direction,p[1]];};
    return {warning,moving,thrust,recovery,bob:bob+breathing+action.crouch,
        lean:action.lean,hatch:action.hatch,carry:action.carry,turn:action.turn,supply:action.supply,cut:action.cut,tuck:action.tuck,
        left:airborne?[-4-action.tuck*2,-action.tuck*5] as Point:walk?foot(0):[-3,0] as Point,
        right:airborne?[3+action.tuck*2,-action.tuck*3] as Point:walk?foot(1):[3,0] as Point};
}

/** Same copper canister in the launcher's hands and in native projectile physics. */
export function drawGuardCanister(c:CanvasRenderingContext2D,x:number,y:number,w=14,h=16,rotation=0){
    oval(c,x,y,w,h,C.ink);oval(c,x+1,y+1,w-2,h-2,C.wood);
    box(c,x+3,y+2,2,h-4,C.grain);box(c,x+w-4,y+2,2,h-4,C.leather);
    for(const t of [3,h-5]){
        box(c,x+1,y+t,w-2,2,C.brass);box(c,x+3,y+t,w-6,1,C.light);
        box(c,x+w-3,y+t,1,2,C.leather);
    }
    const seam=x+w/2+Math.sin(rotation)*Math.max(1,w/2-3);
    pixelLine(c,seam,y+5,seam,y+h-6,C.grain);
    box(c,x+w/2-1,y+1,3,2,C.steel);
}
export function drawHypotheticalCanister(c:CanvasRenderingContext2D,b:Barrel,cx:number,cy:number){
    if(b.life<=0)return;
    const x=b.x-cx,y=b.y-cy;
    // A short directional trail stays behind the live projectile, never masquerading as another hitbox.
    if(Math.abs(b.vy)>1){box(c,x-b.vx*2+5,y-b.vy*2+6,2,1,C.brass);box(c,x-b.vx*3+5,y-b.vy*3+6,1,1,C.grain);}
    drawGuardCanister(c,x,y,b.width,b.height,b.rotation);
}

export function drawHypotheticalGuard(c:CanvasRenderingContext2D,e:WorldFoe,cx:number,cy:number,reduced=false){
    if(e instanceof HypotheticalVanguard){drawVanguard(c,e,cx,cy,reduced);return;}
    if(e.dead&&e.deadTimer>=420)return;
    const x=Math.round(e.x-cx),y=Math.round(e.y-cy),w=e.width,h=e.height,d=e.facing||1;
    const pose=guardPose(e,reduced),kind=e.spec.kind,hit=e.flash>0&&Math.floor(e.flash/45)%2===0;
    const color=(col:string)=>hit?C.light:col;
    const xx=(v:number)=>x+(d>0?v:w-1-v);
    const rect=(a:number,b:number,ww:number,hh:number,col:string)=>box(c,xx(d>0?a:a+ww-1),y+b,ww,hh,color(col));
    const line=(a:number,b:number,aa:number,bb:number,col:string,size=1)=>pixelLine(c,xx(a),y+b,xx(aa),y+bb,color(col),size);
    const poly=(p:readonly Point[],col:string)=>polygon(c,p.map(([a,b])=>[xx(a),y+b] as Point),color(col));
    const ellipse=(a:number,b:number,ww:number,hh:number,col:string)=>oval(c,xx(d>0?a:a+ww-1),y+b,ww,hh,color(col));
    if(e instanceof HypotheticalGuard&&!e.dead&&e.vaultTarget&&['warning','attack'].includes(e.phase)){
        // This bracket is attached to the real destination and remains locked
        // when Feka dodges. The airborne body is the whole danger region.
        const target=e.vaultTarget,tx=Math.round(target.x-cx),ty=Math.round(target.floor-cy);
        pixelLine(c,tx-2,ty-4,tx-2,ty-1,C.hot);pixelLine(c,tx-2,ty-1,tx+3,ty-1,C.hot);
        pixelLine(c,tx+w+1,ty-4,tx+w+1,ty-1,C.hot);pixelLine(c,tx+w-4,ty-1,tx+w+1,ty-1,C.hot);
        box(c,tx+w/2-1,ty-2,2,1,C.light);
    }
    if(e.dead){
        const t=unit(e.deadTimer/240),rise=Math.sin(t*Math.PI)*7;
        // Brief recoil, a tumbling cap and grounded debris replace the instant flat rectangle.
        const spread=t*6,base=h-4-rise;
        poly([[2-spread,base],[w-4,base-2],[w+spread,base+3],[4,base+4]],C.ink);
        rect(5,base,Math.max(3,w-9),2,kind==='helmet'?C.jade:kind==='loader'?C.wood:C.navy);
        if(kind==='charger'){
            for(const side of [-1,1]){
                const at=w/2+side*(7+spread);
                ellipse(at-3,h-6-Math.sin(t*Math.PI)*3,6,6,C.ink);ellipse(at-2,h-5-Math.sin(t*Math.PI)*3,4,4,C.leather);
                line(at-1,h-5-Math.sin(t*Math.PI)*3,at+1,h-3-Math.sin(t*Math.PI)*3,C.brass);
            }
            poly([[4,base],[w-6,base-5*(1-t)],[w+1,base+1],[6,base+2]],C.jadeShade);
            line(5,base,w-6,base-5*(1-t),C.brass);
        }else if(kind==='loader'){
            for(let i=0;i<3;i++)line(w-4+i*3+t*3,base-4-i%2*3,w-2+i*3+t*3,base+1,C.grain,2);
            rect(w-4+spread,base-3,5,1,C.brass);rect(4-spread,base-3,5,3,C.leather);
        }else{
            rect(w/2-3,base-7*(1-t),6,3,C.jadeShade);
            if(kind==='helmet')poly([[w-1+spread,base-3],[w+4+spread,base-1],[w+1+spread,base+2],[w-3+spread,base]],C.brass);
            else line(-spread,base-2,-3-spread,base+2,C.brass,2);
        }
        if(!reduced&&e.deadTimer<220)for(let i=0;i<3;i++)rect(3+i*6+(i-1)*spread,h-3-rise*(1+i*.3),2,1,C.light);
        return;
    }
    if(kind==='charger'){
        // The low battering trolley has a clearly armored roof; braking folds it open for a stomp.
        const brake=pose.recovery?1-ease(e.timer/260):0;
        const open=pose.hatch,squat=pose.warning*2+brake,lean=pose.lean*.7+brake*2;
        for(const at of [5,w-6]){
            ellipse(at-4,h-8,8,8,C.ink);ellipse(at-3,h-7,6,6,C.leather);
            const a=e.distance/3.5;
            line(at+Math.cos(a)*2,h-4+Math.sin(a)*2,at-Math.cos(a)*2,h-4-Math.sin(a)*2,C.brass);
            rect(at,h-4,1,1,C.light);
        }
        poly([[1,h-16],[w-5,h-17],[w-1,h-10],[w-3,h-5],[2,h-5]],C.ink);
        poly([[3,h-14],[w-6,h-15],[w-3,h-10],[w-5,h-7],[3,h-7]],C.jadeShade);
        line(4,h-14,w-6,h-15,C.jadeLight);rect(5,h-11,10,3,C.jade);
        for(let i=0;i<3;i++)rect(6+i*4,h-10,2,1,C.brass);
        // Connecting rod, suspension and scuffed plating retain their material as the cart pitches.
        line(5,h-6,16+pose.thrust*3,h-7,C.ink,2);line(6,h-6,15+pose.thrust*3,h-7,C.steel);
        rect(4,h-13,2,1,C.steel);rect(w-9,h-9,2,1,C.jadeLight);
        poly([[w-6,h-17],[w+2,h-13],[w+2,h-8],[w-6,h-5]],C.ink);
        poly([[w-5,h-15],[w,h-12],[w,h-9],[w-5,h-7]],C.brass);line(w-4,h-14,w,h-12,C.light);
        rect(3,5+squat,11,10,C.navy);rect(4,6+squat,4,6,C.seam);
        rect(6+lean,2+squat,9,7,C.ink);rect(7+lean,4+squat,7,3,C.jade);
        rect(10+lean,4+squat,4,1,pose.warning?C.hot:C.glass);
        line(12,10+squat,18,h-14,C.ink,3);line(12,10+squat,18,h-14,C.brass);
        rect(17,h-15,3,2,C.leather);rect(17,h-15,2,1,C.light);
        line(7,12+squat,4+brake*2,h-10,C.ink,3);line(7,12+squat,4+brake*2,h-10,C.seam);
        // The driver's second hand pulls the brake; the pad meets the rear wheel.
        line(4+brake*2,h-12,5,h-5,C.steel);rect(3+brake*2,h-6,3,2,C.brass);
        if(e.armor){
            poly([[3,2+squat],[13-open*8,squat-open*5],[18-open*11,4+squat-open*5],[3,6+squat]],C.ink);
            line(4,2+squat,13-open*8,1+squat-open*5,C.brass,2);rect(8-open*3,2+squat-open*2,2,1,C.light);
        }else{
            // The roof remains visibly broken after a pound; it cannot silently regain armor.
            line(2,3+squat,4,7+squat,C.steel,2);rect(2,3+squat,2,1,C.light);
            line(w-10,h-14,w-8,h-12,C.ink);line(w-8,h-12,w-10,h-9,C.ink);
        }
        if(pose.recovery||!e.armor){line(6,1,6,-2,C.glass);line(6,-2,10,-2,C.glass);}
        if(pose.moving&&!reduced)for(let i=0;i<3;i++)rect(-3-i*3,h-2-(i+Math.floor(e.age/70))%3,2,1,C.grain);
        if(pose.recovery&&e.timer<320&&!reduced)for(let i=0;i<2;i++)rect(1-i*3,h-8-e.timer/45-i*2,2,2,C.steel);
        if(e instanceof HypotheticalGuard&&e.age-e.impactAt<280){
            const t=(e.age-e.impactAt)/280;
            // Wheel skid and fragments originate at the actual front bumper.
            for(let i=0;i<(reduced?2:5);i++){
                const px=w+(i%2?1:-1)*t*(5+i),py=h-5-t*(9+i*2)+t*t*10;
                rect(px,py,2,1,i%2?C.steel:C.brass);
            }
            line(w-8-t*14,h-1,w-2,h-1,C.leather);
        }
    } else {
        const torso=h-12+pose.bob,lean=pose.lean;
        // Thigh and shin articulate independently during actual steps, including attacking steps.
        for(const [i,foot] of [pose.left,pose.right].entries()){
            const fx=w/2+foot[0],fy=h-3+foot[1],hip=w/2+(i?2:-2);
            const kneeX=(hip+fx)/2+2,kneeY=(torso+5+fy-1)/2;
            line(hip,torso+4,kneeX,kneeY,C.ink,3);line(kneeX,kneeY,fx,fy,C.ink,3);
            line(hip,torso+4,kneeX,kneeY,i?C.seam:C.cloth);line(kneeX,kneeY,fx,fy,i?C.seam:C.cloth);
            rect(kneeX,kneeY,2,1,i?C.jadeLight:C.leather);
            rect(fx-2,fy,5,3,C.ink);rect(fx-1,fy,3,1,i?C.brass:C.leather);
        }
        if(kind==='loader'){
            rect(0,7,8,11,C.ink);rect(1,8,6,9,C.leather);
            rect(1,9,6,2,C.brass);rect(2,12,4,3,C.wood);rect(3,8,1,8,C.grain);
            // A hinged satchel and its retaining strap visibly supply the next canister.
            poly([[0,7],[1,4-pose.supply*4],[6,5-pose.supply*3],[8,7]],C.ink);
            line(1,5-pose.supply*3,6,6-pose.supply*2,C.brass);
            line(4,8,5,14,C.leather);rect(4,12,2,2,C.steel);
        }
        const jacket=kind==='helmet'?C.jade:kind==='loader'?C.grain:C.navy;
        if(kind==='minion'){
            const flutter=reduced?0:Math.sin(e.distance/4)*Math.min(2,Math.abs(e.motionX)*2);
            poly([[4,torso-2],[6,torso+5],[1-flutter,torso+7],[-1-flutter,torso+3]],C.ink);
            line(2,torso+1,1-flutter,torso+5,C.seam);
            if(e instanceof HypotheticalGuard&&e.wave>=2){
                // Copper edging and two ankle wraps distinguish the agile flankers.
                line(1-flutter,torso+4,3,torso+5,C.grain);
                for(const foot of [pose.left,pose.right])rect(w/2+foot[0]-1,h-5+foot[1],3,1,C.grain);
            }
        }
        poly([[4+lean,7+pose.bob],[w-5+lean,7+pose.bob],[w-3,torso+6],[3,torso+6]],C.ink);
        poly([[5+lean,8+pose.bob],[w-6+lean,8+pose.bob],[w-5,torso+4],[4,torso+4]],jacket);
        // Seams and shoulder plates remain attached to the pose, not to an idle sprite.
        line(5+lean,8+pose.bob,7+lean,9+pose.bob,kind==='loader'?C.brass:C.seam);
        line(w-7+lean,9+pose.bob,w-5,torso+2,kind==='helmet'?C.jadeLight:C.seam);
        rect(5+lean,10+pose.bob,3,2,kind==='helmet'?C.jadeShade:C.cloth);
        rect(6+lean,10+pose.bob,1,1,C.brass);
        line(5,torso+3,7,torso+3,kind==='loader'?C.leather:C.seam);
        rect(5,torso+1,3,3,kind==='helmet'?C.jadeShade:C.cloth);
        line(6+lean,8+pose.bob,w-6,torso+3,C.leather,2);
        rect(w/2,torso+1,3,2,C.brass);rect(w/2+1,torso+1,1,1,C.light);
        rect(5,torso+5,w-10,2,C.leather);rect(w/2,torso+5,2,1,C.brass);
        if(kind==='minion'&&e instanceof HypotheticalGuard&&e.wave>=2){
            line(6+lean,8+pose.bob,w-5,torso+3,C.grain);rect(5,torso+3,3,1,C.brass);
        }
        if(kind==='loader'&&e instanceof HypotheticalGuard&&e.wave===4){
            // The bastion artillery carries the same brass shoulder insignia as its captain.
            poly([[4+lean,8+pose.bob],[7+lean,7+pose.bob],[9+lean,9+pose.bob],[7+lean,12+pose.bob],[4+lean,11+pose.bob]],C.ink);
            line(5+lean,9+pose.bob,7+lean,11+pose.bob,C.brass);line(7+lean,11+pose.bob,8+lean,9+pose.bob,C.light);
        }
        if(e instanceof HypotheticalGuard&&e.comboLength===2){
            rect(3,torso,2,1,C.brass);rect(3,torso+3,2,1,C.brass);
        }
        const head=pose.bob+(e.phase==='stunned'?2:0),hx=lean;
        poly([[4+hx,head+1],[w-6+hx,head],[w-3+hx,head+4],[w-5+hx,head+9],[5+hx,head+9],[3+hx,head+5]],C.ink);
        rect(5+hx,head+2,w-10,5,C.jadeShade);rect(6+hx,head+3,w-11,2,C.glass);
        rect(w-7+hx-pose.turn*2,head+3,2,1,C.light);rect(w-5+hx-pose.turn*2,head+5,2,2,C.brass);
        rect(6+hx,head+7,w-12,1,C.steel);
        if(kind==='helmet'&&e.armor){
            poly([[2+hx,head+2],[4+hx,head-2],[w-6+hx,head-3],[w-2+hx,head+1],[w-2+hx,head+4],[2+hx,head+4]],C.ink);
            poly([[3+hx,head+1],[5+hx,head-1],[w-7+hx,head-2],[w-4+hx,head+1],[w-3+hx,head+2],[3+hx,head+2]],C.jade);
            line(5+hx,head-1,w-7+hx,head-2,C.jadeLight);rect(7+hx,head-2,2,5,C.brass);
            if(e.blocksStomp){line(3+hx,head+1,w-4+hx,head+1,C.brass);rect(w-5+hx,head+2,2,2,C.leather);}
            else {line(3+hx,head-2,2+hx,head-5,C.glass);line(2+hx,head-5,6+hx,head-5,C.glass);}
        }else if(kind==='minion'){
            rect(3+hx,head,w-6,3,C.ink);rect(4+hx,head,w-8,1,C.brass);
            line(4+hx,head,1+hx-pose.warning*2,head-3,C.wood,2);
        }else if(kind==='loader'){
            rect(4+hx,head,w-9,2,C.leather);rect(4+hx,head+3,w-9,3,C.ink);
            rect(6+hx,head+3,3,2,C.glass);rect(w-8+hx,head+3,3,2,C.light);
        }
        line(4+lean,9+pose.bob,3,torso+3,C.ink,3);line(4+lean,9+pose.bob,3,torso+2,jacket);
        if(kind==='helmet'){
            const extend=pose.thrust*7,sy=e.danger?9:9+pose.bob,front=e.danger?w+4:w-4+extend-pose.turn*5;
            const elbow=w-7-pose.warning*2+pose.thrust*4;
            line(w-6+lean,10+pose.bob,elbow,sy+6,C.ink,3);line(elbow,sy+6,front,sy+5,C.ink,3);
            line(elbow,sy+6,front-1,sy+5,C.jadeLight);rect(front-3,sy+5,3,2,C.leather);
            poly([[front-3,sy],[front+3,sy+1],[front+4,sy+10],[front,sy+14],[front-4,sy+10]],C.ink);
            poly([[front-2,sy+1],[front+2,sy+2],[front+3,sy+9],[front,sy+12],[front-3,sy+9]],e.armor?C.brass:C.leather);
            line(front-1,sy+2,front+1,sy+8,e.armor?C.light:C.grain);
            rect(front-1,sy+5,2,3,C.jadeShade);
            rect(front-2,sy+9,1,1,C.steel);rect(front+2,sy+3,1,1,C.leather);
            line(front-2,sy+4,front,sy+5,e.armor?C.grain:C.wood);
            line(front,sy+10,front+2,sy+8,e.armor?C.steel:C.grain);
        }else if(kind==='loader'){
            const reach=pose.carry;
            const handX=w-5+12*reach-pose.supply*13,handY=15-11*reach-pose.supply*5;
            const elbowX=w-3+reach*3-pose.supply*8,elbowY=13-pose.supply*3;
            line(w-6,10,elbowX,elbowY,C.ink,4);line(elbowX,elbowY,handX,handY+6,C.ink,3);
            line(w-6,10,elbowX,elbowY-1,C.grain,2);rect(handX-1,handY+5,3,3,C.brass);
            rect(elbowX-1,elbowY,2,2,C.leather);rect(elbowX,elbowY,1,1,C.steel);
            // Only one barrel: it leaves the hand on the same tick native physics spawns it.
            const supplied=e instanceof HypotheticalGuard&&e.phase==='rest'&&e.reloadProgress>=.42;
            if(e.phase==='warning'||supplied){
                drawGuardCanister(c,xx(handX)-(d>0?7:6),y+handY-8,14,16,-reach*.5);
                // Both gloves stay attached to the weight until release.
                line(w-5,13,handX-3,handY+6,C.ink,3);
                rect(handX-4,handY+5,3,3,C.leather);rect(handX-3,handY+5,2,1,C.brass);
            }
            if(e.phase==='warning'){
                if(e.highThrow){line(w/2,-6,w/2+3,-9,C.brass);line(w/2+3,-9,w/2+6,-6,C.brass);}
                else if(e instanceof HypotheticalGuard&&e.coveringElite){line(w/2,-6,w/2+7,-6,C.brass);line(w/2+7,-6,w/2+5,-8,C.light);}
            }
            if(!reduced&&e instanceof HypotheticalGuard&&e.age-e.lastRelease<130){
                const t=(e.age-e.lastRelease)/130;
                line(w+3+t*4,-2-t*3,w+5+t*4,-3-t*3,C.grain);
                rect(w+1+t*3,2+t*2,1,1,C.brass);
            }
        }else{
            const long=e instanceof HypotheticalGuard&&e.longLunge,vault=e instanceof HypotheticalGuard&&e.vaultTarget;
            const reach=pose.thrust*(long?11:8),arm=e.danger?w+5:w-3+reach-pose.turn*4;
            const handY=12-pose.warning*3+pose.cut*2,elbowX=w-8-pose.warning*3+pose.thrust*4;
            line(w-6+lean,9+pose.bob,elbowX,13+pose.bob,C.ink,3);line(elbowX,13+pose.bob,arm,handY,C.ink,3);
            line(elbowX,12+pose.bob,arm,handY,C.seam);rect(arm-1,handY-1,3,3,C.leather);
            const tipX=e.danger?w+(long?11:7):arm+1+pose.cut*4;
            const tipY=vault?5+pose.cut*9:long?10+Math.min(0,pose.cut)*14+Math.max(0,pose.cut)*6:7-pose.warning*3;
            line(arm-1,handY+4,tipX,tipY,C.ink,3);line(arm,handY+3,tipX,tipY,C.brass);
            rect(tipX-1,tipY-1,3,2,C.light);
            if(long&&e.danger&&!reduced){
                line(arm-3,handY-4,tipX-4,tipY-4,C.wood);rect(tipX-6,tipY-6,2,1,C.grain);
            }
        }
        if(!reduced&&e.phase==='attack'&&pose.moving&&e.timer<180&&!(e instanceof HypotheticalGuard&&e.vaultTarget)){
            const t=e.timer/180;
            rect(-2-t*5,h-2-Math.sin(t*Math.PI)*3,2,1,C.grain);rect(1-t*3,h-1,2,1,C.leather);
        }
        if(e instanceof HypotheticalGuard&&e.vaultTarget&&e.phase==='attack'&&e.timer<180&&!reduced){
            const t=e.timer/180,from=e.vaultTarget;
            for(const side of [-1,1])box(c,from.fromX+w/2-cx+side*(3+t*9),from.fromFloor-cy-2-Math.sin(t*Math.PI)*2,3,1,C.grain);
        }
        if(e instanceof HypotheticalGuard&&e.age-e.vaultLandedAt<300){
            const t=(e.age-e.vaultLandedAt)/300;
            for(const side of [-1,1])for(let i=0;i<(reduced?1:3);i++){
                const xx=x+w/2+side*(4+t*(12+i*4)),yy=y+h-2-Math.sin(t*Math.PI)*(2+i);
                box(c,xx,yy,3-i%2,1,i===0?C.grain:C.leather);
            }
        }
    }
    // Bright attack edge is drawn from the collision rectangle, including its exact outer reach.
    const danger=e.danger;
    if(danger){
        const ex=(d>0?danger.x+danger.width-1:danger.x)-cx;
        pixelLine(c,ex,y+(danger.y-e.y),ex,y+(danger.y-e.y)+danger.height-1,C.light);
        pixelLine(c,ex-d*4,danger.y-cy+2,ex,danger.y-cy+2,C.brass);
    }
    if(e instanceof HypotheticalGuard&&e.age-e.armorLostAt<420){
        const t=(e.age-e.armorLostAt)/420;
        rect(5-t*12,-2-Math.sin(t*Math.PI)*12,9,3,C.jadeShade);rect(6-t*12,-2-Math.sin(t*Math.PI)*12,6,1,C.brass);
    }
    if(e.phase==='warning'){
        // Fixed, nonflashing anticipation pip; weapon/stance carries the direction, not color alone.
        const vault=e instanceof HypotheticalGuard&&Boolean(e.vaultTarget);
        const pair=e instanceof HypotheticalGuard&&e.comboLength===2&&!vault;
        pixelText(c,pair?`${e.comboStep+1}/2`:'!',x+w/2-(pair?6:2),y-(kind==='loader'?25:11),C.hot);
        if(vault){pixelLine(c,x+w/2-4,y-14,x+w/2,y-18,C.brass);pixelLine(c,x+w/2,y-18,x+w/2+4,y-14,C.brass);}
        box(c,x+w/2-5,y-(kind==='loader'?16:5),10,1,C.ink);
        box(c,x+w/2-5,y-(kind==='loader'?16:5),10*unit(e.timer/e.warningDuration),1,C.brass);
    }
    if(e.phase==='stunned')for(const side of [-1,1])rect(w/2+side*6,-6+(reduced?0:Math.sin(e.age/90+side)*2),2,2,C.brass);
}
