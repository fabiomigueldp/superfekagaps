import { BackgroundLayerSpec, LevelTheme } from '../types';
import { BackgroundGenerator } from '../engine/BackgroundGenerator';
import { mixColor } from './palette';

export const MEADOW_THEME: LevelTheme = {
  biome: 'meadow', skyGradient: ['#83bfc0', '#d4dfbc'],
  layers: [
    { type:'clouds', color:'#edf0d5', scrollFactor:.12, speedX:3, baseHeight:24 },
    { type:'mountains', color:'#79a5ae', scrollFactor:.18, baseHeight:120, roughness:12 },
    { type:'hills', color:'#528575', scrollFactor:.45, baseHeight:144 },
  ],
};
type Layer = { image:HTMLCanvasElement; spec:BackgroundLayerSpec };

/** Native pixel layers, periodic horizontally. Regions follow world Y, including negative origins. */
export class BackgroundScene {
  readonly theme:LevelTheme;
  private surface:Layer[];
  private underground:Layer[];
  constructor(theme:LevelTheme=MEADOW_THEME) {
    this.theme=theme;
    const compile=(layers:BackgroundLayerSpec[])=>layers.map(spec=>({spec,image:BackgroundGenerator.generateLayer(spec,640,180)}));
    this.surface=compile(theme.layers);this.underground=compile(theme.underground?.layers??[]);
  }
  draw(c:CanvasRenderingContext2D,camX:number,camY:number,width:number,height:number,time:number):void {
    const underground=this.theme.underground;
    const boundary=underground?underground.startRow*16-camY:height;
    const surfaceBottom=Math.max(0,Math.min(height,boundary));
    this.region(c,camX,camY,width,0,surfaceBottom,this.theme.skyGradient,this.surface,
      underground?underground.startRow*16-180:0,time);
    if(underground&&boundary<height)this.region(c,camX,camY,width,Math.max(0,boundary),height,
      underground.skyGradient,this.underground,underground.startRow*16,time);
  }
  private region(c:CanvasRenderingContext2D,camX:number,camY:number,width:number,top:number,bottom:number,
    sky:[string,string],layers:Layer[],worldY:number,time:number):void {
    if(bottom<=top)return;
    c.save();c.beginPath();c.rect(0,top,width,bottom-top);c.clip();c.imageSmoothingEnabled=false;
    const anchor=Math.round(worldY-camY);
    // Deliberate colour steps instead of a high resolution gradient.
    for(let y=Math.floor(top);y<bottom;y++) {
      const step=Math.round(Math.max(0,Math.min(1,(y-anchor)/180))*7)/7;
      c.fillStyle=mixColor(sky[0],sky[1],step);c.fillRect(0,y,width,1);
    }
    for(const {image,spec} of layers){
      const drift=camX*spec.scrollFactor+time/1000*(spec.speedX??0);
      const offset=-Math.round(((drift%image.width)+image.width)%image.width);
      // Solid silhouettes continue below their artwork; a descending camera must never reveal a sky strip.
      if(['mountains','hills','castle_wall','cavern'].includes(spec.type)&&anchor+image.height<bottom){
        c.fillStyle=spec.color;c.fillRect(0,Math.max(top,anchor+image.height),width,bottom-Math.max(top,anchor+image.height));
      }
      for(let x=offset;x<width;x+=image.width)c.drawImage(image,x,anchor);
    }
    c.restore();
  }
}
