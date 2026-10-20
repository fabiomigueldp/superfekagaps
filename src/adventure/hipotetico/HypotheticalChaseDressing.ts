import {box,oval,pixelLine,polygon} from '../WorldPainting';
import type {HypotheticalModel} from './HypotheticalModel';
import {CHASE_QUAYS,chaseQuayReaction,chaseWindAt,chaseCartAt,chasePumpAt} from './HypotheticalChaseLife';
import {drawScenicShadow} from './HypotheticalSceneShadow';

const P={ink:'#607d78',shade:'#7b9183',stone:'#a1ac95',edge:'#b5b69b',wood:'#9a967b',
    grain:'#7e8876',cloth:'#829f91',stitch:'#a7b5a0',wet:'#6d9486'};

/** The far dock uses the skyline's projection and bank, behind the inhabited
 * quay. Muted silhouettes leave the route and the pursuer as the focal plane. */
export function drawChaseHarbor(c:CanvasRenderingContext2D,cx:number,cy:number,tick:number,reduced:boolean){
    const base=110+(64-cy)*.2;
    for(const [i,worldX] of [80,1450,2850,4230].entries()){
        const x=96+(worldX-cx)*.11;if(x<-115||x>345)continue;
        const wind=chaseWindAt(tick,worldX,reduced),height=35+i%2*13;
        // The jib, diagonal brace and rope share the same mast attachment.
        box(c,x+12,base-height,3,height,'#849d96');
        box(c,x+9,base-2,10,3,'#92a79a');box(c,x+9,base-2,10,1,'#acb7a2');
        pixelLine(c,x+14,base-height,x+60,base-height-10,'#849d96',2);
        pixelLine(c,x+14,base-height+19,x+42,base-height-6,'#93a99e');
        pixelLine(c,x+58,base-height-8,x+58,base-11,'#92a99e');
        box(c,x+55,base-12,7,4,'#91a79b');
        for(let j=0;j<3;j++)pixelLine(c,x+13,base-8-j*9,x+16,base-15-j*9,'#9caf9f');
        const y=base+9+(reduced?0:Math.sin(tick/91+i)*.35);
        polygon(c,[[x+25,y-2],[x+82,y-2],[x+74,y+3],[x+34,y+3]],'#809d95');
        pixelLine(c,x+29,y-3,x+79,y-3,'#a5b2a0');
        box(c,x+37,y-13,18,10,'#99ada0');box(c,x+39,y-14,15,2,'#b1bba7');
        for(let j=0;j<3;j++)box(c,x+40+j*4,y-11,2,3,'#7d9c96');
        box(c,x+64,y-24,1,21,'#8ba59c');
        polygon(c,[[x+65,y-23],[x+77,y-22+wind],[x+73,y-17+wind],[x+65,y-18]],'#a8b6a2');
        for(const dx of [57,66]){box(c,x+dx,y-7,8,4,'#92a798');box(c,x+dx,y-7,8,1,'#a9b39f');}
    }
}

function cloth(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,wind:number,color:string){
    // Fixed top seam; displacement grows toward the weighted hem.
    const hem=wind*2;
    polygon(c,[[x,y],[x+w,y],[x+w+hem*.7,y+h-1],[x+w*.62+hem,y+h+1],
        [x+w*.3+hem,y+h],[x+hem*.5,y+h-1]],color);
    pixelLine(c,x+1,y,x+w-1,y,P.stitch);
    pixelLine(c,x+w*.28,y+2,x+w*.28+hem*.6,y+h-2,P.shade);
    pixelLine(c,x+w*.67,y+2,x+w*.67+hem*.8,y+h-1,P.stitch);
    box(c,x+1,y-1,1,2,P.grain);box(c,x+w-2,y-1,1,2,P.grain);
}

function ropeCoil(c:CanvasRenderingContext2D,x:number,y:number){
    oval(c,x-6,y-2,15,4,P.grain);oval(c,x-5,y-3,12,4,P.wood);
    oval(c,x-3,y-2,7,2,P.grain);pixelLine(c,x-4,y-3,x+4,y-3,P.edge);
    pixelLine(c,x+5,y-1,x+11,y-1,P.wood);pixelLine(c,x+11,y-1,x+13,y-3,P.wood);
}

