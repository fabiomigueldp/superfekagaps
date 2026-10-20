import {box,oval,pixelLine,polygon,type Point} from '../WorldPainting';
import type {HypotheticalModel} from './HypotheticalModel';
import {CHASE_PORTICO as P,CHASE_FALLEN_DECKS,CHASE_FLOOD as W,CHASE_LEAP as L} from './HypotheticalLayout';
import {smoothMotion} from './HypotheticalMotion';
import {chaseCollapsedEdge} from './HypotheticalChaseDetails';
import {drawLauncherWarhead} from './HypotheticalLauncherArt';
import {drawChaseLandingDust} from './HypotheticalChaseImpactArt';
import {rocketTail} from './HypotheticalRocketMotion';
import {chasePorticoBeam,chaseFloodCap,CHASE_FLOOD_END} from './HypotheticalChaseChoreography';

const C={ink:'#213545',deep:'#314e58',iron:'#547579',steel:'#8fa8a0',edge:'#c6c8a5',
    bronze:'#bc955b',gold:'#e6c390',rust:'#956654',water:'#4c9caa',waterDeep:'#357687',
    foam:'#c6edda',light:'#fff0ce',smoke:'#9caa9b'};
const unit=(n:number)=>Math.max(0,Math.min(1,n));

function girder(c:CanvasRenderingContext2D,points:Point[],width:number){
    for(let i=1;i<points.length;i++){
        pixelLine(c,...points[i-1],...points[i],C.ink,width+2);
        pixelLine(c,...points[i-1],...points[i],C.iron,width);
        pixelLine(c,points[i-1][0]-1,points[i-1][1]-1,points[i][0]-1,points[i][1]-1,C.steel);
    }
}

function waterContact(c:CanvasRenderingContext2D,x:number,y:number,age:number,reduced:boolean,strength=1){
    if(age<0||age>38)return;
    const rise=smoothMotion(age/3),fade=1-smoothMotion((age-12)/26);
    c.save();c.globalAlpha*=fade;
    const r=(5+age*.9)*strength;
    pixelLine(c,x-r,y,x+r,y,C.water,2);
    pixelLine(c,x-r*.65,y-1,x+r*.8,y-1,C.foam);
    for(let i=0;i<(reduced?3:7);i++){
        const side=i%2?1:-1,t=Math.max(0,age-i%3);
        const px=x+side*(2+t*(.36+i*.09))*strength;
        const py=y-rise*2-(1.6+i%3*.35)*t*strength+.072*t*t;
        if(py>y)continue;
        pixelLine(c,px,py,px-side,py+Math.max(1,3-age*.1),i%3?C.foam:C.water,1);
    }
    c.restore();
}

/** Matching rivets and grain survive release, landing and the final fall. */
export function drawChaseCargoDeck(c:CanvasRenderingContext2D,x:number,y:number,width:number,turn:number,ready:boolean){
    const co=Math.cos(turn),si=Math.sin(turn);
    const at=(u:number,v:number):Point=>[x+u*co-v*si,y+u*si+v*co];
    const rect=(u:number,v:number,w:number,h:number,color:string)=>polygon(c,[at(u,v),at(u+w,v),at(u+w,v+h),at(u,v+h)],color);
    rect(0,0,width,7,C.ink);rect(1,1,width-2,5,C.iron);
    rect(0,0,width,1,ready?C.gold:C.steel);rect(2,2,width-4,1,ready?C.edge:C.iron);
    for(let u=5;u<width-5;u+=9){rect(u,3,5,2,C.deep);rect(u,3,1,1,C.steel);}
    for(const u of [2,width-7]){rect(u,1,5,5,C.bronze);rect(u+1,2,1,1,C.light);}
}

/** Architecture is on the rear bank; only the detached decks have a bright,
 * playable upper edge. Foundations share the foreground's world projection. */
