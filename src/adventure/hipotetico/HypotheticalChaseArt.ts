import {box,oval,pixelLine,polygon,type Point} from '../WorldPainting';
import {pixelText} from '../../graphics/BitmapFont';
import type {HypotheticalModel,Shot} from './HypotheticalModel';
import {CHASE_BREAKS,CHASE_CHECKPOINT,CHASE_DISTRICTS} from './HypotheticalLayout';
import {chaseRuinAt,chaseDebrisAt,chaseMaterialAt,chaseTerraceFeet,chaseTerraceFall,chaseSplashAt,CHASE_DECK_Y,CHASE_WATER_Y,type ChaseMaterial,type ChaseTerrace} from './HypotheticalChaseDetails';

const materials = {
    stone: {dark:'#586e72',mid:'#8b9990',light:'#b8b499',grain:'#77877f'},
    timber: {dark:'#566964',mid:'#8c826b',light:'#b3a187',grain:'#6e7264'},
    iron: {dark:'#486771',mid:'#718c8b',light:'#a4b2a1',grain:'#59767a'},
};

/** Grain and fasteners follow a rigid piece through its fall. */
function beam(c:CanvasRenderingContext2D,x:number,y:number,length:number,angle:number,material:ChaseMaterial,width=5){
    const p=materials[material],dx=Math.cos(angle),dy=Math.sin(angle);
    const at=(u:number,v:number):Point=>[x+dx*u-dy*v,y+dy*u+dx*v];
    polygon(c,[at(0,-width/2-1),at(length,-width/2-1),at(length,width/2+1),at(0,width/2+1)],p.dark);
    polygon(c,[at(1,-width/2),at(length-1,-width/2),at(length-1,width/2-1),at(1,width/2-1)],p.mid);
    pixelLine(c,...at(1,-width/2),...at(length-1,-width/2),p.light);
    for(let i=5;i<length-3;i+=material==='iron'?12:17){
        pixelLine(c,...at(i,0),...at(i+(material==='iron'?0:3),0),p.grain);
        if(material==='iron'){const a=at(i,-2);box(c,a[0],a[1],1,1,p.light);}
        else if(material==='timber'&&i+4<length-2)pixelLine(c,...at(i+4,1),...at(Math.min(length-2,i+9),1),p.grain);
    }
    if(width>=5&&length>18){
        // Joinery travels with each rigid piece, including detached beams.
        for(const u of [4,length-5]){
            pixelLine(c,...at(u,-width/2+1),...at(u,width/2-1),p.dark);
            const bolt=at(u,-width/2+1);box(c,bolt[0],bolt[1],1,1,p.light);
        }
        if(material==='iron')pixelLine(c,...at(length*.4,width/2-1),...at(length*.4+4,width/2-1),'#829184');
    }
}

function pallet(c:CanvasRenderingContext2D,x:number,y:number){
    box(c,x-2,y+14,27,4,'#536b68');box(c,x-1,y+14,25,1,'#aaa388');
    box(c,x,y,23,14,'#766f61');box(c,x+2,y+2,19,10,'#9d8d70');
    for(const dx of [3,17]){box(c,x+dx,y,3,14,'#596f6a');box(c,x+dx,y+2,2,1,'#b2ad8c');}
    pixelLine(c,x+7,y+3,x+14,y+3,'#c0aa82');pixelLine(c,x+7,y+8,x+13,y+9,'#7e7b65');
}

