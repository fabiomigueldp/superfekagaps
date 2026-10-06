import { TileType } from '../constants';
import { ART, Biome, hashAt, mixColor } from './palette';

const full = new Set<number>([TileType.GROUND,TileType.BRICK,TileType.BRICK_BREAKABLE,TileType.BLOCK_USED,TileType.POWERUP_BLOCK_HELMET,TileType.POWERUP_BLOCK_MINI_FANTA,TileType.CAVE_STONE,TileType.ICE,TileType.LAVA_TOP,TileType.LAVA_FILL]);
export function terrainMask(tiles:readonly (readonly number[])[],row:number,col:number):number {
  return (full.has(tiles[row-1]?.[col])?1:0)|(full.has(tiles[row]?.[col+1])?2:0)|
    (full.has(tiles[row+1]?.[col])?4:0)|(full.has(tiles[row]?.[col-1])?8:0);
}
export function lavaOffset(tiles:readonly (readonly number[])[],row:number,col:number):number {
  return row>0 && tiles[row-1]?.[col]===TileType.EMPTY?4:0;
}

/** Small bounded material atlas: neighbour mask × biome × variation × animation frame. */
export class TilePainter {
  private cache=new Map<string,HTMLCanvasElement>();
  draw(ctx:CanvasRenderingContext2D,type:number,x:number,y:number,tiles:readonly (readonly number[])[],row:number,col:number,
    biome:Biome,timeMs:number,worldCol=col,worldRow=row):void {
    if(type===TileType.EMPTY||type===TileType.HIDDEN_BLOCK)return;
    const mask=terrainMask(tiles,row,col), variant=hashAt(worldCol,worldRow)%16;
    const lava=type===TileType.LAVA_TOP||type===TileType.LAVA_FILL;
    const frame=lava?Math.floor(timeMs/160)%8:type===TileType.GLOW_CRYSTAL?Math.floor(timeMs/280)%4:0;
    const offset=lava?lavaOffset(tiles,row,col):0;
    const key=[type,mask,variant,biome,frame,offset,lava?((worldCol%4)+4)%4:0].join(':');
    let tile=this.cache.get(key);
    if(!tile){
      tile=document.createElement('canvas');tile.width=tile.height=16;
      this.paint(tile.getContext('2d')!,type,mask,variant,biome,frame,offset,worldCol);
      // Dynamic map editing can expose many combinations; avoid retaining an unbounded atlas.
      if(this.cache.size>=2048)this.cache.clear();
      this.cache.set(key,tile);
    }
    ctx.imageSmoothingEnabled=false;ctx.drawImage(tile,Math.round(x),Math.round(y));
    // Attached, quiet decoration, never a false platform. Shared by editor and game.
    if(type===TileType.GROUND && !(mask&1) && biome==='meadow' && hashAt(worldCol,worldRow)%7===1){
      const sway=Math.floor(timeMs/500+variant)%2;
      ctx.fillStyle=ART.leaf;ctx.fillRect(Math.round(x)+5,Math.round(y)-3,1,3);ctx.fillRect(Math.round(x)+10,Math.round(y)-2,1,2);
      ctx.fillStyle=ART.leafLight;ctx.fillRect(Math.round(x)+4+sway,Math.round(y)-4,2,2);
      ctx.fillStyle=ART.paper;ctx.fillRect(Math.round(x)+9,Math.round(y)-3,3,1);
      ctx.fillStyle=ART.gold;ctx.fillRect(Math.round(x)+10,Math.round(y)-3,1,1);
    }
  }

