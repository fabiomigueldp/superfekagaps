import type { WorldFoe } from '../WorldEnemies';
import { box, pixelLine, polygon } from '../WorldPainting';
import { clamp } from '../types';
import { HypotheticalVanguard } from './HypotheticalVanguard';

/** A native-pixel edge cue keeps a committed strike readable during a high bounce.
 * It follows the attacker horizontally and disappears when the body returns. */
export function drawBastionEdgeCue(c:CanvasRenderingContext2D,foes:readonly WorldFoe[],cx:number,cy:number){
    const e=foes.find(e=>e instanceof HypotheticalVanguard&&!e.dead&&e.awake
        &&['warning','attack'].includes(e.phase)) as HypotheticalVanguard|undefined;
    if(!e||e.y+e.height/2-cy<=170)return;
    const center=e.x+e.width/2-cx;
    if(center<-32||center>352)return;
    const x=Math.round(clamp(center,10,310)),active=e.phase==='attack';
    const ink='#192e3b',edge=active?'#f1d29a':'#e9b65e';
    box(c,x-7,160,15,13,ink);box(c,x-6,160,13,1,'#647d82');
    box(c,x-2,162,5,3,'#94b9bc');box(c,x-1,161,2,2,edge);
    pixelLine(c,x-4,165,x+4,165,edge);box(c,x-3,166,7,3,'#34586a');
    box(c,x+1,166,3,1,'#d1e4cf');
    if(e.move==='sweep')pixelLine(c,x-4,169,x+5,169,edge);
    else if(e.move==='vault'){pixelLine(c,x-4,169,x-1,167,edge);pixelLine(c,x-1,167,x+2,169,edge);}
    else pixelLine(c,x+3,168,x+5,164,edge);
    const progress=active?1:clamp(e.actionTicks/e.tellTicks,0,1);
    box(c,x-5,171,11*progress,1,edge);
    polygon(c,[[x-3,174],[x+3,174],[x,177]],edge);
}
