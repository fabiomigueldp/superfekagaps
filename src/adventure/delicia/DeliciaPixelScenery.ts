import { ART, hashAt } from '../../graphics/palette';
import { pixelText } from '../../graphics/BitmapFont';
import type { Floor } from './DeliciaContent';
import { movingFloor, type DeliciaSimulation } from './DeliciaSimulation';
import { DELICIA_UNIT as U } from './DeliciaNative';
import { line, polygon, px, type PixelContext as C } from './DeliciaSceneryPrimitives';
import { drawDeliciaProp } from './DeliciaPropArt';
export { px } from './DeliciaSceneryPrimitives';
export { drawDeliciaBackdrop } from './DeliciaPixelBackdrop';
export { drawDeliciaLiquid, drawDeliciaMachine } from './DeliciaObjectArt';

export function drawDeliciaTerrain(c:C,sim:DeliciaSimulation,f:Floor,index:number,time:number):void {
    const box=movingFloor(f,sim.time),x=(box.x-sim.cameraX)/U,y=(box.y-sim.cameraY)/U,w=f.w/U,h=f.h/U;
    if(x+w<0||x>320||y>180||(sim.crumble.get(index)??0)>1)return;
    if(!sim.floorAvailable(f)){for(let xx=0;xx<w;xx+=5)px(c,x+xx,y,2,1,ART.rockLight);return;}
    const wood=f.material==='wood',grass=f.material==='grass',brass=f.material==='brass';
    const base=wood?ART.soil:grass?ART.soil:ART.rock;
    const dark=wood||grass?ART.soilDark:ART.rockDark,light=wood?ART.soilTop:grass?ART.leafLight:brass?ART.gold:ART.rockTop;
    px(c,x,y,w,h,ART.ink);px(c,x+1,y+2,w-2,h-2,base);
    // All texture coordinates belong to the floor, never to the scrolling screen.
    // Clip small platforms so masonry, roots and braces cannot grow past collision bounds.
    c.save();c.beginPath();c.rect(Math.round(x)+1,Math.round(y)+4,Math.max(0,Math.round(w)-2),Math.max(0,Math.round(h)-5));c.clip();
    if(grass){
        for(let row=10;row<Math.min(h,190-y);row+=19){
            polygon(c,x,y+row,[[0,0],[17,3],[31,2],[52,6],[76,3],[98,4],[121,0],[w,3],[w,7],[117,4],[99,8],[74,7],[49,9],[30,5],[15,7],[0,4]],'#80564c');
        }
        for(let col=4;col<w-3;col+=17){
            const n=hashAt(f.x/U+col,f.y/U,7),depth=11+n%16;
            const root=x+col;
            line(c,root,y+5,root+3,y+12,ART.soilDark);line(c,root+3,y+12,root+1,y+depth,ART.soilDark);
            if(n%2){line(c,root+2,y+11,root+7,y+16,ART.soilDark);px(c,root+7,y+16,2,1,ART.soilLight);}
            px(c,root+1,y+6,1,4,ART.soilLight);
            const yy=18+n%15;px(c,root+7,y+yy,4+n%3,2,n%3===0?ART.soilTop:ART.soilLight);px(c,root+8,y+yy-1,3,1,ART.soilLight);
        }
    }else if(wood){
        for(let row=4;row<Math.min(h,190-y);row+=8){
            px(c,x+1,y+row,w-2,1,ART.soilDark);px(c,x+1,y+row+1,w-2,1,ART.soilLight);
            for(let col=-10;col<w;col+=31){
                const xx=col+(Math.floor(row/8)%2)*13,n=hashAt(f.x/U+xx,f.y/U+row,3);
                px(c,x+xx,y+row+1,1,7,ART.soilDark);px(c,x+xx+3,y+row+4,9+n%10,1,n%2?ART.soilTop:ART.soilDark);
                px(c,x+xx+2,y+row+2,1,1,ART.inkLight);px(c,x+xx+27,y+row+6,1,1,ART.inkLight);
                if(n%4===0){px(c,x+xx+15,y+row+3,4,1,ART.soilDark);px(c,x+xx+14,y+row+4,1,2,ART.soilDark);}
            }
        }
        if(h>22)for(let xx=8;xx<w;xx+=53){
            px(c,x+xx,y+5,7,h-5,ART.soilDark);px(c,x+xx+1,y+5,3,h-5,ART.soilLight);px(c,x+xx+1,y+9,5,3,ART.rockDark);px(c,x+xx+2,y+9,2,1,ART.rockLight);
            polygon(c,x+xx+6,y+14,[[0,0],[27,23],[27,28],[0,5]],ART.soilDark);line(c,x+xx+7,y+15,x+xx+31,y+36,ART.soilLight);
        }
    }else if(brass){
        for(let col=-1;col<w;col+=31){
            px(c,x+col,y+5,1,h-5,ART.rockDark);px(c,x+col+1,y+5,1,h-5,ART.rockLight);
            for(let row=7;row<h;row+=23){
                px(c,x+col+3,y+row,24,1,ART.rockDark);px(c,x+col+4,y+row+1,21,1,ART.rockLight);
                px(c,x+col+3,y+row+3,1,1,ART.goldDark);px(c,x+col+26,y+row+3,1,1,ART.goldDark);
                if(hashAt(col,row,f.x)%3===0)for(let vent=0;vent<3;vent++)px(c,x+col+11,y+row+6+vent*3,10,1,ART.rockDark);
            }
        }
        if(h>30)for(let xx=8;xx<w;xx+=67){px(c,x+xx,y+9,5,h-9,ART.rockDark);px(c,x+xx+1,y+9,2,h-9,ART.goldDark);px(c,x+xx+1,y+9,1,h-9,ART.soilTop);}
    }else{
        for(let row=4;row<Math.min(h,190-y);row+=13)for(let col=-20;col<w;col+=26){
            const xx=col+(Math.floor(row/13)%2)*13,n=hashAt(f.x/U+col,f.y/U+row,4);
            px(c,x+xx,y+row,25,1,ART.rockDark);px(c,x+xx,y+row+1,1,12,ART.rockDark);
            px(c,x+xx+2,y+row+2,21,1,n%3===0?ART.rockTop:ART.rockLight);px(c,x+xx+1,y+row+3,1,8,ART.rockLight);
            if(n%3===0){px(c,x+xx+14,y+row+10,8,1,ART.rockDark);px(c,x+xx+21,y+row+7,1,4,ART.rockDark);}
            if(n%5===0){px(c,x+xx+4,y+row+1,6,2,ART.leafDark);px(c,x+xx+5,y+row+3,2,3,ART.leafDark);}
        }
    }
    c.restore();
    px(c,x,y,w,1,ART.ink);px(c,x+1,y+1,w-2,2,light);px(c,x+1,y+3,w-2,1,dark);
    if(grass){
        px(c,x+1,y+3,w-2,3,ART.leafDark);
        for(let col=3;col<w-3;col+=6){const n=hashAt(f.x/U+col,0,7);px(c,x+col,y+2,3,2,ART.leaf);px(c,x+col,y+5,2,Math.min(h-6,2+n%3),ART.leafDark);if(n%3===0)px(c,x+col,y+1,2,1,ART.leafTip);}
    }
    if(brass)for(let col=5;col<w-3;col+=13){px(c,x+col,y+5,2,2,ART.goldDark);px(c,x+col,y+5,1,1,ART.goldLight);}
    if(f.kind==='belt'){
        px(c,x+1,y,w-2,4,ART.ink);const direction=Math.sign(f.beltSpeed??85),offset=Math.floor(time*Math.abs(f.beltSpeed??85)/U)%9;
        for(let col=2;col<w-7;col+=9){const xx=x+col+offset*direction;px(c,Math.max(x+2,xx),y+1,Math.min(5,x+w-2-xx),1,ART.gold);}
    }
    if(f.kind==='spring'){
        px(c,x+1,y+1,w-2,Math.max(3,h-1),ART.ink);
        for(let xx=4;xx<w-5;xx+=4){line(c,x+xx,y+1,x+xx+2,y+3,ART.rockLight);line(c,x+xx+2,y+3,x+xx+4,y+1,ART.goldLight);}
        px(c,x+2,y+h-1,w-4,1,ART.rockLight);
        px(c,x+2,y-2,w-4,3,ART.redDark);px(c,x+3,y-2,w-6,1,ART.redLight);
        pixelText(c,'↑',Math.round(x+w/2),Math.round(y-12),ART.goldLight,1,'center');
    }
    if(f.kind==='moving'||f.kind==='bridge'){
        px(c,x+3,y-10,2,10,ART.soilDark);px(c,x+w-5,y-10,2,10,ART.soilDark);px(c,x+3,y-10,w-6,1,ART.soilTop);
        for(let xx=8;xx<w-6;xx+=7)px(c,x+xx,y-9,1,7,ART.soilLight);
    }
    if(f.kind==='lift')for(const xx of [x+2,x+w-3])for(let yy=Math.max(0,y-(f.travel??88)/U-25);yy<y;yy+=4){px(c,xx,yy,2,3,ART.rockDark);px(c,xx,yy,1,1,ART.goldLight);}
    if(f.kind==='crumble'){
        for(let col=5;col<w-4;col+=15){px(c,x+col,y+1,1,3,ART.soilDark);px(c,x+col+1,y+3,2,1,ART.soilDark);}
        if((sim.crumble.get(index)??0)>.25)for(let col=5;col<w;col+=9)px(c,x+col,y+6,1,3,ART.goldLight);
    }
}

export function drawDeliciaProps(c:C,sim:DeliciaSimulation,time=0):void {
    for(const f of sim.stage.floors){
        if(f.h<50||f.w<90||f.kind==='moving'||f.kind==='lift')continue;
        const x=(f.x-sim.cameraX)/U,y=(f.y-sim.cameraY)/U,w=f.w/U;if(x+w<0||x>320)continue;
        // Dressing sits behind the lane and actors; its base remains attached to the floor.
        drawDeliciaProp(c,sim.stage.biome,x+w-23,y,hashAt(f.x,f.y,14),time);
    }
}
