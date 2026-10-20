import {smoothMotion} from './HypotheticalMotion';
import {CHASE_PORTICO as P,CHASE_FLOOD as W} from './HypotheticalLayout';

const unit=(v:number)=>Math.max(0,Math.min(1,v));

/** A hanger strains before release. Collision latches only at the settled top;
 * the small residual motion belongs to the clamps below the supported foot. */
export function chaseCargoMotion(age:number,index:number){
    const u=unit((age-P.release)/(P.settle-P.release)),side=index===1?-1:1;
    const strain=age>=0&&age<P.release?Math.sin(age/P.release*Math.PI)*.035*side:0;
    const after=age-P.settle;
    return {drawY:168+40*u*u,turn:strain+Math.sin(u*Math.PI)*.16*side,
        ready:after>=0,releaseAge:age-P.release,
        settle:after<0?0:Math.sin(after*.65)*Math.exp(-after/8),
        latch:smoothMotion(after/5)};
}

const beamScores=[0,1,2].map(index=>{
    const delay=5+index*6,hingeTime=9,side=index===1?-1:1,pivot=side===1?0:112;
    const hingeAngle=side*.13,omega=hingeAngle/hingeTime,gravity=.085,initialV=.3;
    const airTurn=(v:number)=>hingeAngle+omega*v;
    const bottom=(v:number)=>{
        const a=airTurn(v);
        return Math.max(-pivot*Math.sin(a),(112-pivot)*Math.sin(a))+5;
    };
    // Solve the first touching corner once per beam, retaining rotation right
    // up to contact. Audio, water and the painted beam read this same score.
    let lo=0,hi=42;
    for(let n=0;n<18;n++){
        const t=(lo+hi)/2;
        if(initialV*t+gravity*t*t+bottom(t)<136)lo=t;else hi=t;
    }
    return {delay,hingeTime,side,pivot,hingeAngle,omega,gravity,initialV,contactFree:(lo+hi)/2};
});

/** The far end of each crossbeam remains on its joint while it peels away.
 * Detachment keeps the angular motion; its first touching corner owns the
 * splash, then the beam floats to its rest angle. */
export function chasePorticoBeam(index:number,age:number){
    const {delay,hingeTime,side,pivot,hingeAngle,omega,gravity,initialV,contactFree}=beamScores[index];
    const t=Math.max(0,age-delay),free=Math.max(0,t-hingeTime);
    const airTurn=(v:number)=>hingeAngle+omega*v;
    const contact=delay+hingeTime+contactFree,after=age-contact;
    const initial=side*.13*Math.min(1,t/hingeTime);
    const turn=after<0?(t<hingeTime?initial:airTurn(free)):
        airTurn(contactFree)*(1-smoothMotion(after/28))+side*.018*smoothMotion(after/28);
    const corner=Math.max(-pivot*Math.sin(turn),(112-pivot)*Math.sin(turn))+5;
    const bob=after>=0&&after<24?Math.sin(after/24*Math.PI)*2:0;
    return {x:2656+index*112+pivot,y:after<0?104+initialV*free+gravity*free*free:240-corner-bob,
        pivot,turn,release:delay+hingeTime,contact,contactX:2656+index*112+pivot+
            (side===1?112-pivot:-pivot)*Math.cos(airTurn(contactFree)),
        splashAge:after,age:t};
}

/** Integral of a smooth acceleration: the crest's painting and hurtbox cannot
 * drift apart when the release changes from a jet into a moving bore. */
export function chaseFloodTravel(age:number){
    const a=Math.max(0,age),u=unit(a/W.accelerate),extra=W.speed-W.launchSpeed;
    return W.launchSpeed*a+extra*(W.accelerate*(u*u*u-.5*u*u*u*u)+Math.max(0,a-W.accelerate));
}
export const CHASE_FLOOD_END=(W.endX-W.sourceX+(W.speed-W.launchSpeed)*W.accelerate/2)/W.speed;

const capAngle=(age:number)=>-.12+age*.08;
const capBottom=(angle:number)=>{
    const si=Math.sin(angle),co=Math.cos(angle);
    return Math.max(-3*si-8*co,2*si-8*co,3*si+8*co,-2*si+8*co);
};
const capContact=(()=>{
    let lo=0,hi=34;
    for(let n=0;n<18;n++){
        const t=(lo+hi)/2;
        if(206-2*t+.09*t*t+capBottom(capAngle(t))<224)lo=t;else hi=t;
    }
    return (lo+hi)/2;
})();

/** The rotating cap touches at its lowest corner, rebounds once and settles. */
export function chaseFloodCap(age:number){
    const launchY=206,v=-2,g=.09,contact=capContact;
    const t=Math.max(0,age),after=Math.max(0,t-contact),air=Math.min(t,contact);
    const bounce=after<12?Math.sin(after/12*Math.PI)*2.5:0,turn=capAngle(air)*(1-smoothMotion(after/15));
    return {x:W.sourceX+7+air*1.5+4*smoothMotion(after/15),
        y:t<contact?launchY+v*t+g*t*t:224-capBottom(turn)-bounce,turn,contact};
}
