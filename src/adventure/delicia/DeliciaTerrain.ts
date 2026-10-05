import type { Box, Floor } from './DeliciaContent';
import type { DeliciaSimulation } from './DeliciaSimulation';
import { movingFloor } from './DeliciaSimulation';

const stroke=(c:CanvasRenderingContext2D,x:number,y:number,xx:number,yy:number,color:string,width=2)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();};
const fill=(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
const bolt=(c:CanvasRenderingContext2D,x:number,y:number,r=3)=>{c.fillStyle='#d2b47d';c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};

/** Support structures are in the rear plane. The bright top lip is the only
 * playable surface; its position always comes from the collision rectangle. */
export function drawPlatformSupports(c:CanvasRenderingContext2D,sim:DeliciaSimulation):void {
 for(const f of sim.stage.floors){
  if(f.h>50||f.x+f.w<sim.cameraX-200||f.x>sim.cameraX+1160)continue;
  const b=movingFloor(f,sim.time);
  if(f.kind==='moving'){
   const left=f.x-18,right=f.x+f.w+(f.travel??0)+18,railY=f.y-85;
   const banks=sim.stage.floors.filter(g=>g.h>50);
   const leftY=banks.find(g=>left>=g.x&&left<g.x+g.w)?.y??f.y-17;
   const rightY=banks.find(g=>right>=g.x&&right<g.x+g.w)?.y??f.y-17;
   for(const [x,y] of [[left,leftY],[right,rightY]]){
    stroke(c,x,y,x,railY-5,'#4b5547',7);stroke(c,x-1,y,x-1,railY-5,'#9c9167',2);bolt(c,x,railY,5);
   }
   stroke(c,left,railY,right,railY,'#55543e',3);
   for(const x of [b.x+8,b.x+b.w-8]){stroke(c,x,railY,x,b.y+5,'#c6b581',2);bolt(c,x,railY,4);}
   continue;
  }
  const ground=sim.stage.floors.find(g=>g.h>50&&g.x<=f.x&&g.x+g.w>=f.x+f.w&&g.y>=f.y+f.h);
  if(!ground||f.kind==='spring')continue;
  if(f.kind==='lift'){
   const top=f.y-(f.travel??60)-24;
   for(const x of [f.x-9,f.x+f.w+9]){
    fill(c,x-4,top,8,ground.y-top,'#3d6358');fill(c,x-1,top+4,2,ground.y-top-4,'#9f9c71');
    fill(c,x-8,ground.y-8,16,8,'#b9a575');
   }
   fill(c,f.x-16,top-8,f.w+32,12,'#668579');
   for(const x of [f.x+8,f.x+f.w-8]){stroke(c,x,top+4,x,b.y,'#dbbf85',2);bolt(c,x,top,5);}
   continue;
  }
  c.save();c.globalAlpha=.86;
  const timber=f.material==='wood'||f.material==='grass'||f.kind==='crumble';
  const color=timber?'#695438':f.material==='brass'?'#38665d':'#8b8668';
  for(const x of [f.x+14,f.x+f.w-14]){
   fill(c,x-5,f.y+f.h,10,ground.y-f.y-f.h,color);
   stroke(c,x-2,f.y+f.h,x-2,ground.y,'#beaf7a66',2);
   fill(c,x-9,ground.y-7,18,7,color);
  }
  stroke(c,f.x+14,f.y+f.h+30,f.x+47,f.y+f.h,color,6);
  stroke(c,f.x+f.w-14,f.y+f.h+30,f.x+f.w-47,f.y+f.h,color,6);
  c.restore();
 }
}

/** Mirrored interior strips join without reintroducing the atlas's outer
 * corners at every tile. Surface caps and wall bodies are sampled separately. */
function textureStrip(c:CanvasRenderingContext2D,image:HTMLImageElement,sx:number,sy:number,sw:number,sh:number,b:Box,tileWidth:number,tileHeight:number):void {
 const first=Math.floor(b.x/tileWidth);
 for(let row=0;row<Math.ceil(b.h/tileHeight);row++)for(let col=first;col*tileWidth<b.x+b.w;col++){
  c.save();const flip=col%2!==0;c.translate(col*tileWidth+(flip?tileWidth:0),b.y+row*tileHeight);c.scale(flip?-1:1,1);
  c.drawImage(image,sx,sy,sw,sh,0,0,tileWidth,tileHeight);c.restore();
 }
}

export function drawTerrain(c:CanvasRenderingContext2D,f:Floor,b:Box,time:number,crumble:number,texture?:HTMLImageElement):void {
 const thin=b.h<=50,material=thin&&f.material==='grass'?'wood':f.material;
 const palette=material==='grass'?['#9ab956','#6f5635']:material==='wood'?['#d5b17a','#765536']:material==='brass'?['#d9b967','#2e524c']:['#edcf9c','#a1855d'];
 const y=b.y+Math.sin(time*35)*crumble*2,cap=thin?b.h:material==='grass'?16:24;
 c.save();c.beginPath();c.rect(b.x,y,b.w,b.h);c.clip();fill(c,b.x,y,b.w,b.h,palette[1]);
 if(texture){
  const index=material==='grass'?0:material==='stone'?1:material==='wood'?2:3,cw=texture.naturalWidth/2,ch=texture.naturalHeight/2;
  const sx=index%2*cw,sy=Math.floor(index/2)*ch,inset=cw*.035;
  if(!thin)textureStrip(c,texture,sx+inset,sy+ch*.19,cw-2*inset,ch*.81,{x:b.x,y:y+cap,w:b.w,h:b.h-cap},280,245);
  c.save();c.beginPath();c.rect(b.x,y,b.w,cap);c.clip();
  textureStrip(c,texture,sx+inset,sy+(material==='grass'?ch*.07:0),cw-2*inset,ch*(material==='grass'?.12:.16),{x:b.x,y,w:b.w,h:cap},280,cap);c.restore();
 }else fill(c,b.x,y,b.w,cap,palette[0]);
 if(!thin){
  const gradient=c.createLinearGradient(0,y+cap,0,y+320);gradient.addColorStop(0,'#14322d00');gradient.addColorStop(1,'#142d3288');c.fillStyle=gradient;c.fillRect(b.x,y+cap,b.w,b.h-cap);
  fill(c,b.x,y+cap,3,b.h-cap,'#f2d69b30');fill(c,b.x+b.w-5,y+cap,5,b.h-cap,'#233a3655');
 }
 stroke(c,b.x+1,y+1,b.x+b.w-1,y+1,material==='grass'?'#b7d675':'#fce4b4',2);
 stroke(c,b.x,y+cap-1,b.x+b.w,y+cap-1,'#2c393e99',2);
 if(thin){for(const x of [b.x+5,b.x+b.w-5])bolt(c,x,y+cap/2,2);}
 if(f.kind==='belt'){
  fill(c,b.x+3,y+3,b.w-6,8,'#243d39');
  for(let i=-1;i<b.w/22+1;i++){
   const x=b.x+i*22+(time*(f.beltSpeed??85)%22),direction=Math.sign(f.beltSpeed??85);
   stroke(c,x,y+5,x+direction*7,y+7,'#e2bf76',2);stroke(c,x+direction*7,y+7,x,y+9,'#e2bf76',2);
  }
 }
 if(f.kind==='spring'){
  fill(c,b.x+1,y,b.w-2,4,'#ffd171');
  for(let i=0;i<6;i++)stroke(c,b.x+7+i*8,y+5,b.x+11+i*8,y+10,'#e3bd78',2);
 }
 if(f.kind==='crumble'){
  stroke(c,b.x+b.w*.35,y,b.x+b.w*.42,y+7,'#453d2b',2);stroke(c,b.x+b.w*.42,y+7,b.x+b.w*.37,y+b.h,'#453d2b',2);
 }
 c.restore();
}
