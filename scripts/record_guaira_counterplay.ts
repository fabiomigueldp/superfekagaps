/** Author attacks on real course supports, starting at ordinary checkpoints.
 * Only input events advance the encounter; contact instrumentation is read-only. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {guairaBrowser} from '../tests/helpers/guairaLabHarness';
import {GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {GuairaAscent} from '../src/adventure/experimental/guaira/GuairaAscent';
import {GuairaRespiros} from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import {GuairaRelief} from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import {GUAIRA_COURSES} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {dockControls} from '../tests/helpers/guairaDockController';

const output=process.argv[2];assert.ok(output,'OUTPUT JSON required');
const plans={
    'helmet-stomps':{id:'travessia',Scene:GuairaTraversal,cp:608,foe:':helmet:496'},
    'charger-counter':{id:'subida',Scene:GuairaAscent,cp:1760,foe:':charger:1968'},
    'agitator-counter':{id:'respiros',Scene:GuairaRespiros,cp:1312,foe:':maintenance:guard'},
    'rail-window':{id:'alivio',Scene:GuairaRelief,cp:1120,foe:':maintenance:guard'},
    'rail-pounds':{id:'alivio',Scene:GuairaRelief,cp:1120,foe:':maintenance:guard'}
} as const;
const results:Record<string,unknown>={};
for(const [name,plan]of Object.entries(plans)){
    if(process.argv[3]&&name!==process.argv[3])continue;
    const clean:Array<()=>void>=[],h=guairaBrowser({after:f=>clean.push(f as ()=>void)});
    for(const t of [h.window,h.document,h.canvas])Object.assign(t,{removeEventListener(){}});
    const g=new plan.Scene(h.canvas as unknown as HTMLCanvasElement,h.status as unknown as HTMLElement),c=GUAIRA_COURSES[plan.id];
    const checkpoint=g.stage.checkpoints.findIndex(p=>p.x*16===c.start+plan.cp);assert.ok(checkpoint>=0);
    g.store.save.checkpoint={stage:g.stage.id,index:checkpoint,helmet:true};g.load(g.stage.id,true);
    const e=g.foes.find(e=>e.spec.id.endsWith(plan.foe))!;assert.ok(e);
    let frame=0,held=new Set<string>();const runs:Array<[number,string[]]>=[],damage:number[]=[],events:unknown[]=[],marks:Record<string,number>={};
    const contacts:Array<{frame:number;result:string;phase:string;timer:number;pound:boolean;x:number;y:number}>=[];
    const contact=e.contact.bind(e);e.contact=(p,previous,falling,pound)=>{
        const phase=e.phase,timer=e.timer,result=contact(p,previous,falling,pound);
        if(result!=='none'&&result!=='hurt'){const entry={frame:frame+1,result,phase,timer,pound,x:e.x,y:e.y};contacts.push(entry);console.log(name,'contact',JSON.stringify(entry));}
        return result;
    };
    const step=(keys:string[])=>{
        const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});
        for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});held=next;
        const armor=g.player.data.hasHelmet,phase=e.phase;g.update(1000/60);frame++;
        if(armor&&!g.player.data.hasHelmet){damage.push(frame);console.log(name,'hurt',JSON.stringify({frame,p:g.player.data.position,e:{x:e.x,phase:e.phase}}));}
        if(phase!==e.phase)events.push({frame,phase:e.phase});
        const last=runs.at(-1);if(last&&last[1].join(',')===keys.join(','))last[0]++;else runs.push([1,[...keys]]);
        assert.equal(g.player.data.isDead,false,`${name}: death at ${frame}`);
    };
    const {brake,land}=dockControls(g,step);
    const wait=(check:()=>boolean,limit=500)=>{for(let n=0;n<limit&&!check();n++)step([]);assert.ok(check(),`${name}: wait at ${frame}, phase ${e.phase}/${e.timer}`);};
    const walk=(local:number)=>{for(let n=0;n<240&&Math.abs(g.player.data.position.x-(c.start+local))>4;n++)step([g.player.data.position.x<c.start+local?'ArrowRight':'ArrowLeft']);brake();};
    const aim=()=>{const p=g.player.data,dx=e.x+e.width/2-p.position.x-p.width/2,v=p.velocity.x;
        return dx>3?v>0&&dx<v*v/.6*.65?['ArrowLeft']:['ArrowRight']:dx< -3?v<0&&-dx<v*v/.6*.65?['ArrowRight']:['ArrowLeft']:[];};
    const stomp=(hold:number,stopAfterContact=false)=>{
        const count=contacts.length;step([]);step([...aim(),'Space']);
        for(let n=1;n<150&&!e.dead;n++){
            let keys=aim();if(n<hold)keys.push('Space');step(keys);
            if(stopAfterContact&&contacts.length>count)return;
            if(g.player.data.isGrounded&&n>10)break;
        }
    };
    // One neutral input frame lets a newly attached standard controller arm
    // after checkpoint loading. It is part of the tape and advances all clocks.
    step([]);
    if(name==='helmet-stomps'){
        walk(512);marks.approach=frame;stomp(7,true);assert.equal(e.armor,false,JSON.stringify({p:g.player.data.position,e:{x:e.x,y:e.y},frame}));
        marks.broken=frame;for(let n=0;n<150&&!e.dead;n++)step(aim());assert.ok(e.dead);
    }else if(name==='charger-counter'){
        walk(1836);wait(()=>e.phase==='warning'&&e.timer>=700);marks.warning=frame;
        for(let n=0;n<18;n++)step(['Space']);
        wait(()=>g.player.data.isGrounded&&e.phase==='rest',150);marks.recovery=frame;
        // The dodge lands on the authored porter's ledge. Step off its left
        // edge and fall onto the exposed forehead during recovery.
        for(let n=0;n<80&&g.player.data.isGrounded&&!e.dead;n++)step(['ArrowLeft']);
        marks.descent=frame;for(let n=0;n<100&&!e.dead;n++)step(aim());
        assert.ok(e.dead,JSON.stringify({p:g.player.data.position,e:{x:e.x,y:e.y,phase:e.phase,timer:e.timer},frame}));
    }else{
        if(plan.id==='respiros'){
            assert.ok(land(c.start+1384,256));assert.ok(land(c.start+1480,192));assert.ok(land(c.start+1588,160));
            marks.approach=frame;wait(()=>e.phase==='attack');marks.attack=frame;wait(()=>e.phase==='rest'&&e.timer<100);
            marks.open=frame;stomp(5);assert.ok(e.dead);
        }else{
            assert.ok(land(c.start+1112,240));assert.ok(land(c.start+1204,208));marks.approach=frame;
            wait(()=>e.phase==='warning'&&e.x<e.homeX&&e.timer<60);marks.open=frame;
            if(name==='rail-window'){stomp(4);assert.ok(e.dead,'ordinary stomp fits the brake opening');}
            else{
                wait(()=>e.phase==='walk'&&e.vx>0&&e.timer<60);marks.closed=frame;
                stomp(4,true);assert.equal(e.dead,false);assert.equal(contacts.at(-1)?.result,'bounce');marks.blocked=frame;
                for(let n=0;n<150&&!e.dead;n++){
                    const p=g.player.data,keys=aim();if(p.position.y+p.height<e.y&&Math.abs(e.x+e.width/2-p.position.x-p.width/2)<18)keys.push('ArrowDown');step(keys);
                }assert.ok(e.dead);
            }
        }
    }
    marks.defeated=frame;for(let n=0;n<60;n++)step([]);assert.deepEqual(damage,[],`${name}: counterplay must not spend a helmet`);
    results[name]={stage:g.stage.id,course:plan.id,checkpoint,foeId:plan.foe,frames:frame,runs,damage,contacts,marks,events};
    console.log(name,JSON.stringify({frames:frame,marks,contacts,damage}));g.dispose();for(const f of clean.reverse())f();
}
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(results,null,2)+'\n');
