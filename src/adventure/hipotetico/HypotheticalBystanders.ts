import { drawGunTracer, drawGunImpact } from './HypotheticalGunfire';
import { box, pixelLine } from '../WorldPainting';
import type { Bystander, HypotheticalBackdrop } from './HypotheticalBackdrop';
import { bystanderPose,bystanderFall } from './HypotheticalBystanderMotion';
import { bystanderTexture,drawBystanderTexture,type BystanderTexture } from './HypotheticalBystanderPixels';
import {drawBlood} from './HypotheticalBlood';
import {OPENING} from './HypotheticalOpening';
import {drawScenicShadow} from './HypotheticalSceneShadow';
export { bystanderPose } from './HypotheticalBystanderMotion';

type Paint=(x:number,y:number,w:number,h:number,color:string)=>void;
const STAR=['00100','11111','01110','01010','10001'];
const WARDROBE={
    'star-shirt':{base:'#b55350',shade:'#88434a',light:'#d68069'},
    workcoat:{base:'#7b9183',shade:'#536b67',light:'#a6b39a'},
    scarf:{base:'#9b9271',shade:'#736c60',light:'#c0b38b'},
    satchel:{base:'#8598a2',shade:'#566f7d',light:'#adbbb1'},
};
export const SKIN=['#c1a183','#b18872','#947567','#d0b19a'];
const HAIR=['#53615b','#514e51','#6b625b','#a4a393'];
export const SKIN_SHADE=['#a08773','#96715f','#7d635b','#b49683'];
const textures=new Map<string,BystanderTexture>();

function clothes(p:Bystander,paint:Paint,height:number){
    const cloth=WARDROBE[p.clothes];
    paint(-1,-height-2,3,2,SKIN[p.color]);
    paint(-4,-height,8,height,cloth.shade);paint(-3,-height,6,height-1,cloth.base);
    paint(-3,-height+1,1,height-3,cloth.light);paint(-2,-1,6,1,cloth.shade);
    paint(-1,-height,3,1,'#c2b7a0');paint(3,-height+2,1,2,cloth.light);
    if(p.clothes==='star-shirt'){
        // A five-point mark, kept inside the cloth instead of floating above the actor.
        for(let y=0;y<5;y++)for(let x=0;x<5;x++)if(STAR[y][x]==='1')paint(x-2,y-height+2,1,1,'#f0e6d7');
        paint(2,-2,1,1,cloth.light);
    }else if(p.clothes==='workcoat'){
        paint(0,-height+2,1,height-2,cloth.shade);paint(1,-height+3,2,2,cloth.light);
        paint(-2,-3,2,1,cloth.shade);paint(1,-height+3,1,1,'#d2c4a2');
    }else if(p.clothes==='satchel'){
        for(let y=0;y<height;y++)paint(-3+y*.55,-height+y,1,1,'#c0b393');
        paint(3,-4,4,5,'#566c68');paint(3,-4,4,2,'#a99a77');paint(5,-2,1,2,'#d1c6a6');
        paint(3,0,3,1,'#8e8e73');paint(6,-1,1,2,'#394f53');
    }else{
        paint(-3,-height+1,6,2,'#b67f65');paint(-2,-height+3,2,3,'#93695b');
    }
    if(p.appearance===2){paint(-4,-height,1,height-1,'#65766f');paint(3,-height,1,height-1,'#65766f');}
    if(p.appearance===4){paint(-3,-2,6,1,'#d9b98e');paint(-3,-height+1,1,2,'#e1b997');}
    if(p.appearance===6){paint(-3,-height,6,1,'#e5c7a5');paint(-4,-height+3,1,2,cloth.light);}
    if((p.appearance??0)>=7){
        if(p.appearance!%3===0){paint(-4,-height+2,1,height-2,cloth.light);paint(3,-height+2,1,height-2,cloth.light);}
        if(p.appearance!%3===1){paint(-3,-height+2,2,1,'#d2bb91');paint(2,-2,2,1,cloth.light);}
        if(p.appearance!%3===2){paint(-3,-height+1,1,height-2,'#61756d');paint(3,-height+1,1,height-2,'#61756d');}
    }
    if(p.hitAt!==null){paint(1,-height+3,2,2,'#743e45');paint(2,-height+5,1,2,'#944d4d');}
}

