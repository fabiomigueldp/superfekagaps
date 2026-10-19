import {polygon,pixelLine,type Point} from '../WorldPainting';
import type {HeldDebris} from './HypotheticalAftermathHandling';

/** The same authored component is drawn in the pile, between the teeth and on
 * the ground. Rotations are scan-converted, with no filtered sprite transforms. */
export function drawDebrisPiece(c:CanvasRenderingContext2D,x:number,y:number,p:HeldDebris,scale=1){
    const co=Math.cos(p.angle),si=Math.sin(p.angle);
    const point=(a:number,b:number):Point=>[x+(a*co-b*si)*scale,y+(a*si+b*co)*scale];
    const poly=(pts:Point[],color:string)=>polygon(c,pts.map(([a,b])=>point(a,b)),color);
    const line=(a:number,b:number,d:number,e:number,color:string,w=1)=>{
        const u=point(a,b),v=point(d,e);pixelLine(c,u[0],u[1],v[0],v[1],color,Math.max(1,w*scale));
    };
    if(p.material==='timber'){
        poly([[-15,-2],[13,-2],[16,0],[13,3],[-14,3]],'#647b70');
        poly([[-14,-2],[13,-2],[14,0],[12,1],[-13,1]],'#a99b78');
        line(-12,-2,11,-2,'#c2b48d');line(-8,0,7,0,'#8d876c');
        line(-10,-1,-10,1,'#516d70');line(8,-1,8,1,'#516d70');
        if(p.wear>0){line(-3,0,1,1,'#647b70');line(1,1,5,0,'#647b70');}
        if(p.wear>1){line(11,-1,14,0,'#d0be94');line(-14,1,-11,2,'#b5a580');}
    }else{
        poly([[-7,0],[-4,-5],[4,-6],[8,1],[4,5],[-5,4]],'#657c73');
        poly([[-6,0],[-3,-4],[3,-5],[6,0],[2,2],[-4,2]],'#a1ac97');
        poly([[2,2],[6,0],[6,2],[3,4],[-3,3]],'#80958a');
        line(-3,-4,2,-5,'#c4bfa1');line(-4,0,-1,-1,'#bbc0a6');
        if(p.wear>0){line(1,-3,0,0,'#657c73');line(0,0,2,2,'#657c73');}
        if(p.wear>1)line(4,1,5,3,'#506f70');
    }
}
