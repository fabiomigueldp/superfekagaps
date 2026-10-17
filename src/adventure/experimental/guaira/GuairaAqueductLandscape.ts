import {box as r,pixelLine as line,polygon} from '../../WorldPainting';
import {pixelText} from '../../../graphics/BitmapFont';
import {GUAIRA_COURSES,type GuairaCourseId} from './GuairaCourseDesign';

/** Radial voussoirs carry a continuous header into two piers. The underside
 * rises towards the keystone; the former inverted V looked like timber braces. */
export function drawGuairaAqueductArch(c:CanvasRenderingContext2D,x:number,top:number,foot:number){
    if(x+128<0||x>320)return;
    const centre=x+64,spring=top+51,outer=47,inner=36;
    // Fill above the arch's extrados; the opening keeps the existing valley.
    for(let dx=0;dx<128;dx++){
        const distance=dx-64;
        const end=Math.abs(distance)<outer?spring-Math.sqrt(outer*outer-distance*distance):spring;
        r(c,x+dx,top,1,Math.max(1,Math.ceil(end-top)),'#c1ad89');
    }
    for(let wedge=0;wedge<11;wedge++){
        const a=Math.PI+wedge*Math.PI/11,b=Math.PI+(wedge+1)*Math.PI/11;
        const point=(angle:number,radius:number):readonly[number,number]=>
            [centre+Math.round(Math.cos(angle)*radius),spring+Math.round(Math.sin(angle)*radius)];
        polygon(c,[point(a,outer),point(b,outer),point(b,inner),point(a,inner)],wedge%3===1?'#cbb791':'#baa786');
        line(c,...point(a,inner+1),...point(a,outer-1),'#b09e7f');
    }
    r(c,centre-3,top+3,7,12,'#d0bc95');r(c,centre-2,top+4,4,1,'#dbc69c');
    for(const left of [x,x+100]){
        r(c,left,spring,28,foot-spring,'#b7a483');
        r(c,left+3,spring,3,foot-spring,'#c4b08b');
        r(c,left+25,spring,3,foot-spring,'#aa9b7e');
        for(let yy=spring+14,row=0;yy<foot;yy+=22,row++){
            r(c,left+2,yy,23,1,'#a99a7d');r(c,left+9+(row%2)*7,yy+1,1,19,'#b09f80');
        }
        r(c,left-3,foot-9,34,10,'#ad9f80');
        r(c,left+4,foot-14,4,9,'#a2a180');
    }
    r(c,x,top,128,3,'#c9b58e');
    r(c,x+3,top+3,122,1,'#b4a281');
}

/** Recessed architecture follows the real masonry and shaft. Only collision
 * caps receive the bright walkable edge from the terrain painter. */
export function drawGuairaAqueductLandscape(c:CanvasRenderingContext2D,id:GuairaCourseId,cx:number,cy:number,time:number,reduced:boolean){
    if(id!=='subida'&&id!=='galeria')return;
    const g=GUAIRA_COURSES[id],x=g.start-Math.round(cx),y=-Math.round(cy),f=g.floor+y;
    if(id==='subida'){
        if(x+3200<0||x+2320>320)return;
        // A distant aqueduct gives the climb a destination without adding false
        // platforms. Piers and shadowed arches stay behind the playable wall.
        for(let a=2384;a<3200;a+=128){
            const top=y+18-Math.floor((a-2384)/256)*16;
            drawGuairaAqueductArch(c,x+a,top,f+52);
        }
        // Vegetation and drains are rooted below the actual wall caps.
        for(const [left,top]of [[2448,96],[2736,48]]){
            r(c,x+left-9,y+top+20,9,30,'#9b9e78');
            for(let n=0;n<5;n++)line(c,x+left-4,y+top+20+n*6,x+left-10+(n%2)*7,y+top+25+n*6,'#b4b388');
        }
        // The rope sags below the fragile span, never across its open gaps.
        line(c,x+2640,y+72,x+2664,y+84,'#a79b7a');line(c,x+2664,y+84,x+2688,y+72,'#a79b7a');
        r(c,x+2376,f-29,58,12,'#baa580');pixelText(c,'AQUEDUTO ↑',x+2405,f-26,'#6f7357',1,'center');
        r(c,x+2976,y-28,88,76,'#cbb28b');r(c,x+2990,y+8,29,40,'#a59273');
        r(c,x+2993,y+10,23,38,'#bba17c');line(c,x+2995,y+44,x+3013,y+15,'#9c896a');
        r(c,x+3031,y-5,18,22,'#b4a482');r(c,x+3034,y-3,12,17,'#8d9e88');
        r(c,x+3039,y-3,2,17,'#d1bb91');r(c,x+3034,y+4,12,2,'#d1bb91');
        pixelText(c,'VAZAO',x+3020,y-20,'#918465',1,'center');
    }else{
        if(x+2736<0||x+1824>320)return;
        // The inspection room can be seen through the hatch and exit. Its dark
        // ceiling separates the lower loop from the pressure corridor above.
        r(c,x+1888,f+16,480,80,'#a88f70');r(c,x+2000,f+20,256,76,'#b39a78');
        for(let a=2016;a<2256;a+=64){r(c,x+a,f+22,2,69,'#9d886b');r(c,x+a+2,f+24,1,65,'#c0a882');}
        r(c,x+1968,f+16,288,5,'#8e7d63');
        r(c,x+1888,f+18,3,72,'#c7ad83');r(c,x+2365,f+18,3,72,'#c7ad83');
        r(c,x+1901,f+31,41,13,'#b7a27a');pixelText(c,'REGISTRO →',x+1922,f+34,'#695f4f',1,'center');
        r(c,x+2243,f+30,27,12,'#c1aa80');pixelText(c,'↑',x+2256,f+32,'#746e54',1,'center');
        // Lamps illuminate the route; optional water drips land in a recessed
        // drain below the actual floor, away from damaging-jet colours.
        for(const a of [2024,2184,2344]){
            r(c,x+a,f+23,8,6,'#8f785c');r(c,x+a+2,f+24,4,3,'#e4cb8d');
        }
        r(c,x+2024,f+99,200,2,'#879581');
        if(!reduced){const dy=Math.floor(time/90)%58;r(c,x+2054,f+30+dy,1,2,'#b4bfa2');}
        r(c,x+1876,f-32,75,13,'#b8a17a');pixelText(c,'↓ INSPECAO',x+1913,f-29,'#74694f',1,'center');
        // The continuous workshop painter owns the windows here. Repainting
        // the old pair placed a second, flat window across its recessed bays.
    }
}
