import assert from 'node:assert/strict';
import test from 'node:test';
import {sceneLifecycleBrowser} from './helpers/sceneLifecycleHarness';
import {GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {GuairaJunction} from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import {GuairaRespiros} from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import {GuairaAscent} from '../src/adventure/experimental/guaira/GuairaAscent';
import {GuairaGallery} from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import {GuairaRelief} from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import {GUAIRA_COURSES} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {drawGuairaBarrel,drawGuairaFoeProjectiles} from '../src/adventure/experimental/guaira/GuairaFoeProjectiles';
import {WorldObjects} from '../src/adventure/WorldPhysics';

function context(){
    const calls:Array<[string,number,number,number,number]>=[];let offset=[0,0];const stack:number[][]=[];
    const data={fillStyle:'',globalAlpha:1,save(){stack.push([...offset]);},restore(){offset=stack.pop()!;},translate(x:number,y:number){offset[0]+=x;offset[1]+=y;},
        fillRect(x:number,y:number,w:number,h:number){calls.push([this.fillStyle,x+offset[0],y+offset[1],w,h]);}};
    const c=new Proxy(data,{get(o,k){return k in o?o[k as keyof typeof o]:()=>{};}}) as unknown as CanvasRenderingContext2D;
    return {c,calls};
}

for(const [id,Scene]of Object.entries({travessia:GuairaTraversal,patio:GuairaJunction,respiros:GuairaRespiros,subida:GuairaAscent,galeria:GuairaGallery,alivio:GuairaRelief}))
test(`${id}: custom scenery visibly renders live native barrels on both sides of the course seam`,t=>{
    const h=sceneLifecycleBrowser(t),course=GUAIRA_COURSES[id as keyof typeof GUAIRA_COURSES];
    for(const reduced of [false,true]){
    h.media.matches=reduced;const g=h.create<InstanceType<typeof Scene>>(Scene);
    for(const cx of [course.start-200,course.start+64]){
        const o=g.objects;o.barrels=[];const b=o.spawnBarrel(cx+140,course.floor-40);b.rotation=2;
        const cy=course.floor-164,withBarrel=context(),without=context();
        const empty=Object.assign(Object.create(Object.getPrototypeOf(o)),o,{barrels:[]}) as WorldObjects;
        const before=JSON.stringify(o);
        g.art.objects(withBarrel.c,o,cx,cy,o.time,g.stage.world,g.level,false);
        g.art.objects(without.c,empty,cx,cy,o.time,g.stage.world,g.level,false);
        const projectile=withBarrel.calls.slice(without.calls.length);
        assert.ok(projectile.length>10,'collision cannot exist without a corresponding projectile sprite');
        for(const color of ['#413f3d','#b99768','#acc0a1'])assert.ok(projectile.some(call=>call[0]===color));
        assert.ok(withBarrel.calls.some(([color,x,y,w,height])=>color==='#413f3d'&&x>=140&&x<154&&y>=124&&y+height<=140&&w>0));
        assert.equal(JSON.stringify(o),before,'painting never advances or consumes a barrel');
    }g.dispose();}
});

test('carried and released barrels share a 14×16 silhouette; rotation, pause and reduced motion preserve it',()=>{
    const frames=new Set<string>();
    for(let pose=0;pose<8;pose++){
        const a=context();drawGuairaBarrel(a.c,0,0,pose*Math.PI/4);
        for(const[,x,y,w,h]of a.calls){assert.ok([x,y,w,h].every(Number.isInteger));assert.ok(x>=0&&y>=0&&x+w<=14&&y+h<=16);}
        frames.add(JSON.stringify(a.calls));
    }assert.equal(frames.size,4);
    const o=new WorldObjects([]),b=o.spawnBarrel(20,30);b.rotation=1.5;
    const pose=(reduced:boolean)=>{const a=context();drawGuairaFoeProjectiles(a.c,o,0,0,reduced);return JSON.stringify(a.calls);};
    const regular=pose(false),quiet=pose(true);assert.equal(pose(false),regular);assert.notEqual(regular,quiet);
    b.rotation+=1;assert.equal(pose(true),quiet);b.life=0;assert.equal(pose(false),'[]');
});
