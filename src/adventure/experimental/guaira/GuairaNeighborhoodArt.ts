import { box as r, pixelLine as line, polygon, oval } from '../../WorldPainting';
import { drawGuairaAwning, drawGuairaPerchedBird, drawGuairaTree, sceneryTime } from './GuairaScenery';
import { GUAIRA_COURSES, type GuairaCourseId } from './GuairaCourseDesign';
import { drawGuairaTiledRoof } from './GuairaBuildingFinish';

export type GuairaNeighborhoodProp = {
    kind: 'tree' | 'home' | 'store' | 'pump'; x: number; width: number; height: number; floor?: number;
};
/** Local world coordinates, chosen on complete banks. The raised workshop in
 * Subida uses its real y96 foundation rather than sinking into a y144 wall. */
export const GUAIRA_NEIGHBORHOODS: Partial<Record<GuairaCourseId, readonly GuairaNeighborhoodProp[]>> = {
    travessia: [
        {kind:'tree',x:16,width:64,height:83},
        {kind:'store',x:1200,width:128,height:79},
        {kind:'tree',x:1664,width:64,height:77},
        {kind:'home',x:2560,width:112,height:88},
    ],
    patio: [
        {kind:'tree',x:32,width:64,height:83},
        {kind:'pump',x:656,width:80,height:85},
        {kind:'store',x:1104,width:80,height:72},
        {kind:'tree',x:1456,width:64,height:89},
        {kind:'tree',x:1632,width:64,height:73},
        {kind:'store',x:2656,width:128,height:90},
    ],
    respiros: [
        {kind:'pump',x:16,width:128,height:96},
        {kind:'tree',x:512,width:64,height:83},
        {kind:'store',x:688,width:112,height:90},
        {kind:'tree',x:1968,width:64,height:84},
        {kind:'pump',x:2320,width:128,height:96},
    ],
    subida: [
        {kind:'home',x:16,width:128,height:100},
        {kind:'store',x:416,width:128,height:85},
        {kind:'pump',x:640,width:80,height:85},
        {kind:'store',x:1008,width:96,height:83,floor:96},
        {kind:'tree',x:1600,width:64,height:78},
        {kind:'home',x:1744,width:96,height:90},
        {kind:'pump',x:2240,width:112,height:95},
    ],
};

const P = {
    wall: '#d3b58e', side: '#b99b7b', shade: '#ab8c71', patch: '#c9aa85',
    light: '#e0c39a',
    wood: '#aa8c69', board: '#bda17c', green: '#929b7c', glass: '#9eafa0',
};
function window(c:CanvasRenderingContext2D,x:number,y:number,w=22,h=27) {
    r(c,x-2,y-2,w+4,h+4,P.side);r(c,x,y,w,h,'#8b927a');
    r(c,x+2,y+2,w-4,h-4,P.glass);r(c,x+3,y+3,3,h-6,'#bdc8ac');
    r(c,x+Math.floor(w/2),y+1,2,h-2,P.light);r(c,x+1,y+Math.floor(h/2),w-2,2,P.side);
    r(c,x-3,y+h+1,w+6,2,P.board);
    for(const xx of [x-6,x+w+2]){r(c,xx,y,4,h,P.green);r(c,xx+1,y+2,1,h-4,'#b0b18b');}
}
function fan(c:CanvasRenderingContext2D,x:number,y:number,time:number) {
    oval(c,x-12,y-12,25,25,P.shade);oval(c,x-10,y-10,21,21,'#a5a88b');
    const angle=time/4600;
    for(let blade=0;blade<4;blade++){
        const a=angle+blade*Math.PI/2;
        const point=(angle:number,radius:number):readonly[number,number]=>[x+Math.round(Math.cos(angle)*radius),y+Math.round(Math.sin(angle)*radius)];
        polygon(c,[point(a,2),point(a-.4,8),point(a+.3,9),point(a+.8,4)],'#8e977f');
    }
    for(const dx of [-5,5])line(c,x+dx,y-9,x+dx,y+9,'#b8ae8b');
    r(c,x-2,y-2,5,5,P.side);r(c,x-1,y-1,2,2,P.light);
}

/** Close scenery has complete eaves, recessed doors and grounded foundations.
 * It is still a rear plane: no cream caps, cyan liquid or interactive handles. */
