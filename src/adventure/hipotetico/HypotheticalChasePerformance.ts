import {CHASE_BREAKS} from './HypotheticalLayout';

export type ChaseStructureKind=(typeof CHASE_BREAKS)[number]['kind'];
export type ChaseSound='chase-step'|'chase-wood'|'chase-metal'|'chase-cable';
export interface ChaseGesture {armSwing:number;armFold:number;reinSag:number;reinFlutter:number}
export const CHASE_STRIKE_REACH=56;
export const CHASE_FIRST_SUPPORT=-23;
/** A site is centered on its assembly; the skull meets its first upright. */
export const chaseStrikeX=(site:{x:number})=>site.x+CHASE_FIRST_SUPPORT;
const unit=(n:number)=>Math.max(0,Math.min(1,n));
const ease=(n:number)=>{const t=unit(n);return t*t*(3-2*t);};
const pulse=(age:number,start:number,peak:number,end:number)=>age<start||age>=end?0:
    age<peak?ease((age-start)/(peak-start)):1-ease((age-peak)/(end-peak));

/** Material-specific order of failure. The same score drives geometry and sound. */
export function chaseStructureTiming(kind:ChaseStructureKind){
    return kind==='pier'?{left:3,right:8,beam:5,panel:8,release:10,gravity:.072,turn:.92,turnTime:30}:
        kind==='crane'?{left:4,right:11,beam:8,panel:8,release:13,gravity:.055,turn:.8,turnTime:36}:
        kind==='sluice'?{left:6,right:13,beam:9,panel:4,release:8,gravity:.05,turn:.55,turnTime:33}:
        {left:7,right:15,beam:11,panel:8,release:16,gravity:.06,turn:.64,turnTime:38};
}

interface Pursuer {x:number;tick:number;travel:number;velocity:number;motionSpeed:number;chaseBreaks:readonly number[];course?:{gaitWeight:number};counters?:{reaction(tick:number):{age:number;weight:number}}}

/** Anticipation is measured to the actual fracture threshold, not to the camera.
 * Contact releases through the neck first, then the rider and the distal tail. */
export function chasePerformance(b:Pursuer,reduced=false){
    const moving=unit(Math.abs(b.motionSpeed)/3)*(b.course?.gaitWeight??1),phase=b.travel/11;
    let prepare=0,hit=0,follow=0,settle=0,framing=0,age=-1,kind:ChaseStructureKind='pier',site=-1;
    for(const [i,s]of CHASE_BREAKS.entries()){
        const at=b.chaseBreaks[i];
        if(at===-1){
            const distance=chaseStrikeX(s)-CHASE_STRIKE_REACH-b.x;
            if(distance>=0&&distance<54&&b.velocity>0){
                prepare=ease(1-distance/54);framing=prepare*18;kind=s.kind;site=i;break;
            }
        }else if(at>=0){
            const elapsed=b.tick-at,score=chaseStructureTiming(s.kind);
            if(elapsed>=0&&elapsed<score.release+40){
                age=elapsed;kind=s.kind;site=i;break;
            }
        }
    }
    const score=chaseStructureTiming(kind);
    const strength=kind==='gantry'?1.2:kind==='sluice'?1.12:kind==='crane'?1:.86;
    const resistance=kind==='gantry'?.19:kind==='sluice'?.16:kind==='crane'?.13:.1;
    if(age>=0){
        // Compression peaks as the first socket fails; the neck releases only
        // after the beam starts moving. Metal resists longer than a timber pier.
        prepare=1-ease(age/(score.left+7));
        hit=pulse(age,0,score.left,score.beam+12);
        follow=pulse(age,score.left,score.beam+7,score.release+23);
        settle=pulse(age,score.release+2,score.release+12,score.release+36);
        framing=18*(1-ease((age-score.beam-9)/32));
    }
    const riderCatch=pulse(age,score.left+1,score.beam+5,score.release+25);
    const tailRelease=pulse(age,score.beam+4,score.release+12,score.release+33);
    const tailSettle=pulse(age,score.release+13,score.release+23,score.release+40);
    // Two weight transfers per complete stride. Feet retain their world-locked
    // gait; the ribcage and seated hips absorb the landing above them.
    const weight=reduced?0:(1-Math.cos(phase*2))*.7*moving;
    const counterAge=b.counters?.reaction(b.tick).age??Infinity;
    const counterHit=pulse(counterAge,0,4,19),counterFollow=pulse(counterAge,3,10,38);
    const effort=(prepare*1.4+hit*2.1-follow*.8)*strength+counterHit*4;
    const tension=unit(prepare*.8+hit*.9+counterHit);
    const gesture:ChaseGesture={
        armSwing:reduced?0:Math.sin(phase-.45)*.16*moving*(1-prepare*.75),
        armFold:unit(prepare*.55+hit*.8+follow*.2+counterHit*.8),
        reinSag:(2.7+(reduced?0:Math.sin(phase-.4)*.35*moving))*(1-tension),
        reinFlutter:reduced?0:Math.sin(phase*2-.8)*.5*moving*(1-tension),
    };
    const tail=-prepare*.025+follow*.085*strength-settle*.05+counterFollow*.065
        +(reduced?0:Math.sin(phase-1.1)*.028*moving);
    return {site,kind,prepare,hit,follow,settle,framing,counterHit,
        gesture,
        // A short loss of momentum reads as resistance. The restrained recovery
        // keeps the existing pursuit-distance controller in charge of pressure.
        driveScale:1-hit*resistance+follow*resistance*.4,
        compression:weight+effort,
        neckDrop:(prepare*3.8+hit*4.6-follow*3)*strength-counterHit*5+(reduced?0:Math.sin(phase*2-.6)*.65*moving),
        headPitch:(prepare*.085-hit*.11+follow*.065)*strength-counterHit*.12+counterFollow*.06+(reduced?0:Math.sin(phase-.5)*.016*moving),
        jawHinge:.065+prepare*.07+follow*.05+counterHit*.13,
        riderDrop:prepare*1.8+riderCatch*2.7*strength-settle*.9+counterFollow*2+(reduced?0:Math.sin(phase*2-.8)*.5*moving),
        riderLean:prepare*1.8-hit*2.7+riderCatch*1.8-settle*.7-counterFollow*4.5,
        headTilt:(hit*.055-riderCatch*.075+settle*.025)*strength,
        tail,
        tailTip:-prepare*.035+tailRelease*.13*strength-tailSettle*.075+counterFollow*.09
            +(reduced?0:Math.sin(phase-1.7)*.038*moving),
        cloth:prepare*.5+riderCatch*2.2-settle*.5+counterFollow*1.8,
    };
}
