import type {Point} from '../WorldPainting';
import {smoothMotion} from './HypotheticalMotion';

export type TowerPart='arch'|'shaft'|'belfry'|'roof'|'bell'|'pier-left'|'pier-right'|'lintel'|'sill'|'roof-left'|'roof-right';
type Material='stone'|'tile'|'bronze'|'wood';
export const TOWER_RELEASE={shaft:18,belfry:40,roof:48,bell:56,arch:88} as const;
const FLOOR=-5;
interface Definition {x:number;y:number;shape:Point[];material:Material;inertia:number}
const rectangle=(left:number,top:number,right:number,bottom:number):Point[]=>[[left,top],[right,top],[right,bottom],[left,bottom]];
export const TOWER_PARTS:Record<TowerPart,Definition>={
    arch:{x:0,y:-33,shape:rectangle(-23,-9,26,9),material:'stone',inertia:230},
    shaft:{x:0,y:-54,shape:rectangle(-25,-12,26,12),material:'stone',inertia:260},
    belfry:{x:0,y:-83,shape:rectangle(-23,-19,26,17),material:'stone',inertia:320},
    roof:{x:0,y:-104,shape:[[-30,2],[-22,-5],[0,-10],[24,-5],[32,2]],material:'tile',inertia:330},
    bell:{x:0,y:-79,shape:[[-4,-7],[4,-7],[6,1],[10,5],[-10,5],[-6,1]],material:'bronze',inertia:38},
    'pier-left':{x:-17,y:-84,shape:rectangle(-6,-18,6,18),material:'stone',inertia:120},
    'pier-right':{x:19,y:-84,shape:rectangle(-7,-18,7,18),material:'stone',inertia:124},
    lintel:{x:0,y:-98,shape:[[-11,-4],[12,-4],[12,8],[7,4],[0,1],[-5,4],[-11,9]],material:'stone',inertia:55},
    sill:{x:0,y:-68,shape:rectangle(-11,-2,12,2),material:'stone',inertia:48},
    'roof-left':{x:-14,y:-106,shape:[[-16,4],[-8,-3],[14,-8],[14,4]],material:'tile',inertia:92},
    'roof-right':{x:16,y:-106,shape:[[-16,-8],[8,-3],[16,4],[-16,4]],material:'tile',inertia:94},
};
export interface TowerBody {
    id:TowerPart;x:number;y:number;angle:number;vx:number;vy:number;spin:number;
    attached:boolean;held:boolean;hidden:boolean;sleeping:boolean;quiet:number;landedAt:number;lastContact:number;
}
export interface TowerContact {part:TowerPart;x:number;y:number;born:number;strength:number;slide:number;material:Material;first:boolean}
export interface TowerChip {x:number;y:number;vx:number;vy:number;angle:number;spin:number;radius:number;
    born:number;material:Material;rest:boolean;keep:boolean;bounces:number;stretch:number;shade:number}
export interface TowerPlume {x:number;y:number;vx:number;vy:number;born:number;radius:number;seed:number}
const rotate=(x:number,y:number,angle:number):Point=>[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle)];
export function towerBodyPoint(body:TowerBody,x:number,y:number):Point {
    const d=TOWER_PARTS[body.id],r=rotate(x-d.x,y-d.y,body.angle);return [body.x+r[0],body.y+r[1]];
}
const makeBody=(id:TowerPart):TowerBody=>({id,x:TOWER_PARTS[id].x,y:TOWER_PARTS[id].y,angle:0,
    vx:0,vy:0,spin:0,attached:true,held:false,hidden:id==='pier-left'||id==='pier-right'||id==='lintel'||id==='sill'||id==='roof-left'||id==='roof-right',
    sleeping:false,quiet:0,landedAt:-1,lastContact:-100});

/** Small, bounded scenic bodies, stepped at the game's 60 Hz. The tower's
 * supports release in an authored order; free pieces then use gravity,
 * angular impulses, friction and actual contacts, not a tween to a ruin pose. */