export function drawChaseSetpieceRear(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number,reduced:boolean){
    const s=b.course,age=s.impactAge;
    if(cx<P.end+80&&cx+320>2544){
        const base=240-cy,top=104-cy;
        for(const [i,worldX]of [2656,2992].entries()){
            const x=worldX-cx;
            box(c,x-12,base-12,26,12,'#66837d');box(c,x-13,base-13,28,3,'#9ba994');
            girder(c,[[x,base-12],[x,top+2]],8);
            for(let yy=top+12;yy<base-16;yy+=14){
                pixelLine(c,x-3,yy,x+3,yy+10,C.deep);box(c,x-2,yy+2,1,1,C.edge);
                box(c,x+2,yy+9,1,1,C.edge);
            }
            girder(c,[[x,top+43],[x+(i?-31:31),top+3]],4);
            box(c,x-8,base-17,17,5,C.deep);box(c,x-7,base-17,15,1,C.steel);
            pixelLine(c,x-13,base,x+14,base,'#79aaa5');
        }
        // Existing landing stools receive the falling cargo decks.
        for(const d of CHASE_FALLEN_DECKS)for(const u of [2,d.width-7]){
            const x=d.x+u-cx;
            box(c,x-1,215-cy,8,25,'#3c5d64');box(c,x,216-cy,2,24,C.iron);
            box(c,x-2,214-cy,10,2,C.steel);
        }
        const beamPoint=(i:number,u:number,v:number):Point=>{
            const p=chasePorticoBeam(i,age);
            return [p.x-cx+(u-p.pivot)*Math.cos(p.turn)-v*Math.sin(p.turn),
                p.y-cy+(u-p.pivot)*Math.sin(p.turn)+v*Math.cos(p.turn)];
        };
        c.save();c.beginPath();c.rect(2540-cx,top-8,540,base-top+8);c.clip();
        for(let i=0;i<3;i++){
            const p=chasePorticoBeam(i,age),at=(u:number,v:number):Point=>beamPoint(i,u,v);
            girder(c,[at(0,0),at(112,0)],7);
            for(let j=0;j<8;j++){
                const pin=at(j*14+5,-1);box(c,...pin,2,2,C.bronze);
                pixelLine(c,...at(j*14+3,3),...at(j*14+10,3),C.deep);
            }
            const hinge=at(p.pivot,0);
            box(c,hinge[0]-3,hinge[1]-5,6,11,C.deep);box(c,hinge[0]-1,hinge[1]-3,2,2,C.gold);
            const release=age-p.release;
            if(release>=0&&release<18){
                for(const side of [-1,1]){
                    const pin=at(p.pivot,0),xx=pin[0]+side*release*.65,yy=pin[1]-release*.7+.05*release*release;
                    box(c,xx,yy,2,2,C.bronze);
                    if(release<4)pixelLine(c,...pin,pin[0]+side*(4+release),pin[1]-3,C.gold);
                }
            }
        }
        // The visible struck clevis anchors both the intact cable and its recoil.
        const targetX=P.targetX-cx,targetY=P.targetY-cy;
        if(age<0){
            box(c,targetX-6,targetY-7,12,15,C.deep);box(c,targetX-4,targetY-5,8,11,C.bronze);
            oval(c,targetX-2,targetY-2,4,4,C.ink);box(c,targetX-2,targetY-3,4,1,C.gold);
        }
        for(const [i,d]of CHASE_FALLEN_DECKS.entries()){
            const deck=s.fallenDeck(i),release=deck.releaseAge;
            for(const side of [-1,1]){
                const anchor=beamPoint(i,d.x+d.width/2+side*18-(2656+i*112),5);
                if(release<0){
                    const foot:Point=[d.x+d.width/2+side*18*Math.cos(deck.turn)-cx,
                        deck.drawY+side*18*Math.sin(deck.turn)-cy];
                    pixelLine(c,...anchor,...foot,C.deep,2);
                    pixelLine(c,anchor[0]+1,anchor[1],foot[0]+1,foot[1],C.steel);
                    for(let t=8;t<foot[1]-anchor[1];t+=8)
                        box(c,anchor[0]+(foot[0]-anchor[0])*t/(foot[1]-anchor[1]),anchor[1]+t,2,2,C.bronze);
                }else{
                    const whip=reduced?0:Math.sin(release*.45+side)*Math.exp(-release/20)*12;
                    const length=22+10*(1-smoothMotion(release/15));
                    const end:Point=[anchor[0]+side*2+whip*.5,anchor[1]+length];
                    pixelLine(c,...anchor,anchor[0]+whip,anchor[1]+length*.65,C.steel);
                    pixelLine(c,anchor[0]+whip,anchor[1]+length*.65,...end,C.bronze);
                    if(release<6&&!reduced)box(c,end[0]+side*release,end[1]-release,1,1,C.light);
                }
            }
        }
        c.restore();
        for(let i=0;i<3;i++){
            const p=chasePorticoBeam(i,age);
            waterContact(c,p.contactX-cx,base,p.splashAge,reduced,.9);
        }
        // Maintenance rail stays separate from the failed loading rig.
        for(const x of [2720,2816,2912]){
            const screen=x-cx,y=(x===2912?176:144)-cy;
            pixelLine(c,screen+5,y-21,screen+5,y,C.deep,2);
            pixelLine(c,screen+59,y-21,screen+59,y,C.deep,2);
            pixelLine(c,screen+5,y-21,screen+59,y-21,C.steel);
        }
    }
    const x=W.sourceX-cx;if(x<-170||x>430)return;
    const y=224-cy,warning=s.floodWarningAt===-1?-1:s.tick-s.floodWarningAt,burst=s.floodAge;
    // Stone plinth, tank hoops and connected elbow all end on real supports.
    box(c,x-100,y-4,89,12,'#677f75');box(c,x-102,y-6,93,3,'#b3b291');
    box(c,x-88,y-101,64,94,C.deep);box(c,x-85,y-99,58,90,'#627f76');
    for(let row=0;row<5;row++){
        box(c,x-85,y-93+row*17,58,2,'#889c86');
        for(const dx of [-81,-32])box(c,x+dx,y-91+row*17,2,2,C.edge);
    }
    oval(c,x-90,y-105,68,12,C.deep);oval(c,x-86,y-104,60,7,C.steel);
    box(c,x-62,y-91,8,73,C.deep);box(c,x-60,y-89,4,69,'#365f65');
    const pressureAge=burst<0?warning:s.floodAt-s.floodWarningAt;
    const loaded=35+Math.min(28,Math.max(0,pressureAge)*.35);
    const level=burst<0?loaded:Math.max(8,loaded-burst*.8);
    box(c,x-60,y-20-level,4,level,'#8ebfaf');box(c,x-60,y-21-level,4,1,C.foam);
    for(let yy=0;yy<6;yy++)box(c,x-53,y-25-yy*11,3,1,C.bronze);
    girder(c,[[x-28,y-27],[x-9,y-27],[x-9,y-15],[x+6,y-15]],12);
    for(const xx of [-23,-3]){
        box(c,x+xx,y-36,5,20,C.deep);box(c,x+xx+1,y-35,3,18,C.steel);
        for(const dy of [-33,-21])box(c,x+xx+1,y+dy,1,1,C.edge);
    }
    const vibration=burst<0?1:1-smoothMotion(burst/18);
    const valveTurn=warning<0?0:Math.min(.3,warning*.004)+(reduced?0:Math.sin(warning*.7)*.025*vibration);
    oval(c,x-17,y-37,16,16,C.deep);oval(c,x-15,y-35,12,12,C.bronze);oval(c,x-12,y-32,6,6,C.deep);
    for(let i=0;i<3;i++){
        const a=i*Math.PI*2/3+valveTurn;
        pixelLine(c,x-9,y-29,x-9+Math.cos(a)*6,y-29+Math.sin(a)*6,C.gold,2);
    }
    if(burst<0){
        box(c,x+5,y-24,5,18,C.ink);box(c,x+6,y-23,3,16,C.steel);
        for(const dy of [-22,-10])box(c,x+7,y+dy,1,1,C.gold);
        if(warning>=0)for(let i=0;i<3;i++){
            const t=(s.tick+i*9)%28,drop=t*t*.035;
            if(y-12+drop>240-cy)continue;
            box(c,x+10+t*.28,y-17+i*3+drop,1,2,C.foam);
        }
    }else{
        oval(c,x+2,y-23,8,17,C.ink);pixelLine(c,x+7,y-22,x+7,y-9,C.rust);
        const cap=chaseFloodCap(burst),co=Math.cos(cap.turn),si=Math.sin(cap.turn);
        const at=(u:number,v:number):Point=>[cap.x-cx+u*co-v*si,cap.y-cy+u*si+v*co];
        polygon(c,[at(-3,-8),at(2,-8),at(3,8),at(-2,8)],C.ink);
        polygon(c,[at(-2,-7),at(1,-7),at(2,7),at(-1,7)],C.steel);
        for(const v of [-5,5])pixelLine(c,...at(-1,v),...at(1,v),C.gold);
        const flow=1-smoothMotion((burst-74)/36);
        if(flow>0){
            const reach=20+18*flow,thick=6*flow,wiggle=reduced?0:Math.sin(burst*.55)*flow;
            polygon(c,[[x+6,y-18],[x+18,y-16],[x+reach,y],[x+reach-9,y],
                [x+17,y-16+thick],[x+6,y-18+thick]],C.waterDeep);
            polygon(c,[[x+6,y-18],[x+17,y-17+wiggle],[x+reach,y-1],[x+reach-5,y],
                [x+15,y-15+thick*.5],[x+6,y-16]],C.water);
            for(let i=0;i<3;i++){
                const u=((burst+i*5)%18)/18,px=x+8+u*(reach-8),py=y-18+18*u*u;
                pixelLine(c,px,py,px+3,py+u*3,C.foam);
            }
            for(let i=0;i<3;i++){
                const t=(burst+i*7)%23,dx=t*.6,yy=y-t*.8+.04*t*t;
                if(yy<=y)box(c,x+reach+dx,yy,1,1,C.foam);
            }
        }
    }
}

