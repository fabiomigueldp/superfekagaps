import { smoothMotion } from './HypotheticalMotion';
import {SIEGE_SECTORS,SIEGE_WIDTH} from './HypotheticalSiege';
import {arrivalOpeningAt,OPENING} from './HypotheticalOpening';

/** Authored contacts share a clock across scenery, rider, crowd and effects. */
export const DEVASTATION = { period:400, prepare:136, strike:166, impact:180, hold:185, recover:225, settle:120 } as const;
/** The opening gives the rifle, ram and aftermath separate beats before combat resumes. */
export const ARRIVAL_RAM={prepare:200,strike:228,impact:244,hold:254,recover:302} as const;
export const ARRIVAL_BITE={prepare:480,strike:508,impact:526,hold:536,recover:574} as const;
export const SCENIC_STARTS=[0,800,1200,1600] as const;
export const SCENIC_END=SCENIC_STARTS[SCENIC_STARTS.length-1]+DEVASTATION.period;
export const scenicDistrict=(tick:number)=>SCENIC_STARTS.reduce<number>((district,start,i)=>tick>=start?i:district,0);

/** A street enters only after Feka can see it. Later contacts also wait when
 * their target leaves the viewport, instead of silently creating offscreen ruins. */
export function nextScenicTick(tick:number,playerX:number,cleared:number){
    const next=Math.min(SCENIC_END,tick+1),district=scenicDistrict(next);
    // A quick player may leave a street before its performance finishes. Start
    // the visible street without replaying any skipped contacts off camera.
    let visible=0;
    for(let i=1;i<SIEGE_SECTORS.length;i++)if(cleared>=i&&playerX>=SIEGE_SECTORS[i].origin+96)visible=i;
    if(visible>scenicDistrict(tick))return SCENIC_STARTS[visible];
    if(district>0&&next===SCENIC_STARTS[district]
        &&(cleared<district||playerX<SIEGE_SECTORS[district].origin+96))return tick;
    // Suspend unseen contact, including a retry that starts behind this street.
    if(district>0&&next-SCENIC_STARTS[district]>=DEVASTATION.prepare&&next-SCENIC_STARTS[district]<DEVASTATION.recover){
        const center=DESTRUCTION_SITES[district+1].x+38;
        if(playerX<center-164||playerX>center+108)return tick;
    }
    return next;
}
export const DESTRUCTION_SITES = [
    { x:184, width:76, height:66, variant:0, kind:'ram',district:0 },
    { x:440, width:84, height:54, variant:1, kind:'bite',district:0 },
    { x:856, width:76, height:72, variant:1, kind:'bite',district:1 },
    { x:1272, width:76, height:78, variant:2, kind:'stamp',district:2 },
    { x:1688, width:76, height:84, variant:2, kind:'ram',district:3 },
] as const;

export function devastationAt(tick:number) {
    const district=scenicDistrict(tick),local=tick-SCENIC_STARTS[district];
    const plaza=district===0&&local>=360,siteIndex=district===0?(plaza?1:0):district+1;
    const site=DESTRUCTION_SITES[siteIndex],timing=district===0?(plaza?ARRIVAL_BITE:ARRIVAL_RAM):DEVASTATION;
    const wind=smoothMotion((local-timing.prepare)/(timing.strike-timing.prepare));
    const drive=smoothMotion((local-timing.strike)/(timing.impact-timing.strike));
    const release=smoothMotion((local-timing.hold)/(timing.recover-timing.hold));
    const active=local>=timing.prepare&&local<timing.recover;
    const force=active?wind*(1-release):0;
    let x=local<136?-80+230*smoothMotion(local/136)
        :local<timing.strike?150-12*wind:local<timing.impact?138+40*drive
        :local<timing.hold?178:local<timing.recover?178-10*release
        :district===0?168+192*smoothMotion((local-302)/98)
        :168+Math.min(175,local-225)*(district===SIEGE_SECTORS.length-1?SIEGE_WIDTH-SIEGE_SECTORS[district].origin+112-168:168)/175;
    if(plaza)x=local<=400?168+192*smoothMotion((local-302)/98):local<430?360+46*smoothMotion((local-400)/30)
        :local<timing.strike?406-12*wind:local<timing.impact?394+40*drive
        :local<timing.hold?434:local<timing.recover?434-10*release
        :424+168*smoothMotion((local-timing.recover)/(800-timing.recover));
    const stamp=site.kind==='stamp',bite=site.kind==='bite';
    const airborne=stamp&&local>=154&&local<180?Math.sin(Math.PI*(local-154)/26):0;
    const hit=local>=timing.impact&&local<timing.impact+28?smoothMotion((local-timing.impact+1)/3)*(1-smoothMotion((local-timing.impact-3)/25)):0;
    const lookAt=plaza?560:278,lookEnd=plaza?608:320;
    const lookBack=district===0?smoothMotion((local-lookAt)/16)*(1-smoothMotion((local-lookEnd)/18)):0;
    const motion={ district,siteIndex,local,kind:site.kind,active,impactTick:timing.impact,lookBack,wind:active?wind:0,drive:active?drive:0,force,
        x:SIEGE_SECTORS[district].origin+x, lift:airborne?-airborne*13:0,
        compression:stamp?force*3+hit*6:force*(bite?2:5)+(district===0?hit*2:0),
        jaw:bite?.15+force*(.85-.73*smoothMotion((local-timing.impact+4)/7)):.18+force*.45,
        neckDrop:bite?-force*9+smoothMotion((local-timing.impact+10)/14)*(1-release)*19:force*10,
        tuck:airborne*.62,brace:force*(stamp?.45:.7),tail:force*(bite?-.22:.18),
        riderDrop:force*5+airborne*8,riderLean:force*(4-7*smoothMotion((local-timing.impact+2)/8)),rein:force,
        phase:!active?'march':local<timing.strike?'prepare':local<timing.impact?'strike':local<timing.hold?'contact':'recover' };
    return district===0&&local<OPENING.join?{...motion,...arrivalOpeningAt(local)}:motion;
}

export function ruinAge(breaches:readonly number[],index:number,tick:number){
    const born=breaches[index];return born===undefined||born<0?-1:tick-born;
}

/** Center of a scenic fragment; the endpoint matches a 5px native stone spawned at x=mark-4,y=90. */
export function rubbleApproach(fromX:number,markX:number,age:number,backgroundFloor=216){
    const t=Math.max(0,Math.min(1,age/60));
    const start=backgroundFloor-35;
    return {x:fromX+(markX-1.5-fromX)*t,y:start+(92.5-start)*t-Math.sin(t*Math.PI)*30};
}
