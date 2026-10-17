import assert from 'node:assert/strict';
import test from 'node:test';
import {GUAIRA_EXPLORATION_ROUTES,mergeGuairaExploration,sampleGuairaExploration} from '../src/adventure/experimental/guaira/GuairaCourseExploration';
import {freshGuairaChapterProgress,guairaChapterRoute,sanitizeGuairaChapterProgress} from '../src/adventure/experimental/guaira/chapter/GuairaChapterProgress';
import {ProgressStore,freshSave,SAVE_KEY,isUnlocked} from '../src/adventure/progress';
import {chapterExcursionBrowser,flushChapter} from './helpers/chapterExcursionHarness';
import type {GuairaChapterSceneId} from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';
import type {GuairaCourseId} from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import tapes from './helpers/guairaExplorationReplays.json';
import maintenance from './helpers/guairaMaintenanceReplays.json';
import {replayPrefix} from './helpers/guairaCourseTest';

test('saved exploration accepts only unique real coin indices from completed visits',()=>{
    const raw={...freshGuairaChapterProgress(),completed:['guaira-travessia'],optional:{gallery:true,relief:false},
        exploration:{'travessia:detour':[2,0,2,1,-1,3,Infinity,'1'], 'galeria:detour':[0,3],
            'respiros:maintenance':[0], 'alivio:detour':[1], 'patio:detour':[0], fake:[0]}};
    const clean=sanitizeGuairaChapterProgress(raw);
    assert.deepEqual(clean.exploration,{'travessia:detour':[0,1,2],'galeria:detour':[0,3]});
    assert.deepEqual(sanitizeGuairaChapterProgress({...raw,alternateCompleted:true}).exploration,
        {...clean.exploration,'patio:detour':[0]});
    assert.equal(sanitizeGuairaChapterProgress({...freshGuairaChapterProgress(),exploration:raw.exploration},true).exploration,undefined,'development access is not exploration');
    assert.deepEqual(mergeGuairaExploration({'travessia:detour':[0,2]},{'travessia:detour':[1,2]}),{'travessia:detour':[0,1,2]});
});

test('distinct discoveries merge across tabs and survive poorer replays without changing campaign locks',()=>{
    let raw=JSON.stringify(freshSave());const storage={getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;}};
    const a=new ProgressStore(storage,false),b=new ProgressStore(storage,false);
    const progress={...freshGuairaChapterProgress(),completed:['guaira-travessia' as const]};
    a.updateGuaira({...progress,exploration:{'travessia:detour':[0]}});
    b.updateGuaira({...progress,exploration:{'travessia:detour':[2]}});
    a.updateGuaira(progress);
    const restored=new ProgressStore(storage,false).save;
    assert.deepEqual(restored.guaira.exploration,{'travessia:detour':[0,2]});
    assert.equal(isUnlocked('4-1',restored),false);assert.deepEqual(restored.guaira.completed,['guaira-travessia']);
    assert.deepEqual(restored.times,{},'discovery does not manufacture campaign records');
});

const entries:Record<GuairaCourseId,GuairaChapterSceneId|'gallery'|'relief'>={travessia:'guaira-travessia',patio:'guaira-patio-comportas',respiros:'guaira-respiros',subida:'guaira-subida',galeria:'gallery',alivio:'relief'};
for(const [course,tape,kind]of [
    ...Object.entries(tapes).map(([id,tape])=>[id,tape,'detour'] as const),
    ...Object.entries(maintenance).map(([id,tape])=>[id,tape,'maintenance'] as const),
] as Array<[GuairaCourseId,typeof tapes.travessia,'detour'|'maintenance']>)
test(`${course}/${kind}: native collection completes, records while paused, survives reload and appears in Jornada`,async t=>{
    const h=chapterExcursionBrowser(t),seed=freshSave(),entry=entries[course];
    const route=guairaChapterRoute(seed.guaira.opening),index=route.indexOf(entry as GuairaChapterSceneId);
    if(index>0)seed.guaira.completed=route.slice(0,index);
    let raw=JSON.stringify(seed);const storage={getItem:(key:string)=>key===SAVE_KEY?raw:null,setItem:(_key:string,v:string)=>{raw=v;}};
    const store=new ProgressStore(storage,false),app=h.create({initialScene:entry,progressStore:store});await flushChapter();
    const g=app.activeGame!;assert.ok(g);assert.equal(sampleGuairaExploration(g),undefined);
    h.play(g,{runs:tape.runs as Array<[number,string[]]>},course==='galeria'||course==='alivio');
    const routeInfo=GUAIRA_EXPLORATION_ROUTES.find(r=>r.course===course&&r.id.endsWith(':'+kind))!;
    const expected=Array.from({length:routeInfo.total},(_,i)=>i);
    assert.deepEqual(sampleGuairaExploration(g)?.[routeInfo.id],expected);
    h.key('keydown','Escape');g.update(1000/60);h.key('keyup','Escape');assert.equal(g.state,'paused');h.frames();
    assert.deepEqual(store.save.guaira.exploration?.[routeInfo.id],expected);
    h.byId('chapter-map-return').click();await flushChapter();
    for(let n=0;n<5;n++){h.frames();await flushChapter();}
    assert.equal(app.mode,'map');
    h.button('Ver a jornada de Guaíra').click();
    assert.ok(h.all().some(node=>node.textContent.includes(routeInfo.route.name+' · '+routeInfo.total+'/'+routeInfo.total+' moedas · explorado')),'real map shows the earned route');
    app.dispose();
    const restored=new ProgressStore(storage,false);
    assert.deepEqual(restored.save.guaira.exploration?.[routeInfo.id],expected);
    assert.equal(isUnlocked('4-1',restored.save),false);
    const reload=h.create({progressStore:restored});await flushChapter();
    assert.deepEqual(restored.save.guaira.exploration?.[routeInfo.id],expected);
    reload.dispose();h.checkDisposed();
});

test('collecting and abandoning a live detour never records a finished visit; later retries start fresh',async t=>{
    const h=chapterExcursionBrowser(t),store=new ProgressStore(null,false),app=h.create({initialScene:'guaira-travessia',progressStore:store});await flushChapter();
    const g=app.activeGame!;
    h.play(g,{runs:replayPrefix(tapes.travessia.runs as Array<[number,string[]]>,tapes.travessia.notes[2].frame)});h.frames();
    assert.deepEqual(sampleGuairaExploration(g),{'travessia:detour':[0,1,2]});
    h.byId('chapter-map-return').click();await flushChapter();
    assert.equal(store.save.guaira.exploration,undefined);assert.deepEqual(app.snapshot.accepted,[]);
    app.dispose();h.checkDisposed();
});
