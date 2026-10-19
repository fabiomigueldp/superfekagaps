import {box,oval,pixelLine,polygon,type Point} from '../WorldPainting';
import {smoothMotion} from './HypotheticalMotion';
import {drawBystanders,drawHead,SKIN,SKIN_SHADE} from './HypotheticalBystanders';
import type {HypotheticalBackdrop} from './HypotheticalBackdrop';
import {TOWER_SEARCH,type TowerGorePiece} from './HypotheticalTowerSearch';

function drawGorePiece(c:CanvasRenderingContext2D,s:HypotheticalBackdrop['aftermath']['tower']['search'],p:TowerGorePiece,base:number){
    const x=p.x,y=base+p.y,co=Math.cos(p.angle),si=Math.sin(p.angle);
    const at=(u:number,v:number):Point=>[x+u*co-v*si,y+u*si+v*co];
    const skin=SKIN[s.person.color],shade=SKIN_SHADE[s.person.color];
    if(p.rest&&!p.kind.startsWith('cloth'))oval(c,x-p.radius*1.4,y+p.radius-.5,p.radius*2.8,2,'#4a0f14');
    if(p.kind==='cloth-star'||p.kind==='cloth-left'||p.kind==='cloth-right'){
        const r=p.kind==='cloth-star'?3.2:2.4;
        polygon(c,[at(-r,-1.2),at(r*.8,-1.6),at(r,1.1),at(-r*.7,1.5)],'#b9655c');
        polygon(c,[at(-r*.8,0),at(r*.6,-.5),at(r*.9,1.1),at(-r*.6,1.4)],'#934843');
        pixelLine(c,...at(-r,-.8),...at(0,1.2),'#6b1117');
        if(p.kind==='cloth-star'){
            const star=at(0,-.2);
            box(c,star[0]-1,star[1]-1,2,2,'#d8d2be');
            box(c,star[0],star[1],1,1,'#9e2028');
        }
        return;
    }
    if(p.kind==='arm-left'||p.kind==='arm-right'){
        const dir=p.kind==='arm-left'?-1:1;
        pixelLine(c,...at(-2*dir,-1),...at(0,0),'#6b1117',3);
        pixelLine(c,...at(-3*dir,-1.5),...at(-1*dir,-.5),'#e6dfd3');
        pixelLine(c,...at(-1.5*dir,-.5),...at(1.5*dir,.5),'#b9655c',3);
        pixelLine(c,...at(1*dir,.5),...at(4*dir,1.5),skin,2);
        pixelLine(c,...at(1*dir,1.2),...at(3.5*dir,2),shade);
        pixelLine(c,...at(4*dir,1.5),...at(5.5*dir,.5),skin);
        pixelLine(c,...at(4*dir,1.5),...at(5.5*dir,2.2),skin);
        return;
    }
    if(p.kind==='leg-left'){
        pixelLine(c,...at(-3,-1),...at(-1,0),'#5a1016',3);
        pixelLine(c,...at(-4,-1.5),...at(-1.5,-.5),'#e6dfd3',2);
        pixelLine(c,...at(-1.5,0),...at(2,1.5),'#485f62',3);
        pixelLine(c,...at(2,1.5),...at(5,-.5),'#667c79',2);
        pixelLine(c,...at(5,-.5),...at(6.5,1.8),'#89978a',2);
        return;
    }
    if(p.kind==='pelvis'){
        const k=p.kick*1.8;
        polygon(c,[at(-4,-3),at(3,-3),at(4,2),at(-3,2)],'#485f62');
        pixelLine(c,...at(-4,-3),...at(3,-3),'#934843',2);
        pixelLine(c,...at(-3.5,-4),...at(2.5,-3.5),'#5a1016',3);
        pixelLine(c,...at(-2,-4.5),...at(2,-4),'#9e2028',2);
        pixelLine(c,...at(0,-4),...at(-.5,-7.5),'#e6dfd3',2);
        pixelLine(c,...at(-.5,-6),...at(.5,-6),'#8e1c24');
        pixelLine(c,...at(-2,-4),...at(-3.5,-6.5+k),'#7a1820',2);
        pixelLine(c,...at(1.5,-4),...at(3,-6-k),'#b8252e');
        pixelLine(c,...at(-2.5,1),...at(-4,2.5),'#6b1117',3);
        pixelLine(c,...at(-3.5,2),...at(-5,3),'#e6dfd3');
        const knee=at(2+k,5.5),foot=at(4-k,9.5);
        pixelLine(c,...at(1.5,1.5),...knee,'#485f62',2);
        pixelLine(c,...knee,...foot,'#667c79',2);
        pixelLine(c,...foot,...at(6-k,9.5),'#89978a',2);
        return;
    }
    if(p.kind==='torso-stump'){
        polygon(c,[at(-4.5,-3.5),at(4.5,-3),at(3.5,3.5),at(-4,3)],'#b9655c');
        polygon(c,[at(-3.5,-2),at(3.5,-1.5),at(2.5,3),at(-3,2.5)],'#6b1117');
        pixelLine(c,...at(-4,-3),...at(4,-2.5),'#934843',2);
        for(const ry of [-1.5,.5,2]){
            pixelLine(c,...at(-2.5,ry),...at(2.5,ry+.4),'#e6dfd3');
        }
        pixelLine(c,...at(0,-3.5),...at(0,3.5),'#9e2028',2);
        pixelLine(c,...at(0,-3.5),...at(0,-5.5),'#e6dfd3',2);
        return;
    }
    if(p.kind==='head'){
        pixelLine(c,...at(-1,2),...at(1,4.5),'#5a1016',3);
        pixelLine(c,...at(0,2.5),...at(0,5.5),'#e6dfd3',2);
        pixelLine(c,...at(-1.5,3),...at(1.5,4),'#b8252e');
        drawHead(c,s.person,x,y-3,1,p.angle);
        const mouth=at(2,0),brow=at(-1,-1.5);
        box(c,mouth[0],mouth[1],2,2,'#3a0b10');
        box(c,mouth[0]-1,mouth[1]+1,2,2,'#9e2028');
        box(c,brow[0],brow[1],2,1,'#b8252e');
    }
}

