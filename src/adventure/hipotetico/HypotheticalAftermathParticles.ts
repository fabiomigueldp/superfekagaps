import {box,pixelLine,polygon} from '../WorldPainting';
import type {AftermathContact} from './HypotheticalAftermath';
import {drawScenicShadow} from './HypotheticalSceneShadow';

const FLOOR=-2;
const P={wood:'#9e9475',grain:'#7d826d',stone:'#92a18c',dark:'#657c73',metal:'#718b84',light:'#abb49a',dust:'#a8ae96'};

/** Analytic, seeded paths: rendering never changes the debris or the director's
 * random stream. Contact, first landing and the softer rebound share one clock. */
export function contactFragment(p:AftermathContact,j:number,age:number){
    let seed=(Math.imul(p.born+1,374761393)^Math.imul(Math.round(p.x)+j*29,668265263))>>>0;
    seed=Math.imul(seed^(seed>>>13),1274126177)>>>0;
    const r=(seed&65535)/65535,q=(seed>>>16)/65535,material=p.material??'stone';
    const g=material==='timber'?.075:material==='iron'?.085:.115;
    const force=Math.max(.2,Math.min(1.5,p.strength)),vx=(j-2)*(.2+force*.28)+(r-.5)*.32;
    const vy=-(.35+q*.65)*(.65+force),sourceY=Math.min(FLOOR,p.y??-12);
    const landing=(-vy+Math.sqrt(vy*vy+2*g*(FLOOR-sourceY)))/g;
    const bounce=(vy+g*landing)*(material==='stone'?.16:material==='iron'?.28:.21);
    const rebound=2*bounce/g,after=Math.max(0,age-landing),roll=Math.max(0,after-rebound);
    const slide=vx*(material==='iron'?.6:.42);
    const x=p.x+vx*Math.min(age,landing)+slide*Math.min(after,rebound)+slide*8*(1-Math.exp(-roll/8));
    const y=age<landing?sourceY+vy*age+g*age*age/2:after<rebound?FLOOR-bounce*after+g*after*after/2:FLOOR;
    const angle=(r-.5)*Math.PI+Math.min(age,landing+rebound)*(q-.5)*.32;
    return {x,y,angle,landing,rebound,end:76+Math.floor(q*12),size:material==='timber'?3+r*3:1+r*2};
}

export function fragmentLanding(p:AftermathContact){
    return Math.ceil(Math.min(...[0,1,2,3,4].map(j=>contactFragment(p,j,0).landing)));
}

function puff(c:CanvasRenderingContext2D,x:number,y:number,age:number,scale:number){
    if(age<0||age>=16)return;
    const w=(1-age/16)*scale;
    if(w<1)return;
    for(const dir of [-1,1])box(c,x+dir*(1+age*.23),y-age*.055,Math.max(1,w),1,P.dust);
}

export function drawAftermathContact(c:CanvasRenderingContext2D,p:AftermathContact,tick:number,base:number,reduced:boolean,pass:'all'|'fragments'|'effects'='all'){
    const age=tick-p.born;if(age<0)return;
    if(p.kind==='step'){
        if(!reduced&&pass!=='fragments')puff(c,p.x,base-3,age,3*p.strength+1);
        return;
    }
    const material=p.material??'stone',sourceY=base+(p.y??-12);
    if(age<7&&pass!=='fragments'){
        // A small, local chip instead of a ground cloud below a high contact.
        for(let j=0;j<(reduced?2:3);j++){
            const angle=-2.7+j*.9,r=2+age*.6;
            pixelLine(c,p.x+Math.cos(angle)*r,sourceY+Math.sin(angle)*r,
                p.x+Math.cos(angle)*(r+2),sourceY+Math.sin(angle)*(r+2),P.light);
        }
    }
    if(material!=='iron'&&age<18&&pass!=='fragments')puff(c,p.x,sourceY,age,2+p.strength*2);
    if(reduced||pass==='effects')return;
    for(let j=0;j<5;j++){
        const f=contactFragment(p,j,age);if(age>=f.end)continue;
        const x=f.x,y=base+f.y;
        if(material==='timber'){
            pixelLine(c,x,y,x+Math.cos(f.angle)*f.size,y+Math.sin(f.angle)*f.size,P.grain,2);
            pixelLine(c,x,y-1,x+Math.cos(f.angle)*f.size,y-1+Math.sin(f.angle)*f.size,P.wood);
        }else if(material==='stone'){
            polygon(c,[[x-1,y],[x,y-f.size],[x+f.size,y-1],[x+1,y+1]],P.dark);
            pixelLine(c,x,y-1,x+1,y-2,P.stone);
        }else{
            pixelLine(c,x,y,x+Math.cos(f.angle)*2,y+Math.sin(f.angle)*2,P.metal);
            box(c,x,y,1,1,P.light);
            if(age<9&&j%2===0)pixelLine(c,x,y,x-(j-2)*1.4,y+2,'#c5b58c');
        }
        if(j%2===0)puff(c,x,base-3,age-f.landing,(material==='iron'?1.5:2.5)*p.strength);
        if(age<f.landing)drawScenicShadow(c,x-1,base-1,2,1,.18);
    }
}
