import test from 'node:test';
import assert from 'node:assert/strict';
import { HypotheticalBackdrop } from '../src/adventure/hipotetico/HypotheticalBackdrop';
import {SCENIC_STARTS,SCENIC_END,scenicDistrict} from '../src/adventure/hipotetico/HypotheticalDevastation';
import { HypotheticalModel } from '../src/adventure/hipotetico/HypotheticalModel';
import { bystanderPose,bystanderBounds,bystanderFall,bystanderIntersection } from '../src/adventure/hipotetico/HypotheticalBystanderMotion';
import { bystanderTexture,drawBystanderTexture } from '../src/adventure/hipotetico/HypotheticalBystanderPixels';
import { drawBystanders } from '../src/adventure/hipotetico/HypotheticalBystanders';

test('the fictional rider prefers a red-star shirt in each local group, including one behind a closer neutral actor',()=>{
    const b=new HypotheticalBackdrop(true),firstHits:number[]=[],aims:number[]=[];
    // Include every district after the helicopter beat shifts the scenic clock.
    for(let tick=1;tick<=SCENIC_END;tick++){
        const old=b.people.map(p=>p.hitAt);b.update(tick);
        if(SCENIC_STARTS.some(start=>tick===start+90)){
            const target=b.aimedPerson!;assert.equal(target.clothes,'star-shirt');assert.equal(target.district,scenicDistrict(tick));
            aims.push(b.people.indexOf(target));
            if(tick===90)assert.ok(b.people[0].x<target.x,'priority is not just nearest-first');
        }
        b.people.forEach((p,i)=>{if(old[i]===null&&p.hitAt!==null&&!firstHits.some(id=>b.people[id].district===p.district))firstHits.push(i);});
    }
    assert.deepEqual(aims.slice(0,3),[1,2,5]);assert.deepEqual(firstHits.slice(0,3),[10,2,5]);
    assert.equal(aims.length,4);assert.equal(b.people[aims[3]].district,3);
    assert.ok(b.people[10].hitAt!<b.people[1].hitAt!,'a runner can cross the committed volley before the aimed person');
    assert.ok(b.casualties>=10);
    assert.ok(b.people.filter(p=>p.escaped&&p.exitAtShelter).length>=10);
});

test('each burst has twenty ticks of preparation and commits to one destination while its actor moves',()=>{
    const b=new HypotheticalBackdrop(true);let lock:number[]=[],startX=0,shots=0;
    for(let tick=1;tick<=140;tick++){
        b.update(tick);
        if(tick===90){lock=[b.targetX,b.targetY];startX=b.aimedPerson!.x;assert.equal(b.aimedPerson!.threatenedAt,90);}
        if(tick>=90)assert.deepEqual([b.targetX,b.targetY],lock);
        if(tick<110)assert.ok(!b.events.includes('distant-shot'));
        if(b.events.includes('distant-shot')){shots++;assert.ok([110,116,122,128].includes(tick));}
    }
    assert.equal(shots,4);assert.ok(b.aimedPerson!.x>startX);
});

test('distant bullets use the posed silhouette, ignore inactive actors, and do not hit empty corners of a sweep',()=>{
    const p=new HypotheticalBackdrop(true).people[0];p.alertAt=0;p.x=100;
    const overhead={px:90,py:-18,x:110,y:-18};
    assert.notEqual(bystanderIntersection(p,20,overhead),null);
    p.stoppedAt=20;assert.equal(bystanderIntersection(p,30,overhead),null);
    const body={px:90,py:-7,x:110,y:-7};assert.notEqual(bystanderIntersection(p,30,body),null);
    const bounds=bystanderBounds(p,30);
    assert.equal(bystanderIntersection(p,30,{px:bounds.left-2,py:bounds.top+1,x:bounds.left+1,y:bounds.top-2}),null);
    p.alertAt=50;assert.equal(bystanderIntersection(p,30,body),null);p.alertAt=0;
    p.escaped=true;assert.equal(bystanderIntersection(p,30,body),null);p.escaped=false;
    p.hitAt=25;assert.equal(bystanderIntersection(p,30,body),null);
});

test('the gait follows travelled distance, crouching blends after arrival, and falls retain the contact posture',()=>{
    const p=new HypotheticalBackdrop(true).people[1];p.velocity=.42;p.distance=9;
    assert.deepEqual(bystanderPose(p,100).left,bystanderPose(p,101).left);
    p.distance+=3;assert.notDeepEqual(bystanderPose(p,101).left,bystanderPose({...p,distance:9},101).left);
    p.velocity=0;p.stoppedAt=120;
    assert.equal(bystanderPose(p,120).crouch,0);assert.ok(bystanderPose(p,124).crouch>0&&bystanderPose(p,124).crouch<1);
    const standing=bystanderPose(p,124);p.hitAt=124;const contact=bystanderFall(p,124);
    assert.equal(contact.hipY,standing.hipY);assert.equal(contact.hipY+contact.headTop,standing.headY);
    let previous=contact;
    for(let tick=125;tick<=170;tick++){
        const pose=bystanderFall(p,tick);assert.equal(pose.crouch,contact.crouch);
        assert.ok(Math.abs(pose.hipY-previous.hipY)<1);assert.ok(Math.abs(pose.angle-previous.angle)<.1);previous=pose;
    }
    assert.deepEqual(bystanderFall(p,200),{...bystanderFall(p,400),age:76});
});

