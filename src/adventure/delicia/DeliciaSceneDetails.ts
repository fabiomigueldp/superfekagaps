import { line, oval, polygon, px, visible, type PixelContext as C } from './DeliciaSceneryPrimitives';

/** Background materials deliberately sit below the contrast of actors and collision edges. */
export function cloth(c:C,x:number,y:number,w:number,h:number,time:number,purple=false):void {
    if(!visible(x,w+4))return;
    const dark=purple?'#836f87':'#a48070',base=purple?'#a08195':'#c7a080',light=purple?'#c4a4a9':'#dfc4a0';
    const frame=Math.floor(time*5)%8;
    for(let col=0;col<w;col++){
        const bend=Math.round(Math.sin(col*.45-frame*Math.PI/4)*Math.min(2,col/4));
        const bottom=h-(col>w-5?(col-w+5)*.7:0);
        px(c,x+col,y+bend,1,bottom,dark);
        px(c,x+col,y+1+bend,1,bottom-3,(col+frame)%9<3?light:base);
        if(col>3&&col<w-3)px(c,x+col,y+Math.floor(h*.55)+bend,1,2,light);
    }
    px(c,x-1,y-2,2,h+5,'#8e8e84');px(c,x-1,y-2,1,h+4,'#c7baa0');
}

export function wheel(c:C,x:number,y:number,r:number,time:number,metal=false):void {
    if(!visible(x-r-3,r*2+6))return;
    const dark=metal?'#697b7c':'#707e6d',base=metal?'#a2957d':'#a18d6e',light=metal?'#c4b291':'#cab493';
    // Open spokes preserve the scene behind the wheel; no painted disk inside the rim.
    const angle=Math.floor(time*8)*Math.PI/48;
    for(let i=0;i<8;i++){
        const a=angle+i*Math.PI/4,dx=Math.round(Math.cos(a)*(r-2)),dy=Math.round(Math.sin(a)*(r-2));
        line(c,x,y,x+dx,y+dy,dark);line(c,x+1,y,x+dx+1,y+dy,base);
        const radial=(distance:number,side:number):readonly [number,number]=>[Math.round(Math.cos(a)*distance-Math.sin(a)*side),Math.round(Math.sin(a)*distance+Math.cos(a)*side)];
        polygon(c,x,y,[radial(r-4,-3),radial(r+2,-3),radial(r+2,3),radial(r-4,3)],dark);
        const p=radial(r+1,-2),q=radial(r+1,2);line(c,x+p[0],y+p[1],x+q[0],y+q[1],light);
    }
    for(let i=0;i<120;i++){
        const a=i*Math.PI/60,dx=Math.round(Math.cos(a)*r),dy=Math.round(Math.sin(a)*r);
        px(c,x+dx,y+dy,2,2,dark);px(c,x+dx,y+dy,1,1,dy<0?light:base);
        const ix=Math.round(Math.cos(a)*(r-3)),iy=Math.round(Math.sin(a)*(r-3));px(c,x+ix,y+iy,1,1,base);
    }
    oval(c,x-4,y-4,9,9,dark);oval(c,x-3,y-3,7,7,base);px(c,x-2,y-2,3,2,light);px(c,x,y,2,2,dark);
}

export function drive(c:C,x:number,y:number,time:number):void {
    px(c,x-20,y+15,68,5,'#72847e');px(c,x-19,y+15,65,1,'#b7b59b');
    for(const xx of [x-11,x+29]){px(c,xx,y,5,17,'#7e8c7f');px(c,xx,y,1,16,'#b0ad91');}
    // An open belt turns both pulleys in the same direction; the small one turns faster.
    line(c,x-6,y-15,x+31,y-15,'#6b7c7a');line(c,x-1,y+14,x+34,y+3,'#6b7c7a');
    line(c,x-6,y-14,x+31,y-14,'#9f9f87');line(c,x-1,y+13,x+34,y+2,'#9f9f87');
    wheel(c,x-6,y,15,time,true);wheel(c,x+31,y-6,9,time*15/9,true);
    const phase=Math.floor(time*8)*Math.PI/48;
    const crankX=x-6+Math.round(Math.cos(phase)*8),crankY=y+Math.round(Math.sin(phase)*8),slide=x+36+Math.round(Math.cos(phase)*4);
    line(c,crankX,crankY,slide,y+8,'#c0ad8d');line(c,crankX,crankY+1,slide,y+9,'#8b8877');
    px(c,slide-3,y+6,7,6,'#707f7b');px(c,slide-2,y+6,5,2,'#adad93');px(c,crankX,crankY,2,2,'#d1bc96');
}

export function flame(c:C,x:number,y:number,time:number,small=false):void {
    const f=Math.floor(time*6)%4,w=small?5:16,h=small?8:22;
    polygon(c,x,y,[[0,h],[1,h*.5],[w*.3,h*.65],[w*.4,1+f%2],[w*.65,h*.45],[w-2,h*.2+f],[w,h],[0,h]],'#b88765');
    polygon(c,x,y,[[1,h],[w*.3,h*.6],[w*.5,3+(f+1)%3],[w*.65,h*.7],[w-1,h]],'#d6ab78');
    polygon(c,x,y,[[w*.3,h],[w*.5,h*.5+(f%2)],[w*.75,h]],'#e6c994');
}

