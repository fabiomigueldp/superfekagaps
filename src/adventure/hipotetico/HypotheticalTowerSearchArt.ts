import {box,oval,pixelLine,polygon} from '../WorldPainting';
import {smoothMotion} from './HypotheticalMotion';
import {drawBystanders,drawCarriedBystander} from './HypotheticalBystanders';
import type {HypotheticalBackdrop} from './HypotheticalBackdrop';
import {TOWER_SEARCH} from './HypotheticalTowerSearch';

/** The reveal stays behind the dinosaur. The carried actor is drawn inside
 * its mouth layer; the intact fallen sprite stays with the disturbed ruins. */
export function drawTowerSearchActors(c:CanvasRenderingContext2D,b:HypotheticalBackdrop,base:number,reduced:boolean){
    const s=b.aftermath.tower.search,a=s.age,t=TOWER_SEARCH;
    if(a<t.reveal)return;
    if(a<t.clamp){
        c.save();c.beginPath();c.rect(s.person.x-22,base-52,44,48);c.clip();
        drawBystanders(c,b,base,reduced,false,[s.person],a);c.restore();
        const rise=1-smoothMotion((a-t.reveal)/28);
        if(rise>0){
            box(c,s.person.x-7,base-7,5,3,'#8b9985');box(c,s.person.x+3,base-6,6,2,'#a4aa90');
            pixelLine(c,s.person.x-6,base-8,s.person.x-3,base-8,'#c1b99a');
        }
    }
    const fallen=s.fallen;
    if(fallen){
        oval(c,fallen.x-18,base-5,35,3,'#718477');
        drawCarriedBystander(c,{person:s.person,angle:fallen.angle,kick:reduced?0:fallen.kick},fallen.x,base+fallen.y);
    }
}

export function drawTowerSearchDust(c:CanvasRenderingContext2D,b:HypotheticalBackdrop,base:number,reduced:boolean){
    const s=b.aftermath.tower.search;
    for(const p of s.dust){
        const a=s.tick-p.born;if(a<0||a>=64)continue;
        const fade=(1-smoothMotion((a-12)/52))*.5;
        c.save();c.globalAlpha=fade;
        for(let j=0;j<(reduced?2:4);j++){
            const x=p.x+(j-1.5)*(3+a*.12),y=base+p.y+Math.min(5,a*.09)-j%2*2,r=(2+a*.05)*p.strength*1.5;
            polygon(c,[[x-r,y],[x-r*.6,y-r],[x+r*.2,y-r*.8],[x+r,y-r*.4],[x+r*.7,y+1],[x-r*.5,y+1]],'#aab098');
            box(c,x-r*.5,y-r*.7,Math.max(1,r*.7),1,'#c1b99f');
        }
        c.restore();
    }
}