/** The slab's painted upper surface and its settled native support share x/y.
 * Falling parcels are clearly suspended loads until their landing latch. */
export function drawChaseSetpieceDecks(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number,reduced:boolean){
    const s=b.course,edge=chaseCollapsedEdge(b.x);
    for(let i=0;i<CHASE_FALLEN_DECKS.length;i++){
        const p=s.fallenDeck(i),x=p.x-cx;
        if(x+p.width<-40||x>350||p.ready&&p.x<edge)continue;
        const y=p.drawY-cy;
        drawChaseCargoDeck(c,x+p.width/2*(1-Math.cos(p.turn)),y-p.width/2*Math.sin(p.turn),p.width,p.turn,p.ready);
        if(!p.ready&&p.releaseAge>=0){
            const length=10+12*smoothMotion(p.releaseAge/10),whip=reduced?0:Math.sin(p.releaseAge*.4)*4;
            for(const side of [-1,1]){
                const xx=x+p.width/2+side*18*Math.cos(p.turn),yy=y+side*18*Math.sin(p.turn);
                pixelLine(c,xx+whip,yy-length,xx,yy-1,C.steel);
            }
        }
        if(p.ready){
            for(const u of [2,p.width-7]){
                const yy=y+7+(reduced?0:p.settle*1.5);
                box(c,x+u-1,yy,7,2,C.ink);box(c,x+u,yy,5,1,C.bronze);
                box(c,x+u+1,y+5,2,2,p.latch>.8?C.gold:C.steel);
            }
            pixelLine(c,x-2,240-cy,x+10,240-cy,'#79aaa5');
            pixelLine(c,x+p.width-10,240-cy,x+p.width+2,240-cy,'#79aaa5');
            drawChaseLandingDust(c,x+p.width/2,y+7,p.age-P.settle,'iron',reduced);
        }
    }
}

