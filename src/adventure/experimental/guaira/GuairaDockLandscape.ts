import {box as r,pixelLine as line,oval} from '../../WorldPainting';
import {pixelText} from '../../../graphics/BitmapFont';
import {GUAIRA_COURSES,type GuairaCourseId} from './GuairaCourseDesign';

/** These buildings explain the route's use. Recessed wall values stay behind
 * actors; bright deck edges belong exclusively to actual native supports. */
export function drawGuairaDockLandscape(c:CanvasRenderingContext2D,id:GuairaCourseId,cx:number,cy:number,time:number,reduced:boolean){
    if(id!=='travessia'&&id!=='patio')return;
    const g=GUAIRA_COURSES[id],x0=g.start-Math.round(cx),f=g.floor-Math.round(cy);
    const water=(left:number,right:number,depth=22)=>{
        r(c,x0+left,f+depth,right-left,130,'#839e91');r(c,x0+left,f+depth,right-left,1,'#b8c1a0');
        const drift=reduced?0:Math.floor(time/240)%18;
        for(let yy=0;yy<60;yy+=17)for(let xx=left+9+(yy%3)*7;xx<right-14;xx+=39){
            const width=Math.min(13,right-xx-drift-2);if(width>0)r(c,x0+xx+drift,f+depth+8+yy,width,1,'#a6b8a0');
        }
    };
    if(id==='travessia'){
        if(x0+2528<0||x0+1904>320)return;
        water(2160,2240);water(2304,2400);
        const x=x0+2064,y=f-84;
        r(c,x-4,y,72,84,'#bd9f7b');r(c,x,y+2,64,82,'#cfb48d');
        for(let yy=y+17;yy<f;yy+=18)r(c,x,yy,64,1,'#bda17b');
        r(c,x+10,f-38,44,38,'#a38e6b');r(c,x+12,f-36,40,36,'#b39c77');
        for(let dx=15;dx<54;dx+=8)r(c,x+dx,f-34,1,34,'#9c8665');
        line(c,x+13,f-5,x+50,f-32,'#998564',2);
        pixelText(c,'ARROZ',x+32,y+8,'#8a795c',1,'center');
        for(let i=0;i<3;i++){
            const sx=x0+2016+i*10,sy=f-10-(i===1?8:0);
            oval(c,sx,sy,16,10,'#b2a67c');r(c,sx+4,sy+2,8,1,'#d1bf8c');line(c,sx+7,sy+3,sx+9,sy+8,'#9c8f6a');
        }
        for(const [left,right,top]of [[2064,2128,f-96],[2336,2432,f-96],[2432,2480,f-64],[2480,2528,f-32]]){
            for(const dx of [left+4,right-7]){
                const base=dx>=2304&&dx<2400?f+76:f;
                r(c,x0+dx,top+6,3,base-top-6,'#a48d6d');r(c,x0+dx,top+8,1,base-top-8,'#c1a880');
                line(c,x0+dx,top+24,x0+dx+(dx===left+4?18:-18),top+7,'#aa9370',2);
            }
        }
        // A muted rope hangs beneath the fragile span; it is not a hidden floor.
        line(c,x0+2208,f-88,x0+2232,f-78,'#b9a880');line(c,x0+2232,f-78,x0+2256,f-88,'#b9a880');
        r(c,x0+1944,f-32,43,13,'#bda37b');pixelText(c,'↑ ARROZ',x0+1966,f-29,'#726c50',1,'center');
        for(let xx=2248;xx<2298;xx+=12){line(c,x0+xx,f+6,x0+xx+1,f-3,'#a0a676');line(c,x0+xx+1,f-3,x0+xx+6,f,'#b8b382');}
    }else{
        if(x0+2672<0||x0+1808>320)return;
        water(2176,2336,96);water(2384,2560,96);
        // Receiving banks have masonry shoulders; nothing covers the gap or
        // pretends that the decorative head of a hoist is a landing.
        for(const [left,right,top]of [[2144,2176,f],[2336,2384,f-48],[2560,2592,f]]){
            r(c,x0+left,top+7,right-left,93,'#b09b79');
            for(let yy=top+18;yy<top+100;yy+=16){r(c,x0+left,yy,right-left,1,'#9b8f71');
                r(c,x0+left+((yy/16|0)%2?12:26),yy-12,1,12,'#9b8f71');}
            r(c,x0+left+3,top+9,2,78,'#c8b58d');
        }
        for(const [x,label]of [[2112,'1'],[2356,'2']] as const){
            r(c,x0+x-7,f+(label==='1'?0:-46)+8,15,12,'#b8a27a');
            pixelText(c,label,x0+x,f+(label==='1'?0:-46)+10,'#807557',1,'center');
        }
        // Dry storage behind the thrower's approach, below the walkable cap.
        for(const [x,h]of [[1844,22],[1870,14]]){
            r(c,x0+x,f-h,18,h,'#b19b77');r(c,x0+x+2,f-h+2,14,2,'#cbb48b');
            line(c,x0+x+3,f-3,x0+x+14,f-h+5,'#9b8869');
        }
    }
}
