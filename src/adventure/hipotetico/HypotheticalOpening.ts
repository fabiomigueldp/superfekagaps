import {smoothMotion} from './HypotheticalMotion';
import {box,oval,pixelLine} from '../WorldPainting';

/** A brief, non-graphic opening before the rifle's existing aim and volley. */
export const OPENING={notice:26,prepare:48,strike:58,contact:72,occluded:82,recover:90,join:110} as const;
export function arrivalOpeningAt(tick:number){
    const wind=smoothMotion((tick-OPENING.prepare)/10),drive=smoothMotion((tick-OPENING.strike)/14);
    const release=smoothMotion((tick-80)/10),active=tick>=OPENING.prepare&&tick<OPENING.recover;
    const force=active?wind*(1-release):0,hit=smoothMotion((tick-72)/3)*(1-smoothMotion((tick-77)/13));
    const pull=smoothMotion((tick-74)/9)*(1-release);
    const joinX=-80+230*smoothMotion(OPENING.join/136);
    const x=tick<48?-80+174*smoothMotion(tick/48):tick<58?94-6*wind:tick<72?88+44*drive
        :tick<80?132:tick<90?132-4*release:128+(joinX-128)*smoothMotion((tick-90)/20);
    return {x,wind:active?wind:0,drive:active?drive:0,active,force,
        jaw:.18+force*.84*(1-smoothMotion((tick-72)/5)),neckDrop:force*22-pull*7,
        compression:force*4+hit*2,brace:force*.75,tail:force*.14,
        riderDrop:force*5+hit*2,riderLean:force*(3-6*smoothMotion((tick-70)/6)),rein:force,
        phase:!active?'march':tick<58?'prepare':tick<72?'strike':tick<80?'contact':'recover'};
}

/** Dust, a dropped cap and paper give the contact weight without showing injury. */
export function drawOpeningAftermath(c:CanvasRenderingContext2D,tick:number,base:number,reduced:boolean){
    const age=tick-OPENING.contact;if(age<0)return;
    const t=Math.min(24,age),hatX=176+t*.3,hatY=Math.min(base-3,base-23-t*.55+t*t*.065);
    box(c,hatX,hatY,5,2,'#88675e');box(c,hatX-1,hatY+2,8,1,'#b7a187');
    if(age>=30)return;
    const u=age/30,envelope=Math.sin(Math.PI*u);
    for(let i=0;i<(reduced?3:7);i++){
        const spread=reduced?4:u*20,x=162+(i-3)*spread*.38,y=base-2-(reduced?1:Math.sin(u*Math.PI)*(3+i%3));
        oval(c,x,y,Math.max(2,(7-i%3)*envelope),reduced?2:3+i%2,i%2?'#a8a48b':'#c1b79a');
    }
    if(!reduced&&age<9){
        const spread=3+age*.8;pixelLine(c,168-spread,base-15-age*.2,164-spread,base-17-age*.3,'#d5c5a2');
        pixelLine(c,177+spread,base-11-age*.1,181+spread,base-12-age*.2,'#b6ad91');
    }
}