function blast(c:CanvasRenderingContext2D,x:number,y:number,age:number,reduced:boolean,floor:number){
    if(age<0||age>64)return;
    if(age<10){
        const r=4+age*1.7;
        polygon(c,[[x-r,y],[x-r*.4,y-r*.4],[x,y-r],[x+r*.45,y-r*.3],[x+r,y],
            [x+r*.3,y+r*.6],[x,y+r*.75],[x-r*.55,y+r*.35]],age<4?'#f7df9b':'#d69761');
        if(age<5)oval(c,x-4,y-4,8,8,C.light);
    }
    if(!reduced&&age<22){
        const r=age*2.4;
        pixelLine(c,x-r,y-2,x-r-4,y-2,C.edge);pixelLine(c,x+r,y+2,x+r+5,y+2,C.edge);
    }
    for(let i=0;i<(reduced?4:11);i++){
        const a=Math.max(0,age-i%3*2),v=(i%4+1)*.42,dx=(i-5)*v*a*.22;
        const yy=y-(1+i%3*.6)*a+.065*a*a;
        if(yy>floor-2)continue;
        polygon(c,[[x+dx,yy],[x+dx+3,yy-1],[x+dx+5,yy+2],[x+dx+1,yy+3]],
            i%3===0?C.bronze:i%2?C.iron:C.steel);
    }
    // Smoke stays above the playable surface and thins into separate packets.
    if(age>5){
        c.save();c.globalAlpha*=.45*(1-smoothMotion((age-24)/40));
        for(let i=0;i<(reduced?2:5);i++){
            const t=Math.max(0,age-5-i*3),xx=x+(i-2)*5+t*.2,yy=y-4-t*.35;
            oval(c,xx-4-t*.08,yy-3,8+t*.17,6+t*.10,C.smoke);
        }
        c.restore();
    }
}