test('shots and reactions remain bounded, and replaying a cleared district reconstructs the same people',()=>{
    const a=new HypotheticalBackdrop(true);let maxShots=0,maxImpacts=0;
    for(let tick=1;tick<=SCENIC_END;tick++){
        a.update(tick);maxShots=Math.max(maxShots,a.shots.length);maxImpacts=Math.max(maxImpacts,a.impacts.length);
        if(SCENIC_STARTS.slice(1).some(start=>start===tick)){
            const restored=new HypotheticalModel('siege',9,SCENIC_STARTS.findIndex(start=>start===tick)).backdrop;
            assert.deepEqual(restored.people,a.people);assert.deepEqual(restored.blood,a.blood);assert.deepEqual(restored.breaches,a.breaches);
        }
    }
    assert.ok(maxShots<=6);assert.ok(maxImpacts<=18);
    assert.equal(a.shots.length,0);assert.equal(a.impacts.length,0);
    assert.ok(a.people.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.distance)));
    assert.ok(a.people.filter(p=>!p.fleeing).every(p=>p.startledAt!==null));
    a.cancel();assert.equal(a.shots.length,0);assert.equal(a.events.length,0);
});

test('street actors anticipate, brake before shelter, and blend their hands without a pose teleport',()=>{
    const b=new HypotheticalBackdrop(true),previous=new Map<number,{velocity:number;pose:ReturnType<typeof bystanderPose>}>();
    let braking=0;
    for(let tick=1;tick<=1800;tick++){
        b.update(tick);b.people.forEach((p,i)=>{
            const pose=bystanderPose(p,tick),old=previous.get(i);
            if(tick<=p.alertAt+6)assert.equal(p.x,p.originX,'notice the danger before moving');
            if(old&&p.hitAt===null&&!p.escaped&&p.capturedAt===undefined){
                assert.ok(Math.abs(p.velocity-old.velocity)<.11);
                for(const key of ['leftHand','rightHand'] as const)assert.ok(Math.hypot(pose[key][0]-old.pose[key][0],pose[key][1]-old.pose[key][1])<2.1);
                assert.ok(Math.abs(pose.cover-old.pose.cover)<.19);
                if(!p.fleeing&&p.velocity>0&&p.velocity<old.velocity)braking++;
            }
            if(p.stoppedAt!==null)assert.equal(p.x,p.shelter);
            previous.set(i,{velocity:p.velocity,pose});
        });
    }
    assert.ok(braking>150,'all six short runs have a real deceleration');
});

test('gunfire reactions start after the sound and overlapping shots do not reset an existing reaction',()=>{
    const b=new HypotheticalBackdrop(true);
    for(let tick=1;tick<=140;tick++){
        b.update(tick);const p=b.people[0],reaction=bystanderPose(p,tick).recoil;
        if(tick>=110&&tick<=112)assert.equal(reaction,0);
        if(tick===113)assert.ok(reaction>0&&reaction<.1);
        if(tick>=118&&tick<=126)assert.ok(reaction>.8,'the next pending sound must not erase an active response');
        assert.ok(p.reactionTimes.length<=4);assert.ok(reaction>=0&&reaction<=1);
    }
});

function pixelRecorder(){
    const pixels=new Map<string,string>();
    type PaintState={fillStyle:string;globalAlpha:number;globalCompositeOperation:GlobalCompositeOperation};
    const stack:PaintState[]=[];
    // Record occupied pixels; shadows still need the Canvas paint-state stack.
    const context:PaintState & Pick<CanvasRenderingContext2D,'save'|'restore'|'fillRect'>={
        fillStyle:'#000000',globalAlpha:1,globalCompositeOperation:'source-over',
        save(){stack.push({fillStyle:this.fillStyle,globalAlpha:this.globalAlpha,globalCompositeOperation:this.globalCompositeOperation});},
        restore(){const state=stack.pop();if(state)Object.assign(this,state);},
        fillRect(x,y,w,h){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)pixels.set(`${xx},${yy}`,this.fillStyle);}
    };
    return {pixels,c:context as unknown as CanvasRenderingContext2D};
}

test('rotating an opaque cloth patch never leaves holes between adjacent source pixels',()=>{
    const texture=bystanderTexture(-4,-9,8,9,paint=>paint(-4,-9,8,9,'#b55350'));
    for(const angle of [0,.15,.4,Math.PI/4,1.1,Math.PI/2]){
        const {c,pixels}=pixelRecorder();drawBystanderTexture(c,texture,20,20,angle);
        assert.ok(pixels.size>60);
        const rows=new Map<number,number[]>();
        for(const key of pixels.keys()){const [x,y]=key.split(',').map(Number);rows.set(y,[...(rows.get(y)??[]),x]);}
        for(const xs of rows.values())assert.equal(xs.length,Math.max(...xs)-Math.min(...xs)+1);
        if(angle===0)assert.equal(pixels.size,72);
    }
});

test('the rendered fall keeps heads, hands, bags and hats above the street through every intermediate pose',()=>{
    for(const index of [0,1,3,4])for(const crouched of [false,true]){
        const b=new HypotheticalBackdrop(true),p=b.people[index];b.people.splice(0,b.people.length,p);
        p.x=30;p.hitAt=100;p.stoppedAt=crouched?80:null;
        for(let age=0;age<=55;age++){
            b.tick=100+age;const {c,pixels}=pixelRecorder();drawBystanders(c,b,60,true);
            assert.equal(c.globalAlpha,1,'the shadow restores opacity before drawing the actor');
            assert.equal(c.globalCompositeOperation,'source-over','the shadow restores normal painting');
            assert.ok(pixels.size>0,'the fall must draw pixels');
            const ys=[...pixels.keys()].map(key=>Number(key.split(',')[1]));
            assert.ok(Math.max(...ys)<=60,`${p.clothes} sinks below its floor at ${age}`);
        }
    }
});