  private paint(c:CanvasRenderingContext2D,type:number,mask:number,v:number,biome:Biome,f:number,offset:number,col:number):void {
    const pattern=v>>2;v%=4;
    const r=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);};
    const stone=type===TileType.CAVE_STONE||(type===TileType.GROUND&&biome==='citadel');
    if(type===TileType.GROUND||type===TileType.CAVE_STONE){
      const dark=stone?ART.rockDark:ART.soilDark;
      const base=stone?ART.rock:biome==='ember'?'#79534d':ART.soil;
      const light=stone?ART.rockLight:biome==='ember'?'#b17b64':ART.soilLight;
      r(0,0,16,16,base);
      if(!(mask&8)){r(0,0,2,16,dark);r(2,3,1,10,light);}
      if(!(mask&2))r(14,0,2,16,dark);
      if(!(mask&4)){r(0,14,16,2,dark);r(2+v,13,6,1,dark);}
      // Four hand-placed cluster families × four shifts; calm interiors, crisp silhouettes.
      const quietDark=mixColor(base,dark,.52),quietLight=mixColor(base,light,.5);
      if(pattern===0){r(2+v,7,6,2,quietDark);r(3+v,6,4,1,quietLight);r(12-v,13,2,1,quietLight);}
      if(pattern===1){r(3,4+v,3,1,quietLight);r(9-v,11,5,2,quietDark);r(10-v,10,3,1,quietLight);}
      if(pattern===2){r(2+v,11,7,2,quietDark);r(3+v,10,5,1,quietLight);}
      if(pattern===3){r(11,5+v,3,1,quietDark);r(4,13-v,2,1,quietLight);}
      if(!(mask&1)){
        if(!stone&&biome==='meadow'){
          r(0,0,16,2,ART.leafLight);r(0,2,16,2,ART.leaf);
          for(let i=0;i<4;i++){const h=2+(i+v)%3;r(i*4,3,2,h,ART.leafDark);r(i*4+1,2,2,1,ART.leafLight);}
          r(1,0,3,1,ART.leafTip);r(9+v,0,3,1,ART.leafTip);
        }else{
          r(0,0,16,1,stone?ART.rockTop:ART.soilTop);r(0,1,16,2,light);
          r(4+v,2,3,1,base);r(12-v,1,2,1,base);r(1,3,5,1,dark);
        }
      }
      return;
    }
    if([TileType.BRICK,TileType.BRICK_BREAKABLE,TileType.BLOCK_USED,TileType.POWERUP_BLOCK_MINI_FANTA,TileType.POWERUP_BLOCK_HELMET].includes(type)){
      const brick=type===TileType.BRICK||type===TileType.BRICK_BREAKABLE;
      const base=biome==='citadel'?ART.rock:ART.soilLight, light=biome==='citadel'?ART.rockTop:ART.soilTop;
      r(0,0,16,16,ART.ink);r(1,1,14,14,base);r(1,1,14,1,light);r(1,1,1,13,light);
      r(2,14,13,1,biome==='citadel'?ART.rockDark:ART.soilDark);
      if(brick){
        r(1,7,14,1,ART.soilDark);r(7,1,1,6,ART.soilDark);r(4,8,1,6,ART.soilDark);r(12,8,1,6,ART.soilDark);
        r(2,8,10,1,light);
        if(type===TileType.BRICK_BREAKABLE){r(10,2,1,3,ART.ink);r(9,5,2,1,ART.ink);r(8,6,1,3,ART.ink);r(7,9,2,1,ART.ink);}
      }else if(type===TileType.BLOCK_USED){r(2,2,12,12,ART.rockDark);r(3,3,10,1,ART.rockLight);r(4,10,8,1,ART.rock);}
      else{
        r(2,2,12,12,ART.gold);r(3,3,10,1,ART.goldLight);r(3,12,10,1,ART.goldDark);
        if(type===TileType.POWERUP_BLOCK_HELMET){r(6,5,5,4,ART.ink);r(4,9,9,2,ART.ink);r(7,5,2,3,ART.goldLight);}
        else{r(6,5,5,7,ART.ink);r(7,4,3,1,ART.paper);r(7,6,3,5,ART.orange);r(7,8,3,1,ART.paper);}
      }
      return;
    }
    if(type===TileType.PLATFORM||type===TileType.PLATFORM_FALLING||type===TileType.CAVE_PLATFORM){
      const cave=type===TileType.CAVE_PLATFORM;
      r(0,0,16,1,cave?ART.rockTop:ART.soilTop);r(0,1,16,4,cave?ART.rockLight:ART.soilLight);r(0,5,16,1,ART.ink);
      r(1,3,10,1,cave?ART.rock:ART.soil);r(2,6,2,cave?3:2,cave?ART.rockDark:ART.soilDark);r(12,6,2,cave?2:3,cave?ART.rockDark:ART.soilDark);
      if(type===TileType.PLATFORM_FALLING){r(6,0,1,2,ART.ink);r(7,2,1,2,ART.ink);r(8,4,1,2,ART.ink);r(7,7,2,3,ART.soilDark);r(1,1,1,2,ART.gold);r(14,1,1,2,ART.gold);}
      return;
    }
    if(type===TileType.SPIKE){
      r(0,13,16,3,ART.ink);r(1,13,14,1,ART.rockLight);
      for(let i=0;i<3;i++){const x=i*5;for(let yy=6;yy<13;yy++){const w=yy<9?1:yy<11?3:5;r(x+2-Math.floor(w/2),yy,w,1,ART.rockLight);r(x+2,yy,1,1,ART.paper);}r(x+3,11,1,2,ART.rock);}
      return;
    }
    if(type===TileType.SPRING){
      r(2,12,12,4,ART.ink);r(3,12,10,1,ART.rockTop);r(4,14,8,1,ART.rock);
      for(let i=0;i<5;i++){r(4+i,7+i,2,1,ART.rockLight);r(10-i,7+i,2,1,ART.paper);}
      r(2,3,12,4,ART.ink);r(3,3,10,2,ART.red);r(4,3,8,1,ART.redLight);r(6,4,4,1,ART.goldLight);return;
    }
    if(type===TileType.ICE){
      r(0,0,16,16,ART.iceDark);r(1,1,14,13,ART.ice);r(1,0,14,2,ART.iceLight);r(2,4,5,1,ART.iceLight);r(9,7,4,1,ART.iceLight);
      r(3,8,3,1,ART.iceDark);r(6,9,2,1,ART.iceDark);r(8,10,1,4,ART.iceDark);r(0,14,16,2,ART.rock);return;
    }
    if(type===TileType.LAVA_TOP||type===TileType.LAVA_FILL){
      r(0,offset,16,16-offset,ART.redDark);
      const surface=type===TileType.LAVA_TOP||offset>0;
      for(let px=0;px<16;px++){
        const wx=((col%4)+4)%4*16+px;
        const wave=Math.round(Math.sin(wx*Math.PI/16+f*Math.PI/4));
        if(surface){r(px,offset,1,2+wave,ART.goldLight);r(px,offset+2+wave,1,2,ART.orange);}
        if((wx+f*2)%17<10)r(px,offset+7+(wave>0?1:0),1,2,ART.red);
      }
      r(2+(v+f)%7,12,3,1,ART.orange);return;
    }
    if(type===TileType.GLOW_CRYSTAL){
      r(3,14,10,2,ART.rockDark);
      for(const [cx,top,h] of [[7,2,12],[3,8,6],[11,7,7]]){
        r(cx,top,1,1,ART.tealLight);r(cx-1,top+1,3,h-1,ART.tealDark);r(cx-1,top+2,1,h-2,ART.teal);r(cx,top+1,1,h-2,ART.tealLight);
      }
      if(f===v){r(7,4,1,3,ART.white);r(6,5,3,1,ART.white);}return;
    }
  }
}
