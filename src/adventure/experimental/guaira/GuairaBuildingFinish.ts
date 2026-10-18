import { box as r, pixelLine as line, polygon } from '../../WorldPainting';

/** The same baked tiles and eave join the older streets to the new districts.
 * Roofs are muted scenery; the pale collision cap belongs to native terrain. */
export function drawGuairaTiledRoof(c:CanvasRenderingContext2D,x:number,y:number,w:number) {
    polygon(c,[[x-3,y+14],[x+7,y],[x+w-11,y],[x+w+3,y+14]],'#8f705f');
    polygon(c,[[x,y+11],[x+8,y+1],[x+w-12,y+1],[x+w-1,y+11]],'#a47867');
    for(let dx=12;dx<w-10;dx+=9){line(c,x+dx,y+2,x+dx-4,y+11,'#c29679');r(c,x+dx-5,y+8,5,1,'#b88a71');}
    r(c,x-3,y+14,w+6,3,'#ab8c71');r(c,x-1,y+15,w+2,1,'#bda17c');
}

/** The facade's exact wall/eave coordinates keep drains attached on small
 * houses as well as warehouses. Footings are broad courses, not dotted noise. */
export function drawGuairaFacadeFinish(c:CanvasRenderingContext2D,x:number,wallTop:number,w:number,foot:number) {
    if(x+w+8<0||x-8>320||foot+3<0||wallTop>180)return;
    r(c,x+4,foot-6,w-8,8,'#b4a082');r(c,x+6,foot-5,w-12,1,'#c5ad88');
    for(let dx=17;dx<w-9;dx+=26)r(c,x+dx,foot-3,1,5,'#a38e73');
    const drain=x+w-9;
    r(c,drain-4,wallTop-1,7,3,'#a49c7e');
    r(c,drain,wallTop,3,foot-wallTop,'#a49c7e');r(c,drain+1,wallTop+1,1,foot-wallTop-2,'#c1b18d');
    for(let yy=wallTop+13;yy<foot-6;yy+=24)r(c,drain-1,yy,5,2,'#97927a');
    r(c,drain-2,foot-5,6,6,'#aaa184');r(c,drain-1,foot-4,1,3,'#c0ae8c');
}
