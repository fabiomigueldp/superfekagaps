import { ART, hashAt } from '../../graphics/palette';

export type PixelContext = CanvasRenderingContext2D;
type Point = readonly [number, number];

/** Scenery shares the actors' native grid. No canvas paths or filtered edges. */
export function px(c:PixelContext,x:number,y:number,w:number,h:number,color:string):void {
    const width=Math.round(w),height=Math.round(h);
    if(width<=0||height<=0)return;
    c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),width,height);
}

export function polygon(c:PixelContext,x:number,y:number,points:readonly Point[],color:string):void {
    x=Math.round(x);y=Math.round(y);
    // Fractional design vertices still cover whole native scanlines, sampled at pixel centers.
    const top=Math.ceil(Math.min(...points.map(p=>p[1]))-.5),bottom=Math.ceil(Math.max(...points.map(p=>p[1]))-.5);
    c.fillStyle=color;
    for(let row=Math.max(top,-y);row<Math.min(bottom,180-y);row++){
        const cuts:number[]=[],scan=row+.5;
        for(let i=0,j=points.length-1;i<points.length;j=i++){
            const a=points[j],b=points[i];
            if((a[1]>scan)!==(b[1]>scan))cuts.push(a[0]+(scan-a[1])*(b[0]-a[0])/(b[1]-a[1]));
        }
        cuts.sort((a,b)=>a-b);
        for(let i=0;i+1<cuts.length;i+=2){const left=Math.ceil(cuts[i]-.5),right=Math.ceil(cuts[i+1]-.5);c.fillRect(x+left,y+row,right-left,1);}
    }
}

export function line(c:PixelContext,x0:number,y0:number,x1:number,y1:number,color:string):void {
    x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
    const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;
    let error=dx+dy;
    c.fillStyle=color;
    for(;;){c.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const e=2*error;if(e>=dy){error+=dy;x0+=sx;}if(e<=dx){error+=dx;y0+=sy;}}
}

export function oval(c:PixelContext,x:number,y:number,w:number,h:number,color:string):void {
    for(let row=0;row<h;row++){
        const inset=Math.round(w*.5*(1-Math.sqrt(Math.max(0,1-((row+.5)/h*2-1)**2))));
        px(c,x+inset,y+row,w-inset*2,1,color);
    }
}

export function visible(x:number,w:number):boolean{return x+w>=-4&&x<=324;}

export function masonry(c:PixelContext,x:number,y:number,w:number,h:number,base:string,light:string,dark:string,seed=0):void {
    px(c,x,y,w,h,base);
    // Broken joints and sparse exposed faces, rather than a distracting full grid.
    for(let row=7;row<h;row+=11)for(let col=-16;col<w;col+=25){
        const xx=col+(Math.floor(row/11)%2)*12,n=hashAt(col,row,seed);
        if(xx<2||xx+18>w||n%3===0)continue;
        px(c,x+xx,y+row,13+n%5,1,dark);px(c,x+xx,y+row-5,1,5,dark);
        if(n%2===0)px(c,x+xx+2,y+row-6,8,1,light);
    }
}

const LEAF_SHAPE:readonly Point[]=[[0,9],[2,9],[2,5],[6,5],[6,2],[11,2],[13,0],[18,0],[18,2],[23,2],[25,5],[28,5],[28,10],[30,12],[28,15],[26,15],[26,18],[20,18],[18,20],[12,20],[10,18],[5,18],[5,16],[1,16],[1,12]];
export function foliage(c:PixelContext,x:number,y:number,dark:string,base:string,light:string):void {
    polygon(c,x,y,LEAF_SHAPE,dark);
    polygon(c,x+1,y,[[1,9],[4,6],[8,6],[8,3],[13,3],[14,1],[17,1],[20,4],[23,4],[24,7],[27,8],[26,11],[23,11],[23,14],[17,14],[15,17],[10,16],[9,13],[4,14],[3,11]],base);
    polygon(c,x,y,[[5,7],[10,7],[10,4],[14,4],[15,2],[18,3],[20,5],[16,5],[15,8],[10,9],[8,11],[3,10]],light);
    px(c,x+21,y+8,4,1,light);px(c,x+20,y+9,2,1,light);px(c,x+11,y+13,3,1,light);px(c,x+7,y+16,3,1,base);
    px(c,x+25,y+13,2,1,base);px(c,x+17,y+18,2,1,base);
}

export function citrusTree(c:PixelContext,x:number,y:number,variant=0,distant=false,time=0):void {
    if(!visible(x,70))return;
    const dark=distant?'#5f8774':'#386d57',base=distant?'#88a68b':'#56895f',light=distant?'#a6be96':'#92b878';
    const bark=distant?'#658573':ART.soilDark,barkLight=distant?'#8ca081':ART.soilLight;
    polygon(c,x,y,[[31,30],[36,32],[35,50],[38,67],[46,76],[27,76],[31,69],[30,48],[24,40],[18,38],[18,35],[28,36]],bark);
    polygon(c,x,y,[[31,40],[33,43],[33,69],[30,75],[34,73],[35,61]],barkLight);
    line(c,x+34,y+55,x+48,y+38,bark);line(c,x+34,y+54,x+45,y+36,bark);
    polygon(c,x,y,[[3,30],[9,18],[22,12],[28,3],[41,2],[47,11],[57,14],[65,24],[65,43],[57,49],[43,53],[28,51],[14,48],[4,40]],dark);
    const clusters=variant%2?[[8,12],[31,9],[21,0],[0,25],[20,28],[41,26]]:[[1,19],[19,2],[38,15],[9,32],[33,31]];
    for(const [xx,yy] of clusters){
        const sway=Math.round(Math.sin(Math.floor(time*5)*.18+xx*.06)*(distant?.55:1));
        foliage(c,x+xx+sway,y+yy,dark,base,light);
    }
    if(!distant){
        for(const [xx,yy] of [[15,27],[31,14],[48,23],[27,40],[48,43]]){
            px(c,x+xx,y+yy,3,4,ART.goldDark);px(c,x+xx-1,y+yy+1,4,2,ART.orange);
            px(c,x+xx,y+yy,2,1,ART.orangeLight);px(c,x+xx+1,y+yy-1,2,1,ART.leafTip);
        }
        line(c,x+28,y+59,x+26,y+70,ART.leafDark);px(c,x+26,y+63,3,2,ART.leaf);
    }
}

