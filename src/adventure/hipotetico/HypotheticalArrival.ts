import {smoothMotion} from './HypotheticalMotion';

/** The courtyard is readable before the first garrison is admitted. */
export const ARRIVAL={release:660,deployment:636,firstRelease:320,hold:400,watchX:280,
    lift:48,gateX:352,firstGateX:96,gateY:104,gateHeight:120} as const;
export function arrivalGate(tick:number,skipped=false,release:number=ARRIVAL.release){
    const travel=skipped?1:smoothMotion((tick-release)/ARRIVAL.lift);
    return {travel,height:Math.round(ARRIVAL.gateHeight*(1-travel)),ready:skipped||tick>=release};
}
/** Advance framing while crossing the courtyard, then return smoothly to normal gameplay. */
export const arrivalLookAhead=(tick:number,skipped=false)=>skipped?0:44*smoothMotion((tick-ARRIVAL.firstRelease)/80)*(1-smoothMotion((tick-ARRIVAL.release)/ARRIVAL.lift));
/** Roll-up doors reveal the garrison before the player can reach it. */
export const arrivalDeployment=(tick:number,skipped=false)=>skipped?1:smoothMotion((tick-ARRIVAL.deployment)/(ARRIVAL.release-ARRIVAL.deployment));
/** Hide the camera reset inside a short, continuous fade through the arch. */
export function arrivalFade(act:string,tick:number,exitTicks:number,skipped=false){
    if(act==='chase')return smoothMotion((exitTicks-44)/16);
    if(act==='siege'&&!skipped)return 1-smoothMotion(tick/16);
    return 0;
}
