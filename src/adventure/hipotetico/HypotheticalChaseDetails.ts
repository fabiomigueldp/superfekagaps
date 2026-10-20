import { CHASE_GAPS, CHASE_WIDTH } from './HypotheticalLayout';
import {chaseStructureTiming,type ChaseStructureKind} from './HypotheticalChasePerformance';
import {chaseSuspensionAt} from './HypotheticalChaseSuspension';

export const CHASE_DECK_Y = 224;
export const CHASE_WATER_Y = 240;
export type ChaseMaterial = 'stone' | 'timber' | 'iron';
const unit = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => { const t = unit(v); return t * t * (3 - 2 * t); };

export function chaseMaterialAt(x: number): ChaseMaterial {
    return x >= 3360 ? 'iron' : x >= 1120 && x < 2240 ? 'timber' : 'stone';
}

export function chaseCollapsedEdge(pursuerX: number) {
    return Math.max(0, Math.min(CHASE_WIDTH, Math.floor((pursuerX - 32) / 16) * 16));
}

/** Real banks only: neither a gap nor a collapsed tile can stop a projectile. */
export function chaseDeckSpans(pursuerX: number) {
    const spans: Array<{ x: number; y: number; width: number; height: number }> = [];
    const edge = chaseCollapsedEdge(pursuerX);
    let start = edge;
    for (const [a, z] of CHASE_GAPS) {
        if (a * 16 > start) spans.push({ x: start, y: CHASE_DECK_Y, width: a * 16 - start, height: 64 });
        start = Math.max(start, z * 16);
    }
    if (start < CHASE_WIDTH) spans.push({ x: start, y: CHASE_DECK_Y, width: CHASE_WIDTH - start, height: 64 });
    return spans;
}

/** Contact hold, failing joints and rigid pieces share one structural clock. */
export function chaseRuinAt(age: number,height=78,kind:ChaseStructureKind='crane') {
    const score=chaseStructureTiming(kind),t=Math.max(0,age-score.left),rt=Math.max(0,age-score.right);
    const push=kind==='pier'?2.6:kind==='crane'?2.5:kind==='sluice'?1.35:1.8;
    const recoil=(at:number)=>at>=0&&at<score.beam?Math.sin(at/score.beam*Math.PI)*1.1:0;
    const beamAt=(at:number)=>landedPiece(at,score.beam,height,66,4,score.gravity,score.turn,score.turnTime,0,push);
    const beam=beamAt(age);
    const panel=landedPiece(age,score.panel,height-9,46,29,kind==='sluice'?.08:.07,kind==='sluice'?.4:.65,36);
    const suspended=kind==='crane'||kind==='gantry'?chaseSuspensionAt(kind,age,height,at=>{
        const b=beamAt(at);return{x:-26+b.x+recoil(at),y:-height+b.drop,turn:b.turn};
    }):null;
    const leftTurn=ease(t/29)*1.45,rightTurn=ease(rt/33)*1.4;
    return {
        score,
        leftTurn,rightTurn,
        postDrop:Math.min(t*t*.035,22-3.5*Math.sin(leftTurn)),
        rightPostDrop:Math.min(rt*rt*.035,22-3.5*Math.sin(rightTurn)),
        beamX: beam.x+recoil(age),
        beamDrop: beam.drop,
        beamTurn: beam.turn,
        beamContact:beam.contact,
        beamContactX:beam.contactX-26,
        groundAge:age-beam.contact,
        panelX:panel.x,panelDrop:panel.drop,panelTurn:panel.turn,panelContact:panel.contact,panelContactX:panel.contactX-17,
        leftBrace:landedPiece(age,score.left,height-29,30,2,.065,.22,32,-Math.PI/2+.66),
        rightBrace:landedPiece(age,score.right,height-29,30,2,.065,-Math.PI+.15,32,-Math.PI/2-.66),
        suspended,
        dust: age > 8 && age < 60 ? Math.sin(unit((age - 8) / 52) * Math.PI) : 0,
    };
}

