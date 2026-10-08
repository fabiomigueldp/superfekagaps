import { ART } from '../../graphics/palette';
import type { Biome } from './DeliciaContent';
import { barrel, line, oval, polygon, px, type PixelContext as C } from './DeliciaSceneryPrimitives';

/** Small dressing uses World materials; no pickup outlines or warning colors. */
function rope(c:C,x:number,y:number):void {
    for(let row=0;row<3;row++){
        oval(c,x+row,y-row*2,16-row*2,4,ART.soilDark);
        oval(c,x+row+1,y-row*2,14-row*2,3,ART.soilTop);
        px(c,x+row+4,y-row*2+1,8-row*2,1,ART.soil);
    }
    line(c,x+13,y+2,x+18,y-1,ART.soilLight);px(c,x+18,y-2,3,1,ART.soilTop);
}

function crate(c:C,x:number,y:number):void {
    px(c,x,y,18,14,ART.soilDark);px(c,x+1,y+1,16,12,ART.soil);
    for(const row of [1,5,9]){px(c,x+1,y+row,16,1,ART.soilLight);px(c,x+3,y+row+2,6,1,ART.soilDark);}
    polygon(c,x+2,y+1,[[0,0],[3,0],[14,10],[14,12],[11,12],[0,2]],ART.soilLight);
    line(c,x+3,y+1,x+15,y+12,ART.soilTop);
    for(const xx of [x+1,x+15]){
        px(c,xx,y+1,2,12,ART.soilDark);px(c,xx,y+1,1,12,ART.soilLight);
        for(const yy of [y+2,y+10])px(c,xx,yy,1,1,ART.rockLight);
    }
    px(c,x+7,y+6,5,4,ART.soilDark);px(c,x+8,y+7,3,1,ART.soilTop);
}

function bottle(c:C,x:number,y:number):void {
    px(c,x+2,y,3,4,ART.leafDark);px(c,x+1,y+3,5,7,ART.tealDark);px(c,x,y+5,7,7,ART.tealDark);
    px(c,x+1,y+5,2,5,ART.rockLight);px(c,x+2,y+1,1,2,ART.rockTop);
    px(c,x+1,y+7,5,3,ART.soilTop);px(c,x+3,y+8,2,1,ART.soilDark);px(c,x+1,y+11,5,1,ART.leafDark);
    px(c,x+2,y-1,3,2,ART.soilLight);
}

function plant(c:C,x:number,y:number,variant:number,time:number,wet=false):void {
    const sway=Math.round(Math.sin(Math.floor(time*5)*.22+variant%13));
    px(c,x,y-1,18,1,ART.leafDark);
    for(const [dx,height,side] of [[3,8,-1],[8,13,1],[14,9,1]]){
        const tip=x+dx+sway;
        line(c,x+dx,y-1,tip,y-height,ART.leafDark);
        if(wet){
            line(c,x+dx,y-2,tip+side*3,y-height+2,ART.leaf);
            px(c,tip,y-height-2,2,4,variant%2?ART.soilLight:ART.leaf);
            px(c,tip,y-height-2,1,1,ART.soilTop);
        }else{
            polygon(c,tip,y-height+3,[[0,2],[-4,-1],[-5,-3],[-1,-2],[1,0]],ART.leaf);
            polygon(c,tip,y-height+5,[[0,0],[3,-3],[5,-3],[4,-1],[1,2]],ART.leafDark);
            px(c,tip-3,y-height+1,2,1,ART.leafLight);px(c,tip+3,y-height+2,1,1,ART.leafLight);
            if(height===13&&variant%2===0){
                px(c,tip-2,y-height-3,5,3,ART.greenLight);px(c,tip-1,y-height-4,3,5,ART.paper);
                px(c,tip,y-height-2,1,1,ART.goldDark);
            }
        }
    }
}

