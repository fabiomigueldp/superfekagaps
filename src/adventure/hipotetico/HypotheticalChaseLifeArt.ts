import {box,oval,pixelLine,polygon} from '../WorldPainting';
import type {HypotheticalModel} from './HypotheticalModel';
import {CHASE_QUAYS,CHASE_SHORE,chaseQuayX,chaseQuaySection,chaseWorkerAt,chaseBirdAt,chaseQuayReaction,chaseOutflowAt,chaseOarAt,chaseWindAt,chaseWorkAt} from './HypotheticalChaseLife';
import {drawScenicShadow} from './HypotheticalSceneShadow';

const P={shade:'#607e7b',dark:'#597471',stone:'#9ca797',light:'#b8b79d',wood:'#9c9278',seam:'#7b8878',water:'#79aaa2'};
const ageAt=(b:HypotheticalModel,i:number)=>b.chaseReactions[i]===-1?-1:b.tick-b.chaseReactions[i];

function doorway(c:CanvasRenderingContext2D,x:number,base:number){
    box(c,x+26,base-28,25,28,P.shade);box(c,x+29,base-25,19,25,'#526f70');
    box(c,x+27,base-28,24,2,P.light);box(c,x+27,base-25,2,25,P.seam);box(c,x+49,base-25,2,25,P.light);
    pixelLine(c,x+30,base-3,x+47,base-3,'#829384');
}
function pipe(c:CanvasRenderingContext2D,x:number,y:number,w:number){
    box(c,x,y,w,7,P.dark);box(c,x,y+1,w,4,'#8ca397');box(c,x+2,y+1,w-4,1,'#abb9a4');
    for(const dx of [3,w-6]){box(c,x+dx,y-1,3,9,P.dark);box(c,x+dx,y,2,7,'#a2afa0');}
}
function crate(c:CanvasRenderingContext2D,x:number,y:number,w=12,h=10){
    box(c,x,y,w,h,P.shade);box(c,x+1,y+1,w-2,h-2,P.wood);
    if(w>=10){pixelLine(c,x+3,y+h-3,x+w-4,y+h-3,'#858d77');box(c,x+w-5,y+3,2,1,'#b6ac8c');}
    pixelLine(c,x+2,y+2,x+w-3,y+h-3,P.seam);box(c,x+1,y+1,w-2,1,P.light);
    for(const dx of [1,w-3]){box(c,x+dx,y+2,2,h-3,'#7b8877');box(c,x+dx,y+2,1,1,'#b1b296');}
}

