import assert from 'node:assert/strict';
import test from 'node:test';
import { jetCycle } from '../src/adventure/WorldMachineState';
import { GUAIRA_RELIEF as G } from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import { guairaReliefBrowser } from './helpers/guairaReliefHarness';
import tapes from './helpers/guairaReliefRoutesReplays.json';

type Harness=ReturnType<typeof guairaReliefBrowser>;
type Game=ReturnType<Harness['create']>;
type Run=[number,string[]];
const dt=1000/60,feet=(g:Game)=>g.player.data.position.y+g.player.data.height;
function play(h:Harness,g:Game,runs:Run[],limit=Infinity,observe=(_frame:number)=>{}) {
    let frame=0;
    for(const[count,keys]of runs){h.keys(keys);for(let i=0;i<count&&frame<limit;i++){g.update(dt);observe(++frame);}if(frame>=limit)break;}
    return frame;
}
function visible(g:Game,x:number,y:number,width=1) {
    assert.ok(x-g.camera.x>=0&&x+width-g.camera.x<=320,`horizontal preview ${x}`);
    assert.ok(y-g.camera.y>=24&&y-g.camera.y<=176,`vertical preview ${y}`);
}
function safe(g:Game) { assert.equal(g.player.data.isDead,false);assert.equal(g.player.data.hasHelmet,true); }
function gantry(h:Harness,g:Game,opened=false) {
    h.keys([]);g.load(G.id);play(h,g,tapes[opened?'opened':'high'].runs as Run[],opened?396:309);
    assert.equal(feet(g),G.gantryY);assert.equal(g.reliefOpened,opened);
}

for(const route of ['high','opened'] as const)for(const touch of [false,true])for(const reducedMotion of [false,true])
test(`relief ${route}: full native route, touch=${touch}, reduced=${reducedMotion}`,t=>{
    const h=guairaReliefBrowser(t,{touch,reducedMotion}),g=h.create();
    let previousX=g.camera.x,previousY=g.camera.y;const contacts=new Set<number>();
    const count=play(h,g,tapes[route].runs as Run[],Infinity,frame=>{
        const p=g.player.data;safe(g);
        assert.ok(p.position.y-10-g.camera.y>=26-.001,'entire helmet below the shared HUD');
        assert.ok(feet(g)-g.camera.y<=168.001,'feet visible');
        assert.ok(Math.abs(g.camera.y-previousY)<=7.001&&Math.abs(g.camera.x-previousX)<=6.5,'continuous camera');
        previousY=g.camera.y;previousX=g.camera.x;
        if(p.isGrounded)contacts.add(feet(g));
        if(frame===171){visible(g,G.lidStart,G.lidY,48);visible(g,240,138);g.render();assert.match(h.status.textContent,/tampa está acima/);}
        if(frame===227){visible(g,G.gantryStart,G.gantryY,64);visible(g,344,G.gantryY-22);}
        if(frame===(route==='high'?409:396)){
            visible(g,G.landingStart,G.landingY,80);visible(g,552,G.landingY-22);g.render();assert.match(h.status.textContent,/corra até a borda/);
        }
        if(frame===(route==='high'?488:476)){
            visible(g,G.returnStart,G.returnY,48);g.render();assert.match(h.status.textContent,/patamar abaixo à direita/);
        }
        if(route==='high'&&frame>=228&&frame<=279)visible(g,G.gantryStart,G.gantryY,64);
        if(frame>=(route==='high'?422:405)&&frame<=(route==='high'?473:456))visible(g,G.landingStart,G.landingY,80);
        if(frame===(route==='high'?548:536)){visible(g,G.returnEnd+16,G.floor,16);assert.equal(feet(g),G.returnY);}
    });
    assert.equal(count,tapes[route].frames);assert.equal(g.finished,true);assert.equal(g.coins,5);
    assert.equal(g.reliefOpened,route==='opened');assert.equal(g.objects.get(G.jetId)!.active,route==='opened');
    for(const y of [288,224,160,G.gantryY,G.landingY,G.returnY,G.floor])assert.ok(contacts.has(y),`native support ${y}`);
    const state=()=>JSON.stringify({p:g.player.data,o:g.objects,camera:g.camera,tiles:g.level.data.tiles,coins:g.coins,t:g.time});
    const before=state();g.render();g.render();assert.equal(state(),before);
    assert.deepEqual(h.storageCalls,[]);assert.deepEqual(g.store.save.completed,[]);
});