/** World-anchored buildings retain their joinery while joints fail in succession. */
export function drawChaseLandmarks(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number,reduced:boolean){
    const floor=CHASE_DECK_Y-cy,base=floor-3;
    for(const [i,site] of CHASE_BREAKS.entries()){
        const x=site.x-cx;if(x<-160||x>410)continue;
        const at=b.chaseBreaks[i],age=at===-1?-1:b.tick-at,broken=age>=0;
        const pressure=Math.max(0,Math.min(1,(b.x+96-site.x)/40));
        const metal=site.kind==='gantry'||site.kind==='sluice',mat:ChaseMaterial=metal?'iron':'timber',p=materials[mat];
        const height=site.kind==='crane'?78:site.kind==='sluice'?58:69,pose=chaseRuinAt(age,height);
        // Footings descend into the near bank; pale playable edges belong to the deck below.
        for(const dx of [-25,33]){
            // These separate quay piles remain visible when the foreground deck tears away.
            box(c,x+dx-3,base-2,10,CHASE_WATER_Y-cy-base+2,'#4e7476');
            box(c,x+dx-2,base,2,CHASE_WATER_Y-cy-base,'#82978b');
            box(c,x+dx-4,CHASE_WATER_Y-cy-4,12,4,'#547e7b');
            pixelLine(c,x+dx-6,CHASE_WATER_Y-cy,x+dx+10,CHASE_WATER_Y-cy,'#719e94');
            box(c,x+dx-6,base-7,17,10,'#617b78');box(c,x+dx-5,base-7,15,2,'#a3ac95');
            box(c,x+dx-3,base-4,2,2,p.light);box(c,x+dx+6,base-4,2,2,p.light);
        }
        c.save();c.beginPath();c.rect(x-45,base-height-9,170,height+10);c.clip();
        for(const [j,dx]of [-25,33].entries()){
            if(!broken)beam(c,x+dx+2,base-6,height-6,-Math.PI/2,mat);
            else{
                beam(c,x+dx+2,base-6,16,-Math.PI/2,mat);
                const turn=j?pose.rightTurn:pose.leftTurn;
                beam(c,x+dx+2,base-22+(j?pose.rightPostDrop:pose.postDrop),height-22,-Math.PI/2+turn,mat);
                pixelLine(c,x+dx,base-24,x+dx+3,base-19,p.light);
            }
        }
        const bx=x-26+(broken?pose.beamX:0),by=base-height+(broken?pose.beamDrop:0),turn=broken?pose.beamTurn:0;
        beam(c,bx,by,66,turn,mat,6);
        if(!broken){
            for(const dx of [-25,33]){
                const dir=dx<0?1:-1;
                beam(c,x+dx+2,base-height+29,30,-Math.PI/2+dir*.66,mat,3);
            }
        }
        if(site.kind==='crane'){
            const sway=reduced?0:Math.sin((broken?Math.min(b.tick,at+9):b.tick)/36+i)*1.8;
            const loadX=x+2+sway,loadY=base-48+(broken?pose.loadDrop:0);
            const pulleyX=bx+37*Math.cos(turn),pulleyY=by+37*Math.sin(turn);
            oval(c,pulleyX-4,pulleyY-4,9,9,p.dark);oval(c,pulleyX-2,pulleyY-2,5,5,p.light);
            if(age<9){
                pixelLine(c,x+11,base-height+3,loadX+11,loadY-5,p.dark);
                pixelLine(c,loadX+11,loadY-5,loadX+3,loadY,'#a7ac91');
                pixelLine(c,loadX+11,loadY-5,loadX+19,loadY,'#a7ac91');
            }else{
                const ropeX=bx+36*Math.cos(turn),ropeY=by+36*Math.sin(turn);
                pixelLine(c,ropeX,ropeY,ropeX+4+sway,ropeY+13,p.dark);
                pixelLine(c,ropeX+4+sway,ropeY+13,ropeX+1+sway,ropeY+18,p.light);
            }
            pallet(c,loadX,loadY);
        }else if(site.kind==='sluice'){
            const drop=broken?pose.panelDrop:0,lean=broken?pose.panelTurn:0;
            const px=x-17+(broken?pose.beamX*.35:0),py=base-height+9+drop;
            const a=(u:number,v:number):Point=>[px+u*Math.cos(lean)-v*Math.sin(lean),py+u*Math.sin(lean)+v*Math.cos(lean)];
            polygon(c,[a(0,0),a(46,0),a(46,29),a(0,29)],p.dark);
            polygon(c,[a(2,2),a(44,2),a(44,26),a(2,26)],p.mid);
            for(let j=0;j<5;j++)pixelLine(c,...a(5+j*9,3),...a(5+j*9,25),p.light,2);
            const hub=a(23,13);oval(c,hub[0]-6,hub[1]-6,12,12,p.dark);oval(c,hub[0]-4,hub[1]-4,8,8,p.light);
            pixelLine(c,...a(19,13),...a(27,13),p.dark);pixelLine(c,...a(23,9),...a(23,17),p.dark);
        }else{
            for(const [start,end]of [[[2,5],[62,30]],[[62,5],[2,30]]] as const){
                const a=(u:number,v:number):Point=>[bx+u*Math.cos(turn)-v*Math.sin(turn),by+u*Math.sin(turn)+v*Math.cos(turn)];
                pixelLine(c,...a(start[0],start[1]),...a(end[0],end[1]),p.dark,3);pixelLine(c,...a(start[0],start[1]-1),...a(end[0],end[1]-1),p.mid);
            }
        }
        if(!broken&&pressure>.2){
            pixelLine(c,x-25,base-25,x-22,base-20,p.light);pixelLine(c,x+35,base-28,x+33,base-22,p.light);
            if(!reduced&&pressure>.65){const t=(b.tick+i)%12;box(c,x-22+t*.4,base-19+t*.6,1,2,p.light);}
        }
        if(broken&&age>15){
            const grow=Math.min(1,(age-15)/20);
            polygon(c,[[x-27,base],[x-18,base-7*grow],[x-4,base-3*grow],[x+3,base-9*grow],[x+22,base],[x+42,base]],p.dark);
            pixelLine(c,x-18,base-6*grow,x-7,base-2*grow,p.light);
            if(age>27)beam(c,x-9,base-4,25,-.12,mat,3);
        }
        c.restore();
        if(broken&&pose.dust>0&&!reduced){
            for(let j=0;j<5;j++){
                const dx=(j-2)*Math.min(32,age)*.6,dy=-pose.dust*(3+j%3*2);
                box(c,x+dx,base+dy-2,age<31?5:2,2,j%2?'#a6ae96':'#8a9d8e');
            }
        }
        // A second, low burst belongs to contact with the bank, not to the initial fracture.
        if(broken&&pose.groundAge>=0&&pose.groundAge<25){
            const t=pose.groundAge,spread=2+t*.8;
            for(let j=0;j<(reduced?2:6);j++){
                const xx=x+9+(j-2)*spread*.55,dy=Math.max(0,(1.2+j%2*.3)*t-.085*t*t);
                box(c,xx,base-2-dy,j%2?2:3,1,j%2?p.light:p.grain);
            }
        }
    }
    for(const [i,d]of CHASE_DISTRICTS.entries())if(i&&i!==2){
        const x=d.x+32-cx;if(x<-100||x>340)continue;
        box(c,x,base-55,4,55,'#577773');box(c,x-7,base-55,80,17,'#4f6a70');
        box(c,x-6,base-54,78,1,'#aab397');pixelText(c,d.name,x-2,base-50,'#c8c3a2');
    }
    const x=CHASE_CHECKPOINT-cx;
    if(x>-80&&x<360){
        box(c,x-10,base-68,5,68,'#566f70');box(c,x-14,base-71,16,5,'#b7ad8a');
        box(c,x-12,base-65,12,16,'#344e58');box(c,x-10,base-63,8,10,'#91d3bb');
        pixelLine(c,x-8,base-59,x-6,base-57,'#e1e6ba');pixelLine(c,x-6,base-57,x-3,base-61,'#e1e6ba');
        box(c,x-13,base-46,66,11,'#405e62');pixelText(c,'COMPORTAS',x-10,base-44,'#c8c3a2');
        box(c,x-13,base-32,44,11,'#405e62');pixelText(c,'RETOMA',x-10,base-30,'#b4d1b7');
    }
}

