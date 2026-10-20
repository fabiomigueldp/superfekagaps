import {chaseStructureTiming} from './HypotheticalChasePerformance';

type Kind='crane'|'gantry';
export interface SuspendedPose {x:number;y:number;turn:number}
type BeamAt=(age:number)=>SuspendedPose;
const ease=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
const swingAt=(kind:Kind,t:number)=>-Math.sin(t/10)*(1-Math.exp(-t/4))*Math.exp(-t/34)*(kind==='crane'?.16:.12);

/** A hanging object is defined in the same local frame as its moving beam.
 * Both endpoints of every cable come from these poses, including at release. */
function attached(kind:Kind,age:number,beamAt:BeamAt):SuspendedPose {
    const t=Math.max(0,age),beam=beamAt(t),u=kind==='crane'?37:31;
    const swing=swingAt(kind,t);
    const length=kind==='crane'?27:6;
    // The pulley cable leaves its underside vertically. Two equal gantry
    // hangers share the beam's normal and keep the sign parallel to the rail.
    const nx=kind==='crane'?0:-Math.sin(beam.turn)*3;
    const ny=kind==='crane'?3:Math.cos(beam.turn)*3;
    return {x:beam.x+Math.cos(beam.turn)*u+nx+Math.sin(swing)*length,
        y:beam.y+Math.sin(beam.turn)*u+ny+Math.cos(swing)*length,
        turn:kind==='crane'?-swing:beam.turn};
}

function lowest(kind:Kind,turn:number){
    const left=kind==='crane'?-13:-11,right=kind==='crane'?14:11,depth=kind==='crane'?18:10;
    const u=Math.sin(turn)>=0?right:left,v=Math.cos(turn)>=0?depth:0;
    return {x:u*Math.cos(turn)-v*Math.sin(turn),y:u*Math.sin(turn)+v*Math.cos(turn),u,v};
}

interface Release {pose:SuspendedPose;vx:number;vy:number;spin:number;fall:number;contactX:number;contactTurn:number;u:number;v:number}
// Only the two fixed authored assemblies use this cache; no per-tick entries.
const releases=new Map<string,Release>();

/** Preserve position, linear velocity and angular velocity when the cable
 * parts. Contact is solved from the actual crate/sign corners, then the piece
 * tips around its touching corner and sheds the remaining horizontal impulse. */
export function chaseSuspensionAt(kind:Kind,age:number,height:number,beamAt:BeamAt){
    const release=chaseStructureTiming(kind).release,key=kind+':'+height;
    const gravity=kind==='crane'?.09:.07,torque=kind==='crane'?.0004:.0007;
    const free=(r:Pick<Release,'pose'|'vx'|'vy'|'spin'>,t:number)=>({
        x:r.pose.x+r.vx*t,y:r.pose.y+r.vy*t+gravity*t*t,
        turn:r.pose.turn+r.spin*t+torque*t*t,
    });
    let r=releases.get(key);
    if(!r){
        const pose=attached(kind,release,beamAt),before=attached(kind,release-.01,beamAt);
        const start={pose,vx:(pose.x-before.x)/.01,vy:(pose.y-before.y)/.01,spin:(pose.turn-before.turn)/.01};
        let lo=0,hi=80;
        for(let i=0;i<18;i++){
            const t=(lo+hi)/2,p=free(start,t);
            if(p.y+lowest(kind,p.turn).y<0)lo=t;else hi=t;
        }
        const fall=(lo+hi)/2,p=free(start,fall),corner=lowest(kind,p.turn);
        r={...start,fall,contactX:p.x+corner.x,contactTurn:p.turn,u:corner.u,v:corner.v};
        releases.set(key,r);
    }
    const contact=release+r.fall,groundAge=age-contact;
    let pose:SuspendedPose;
    if(age<release)pose=attached(kind,age,beamAt);
    else if(age<contact)pose=free(r,age-release);
    else{
        const settle=ease(groundAge/26),turn=r.contactTurn*(1-settle);
        const bounce=groundAge<10?Math.sin(groundAge/10*Math.PI)*(kind==='crane'?.9:1.4):0;
        pose={x:r.contactX-r.u*Math.cos(turn)+r.v*Math.sin(turn)+r.vx*4*ease(groundAge/20),
            y:-lowest(kind,turn).y-bounce,turn};
    }
    const loose=Math.max(0,age-release),damping=Math.exp(-loose/18);
    const cableAngle=age<release?swingAt(kind,Math.max(0,age)):
        (swingAt(kind,release)*Math.cos(loose*.24)+.3*Math.sin(loose*.24)*(1-Math.exp(-loose/3)))*damping;
    return {...pose,released:age>=release,contact,contactX:r.contactX,groundAge,cableAngle};
}