function drawClothes(c:CanvasRenderingContext2D,p:Bystander,x:number,y:number,height:number,angle=0,shear=0){
    const key=`${p.clothes}:${p.color}:${height}:${p.appearance??0}:${p.hitAt!==null}`;
    let texture=textures.get(key);
    if(!texture){texture=bystanderTexture(-4,-11,12,13,paint=>clothes(p,paint,height));textures.set(key,texture);}
    drawBystanderTexture(c,texture,x,y,angle,shear);
}

export function drawHead(c:CanvasRenderingContext2D,p:Bystander,x:number,y:number,gaze:number,angle=0){
    const facing=gaze<.35?1:gaze>.65?-1:0,key=`head:${p.color}:${facing}:${p.appearance??0}`;
    let texture=textures.get(key);
    if(!texture){
        const skin=SKIN[p.color],hair=HAIR[p.color],shade=SKIN_SHADE[p.color];
        texture=bystanderTexture(-3,0,8,7,paint=>{
            paint(-1,0,4,6,skin);paint(-2,1,6,4,skin);paint(-2,2,1,3,shade);
            paint(-2,0,5,2,hair);paint(-2,1,1,3,hair);paint(-1,0,2,1,'#919184');
            if(facing===0){paint(-1,3,1,1,'#485f62');paint(2,3,1,1,'#485f62');paint(0,4,1,1,shade);}
            else{paint(facing>0?3:-2,3,1,1,'#485f62');paint(facing>0?3:-3,4,2,1,skin);}
            if(p.color===1)paint(-3,1,2,5,hair);
            if(p.color===2){paint(-1,4,4,1,hair);paint(1,5,2,1,hair);}
            if(p.appearance===2){paint(-2,0,5,1,'#b6b5a4');paint(-2,1,1,3,'#b6b5a4');paint(1,3,3,1,'#4f676a');}
            if(p.appearance===3){paint(-3,1,2,5,hair);paint(-3,5,2,2,hair);paint(-3,4,2,1,'#b87d69');}
            if(p.appearance===5){paint(-2,0,5,2,'#82998f');paint(2,2,3,1,'#b9c0a2');}
            if(p.appearance===6){paint(-2,0,5,2,'#605354');paint(-2,3,1,3,'#605354');}
            if((p.appearance??0)>=7){
                if(p.appearance!%4===0){paint(-2,0,5,1,'#c1bcaa');paint(-2,1,1,2,'#b4b3a0');}
                if(p.appearance!%4===1){paint(-2,0,5,2,'#9b655b');paint(2,2,3,1,'#c2a183');}
                if(p.appearance!%4===2){paint(-3,1,2,6,hair);paint(-3,5,2,1,'#c59274');}
                if(p.appearance!%4===3){paint(-2,3,3,1,'#4b6060');paint(2,3,2,1,'#4b6060');}
            }
            paint(1,5,1,1,shade);
        });textures.set(key,texture);
    }
    drawBystanderTexture(c,texture,x,y,angle);
}

export interface CarriedBystander {
    person:Bystander;angle:number;kick:number;
    stage?:'whole'|'maimed-arm'|'upper-half'|'head-bite'|'legs-only'|'shins-only';
    wound?:number;thrash?:number;offsetX?:number;offsetY?:number;
}
/** The same whole actor and wardrobe, articulated around a chest or waist grip.
 * Used inside the dinosaur rig, so its foreground teeth occlude the contact. */