export function chimneyVapor(c:C,x:number,y:number,time:number):void {
    for(let i=3;i>=0;i--){
        const age=(time*.35+i/4)%1,r=4+Math.floor(age*6),xx=x+Math.round(age*15+Math.sin(age*4)*3),yy=y-Math.round(age*31);
        const color=['#b6b2a4','#adae9f','#a2a69c','#959e97'][Math.min(3,Math.floor(age*4))];
        oval(c,xx-r,yy-r,2*r,Math.round(r*1.3),color);
        px(c,xx-r+2,yy-r+1,r,1,['#c0baab','#b7b5a6','#adb1a2','#a3a99d'][Math.min(3,Math.floor(age*4))]);
    }
}

export function waterRibbons(c:C,x:number,y:number,w:number,h:number,time:number):void {
    px(c,x,y,w,h,'#7faeaa');px(c,x+1,y,w-3,h,'#adcdb9');px(c,x+2,y,1,h,'#d0ddbf');
    for(let i=0;i<6;i++){
        const yy=(Math.floor(time*18)+i*17)%Math.max(1,h-5),xx=1+(i*3)%Math.max(1,w-3);
        px(c,x+xx,y+yy,1,4,'#e0e8cc');
    }
    for(let i=0;i<4;i++){
        const age=(time*1.4+i*.25)%1,dx=Math.round((i%2?-1:1)*(3+age*7)),dy=Math.round(Math.sin(age*Math.PI)*4);
        px(c,x+w/2+dx,y+h-dy,2,1,'#c4d8bb');
    }
    px(c,x-4,y+h,w+9,1,'#9cbfa9');
}

/** Four panels and a small rose window keep the crown legible behind the boss. */
export function royalGlass(c:C,x:number,y:number):void {
    polygon(c,x,y,[[0,30],[4,17],[14,6],[24,0],[43,0],[54,7],[62,19],[65,30],[65,93],[0,93]],'#72768b');
    polygon(c,x,y,[[3,30],[7,18],[16,8],[26,3],[41,3],[51,10],[59,20],[62,31],[62,90],[3,90]],'#96899b');
    const shards:[number,number,string][]=[[7,36,'#91ada5'],[35,36,'#c2a491'],[7,64,'#b39ca0'],[35,64,'#8fa2aa']];
    for(const [xx,yy,color] of shards){
        px(c,x+xx,y+yy,23,23,color);
        polygon(c,x+xx,y+yy,[[0,0],[23,0],[11,11]],'#c8bbad');polygon(c,x+xx,y+yy,[[0,0],[11,11],[0,23]],'#839293');
        polygon(c,x+xx,y+yy,[[23,0],[23,23],[11,11]],'#9c8999');
        line(c,x+xx,y+yy,x+xx+23,y+yy+23,'#807d91');line(c,x+xx+23,y+yy,x+xx,y+yy+23,'#807d91');
        px(c,x+xx+10,y+yy+9,4,5,'#d2b799');
    }
    oval(c,x+13,y+6,39,29,'#797d8f');oval(c,x+15,y+7,35,27,'#bcaeaa');oval(c,x+17,y+9,31,23,'#8e899c');
    for(let i=0;i<8;i++){
        const a=i*Math.PI/4,cos=Math.cos(a),sin=Math.sin(a);
        const petal=(r:number,side:number):readonly [number,number]=>[Math.round(cos*r-sin*side),Math.round((sin*r+cos*side)*.78)];
        polygon(c,x+32,y+20,[petal(3,0),petal(10,-3),petal(14,0),petal(10,3)],i%2?'#9cb8ac':'#d2b69a');
        const tip=petal(12,0),inner=petal(7,-1);line(c,x+32+inner[0],y+20+inner[1],x+32+tip[0],y+20+tip[1],i%2?'#c3cfb7':'#e2c8a6');
    }
    oval(c,x+27,y+15,11,11,'#cfb498');oval(c,x+30,y+18,5,5,'#989296');
    px(c,x+31,y+34,3,56,'#7d7e91');px(c,x+4,y+60,57,3,'#7d7e91');
    // Crown relief is separate from the glass, with bevels and a central garnet.
    polygon(c,x+18,y+40,[[0,0],[7,8],[14,-2],[22,8],[30,0],[27,21],[3,21]],'#c6ad8e');
    line(c,x+20,y+42,x+24,y+58,'#dec4a0');px(c,x+22,y+58,21,3,'#ddc4a1');
    px(c,x+30,y+49,6,6,'#ac8792');px(c,x+31,y+49,3,2,'#d1a5a2');
    for(const xx of [x-4,x+65]){px(c,xx,y+25,4,69,'#b8a7a7');px(c,xx,y+25,1,68,'#d4bba9');}
    px(c,x-5,y+92,76,3,'#cbb3a6');
}

export function swallow(c:C,x:number,y:number,time:number,color:string):void {
    const f=Math.floor(time*5)%4,lift=[-2,0,2,0][f];
    line(c,x-5,y+lift,x-1,y,color);line(c,x,y,x+4,y+lift,color);px(c,x-1,y,2,1,color);
}
