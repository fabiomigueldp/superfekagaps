import { box, oval, pixelLine, polygon } from '../WorldPainting';
import { smoothMotion } from './HypotheticalMotion';
import { AFTERMATH_YARDS, type HypotheticalAftermath, type AftermathYard } from './HypotheticalAftermath';
import { drawBystanders } from './HypotheticalBystanders';
import type { HypotheticalBackdrop } from './HypotheticalBackdrop';
import {AFTERMATH_PROPS} from './HypotheticalAftermathScore';
import {drawGunTracer,drawGunImpact} from './HypotheticalGunfire';
import {shutterHandle} from './HypotheticalAftermathHandling';
import {drawDebrisPiece} from './HypotheticalDebrisArt';
import {drawAftermathFittings,drawAftermathIncidents} from './HypotheticalAftermathEnvironmentArt';
import {drawAftermathContact} from './HypotheticalAftermathParticles';
import {drawAftermathFlock} from './HypotheticalAftermathFlockArt';
import {drawEscapeFixtures,drawEscapeActors,drawEscapeDust} from './HypotheticalAftermathEscapeArt';
import {drawForageCover,drawForageRemains} from './HypotheticalAftermathForageArt';
import {drawScenicShadow} from './HypotheticalSceneShadow';

// Rear-street colours stay below the contrast of guards, bullets and playable ledges.
const P={ink:'#516d70',dark:'#657c73',stone:'#92a18c',edge:'#c1b99a',wood:'#9e9475',grain:'#7d826d',
    light:'#b7aa87',metal:'#718b84',shine:'#abb49a',dust:'#a8ae96',bird:'#c4c4ab',wing:'#839b91'};
const progress=(tick:number,born:number,time:number)=>born<0?0:smoothMotion((tick-born)/time);

/** Survivable debris and anchored hardware: repeated blows dent and shake
 * them, while the initial demolition and escaped residents remain permanent. */