/** The reveal stays behind the dinosaur. The carried actor is drawn inside
 * its mouth layer; the dismembered pieces and blood pools persist on the disturbed ruins. */
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
    for(const stain of s.stains){
        const grow=smoothMotion((s.tick-stain.born)/14),r=stain.radius*(.45+.55*grow);
        const y=base+stain.y;
        oval(c,stain.x-r*1.2,y-1.5,r*2.4,3.2,'#4a0f14');
        oval(c,stain.x-r*.85,y-1,r*1.7,2.3,'#7a1820');
        oval(c,stain.x-r*.48,y-1,r*.96,1.5,'#b8252e');
        box(c,stain.x-r*.22,y-1,Math.max(1,r*.35),1,'#df4850');
        if(stain.y<-7&&r>5){
            const drip=Math.min(3,(2+stain.seed%2)*grow);
            pixelLine(c,stain.x-1,y+1,stain.x-1,y+1+drip,'#5a1016');
            pixelLine(c,stain.x,y+1,stain.x,y+1+drip*.7,'#8e1c24');
        }
    }
    for(const p of s.pieces){
        if(p.kind.startsWith('cloth'))drawGorePiece(c,s,p,base);
    }
    for(const p of s.pieces){
        if(!p.kind.startsWith('cloth')&&p.kind!=='head')drawGorePiece(c,s,p,base);
    }
    for(const p of s.pieces){
        if(p.kind==='head')drawGorePiece(c,s,p,base);
    }
    // Released solids stay with the other objects on the rear street.
    for(const [i,sp] of s.splinters.entries()){
        if(reduced&&i%2)continue;
        const x=sp.x,y=base+sp.y;
        if(!sp.rest&&!reduced)pixelLine(c,x-sp.vx*1.4,y-sp.vy*1.4,x,y,'#9e2028');
        box(c,x-1,y-1,sp.bone?2:2,sp.bone?1:2,sp.bone?'#e6dfd3':'#7a1820');
        box(c,x,y,1,1,sp.bone?'#9e2028':'#c92c34');
    }
}