export class HypotheticalTowerPhysics {
    age=-1;
    readonly bodies=Object.fromEntries((Object.keys(TOWER_PARTS) as TowerPart[]).map(id=>[id,makeBody(id)])) as Record<TowerPart,TowerBody>;
    chips:TowerChip[]=[];contacts:TowerContact[]=[];events:TowerContact[]=[];
    fractures:Array<{x:number;y:number;born:number;part:TowerPart;material:Material}>=[];
    plumes:TowerPlume[]=[];
    clapper=0;private clapperVelocity=0;
    private seed=731;
    private random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
    start(direction:number){
        if(this.age>=0)return;
        this.age=0;this.splinters(0,-64,22,'stone',direction*.8,2.4);
    }
    private splinters(x:number,y:number,count:number,material:Material,vx=0,force=1){
        for(let i=0;i<count&&this.chips.length<64;i++){
            const radius=material==='wood'?.65+this.random()*.7:material==='tile'?1.1+this.random():.8+this.random()*1.5;
            const shade=i%3,stretch=material==='wood'?2.8:material==='tile'?1.55:1;
            this.chips.push({x:x+(this.random()-.5)*8,y:y+(this.random()-.5)*5,
                vx:vx+(this.random()-.5)*force*1.6,vy:-.5-this.random()*force,
                angle:this.random()*Math.PI,spin:(this.random()-.5)*.24,radius,born:this.age,
                material,rest:false,keep:i%3===0,bounces:0,stretch,shade});
        }
    }
    private release(id:TowerPart,vx:number,vy:number,spin:number){
        const b=this.bodies[id];b.attached=false;b.vx+=vx;b.vy+=vy;b.spin+=spin;
        // Fragments come from the joint that fails, transformed with the part.
        // The bell tears its timber suspension, rather than shedding masonry.
        const joint:Point=id==='shaft'?[0,-64]:id==='belfry'?[6,-67]:id==='roof'?[0,-107]:id==='bell'?[0,-88]:[-5,-26];
        const p=towerBodyPoint(id==='bell'?this.bodies.belfry:b,...joint);
        const material=id==='bell'?'wood':id==='roof'?'tile':'stone';
        this.fractures.push({part:id,x:p[0],y:p[1],born:this.age,material});
        this.splinters(p[0],p[1],id==='roof'?8:4,material,vx*.4,.6);
    }
    private follow(id:'roof'|'bell'){
        const b=this.bodies[id],parent=this.bodies.belfry,d=TOWER_PARTS[id];
        const sway=id==='bell'?Math.sin(this.age*.25)*.16*(1-smoothMotion(this.age/90)):0;
        const p=towerBodyPoint(parent,d.x+Math.sin(sway)*8,d.y),angle=parent.angle+sway;
        b.vx=p[0]-b.x;b.vy=p[1]-b.y;b.spin=angle-b.angle;b.x=p[0];b.y=p[1];b.angle=angle;
    }
    private surface(x:number,previousY:number,ignore?:TowerBody){
        // Retained plinth, rear street, then already-settled masonry. Crossing
        // from above prevents a piece beside a wall from snapping onto its top.
        let floor=FLOOR;
        if(x>=-26&&x<=26&&previousY<=-23.5)floor=-24;
        for(const b of Object.values(this.bodies)){
            if(b===ignore||b.hidden||!b.sleeping)continue;
            const vertices=TOWER_PARTS[b.id].shape.map(([xx,yy])=>{
                const p=rotate(xx,yy,b.angle);return [b.x+p[0],b.y+p[1]] as Point;
            });
            for(let i=0;i<vertices.length;i++){
                const a=vertices[i],z=vertices[(i+1)%vertices.length];
                if(x<Math.min(a[0],z[0])||x>Math.max(a[0],z[0])||Math.abs(z[0]-a[0])<.001)continue;
                const y=a[1]+(z[1]-a[1])*(x-a[0])/(z[0]-a[0]);
                if(previousY<=y+.5)floor=Math.min(floor,y);
            }
        }
        return floor;
    }
    shadow(body:TowerBody){
        const vertices=TOWER_PARTS[body.id].shape.map(([x,y])=>rotate(x,y,body.angle));
        const bottom=body.y+Math.max(...vertices.map(p=>p[1]));
        const floor=this.surface(body.x,bottom-1,body);
        const width=Math.max(...vertices.map(p=>p[0]))-Math.min(...vertices.map(p=>p[0]));
        return {y:floor,height:Math.max(0,floor-bottom),width};
    }
    grab(id:TowerPart){
        const held=this.bodies[id];held.held=true;held.sleeping=false;held.quiet=0;held.vx=held.vy=held.spin=0;
        const outline=TOWER_PARTS[id].shape.map(([x,y])=>{const p=rotate(x,y,held.angle);return [held.x+p[0],held.y+p[1]] as Point;});
        // Wake a settled piece if one of its supporting corners was on this
        // roof wing. Removing a support must not leave stones hanging in air.
        for(const b of Object.values(this.bodies)){
            if(!b.sleeping||b.hidden||b===held)continue;
            const supported=TOWER_PARTS[b.id].shape.some(([x,y])=>{
                const p=rotate(x,y,b.angle),px=b.x+p[0],py=b.y+p[1];
                return outline.some((a,i)=>{
                    const z=outline[(i+1)%outline.length];
                    if(px<Math.min(a[0],z[0])||px>Math.max(a[0],z[0])||Math.abs(z[0]-a[0])<.001)return false;
                    const top=a[1]+(z[1]-a[1])*(px-a[0])/(z[0]-a[0]);return Math.abs(py-top)<1;
                });
            });
            if(supported){b.sleeping=false;b.quiet=0;}
        }
    }
    carry(id:TowerPart,x:number,y:number,angle:number){
        const b=this.bodies[id];if(!b.held)return;
        b.vx=x-b.x;b.vy=y-b.y;b.spin=angle-b.angle;b.x=x;b.y=y;b.angle=angle;
    }
    drop(id:TowerPart,vx:number,vy:number,spin:number){
        const b=this.bodies[id];b.held=false;b.sleeping=false;b.quiet=0;b.vx=vx;b.vy=vy;b.spin=spin;
    }
    disturbChips(x:number,y:number,force:number){
        const nearby=this.chips.filter(p=>p.rest&&Math.hypot(p.x-x,p.y-y)<28)
            .sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x)).slice(0,4);
        for(const [i,p] of nearby.entries()){
            p.rest=false;p.bounces=0;p.vx=-force*(.65+i*.16);p.vy=-force*(.8+i*.12);p.spin=-.02-force*.025;
        }
    }
    private integrate(b:TowerBody){
        const def=TOWER_PARTS[b.id],restitution=def.material==='bronze'?.28:def.material==='tile'?.16:.09;
        const startX=b.x,startY=b.y,startAngle=b.angle;let nearSupport=false;
        // Two short substeps keep rotating corners from tunnelling into the road.
        for(let sub=0;sub<2;sub++){
            const oldX=b.x,oldY=b.y,oldAngle=b.angle;
            b.vy+=.045;b.x+=b.vx*.5;b.y+=b.vy*.5;b.angle+=b.spin*.5;
            let depth=0,cx=0,cy=0,n=0;
            for(const [xx,yy] of def.shape){
                const p=rotate(xx,yy,b.angle),before=rotate(xx,yy,oldAngle);
                const floor=this.surface(b.x+p[0],oldY+before[1],b),over=b.y+p[1]-floor;
                if(over>-.65)nearSupport=true;
                if(over>depth+.2){depth=over;cx=p[0];cy=p[1];n=1;}
                else if(over>0&&Math.abs(over-depth)<=.2){cx+=p[0];cy+=p[1];n++;depth=Math.max(depth,over);}
            }
            if(!n)continue;
            cx/=n;cy/=n;b.y-=depth;
            const velocity=b.vy+b.spin*cx;
            if(velocity>0){
                const impulse=-(1+restitution)*velocity/(1+cx*cx/def.inertia);
                b.vy+=impulse;b.spin+=cx*impulse/def.inertia;
                const slide=b.vx-b.spin*cy,limit=Math.abs(impulse)*.72;
                const friction=Math.max(-limit,Math.min(limit,-slide/(1+cy*cy/def.inertia)));
                b.vx+=friction;b.spin-=cy*friction/def.inertia;
                if(velocity>.48&&this.age-b.lastContact>8){
                    const contact={part:b.id,x:b.x+cx,y:b.y+cy,born:this.age,
                        strength:Math.min(1.8,velocity/2.2),slide,material:def.material,first:b.landedAt<0};
                    if(b.landedAt<0)b.landedAt=this.age;b.lastContact=this.age;
                    this.contacts.push(contact);this.events.push(contact);
                }
            }
            b.vx*=.98;b.spin*=.96;
            // Preserve finite velocities if two nearly coincident supports meet.
            if(!Number.isFinite(b.x+b.y+b.angle)){b.x=oldX;b.y=oldY;b.angle=oldAngle;b.vx=b.vy=b.spin=0;b.sleeping=true;}
        }
        // Sleep on sustained subpixel motion, including the tiny intervals
        // between contacts. Resetting at each micro-bounce kept rubble alive.
        const slow=Math.hypot(b.x-startX,b.y-startY)<.16&&Math.abs(b.angle-startAngle)<.006;
        b.quiet=nearSupport&&slow?b.quiet+1:0;
        if(b.quiet>=24){b.sleeping=true;b.vx=0;b.vy=0;b.spin=0;}
    }
    private breakBelfry(){
        const parent=this.bodies.belfry;parent.hidden=true;parent.sleeping=true;
        for(const [id,impulse] of [['pier-left',-.65],['pier-right',.7],['lintel',.18],['sill',-.22]] as const){
            const b=this.bodies[id],d=TOWER_PARTS[id],p=towerBodyPoint(parent,d.x,d.y);
            b.x=p[0];b.y=p[1];b.angle=parent.angle;b.hidden=false;b.attached=false;
            b.vx=parent.vx*.5+impulse;b.vy=-.35-Math.abs(impulse)*.35;b.spin=parent.spin+impulse*.045;
        }
        const hit=this.events.find(e=>e.part==='belfry'),x=hit?.x??parent.x,y=hit?.y??parent.y;
        this.fractures.push({part:'belfry',x,y,born:this.age,material:'stone'});
        this.splinters(x,y,10,'stone',(hit?.slide??.6)*.3,1.1);
    }
    private splitRoof(){
        const parent=this.bodies.roof;parent.hidden=true;parent.sleeping=true;
        for(const [id,direction] of [['roof-left',-1],['roof-right',1]] as const){
            const b=this.bodies[id],d=TOWER_PARTS[id],p=towerBodyPoint(parent,d.x,d.y);
            b.x=p[0];b.y=p[1];b.angle=parent.angle;b.hidden=false;b.attached=false;
            b.vx=parent.vx+direction*.35;b.vy=parent.vy+(direction<0?.2:-.1);
            b.spin=parent.spin+direction*.018;
        }
    }
    step(age:number){
        if(this.age<0||age<=this.age)return;
        this.age=age;this.events=[];
        const bell=this.bodies.bell,oldBellVX=bell.vx,oldBellSpin=bell.spin;
        const top=this.bodies.belfry;
        if(top.attached){
            const angle=.21*smoothMotion((age-7)/33),p=rotate(-18,-17,angle);
            const x=18+p[0],y=-66+p[1];top.vx=x-top.x;top.vy=y-top.y;
            top.spin=angle-top.angle;top.x=x;top.y=y;top.angle=angle;
        }
        if(age===TOWER_RELEASE.shaft)this.release('shaft',-.72,.12,-.019);
        if(age===TOWER_RELEASE.belfry)this.release('belfry',.65,.12,.012);
        if(age===TOWER_RELEASE.arch)this.release('arch',-.85,.06,-.022);
        for(const id of ['arch','shaft','belfry'] as const){const b=this.bodies[id];if(!b.attached&&!b.hidden&&!b.sleeping)this.integrate(b);}
        for(const id of ['roof','bell'] as const){
            const b=this.bodies[id];if(b.attached)this.follow(id);
            if(age===TOWER_RELEASE[id]){
                this.release(id,id==='roof'?.2:.5,id==='roof'?-1.7:-.2,id==='roof'?.006:.035);
                if(id==='roof')this.splitRoof();
            }
            if(!b.hidden&&!b.attached&&!b.sleeping)this.integrate(b);
        }
        if(top.landedAt>=0&&!top.hidden)this.breakBelfry();
        for(const id of ['pier-left','pier-right','lintel','sill','roof-left','roof-right'] as const){
            const b=this.bodies[id];if(!b.hidden&&!b.sleeping&&!b.held)this.integrate(b);
        }
        // The clapper lags the bell's acceleration, then catches its inner lip.
        this.clapperVelocity+=-Math.sin(bell.angle+this.clapper)*.035-(bell.vx-oldBellVX)*.06-(bell.spin-oldBellSpin)*.4;
        this.clapperVelocity*=.965;this.clapper+=this.clapperVelocity;
        if(Math.abs(this.clapper)>.55){this.clapper=Math.sign(this.clapper)*.55;this.clapperVelocity=0;}
        // Delayed smoke is emitted by the moving breach, never by an empty
        // point in the sky after the shaft has fallen. Released puffs drift freely.
        if(age>=8&&age<=68&&(age-8)%12===0){
            const b=this.bodies.shaft,p=towerBodyPoint(b,1,-60),seed=(age-8)/12;
            this.plumes.push({x:p[0],y:p[1],vx:b.vx*.12+.08,vy:b.vy*.04-.16,
                born:age,radius:4+seed%3*.6,seed});
        }
        this.plumes=this.plumes.filter(p=>age-p.born<168);
        for(const chip of this.chips){
            if(chip.rest)continue;
            const previous=chip.y+chip.radius;chip.vy+=.11;chip.x+=chip.vx;chip.y+=chip.vy;chip.angle+=chip.spin;
            const floor=this.surface(chip.x,previous);
            if(chip.y+chip.radius>=floor&&chip.vy>0){
                chip.y=floor-chip.radius;chip.vy*=-.24;chip.vx*=.55;chip.spin*=.42;chip.bounces++;
                if(Math.abs(chip.vy)<.18||chip.bounces>=3){chip.vy=0;chip.vx=0;chip.spin=0;chip.rest=true;}
            }
        }
        this.chips=this.chips.filter(p=>p.keep||age-p.born<240);
        this.contacts=this.contacts.filter(p=>age-p.born<100).slice(-28);
        this.fractures=this.fractures.filter(p=>age-p.born<70);
    }
}