export function drawCarriedBystander(output:CanvasRenderingContext2D,actor:CarriedBystander,x:number,y:number,scale=1){
    const p=actor.person,angle=actor.angle,co=Math.cos(angle),si=Math.sin(angle),kick=actor.kick;
    const stage=actor.stage??'whole',wound=actor.wound??0,thrash=actor.thrash??kick;
    const ox=(actor.offsetX??0)*scale,oy=(actor.offsetY??0)*scale;
    const c={get fillStyle(){return output.fillStyle;},set fillStyle(v){output.fillStyle=v;},
        fillRect(xx:number,yy:number,w:number,h:number){output.fillRect(Math.round(x+ox+xx*scale),Math.round(y+oy+yy*scale),
            Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale)));}} as CanvasRenderingContext2D;
    const point=(u:number,v:number):[number,number]=>[u*co-v*si,u*si+v*co];
    const skin=SKIN[p.color],cloth=WARDROBE[p.clothes];
    if(stage==='legs-only'||stage==='shins-only'){
        // Head and torso are deep inside the dinosaur's gullet; only the lower waist/knees
        // and kicking legs/boots protrude outward past the bloody front teeth.
        if(stage==='legs-only'){
            const waist=point(0,1);
            drawClothes(c,p,waist[0],waist[1],4,angle);
            pixelLine(c,...point(-3.5,0),...point(3.5,0),'#6b1117',3);
            pixelLine(c,...point(-2.5,1),...point(2.5,1),'#b8252e',2);
            for(const d of [-1,1]){
                const hip=point(d*2,2),knee=point(d*3.8+kick*d*3,9.5),foot=point(d*4.8-kick*d*4,16.5-Math.max(0,kick*d)*3.5);
                pixelLine(c,...hip,...knee,'#485f62',3);
                pixelLine(c,...knee,...foot,'#667c79',3);
                pixelLine(c,...foot,...point(d*4.8-kick*d*4+3.5,16.5-Math.max(0,kick*d)*3.5),'#89978a',2);
                pixelLine(c,...point(d*2.2,4),...point(d*2.8,7),'#9e2028',2);
            }
        }else{
            pixelLine(c,...point(-3,0),...point(3,0),'#5a1016',3);
            pixelLine(c,...point(-2,1),...point(2,1),'#9e2028',2);
            for(const d of [-1,1]){
                const knee=point(d*2.2+kick*d*2,1.5),ankle=point(d*3.6-kick*d*3,8.5),toe=point(d*3.6-kick*d*3+3.5,9);
                pixelLine(c,...knee,...ankle,'#667c79',3);
                pixelLine(c,...point(d*2,2),...point(d*2.6,5),'#9e2028',2);
                pixelLine(c,...ankle,...toe,'#89978a',2);
            }
        }
        return;
    }
    const hip=point(0,stage==='head-bite'?1:stage==='upper-half'?2:4);
    if(stage==='whole'||stage==='maimed-arm'){
        for(const d of [-1,1]){
            const knee=point(d*3+kick*d*2.4,10),foot=point(d*4-kick*d*3.4,16-Math.max(0,kick*d)*3.5);
            pixelLine(c,...point(d,4),...knee,'#485f62',2);pixelLine(c,...knee,...foot,'#667c79',2);
            pixelLine(c,...foot,...point(d*4-kick*d*3.4+3,16-Math.max(0,kick*d)*3.5),'#89978a');
        }
    }else if(stage==='upper-half'){
        pixelLine(c,...point(-3,2),...point(3,2),'#5a1016',3);
        pixelLine(c,...point(-2,3),...point(2,3),'#9e2028',2);
        pixelLine(c,...point(0,2),...point(kick*1.5,6),'#e6dfd3',2);
        pixelLine(c,...point(-2,3),...point(-2-kick*2,8),'#7a1820',2);
        pixelLine(c,...point(2,3),...point(1+kick*2.2,9),'#b8252e');
    }
    for(const d of [-1,1]){
        if(stage==='head-bite')continue;
        if(d===-1&&stage!=='whole'){
            pixelLine(c,...point(-4,-4),...point(-6,-3),'#6b1117',3);
            pixelLine(c,...point(-5,-4),...point(-7,-2),'#e6dfd3');
            pixelLine(c,...point(-5,-3),...point(-7,0),'#b8252e');
            continue;
        }
        const shoulder=point(d*4,-4),elbow=point(d*(7+thrash*1.4),1-thrash*d*1.5),hand=point(d*(5+thrash*1.8),-3-thrash*d*2);
        pixelLine(c,...shoulder,...elbow,cloth.shade,2);pixelLine(c,...elbow,...hand,skin,2);
    }
    drawClothes(c,p,hip[0],hip[1],stage==='head-bite'?5:stage==='upper-half'?7:9,angle);
    if(wound>0){
        pixelLine(c,...point(-3,-2),...point(3,0),'#5a1016',2);
        pixelLine(c,...point(-2,-4),...point(2,-1),'#9e2028',2);
        if(wound>.45){
            pixelLine(c,...point(-2,-1),...point(2,-1),'#e6dfd3');
            pixelLine(c,...point(-1,1),...point(3,2),'#c92c34',2);
        }
    }
    const head=point(0,stage==='head-bite'?-9:-12);drawHead(c,p,head[0],head[1],1,angle);
    if(wound>.15){
        const mouth=point(2,stage==='head-bite'?-5:-8);
        c.fillStyle='#3a0b10';c.fillRect(mouth[0],mouth[1],2,2);
        c.fillStyle='#9e2028';c.fillRect(mouth[0]-1,mouth[1]+1,2,2);
    }
}

