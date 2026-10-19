import { CHASE_GAPS, CHASE_WIDTH } from './HypotheticalLayout';

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

/** Contact hold, two failing joints, then a detached beam and a bouncing load. */
export function chaseRuinAt(age: number,height=78) {
    const t = Math.max(0, age - 4), loadTime = Math.max(0, age - 9);
    const loadLand = Math.sqrt(31 / .09), after = Math.max(0, loadTime - loadLand);
    const beam=landedPiece(age,4,height,66,4,.055,.8,36);
    const panel=landedPiece(age,8,height-9,46,29,.07,.65,36);
    const leftTurn=ease(t/29)*1.45,rightTurn=ease((t-5)/33)*1.4;
    return {
        leftTurn,rightTurn,
        postDrop:Math.min(t*t*.035,22-3.5*Math.sin(leftTurn)),
        rightPostDrop:Math.min(Math.max(0,t-5)**2*.035,22-3.5*Math.sin(rightTurn)),
        beamX: beam.x,
        beamDrop: beam.drop,
        beamTurn: beam.turn,
        beamContact:beam.contact,
        groundAge:age-beam.contact,
        panelDrop:panel.drop,panelTurn:panel.turn,
        loadDrop: Math.min(31, loadTime * loadTime * .09) - (after < 12 ? Math.sin(after / 12 * Math.PI) * 2 : 0),
        dust: age > 8 && age < 60 ? Math.sin(unit((age - 8) / 52) * Math.PI) : 0,
    };
}

/** A detached rigid piece pivots on its first contact, bounces, then rests on the bank. */
function landedPiece(age:number,delay:number,height:number,length:number,depth:number,gravity:number,maxTurn:number,turnTime:number){
    const rotation=(t:number)=>ease(t/turnTime)*maxTurn;
    const reach=(t:number)=>gravity*t*t+length*Math.sin(rotation(t))+depth*Math.cos(rotation(t));
    let lo=0,hi=80;
    for(let i=0;i<18;i++){const m=(lo+hi)/2;if(reach(m)<height)lo=m;else hi=m;}
    const contact=(lo+hi)/2+delay,t=Math.max(0,age-delay),land=Math.max(0,age-contact);
    if(age<contact)return{x:t*.45,drop:t*t*gravity,turn:rotation(t),contact};
    const turn=rotation(contact-delay)*(1-ease(land/23))+.025*ease(land/23);
    const bounce=land<12?Math.sin(land/12*Math.PI)*2.1:0;
    return{x:(contact-delay)*.45+7*ease(land/28),drop:height-length*Math.sin(turn)-depth*Math.cos(turn)-bounce,turn,contact};
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