function secondaryProp(c:CanvasRenderingContext2D,x:number,y:number,index:number,s:AftermathYard['props'][number],tick:number,reduced:boolean){
    const age=s.struckAt<0?100:tick-s.struckAt,shake=reduced||age>28?0:Math.sin(age*1.7)*(1-age/28)*s.force*2;
    drawScenicShadow(c,x-16,y-3,34,4);
    if(s.handledAt>=0&&index<2){
        // Scuffed ground remains visible when the loose component is moved.
        pixelLine(c,x-11,y-2,x+13,y-2,P.grain);
        for(let j=0;j<4;j++)box(c,x-10+j*6,y-1-j%2,3,1,j%2?P.light:P.stone);
    }
    if(index===0){
        for(let i=0;i<3;i++){
            const yy=y-6-i*4,slip=s.wear*(i%2?1:-1);
            pixelLine(c,x-14+slip,yy+shake,x+14+slip,yy-3+shake,P.grain,4);
            pixelLine(c,x-12+slip,yy-1+shake,x+13+slip,yy-3+shake,P.light);
            box(c,x-8+slip,yy-2+shake,2,1,P.dark);
            pixelLine(c,x-2+slip,yy-1+shake,x+3+slip,yy-2+shake,P.grain);
            box(c,x+10+slip,yy-2+shake,1,2,P.dark);
        }
        pixelLine(c,x-9,y-19,x-8-s.wear*2,y-3,P.ink);pixelLine(c,x+9,y-19,x+9+s.wear*2,y-3,P.metal);
    }else if(index===1){
        for(let i=0;i<5;i++){
            if(i===1)continue; // This wedge is a loose, individually handled stone.
            const xx=x-16+i*7,yy=y-5-i%2*6;
            polygon(c,[[xx,yy],[xx+3,yy-5],[xx+10,yy-4],[xx+12,yy+3],[xx+1,yy+4]],i%2?P.metal:P.stone);
            pixelLine(c,xx+3,yy-4,xx+8,yy-3,P.edge);box(c,xx+7,yy+1,3,1,P.dark);
        }
        for(let i=0;i<s.wear;i++)pixelLine(c,x-10+i*8,y-6,x-6+i*8,y-3,P.ink);
    }else{
        // Bolted, already battered service shutter. It bends on its hinges;
        // no intact new target pops into place after the previous burst.
        for(const d of [-1,1]){box(c,x+d*12,y-37,3,36,P.dark);box(c,x+d*12+1,y-36,1,32,P.shine);}
        box(c,x-14,y-39,31,3,P.metal);box(c,x-13,y-39,29,1,P.edge);
        // A top hinge stays fixed. Pulling the lower handle swings the panel
        // out of its frame, revealing a dark service recess and real braces.
        box(c,x-10,y-35,22,31,P.ink);
        box(c,x-7,y-32,16,23,'#45666b');pixelLine(c,x-7,y-10,x+8,y-29,P.dark,2);
        pixelLine(c,x+6,y-31,x+6,y-12,P.metal,2);pixelLine(c,x+7,y-31,x+7,y-13,P.shine);
        box(c,x-6,y-28,7,9,P.dark);box(c,x-5,y-27,5,3,P.grain);box(c,x-4,y-26,2,1,P.light);
        const dx=-s.hingeFacing*Math.sin(s.hinge)*22,dy=Math.cos(s.hinge)*30;
        const at=(xx:number,t:number):[number,number]=>[x+xx+dx*t+shake*t,y-35+dy*t];
        polygon(c,[at(-10,0),at(12,0),at(12,1),at(-10,1)],P.dark);
        polygon(c,[at(-9,.03),at(11,.03),at(11,.97),at(-9,.97)],P.metal);
        for(let j=0;j<6;j++){
            const bend=j===2||j===3?s.wear:0;
            const u=at(-8,(3+j*4)/30),v=at(9,(3+j*4+bend)/30);
            pixelLine(c,u[0],u[1],v[0],v[1],P.shine);
        }
        for(let j=0;j<s.wear;j++){
            const u=at(-5+j*4,(5+j*7)/30);box(c,u[0],u[1],2,2,P.ink);pixelLine(c,u[0]+1,u[1]+2,u[0]+4,u[1]+3,P.dark);
        }
        for(const hx of [-7,7]){box(c,x+hx,y-38,3,5,P.dark);box(c,x+hx,y-37,2,1,P.shine);}
        const handle=shutterHandle(s);
        // y is three pixels above the street baseline used by the shared grip.
        pixelLine(c,x+handle.x-4,y+3+handle.y,x+handle.x+4,y+3+handle.y,P.ink,2);
        pixelLine(c,x+handle.x-3,y+2+handle.y,x+handle.x+3,y+2+handle.y,P.edge);
        pixelLine(c,x-10,y-7,x-10+dx*.85,y-35+dy*.85,P.dark);
        box(c,x-14,y-3,31,3,P.dark);
    }
    // Shot scars sit on the same material surface, including the hinged panel.
    for(const [j,scar] of s.scars.entries()){
        const t=(scar.y+38)/30,xx=x+scar.x+(index===2?-s.hingeFacing*Math.sin(s.hinge)*22*t:0);
        const yy=index===2?y-35+Math.cos(s.hinge)*30*t:y+3+scar.y;
        box(c,xx,yy,1+(j%3===0?1:0),1,P.ink);
        if(j%2===0)pixelLine(c,xx-1,yy+1,xx+2,yy+1,index===0?P.wood:P.shine);
    }
    if(s.piece&&!s.piece.held){
        const p=s.piece,material=index===0?'timber':'stone';
        // Released pieces keep their pile's depth while airborne and at rest.
        // Only a held piece is transferred to the dinosaur's mouth layer.
        drawDebrisPiece(c,x+p.x,y+3+p.y,{material,angle:p.angle,wear:s.wear});
    }
}