const contacts=new Map<string,number>();
/** A detached rigid piece pivots on its first contact, bounces, then rests on the bank. */
function landedPiece(age:number,delay:number,height:number,length:number,depth:number,gravity:number,maxTurn:number,turnTime:number,initial=0,drift=.45){
    const rotation=(t:number)=>initial+ease(t/turnTime)*(maxTurn-initial);
    const bottom=(angle:number)=>Math.max(0,length*Math.sin(angle))+Math.abs(depth*Math.cos(angle));
    const key=[height,length,depth,gravity,maxTurn,turnTime,initial].join(':');
    let fallTime=contacts.get(key);
    if(fallTime===undefined){
        let lo=0,hi=80;
        for(let i=0;i<18;i++){const m=(lo+hi)/2;if(gravity*m*m+bottom(rotation(m))<height)lo=m;else hi=m;}
        fallTime=(lo+hi)/2;contacts.set(key,fallTime);
    }
    const contact=fallTime+delay,t=Math.max(0,age-delay),land=Math.max(0,age-contact),atContact=rotation(fallTime);
    const contactX=fallTime*drift+(Math.sin(atContact)>=0?length:0)*Math.cos(atContact)-depth*Math.sign(Math.cos(atContact))*Math.sin(atContact);
    if(age<contact)return{x:t*drift,drop:t*t*gravity,turn:rotation(t),contact,contactX};
    const rest=maxTurn<-Math.PI/2?-Math.PI+.025:.025;
    const turn=rotation(contact-delay)*(1-ease(land/23))+rest*ease(land/23);
    const bounce=land<12?Math.sin(land/12*Math.PI)*2.1:0;
    return{x:fallTime*drift+(3+drift*8)*ease(land/28),drop:height-bottom(turn)-bounce,turn,contact,contactX};
}

/** Small fragments inherit an impulse from the struck joint, land once and
 * settle on the same rear bank as the large rigid parts. No render-time RNG. */
export function chaseFragmentAt(kind:ChaseStructureKind,index:number,age:number){
    const born=index%3,t=Math.max(0,age-born),metal=kind==='sluice'||kind==='gantry';
    const vx=-.9+(index*7%11)*.24,vy=-1.2-(index*3%5)*.29,g=.07;
    const land=(-vy+Math.sqrt(vy*vy+4*g*31))/(2*g),after=Math.max(0,t-land);
    const turn=(index*.73+t*(index%2?-.13:.1))*(1-ease(after/16));
    return {visible:age>=born,metal,landed:t>=land,
        x:vx*Math.min(t,land)+vx*6*ease(after/16),
        y:t<land?vy*t+g*t*t:31-(after<10?Math.sin(after/10*Math.PI)*1.8:0),turn};
}

export interface ChaseTerrace {x:number;y:number;width:number}
/** Footings retain their full original lengths, including piles that start in water. */
export function chaseTerraceFeet(p:ChaseTerrace){
    return [5,p.width-9].map(u=>({u,v:(CHASE_GAPS.some(([a,z])=>p.x+u>=a*16&&p.x+u<z*16)?CHASE_WATER_Y:CHASE_DECK_Y)-p.y}));
}
export function chaseTerraceFall(p:ChaseTerrace,age:number){
    const raw=(a:number)=>{const t=Math.max(0,a-3);return{drop:t*t*.06,turn:Math.min(.65,t*.018)};};
    let lo=3,hi=65;
    for(let i=0;i<16;i++){
        const m=(lo+hi)/2,q=raw(m);
        if(p.y+q.drop+p.width*Math.sin(q.turn)+7*Math.cos(q.turn)<CHASE_WATER_Y)lo=m;else hi=m;
    }
    const contact=(lo+hi)/2;
    const turn=raw(contact).turn;
    return {...raw(age),contact,contactX:p.width*Math.cos(turn)-7*Math.sin(turn),splashAge:age-contact};
}

/** Droplets return to the surface before the ring dissipates; there is no mid-air cutoff. */
export function chaseSplashAt(age:number,large=false){
    const flight=large?25:20,velocity=large?1.6:1.2;
    return {visible:age>=0&&age<38,dropVisible:age>=0&&age<flight,
        height:Math.max(0,velocity*age-velocity/flight*age*age),
        radius:2+Math.max(0,age)*(large?.72:.5),crown:age>=0&&age<9?Math.sin(age/9*Math.PI)*(large?5:3):0};
}

/** The bottom of the falling piece meets the water before its splash begins. */
export function chaseDebrisAt(age: number) {
    const fall = Math.max(0, age - 2), contact = 2 + (-.3 + Math.sqrt(.09 + 4 * .075 * (CHASE_WATER_Y - CHASE_DECK_Y - 5))) / .15;
    return { shift: fall * .14, drop: fall * fall * .075, tilt: Math.min(5, fall * .3), splashAge: age - contact };
}
