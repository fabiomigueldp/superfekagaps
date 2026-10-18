import { box as r, pixelLine as line, polygon, oval } from '../../WorldPainting';
import { sceneryTime } from './GuairaScenery';

/** Low-contrast farm buildings behind the fence explain the corral's place in
 * the irrigated valley. Everything ends above the quiet y174 combat backdrop. */
export function drawGuairaCorralOutbuildings(c:CanvasRenderingContext2D,cx:number,cy:number,time:number,reduced:boolean) {
    const x=Math.round(cx),y=Math.round(cy),t=sceneryTime(time,reduced);
    // Open hay shed with mortised frame, recessed bundles and a dirt footing.
    polygon(c,[[36-x,125-y],[45-x,109-y],[96-x,109-y],[104-x,125-y]],'#ac9880');
    polygon(c,[[40-x,122-y],[46-x,111-y],[95-x,111-y],[100-x,122-y]],'#b9a486');
    for(let xx=50;xx<96;xx+=9)line(c,xx-x,112-y,xx-4-x,122-y,'#c9b28e');
    r(c,42-x,126-y,55,29,'#a59b7b');r(c,46-x,128-y,47,24,'#b1a482');
    for(const xx of [43,92]){r(c,xx-x,125-y,4,31,'#9e9376');r(c,xx+1-x,127-y,1,27,'#c3ae88');}
    r(c,39-x,124-y,63,3,'#a99a7d');
    line(c,46-x,140-y,59-x,128-y,'#aaa180',2);line(c,92-x,140-y,79-x,128-y,'#aaa180',2);
    for(const [xx,yy,w]of [[50,141,18],[70,141,18],[60,132,18]]){
        r(c,xx-x,yy-y,w,10,'#bfaf82');r(c,xx+2-x,yy+2-y,w-4,1,'#cabb92');
        r(c,xx+5-x,yy-y,1,10,'#a69d79');r(c,xx+w-5-x,yy-y,1,10,'#a69d79');
    }
    r(c,40-x,154-y,60,3,'#b3a280');
    // A small service mill is fed by the same shallow field channel. The wheel
    // rotates about a fixed axle; no bright current or valve resembles danger.
    r(c,237-x,125-y,53,30,'#b6a98b');r(c,240-x,127-y,39,27,'#c1b293');
    polygon(c,[[232-x,126-y],[242-x,112-y],[282-x,112-y],[294-x,126-y]],'#ad9a81');
    polygon(c,[[237-x,123-y],[243-x,114-y],[282-x,114-y],[289-x,123-y]],'#bca88a');
    for(let xx=248;xx<283;xx+=9)line(c,xx-x,115-y,xx-4-x,122-y,'#cbbc98');
    r(c,233-x,126-y,59,2,'#a99a7d');
    r(c,248-x,134-y,12,21,'#9da28a');r(c,250-x,135-y,2,18,'#b9b697');
    r(c,269-x,133-y,10,11,'#a7ad91');r(c,273-x,134-y,1,9,'#c9bc98');
    r(c,235-x,154-y,56,4,'#b1a180');
    r(c,218-x,156-y,90,6,'#a6a386');r(c,220-x,157-y,86,3,'#98a78e');
    const wx=238-x,wy=148-y;
    oval(c,wx-10,wy-10,21,21,'#a59b7d');oval(c,wx-8,wy-8,17,17,'#bcc0a1');
    for(let blade=0;blade<8;blade++){
        const angle=t/6000+blade*Math.PI/4;
        line(c,wx,wy,wx+Math.round(Math.cos(angle)*8),wy+Math.round(Math.sin(angle)*8),'#9da084',2);
    }
    r(c,wx-2,wy-2,5,5,'#a59a7c');r(c,wx-1,wy-1,2,2,'#c7b58f');
    for(const [xx,yy,w]of [[45,164,42],[222,165,70]]){
        r(c,xx-x,yy-y,w,3,'#a9aa86');r(c,xx+4-x,yy+1-y,w-11,1,'#bcc09a');
    }
}