function refuge(c:CanvasRenderingContext2D,x:number,y:number,district:number){
    // The bastion uses an existing arcade bay; the other streets have a service recess.
    const cx=x+(district===3?338:354),w=district===3?23:30,top=y-(district===3?31:43);
    if(district!==3){
        box(c,cx-w/2-5,top-3,w+10,y-top+2,P.dark);
        box(c,cx-w/2-4,top-2,w+8,3,P.edge);
        for(let row=0;row<4;row++)box(c,cx-w/2-4,top+8+row*8,w+8,1,P.metal);
    }
    polygon(c,[[cx-w/2,top+7],[cx-w/2+5,top+2],[cx+w/2-5,top+2],[cx+w/2,top+7],
        [cx+w/2,y-3],[cx-w/2,y-3]],P.ink);
    box(c,cx-w/2+3,top+10,w-6,y-top-13,'#47676d');
    pixelLine(c,cx-w/2,top+9,cx-w/2,y-4,P.shine,2);
    pixelLine(c,cx+w/2,top+9,cx+w/2,y-4,P.dark,2);
    box(c,cx-w/2-3,y-4,w+6,3,P.edge);box(c,cx-w/2-4,y-1,w+8,2,P.dark);
    box(c,cx-4,top-1,9,3,P.grain);box(c,cx-2,top,5,1,P.light);
    if(district!==3){
        // Eave tiles, a hinge and drainage stain connect the recess to the masonry.
        for(let i=0;i<6;i++)box(c,cx-w/2-4+i*7,top-3,5,1,P.light);
        box(c,cx+w/2-3,top+15,2,4,P.shine);box(c,cx+w/2+2,y-10,2,6,P.dark);
    }
    if(district===0){
        // A folded shutter and a lamp belong to the courtyard, with an open passage between.
        box(c,cx+w/2+3,top+9,8,y-top-14,P.grain);
        for(let j=0;j<4;j++)box(c,cx+w/2+4,top+11+j*6,6,1,P.light);
        pixelLine(c,cx-21,top+6,cx-26,top+6,P.dark);box(c,cx-29,top+7,6,9,P.dark);
        box(c,cx-28,top+9,4,4,'#b9ad86');box(c,cx-27,top+10,2,2,'#d0c19b');
    }else if(district===1){
        const rx=cx+24;
        oval(c,rx-6,y-16,13,13,P.dark);oval(c,rx-4,y-14,9,9,P.light);oval(c,rx-2,y-12,5,5,P.grain);
        pixelLine(c,rx+5,y-9,rx+8,y-4,P.light);box(c,rx+7,y-4,5,1,P.grain);
        pixelLine(c,cx-21,top+1,cx+21,top+1,P.metal,3);
        for(const dx of [-20,20])pixelLine(c,cx+dx,top+2,cx+dx*.7,top+8,P.dark);
    }else if(district===2){
        box(c,cx-25,top+10,7,16,P.metal);box(c,cx-24,top+11,5,2,P.shine);
        for(let j=0;j<3;j++)box(c,cx-24,top+15+j*3,4,1,P.ink);
        pixelLine(c,cx-22,top+26,cx-22,y-3,P.dark,2);
        for(const dx of [-5,2,9])box(c,cx+dx,top+7,1,5,P.metal);
    }
}

function timber(c:CanvasRenderingContext2D,x:number,y:number,s:AftermathYard,tick:number){
    const nudge=progress(tick,s.shiftedAt,44),split=progress(tick,s.brokenAt,30);
    drawScenicShadow(c,x-23,y-3,50,5);
    for(let j=0;j<4;j++){
        if(j===3&&s.shiftedAt>=0)continue; // This beam is pulled free and drawn across the jaw below.
        const yy=y-5-j*6*(1-split*.7),left=x-17-j%2*4+nudge*(j-1)*2,slide=(j-1.5)*split*5;
        pixelLine(c,left+slide,yy,x+20+slide,yy-3+split*(j%2?3:-3),P.dark,5);
        pixelLine(c,left+slide,yy-1,x+19+slide,yy-4+split*(j%2?3:-3),P.wood,3);
        pixelLine(c,left+4+slide,yy-2,x+14+slide,yy-4+split*(j%2?3:-3),P.light);
        box(c,left+3+slide,yy-1,2,2,P.grain);box(c,x+10+slide,yy-3,1,2,P.ink);
    }
    const end=split*17;
    pixelLine(c,x-9,y-25+split*15,x-7-end,y-4,P.ink,2);
    pixelLine(c,x+11,y-24+split*15,x+13+end,y-4,P.metal,2);
}

function cargo(c:CanvasRenderingContext2D,x:number,y:number,s:AftermathYard,tick:number){
    const nudge=progress(tick,s.shiftedAt,50),split=progress(tick,s.brokenAt,38);
    drawScenicShadow(c,x-22,y-3,49,5);
    for(let j=0;j<3;j++){
        const xx=x-21+j*15+(j-1)*split*8,yy=y-21+(j%2?-7:0)*(1-split)+split*8;
        box(c,xx,yy,15,18*(1-split*.48),P.grain);box(c,xx+1,yy+1,13,15*(1-split*.48),P.wood);
        for(let k=0;k<3;k++)box(c,xx+2,yy+3+k*4,10,1,P.light);
        pixelLine(c,xx+1,yy+2,xx+12,yy+14*(1-split*.48),P.dark,2);
        box(c,xx+1,yy,13,1,P.edge);box(c,xx+2,yy+1,1,1,P.ink);box(c,xx+11,yy+1,1,1,P.ink);
        const age=s.brokenAt<0?0:tick-s.brokenAt,hop=Math.sin(Math.PI*Math.min(1,age/32))*12;
        if(j!==1||s.shiftedAt<0)pixelLine(c,xx-1-split*4,yy-2-nudge*(j%2?4:0)-hop,xx+15+split*5,yy-2+split*7-hop,P.light,2);
    }
    pixelLine(c,x-17,y-23+split*17,x-3,y-26+split*20,P.dark);
    pixelLine(c,x-3,y-26+split*20,x+21,y-22+split*20,P.dark);
}

