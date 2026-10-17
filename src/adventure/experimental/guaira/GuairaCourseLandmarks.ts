import {box as r,pixelLine as line,oval} from '../../WorldPainting';
import {pixelText} from '../../../graphics/BitmapFont';
import {GUAIRA_COURSES,GUAIRA_COURSE_DETOURS,type GuairaCourseId} from './GuairaCourseDesign';
import {drawGuairaPipe,drawGuairaPipeSaddle} from './GuairaPipeArt';
import {guairaBreeze} from './GuairaScenery';

/** Landmarks explain what each raised route belongs to. They sit behind the
 * real tiles, use quiet values, and never add a decorative walkable cap. */
export function drawGuairaCourseLandmark(c:CanvasRenderingContext2D,id:GuairaCourseId,cx:number,cy:number,time:number,reduced:boolean){
    const g=GUAIRA_COURSES[id],d=GUAIRA_COURSE_DETOURS[id],x0=g.start-Math.round(cx),floor=g.floor-Math.round(cy);
    if(x0+d.end<0||x0+d.entry>320)return;
    const last=d.decks[d.decks.length-1],x=x0+last[0]-6,y=last[2]+12-Math.round(cy),w=last[1]-last[0]+12,h=Math.max(24,floor-y);
    if(id==='travessia'||id==='subida'){
        r(c,x,y,w,h,'#bd9e7b');r(c,x+4,y+2,w-8,h-2,'#ceb28b');
        for(let yy=y+12;yy<floor;yy+=18)r(c,x+4,yy,w-8,1,'#b99d7a');
        const door=x+Math.floor(w/2)-12;
        r(c,door,floor-42,24,42,'#a08364');r(c,door+2,floor-40,20,40,'#b49b77');
        for(let xx=door+5;xx<door+23;xx+=6)r(c,xx,floor-38,1,38,'#9b8265');
        line(c,door+2,floor-7,door+20,floor-35,'#987c61',2);
        pixelText(c,id==='travessia'?'ARROZ':'PORTARIA',x+w/2,y+6,'#897859',1,'center');
        if(id==='travessia')for(let i=0;i<3;i++){
            const sx=x-20+i*11,sy=floor-12-(i===1?9:0);oval(c,sx,sy,17,12,'#ac9e70');
            r(c,sx+5,sy+2,8,1,'#cfbd8b');line(c,sx+8,sy+3,sx+10,sy+9,'#938462');
        }
    }else if(id==='respiros'||id==='alivio'){
        // Riveted reservoir under the actual inspection deck. Its recessed
        // sight glass is muted; saturated cyan remains reserved for danger.
        r(c,x+4,y,w-8,h,'#a2a084');r(c,x+7,y+2,w-14,h-2,'#b4b193');
        r(c,x+10,y+3,3,h-5,'#c6bea0');r(c,x+w-13,y+2,5,h-2,'#939980');
        for(let yy=y+14;yy<floor;yy+=24){r(c,x+4,yy,w-8,3,'#8f947b');r(c,x+5,yy, w-10,1,'#c1b692');
            for(const dx of [8,w-10])r(c,x+dx,yy+1,1,1,'#d2c39a');}
        r(c,x+w/2-4,y+10,8,Math.min(50,h-18),'#8e927c');r(c,x+w/2-2,y+12,4,Math.min(46,h-22),'#a5b6a0');
        drawGuairaPipe(c,x-10,y+14,Math.max(12,h-14),true,time,reduced,true);
        drawGuairaPipeSaddle(c,x-6,y+27,true);
    }else if(id==='patio'){
        // Dock piles, rope sleeves and an anchored cross brace, behind actors.
        for(const dx of [10,w-14]){r(c,x+dx,y,6,h,'#aa8c6a');r(c,x+dx+1,y+2,2,h-2,'#c1a580');
            for(let yy=y+7;yy<y+17;yy+=3)r(c,x+dx-1,yy,8,2,'#c1ac7e');}
        line(c,x+15,y+16,x+w-14,floor-12,'#9c8667',3);line(c,x+w-12,y+16,x+13,floor-12,'#b49b75',2);
        r(c,x+28,y+16,w-56,17,'#baa17a');pixelText(c,'DOCAS',x+w/2,y+21,'#857759',1,'center');
    }else{
        // A fixed wall rack makes the gallery beam read as maintenance access.
        r(c,x+4,y,w-8,h,'#b69977');r(c,x+7,y+3,w-14,h-3,'#c6a880');
        for(let yy=y+16;yy<floor-16;yy+=24){r(c,x+12,yy,w-24,2,'#a38a69');
            for(let dx=17;dx<w-16;dx+=18){line(c,x+dx,yy+2,x+dx,yy+12,'#93957e',2);r(c,x+dx-3,yy+10,7,3,'#93957e');}}
        pixelText(c,'INSPECAO',x+w/2,y+5,'#897759',1,'center');
    }
    for(const[left,right,top,falling]of [...d.decks,...d.returns]){
        if(falling)continue;
        const a=x0+left,b=x0+right,yy=top+6-Math.round(cy);
        for(const xx of [a+3,b-6]){r(c,xx,yy,3,floor-yy,'#a48a68');r(c,xx+1,yy,1,floor-yy,'#c3a57c');}
        line(c,a+5,yy+23,a+23,yy+1,'#988063',2);line(c,b-5,yy+23,b-23,yy+1,'#988063',2);
    }
    const bannerX=x0+d.entry+32,bannerY=d.entryY+16-Math.round(cy),bend=reduced?0:guairaBreeze(time,g.start+d.entry,1);
    line(c,bannerX,bannerY,bannerX,bannerY+24,'#ac9672');
    r(c,bannerX+1,bannerY+2,12,7,'#a5aa7c');r(c,bannerX+9,bannerY+3+bend,5,5,'#a5aa7c');
}