function bloodCloud(c:CanvasRenderingContext2D,x:number,y:number,r:number,seed:number){
    const lean=(seed%3-1)*r*.15;
    polygon(c,[[x-r,y],[x-r*.7+lean,y-r*.55],[x,y-r*.8],[x+r*.65,y-r*.5],[x+r,y],[x+r*.6,y+r*.4],[x-r*.5,y+r*.35]],'#6b1117');
    polygon(c,[[x-r*.6,y-r*.1],[x+lean,y-r*.5],[x+r*.5,y-r*.15],[x+r*.2,y+r*.2],[x-r*.4,y+r*.15]],'#a8242c');
    box(c,x-r*.25,y-r*.35,Math.max(1,r*.45),Math.max(1,r*.22),'#df4850');
}

export function drawTowerSearchDust(c:CanvasRenderingContext2D,b:HypotheticalBackdrop,base:number,reduced:boolean){
    const s=b.aftermath.tower.search,a=s.age,t=TOWER_SEARCH;
    for(const p of s.dust){
        const age=s.tick-p.born;if(age<0||age>=64)continue;
        const fade=(1-smoothMotion((age-12)/52))*.5;
        c.save();c.globalAlpha=fade;
        for(let j=0;j<(reduced?2:4);j++){
            const x=p.x+(j-1.5)*(3+age*.12),y=base+p.y+Math.min(5,age*.09)-j%2*2,r=(2+age*.05)*p.strength*1.5;
            polygon(c,[[x-r,y],[x-r*.6,y-r],[x+r*.2,y-r*.8],[x+r,y-r*.4],[x+r*.7,y+1],[x-r*.5,y+1]],'#aab098');
            box(c,x-r*.5,y-r*.7,Math.max(1,r*.7),1,'#c1b99f');
        }
        c.restore();
    }
    if(reduced||a<t.clamp)return;
    const jx=s.jawX,jy=base+s.body.jawY;
    for(const p of s.pieces){
        const elapsed=a-p.born;
        if(p.kind.startsWith('cloth')||elapsed<0||elapsed>15)continue;
        const px=p.x,py=base+p.y,sag=elapsed*.45;
        const mx=(jx+px)*.5,my=(jy+py)*.5+sag;
        pixelLine(c,jx,jy+2,mx,my,'#5a1016',2);
        pixelLine(c,mx,my,px,py,'#9e2028',2);
        if(elapsed<9)pixelLine(c,jx-1,jy+1,px,py,'#df4850');
    }
    for(const sp of s.sprays){
        const age=s.tick-sp.born;if(age<0||age>=42)continue;
        const fade=1-smoothMotion((age-10)/32);
        c.save();c.globalAlpha=fade*.85;
        for(let j=0;j<3;j++){
            const u=age*(.55+j*.22)*sp.strength;
            const cx=sp.x+sp.dx*u+(j-1)*2.5,cy=base+sp.y+sp.dy*u+.045*age*age;
            bloodCloud(c,cx,cy,(2.2+age*.08)*sp.strength,sp.seed+j);
        }
        if(age<16){
            for(let k=0;k<5;k++){
                const ang=Math.atan2(sp.dy,sp.dx)+(k-2)*.28;
                const d=(3+age*1.35)*sp.strength*(.75+(k%2)*.3);
                const x1=sp.x+Math.cos(ang)*d*.45,y1=base+sp.y+Math.sin(ang)*d*.45+.02*age*age;
                const x2=sp.x+Math.cos(ang)*d,y2=base+sp.y+Math.sin(ang)*d+.05*age*age;
                pixelLine(c,x1,y1,x2,y2,k%2?'#df4850':'#8e1c24',k===2?2:1);
            }
        }
        c.restore();
    }
    if(a>=t.clamp+4&&a<=t.end){
        for(let d=0;d<3;d++){
            const cycle=(a+d*9)%18,dropY=jy+4+cycle*1.15+.03*cycle*cycle;
            const dropX=jx-4+d*4+Math.sin(a*.2+d)*1.5;
            if(dropY<base-4){
                pixelLine(c,dropX,dropY-2,dropX,dropY,'#9e2028');
                box(c,dropX,dropY,1,1,'#df4850');
            }
        }
    }
}