export function drawChaseSetpieceEffects(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number,reduced:boolean){
    const s=b.course;
    for(const p of s.trail){
        const age=s.tick-p.born;if(p.x<cx-24||p.x>cx+344)continue;
        c.save();c.globalAlpha*=.48*(1-unit(age/54));
        const r=1+age*.075,drift=age*.07+(reduced?0:Math.sin(p.seed*.8+age*.12)*Math.min(1.4,age*.05));
        oval(c,p.x-cx-r+age*.08,p.y-cy-r-drift,r*2+1,r*2,p.seed%3?C.smoke:'#c6c9b2');
        if(age<6)box(c,p.x-cx,p.y-cy,2,1,C.gold);c.restore();
    }
    const r=s.rocket;
    if(r){
        const x=r.x-cx,y=r.y-cy,at=(u:number,v:number):Point=>[x+r.dx*u-r.dy*v,y+r.dy*u+r.dx*v];
        const painter={poly:(p:Point[],col:string)=>polygon(c,p,col),
            line:(a:number,b:number,aa:number,bb:number,col:string,w=1)=>pixelLine(c,a,b,aa,bb,col,w)};
        if(r.motorAge>=0){
            const ignition=smoothMotion((r.motorAge+1)/3);
            const tail=rocketTail(r.age),length=(reduced?10:12+Math.sin(r.age*1.7)*2)*ignition;
            polygon(c,[at(-tail,2),at(-tail-length,0),at(-tail,-2)],'#bd7354');
            polygon(c,[at(-tail,1),at(-tail-length*.8,0),at(-tail,-1)],'#efb875');
            pixelLine(c,...at(-tail,0),...at(-tail-length*.4,0),C.light);
        }
        pixelLine(c,...at(-rocketTail(r.age),0),...at(-8,0),C.steel,3);
        drawLauncherWarhead(painter,at,{ink:C.ink,green:'#78865b',lit:C.gold});
        if(r.motorAge>=0)for(const sign of [-1,1]){
            const spread=smoothMotion((r.motorAge+1)/4);
            polygon(c,[at(-11,0),at(-14,sign*(1+spread*3)),at(-9,sign*(1+spread))],C.steel);
        }
    }
    if(s.launch){
        const age=s.tick-s.launchAt,p=s.launch;
        if(age>=0&&age<26){
            const x=p.backX-cx,y=p.backY-cy;
            // Flash ends before the moving rider leaves it behind. Smoke
            // detaches in world space, inheriting the backblast direction.
            if(age<3)polygon(c,[[x-p.dy*3,y+p.dx*3],[x-p.dx*(8+age*4),y-p.dy*(8+age*4)],
                [x+p.dy*3,y-p.dx*3]],age<1?C.light:'#e4b97d');
            c.save();c.globalAlpha*=.45*(1-smoothMotion((age-4)/22));
            for(let i=0;i<(reduced?2:4);i++){
                const t=Math.max(0,age-i),distance=4+i*3+t*.9;
                const xx=x-p.dx*distance-p.dy*(i-1.5)*2,yy=y-p.dy*distance+(i-1.5)*3-t*.13;
                const radius=1+t*.15;
                oval(c,xx-radius,yy-radius,radius*2+2,radius*2,C.smoke);
            }
            c.restore();
            if(age<7){
                const frontX=p.x-cx+p.dx*age*2,frontY=p.y-cy+p.dy*age*2;
                c.save();c.globalAlpha*=.4*(1-age/7);
                oval(c,frontX-2,frontY-2,4+age*.5,3+age*.4,C.edge);c.restore();
            }
        }
    }
    blast(c,P.targetX-cx,P.targetY-cy,s.impactAge,reduced,224-cy);
    const front=s.floodFront;
    if(front){
        const x=front.x-cx,y=224-cy,h=front.height,tail=Math.max(W.sourceX-cx,x-104);
        const curl=reduced?0:Math.sin(s.floodAge*.42)*1.2,foam='#92d2c4';
        c.save();c.beginPath();c.rect(W.sourceX-cx,190-cy,W.endX-W.sourceX,36);c.clip();
        c.save();c.globalAlpha*=.7;
        polygon(c,[[tail,y-2],[x-16,y-4],[x+10,y-h*.8],[x+26,y-h*.7],[x+30,y-3],[x+30,y],[tail,y]],C.waterDeep);
        c.restore();
        polygon(c,[[x,y],[x+4,y-h*.5],[x+10,y-h],[x+20,y-h],[x+28,y-h*.6],[x+30,y],[x,y]],C.water);
        polygon(c,[[x+5,y-h*.5],[x+10,y-h],[x+20,y-h],[x+27,y-h*.6],[x+22,y-h*.65+curl],
            [x+17,y-h*.75+curl],[x+12,y-h*.65],[x+10,y-h*.35]],C.foam);
        polygon(c,[[x+12,y-h*.5],[x+17,y-h*.64],[x+23,y-h*.5],[x+20,y-h*.3],[x+15,y-h*.35]],C.waterDeep);
        pixelLine(c,x+12,y-h*.45,x+21,y-h*.35+curl,foam,2);
        pixelLine(c,x+3,y-2,x+25,y-2,foam);
        for(let i=0;i<5;i++){
            const xx=x-9-i*18-(s.floodAge%6),yy=y-2-i%2;
            if(xx>tail)pixelLine(c,xx,yy,xx+6,yy,'#8dc8bf');
        }
        if(!reduced&&s.floodAge>=W.grow)for(let i=0;i<4;i++){
            const age=(s.floodAge+i*5)%19;
            box(c,x+12-age*.9,y-h+3-Math.sin(age/19*Math.PI)*6,2,1,C.foam);
        }
        c.restore();
    }
    const splash=s.floodAge-CHASE_FLOOD_END;
    if(s.floodAge>=0&&splash>=-W.width/W.speed&&splash<48){
        const x=W.endX-cx,y=224-cy,drain=smoothMotion((splash+W.width/W.speed)/5);
        const fade=1-smoothMotion((splash-8)/32),reach=8+12*drain;
        c.save();c.globalAlpha*=fade;
        // The leading curl falls first. Its trailing sheet follows it through
        // the open canal; it cannot disappear as one rectangular sprite.
        polygon(c,[[x-3,y-3*drain],[x+6,y-1],[x+reach,y+16],[x+reach-6,y+16],[x+3,y+6],[x-3,y]],C.waterDeep);
        polygon(c,[[x-2,y-3*drain],[x+5,y],[x+reach-1,y+16],[x+reach-4,y+16],[x+2,y+4],[x-2,y-1]],C.water);
        pixelLine(c,x-2,y-3*drain,x+5,y,C.foam,2);
        for(let i=0;i<4;i++){
            const u=((splash+30+i*4)%16)/16;
            pixelLine(c,x+3+u*12,y+u*u*16,x+5+u*12,y+u*u*16+2,C.foam);
        }
        if(splash>=0){
            const tail=x-104*(1-smoothMotion(splash/34));
            polygon(c,[[tail,y-1],[x,y-3],[x,y],[tail,y]],C.waterDeep);
            for(let i=0;i<4;i++)pixelLine(c,x-9-i*20+splash*.3,y-1,x-4-i*20+splash*.3,y-1,'#8dc8bf');
        }
        c.restore();
        waterContact(c,x+reach,240-cy,splash,reduced,1.1);
    }
    if(s.leaping){
        const foot=s.takeoffFeet[s.takeoffFeet[0][1]>s.takeoffFeet[1][1]?0:1];
        drawChaseLandingDust(c,s.leapFrom+foot[0]-cx,224-cy,s.leapAge-L.prepare,'timber',reduced);
        drawChaseLandingDust(c,s.leapTo+17-cx,224-cy,s.landingAge,'timber',reduced);
        drawChaseLandingDust(c,s.leapTo-9-cx,224-cy,s.landingAge-2,'timber',reduced);
    }
}