test('the intact-lid running jump clears live water at all 252 native departure phases',t=>{
    const h=guairaReliefBrowser(t),g=h.create();let dangerSeen=false;
    for(let phase=0;phase<252;phase++){
        gantry(h,g);h.run(g,phase);h.run(g,12,['ArrowRight','ShiftLeft']);h.keys(['ArrowRight','ShiftLeft','Space']);
        for(let i=0;i<52;i++){g.update(dt);safe(g);visible(g,G.landingStart,G.landingY,80);dangerSeen ||= !!jetCycle(g.objects.get(G.jetId)!,g.objects.time).danger;}
        h.run(g,20);safe(g);assert.equal(feet(g),G.landingY);assert.equal(g.coins,5);assert.equal(g.reliefOpened,false);
        assert.equal(g.objects.get(G.jetId)!.active,false,'jump never changes hydraulic authority');
    }
    assert.equal(dangerSeen,true);
});

test('the raised takeoff tolerates eight run-up lengths, held and released jumps during live discharge',t=>{
    const h=guairaReliefBrowser(t),g=h.create();
    for(const hold of [20,24,52])for(let runup=11;runup<=18;runup++){
        gantry(h,g);h.run(g,64);h.run(g,runup,['ArrowRight','ShiftLeft']);
        h.run(g,hold,['ArrowRight','ShiftLeft','Space']);h.run(g,52-hold,['ArrowRight','ShiftLeft']);h.run(g,20);
        safe(g);assert.equal(feet(g),G.landingY);assert.equal(g.coins,5);
    }
});

for(const hold of [1,3,6,12])test(`opening the relief makes a ${hold}-frame short jump recoverable on the native floor`,t=>{
    const h=guairaReliefBrowser(t),g=h.create();gantry(h,g,true);
    h.run(g,8,['ArrowRight','ShiftLeft']);h.run(g,hold,['ArrowRight','ShiftLeft','Space']);
    h.keys(['ArrowRight','ShiftLeft']);for(let n=0;n<52-hold;n++){g.update(dt);safe(g);assert.equal(g.objects.jetDanger(g.objects.get(G.jetId)!),null);}
    h.run(g,20);safe(g);assert.ok(feet(g)===G.floor||feet(g)===G.landingY);
    h.run(g,90,['ArrowRight']);safe(g);assert.equal(g.finished,true);assert.equal(g.reliefOpened,true);
});

test('the gantry remains reversible, pause freezes and checkpoint reconstruction restores pressure',t=>{
    const h=guairaReliefBrowser(t),g=h.create();gantry(h,g);
    h.run(g,45,['ArrowLeft','Space']);h.run(g,30);safe(g);assert.equal(feet(g),G.lidY);assert.equal(g.reliefOpened,false);
    gantry(h,g,true);h.run(g,90);const state=()=>JSON.stringify({p:g.player.data,o:g.objects,camera:g.camera,t:g.time});
    g.toggleReliefPause();const before=state();h.run(g,120);g.render();assert.equal(state(),before);g.toggleReliefPause();
    const old=g.player,coins=g.coins;old.die('fall'); // Recovery fixture; all access above used native input.
    for(let n=0;n<180&&g.player===old;n++)g.update(dt);
    assert.notEqual(g.player,old);assert.equal(g.player.data.position.x,G.checkpointX);assert.equal(feet(g),G.floor);
    assert.equal(g.reliefOpened,false);assert.equal(g.objects.get(G.jetId)!.active,false);assert.equal(g.coins,coins);
    h.keys([]);g.load(G.id);assert.equal(g.coins,0);assert.equal(g.store.save.checkpoint,null);
});