/** Industrial silhouettes replace repeated residential facades as the district changes. */
export function drawChaseIndustry(c:CanvasRenderingContext2D,b:HypotheticalModel,index:number,x:number,base:number,reduced:boolean){
    const site=CHASE_QUAYS[index],age=ageAt(b,index),reaction=chaseQuayReaction(age,reduced),time=reduced?0:b.tick;
    if(site.kind==='cargo'){
        const top=base-54-(index%2)*7;
        box(c,x+5,top+6,66,base-top-6,'#8f9c8c');box(c,x+9,top+7,58,base-top-7,'#a7a58e');
        polygon(c,[[x,top+6],[x+35,top-7],[x+75,top+6]],'#6c8580');
        polygon(c,[[x+7,top+4],[x+35,top-4],[x+67,top+4]],'#9aa892');
        pixelLine(c,x+7,top+5,x+68,top+5,P.light);
        for(let dx=13;dx<62;dx+=9)pixelLine(c,x+dx,top+2,x+dx+5,top+3,'#7f9486');
        box(c,x+8,top+6,59,2,'#71897f');
        for(let dx=14;dx<65;dx+=13){box(c,x+dx,top+8,2,base-top-11,'#7f8f80');box(c,x+dx+2,top+8,1,base-top-11,'#b6ad90');}
        for(let dx=13;dx<60;dx+=15){box(c,x+dx,top+13,10,9,P.shade);box(c,x+dx+2,top+14,6,5,'#9eb19b');}
        // Rain gutters turn down into a shoe on the street, with brackets on the wall.
        pixelLine(c,x+68,top+8,x+68,base-5,'#758d80',2);
        pixelLine(c,x+68,base-5,x+72,base-2,'#8fa18b',2);
        for(const y of [top+21,base-10])box(c,x+67,y,4,1,'#a6b09a');
        doorway(c,x,base);
        for(const dx of [12,56]){pixelLine(c,x+dx,base-23,x+dx+7,base-6,'#7d8f7e',2);box(c,x+dx,base-4,8,2,'#b1ad8e');}
        crate(c,x+57,base-12,13,12);crate(c,x+74,base-10);crate(c,x+60,base-21,10,9);
        // Canvas is tied at both corners; a passing shock travels through its loose lower hem.
        pixelLine(c,x+71,base-31,x+121,base-33,P.shade);
        for(const dx of [72,119])box(c,x+dx,base-36,2,36,P.shade);
        const wind=chaseWindAt(b.tick,site.x,reduced)*1.2+reaction.gust;
        polygon(c,[[x+77,base-31],[x+114,base-32],[x+114+wind,base-17],[x+103+wind,base-19],[x+90+wind,base-17],[x+78,base-20]],'#7c9b8c');
        pixelLine(c,x+80,base-29,x+81+wind,base-20,'#a1b39a');pixelLine(c,x+107,base-30,x+108+wind,base-21,'#98ac95');
        pixelLine(c,x+91,base-30,x+92+wind,base-20,'#6f9082');
        for(const dx of [77,113])box(c,x+dx,base-32,2,2,'#a6b39b');
    }else if(site.kind==='water'){
        const top=base-52;
        box(c,x+4,top,68,52,'#8fa393');box(c,x+8,top+3,60,49,'#a5b09a');
        box(c,x,top-5,76,5,P.shade);box(c,x+2,top-5,72,2,P.light);
        for(const dx of [12,54]){box(c,x+dx,top+9,9,15,P.shade);for(let j=1;j<13;j+=4)box(c,x+dx+1,top+9+j,7,2,'#829b8a');}
        doorway(c,x,base);
        pipe(c,x+15,top-13,49);
        for(const dx of [16,57]){box(c,x+dx,top-7,7,8,P.shade);box(c,x+dx+2,top-7,3,7,'#99ae9c');box(c,x+dx-2,top-1,11,3,P.light);}
        pipe(c,x+62,base-21,35);box(c,x+91,base-18,7,27,P.dark);box(c,x+92,base-17,4,26,'#91aa9a');
        box(c,x+89,base+7,11,3,P.shade);box(c,x+91,base+9,7,2,'#adc0a7');
        // The valve and outlet are connected by one continuous, flanged pipe.
        const turn=age<0?0:Math.min(1,Math.max(0,(age-8)/34))*Math.PI*.7;
        oval(c,x+74,base-26,13,13,P.dark);oval(c,x+76,base-24,9,9,'#b1b49a');
        for(let j=0;j<3;j++){const a=turn+j*Math.PI*2/3;pixelLine(c,x+80,base-20,x+80+Math.cos(a)*4,base-20+Math.sin(a)*4,P.shade);}
        const slot=index===8?4:3,at=b.chaseBreaks[slot],breakAge=at===-1?-1:b.tick-at;
        const flow=chaseOutflowAt(age,breakAge),waterY=base+CHASE_SHORE.water,outletY=base+CHASE_SHORE.outlet,waterTime=time+index*17;
        const width=2+Math.round(flow.flow*2);
        polygon(c,[[x+93,outletY],[x+93+width,outletY],[x+94+width,waterY],[x+92,waterY]],'#7faea4');
        for(let k=0;k<3;k++){
            const t=reduced?k*3:(waterTime+k*4)%12;
            box(c,x+94,outletY+t*.5,1,2,'#b1c3a8');
        }
        for(let k=0;k<3;k++){
            const t=reduced?k*7:(waterTime+k*9)%27,r=3+t*.4,y=waterY+t*.12;
            const color=t<12?'#92b5a4':'#619591';
            pixelLine(c,x+95-r,y,x+94-r*.45,y+1,color);pixelLine(c,x+96+r*.4,y+1,x+95+r,y,color);
        }
        if(!reduced&&flow.surge>.1)for(const dir of [-1,1]){
            const t=(waterTime+dir*3+18)%18;
            box(c,x+95+dir*t*.6,waterY-Math.sin(t/18*Math.PI)*4*flow.surge,1,2,'#a8c1a8');
        }
    }else if(site.kind==='port'){
        const height=[65,78,58][index-9],top=base-height;
        box(c,x+12,top,56,height,'#8b9d91');box(c,x+16,top+3,48,height-3,'#a7ad96');
        box(c,x+9,top-4,62,5,P.shade);box(c,x+11,top-4,58,2,P.light);
        for(const dx of [17,60]){box(c,x+dx,top+4,3,height-4,'#b9b79a');for(let y=top+12;y<base;y+=12)box(c,x+dx,y,3,1,'#7c9587');}
        doorway(c,x,base);box(c,x+24,top+10,31,18,P.shade);
        if(index===10){
            oval(c,x+31,top+11,17,16,'#b8b89d');oval(c,x+34,top+14,11,10,'#879e8b');
            pixelLine(c,x+39,top+15,x+39,top+19,P.light);pixelLine(c,x+39,top+19,x+43,top+21,P.light);
            for(const [dx,dy]of [[39,12],[39,25],[32,19],[46,19]])box(c,x+dx,top+dy,1,1,P.shade);
        }else for(let j=0;j<5;j++)box(c,x+27+j*5,top+12,2,14,'#adbaa1');
        box(c,x+33,top+31,13,12,P.shade);box(c,x+36,top+34,7,6,reaction.signal?'#c7bc91':'#82978a');
        const bx=x+90+Math.sin(reaction.bell)*7,by=base-41+Math.cos(reaction.bell)*7;
        box(c,x+85,base-50,3,50,P.shade);pixelLine(c,x+86,base-50,x+102,base-50,P.light,2);
        pixelLine(c,x+95,base-49,bx+4,by-2,P.shade);
        polygon(c,[[bx+2,by-3],[bx+6,by-3],[bx+8,by+5],[bx,by+5]],'#aca586');box(c,bx-1,by+5,10,2,'#7b897a');
        box(c,bx+3,by+7,2,2,'#b5b18f');
    }
    // Wear stays around damp plinths and exposed corners, leaving the facade's large shapes calm.
    for(const [dx,dy]of [[9,6],[56,9],[60,17]]){
        box(c,x+dx,base-dy,6,2,'#829584');box(c,x+dx+1,base-dy-1,3,1,'#b1b29a');
    }
    box(c,x+3,base-2,70,2,P.seam);
}

