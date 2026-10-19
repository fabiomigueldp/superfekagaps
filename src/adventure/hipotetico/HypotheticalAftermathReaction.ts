import {smoothMotion} from './HypotheticalMotion';
import type {YardIncidentKind} from './HypotheticalAftermathEnvironment';
import type {AftermathAction} from './HypotheticalAftermathScore';

const pulse=(age:number,start:number,rise:number,hold:number,end:number)=>
    smoothMotion((age-start)/rise)*(1-smoothMotion((age-hold)/(end-hold)));

export const reactionDuration=(kind:YardIncidentKind)=>kind==='leak'?78:kind==='settle'?68:kind==='creak'?64:58;

/** The animal notices first; the rider answers a little later. These curves
 * finish at rest before another walk or a committed strike can begin. */
export function aftermathReaction(kind:YardIncidentKind,age:number,duration:number,near:number){
    const attention=pulse(age,0,12,duration-20,duration);
    const inspect=pulse(age,18,18,duration-18,duration);
    const sharp=kind==='rattle'||kind==='leak';
    const flinch=sharp?pulse(age,3,7,13,32)*(.35+near*.65):0;
    const sniff=kind==='creak'||kind==='settle'?
        pulse(age,22,7,30,39)+pulse(age,40,6,47,58):0;
    const exhale=kind==='leak'?pulse(age,29,5,39,54):0;
    const downward=kind==='settle'?18:kind==='creak'?13:kind==='leak'?7:3;
    return {attention,inspect,flinch,sniff,exhale,
        bow:inspect*(kind==='settle'?.32:.2)-flinch*.12,
        neckDrop:inspect*downward+sniff*2-flinch*9-exhale*3,
        jaw:.06*attention+exhale*.34,
        tail:-flinch*.12+sniff*.025,
        brace:Math.max(flinch*.65,attention*.2),
        eyeClose:Math.max(flinch*.85,exhale*.65,sniff*.2),
        lean:-flinch*5+inspect*1.8-exhale*1.5,
    };
}

/** A reply is tied to the object that made the sound, with alternatives if
 * that action was recent or the material cannot currently be reached. */
export function reactionReplies(kind:YardIncidentKind):readonly AftermathAction[]{
    if(kind==='creak')return ['shake','haul','ram'];
    if(kind==='settle')return ['sift','rake','stomp'];
    if(kind==='rattle')return ['wrench','breach','tail'];
    if(kind==='leak')return ['wrench','breach','fire'];
    return [];
}