/** One sprite supplies both the intact platform and its detached rigid pieces. */
export function drawChaseTerrace(c:CanvasRenderingContext2D,p:ChaseTerrace,cx:number,cy:number,age=-1){
    const fall=age<0?{drop:0,turn:0}:chaseTerraceFall(p,age),x=p.x-cx,y=p.y-cy+fall.drop,w=p.width;
    const cos=Math.cos(fall.turn),sin=Math.sin(fall.turn),a=(u:number,v:number):Point=>[x+u*cos-v*sin,y+u*sin+v*cos];
    const iron=chaseMaterialAt(p.x)==='iron',body=iron?'#3f606a':'#594e4d',light=iron?'#7da09c':'#b98b66';
    const rect=(u:number,v:number,ww:number,hh:number,color:string)=>polygon(c,[a(u,v),a(u+ww,v),a(u+ww,v+hh),a(u,v+hh)],color);
    const line=(u:number,v:number,uu:number,vv:number,color:string,n=1)=>pixelLine(c,...a(u,v),...a(uu,vv),color,n);
    for(const {u,v}of chaseTerraceFeet(p)){
        rect(u,7,4,v-7,body);line(u+1,8,u+1,v-2,light);
        line(u+2,Math.min(v-10,24),u+(u===5?15:-11),8,body,3);rect(u+1,10,2,2,'#c6b68e');
        rect(u-2,v-5,8,5,'#3f606a');line(u-1,v-5,u+4,v-5,'#7da09c');
        if(age<0&&p.y+v===CHASE_WATER_Y)line(u-3,v,u+6,v,'#79aaa5');
    }
    rect(0,0,w,7,'#213545');rect(0,0,w,1,age<0?'#f0d4a1':'#a6b3a4');rect(0,1,w,1,age<0?'#c6b68e':'#8b9c90');
    rect(1,2,w-2,3,iron?'#3f606a':'#856350');
    for(let u=5;u<w-2;u+=iron?12:17){rect(u,2,1,3,body);rect(u-2,3,1,1,'#c6b68e');}
    line(2,5,w-3,5,light);
    for(const u of [4,w-8]){rect(u,2,4,4,'#3f606a');rect(u+1,3,1,1,'#c6b68e');}
}