/** A pixel-only viewport mirrors the gait and occludes bodies behind their actual doorway. */
function actorContext(c:CanvasRenderingContext2D,p:Bystander){
    const facing=Math.sign(p.shelter-p.originX)||1,door=p.shelter-facing*8;
    if(facing===1&&!p.exitAtShelter)return c;
    return {
        // The pixel viewport changes geometry only; shadow compositing still
        // uses the real canvas state and must restore it for the next actor.
        save(){c.save();},restore(){c.restore();},
        get globalAlpha(){return c.globalAlpha;},set globalAlpha(v){c.globalAlpha=v;},
        get globalCompositeOperation(){return c.globalCompositeOperation;},
        set globalCompositeOperation(v){c.globalCompositeOperation=v;},
        get fillStyle(){return c.fillStyle;},set fillStyle(v){c.fillStyle=v;},
        fillRect(x:number,y:number,w:number,h:number){
            if(facing<0)x=Math.round(p.x*2-x-w);
            if(p.exitAtShelter){
                const right=x+w;
                if(facing>0)w=Math.min(right,door)-x;
                else{x=Math.max(x,door);w=right-x;}
            }
            if(w>0)c.fillRect(x,y,w,h);
        },
    } as CanvasRenderingContext2D;
}

function belongings(c:CanvasRenderingContext2D,p:Bystander,tick:number,base:number,impactAt:number,reduced:boolean){
    if(!p.belonging)return;
    const age=tick-p.alertAt-8,dir=Math.sign(p.shelter-p.originX)||1;
    const t=Math.max(0,Math.min(32,age)),x=age<0?p.x+dir*5:p.originX+dir*(5+t*.34);
    const y=age<0?base-10:Math.min(base-3,base-10-t*.55+t*t*.045);
    if(p.belonging==='parcel'){
        box(c,x-4,y-4,8,6,'#8e856b');box(c,x-3,y-4,6,1,'#c3b08a');
        box(c,x-1,y-4,1,6,'#cbbca0');box(c,x-4,y-1,8,1,'#b9ab87');
    }else for(let i=0;i<3;i++){
        const phase=Math.min(42,Math.max(0,age-i*3)),xx=x+i*3+Math.sin(phase*.16+i)*Math.min(3,phase*.15);
        const yy=age<0?y-i:Math.min(base-1,base-10-phase*.65+phase*phase*.04-i%2);
        const shock=impactAt<0||reduced?0:Math.max(0,Math.min(1,(tick-impactAt-6-i*3)/30));
        const drift=-shock*(7+i*2),lift=Math.sin(shock*Math.PI)*(4+i);
        box(c,xx+drift,yy-lift,4,1,'#d2ccb1');box(c,xx+1+drift,yy+1-lift,3,1,'#aaa88f');
        if(p.opening&&tick>=OPENING.contact+i*2)box(c,xx+1+drift,yy-lift,2,1,i%2?'#8f292f':'#6e1e24');
    }
}

