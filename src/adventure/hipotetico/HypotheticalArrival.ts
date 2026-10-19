import {smoothMotion} from './HypotheticalMotion';

/** The courtyard is readable before the first garrison is admitted. */
export const ARRIVAL={release:270,lift:48,gateX:96,gateY:104,gateHeight:120} as const;
export function arrivalGate(tick:number,skipped=false){
    const travel=skipped?1:smoothMotion((tick-ARRIVAL.release)/ARRIVAL.lift);
    return {travel,height:Math.round(ARRIVAL.gateHeight*(1-travel)),ready:skipped||tick>=ARRIVAL.release};
}
/** Roll-up doors reveal the garrison before the player can reach it. */
export const arrivalDeployment=(tick:number,skipped=false)=>skipped?1:smoothMotion((tick-246)/24);
/** Hide the camera reset inside a short, continuous fade through the arch. */
export function arrivalFade(act:string,tick:number,exitTicks:number,skipped=false){
    if(act==='chase')return smoothMotion((exitTicks-44)/16);
    if(act==='siege'&&!skipped)return 1-smoothMotion(tick/16);
    return 0;
}
