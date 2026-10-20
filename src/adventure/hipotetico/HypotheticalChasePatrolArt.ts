import {box,oval,pixelLine,polygon,type Point} from '../WorldPainting';
import {guardFoot} from './HypotheticalGuardArt';
import {smoothMotion} from './HypotheticalMotion';
import type {HypotheticalChasePatrol} from './HypotheticalChasePatrol';

const C={ink:'#172c36',cloth:'#304659',shade:'#203644',light:'#758a96',skin:'#edbc8e',
    bronze:'#d3a75c',rim:'#f0d4a1',wood:'#856350',grain:'#b98b66',jade:'#627c78',mint:'#99d1bd'};

/** Native-scale articulated silhouettes. Preparation is carried by posture,
 * the cable and hands; there are no instruction labels or attack counters. */
export function drawChasePatrol(c:CanvasRenderingContext2D,e:HypotheticalChasePatrol,cx:number,cy:number,reduced:boolean){
    const cart=e.cart;
    if(cart&&(!cart.broken||cart.impactAge<420)){
        const x=cart.x-cx,y=cart.y-cy;
        const fall=cart.broken?Math.min(1,cart.impactAge/300):0;
        if(x>-48&&x<352){
            const tilt=fall*.2,at=(u:number,v:number):Point=>[x+u*Math.cos(tilt)-v*Math.sin(tilt),y+v*Math.cos(tilt)+u*Math.sin(tilt)];
            const rect=(u:number,v:number,w:number,h:number,col:string)=>polygon(c,[at(u,v),at(u+w,v),at(u+w,v+h),at(u,v+h)],col);
            oval(c,x-2,y+15,34,4,'#263f3d');
            rect(0,1,28,12,C.ink);rect(2,2,24,9,C.wood);
            rect(3,3,22,1,C.grain);rect(3,7,22,1,'#594e4d');
            for(const u of [4,22]){rect(u,1,2,12,C.jade);rect(u,2,1,2,C.rim);}
            rect(1,11,27,3,C.jade);rect(2,11,25,1,C.light);
            for(const u of [6,22]){
                const yy=y+14+Math.sin(fall*Math.PI)*u*.12;
                oval(c,x+u-4,yy-3,7,7,C.ink);oval(c,x+u-3,yy-2,5,5,C.bronze);
                const a=cart.distance/3;
                pixelLine(c,x+u-Math.cos(a)*2,yy-Math.sin(a)*2,x+u+Math.cos(a)*2,yy+Math.sin(a)*2,C.wood);
                box(c,x+u,yy,1,1,C.rim);
            }
            if(!cart.broken){
                rect(7,-3,16,4,C.ink);rect(8,-2,14,3,C.grain);
                pixelLine(c,x+11,y-2,x+19,y+9,C.bronze);
                if(!cart.released){
                    const strain=e.phase==='warning'?smoothMotion(e.timer/e.warningDuration):0;
                    pixelLine(c,x+25,y+3,e.x+e.width/2-cx,e.y+e.height-7-cy,C.ink,2);
                    pixelLine(c,x+25,y+2,e.x+e.width/2-cx,e.y+e.height-8-cy,C.bronze);
                    box(c,x+26,y+5-strain*3,3,3,C.rim);
                }
            }else if(!reduced)for(let i=0;i<5;i++){
                const a=cart.impactAge/16.67,xx=x+14+(i-2)*a*.5,yy=y+10-Math.sin(fall*Math.PI)*(9+i*2);
                pixelLine(c,xx,yy,xx+4,yy+i%2,C.grain);
            }
        }
    }
    if(e.dead&&e.deadTimer>360)return;
    const x=e.x+e.width/2-cx,y=e.y+e.height-cy,d=e.facing;
    if(x<-40||x>360)return;
    const wind=e.phase==='warning'?smoothMotion(e.timer/e.warningDuration):0;
    const attacking=e.phase==='attack',loader=e.patrol.role==='loader';
    const dead=e.dead?smoothMotion(e.deadTimer/360):0;
    const moving=Math.abs(e.motionX)>.02;
    const crouch=wind*(loader?2:3)+(e.landedAt>=0&&e.age-e.landedAt<100?Math.sin((e.age-e.landedAt)/100*Math.PI)*2:0);
    const lean=wind*-2+(attacking?(loader?2:4):moving?2:0);
    const bob=reduced||!moving?0:-(Math.sin(e.distance/20*Math.PI*2)**2);
    const at=(u:number,v:number):Point=>[Math.round(x+d*(u+lean*Math.max(0,-v)/24)),Math.round(y+v+crouch+bob+dead*14)];
    const line=(u:number,v:number,uu:number,vv:number,col:string,width=1)=>pixelLine(c,...at(u,v),...at(uu,vv),col,width);
    const poly=(points:Point[],col:string)=>polygon(c,points.map(p=>at(...p)),col);
    if(dead){
        oval(c,x-11,y-5,23,5,C.ink);pixelLine(c,x-8,y-4,x+7,y-4,loader?C.jade:C.cloth,3);
        box(c,x-7-dead*6,y-8-Math.sin(dead*Math.PI)*9,7,3,C.bronze);return;
    }
    oval(c,x-9,y-2,19,3,'#263f3d');
    for(const side of [0,1] as const){
        const foot=moving?guardFoot(e.distance,side):[side?4:-4,0];
        const airborne=e.vy!==0&&e.phase==='attack',fx=airborne?(side?5:-4):foot[0],fy=airborne?-3:foot[1];
        line(side?3:-3,-8,fx*.6,-4+fy,C.ink,4);line(fx*.6,-4+fy,fx,-1+fy,C.cloth,3);
        line(fx-1,fy,fx+3,fy,C.ink,3);line(fx,fy-1,fx+2,fy-1,C.light);
    }
    poly([[-6,-20],[3,-22],[7,-15],[5,-7],[-6,-7],[-8,-15]],C.ink);
    poly([[-4,-19],[2,-20],[5,-14],[3,-8],[-5,-8]],loader?C.jade:C.cloth);
    line(-5,-18,-4,-10,C.light);line(-4,-10,4,-10,C.bronze,2);
    line(-3,-19,3,-12,loader?C.grain:C.bronze,2);line(-5,-8,4,-8,C.shade);
    const arm=wind*(loader?6:4)+(attacking?4:0);
    line(-5,-18,-8,-12,C.ink,4);line(-8,-12,-2+arm*.5,-10,C.cloth,3);
    line(3,-19,6,-14+wind*2,C.ink,4);line(6,-14+wind*2,9+arm,-11-wind*2,C.light,3);
    line(8+arm,-11-wind*2,10+arm,-11-wind*2,C.skin,2);
    if(!loader){
        line(10+arm,-10-wind*2,13+arm,-16-wind*3,C.ink,3);
        line(11+arm,-11-wind*2,13+arm,-16-wind*3,C.rim);
        poly([[-6,-17],[-11,-15],[-12,-9],[-7,-8]],C.shade);
        line(-10,-14,-8,-14,C.bronze);
    }else{
        line(9+arm,-10,12+arm,-14,C.bronze,2);
        poly([[-5,-16],[4,-16],[3,-7],[-4,-7]],'#526e64');
        line(-3,-14,2,-14,C.mint);
    }
    poly([[-4,-29],[3,-30],[6,-26],[4,-21],[-3,-21],[-5,-25]],C.ink);
    poly([[-3,-27],[3,-28],[4,-24],[2,-22],[-2,-23]],C.skin);
    line(-4,-29,3,-29,loader?C.bronze:C.light,3);line(-5,-27,5,-27,C.ink,2);
    line(2,-25,4,-25,C.ink);line(3,-24,5,-24,C.skin);
    if(loader){line(-3,-25,1,-25,C.bronze,2);line(-2,-25,0,-25,C.mint);}
    else{
        line(-4,-22,-8,-20,C.bronze,2);
        line(-8,-20,-11,-20+(reduced?0:Math.sin(e.distance/5)*1.3),C.grain,2);
    }
}
