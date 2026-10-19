import { box, oval, pixelLine, polygon } from '../WorldPainting';
import { smoothMotion } from './HypotheticalMotion';
import { AFTERMATH_YARDS, type HypotheticalAftermath, type AftermathYard } from './HypotheticalAftermath';
import { drawBystanders } from './HypotheticalBystanders';
import type { HypotheticalBackdrop } from './HypotheticalBackdrop';

// Rear-street colours stay below the contrast of guards, bullets and playable ledges.
const P={ink:'#516d70',dark:'#657c73',stone:'#92a18c',edge:'#c1b99a',wood:'#9e9475',grain:'#7d826d',
    light:'#b7aa87',metal:'#718b84',shine:'#abb49a',dust:'#a8ae96',bird:'#c4c4ab',wing:'#839b91'};
const progress=(tick:number,born:number,time:number)=>born<0?0:smoothMotion((tick-born)/time);

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
    oval(c,x-23,y-3,50,5,'#637c74');
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
    oval(c,x-22,y-3,49,5,'#637c74');
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
    const sway=reduced?0:Math.sin(tick/33)*1.4;
    pixelLine(c,x+21,y-36,x+21,y-7,P.dark,2);
    polygon(c,[[x+21,y-34],[x+34,y-32+sway],[x+31,y-20+sway],[x+23,y-22]],'#947f70');
    pixelLine(c,x+23,y-32,x+31,y-31+sway,'#b4a18a');
    if(nudge>0){pixelLine(c,x-2,y-26+split*16,x+2,y-22+split*16,P.ink);pixelLine(c,x+2,y-22+split*16,x-1,y-16+split*8,P.ink);}
}

function gull(c:CanvasRenderingContext2D,x:number,y:number,age:number,seed:number,flying:boolean,reduced:boolean){
    const flap=reduced?0:Math.sin(age*.3+seed),wing=flap*5;
    if(flying){
        pixelLine(c,x-1,y,x-7,y-wing,P.wing,2);pixelLine(c,x-7,y-wing,x-10,y-wing+1,P.bird);
        pixelLine(c,x+1,y,x+7,y-wing*.8,P.bird,2);pixelLine(c,x+7,y-wing*.8,x+9,y-wing*.8+1,P.wing);
    }else{
        box(c,x-2,y+3,1,2,P.grain);box(c,x+2,y+3,1,2,P.grain);
        box(c,x-5,y-1,6,4,P.wing);box(c,x-4,y-2,5,2,P.bird);
    }
    oval(c,x-3,y-1,7,4,P.bird);box(c,x+2,y-3,3,3,P.bird);box(c,x+4,y-2,2,1,P.light);box(c,x+3,y-3,1,1,P.ink);
}

/** Back layer: grounded props, real exits and small actors before the dinosaur. */
export function drawAftermathYards(c:CanvasRenderingContext2D,b:HypotheticalBackdrop,base:number,cameraX:number,reduced:boolean){
    const a=b.aftermath;
    for(const [i,yard] of AFTERMATH_YARDS.entries()){
        const x=yard.origin,s=a.yards[i];
        if(x+390<cameraX||x+110>cameraX+320)continue;
        refuge(c,x,base,i);
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
        // Two birds inhabit the service eave; two inspect the intact stack below it.
        for(let j=0;j<4;j++){
            const age=s.birdsAt<0?-1:a.tick-s.birdsAt-j*6;
            const returned=age>1450;
            if(reduced&&s.birdsAt>=0)continue;
            if(age>142&&!returned)continue;
            const perchX=x+(j<2?264+j*14:344+(j-2)*9),perchY=base-(j<2?33:i===3?32:47);
            const flight=age>=0&&age<=142,landing=returned&&age<1606;
            const t=flight?age:landing?1606-age:0;
            const xx=flight?perchX+t*.93:returned?x+335+j*7+t*.4:perchX;
            const yy=flight?perchY-Math.min(65,t*.78):returned?base-(i===3?32:47)-t*.6:perchY;
            gull(c,xx,yy,flight||landing?a.tick:a.tick*.12,j,flight||landing,reduced);
        }
    }
}

/** Front layer: short contact accents, persistent chips and low settling dust. */
export function drawAftermathEffects(c:CanvasRenderingContext2D,a:HypotheticalAftermath,base:number,reduced:boolean){
    for(const [i,s] of a.yards.entries()){
        if(s.shiftedAt<0)continue;
        const x=AFTERMATH_YARDS[i].origin+272,age=a.tick-(s.brokenAt<0?s.shiftedAt:s.brokenAt);
        if(i<2){
            // A freed beam/lid rises with the muzzle, then drops once and remains in the street.
            const t=a.tick-s.shiftedAt,release=smoothMotion((t-28)/40);
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
    if(!a.active)return;
    for(const p of a.contacts){
        const age=a.tick-p.born,step=p.kind==='step',end=step?26:72;
        if(reduced&&step)continue;
        if(age>=end)continue;
        const fade=1-age/end,grow=Math.min(1,(age+1)/6),n=step?3:reduced?3:6;
        if(!step&&age<8){
            const impactY=base-(a.district===3&&p.kind==='break'?4:17);
            for(let j=0;j<4;j++){
                const angle=-Math.PI*.88+j*.7,r=4+age*1.2;
                pixelLine(c,p.x+Math.cos(angle)*r,impactY+Math.sin(angle)*r*.45,
                    p.x+Math.cos(angle)*(r+3),impactY+Math.sin(angle)*(r+3)*.45,P.edge);
            }
        }
        for(let j=0;j<n;j++){
            const dir=j%2?1:-1,xx=p.x+dir*(3+j*4+age*.27),yy=base-5-Math.min(age,30)*.11-j%2*2;
            const w=(step?4:9)*fade*grow*p.strength+2;
            box(c,xx,yy,w,step?1:3,P.dust);
            if(!step){box(c,xx+1,yy-2,Math.max(1,w-3),2,P.shine);box(c,xx+1,yy+3,w-2,1,P.stone);}
        }
    }
}