function vent(c:CanvasRenderingContext2D,x:number,y:number,s:AftermathYard,tick:number,reduced:boolean){
    const nudge=progress(tick,s.shiftedAt,48),split=progress(tick,s.brokenAt,32);
    box(c,x-22,y-5,48,5,P.dark);box(c,x-20,y-6,44,2,P.shine);
    box(c,x-14,y-24,28,18,P.ink);box(c,x-12,y-24,24,18,P.metal);
    box(c,x-10,y-23,3,17,P.shine);box(c,x+8,y-23,3,17,P.dark);
    for(let j=0;j<3;j++)box(c,x-4,y-20+j*4,9,2,P.ink);
    const age=s.brokenAt<0?0:tick-s.brokenAt,hop=Math.sin(Math.PI*Math.min(1,age/36))*15;
    const capX=x+split*25,capY=y-27+split*22-hop;
    polygon(c,[[capX-17,capY+nudge*2],[capX-13,capY-5],[capX+12,capY-5],[capX+17,capY-1],
        [capX+16,capY+3],[capX-16,capY+3]],P.ink);
    pixelLine(c,capX-14,capY-2,capX+13,capY-2+nudge*3,P.shine,2);
    for(const dx of [-9,10])box(c,x+dx,y-8,2,2,P.edge);
    if(split>.05){
        box(c,x-10,y-25,20,3,'#49686b');pixelLine(c,x-11,y-25,x+11,y-25,P.edge);
        if(!reduced)for(let j=0;j<4;j++){
            const life=(age+j*17)%76,burst=Math.max(.2,1-age/160),w=4+life*.07;
            const px=x-5+Math.sin(life*.08+j)*2+life*.12,py=y-28-life*.25;
            if(life<58){box(c,px,py,w*(1-life/76),2,burst>.5?'#b6baa3':'#9eae9e');box(c,px+2,py-2,3,1,P.shine);}
        }
    }
}

function masonry(c:CanvasRenderingContext2D,x:number,y:number,s:AftermathYard,tick:number,reduced:boolean){
    const nudge=progress(tick,s.shiftedAt,50),split=progress(tick,s.brokenAt,40);
    box(c,x-21,y-6,45,5,P.dark);box(c,x-22,y-7,47,2,P.edge);
    for(let row=0;row<3;row++)for(let j=0;j<2;j++){
        const dx=(j?1:-1)*(row+1)*split*5,drop=row*8*split;
        const xx=x-17+j*17+dx+nudge*row,yy=y-13-row*8+drop;
        box(c,xx,yy,16,8,P.ink);box(c,xx+1,yy+1,14,6,row%2?P.stone:P.metal);
        box(c,xx+1,yy+1,13,1,P.edge);box(c,xx+3,yy+3,5,1,P.shine);
    }
    const roarAge=s.roarAt<0?100:tick-s.roarAt;
    const sway=reduced?0:Math.sin(tick/33)*1.4+(roarAge<80?Math.sin(roarAge/3)*(1-roarAge/80)*3:0);
    pixelLine(c,x+21,y-36,x+21,y-7,P.dark,2);
    polygon(c,[[x+21,y-34],[x+34,y-32+sway],[x+31,y-20+sway],[x+23,y-22]],'#947f70');
    pixelLine(c,x+23,y-32,x+31,y-31+sway,'#b4a18a');
    if(nudge>0){pixelLine(c,x-2,y-26+split*16,x+2,y-22+split*16,P.ink);pixelLine(c,x+2,y-22+split*16,x-1,y-16+split*8,P.ink);}
}

