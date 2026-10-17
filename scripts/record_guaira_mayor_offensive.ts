/** Record ordinary keyboard inputs against the native encounter. No position,
 * clock, health, valve or boss-state writes are permitted in this controller. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { guairaMayorBrowser } from '../tests/helpers/guairaMayorHarness';
import { MAYOR_ARENA as A, MAYOR_RULES as R } from '../src/adventure/experimental/guaira/GuairaMayorModel';

const mode=process.env.GUAIRA_MAYOR_ROUTE??'upper';
assert.ok(['upper','ground','wait','retry','interrupt','failure'].includes(mode),'known native route');
const output=process.env.GUAIRA_MAYOR_OUTPUT??'output/guaira/mayor-offensive-2026-10-17';
const plans=JSON.parse(readFileSync(new URL('./guaira_mayor_route_plans.json',import.meta.url),'utf8')) as Record<string,{runs:Array<[number,string[]]>}>;
mkdirSync(output,{recursive:true});
const cleanup:Array<()=>void>=[],h=guairaMayorBrowser({after:f=>cleanup.push(f as ()=>void)});
for(const o of [h.window,h.document,h.canvas])Object.assign(o,{removeEventListener(){}});
const g=h.create();
const runs:Array<[number,string[]]>=[],notes:any[]=[],events:any[]=[];
const hitFrames:number[]=[],warningFrames:number[]=[],seamWarningFrames:number[]=[],seamActiveFrames:number[]=[],salvoWarningFrames:number[]=[];
const damageFrames:number[]=[];let deathFrame:number|undefined;
let frame=0,lastState='',lastPulse:string|undefined,seals=3;
const feet=()=>g.player.data.position.y+g.player.data.height;
const center=()=>g.player.data.position.x+g.player.data.width/2;
const record=(label:string)=>notes.push({label,frame,player:{x:center(),feet:feet()},state:g.mayor.state,tick:g.mayor.stateTick});
function step(n:number,keys:string[]=[]){
    h.keys(keys);
    const last=runs.at(-1);
    if(last&&JSON.stringify(last[1])===JSON.stringify(keys))last[0]+=n;else runs.push([n,[...keys]]);
    for(let i=0;i<n;i++){
        const helmet=g.player.data.hasHelmet,beforeTick=g.mayor.tick;g.update(R.tickMs);frame++;
        const m=g.mayor,p=g.player.data;
        if(helmet&&!p.hasHelmet)damageFrames.push(frame);
        if(p.isDead&&deathFrame===undefined)deathFrame=frame;
        if(m.tick!==beforeTick)for(const e of m.events)events.push({frame,tick:e.tick,kind:e.kind,seals:m.sealsRemaining,pass:m.rush?.pass,player:{x:center(),feet:feet()},boss:{x:m.x,y:m.y}});
        if(m.sealsRemaining<seals){hitFrames.push(frame);seals=m.sealsRemaining;}
        if(m.events.some(e=>e.kind==='warning'||e.kind==='jetWarning'||e.kind==='rushWarning'))warningFrames.push(frame);
        if(m.events.some(e=>e.kind==='jetWarning'))salvoWarningFrames.push(frame);
        const pulse=m.counterpressure?.phase;
        if(pulse!==lastPulse&&pulse){(pulse==='warning'?seamWarningFrames:seamActiveFrames).push(frame);if(pulse==='warning')warningFrames.push(frame);}
        lastPulse=pulse;
        const state=m.state+':'+m.strike+':'+(m.rush?.pass??'');
        if(state!==lastState){record(state);lastState=state;}
        if(mode!=='failure'&&(p.isDead||!p.hasHelmet))throw Error(JSON.stringify({frame,mode,player:p.position,feet:feet(),boss:{x:m.x,y:m.y},state:m.state,at:m.stateTick,target:m.stampTarget,rush:m.rush,keys,notes:notes.slice(-4)}));
        assert.ok(frame<10000,'controller must finish');
    }
}
function until(predicate:()=>boolean,keys:string[]=[],budget=600){
    for(let i=0;i<budget&&!predicate();i++)step(1,keys);
    assert.ok(predicate(),JSON.stringify({frame,state:g.mayor.state,x:center(),feet:feet(),notes:notes.slice(-4)}));
}
function walk(x:number){until(()=>Math.abs(center()-x)<=2, [center()>x?'ArrowLeft':'ArrowRight'],180);step(5);}
function prefix(file:string,end:number){
    const tape=plans[file];
    for(const [n,keys]of tape.runs){step(Math.min(n,end-frame),keys);if(frame===end)break;}
}
function pursuit(){
    record('prepare-pursuit');
    let jumpHeld=0,previousPass=0;
    until(()=>g.mayor.state==='rushWarning');
    while(g.mayor.state!=='warning'){
        const m=g.mayor,rush=m.rush!;
        if(rush.pass!==previousPass){previousPass=rush.pass;jumpHeld=0;}
        if(jumpHeld>0){step(1,['Space']);jumpHeld--;continue;}
        const upper=feet()<=A.deckY+.1;
        if(g.player.data.isGrounded&&(upper&&m.crossfire&&m.stateTick>=16
            ||!upper&&rush.phase==='active'&&Math.abs(m.x+m.width/2-center())<78)){
            record('jump-rush-'+rush.pass);step(1,['Space']);jumpHeld=17;
        }else step(1);
    }
    record('pursuit-to-stamp');
}
try{
    if(mode==='interrupt'){
        prefix('guairaMayorInterruptReplay',571);
        pursuit();walk(302);until(()=>g.mayor.state==='returning');
        walk(246);step(8,['Space']);step(24,['ArrowDown']);until(()=>g.mayor.vulnerable);
        step(18,['ArrowRight','Space']);
        until(()=>g.mayor.sealsRemaining===1,['Space']);
        record('upper-counterattack');
        walk(93);
        until(()=>g.mayor.state==='jetWarning'&&g.mayor.stateTick>=30);
        step(8,['Space']);step(24,['ArrowDown']);
        assert.equal(g.mayor.pressureInterrupted,true);record('lower-interrupt');
        pursuit();walk(180);until(()=>g.mayor.state==='warning'&&g.mayor.strike===2);
        walk(93);until(()=>g.mayor.state==='stamp');
        step(8,['Space']);step(24,['ArrowDown']);
        step(40,['ArrowRight','Space']);step(35);step(38,['ArrowRight','Space']);step(30);
        step(10,['ArrowRight','Space']);step(35,['Space']);step(25);
        step(130,['ArrowLeft']);step(30);
    }else{
    const source=mode==='ground'?'guairaMayorGroundReplay':mode==='wait'?'guairaMayorJumpPulseReplay':mode==='retry'?'guairaMayorRetryReplay':'guairaMayorReplay';
    const tape=plans[source];
    let virtualFrame=0;
    for(const [n,keys]of tape.runs){
        for(let i=0;i<n;i++){
            if(mode==='failure'&&virtualFrame===817)break;
            if(g.mayor.state==='vault')pursuit();
            step(1,keys);virtualFrame++;
        }
    }
    if(mode==='failure')until(()=>g.player.data.isDead,[],1600);
    }
    if(mode==='failure'){assert.equal(g.player.data.isDead,true);assert.equal(g.mayor.sealsRemaining,2);}
    else assert.equal(g.mayor.publicWaterOpen,true);
    console.log(JSON.stringify({mode,frame,hitFrames,seamWarningFrames,seamActiveFrames,complete:g.mayor.publicWaterOpen}));
}finally{
    writeFileSync(output+'/draft-'+mode+'.json',JSON.stringify({stepMs:R.tickMs,frames:frame,runs,hitFrames,warningFrames,seamWarningFrames,seamActiveFrames,salvoWarningFrames,damageFrames,deathFrame,notes,events},null,2)+'\n');
    g.dispose();for(const f of cleanup.reverse())f();
}