/** Articulated street actors share the game's pixel grid and retain their clothing as they fall. */
export function drawBystanders(output:CanvasRenderingContext2D,b:HypotheticalBackdrop,street:number,reduced:boolean,rear=false,actors?:readonly Bystander[],tick=b.tick,pass:'all'|'actors'='all'){
    if(!rear&&!actors&&pass==='all')drawBystanderGround(output,b,street,reduced);
    for(const p of [...(actors??b.people)].sort((a,b)=>(a.depth??0)-(b.depth??0))){
        const behindDino=Boolean(p.opening)||(p.depth??0)<0||(p.exitAtShelter===true&&p.shelter===116&&tick>0&&tick<OPENING.join);
        if(!actors&&behindDino!==rear)continue;
        const base=street+(p.depth??0);
        const site=p.district===0?(p.originX>320?1:0):p.district+1;
        belongings(output,p,tick,p.opening?street:base,b.breaches[site],reduced);
        if(p.escaped||p.foraged||p.capturedAt!==undefined&&tick>=OPENING.clamp)continue;
        const c=actorContext(output,p);
        const x=p.x,pose=bystanderPose(p,tick),age=pose.age,skin=SKIN[p.color];
        const cloth=WARDROBE[p.clothes],ink='#485f62',shoe='#89978a';
        if(age>=0){
            const motion=bystanderFall(p,tick),{angle,height,headTop}=motion,fall=angle/(Math.PI/2);
            drawScenicShadow(c,x-6,base-1,15+fall*14,2,.2);
            const hipX=x+motion.hipX,hipY=base+motion.hipY,cos=Math.cos(angle),sin=Math.sin(angle);
            const point=(u:number,v:number)=>[hipX+u*cos-v*sin,hipY+u*sin+v*cos];
            pixelLine(c,x-3,base-1,hipX-1,hipY,ink,2);pixelLine(c,x+3+fall*3,base-1,hipX+1,hipY,ink,2);
            box(c,x-4,base-1,4,1,shoe);box(c,x+3+fall*3,base-1,4,1,shoe);
            drawClothes(c,p,hipX,hipY,height,angle);
            const head=point(0,headTop);drawHead(c,p,head[0],head[1],0,angle);
            const elbow=point(5,-4),hand=point(6,-1);
            elbow[1]=Math.min(base-2,elbow[1]);hand[1]=Math.min(base-2,hand[1]);
            const shoulder=point(4,-height+1);pixelLine(c,shoulder[0],shoulder[1],elbow[0],elbow[1],cloth.shade,2);
            pixelLine(c,elbow[0],elbow[1],hand[0],hand[1],skin,2);
            if(p.clothes==='workcoat'){
                const t=Math.min(30,age),hatX=x-3+t*.4,hatY=Math.min(base-3,base-24+motion.crouch*8-t*.9+t*t*.06);
                box(c,hatX,hatY,6,2,'#9d9d83');box(c,hatX-1,hatY+2,8,1,'#c3bca0');
            }
            if(age>=29&&age<45&&!reduced)for(let i=0;i<3;i++)box(c,x+4+i*5+(age-29)*.25,base-2-i%2,3,1,'#b2ab92');
            continue;
        }
        drawScenicShadow(c,x-6,base-1,15,2,.2);
        const hipY=base+pose.hipY,headX=x+pose.lean-pose.recoil*.6-pose.gaze*.4,headY=base+pose.headY+pose.bob;
        const height=Math.round(9-pose.crouch*2),torso=hipY-height;
        const swing=pose.swing;
        // Rear arm and far leg precede the cloth, so hands cannot erase the chest mark.
        pixelLine(c,x-4,torso+1,x+pose.leftHand[0],base+pose.leftHand[1],cloth.shade,2);
        box(c,x+pose.leftHand[0],base+pose.leftHand[1],2,2,skin);
        for(const [i,foot] of [pose.left,pose.right].entries()){
            const fx=x+(i?2:-2)+foot[0],fy=base+foot[1],kneeX=(x+fx)/2-1+pose.crouch*4;
            const kneeY=hipY+(fy-hipY)*.55;
            pixelLine(c,x+(i?1:-2),hipY,kneeX,kneeY,i?'#667c79':ink,2);
            pixelLine(c,kneeX,kneeY,fx,fy-1,i?'#667c79':ink,2);box(c,fx-1,fy-1,4,1,i?shoe:ink);
        }
        drawClothes(c,p,x,hipY,height,0,pose.lean/12);
        drawHead(c,p,headX,headY,pose.gaze);
        if(p.clothes==='workcoat'){box(c,headX-3,headY-2,6,3,'#9d9d83');box(c,headX-4,headY+1,9,1,'#c3bca0');box(c,headX-2,headY-1,4,1,'#b7b396');}
        const shoulderX=x+4+pose.lean*.5,elbowX=x+6-swing;
        pixelLine(c,shoulderX,torso+1,elbowX,torso+4,cloth.shade,2);
        pixelLine(c,elbowX,torso+4,x+pose.rightHand[0],base+pose.rightHand[1],skin,2);
        if(p.clothes==='scarf'){
            pixelLine(c,x-3,torso+2,x-7,torso+(reduced?2:2+pose.clothSway*1.4),'#b67f65');
            box(c,x-7,torso+(reduced?2:2+pose.clothSway*1.4),2,1,'#d0a184');
        }
    }
    if(rear||actors||pass==='actors')return;
    drawBystanderEffects(output,b,street,reduced);
}

/** Surface decals precede every actor, including the distant rider. */
export function drawBystanderGround(output:CanvasRenderingContext2D,b:HypotheticalBackdrop,street:number,reduced:boolean){
    drawBlood(output,b,street,reduced,false);
}

export function drawBystanderEffects(output:CanvasRenderingContext2D,b:HypotheticalBackdrop,street:number,reduced:boolean){
    drawBlood(output,b,street,reduced,true);
    for(const s of b.shots)drawGunTracer(output,s,0,street,reduced,true);
    for(const p of b.impacts)drawGunImpact(output,p,b.tick,0,street,reduced,true);
}