/** Back layer: grounded props, real exits and small actors before the dinosaur. */
export function drawAftermathYards(c:CanvasRenderingContext2D,b:HypotheticalBackdrop,base:number,cameraX:number,reduced:boolean){
    const a=b.aftermath;
    for(const [i,yard] of AFTERMATH_YARDS.entries()){
        const x=yard.origin,s=a.yards[i];
        // Include projecting fittings, exits and loose pieces at both edges.
        if(x+448<cameraX||x+72>cameraX+320){
            // Flights and falling bodies can outlive their original courtyard's
            // scenery bounds while Feka moves the camera onward.
            drawAftermathFlock(c,s.flock,base,a.tick,reduced);continue;
        }
        refuge(c,x,base,i);
        drawEscapeFixtures(c,s.escape,base);
        drawAftermathFittings(c,x,base,s.environment,a.tick,reduced);
        for(const [j,prop] of AFTERMATH_PROPS.entries())secondaryProp(c,x+prop.offset,base-3,j,s.props[j],a.tick,reduced);
        if(s.runnerAt>=0){
            // The stack hides the start of the escape; actors emerge past its actual right edge.
            c.save();c.beginPath();c.rect(x+296,base-34,95,36);c.clip();
            drawBystanders(c,b,base,reduced,false,s.people,a.tick);c.restore();
        }
        const px=x+272,py=base-3;
        if(yard.kind==='timber')timber(c,px,py,s,a.tick);
        else if(yard.kind==='cargo')cargo(c,px,py,s,a.tick);
        else if(yard.kind==='vent')vent(c,px,py,s,a.tick,reduced);
        else masonry(c,px,py,s,a.tick,reduced);
        drawYardDebris(c,s,i,base,a.tick);
        drawEscapeActors(c,b,s.escape,base,reduced);
        drawForageRemains(c,s.forage,base,a.tick,reduced);
        drawAftermathFlock(c,s.flock,base,a.tick,reduced);
        drawEscapeDust(c,s.escape,base,reduced);
        drawAftermathIncidents(c,x,base,s.environment,a.tick,reduced);
    }
    for(const p of a.contacts)drawAftermathContact(c,p,a.tick,base,reduced,'fragments');
}

/** Loose material belongs to the same rear street as its source pile. */
function drawYardDebris(c:CanvasRenderingContext2D,s:AftermathYard,i:number,base:number,tick:number){
    if(s.shiftedAt<0)return;
    const x=AFTERMATH_YARDS[i].origin+272,age=tick-(s.brokenAt<0?s.shiftedAt:s.brokenAt);
    if(i<2){
        // A freed beam/lid rises with the muzzle, then drops once and remains in the street.
        const t=tick-s.shiftedAt,release=smoothMotion((t-28)/40);
        const lift=8*smoothMotion(t/15)*(1-release);
        const xx=x+smoothMotion(t/62)*24,yy=base-18-lift+release*15;
        const tilt=Math.sin(Math.min(1,t/68)*Math.PI)*6;
        pixelLine(c,xx-14,yy-tilt,xx+15,yy+tilt,P.dark,4);
        pixelLine(c,xx-13,yy-tilt,xx+14,yy+tilt,P.wood,2);
        pixelLine(c,xx-11,yy-tilt-1,xx+12,yy+tilt-1,P.light);
        box(c,xx-9,yy-tilt,1,2,P.ink);box(c,xx+8,yy+tilt,1,2,P.ink);
    }
    for(let j=0;j<(s.damage===2?8:4);j++){
        const t=Math.min(42,Math.max(0,age-j*2)),dir=j%2?1:-1;
        const xx=x+dir*(8+j*2+t*.48),yy=base-3-Math.max(0,Math.sin(Math.PI*t/42)*(5+j%3*3));
        pixelLine(c,xx,yy,xx+3+j%3,yy+(j%2?1:-1),i===2?P.metal:P.wood,2);
        box(c,xx,yy-1,2,1,P.edge);
    }
}

/** Front layer: temporary mouth/contact accents, dust, tracers and impacts. */
export function drawAftermathEffects(c:CanvasRenderingContext2D,a:HypotheticalAftermath,base:number,reduced:boolean){
    for(const s of a.yards)drawForageCover(c,s.forage,base,reduced,a.tick);
    if(!a.active)return;
    for(const shot of a.shots)drawGunTracer(c,shot,0,base,reduced,true);
    for(const hit of a.impacts)drawGunImpact(c,hit,a.tick,0,base,reduced,true);
    for(const p of a.contacts)drawAftermathContact(c,p,a.tick,base,reduced,'effects');
    if(!reduced)for(const p of a.exhales){
        const age=a.tick-p.born;if(age<0||age>=28)continue;
        const x=p.x+p.facing*(2+age*.38),y=base+p.y-age*.09;
        const size=Math.max(1,3-age/12);
        box(c,x,y,size,1,P.shine);
        if(age>5&&age<20)box(c,x-p.facing*2,y-2,2,1,P.dust);
    }
}
