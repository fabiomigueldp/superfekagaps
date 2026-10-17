/** Author input-only encounters from ordinary earned checkpoint locations. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {guairaBrowser} from '../tests/helpers/guairaLabHarness';
import {GuairaTraversal} from '../src/adventure/experimental/guaira/GuairaTraversal';
import {GUAIRA_COURSES} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import {dockControls} from '../tests/helpers/guairaDockController';

const output=process.argv[2];assert.ok(output,'OUTPUT JSON required');
const results:Record<string,unknown>={};
for(const name of ['pincer-counter','pincer-hit','loader-counter','loader-hit']){
    const cleanup:Array<()=>void>=[],h=guairaBrowser({after:f=>cleanup.push(f as ()=>void)});
    for(const t of [h.window,h.document,h.canvas])Object.assign(t,{removeEventListener(){}});
    const g=new GuairaTraversal(h.canvas as unknown as HTMLCanvasElement,h.status as unknown as HTMLElement),c=GUAIRA_COURSES.travessia;
    const loader=name.startsWith('loader'),foeId=loader?':loader:2048':':minion:192';
    const checkpoint=g.stage.checkpoints.findIndex(p=>p.x*16===c.start+(loader?1824:32));assert.ok(checkpoint>=0);
    g.store.save.checkpoint={stage:g.stage.id,index:checkpoint,helmet:true};g.load(g.stage.id,true);
    const e=g.foes.find(e=>e.spec.id.endsWith(foeId))!;assert.ok(e);
    let held=new Set<string>(),frames=0;const runs:Array<[number,string[]]>=[],damage:number[]=[],events:unknown[]=[];
    const step=(keys:readonly string[])=>{
        const next=new Set(keys);for(const k of held)if(!next.has(k))h.window.dispatch('keyup',{code:k,target:h.canvas});
        for(const k of next)if(!held.has(k))h.window.dispatch('keydown',{code:k,target:h.canvas});held=next;
        const helmet=g.player.data.hasHelmet,phase=e.phase;g.update(1000/60);frames++;
        if(helmet&&!g.player.data.hasHelmet){damage.push(frames);console.log('contact',JSON.stringify({name,frames,p:g.player.data.position,foe:{x:e.x,y:e.y,phase:e.phase,t:e.timer,danger:e.danger},keys}));}
        if(e.phase!==phase)events.push({frame:frames,phase:e.phase,high:e.highThrow,x:e.x,player:{...g.player.data.position}});
        const last=runs.at(-1);if(last&&last[1].join(',')===keys.join(','))last[0]++;else runs.push([1,[...keys]]);
        assert.equal(g.player.data.isDead,false,'encounter authoring death at '+frames);
    };
    const {brake,land}=dockControls(g,step);
    const walk=(target:number)=>{for(let n=0;n<180&&g.player.data.position.x<target;n++)step(['ArrowRight']);brake();};
    if(!loader){
        walk(c.start+120);
        for(let n=0;n<180&&e.phase!=='warning';n++)step([]);
        assert.equal(e.phase,'warning');
        if(name.endsWith('counter')){
            for(let n=0;n<40&&e.phase==='warning'&&e.timer<300;n++)step([]);
            assert.ok(land(c.start+224,c.floor,undefined,18));assert.deepEqual(damage,[]);
        }else{for(let n=0;n<8;n++)step(['ArrowRight']);for(let n=0;n<80&&!damage.length;n++)step([]);assert.ok(damage.length>0);}
    }else{
        walk(c.start+1896);assert.ok(land(c.start+1980,c.floor-48,undefined,18));
        for(let n=0;n<500&&!(e.phase==='warning'&&e.highThrow);n++)step([]);
        assert.ok(e.phase==='warning'&&e.highThrow);assert.deepEqual(damage,[],'the low throw travels below the deck');
        if(name.endsWith('counter')){
            while(e.phase==='warning'&&e.timer<780)step([]);
            for(let n=0;n<7;n++)step(['Space']);for(let n=0;n<48;n++)step([]);
            assert.deepEqual(damage,[],'jumping over the committed high throw is safe');
            assert.ok(land(e.x+e.width/2,c.floor,foeId,7));assert.ok(e.dead);assert.deepEqual(damage,[]);
        }else{for(let n=0;n<140&&!damage.length;n++)step([]);assert.ok(damage.length>0,'the higher throw reaches an ignored upper approach');}
    }
    for(let n=0;n<24;n++)step([]);
    results[name]={stage:g.stage.id,checkpoint,foeId,frames,runs,damage,killed:e.dead,events};
    console.log(name,JSON.stringify({frames,damage,killed:e.dead,events}));g.dispose();for(const f of cleanup.reverse())f();
}
mkdirSync('output/guaira/enemies-2026-10-17',{recursive:true});writeFileSync(output,JSON.stringify(results,null,2));
