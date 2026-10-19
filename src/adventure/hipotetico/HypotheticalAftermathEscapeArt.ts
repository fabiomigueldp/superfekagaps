import {box,pixelLine,polygon,type Point} from '../WorldPainting';
import type {HypotheticalBackdrop} from './HypotheticalBackdrop';
import {drawBystanders} from './HypotheticalBystanders';
import {ESCAPE_TIMINGS,type AftermathEscape,type EscapeEntry} from './HypotheticalAftermathEscape';
import {smoothMotion} from './HypotheticalMotion';

const P={ink:'#49676b',shade:'#617970',stone:'#91a18d',edge:'#bab59a',wood:'#978d72',grain:'#75816e',dust:'#b4b49c'};

function panel(c:CanvasRenderingContext2D,e:EscapeEntry,scene:AftermathEscape,base:number,reduced:boolean){
    const open=scene.opening(e),age=scene.tick-e.begunAt;
    const knock=e.begunAt>=0&&age<32&&!reduced?Math.sin(age*1.1)*Math.exp(-Math.abs(age-13)/10)*.6:0;
    const width=17*Math.cos(open*1.28),drop=Math.sin(open*1.28)*2;
    const at=(u:number,v:number):Point=>[e.from-9+u*width+knock*u,base-27+v+u*drop];
    const metal=scene.district===2,color=metal?'#7c9590':P.wood;
    polygon(c,[at(0,0),at(1,0),at(1,25),at(0,25)],P.ink);
    polygon(c,[at(.08,1),at(.92,1),at(.92,24),at(.08,24)],color);
    for(let j=0;j<4;j++)pixelLine(c,...at(.12,4+j*5),...at(.88,4+j*5),j%2?P.grain:P.edge);
    for(const y of [3,20]){pixelLine(c,...at(0,y),...at(.2,y),P.edge,2);const h=at(.08,y);box(c,...h,1,1,P.ink);}
    const handle=at(.75,13);box(c,handle[0]-1,handle[1],2,4,P.ink);box(c,handle[0],handle[1],1,2,P.edge);
}

/** These fixtures exist before the cue. A revealing door never spawns around
 * an already-visible person, and its opened panel remains after the event. */
export function drawEscapeFixtures(c:CanvasRenderingContext2D,s:AftermathEscape,base:number){
    const hatch=s.entries[1],x=hatch.from,y=base;
    box(c,x-13,y-31,27,30,P.shade);box(c,x-10,y-28,21,25,P.ink);
    box(c,x-9,y-27,18,22,'#3f5c62');pixelLine(c,x-12,y-31,x+13,y-31,P.edge,2);
    for(const side of [-1,1]){
        box(c,x+side*12,y-29,2,26,P.stone);
        for(let j=0;j<4;j++)box(c,x+side*12,y-25+j*6,2,1,P.grain);
    }
    box(c,x-14,y-4,29,3,P.shade);box(c,x-12,y-4,25,1,P.edge);
    // Drainage, masonry joins and a low threshold tie the service hatch to the street.
    pixelLine(c,x+15,y-25,x+15,y-5,P.grain);pixelLine(c,x+14,y-4,x+20,y-2,P.shade);
    box(c,x-5,y-30,9,2,P.grain);box(c,x-3,y-30,4,1,P.edge);
    const rubble=s.entries[0];
    box(c,rubble.from-8,y-13,17,10,P.ink);box(c,rubble.from-5,y-11,10,8,'#456266');
}

export function drawEscapeActors(c:CanvasRenderingContext2D,b:HypotheticalBackdrop,s:AftermathEscape,base:number,reduced:boolean){
    for(const e of s.entries){
        const age=s.tick-e.begunAt,t=ESCAPE_TIMINGS[e.kind];
        if(e.begunAt>=0&&age>=t.peek&&!e.person.escaped){
            const reveal=smoothMotion((age-t.peek)/20);
            // The shared gait, wardrobe, glance and fall remain at the same
            // world coordinates; only the lower doorway/stone lip occludes them.
            c.save();c.beginPath();
            c.rect(e.from-10,base-8-reveal*30,e.exit-e.from+22,12+reveal*30);c.clip();
            drawBystanders(c,b,base,reduced,false,[e.person],s.tick);c.restore();
        }
        if(e.kind==='hatch')panel(c,e,s,base,reduced);
        else{
            const shifted=s.opening(e)*3;
            polygon(c,[[e.from-12,base-7],[e.from-7,base-12],[e.from-2-shifted,base-9],[e.from+8+shifted,base-8],[e.from+13,base-2],[e.from-14,base-2]],P.shade);
            pixelLine(c,e.from-10,base-7,e.from-4-shifted,base-9,P.edge);
            pixelLine(c,e.from+5+shifted,base-7,e.from+11,base-3,P.stone,2);
        }
        for(const scar of e.marks){box(c,scar.x,base+scar.y,2,1,P.ink);box(c,scar.x-1,base+scar.y+1,2,1,P.stone);}
    }
}

export function drawEscapeDust(c:CanvasRenderingContext2D,s:AftermathEscape,base:number,reduced:boolean){
    for(const p of s.dust){
        const age=s.tick-p.born,dir=p.seed%2?1:-1;
        const t=Math.min(age,26),land=-3;
        const x=p.x+dir*t*(.2+p.seed%3*.08),y=Math.min(land,p.y-t*.3+t*t*.024);
        box(c,x,base+y,2,1,p.seed%2?P.stone:P.edge);
        if(!reduced&&age<32){
            const drift=age*.16;
            box(c,p.x+dir*drift,base+p.y-age*.12,Math.max(1,3-age/12),1,P.dust);
        }
    }
}