function waterContact(c:CanvasRenderingContext2D,x:number,y:number,age:number,large:boolean,reduced:boolean){
    const s=chaseSplashAt(age,large);if(!s.visible)return;
    const r=s.radius;
    pixelLine(c,x-r,y,x+r*.35,y,'#649c98');pixelLine(c,x+r*.55,y,x+r,y,'#78aaa2');
    if(age<26){pixelLine(c,x-r*.55,y-1,x-1,y-1,'#91bbb0');pixelLine(c,x+2,y+1,x+r*.6,y+1,'#91bbb0');}
    if(s.crown>0){
        polygon(c,[[x-4,y],[x-5,y-s.crown],[x-2,y-s.crown*.55],[x,y-1],[x+3,y-s.crown],[x+6,y-s.crown*.5],[x+4,y]],'#9fc7b5');
    }
    if(!reduced&&s.dropVisible)for(const dir of [-1,1]){
        box(c,x+dir*age*(large?.65:.45),y-s.height,large?2:1,2,'#b8d6be');
        if(large&&age<20)box(c,x+dir*age*.34,y-s.height*.72,1,2,'#88b5ad');
    }
}

/** The falling sprite is clipped at the surface; contact, spray and floating chips follow in order. */
export function drawChaseCollapse(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number,reduced:boolean){
    const water=CHASE_WATER_Y-cy;
    for(const p of b.terraceDebris){
        const age=b.tick-p.born,x=p.x-cx;if(x+p.width<-25||x>340)continue;
        const fall=chaseTerraceFall(p,age),material=chaseMaterialAt(p.x);
        c.save();c.beginPath();c.rect(x-90,p.y-cy-4,p.width+120,water-(p.y-cy)+4);c.clip();
        drawChaseTerrace(c,p,cx,cy,age);
        c.restore();
        waterContact(c,x+fall.contactX,water,fall.splashAge,true,reduced);
        // Long supports disturb the water quietly before the much heavier cap arrives.
        if(age>3&&fall.splashAge<0)for(const foot of chaseTerraceFeet(p)){
            const fy=p.y+fall.drop+foot.u*Math.sin(fall.turn)+foot.v*Math.cos(fall.turn);
            if(fy>=CHASE_WATER_Y)pixelLine(c,x+foot.u-4,water,x+foot.u+3,water,'#6a9e99');
        }
        if(material!=='iron'&&fall.splashAge>7&&fall.splashAge<36){
            for(let j=0;j<2;j++){
                const xx=x+fall.contactX-8-j*13-fall.splashAge*.13,yy=water+1+(reduced?0:Math.sin((age+j*7)/9));
                pixelLine(c,xx,yy,xx+6+j*3,yy+.5,'#718e83');pixelLine(c,xx+2,yy,xx+5,yy,'#95aa91');
            }
        }
    }
    for(const p of b.bridgeDebris){
        const age=b.tick-p.born,x=p.x-cx,y=CHASE_DECK_Y-cy;if(x<-48||x>350)continue;
        const material=chaseMaterialAt(p.x),m=materials[material],fall=chaseDebrisAt(age);
        if(fall.drop<20){
            c.save();c.beginPath();c.rect(x-8,y-2,42,water-y+2);c.clip();
            const xx=x+fall.shift,yy=y+fall.drop;
            const points:Point[]=material==='iron'?[[xx,yy],[xx+15,yy+fall.tilt],[xx+13,yy+2+fall.tilt],[xx+8,yy+5],[xx,yy+3]]:
                material==='timber'?[[xx,yy],[xx+15,yy+fall.tilt],[xx+12,yy+3+fall.tilt],[xx+9,yy+2+fall.tilt],[xx+5,yy+5],[xx,yy+4]]:
                    [[xx,yy],[xx+15,yy+fall.tilt],[xx+13,yy+5+fall.tilt],[xx+4,yy+5],[xx,yy+3]];
            polygon(c,points,m.dark);
            pixelLine(c,xx,yy,xx+14,yy+fall.tilt,m.light,2);
            if(material==='timber')pixelLine(c,xx+2,yy+3,xx+12,yy+3+fall.tilt,m.mid);
            else for(const dx of [3,11])box(c,xx+dx,yy+2+fall.tilt*dx/15,1,1,m.mid);
            if(!reduced)for(let i=0;i<3;i++)box(c,x+3+i*5-age*(i-1)*.15,y+4+fall.drop-i*2,2,2,m.light);
            c.restore();
        }
        const t=fall.splashAge;
        waterContact(c,x+7,water,t,false,reduced);
        if(material==='timber'&&t>7&&t<32){
            const xx=x+4-t*.15,yy=water+1+(reduced?0:Math.sin(age/9));
            pixelLine(c,xx,yy,xx+7,yy,'#7f9687');box(c,xx+2,yy,3,1,'#a0ad91');
        }
    }
}

/** Three rolling pieces use the bank's material, with a quiet dust wake behind the hitbox. */
export function drawChaseWave(c:CanvasRenderingContext2D,s:Shot,cx:number,cy:number,reduced:boolean){
    const x=s.x-cx,y=s.y-cy,material=chaseMaterialAt(s.x),m=materials[material];
    const spin=s.age*.38,at=(u:number)=>x+(s.vx<0?15-u:u);
    polygon(c,[[at(0),y+12],[at(3),y+7],[at(6),y+2],[at(10),y+1],[at(13),y+7],[at(15),y+12]],'#273e43');
    polygon(c,[[at(2),y+11],[at(6),y+5],[at(9),y+3],[at(11),y+8],[at(13),y+11]],m.mid);
    pixelLine(c,at(7),y+3,at(10),y+2,'#ebc797');
    pixelLine(c,at(8+Math.cos(spin)*3),y+8+Math.sin(spin)*3,at(8),y+8,m.light);
    if(!reduced)for(let i=0;i<3;i++){
        const phase=(s.age+i*5)%14;
        box(c,at(-2-i*4),y+11-Math.sin(phase/14*Math.PI)*(2+i),2,1,m.grain);
    }
}