export function drawGuairaNeighborhoodBuilding(c:CanvasRenderingContext2D,kind:Exclude<GuairaNeighborhoodProp['kind'],'tree'>,
    x:number,foot:number,w:number,h:number,time:number,worldX:number) {
    if(x+w+12<0||x-12>320||foot+8<0||foot-h-10>180)return;
    const top=foot-h;
    r(c,x+5,top+15,w-10,h-10,P.side);r(c,x+6,top+17,w-21,h-17,P.wall);
    // A broad patched face, with plaster loss at the foundation rather than
    // a new noisy texture on every tile or a crack resembling breakable clay.
    r(c,x+11,top+22,14,3,P.patch);r(c,x+14,top+25,7,4,P.patch);
    r(c,x+w-33,foot-17,13,8,P.patch);r(c,x+w-28,foot-20,8,4,P.patch);
    r(c,x+5,foot-9,w-10,14,'#b4a082');r(c,x+8,foot-7,w-17,2,'#c4ad87');
    for(let dx=16;dx<w-12;dx+=27)r(c,x+dx,foot-6,1,11,'#a38e73');
    drawGuairaTiledRoof(c,x,top,w);
    // Eave drain fixed at its elbow and buried below the true ground cap.
    r(c,x+w-10,top+17,3,h-10,'#a49c7e');r(c,x+w-9,top+18,1,h-12,'#c1b18d');
    for(let yy=top+31;yy<foot-5;yy+=29)r(c,x+w-11,yy,5,2,'#9a947a');
    if(kind==='home'){
        const dx=x+18;
        r(c,dx-3,foot-42,25,39,P.side);r(c,dx,foot-40,19,37,'#94836c');
        r(c,dx+2,foot-38,15,35,P.wood);r(c,dx+4,foot-36,1,30,P.board);
        r(c,dx+14,foot-21,1,2,'#d0b78a');
        drawGuairaAwning(c,dx-2,foot-46,24,time,worldX+16);
        window(c,x+w-48,top+30);
        // The bird's feet share the roof ridge, including when the camera pans.
        drawGuairaPerchedBird(c,x+w-26,top,time,worldX+w-26,-1);
        for(const dx of [8,w-18]){r(c,x+dx,foot-14,5,7,'#b39a74');r(c,x+dx-1,foot-15,7,2,'#c9ae82');
            line(c,x+dx+2,foot-15,x+dx,foot-23,'#9ba077');r(c,x+dx-3,foot-22,4,2,'#b2b388');}
    }else if(kind==='store'){
        const doorW=w>100?50:34,doorX=x+Math.floor((w-doorW)/2),doorY=top+32;
        r(c,doorX-4,doorY-3,doorW+8,foot-doorY-2,P.side);r(c,doorX,doorY,doorW,foot-doorY-4,'#a08e72');
        for(let dx=2;dx<doorW-2;dx+=7){r(c,doorX+dx,doorY+2,5,foot-doorY-7,P.board);r(c,doorX+dx,doorY+4,1,foot-doorY-10,'#c7ac82');}
        r(c,doorX-2,doorY+9,doorW+4,3,P.wood);r(c,doorX-2,foot-18,doorW+4,3,P.wood);
        line(c,doorX+2,foot-19,doorX+doorW-3,doorY+12,P.wood,2);
        r(c,doorX-7,doorY-7,doorW+14,3,'#9b957b');
        for(const dx of [1,doorW-3]){r(c,doorX+dx,doorY-8,3,6,P.side);r(c,doorX+dx+1,doorY-6,1,1,P.light);}
        // Bundles are inside the recess and grounded on its low stone sill.
        if(w>100)for(let i=0;i<2;i++){oval(c,x+12+i*8,foot-15-i*3,14,13,'#b4a77e');line(c,x+19+i*8,foot-13-i*3,x+21+i*8,foot-5-i*3,'#9b9070');}
    }else{
        const fx=x+Math.floor(w*.42),fy=top+35;fan(c,fx,fy,time);
        r(c,x+18,foot-34,w-43,22,P.side);r(c,x+21,foot-32,w-49,18,'#b3ad8c');
        for(let dx=24;dx<w-25;dx+=8){r(c,x+dx,foot-29,4,11,'#969e83');r(c,x+dx,foot-29,1,10,'#c1bc98');}
        r(c,x+w-27,top+28,5,h-28,'#929b80');r(c,x+w-26,top+29,1,h-30,'#bab495');
        for(const yy of [top+41,foot-20])r(c,x+w-29,yy,9,4,'#a6a184');
        r(c,x+w-30,foot-12,12,14,'#b6a788');r(c,x+w-28,foot-10,8,10,'#a4a285');
    }
}

export function drawGuairaNeighborhood(c:CanvasRenderingContext2D,id:GuairaCourseId,cx:number,cy:number,time:number,reduced:boolean){
    const g=GUAIRA_COURSES[id],x=g.start-Math.round(cx),y=Math.round(cy),t=sceneryTime(time,reduced);
    for(const prop of GUAIRA_NEIGHBORHOODS[id]??[]){
        const left=x+prop.x,foot=(prop.floor??g.floor)-y;
        if(prop.kind==='tree')drawGuairaTree(c,left+Math.floor(prop.width/2),foot+3,prop.height,t,g.start+prop.x,true);
        else drawGuairaNeighborhoodBuilding(c,prop.kind,left,foot,prop.width,prop.height,t,g.start+prop.x);
    }
}
