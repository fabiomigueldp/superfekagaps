import {smoothMotion} from './HypotheticalMotion';
import type {Point} from '../WorldPainting';

export type PlantedFeet=readonly [Point,Point];

/** Reposition one foot at a time before effort, plant during the body pull,
 * then release the stance. Root movement is cancelled at the sole, not hip. */
export function aftermathFooting(age:number,duration:number,rootOffset:number,from:PlantedFeet,pulling=false):PlantedFeet {
    const foot=(rear:boolean):Point=>{
        const i=rear?0:1,start=rear?2:13,finish=rear?duration-26:duration-15;
        const into=Math.max(0,Math.min(1,(age-start)/12));
        const out=Math.max(0,Math.min(1,(age-finish)/12));
        // Set back beneath the hips before a long pull; otherwise the forward
        // hock would have to stretch beyond its two fixed limb lengths.
        const stance=pulling?(rear?-17:-3):(rear?-8:12),initial=from[i];
        const x=(initial[0]+(stance-initial[0])*smoothMotion(into))*(1-smoothMotion(out));
        const y=initial[1]*(1-smoothMotion(into))-Math.sin(into*Math.PI)*3-Math.sin(out*Math.PI)*2;
        return [x+rootOffset,y];
    };
    return [foot(true),foot(false)];
}