function worker(c:CanvasRenderingContext2D,x:number,base:number,age:number,index:number,tick:number,reduced:boolean){
    const p=chaseWorkerAt(age);if(p.hidden)return;
    const work=chaseWorkAt(tick,index,reduced),quiet=1-p.notice,kind=CHASE_QUAYS[index].kind;
    const px=x-p.travel,step=reduced?0:p.stride,lean=work.bend*quiet-p.speed*.6;
    const bodyY=base-9+p.duck*2+(work.bend*.6+work.breath)*quiet,shoulder=px+lean;
    const shirt=kind==='cargo'?'#a19b7b':kind==='water'?'#7c9d99':kind==='port'?'#7a8f9a':'#a7a48a';
    drawScenicShadow(c,px-2,base-1,11,2,.18);
    // Knees articulate above planted feet; only the retreat stride lifts a heel.
    for(const [j,dir]of [-1,1].entries()){
        const hip=px+1+j*2,foot=hip+step*dir,knee=hip-step*dir*.35;
        const heel=reduced?0:Math.max(0,dir*step)*.7;
        pixelLine(c,hip,bodyY+4,knee,base-3,P.shade,2);
        pixelLine(c,knee,base-3,foot,base-1-heel,j?'#718984':P.shade,2);
        box(c,foot-1,base-1-heel,3,1,'#52716f');
    }
    polygon(c,[[shoulder,bodyY],[shoulder+4,bodyY],[px+5,bodyY+5],[px,bodyY+5]],shirt);
    box(c,shoulder+1,bodyY+1,1,3,'#b2b79f');box(c,px,bodyY+4,5,1,'#7d907e');
    if(kind==='quay')box(c,shoulder+2,bodyY+2,2,4,'#bbc0a5');
    const head=shoulder+1-p.notice+work.glance*.5*quiet;
    box(c,head,bodyY-4,3,4,index%2?'#a9a084':'#c0b394');
    box(c,head-1,bodyY-5,4,2,kind==='water'?'#b8b597':'#748779');
    box(c,head-2,bodyY-4,6,1,'#a8ad91');
    box(c,head+(p.notice>.5?0:2),bodyY-3,1,1,'#627970');
    const reach=kind==='water'?quiet:0,handX=px+5-step,handY=bodyY+3-reach*10;
    pixelLine(c,shoulder+3,bodyY+1,px+5,bodyY+2-reach*5,shirt,2);
    pixelLine(c,px+5,bodyY+2-reach*5,handX,handY,'#b6ac8b');
    const nearX=px+1+quiet*(5+work.stroke),nearY=bodyY+4-quiet;
    pixelLine(c,shoulder,bodyY+1,px-1,bodyY+3,shirt,2);
    pixelLine(c,px-1,bodyY+3,nearX,nearY,'#b6ac8b');
    // Quiet work uses small tools in the occupied hand; it blends out on notice.
    if(quiet>.5&&kind==='port'){
        box(c,handX,handY-2,5,4,'#6a837d');box(c,handX+1,handY-1,3,2,'#b9b69a');
    }else if(quiet>.5&&kind==='water'){
        pixelLine(c,handX,handY,handX+3+work.stroke,handY-4,'#b1bca4');
        box(c,handX+2+work.stroke,handY-5,3,1,'#78978b');
    }else if(quiet>.5&&kind==='quay'){
        box(c,nearX,nearY,3,2,'#b1bca2');box(c,nearX+1,nearY+2,2,1,'#90a794');
    }
}