function steam(c:CanvasRenderingContext2D,x:number,y:number,tick:number,worldX:number,reduced:boolean,strength=1){
    if(reduced)return;
    // At most four packets, each born at the vent before spreading and fading.
    for(let j=0;j<4;j++){
        const age=((tick+worldX*.17-j*23)%92+92)%92,fade=Math.sin(Math.PI*age/92)*.3;
        const wind=chaseWindAt(tick-age,worldX,false),px=x+age*.04+wind*age*.025,py=y-age*.15;
        const w=2+age*.045;
        c.save();c.globalAlpha*=fade*strength;
        polygon(c,[[px-w,py],[px-w,py-2],[px-1,py-3],[px+w*.7,py-2],[px+w,py],[px+w*.4,py+1]],'#c2c5ae');
        c.restore();
    }
}

/** Small functional details belong to existing walls, roof edges and service
 * yards. They do not extend the foreground collision or imitate route markers. */
export function drawChaseDressing(c:CanvasRenderingContext2D,b:HypotheticalModel,index:number,x:number,base:number,reduced:boolean){
    const site=CHASE_QUAYS[index],at=b.chaseReactions[index],age=at===-1?-1:b.tick-at;
    const wind=chaseWindAt(b.tick,site.x,reduced)+chaseQuayReaction(age,reduced).gust*.5;
    if(site.kind==='quay'){
        const top=base-51-index%2*14;
        // Roof gutter, brackets, drain shoe and damp masonry are one construction.
        pixelLine(c,x+9,top+4,x+72,top+4,P.shade,2);
        pixelLine(c,x+73,top+4,x+73,base-4,P.ink,2);
        pixelLine(c,x+73,base-4,x+78,base-2,P.stone,2);
        for(const yy of [top+16,base-10])box(c,x+71,yy,4,1,P.edge);
        box(c,x+72,base-4,6,4,P.wet);box(c,x+76,base,8,1,P.shade);
        // A small shop sign hangs from an actual bracket on the side wall.
        const sway=wind*.09,sy=base-34;
        pixelLine(c,x+68,sy-6,x+89,sy-6,P.ink,2);
        pixelLine(c,x+69,sy-12,x+79,sy-6,P.shade);
        const sx=x+84+Math.sin(sway)*7,yy=sy-6+Math.cos(sway)*7;
        const p=(u:number,v:number):[number,number]=>[sx+u*Math.cos(sway)-v*Math.sin(sway),yy+u*Math.sin(sway)+v*Math.cos(sway)];
        const line=(u:number,v:number,uu:number,vv:number,color:string,n=1)=>pixelLine(c,...p(u,v),...p(uu,vv),color,n);
        pixelLine(c,x+84,sy-6,...p(0,0),P.shade);
        polygon(c,[p(-7,0),p(7,0),p(7,10),p(-7,10)],P.ink);
        polygon(c,[p(-6,1),p(6,1),p(6,8),p(-6,8)],index===1?'#8da391':'#a59f81');
        line(-5,1,5,1,P.edge);
        if(index===0){
            polygon(c,[p(-5,5),p(-2,3),p(2,5),p(5,3),p(5,7),p(2,5),p(-2,7)],P.shade);line(-3,4,-3,5,P.edge);
        }else if(index===1){line(-3,3,2,7,P.ink,2);line(-4,2,0,2,P.edge,2);}
        else{polygon(c,[p(-3,3),p(3,3),p(3,7),p(-3,7)],P.shade);line(0,3,0,7,P.edge);}
        // Small exposed brick clusters follow the lower plaster and corner,
        // instead of turning the entire wall into visual noise.
        const brick=index===1?'#8c9989':'#a3937f';
        for(const [dx,dy]of [[10,8],[54,11]]){
            box(c,x+dx,base-dy,9,3,brick);box(c,x+dx+1,base-dy-2,5,2,brick);
            pixelLine(c,x+dx+1,base-dy,x+dx+7,base-dy,'#b4ae93');
            box(c,x+dx+4,base-dy+1,1,2,'#8f9482');
        }
        if(index===1){
            box(c,x+132,base-39,2,39,P.shade);box(c,x+131,base-40,4,2,P.edge);
            pixelLine(c,x+73,base-43,x+101,base-38,P.grain);pixelLine(c,x+101,base-38,x+133,base-38,P.grain);
            cloth(c,x+94,base-39,10,12,wind,'#9caa94');
            cloth(c,x+115,base-38,8,10,wind*.8,'#829e92');
            ropeCoil(c,x+113,base-1);
        }else{
            for(let j=0;j<4;j++){
                const stem=x+109+j*5,tip=base-9-j%2*3;
                pixelLine(c,stem,base-5,stem+wind*.7,tip,P.shade);
                pixelLine(c,stem+wind*.7,tip+2,stem-2+wind,tip,'#96ac91');
                if(j%2===0)box(c,stem-1+wind,tip-1,2,1,'#b4b48f');
            }
        }
    }else if(site.kind==='cargo'){
        const top=base-54-index%2*7;
        // Timber end-grain and iron straps are confined to the existing wall bays.
        for(const dx of [13,57]){
            pixelLine(c,x+dx,base-16,x+dx+5,base-15,P.grain);
            pixelLine(c,x+dx+1,base-12,x+dx+6,base-12,'#adb091');
            box(c,x+dx,top+29,6,3,P.shade);box(c,x+dx+1,top+29,1,1,P.edge);
        }
        // A low handcart sits beneath the canopy, aligned with the loading stair.
        const cart=chaseCartAt(age),cartX=x+cart.travel;
        drawScenicShadow(c,cartX+90,base-1,30,2,.15);
        for(const dx of [96,115]){
            oval(c,cartX+dx-3,base-5,6,6,P.ink);box(c,cartX+dx-1,base-3,2,2,P.stone);
            for(let spoke=0;spoke<3;spoke++){
                const a=cart.wheel+spoke*Math.PI*2/3;
                pixelLine(c,cartX+dx,base-2,cartX+dx+Math.cos(a)*2,base-2+Math.sin(a)*2,P.shade);
            }
        }
        box(c,cartX+91,base-8,29,3,P.grain);box(c,cartX+92,base-9,27,2,P.wood);
        pixelLine(c,cartX+119,base-7,cartX+127,base-14,P.ink,2);
        for(let j=0;j<3;j++){
            box(c,cartX+95+j*7,base-16+cart.cargo,6,7,j%2?'#929b81':'#a6a285');
            pixelLine(c,cartX+97+j*7,base-15+cart.cargo,cartX+97+j*7,base-10+cart.cargo,P.grain);
        }
        ropeCoil(c,cartX+109+cart.rope,base-17+cart.cargo);
        box(c,x+127,base-4,4,4,P.shade);pixelLine(c,x+127,base-4,x+130,base-4,P.edge);
        box(c,x+30,top+8,16,4,P.shade);box(c,x+33,top+9,9,1,P.edge);
        // Pinned ventilation slats and worn frame corners distinguish the shed.
        for(let j=0;j<3;j++)box(c,x+31+j*5,top-1,3,1,'#7c9487');
        for(const dx of [17,58]){pixelLine(c,x+dx,top+27,x+dx+4,top+27,'#b3b093');box(c,x+dx,base-7,2,3,'#85947f');}
    }else if(site.kind==='water'){
        const top=base-52,pump=chasePumpAt(b.tick,index,age);
        // A capped vent connects to the roof main, with a finite, low-contrast plume.
        box(c,x+45,top-23,5,12,P.ink);box(c,x+46,top-22,2,10,P.stone);
        box(c,x+43,top-24-pump.relief,9,3,P.shade);box(c,x+44,top-24-pump.relief,7,1,P.edge);
        steam(c,x+47,top-25,b.tick+index*31,site.x,reduced,.3+pump.speed*.7);
        if(age>=8&&age<68){
            const packets=reduced?2:4;
            for(let j=0;j<packets;j++){
                const t=age-8-j*5;if(t<0||t>44)continue;
                const drift=t*.12,r=1+t*.08,py=top-25-t*.24;
                c.save();c.globalAlpha*=Math.sin(t/44*Math.PI)*.4;
                polygon(c,[[x+47+drift-r,py],[x+46+drift,py-2],[x+47+drift+r,py],[x+48+drift,py+2]],'#c2c5ae');c.restore();
            }
        }
        if(index!==8){
            const motorX=x+117,motorY=base-14,angle=reduced?index:pump.angle;
            box(c,x+105,base-5,26,5,P.shade);box(c,x+107,base-5,22,1,P.edge);
            box(c,x+108,base-17,18,12,P.ink);box(c,x+110,base-16,14,10,P.stone);
            pixelLine(c,x+97,base-18,motorX,base-18,P.ink,3);
            pixelLine(c,x+98,base-19,motorX,base-19,P.stitch);
            oval(c,motorX-8,motorY-8,17,17,P.ink);oval(c,motorX-6,motorY-6,13,13,'#91a68f');
            for(let j=0;j<4;j++){
                const a=angle+j*Math.PI/2;
                pixelLine(c,motorX,motorY,motorX+Math.cos(a)*5,motorY+Math.sin(a)*5,P.ink,2);
            }
            box(c,motorX-1,motorY-1,3,3,P.edge);
            const pinX=motorX+Math.cos(angle)*3,pinY=motorY+Math.sin(angle)*3;
            // A constant-length rod drives a slider on the horizontal guide;
            // the connection never stretches when the flywheel turns.
            const sliderY=base-18,sliderX=pinX-Math.sqrt(18*18-(pinY-sliderY)**2);
            box(c,x+94,sliderY-2,10,4,P.ink);box(c,sliderX-2,sliderY-1,4,2,P.stone);
            pixelLine(c,sliderX,sliderY,pinX,pinY,P.stitch);box(c,pinX,pinY,1,1,P.grain);
        }
        for(const dx of [11,62]){box(c,x+dx,base-5,5,3,P.wet);box(c,x+dx+1,base-7,2,2,P.shade);}
        pixelLine(c,x+10,top+28,x+22,top+28,'#97a68f');pixelLine(c,x+52,top+28,x+65,top+28,'#97a68f');
        for(const dx of [13,58]){box(c,x+dx,top+31,5,1,'#b4b89e');box(c,x+dx+4,top+32,1,4,'#95a58f');}
    }else{
        const top=base-[65,78,58][index-9];
        const pole=x+64;
        pixelLine(c,pole,top+1,pole,top-24,P.ink,2);box(c,pole-1,top-26,3,2,P.edge);
        // A fixed hoist and a flexible outer edge; never a flashing gameplay cue.
        polygon(c,[[pole+1,top-23],[pole+15,top-22+wind],[pole+13+wind*2,top-12],[pole+1,top-13]],'#819e8c');
        pixelLine(c,pole+2,top-21,pole+11,top-20+wind,P.stitch);
        pixelLine(c,pole+4,top-17,pole+12+wind,top-16,'#9cac92');
        box(c,x+34,top+30,12,1,P.edge);
        // Carved trim, rain-darkened corners and a stone plaque anchor the entry.
        for(const dx of [21,55]){box(c,x+dx,base-9,3,7,P.shade);box(c,x+dx,base-10,3,1,P.stone);}
        box(c,x+20,top+33,8,6,P.shade);box(c,x+21,top+34,6,1,P.edge);box(c,x+22,top+36,4,1,P.stone);
        for(const dx of [20,52]){
            pixelLine(c,x+dx,base-20,x+dx+8,base-20,'#95a18b');
            box(c,x+dx+3,base-19,1,5,'#95a18b');pixelLine(c,x+dx,base-14,x+dx+8,base-14,'#b3b39a');
        }
        ropeCoil(c,x+112,base-1);
    }
}
