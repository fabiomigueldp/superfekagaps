import {box,oval,pixelLine,polygon} from '../WorldPainting';
import {smoothMotion} from './HypotheticalMotion';
import {AFTERMATH_PROPS} from './HypotheticalAftermathScore';
import type {AftermathEnvironment,YardIncident} from './HypotheticalAftermathEnvironment';

const P={ink:'#526f72',dark:'#6b8279',metal:'#80968c',light:'#b5b69b',wood:'#a49c7e',rust:'#958a72',dust:'#a9b39c',water:'#86a99e'};
const swell=(a:number,start:number,end:number)=>a<0||a>end?0:Math.sin(Math.PI*Math.min(1,a/(end-start)));

/** Small fittings connect the service piles to the street: a tied cloth,
 * cracked drainage and anchored chains. No bright gameplay-coloured lamps. */
export function drawAftermathFittings(c:CanvasRenderingContext2D,origin:number,base:number,e:AftermathEnvironment,tick:number,reduced:boolean){
    const windAge=tick-e.windAt,wind=reduced?0:swell(windAge,0,190)*2.8;
    const x=origin+AFTERMATH_PROPS[0].offset-24;
    box(c,x,base-31,2,31,P.dark);box(c,x,base-30,1,28,P.wood);
    pixelLine(c,x-3,base-30,x+18,base-30,P.dark,2);
    for(const dx of [1,12])pixelLine(c,x+dx,base-29,x+dx,base-25,P.rust);
    const cloth=(reduced?0:Math.sin(tick/37)*.6)+wind*Math.sin(tick/7);
    polygon(c,[[x+1,base-26],[x+14,base-26],[x+14+cloth,base-16],[x+10,base-18],[x+7,base-15],[x+1+cloth*.4,base-17]],'#8c9380');
    pixelLine(c,x+2,base-25,x+13,base-25,P.light);
    pixelLine(c,x+4,base-23,x+11+cloth*.4,base-22,'#a6a58c');
    pixelLine(c,x+5,base-21,x+8+cloth*.5,base-21,P.dark);
    box(c,x-2,base-3,6,3,P.dark);box(c,x-1,base-3,4,1,P.light);

    const stone=origin+AFTERMATH_PROPS[1].offset;
    pixelLine(c,stone-24,base-1,stone+27,base-1,P.dark);
    for(let j=0;j<5;j++){
        const xx=stone-22+j*10;
        pixelLine(c,xx,base,xx+6,base,P.metal);box(c,xx+7,base-1,1,2,P.ink);
    }
    // A grass tuft bends from its root; cracks and damp seams remain grounded.
    for(let j=0;j<3;j++)pixelLine(c,stone+21+j,base-3,stone+20+j*3+wind*.4,base-7-j%2*2,'#7e927c');

    const iron=origin+AFTERMATH_PROPS[2].offset;
    const rattle=[...e.incidents].reverse().find(a=>a.kind==='rattle');
    const age=rattle?tick-rattle.born:1000;
    const swing=reduced?0:age<110?Math.sin(age*.24)*Math.exp(-age/34)*4:wind*.2;
    box(c,iron+15,base-36,4,4,P.dark);box(c,iron+16,base-35,2,1,P.light);
    for(let j=0;j<6;j++){
        const xx=iron+17+swing*j/6,yy=base-31+j*3;
        pixelLine(c,xx,yy,xx+1,yy+2,j%2?P.metal:P.light);
        box(c,xx+1,yy+1,1,1,P.ink);
    }
    oval(c,iron+15+swing,base-14,5,5,P.dark);box(c,iron+17+swing,base-13,1,2,P.light);

    if(e.district===1||e.district===2){
        // The leak comes from this flange, not from an unanchored particle emitter.
        pixelLine(c,iron+24,base-28,iron+24,base-8,P.dark,4);
        pixelLine(c,iron+24,base-28,iron+24,base-9,P.metal,2);
        pixelLine(c,iron+24,base-28,iron+19,base-28,P.metal,3);
        box(c,iron+21,base-22,6,3,P.dark);box(c,iron+22,base-22,4,1,P.light);
        box(c,iron+26,base-21,2,1,P.rust);box(c,iron+23,base-8,4,2,P.dark);
        if(e.wet>0){
            for(let j=0;j<3;j++)box(c,iron+27-j,base-20+j*6,1,4,'#6f9185');
            oval(c,iron+15,base-2,12+e.wet*12,3,'#6d928b');
            pixelLine(c,iron+20,base-1,iron+28+e.wet*5,base-1,P.water);
        }
    }
}

function grit(c:CanvasRenderingContext2D,x:number,base:number,age:number,e:YardIncident,reduced:boolean){
    for(let j=0;j<(reduced?2:5);j++){
        const t=age-j*5;if(t<0||t>58)continue;
        const dir=(j%2?1:-1),xx=x+dir*(j*2+t*.24),yy=base-3-Math.max(0,t*.65-t*t*.023);
        box(c,xx,yy,j%2+1,1,e.kind==='creak'?P.wood:P.metal);
        if(t<34&&!reduced)box(c,xx-dir*3,base-5-t*.08,3,1,P.dust);
    }
}

/** Events are short and localized, with slower debris and cloth following
 * the first sound. Reduced motion keeps fittings and wear but omits gusts. */
export function drawAftermathIncidents(c:CanvasRenderingContext2D,origin:number,base:number,e:AftermathEnvironment,tick:number,reduced:boolean){
    for(const event of e.incidents){
        const age=tick-event.born,x=origin+AFTERMATH_PROPS[event.prop].offset;
        if(event.kind==='draft'){
            if(reduced)continue;
            // Low dust crosses the paving; a few leaves lift, arc, then land.
            for(let j=0;j<6;j++){
                const t=age-j*13;if(t<0||t>130)continue;
                const xx=x-26+t*.56,yy=base-3-Math.sin(Math.PI*t/130)*(4+j%3*3);
                pixelLine(c,xx,yy,xx+2+Math.round(Math.sin(t*.14)),yy+j%2,j%2?P.wood:P.dark);
                if(j<3&&t<70)box(c,xx-4,base-4,4,1,P.dust);
            }
        }else if(event.kind==='leak'){
            if(reduced){if(age<65)box(c,x+27,base-20,1,3,P.water);continue;}
            const pressure=1-smoothMotion((age-55)/75),sourceX=x+27,sourceY=base-20;
            for(let j=0;j<14;j++){
                const t=age-j*7;if(t<0||t>30||j*7>100)continue;
                const xx=sourceX+Math.min(t,20)*(.2+pressure*.1),yy=sourceY+t*t*.047;
                if(yy<base-2){pixelLine(c,xx,yy,xx+1,yy+1,P.water);box(c,xx,yy,1,1,P.light);}
                else if(t<28){const spread=(t-20)*.6;pixelLine(c,sourceX+5-spread,base-2,sourceX+6+spread,base-2,P.water);}
            }
            if(e.district===2)for(let j=0;j<4;j++){
                const t=age-j*16;if(t<0||t>60)continue;
                const xx=sourceX+t*.16,yy=sourceY-t*.24;
                box(c,xx,yy,Math.max(1,5-t/15),2,P.dust);box(c,xx+1,yy-1,2,1,P.metal);
            }
        }else if(event.kind==='rattle'){
            if(age<52)grit(c,x,base,age,event,reduced);
        }else grit(c,x,base,age,event,reduced);
    }
}