export function drawChaseQuayLife(c:CanvasRenderingContext2D,b:HypotheticalModel,index:number,x:number,base:number,reduced:boolean){
    const site=CHASE_QUAYS[index],age=ageAt(b,index),p=chaseQuayReaction(age,reduced);
    if(site.kind==='quay'){
        // Only the upper shutters close; the doorway stays open for the retreat.
        const top=base-(51+index%2*14);
        for(const [j,dx]of [15,37].entries()){
            const shutter=chaseQuayReaction(age<0?-1:Math.max(0,age-j*6),reduced).shutter;
            const open=3*shutter,closed=4*(1-shutter);
            box(c,x+dx-open,top+18,3+closed,12,'#789084');
            box(c,x+dx+9-closed,top+18,3+closed,12,'#789084');
            for(let j=0;j<3;j++){
                pixelLine(c,x+dx-open,top+20+j*3,x+dx+2+closed,top+20+j*3,'#aab49b');
                pixelLine(c,x+dx+9-closed,top+20+j*3,x+dx+11+open,top+20+j*3,'#aab49b');
            }
        }
        if(index===0){
            // The awning is fixed to its brackets. Only the loose fringe responds
            // to the breeze and the short shock, rather than the whole facade.
            const wind=chaseWindAt(b.tick,site.x,reduced)*.5+p.gust*.6;
            for(let j=0;j<5;j++){
                const left=x+6+j*12,y=base-18+Math.sin(j+1)*wind;
                polygon(c,[[left,base-20],[left+12,base-20],[left+11,y+1],[left+2,y]],j%2?'#91aa96':'#72978a');
            }
            for(const dx of [9,64])pixelLine(c,x+dx,base-18,x+dx+2,base-24,'#7c9585');
        }
    }
    if(site.worker){
        const pose=chaseWorkerAt(age),work=chaseWorkAt(b.tick,index,reduced);
        if(site.kind==='cargo')crate(c,x+78,base-8+pose.crateDrop+(work.bend*.6+work.breath)*(1-pose.notice),7,5);
        // Occlusion by the jamb, rather than a fade, takes the worker inside.
        c.save();c.beginPath();c.rect(x+47,base-28,45,30);c.clip();worker(c,x+75,base,age,index,b.tick,reduced);c.restore();
    }
    if(site.birds){
        for(let j=0;j<3;j++){
            const bird=chaseBirdAt(age,j);if(!bird.visible)continue;
            const rx=19+j*10,roof=site.kind==='cargo'?base-54-index%2*7+3-(rx<35?rx/35:(75-rx)/40)*13:
                base-(site.kind==='port'?[65,78,58][index-9]+7:site.kind==='water'?60:63+index%2*14);
            const bx=x+19+j*10+bird.x,by=roof-bird.y+bird.crouch;
            const peck=age<0&&!reduced?Math.max(0,Math.sin(b.tick/31+j*2+index)-.65)*4:0;
            box(c,bx,by,4,2,'#aeb9a4');box(c,bx+3+peck*.4,by-1+peck,2,2,'#bec3ab');
            box(c,bx+5+peck*.4,by+peck,1,1,'#9f9e81');pixelLine(c,bx,by+1,bx-2,by,'#8da598');
            if(bird.flying&&!reduced){
                pixelLine(c,bx+1,by,bx-3,by-bird.wing,'#849f94');pixelLine(c,bx+2,by,bx+6,by-bird.wing,'#b4c1a9');
                box(c,bx-4,by-bird.wing,2,1,'#92aba0');
            }
            else if(!bird.flying)box(c,bx+1,by+2,2,1,'#708b82');
        }
    }
}