function vent(c:C,x:number,y:number,time:number):void {
    px(c,x+1,y-12,14,12,ART.rockDark);px(c,x+2,y-11,12,10,ART.rock);
    px(c,x+2,y-12,12,1,ART.rockTop);px(c,x+2,y-11,1,10,ART.rockLight);
    oval(c,x+4,y-10,8,8,ART.rockDark);
    const angle=Math.floor(time*6)*Math.PI/8;
    for(let i=0;i<3;i++){
        const a=angle+i*Math.PI*2/3,dx=Math.round(Math.cos(a)*3),dy=Math.round(Math.sin(a)*3);
        line(c,x+8,y-6,x+8+dx,y-6+dy,ART.rockLight);
    }
    for(const yy of [-8,-5])px(c,x+4,y+yy,9,1,ART.rock);
    px(c,x+8,y-6,1,1,ART.rockTop);
    px(c,x+14,y-15,4,12,ART.soilDark);px(c,x+14,y-15,2,11,ART.soilLight);
    px(c,x+13,y-16,6,2,ART.rockLight);px(c,x+13,y-10,6,2,ART.rockDark);
    for(const xx of [x+3,x+12])px(c,xx,y-2,1,1,ART.soilTop);
}

export function drawDeliciaProp(c:C,biome:Biome,x:number,y:number,variant:number,time:number):void {
    if(biome==='harbor'){
        if(variant%3===0){barrel(c,x,y-18);rope(c,x+7,y-3);}
        else if(variant%3===1){
            px(c,x+3,y-11,5,11,ART.soilDark);px(c,x+4,y-10,2,10,ART.soilLight);
            px(c,x+1,y-13,9,3,ART.rockDark);px(c,x+2,y-13,7,1,ART.rockLight);px(c,x+3,y-12,5,1,ART.rock);
            rope(c,x,y-3);px(c,x+3,y-7,5,1,ART.soilTop);
        }else crate(c,x,y-14);
    }else if(biome==='cellar'){
        if(variant%2){barrel(c,x,y-18);px(c,x+10,y-8,4,2,ART.soilTop);px(c,x+12,y-8,2,5,ART.soilDark);}
        else{
            for(let row=0;row<3;row++){
                const xx=x+(row%2)*2,yy=y-3-row*3;
                px(c,xx,yy,14-row*2,3,row%2?ART.rock:ART.soilDark);px(c,xx+2,yy+1,10-row*2,1,ART.soilTop);px(c,xx,yy,1,2,ART.soilLight);
            }
            bottle(c,x+11,y-13);
        }
    }else if(biome==='orchard'){
        plant(c,x,y,variant,time);
        if(variant%3===0){oval(c,x-7,y-4,6,4,ART.soilDark);px(c,x-6,y-4,4,1,ART.soilLight);px(c,x-6,y-3,2,1,ART.soilTop);}
    }else if(biome==='refinery')vent(c,x,y,time);
    else if(biome==='citadel'){
        px(c,x,y-4,18,4,ART.rockDark);px(c,x+1,y-4,16,2,ART.rockLight);px(c,x+3,y-6,12,2,ART.rock);
        if(variant%2){
            px(c,x+6,y-17,6,11,ART.rock);px(c,x+6,y-17,2,11,ART.rockLight);
            px(c,x+4,y-17,10,3,ART.soilDark);px(c,x+5,y-17,8,1,ART.soilTop);
            polygon(c,x+3,y-24,[[0,0],[4,4],[6,0],[9,4],[12,0],[10,7],[2,7]],ART.rockLight);
            px(c,x+7,y-19,4,1,ART.rockTop);px(c,x+9,y-23,1,2,ART.soilTop);
        }else{
            plant(c,x+1,y-6,variant,time);
            polygon(c,x+3,y-8,[[0,0],[12,0],[10,5],[2,5]],ART.rock);
            px(c,x+3,y-8,12,1,ART.rockTop);px(c,x+5,y-6,1,2,ART.soilTop);px(c,x+11,y-6,1,2,ART.soilTop);
        }
    }else{
        polygon(c,x-1,y,[[0,0],[2,-4],[7,-5],[11,-2],[16,-3],[20,0]],ART.rockDark);
        polygon(c,x,y,[[0,0],[3,-4],[7,-4],[11,0]],ART.rock);
        px(c,x+3,y-4,4,1,ART.rockLight);px(c,x+12,y-2,4,1,ART.rockLight);
        plant(c,x+1,y-1,variant,time,true);
        px(c,x+3,y-2,3,1,ART.leaf);px(c,x+12,y-1,4,1,ART.leafDark);
    }
}
