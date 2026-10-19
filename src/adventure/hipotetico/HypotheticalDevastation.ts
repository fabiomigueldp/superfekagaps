import { smoothMotion } from './HypotheticalMotion';

/** One authored action per district. Scenery, rider and effects read this clock. */
export const DEVASTATION = { period:400, prepare:136, strike:166, impact:180, hold:185, recover:225, settle:120 } as const;
export const DESTRUCTION_SITES = [
    { x:184, width:76, height:66, variant:0, kind:'ram' },
    { x:600, width:76, height:72, variant:1, kind:'bite' },
    { x:1016, width:76, height:78, variant:2, kind:'stamp' },
] as const;

export function devastationAt(tick:number) {
    const district=Math.min(2,Math.floor(tick/DEVASTATION.period)),local=tick-district*DEVASTATION.period;
    const site=DESTRUCTION_SITES[district],wind=smoothMotion((local-DEVASTATION.prepare)/30);
    const drive=smoothMotion((local-DEVASTATION.strike)/14),release=smoothMotion((local-DEVASTATION.hold)/40);
    const active=local>=DEVASTATION.prepare&&local<DEVASTATION.recover;
    const force=active?wind*(1-release):0;
    const x=local<136?-80+230*smoothMotion(local/136)
        :local<166?150-12*wind:local<180?138+40*drive
        :local<185?178:local<225?178-10*release
        :168+(local-225)*168/175;
    const stamp=site.kind==='stamp',bite=site.kind==='bite';
    const airborne=stamp&&local>=154&&local<180?Math.sin(Math.PI*(local-154)/26):0;
    const hit=local>=180&&local<208?smoothMotion((local-179)/3)*(1-smoothMotion((local-183)/25)):0;
    return { district,local,kind:site.kind,active,wind:active?wind:0,drive:active?drive:0,force,
        x:district*416+x, lift:airborne?-airborne*13:0,
        compression:stamp?force*3+hit*6:force*(bite?2:5),
        jaw:bite?.15+force*(.85-.73*smoothMotion((local-176)/7)):.18+force*.45,
        neckDrop:bite?-force*9+smoothMotion((local-170)/14)*(1-release)*19:force*10,
        tuck:airborne*.62,brace:force*(stamp?.45:.7),tail:force*(bite?-.22:.18),
        riderDrop:force*5+airborne*8,riderLean:force*(4-7*smoothMotion((local-178)/8)),rein:force,
        phase:!active?'march':local<166?'prepare':local<180?'strike':local<185?'contact':'recover' };
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
