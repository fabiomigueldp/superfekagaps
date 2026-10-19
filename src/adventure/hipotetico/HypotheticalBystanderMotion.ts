import { smoothMotion } from './HypotheticalMotion';
import type { Bystander,DistantShot } from './HypotheticalBackdrop';

/** One pose supplies both the pixel body and the distant bullet silhouette. */
export function bystanderPose(p:Bystander,tick:number){
    const age=p.hitAt===null?-1:tick-p.hitAt,running=age<0&&Math.abs(p.velocity)>.01;
    const cycle=p.distance/13+p.color*.23,travel=smoothMotion(Math.abs(p.velocity)/.3);
    const foot=(offset:number)=>{
        const t=(cycle+offset)%1,swing=Math.max(0,(t-.6)/.4);
        return [running?(t<.6?3.5-7*t/.6:-3.5+7*smoothMotion(swing))*travel:0,running?-Math.sin(swing*Math.PI)*3*travel:0];
    };
    const crouch=p.stoppedAt===null?0:smoothMotion((tick-p.stoppedAt)/9);
    const pulse=(age:number,rise:number,hold:number,end:number)=>age<0?0:smoothMotion(age/rise)*(1-smoothMotion((age-hold)/(end-hold)));
    const recoil=p.reactionTimes.reduce((value,at)=>Math.max(value,pulse(tick-at,p.exitAtShelter?10:8,14,32)),0);
    const alert=pulse(tick-p.alertAt,8,10,28),cover=Math.max(crouch,recoil,alert);
    const glance=(p.distance%72)-24;
    const gaze=Math.max(p.threatenedAt===null?0:pulse(tick-p.threatenedAt,6,12,24),p.fleeing?pulse(glance,5,18,24):0);
    const lean=travel*2,hipY=-6+crouch*4,torsoY=hipY-Math.round(9-crouch*2),headY=-22+crouch*8;
    const swing=running?Math.sin(cycle*Math.PI*2)*3*travel:0;
    const mix=(a:number,b:number)=>a+(b-a)*cover;
    const leftHand=[mix(-7+swing,-6+lean),mix(torsoY+6,headY+5)];
    const rightHand=[mix(5-swing,5+lean),mix(torsoY+7,headY+4)];
    return {age,running,cycle,left:foot(0),right:foot(.5),crouch,recoil,alert,
        lookBack:gaze>.5,gaze,travel,cover,swing,leftHand,rightHand,lean,hipY,torsoY,headY,
        bob:running?Math.sin(cycle*Math.PI*4)*.45*travel:0,
        clothSway:Math.sin(cycle*Math.PI*2-.7)*travel+(p.stoppedAt===null?0:Math.sin((tick-p.stoppedAt)/4)*Math.max(0,1-(tick-p.stoppedAt)/18))};
}

export function bystanderBounds(p:Bystander,tick:number){
    const pose=bystanderPose(p,tick);
    const depth=p.depth??0,heading=Math.sign(p.shelter-p.originX)||1;
    const door=p.shelter-heading*8;
    return {left:p.exitAtShelter&&heading<0?Math.max(p.x-4,door):p.x-4,
        right:p.exitAtShelter&&heading>0?Math.min(p.x+4,door):p.x+4,top:pose.headY+pose.bob+depth,bottom:-1+depth};
}

/** A hit retains the crouch at contact; a sheltered actor never pops upright to fall. */
export function bystanderFall(p:Bystander,tick:number){
    const age=p.hitAt===null?0:Math.max(0,tick-p.hitAt);
    const crouch=p.stoppedAt===null||p.hitAt===null?0:smoothMotion((p.hitAt-p.stoppedAt)/9);
    const fall=smoothMotion((age-5)/26),settle=age>31&&age<42?Math.sin((age-31)/11*Math.PI)*.7:0;
    const angle=fall*Math.PI/2,headTop=-16+crouch*4;
    const lowerEdge=Math.max(4*Math.sin(angle),5*Math.sin(angle)+(headTop+7)*Math.cos(angle),p.clothes==='satchel'?7*Math.sin(angle)+Math.cos(angle):0);
    return {age,crouch,angle,height:Math.round(9-crouch*2),headTop,
        hipX:fall*5+Math.sin(Math.PI*Math.min(1,age/9))*2.5,
        hipY:Math.min(-6+crouch*4+fall*(4-crouch*4)-settle,-1-lowerEdge)};
}

/** Slab intersection returns the first contact along a shot, not its enclosing rectangle. */
export function bystanderIntersection(p:Bystander,tick:number,s:Pick<DistantShot,'px'|'py'|'x'|'y'>){
    if(p.escaped||p.hitAt!==null||tick<p.alertAt)return null;
    const bounds=bystanderBounds(p,tick);let first=0,last=1;
    if(bounds.left>=bounds.right)return null;
    for(const [start,end,min,max] of [[s.px,s.x,bounds.left,bounds.right],[s.py,s.y,bounds.top,bounds.bottom]]){
        const delta=end-start;
        if(Math.abs(delta)<1e-9){if(start<min||start>max)return null;continue;}
        const a=(min-start)/delta,b=(max-start)/delta;first=Math.max(first,Math.min(a,b));last=Math.min(last,Math.max(a,b));
        if(first>last)return null;
    }
    return first;
}
