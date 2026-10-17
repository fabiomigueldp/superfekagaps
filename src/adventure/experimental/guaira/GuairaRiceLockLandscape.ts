import {box as r,pixelLine as line} from '../../WorldPainting';
import {GUAIRA_COURSES} from './GuairaCourseDesign';

/** The two real channels and the dry pier share one masonry lock. Recessed
 * water and fittings never paint a false landing over the open second span. */
export function drawGuairaRiceLock(c:CanvasRenderingContext2D,cx:number,cy:number,time:number,reduced:boolean){
    const g=GUAIRA_COURSES.travessia,x=g.start-Math.round(cx),f=g.floor-Math.round(cy);
    if(x+1168<0||x+624>320)return;
    for(const [left,right]of [[784,880],[960,1056]]){
        const a=x+left,b=x+right;
        r(c,a,f+15,b-a,100,'#9a9e85');r(c,a+4,f+19,b-a-8,96,'#7e9c8e');
        r(c,a+4,f+6,b-a-8,109,'#588b8a');
        for(const xx of [a+2,b-5]){r(c,xx,f+7,3,93,'#a6aa8b');r(c,xx+1,f+9,1,89,'#b4b895');}
        const flow=reduced?0:Math.floor(time/170)%24;
        for(let n=0;n<3;n++){
            const xx=a+8+(n*26+flow)%(b-a-20),yy=f+8+n*7;
            r(c,xx,yy,11,1,'#8db5aa');r(c,xx+4,yy+3,5,1,'#76a79e');
        }
        // Vertical rear grooves continue down to the basin; their low contrast
        // separates them from the solid tile caps and moving bridge.
        for(const xx of [a+12,b-16])line(c,xx,f+20,xx,f+89,'#70978b',2);
    }
    // Inspection marks belong to the permanent, safe half of the pier.
    for(const dx of [888,904]){r(c,x+dx,f+7,8,1,'#e0c38c');r(c,x+dx+2,f+9,4,1,'#8e7958');}
    // A low retaining frame ties the raised walkway to the lock's far wall.
    r(c,x+1058,f-33,11,33,'#a49b7c');r(c,x+1060,f-31,3,31,'#c3b58d');
    line(c,x+1064,f-31,x+1094,f-5,'#a59c7a',2);
}
