import {box,oval,pixelLine,polygon,type Point} from '../WorldPainting';
import {smoothMotion} from './HypotheticalMotion';
import {drawHead,SKIN,SKIN_SHADE} from './HypotheticalBystanders';
import {forageGrain,type AftermathForage,type ForageGorePiece} from './HypotheticalAftermathForage';

const P={shade:'#73887d',dust:'#a8ae96',light:'#bab99e',stone:'#8f9f8b',ink:'#607b73'};
const CLOTH_COLORS={
    'star-shirt':{base:'#b9655c',shade:'#934843'},
    workcoat:{base:'#7b9183',shade:'#536b67'},
    scarf:{base:'#9b9271',shade:'#736c60'},
    satchel:{base:'#8598a2',shade:'#566f7d'},
} as const;

function drawForagePiece(c:CanvasRenderingContext2D,p:ForageGorePiece,base:number){
    const x=p.x,y=base+p.y,co=Math.cos(p.angle),si=Math.sin(p.angle);
    const at=(u:number,v:number):Point=>[x+u*co-v*si,y+u*si+v*co];
    const skin=SKIN[p.person.color],shade=SKIN_SHADE[p.person.color];
    const cloth=CLOTH_COLORS[p.person.clothes];
    if(p.rest&&!p.kind.startsWith('cloth'))oval(c,x-p.radius*1.4,y+p.radius-.5,p.radius*2.8,2,'#4a0f14');
    if(p.kind==='cloth-star'||p.kind==='cloth-left'||p.kind==='cloth-right'){
        const r=p.kind==='cloth-star'?3.2:2.4;
        polygon(c,[at(-r,-1.2),at(r*.8,-1.6),at(r,1.1),at(-r*.7,1.5)],cloth.base);
        polygon(c,[at(-r*.8,0),at(r*.6,-.5),at(r*.9,1.1),at(-r*.6,1.4)],cloth.shade);
        pixelLine(c,...at(-r,-.8),...at(0,1.2),'#6b1117');
        if(p.kind==='cloth-star'&&p.person.clothes==='star-shirt'){
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
        pixelLine(c,...at(-1.5*dir,-.5),...at(1.5*dir,.5),cloth.base,3);
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
        pixelLine(c,...at(-4,-3),...at(3,-3),cloth.shade,2);
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
        polygon(c,[at(-4.5,-3.5),at(4.5,-3),at(3.5,3.5),at(-4,3)],cloth.base);
        polygon(c,[at(-3.5,-2),at(3.5,-1.5),at(2.5,3),at(-3,2.5)],'#6b1117');
        pixelLine(c,...at(-4,-3),...at(4,-2.5),cloth.shade,2);
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
        drawHead(c,p.person,x,y-3,1,p.angle);
        const mouth=at(2,0),brow=at(-1,-1.5);
        box(c,mouth[0],mouth[1],2,2,'#3a0b10');
        box(c,mouth[0]-1,mouth[1]+1,2,2,'#9e2028');
        box(c,brow[0],brow[1],2,1,'#b8252e');
    }
}

function bloodCloud(c:CanvasRenderingContext2D,x:number,y:number,r:number,seed:number){
    const lean=(seed%3-1)*r*.15;
    polygon(c,[[x-r,y],[x-r*.7+lean,y-r*.55],[x,y-r*.8],[x+r*.65,y-r*.5],[x+r,y],[x+r*.6,y+r*.4],[x-r*.5,y+r*.35]],'#6b1117');
    polygon(c,[[x-r*.6,y-r*.1],[x+lean,y-r*.5],[x+r*.5,y-r*.15],[x+r*.2,y+r*.2],[x-r*.4,y+r*.15]],'#a8242c');
    box(c,x-r*.25,y-r*.35,Math.max(1,r*.45),Math.max(1,r*.22),'#df4850');
}

/** Back layer: persistent blood pools, torn clothing scraps and severed anatomical
 * pieces lying on the street cobbles behind the dinosaur. */
export function drawForageRemains(c:CanvasRenderingContext2D,s:AftermathForage,base:number,tick:number,reduced=false){
    for(const stain of s.stains){
        const grow=smoothMotion((tick-stain.born)/14),r=stain.radius*(.45+.55*grow);
        const y=base+stain.y;
        oval(c,stain.x-r*1.2,y-1.5,r*2.4,3.2,'#4a0f14');
        oval(c,stain.x-r*.85,y-1,r*1.7,2.3,'#7a1820');
        oval(c,stain.x-r*.48,y-1,r*.96,1.5,'#b8252e');
        box(c,stain.x-r*.22,y-1,Math.max(1,r*.35),1,'#df4850');
    }
    for(const p of s.pieces){
        if(p.kind.startsWith('cloth'))drawForagePiece(c,p,base);
    }
    for(const p of s.pieces){
        if(!p.kind.startsWith('cloth')&&p.kind!=='head')drawForagePiece(c,p,base);
    }
    for(const p of s.pieces){
        if(p.kind==='head')drawForagePiece(c,p,base);
    }
    // Floor marks and released particles share the street layer.
    for(const mark of s.marks){
        pixelLine(c,mark.x-11,base-2,mark.x+10,base-2,'#7b8e7e');
        pixelLine(c,mark.x-7,base-3,mark.x+5,base-3,'#909e87');
        for(let j=0;j<3;j++)box(c,mark.x-8+j*7,base-2-j%2,2,1,j%2?P.stone:P.shade);
    }
    for(const [i,sp] of s.splinters.entries()){
        if(reduced&&i%2)continue;
        const x=sp.x,y=base+sp.y;
        if(!sp.rest&&!reduced)pixelLine(c,x-sp.vx*1.4,y-sp.vy*1.4,x,y,'#9e2028');
        box(c,x-1,y-1,2,sp.bone?1:2,sp.bone?'#e6dfd3':'#7a1820');
        box(c,x,y,1,1,sp.bone?'#9e2028':'#c92c34');
    }
    if(reduced||s.explicit||s.contactTick<0)return;
    const a=tick-s.contactTick;if(a<0)return;
    for(let j=0;j<9;j++){
        if(s.cancelledAt>=0&&s.contactTick+j>s.cancelledAt)continue;
        const t=a-j;if(t<0||t>112)continue;
        const g=forageGrain(j,t,s.district),px=s.contactX+g.x,py=base+g.y;
        c.save();c.globalAlpha*=1-smoothMotion((t-68)/44);
        if(t<g.landing+g.rebound)box(c,px,base-2,2,1,P.shade);
        box(c,px,py,2,1,j%2?P.stone:P.ink);
        if(t>g.landing&&t<g.landing+8)box(c,px+1,base-3,2,1,P.dust);
        c.restore();
    }
}

/** Front layer: transient contact effects and dust occlusion only. */
export function drawForageCover(c:CanvasRenderingContext2D,s:AftermathForage,base:number,reduced:boolean,tick:number){
    if(!reduced){
        const jx=s.jawX,jy=base+s.jawY;
        for(const p of s.pieces){
            const elapsed=tick-p.bornTick;
            if(p.kind.startsWith('cloth')||elapsed<0||elapsed>15)continue;
            const px=p.x,py=base+p.y,sag=elapsed*.45;
            const mx=(jx+px)*.5,my=(jy+py)*.5+sag;
            pixelLine(c,jx,jy+2,mx,my,'#5a1016',2);
            pixelLine(c,mx,my,px,py,'#9e2028',2);
            if(elapsed<9)pixelLine(c,jx-1,jy+1,px,py,'#df4850');
        }
        for(const sp of s.sprays){
            const age=tick-sp.born;if(age<0||age>=42)continue;
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
        if(s.active&&s.explicit&&s.age>=s.contactAt+4&&s.age<=s.duration-20){
            for(let d=0;d<3;d++){
                const cycle=(s.age+d*9)%18,dropY=jy+4+cycle*1.15+.03*cycle*cycle;
                const dropX=jx-4+d*4+Math.sin(s.age*.2+d)*1.5;
                if(dropY<base-4){
                    pixelLine(c,dropX,dropY-2,dropX,dropY,'#9e2028');
                    box(c,dropX,dropY,1,1,'#df4850');
                }
            }
        }
    }
    if(s.explicit||s.contactTick<0)return;
    const a=tick-s.contactTick;if(a<0)return;
    const cover=s.coverAt(tick),build=smoothMotion(a/20);
    const clearing=smoothMotion((a-64)/60),wind=s.district%2?-.022:.034;
    const x=s.targetX+(reduced?0:Math.max(0,a-20)*wind);
    const density=build>0?Math.min(1,cover/build):0;
    if(density>.01&&build>.025){
        const top=base-3-build*(14-clearing*2),w=26*Math.sqrt(build)*(1+clearing*.22);
        const eddy=reduced?0:Math.sin(a/17)*build*.8;
        c.save();c.globalAlpha*=density;
        polygon(c,[[x-w,base-2],[x-w,top+8*build],[x-20*build,top+4*build],[x-13*build,top+4*build],
            [x-10*build,top+eddy],[x,top-build],[x+7*build,top+2*build],[x+16*build,top+2*build-eddy],[x+w-3,top+6*build],[x+w,base-2]],P.shade);
        polygon(c,[[x-w+2,base-3],[x-w+3,top+9*build],[x-17*build,top+5*build],[x-10*build,top+6*build],
            [x-8*build,top+2*build+eddy],[x+1,top+build],[x+7*build,top+5*build],[x+16*build,top+4*build-eddy],[x+w-3,top+9*build],[x+w-2,base-3]],P.dust);
        for(let j=0;j<5;j++){
            const drift=reduced?0:Math.sin((a-j*3)/19)*(1+j%2)*build;
            pixelLine(c,x+(-18+j*8)*build+drift,top+(8+j%2*4)*build,
                x+(-12+j*8)*build+drift,top+(8+j%2*4)*build,P.light);
        }
        oval(c,x-w,base-3,w*2,2,P.shade);c.restore();
    }
    if(reduced)return;
    for(let j=0;j<5;j++){
        const born=s.contactTick+j*11;if(s.cancelledAt>=0&&born>s.cancelledAt)continue;
        const t=tick-born;if(t<0||t>126)continue;
        const life=smoothMotion(t/12)*(1-smoothMotion((t-50)/76));
        const side=j%2?1:-1,vx=side*(.12+j*.012),drag=1-Math.exp(-t/35);
        const px=s.contactX+side*(12+j%3*3)+vx*35*drag+t*wind;
        const py=base-5-j%3*3-1.8*(1-Math.exp(-t/28));
        c.save();c.globalAlpha*=life*.65;
        box(c,px,py,4+j%3+t*.025,1,P.dust);
        if(j%2===0)box(c,px+2,py-1,3+t*.015,1,P.light);
        c.restore();
    }
}
