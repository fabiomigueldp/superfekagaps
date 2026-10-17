import type {WorldObjects} from '../../WorldPhysics';
import {box as r,pixelLine as line,oval} from '../../WorldPainting';

/** The carried prop and its native 14×16 projectile share one pixel silhouette.
 * Rotation is drawn on the grid, never by rotating/scaling the canvas bitmap. */
export function drawGuairaBarrel(c:CanvasRenderingContext2D,x:number,y:number,rotation=0){
    c.save();c.translate(Math.round(x),Math.round(y));
    r(c,1,0,12,16,'#413f3d');r(c,0,2,14,12,'#413f3d');
    r(c,1,2,12,12,'#9b7e55');r(c,3,1,8,14,'#b99768');
    const pose=((Math.floor(rotation/(Math.PI/4))%4)+4)%4;
    if(pose===0){
        for(const xx of [2,6,10]){r(c,xx,2,1,12,'#665540');r(c,xx+1,2,1,12,'#c9a776');}
        for(const yy of [3,11]){r(c,1,yy,12,2,'#526e6b');r(c,2,yy,10,1,'#acc0a1');}
    }else if(pose===2){
        for(const yy of [2,6,10]){r(c,2,yy,10,1,'#665540');r(c,2,yy+1,10,1,'#c9a776');}
        for(const xx of [2,10]){r(c,xx,1,2,14,'#526e6b');r(c,xx,2,1,12,'#acc0a1');}
    }else{
        for(let i=0;i<3;i++){
            const yy=3+i*4;
            line(c,2,pose===1?yy:15-yy,11,pose===1?yy+1:14-yy,'#665540');
        }
        const bands=pose===1?[[1,7,7,1],[6,14,12,8]]:[[1,8,7,14],[6,1,12,7]];
        for(const [x1,y1,x2,y2]of bands){line(c,x1,y1,x2,y2,'#526e6b',2);line(c,x1,y1,x2,y2,'#acc0a1');}
    }
    r(c,3,1,7,1,'#e7c68d');r(c,2,4,1,4,'#ddbb85');r(c,11,10,1,3,'#71583f');
    c.restore();
}

/** Course scenery owns its object pass; live barrels must be painted there too,
 * including when they cross back into an introductory district. */
export function drawGuairaFoeProjectiles(c:CanvasRenderingContext2D,objects:WorldObjects,cx:number,cy:number,reduced=false){
    for(const b of objects.barrels){
        if(b.life<=0||b.x+b.width<cx||b.x>cx+320||b.y+b.height<cy||b.y>cy+180)continue;
        const x=Math.round(b.x-cx),y=Math.round(b.y-cy);
        if(b.vy===0)oval(c,x,y+b.height-1,b.width,2,'#705b4c');
        drawGuairaBarrel(c,x,y,reduced?0:b.rotation);
        const impact=b.landedAt===undefined?Infinity:objects.time-b.landedAt;
        if(!reduced&&impact>=0&&impact<150){
            const spread=Math.floor(impact/25);
            for(const dir of [-1,1]){r(c,x+6+dir*(7+spread),y+b.height-2,2,1,'#d6b486');r(c,x+6+dir*(4+spread),y+b.height-4,1,1,'#b99169');}
        }
    }
}
