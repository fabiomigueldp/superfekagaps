import type {Point} from '../WorldPainting';
import {dinosaurHeadPoint} from './HypotheticalMotion';

/** Neck anchors stay attached to the rotating skull. The throat's displacement
 * belongs to the silhouette and scale rows, rather than an overlaid rectangle. */
export function captureNeck(body:number,neck:number,pitch:number,detail:number,swallow:number) {
    const joint=(x:number,y:number):Point=>{
        const p=dinosaurHeadPoint([x,neck+y],neck,pitch);
        return [x+(p[0]-x)*detail,neck+y+(p[1]-neck-y)*detail];
    };
    const path=(from:Point,to:Point,t:number):Point=>{
        const dx=to[0]-from[0],dy=to[1]-from[1],length=Math.max(1,Math.hypot(dx,dy));
        const wave=swallow>0&&swallow<1?Math.max(0,1-Math.abs(t-swallow)/.3)**2*Math.sin(swallow*Math.PI)*3.2:0;
        const curve=Math.sin(t*Math.PI)*1.2;
        return [from[0]+dx*t+(dy/length)*(curve+wave)*detail,from[1]+dy*t-(dx/length)*(curve+wave)*detail];
    };
    const outside=(t:number)=>path(joint(47,17),[25,body+19],t);
    const inside=(t:number)=>path(joint(38,13),[17,body+17],t);
    const outer:Point[]=[[1,body+5],[19,body-10],joint(29,-7),joint(45,-7),...Array.from({length:9},(_,i)=>outside(i/8)),[12,body+23]];
    const skin:Point[]=[[5,body+5],[22,body-10],joint(30,-4),joint(41,-3),...Array.from({length:9},(_,i)=>{
        const p=outside(i/8);return[p[0]-2,p[1]-2] as Point;
    }),[12,body+19]];
    const throat:Point[]=[joint(33,7),joint(40,9),...Array.from({length:9},(_,i)=>{
        const p=outside(i/8);return[p[0]-3,p[1]-1.5] as Point;
    }),...Array.from({length:8},(_,i)=>inside(1-i/8))];
    const folds=Array.from({length:5},(_,i)=>{
        const t=.12+i*.17,a=inside(t),b=outside(t);
        return {from:[a[0]+1,a[1]+1] as Point,to:[b[0]-4,b[1]-2] as Point};
    });
    return {outer,skin,throat,folds};
}