/** Oars, hull pitch and the wake share a stroke; boats stay behind the playable bridge. */
export function drawChaseSkiffs(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number,reduced:boolean){
    const section=chaseQuaySection(cy);
    for(const [i,anchor]of [340,1540,2740,3940].entries()){
        const oar=chaseOarAt(b.tick,i,reduced),{stroke}=oar,drift=reduced?0:b.tick*.025;
        const x=chaseQuayX(anchor,cx)+drift,y=section.boat-6+oar.bob;
        if(x<-60||x>345)continue;
        const pitch=stroke*.6;
        polygon(c,[[x,y],[x+31,y+pitch],[x+26,y+6],[x+7,y+6]],i%2?'#5b7b73':'#527b77');
        pixelLine(c,x+2,y,x+29,y+pitch,'#92ab96');pixelLine(c,x+8,y+4,x+24,y+4,'#70988c');
        pixelLine(c,x+7,y+2,x+26,y+2,'#72988a');box(c,x+7,y-2,19,2,'#839d88');
        if(i%2)crate(c,x+21,y-6,7,5);
        else{
            oval(c,x+21,y-4,8,4,'#9eaf94');
            for(let j=0;j<3;j++)pixelLine(c,x+22+j*2,y-3,x+23+j*2,y-1,'#658c7f');
        }
        // A fixed rowlock connects the blade, shaft and grip. Hands follow the
        // handle while the seated hip and feet remain supported by the hull.
        const shoulder=x+15-stroke*2.5;
        const tipX=x+8+stroke*8,tipY=y+6-oar.lift;
        const lockX=x+18,lockY=y,gripX=lockX+(lockX-tipX)*.4,gripY=lockY+(lockY-tipY)*.4;
        polygon(c,[[shoulder,y-8],[shoulder+3,y-8],[x+16,y-2],[x+12,y-2]],'#91a28d');
        pixelLine(c,x+14,y-2,x+18,y-1,'#6d8e81',2);pixelLine(c,x+18,y-1,x+21,y,'#6d8e81');
        box(c,shoulder,y-11,3,3,'#b0b397');box(c,shoulder-1,y-12,5,1,'#7e9784');
        pixelLine(c,gripX,gripY,tipX,tipY,'#a0b097');box(c,lockX-1,lockY,3,1,'#5f8278');
        pixelLine(c,shoulder+2,y-6,shoulder+5,y-4,'#b3b79b');pixelLine(c,shoulder+5,y-4,gripX,gripY,'#b3b79b');
        pixelLine(c,tipX,tipY,tipX-2,tipY+1,'#7fa89b',2);
        const pull=oar.wet;
        pixelLine(c,x+5,y+8,x+26,y+8,'#679a91');
        pixelLine(c,x-4,y+5,x+1,y+5,'#6e9e92');pixelLine(c,x-9,y+7,x-5,y+7,'#67958d');
        if(pull>.2){
            pixelLine(c,tipX-3-pull*2,tipY+2,tipX+3,tipY+2,'#9cbba7');box(c,x+30,y+2,3,1,'#a2bba3');
            if(!reduced&&pull>.8)box(c,tipX-1,tipY-1,1,1,'#b5c3a7');
        }
    }
}
