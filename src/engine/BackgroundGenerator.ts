import { BackgroundLayerSpec } from '../types';
import { ART, hashAt, mixColor } from '../graphics/palette';

/** Deterministic authored pixel motifs, rasterized once at native resolution. */
export class BackgroundGenerator {
  static generateLayer(spec: BackgroundLayerSpec, width: number, height: number, scale = 1): HTMLCanvasElement {
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const c=canvas.getContext('2d')!;
    const r=(x:number,y:number,w:number,h:number,color:string)=>{
      c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.max(0,Math.round(w)),Math.max(0,Math.round(h)));
    };
    const seed=spec.type.split('').reduce((s,ch)=>s*31+ch.charCodeAt(0),0);
    const rand=(i:number)=>hashAt(i,width,seed)/4294967295;
    const base=spec.color, light=mixColor(base,ART.paper,.18), dark=mixColor(base,ART.ink,.18);
    const wrap=(x:number,extent:number,paint:(x:number)=>void)=>{
      for(const shift of [-width,0,width])if(x+shift+extent>=0&&x+shift-extent<=width)paint(x+shift);
    };
    if(spec.type==='clouds'){
      for(let i=0;i<5;i++){
        const x=Math.floor((i+.5)*width/5+(rand(i)-.5)*28), y=(spec.baseHeight??28)+Math.floor(rand(i+17)*18);
        const w=22+Math.floor(rand(i+20)*18);
        wrap(x,w,xx=>{
          r(xx-w/2,y+7,w,3,dark);r(xx-w/2+2,y+3,w-4,5,base);
          r(xx-w/2+7,y,w-14,6,base);r(xx-w/2+8,y+1,w-18,1,light);
          r(xx+w/2-6,y+4,8,3,base);
        });
      }
    }
    if(spec.type==='mountains'){
      const baseY=spec.baseHeight??112, rough=spec.roughness??16;
      for(let x=0;x<width;x++){
        const p=x/width*Math.PI*2;
        const ridge=Math.round(baseY-26-Math.abs(Math.sin(p*2+.5))*rough*2-Math.sin(p*5)*rough*.55);
        r(x,ridge,1,height-ridge,base);
        const facet=8+Math.round((Math.sin(p*3)+1)*8);
        if(Math.cos(p*2+.5)>0)r(x,ridge+3,1,facet,light);
        if(x%7===0 && rand(x)>.6)r(x,ridge+facet+8,1,5,dark);
      }
    }
    if(spec.type==='hills'){
      const baseY=spec.baseHeight??145;
      const hill=(x:number)=>Math.round(baseY-Math.sin(x/width*Math.PI*4)*11-Math.sin(x/width*Math.PI*10)*4);
      for(let x=0;x<width;x++)r(x,hill(x),1,height-hill(x),base);
      // Small woodland silhouettes establish scale, with deliberate quiet space above the path.
      for(let i=0;i<12;i++){
        const x=Math.floor(i*width/12+rand(i)*14), ground=hill(x)+6;
        const h=12+Math.floor(rand(i+30)*16), w=10+Math.floor(rand(i+40)*10);
        wrap(x,w,xx=>{
          r(xx-1,ground-h/2,3,h/2,dark);
          r(xx-w/2,ground-h+5,w,h/2,dark);
          r(xx-w/2+2,ground-h+2,w-4,h/2,base);
          r(xx-w/2+4,ground-h,w-8,3,light);
          r(xx-w/2+1,ground-h+6,5,3,light);
        });
      }
      for(let i=0;i<width;i+=29){const y=hill(i)+15;r(i,y,16,1,dark);}
    }
    if(spec.type==='castle_wall'){
      const baseY=spec.baseHeight??116;
      r(0,baseY,width,height-baseY,base);
      const step=width/8;
      for(let i=0;i<8;i++){
        const x=Math.floor(i*step), top=baseY-38-(i%3===0?12:0);
        wrap(x,20,xx=>{
          r(xx,top,20,baseY-top,base);r(xx-2,top,24,3,light);
          r(xx-2,top-4,5,4,base);r(xx+8,top-4,5,4,base);r(xx+17,top-4,5,4,base);
          r(xx+2,top+3,2,baseY-top-3,light);
          r(xx+8,top+14,5,12,dark);r(xx+9,top+12,3,3,dark);
        });
      }
      // Quiet irregular masonry, avoiding a high-contrast grid behind enemies.
      for(let y=baseY+8;y<height;y+=16)for(let x=0;x<width;x+=32){
        const xx=x+((y/16|0)%2)*16;r(xx,y,20,1,dark);r(xx,y-7,1,7,dark);
      }
    }
    if(spec.type==='city'){
      const baseY=spec.baseHeight??height;
      for(let i=0;i<10;i++){
        const x=Math.round((i+.2)*width/10), h=20+Math.floor(rand(i)*28), w=18;
        wrap(x,22,xx=>{
          r(xx,baseY-h,w,h,base);r(xx-2,baseY-h-3,w+4,3,dark);
          r(xx+2,baseY-h+1,1,h,light);r(xx+5,baseY-h+9,7,12,dark);
          r(xx+7,baseY-h+7,3,3,dark);
          if(i%3===0){r(xx+7,baseY-h+10,2,7,mixColor(base,ART.gold,.35));}
        });
      }
    }
    if(spec.type==='cavern'){
      const baseY=spec.baseHeight??40, rough=spec.roughness??12;
      for(let x=0;x<width;x++){
        const p=x/width*Math.PI*2;
        const ridge=Math.round(baseY+Math.sin(p*3)*rough+Math.sin(p*7)*rough*.4);
        r(x,ridge,1,height-ridge,base);
        const seam=Math.floor(x/18);
        if(seam%3===0)r(x,ridge+6,1,height-ridge-6,dark);
        if(x%18===1)r(x,ridge+8,1,31,light);
      }
      for(let i=0;i<18;i++){
        const x=Math.floor(i*width/18), h=7+Math.floor(rand(i+21)*18);
        wrap(x,12,xx=>{
          for(let yy=0;yy<h;yy++){const w=Math.max(1,Math.round(11*(1-yy/h)));r(xx-w/2,yy,w,1,dark);}
        });
      }
      for(let y=baseY+30;y<height;y+=28)for(let x=4;x<width;x+=37){
        r(x+(y%7),y,15,1,dark);r(x+15+(y%7),y+1,5,1,dark);
      }
    }
    if(spec.type==='crystals'){
      const baseY=spec.baseHeight??100;
      for(let i=0;i<6;i++){
        const x=Math.floor((i+.5)*width/6), y=baseY+Math.floor(rand(i)*44);
        wrap(x,12,xx=>{
          for(const [dx,h] of [[0,11],[-5,6],[5,7]]){
            r(xx+dx,y-h,1,1,light);r(xx+dx-1,y-h+1,3,h-1,base);r(xx+dx,y-h+2,1,h-2,light);
          }
          r(xx-8,y,16,2,dark);
        });
      }
    }
    if(scale===1)return canvas;
    const enlarged=document.createElement('canvas');enlarged.width=Math.ceil(width*scale);enlarged.height=Math.ceil(height*scale);
    const target=enlarged.getContext('2d')!;target.imageSmoothingEnabled=false;target.drawImage(canvas,0,0,enlarged.width,enlarged.height);
    return enlarged;
  }
}