export function barrel(c:PixelContext,x:number,y:number,dim=false):void {
    const dark=dim?'#524454':ART.soilDark,wood=dim?'#7d5c57':ART.soil,light=dim?'#a57c67':ART.soilLight,band=dim?'#606e78':ART.rock;
    px(c,x+2,y,10,18,dark);px(c,x,y+3,14,12,dark);px(c,x+1,y+3,12,12,wood);px(c,x+3,y+1,8,16,wood);
    px(c,x+3,y+3,2,12,light);px(c,x+8,y+2,1,14,dark);px(c,x+11,y+4,1,10,dark);
    oval(c,x+2,y,10,4,light);px(c,x+4,y+1,6,1,wood);
    for(const row of [4,12]){px(c,x,y+row,14,2,band);px(c,x+1,y+row,10,1,dim?'#92928d':ART.rockLight);px(c,x+11,y+row+1,1,1,ART.rockDark);}
    px(c,x+6,y+8,2,2,dark);
}

export function tiledRoof(c:PixelContext,x:number,y:number,w:number,h=12,shade=false):void {
    const dark=shade?'#795557':ART.orangeDark,base=shade?'#aa7867':'#bd684a',light=shade?'#c69276':ART.soilTop;
    for(let row=0;row<h;row++){
        const inset=h-row;px(c,x+inset,y+row,w-inset*2,1,row%4===0?light:base);
        if(row%4!==0)for(let col=inset+4+(Math.floor(row/4)%2)*4;col<w-inset;col+=8)px(c,x+col,y+row,1,1,dark);
    }
    px(c,x-1,y+h,w+2,2,dark);px(c,x-2,y+h+2,w+4,1,shade?'#63555d':ART.soilDark);
    px(c,x+h,y,w-h*2,1,light);
}

export function smallWindow(c:PixelContext,x:number,y:number,lit=false,w=7,h=11):void {
    px(c,x+1,y,w-2,h,lit?'#5b4d61':'#577985');px(c,x,y+2,w,h-2,lit?'#5b4d61':'#577985');
    px(c,x+1,y+2,w-2,h-3,lit?'#c69a6c':'#8eb3b3');
    px(c,x+2,y+2,1,h-4,lit?'#e8c78c':'#bdd0bd');px(c,x+Math.floor(w/2),y+1,1,h-1,lit?'#6f5863':'#577985');
    px(c,x,y+Math.floor(h/2)+1,w,1,lit?'#6f5863':'#577985');px(c,x-1,y+h,w+2,1,lit?'#a99397':'#c6d2bb');
}

/** A real open arch: background remains visible through the curved span. */
export function stoneArch(c:PixelContext,x:number,y:number,w:number,h:number,base:string,light:string,dark:string):void {
    if(!visible(x,w))return;
    const thick=5,radius=(w-2*thick)/2;
    px(c,x,y,w,3,base);px(c,x,y,w,1,light);
    for(let row=3;row<radius+thick;row++){
        const innerY=row-(radius+thick),half=innerY< -radius?0:Math.sqrt(Math.max(0,radius*radius-innerY*innerY));
        const side=Math.ceil(w/2-half);px(c,x,y+row,side,1,base);px(c,x+w-side,y+row,side,1,base);
        if(half>1){px(c,x+side-2,y+row,1,1,light);px(c,x+w-side,y+row,1,1,dark);}
    }
    px(c,x,y+radius+thick,thick,h-radius-thick,base);px(c,x+w-thick,y+radius+thick,thick,h-radius-thick,base);
    px(c,x+1,y+radius+thick,1,h-radius-thick,light);px(c,x+w-1,y+radius+thick,1,h-radius-thick,dark);
    for(const side of [0,w-thick])for(let yy=radius+thick+6;yy<h;yy+=10)px(c,x+side,y+yy,thick,1,dark);
    for(const [xx,yy] of [[w/2,3],[w/2-8,5],[w/2+8,5],[7,12],[w-8,12]])px(c,x+xx,y+yy,1,3,dark);
    px(c,x+w/2-2,y+2,4,6,light);
    px(c,x-1,y+h-6,thick+2,2,light);px(c,x+w-thick-1,y+h-6,thick+2,2,light);
    if(w>55)for(const angle of [-2.65,-2.25,-.9,-.48]){
        const middle=w/2,centerY=radius+thick;
        line(c,x+middle+Math.cos(angle)*(radius+1),y+centerY+Math.sin(angle)*(radius+1),x+middle+Math.cos(angle)*(radius+5),y+centerY+Math.sin(angle)*(radius+5),dark);
    }
}
