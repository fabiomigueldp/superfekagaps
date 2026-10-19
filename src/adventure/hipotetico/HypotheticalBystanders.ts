import { drawGunTracer, drawGunImpact } from './HypotheticalGunfire';
import { box, oval, pixelLine } from '../WorldPainting';
import type { Bystander, HypotheticalBackdrop } from './HypotheticalBackdrop';
import { bystanderPose,bystanderFall } from './HypotheticalBystanderMotion';
import { bystanderTexture,drawBystanderTexture,type BystanderTexture } from './HypotheticalBystanderPixels';
export { bystanderPose } from './HypotheticalBystanderMotion';

type Paint=(x:number,y:number,w:number,h:number,color:string)=>void;
const STAR=['00100','11111','01110','01010','10001'];
const WARDROBE={
    'star-shirt':{base:'#b55350',shade:'#88434a',light:'#d68069'},
    workcoat:{base:'#7b9183',shade:'#536b67',light:'#a6b39a'},
    scarf:{base:'#9b9271',shade:'#736c60',light:'#c0b38b'},
    satchel:{base:'#8598a2',shade:'#566f7d',light:'#adbbb1'},
};
const SKIN=['#c1a183','#b18872','#947567','#d0b19a'];
const HAIR=['#53615b','#514e51','#6b625b','#a4a393'];
const SKIN_SHADE=['#a08773','#96715f','#7d635b','#b49683'];
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
}

function drawClothes(c:CanvasRenderingContext2D,p:Bystander,x:number,y:number,height:number,angle=0,shear=0){
    const key=`${p.clothes}:${p.color}:${height}:${p.appearance??0}`;
    let texture=textures.get(key);
    if(!texture){texture=bystanderTexture(-4,-11,12,13,paint=>clothes(p,paint,height));textures.set(key,texture);}
    drawBystanderTexture(c,texture,x,y,angle,shear);
}

function drawHead(c:CanvasRenderingContext2D,p:Bystander,x:number,y:number,gaze:number,angle=0){
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
            paint(1,5,1,1,shade);
        });textures.set(key,texture);
    }
    drawBystanderTexture(c,texture,x,y,angle);
}

/** A pixel-only viewport mirrors the gait and occludes bodies behind their actual doorway. */
function actorContext(c:CanvasRenderingContext2D,p:Bystander){
    const facing=Math.sign(p.shelter-p.originX)||1,door=p.shelter-facing*8;
    if(facing===1&&!p.exitAtShelter)return c;
    return {
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

function belongings(c:CanvasRenderingContext2D,p:Bystander,tick:number,base:number){
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
        box(c,xx,yy,4,1,'#d2ccb1');box(c,xx+1,yy+1,3,1,'#aaa88f');
    }
}

/** Articulated street actors share the game's pixel grid and retain their clothing as they fall. */
export function drawBystanders(output:CanvasRenderingContext2D,b:HypotheticalBackdrop,street:number,reduced:boolean){
    for(const p of [...b.people].sort((a,b)=>(a.depth??0)-(b.depth??0))){
        const base=street+(p.depth??0);
        belongings(output,p,b.tick,base);
        if(p.escaped)continue;
        const c=actorContext(output,p);
        const x=p.x,pose=bystanderPose(p,b.tick),age=pose.age,skin=SKIN[p.color];
        const cloth=WARDROBE[p.clothes],ink='#485f62',shoe='#89978a';
        if(age>=0){
            const motion=bystanderFall(p,b.tick),{angle,height,headTop}=motion,fall=angle/(Math.PI/2);
            oval(c,x-6,base-1,15+fall*14,2,'#6c8076');
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
        oval(c,x-6,base-1,15,2,'#6c8076');
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
    for(const s of b.shots)drawGunTracer(output,s,0,street,reduced,true);
    for(const p of b.impacts)drawGunImpact(output,p,b.tick,0,street,reduced,true);
}
