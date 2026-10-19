import {oval} from '../WorldPainting';

/** A shadow modulates the street's existing colour; it is never a replacement
 * patch of paving. Keep the pixel silhouette and the caller's paint state. */
export function drawScenicShadow(c:CanvasRenderingContext2D,x:number,y:number,width:number,height:number,opacity=.24){
    c.save();
    c.globalCompositeOperation='multiply';
    c.globalAlpha*=Math.max(0,Math.min(1,opacity));
    oval(c,x,y,width,height,'#405953');
    c.restore();
}