/** Working scenery follows the authored banks and maintenance deck. Recessed
 * equipment stays quiet; only actual supports have a bright walkable edge. */
export function drawGuairaCourseFinale(c:CanvasRenderingContext2D,id:GuairaCourseId,cx:number,cy:number,time:number,reduced:boolean){
    const g=GUAIRA_COURSES[id],x=g.start-Math.round(cx),f=g.floor-Math.round(cy);
    if(id==='respiros'&&x+2896>=0&&x+2448<=320){
        // A masonry pump basin gives the lower fragile walk a visible purpose.
        r(c,x+2592,f+24,256,80,'#8c8f79');r(c,x+2598,f+29,244,75,'#7e9685');
        for(let i=0;i<3;i++){
            const xx=x+2624+i*80;
            r(c,xx,f+34,32,43,'#6e887b');r(c,xx+3,f+37,26,40,'#799284');
            r(c,xx+6,f+42,20,2,'#a2ac91');
        }
        const flow=reduced?0:Math.floor(time/180)%16;
        r(c,x+2598,f+54,244,25,'#568b8c');
        for(let dx=8;dx<236;dx+=32)r(c,x+2598+dx+flow,f+61+(dx%3),11,1,'#88aaa0');
        for(const xx of [x+2488,x+2860]){
            r(c,xx,f-42,5,42,'#9e8b6b');r(c,xx+1,f-40,2,39,'#bca47c');
        }
        // A rear pump housing, below the dock, does not masquerade as a step.
        r(c,x+2488,f-31,46,27,'#a99973');r(c,x+2491,f-28,40,22,'#b9a780');
        oval(c,x+2498,f-26,23,23,'#877e63');oval(c,x+2502,f-22,15,15,'#baa47b');
        line(c,x+2509,f-21,x+2509,f-9,'#8a8063',2);line(c,x+2503,f-15,x+2516,f-15,'#8a8063',2);
        pixelText(c,'DOCAS',x+2510,f-67,'#7d795c',1,'center');
        pixelText(c,'→',x+2548,f-45,'#809278');
        r(c,x+2864,f-92,64,92,'#b6a17c');r(c,x+2868,f-89,56,89,'#cab48b');
        for(const yy of [f-75,f-48,f-21]){r(c,x+2864,yy,64,3,'#9ca084');r(c,x+2866,yy,60,1,'#d7c69b');}
        r(c,x+2888,f-80,16,62,'#92987e');r(c,x+2891,f-77,10,56,'#a8b39a');
    }
    if(id==='alivio'&&x+2080>=0&&x+1680<=320){
        // Two recessed pressure vessels, each aligned with its own real outlet.
        for(const [left,w] of [[1752,80],[1960,80]]){
            r(c,x+left,f-111,w,94,'#a89d7e');r(c,x+left+4,f-108,w-8,87,'#b8ac89');
            for(const yy of [f-93,f-59,f-25]){
                r(c,x+left,yy,w,4,'#96977a');r(c,x+left+2,yy,w-4,1,'#cec09a');
                for(const dx of [7,w-9])r(c,x+left+dx,yy+2,1,1,'#ded0aa');
            }
            r(c,x+left+34,f-88,12,56,'#92977c');r(c,x+left+37,f-85,6,50,'#a7b49c');
        }
        r(c,x+1888,f-122,64,7,'#a28b69');
        for(const xx of [1892,1944]){r(c,x+xx,f-118,3,118,'#a18b6a');line(c,x+xx,f-91,x+1920,f-119,'#b4a07b',2);}
        pixelText(c,'2',x+1944,f-111,'#81775c',1,'center');
        pixelText(c,'1',x+1784,f-6,'#e5d2a2',1,'center');pixelText(c,'2',x+1992,f-6,'#e5d2a2',1,'center');
        pixelText(c,'↑',x+1702,f-81,'#809278');pixelText(c,'↓',x+2116,f-38,'#809278');
    }
}
