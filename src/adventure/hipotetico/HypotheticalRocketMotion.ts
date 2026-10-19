import {smoothMotion} from './HypotheticalMotion';

export interface ScenicRocket {
    x:number;y:number;fromX:number;fromY:number;dx:number;dy:number;
    age:number;remaining:number;speed:number;motorAge:number;
}

/** The casing emerges behind the loaded warhead. */
export const rocketTail=(age:number)=>8+5*smoothMotion(age/5);

/** Ignition is tied to clearance, not a frame number. Sound, flame and smoke
 * share this transition even when two scenic shots use different speeds. */
export function advanceRocketMotor(r:ScenicRocket,distance:number){
    if(r.motorAge>=0){r.motorAge++;return {ignited:false,burnDistance:distance};}
    const travelled=Math.hypot(r.x-r.fromX,r.y-r.fromY);
    const unlit=Math.max(0,rocketTail(r.age+1)+2-travelled);
    if(unlit>=distance)return {ignited:false,burnDistance:0};
    r.motorAge=1-unlit/distance;
    return {ignited:true,burnDistance:distance-unlit};
}
