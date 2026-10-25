import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

/** Real Input, preferences and encounter listener; rendering/audio and the
 * base scene/load are boundaries. Full encounter coverage runs in Chromium. */
function fixture() {
    const window=new EventTarget();
    class Element extends EventTarget {
        id='';style={cssText:''};textContent='';editing=false;dialog=false;
        setAttribute(){} remove(){}
        closest(selector:string){
            return this.editing&&selector.includes('contenteditable')||this.dialog&&selector.includes('dialog[open]')?this:null;
        }
    }
    const canvas=new Element();canvas.id='game-canvas';
    const document=Object.assign(new EventTarget(),{hidden:false,title:'',body:{append(){}},
        createElement:()=>new Element(),getElementById:()=>canvas});
    const globals={window,document,HTMLElement:Element,Event,EventTarget,structuredClone,console};
    function module<T>(path:string,dependencies:Record<string,unknown>):T {
        const exports={};
        const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{
            compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
        }).outputText;
        runInNewContext(code,{...globals,exports,require:(name:string)=>{
            assert.ok(name in dependencies,`Unexpected dependency: ${name}`);return dependencies[name];
        }},{filename:path});
        return exports as T;
    }
    const preferences=module<typeof import('../src/engine/ControlPreferences')>('../src/engine/ControlPreferences.ts',{});
    const scope=module<typeof import('../src/engine/DisposalScope')>('../src/engine/DisposalScope.ts',{});
    const movement=module<typeof import('../src/engine/KeyboardMovement')>('../src/engine/KeyboardMovement.ts',{'./ControlPreferences':preferences});
    const {Input}=module<typeof import('../src/engine/Input')>('../src/engine/Input.ts',{
        './ControlPreferences':preferences,'./DisposalScope':scope,'./KeyboardMovement':movement,
        './TouchMode':{touchControlsEnabled:()=>false},
    });
    const cleanups:Array<()=>void>=[];
    class Base {
        input=new Input();isDisposed=false;state='playing';stage={id:'hipotetico-chase'};
        art={};tutorial={observe(){}};audio={unlock(){}};renderer={reducedMotion:false};
        player={data:{isDead:false,hasHelmet:true,position:{x:96,y:200}}};
        addCleanup(fn:()=>void){cleanups.push(fn);}
        listen(target:EventTarget,name:string,listener:EventListener){
            target.addEventListener(name,listener);this.addCleanup(()=>target.removeEventListener(name,listener));
        }
        enableGamepadControls(){} render(){}
        dispose(){this.isDisposed=true;this.input.dispose();cleanups.forEach(fn=>fn());}
    }
    const dependencies:Record<string,unknown>={
        '../WorldGame':{WorldGame:Base},'../BossEncounter':{BossEncounter:class{}},
        './HypotheticalModel':{HYPOTHETICAL:{health:9}},'./HypotheticalAudio':{HypotheticalAudio:class{dispose(){}}},
        '../../engine/ControlPreferences':preferences,
    };
    for(const name of ['./HypotheticalGuards','./HypotheticalVanguard','./HypotheticalGuardCues','../WorldPhysics',
        '../../constants','../types','../../graphics/BitmapFont','../WorldSceneUI','../WorldWorkshopUI',
        './HypotheticalStage','./HypotheticalSiege','./HypotheticalArt','./HypotheticalChaseDetails',
        './HypotheticalChaseDefeat','./HypotheticalChasePerformance','./HypotheticalLayout',
        './HypotheticalChasePatrol','./HypotheticalChasePatrolArt','./HypotheticalArrival','./HypotheticalHelicopterTiming'])dependencies[name]={};
    const {HypotheticalGame}=module<typeof import('../src/adventure/hipotetico/HypotheticalGame')>(
        '../src/adventure/hipotetico/HypotheticalGame.ts',dependencies);
    let model={won:false,health:9},loads=0;
    Object.defineProperty(HypotheticalGame.prototype,'fight',{get:()=>model});
    HypotheticalGame.prototype.load=function(){model={won:false,health:9};loads++;this.input.reset();};
    const game=new HypotheticalGame(canvas as unknown as HTMLCanvasElement);
    const key=(type:string,values:Record<string,unknown>={},target=canvas)=>{
        const event=new Event(type,{cancelable:true});
        for(const [key,value]of Object.entries({key:'r',code:'KeyR',repeat:false,target,...values}))
            Object.defineProperty(event,key,{value});
        window.dispatchEvent(event);return event;
    };
    return {game,canvas,Element,preferences,key,loads:()=>loads,model:()=>model};
}

for(const action of ['jump','right','run','pause'] as const)test(`configured R ${action} owns the press without retry`,t=>{
    const h=fixture();t.after(()=>h.game.dispose());
    h.preferences.controlPreferences.keys[action]=['KeyR'];const model=h.model(),loads=h.loads();
    h.key('keydown');h.game.input.update();
    assert.equal(h.model(),model);assert.equal(h.loads(),loads);
    assert.equal(h.game.input.getState()[action],true);
    h.key('keyup');h.game.input.update();assert.equal(h.game.input.getState()[action],false);
});

test('unassigned R retries once; repeats and non-playing scenes do not retry',t=>{
    const h=fixture();t.after(()=>h.game.dispose());
    const first=h.model();assert.equal(h.key('keydown').defaultPrevented,true);assert.notEqual(h.model(),first);
    const retried=h.model(),loads=h.loads();h.key('keydown',{repeat:true});assert.equal(h.model(),retried);
    h.key('keyup');h.game.state='paused';h.key('keydown');assert.equal(h.loads(),loads);
    h.game.state='playing';h.model().won=true;h.key('keydown');assert.equal(h.loads(),loads);
});

for(const values of [{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true},{keyCode:229}])
test(`R ignores ${JSON.stringify(values)}`,t=>{
    const h=fixture();t.after(()=>h.game.dispose());const model=h.model();
    assert.equal(h.key('keydown',values).defaultPrevented,false);assert.equal(h.model(),model);
});

for(const owner of ['editing','dialog'] as const)test(`R respects ${owner} ownership`,t=>{
    const h=fixture();t.after(()=>h.game.dispose());const target=new h.Element();target[owner]=true;
    const model=h.model();assert.equal(h.key('keydown',{},target).defaultPrevented,false);assert.equal(h.model(),model);
});

test('physical code and fallback use the same action lookup as Input',t=>{
    const h=fixture();t.after(()=>h.game.dispose());h.preferences.controlPreferences.keys.jump=['KeyR'];
    const model=h.model();h.key('keydown',{key:'R',code:'Unidentified'});h.game.input.update();
    assert.equal(h.model(),model);assert.equal(h.game.input.getState().jump,true);
    h.key('keyup',{key:'R',code:'Unidentified'});
    h.preferences.controlPreferences.keys.jump=['Space'];
    assert.equal(h.key('keydown',{key:'R',shiftKey:true}).defaultPrevented,true);assert.notEqual(h.model(),model);
});

test('retry hints track live R bindings without changing defeat advice',t=>{
    const h=fixture();t.after(()=>h.game.dispose());h.game.state='paused';h.game.render();
    assert.match(h.game.status.textContent??'',/R: retomar o trecho/);
    h.preferences.controlPreferences.keys.jump=['KeyR'];h.game.render();
    assert.doesNotMatch(h.game.status.textContent??'',/R: retomar/);
    h.game.player.data.isDead=true;
    const hint=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(h.game),'encounterHint')!.get!;
    for(const text of ['ALCANCADO! R: RETOMAR O TRECHO','CAIU NO RIO! R: RETOMAR O TRECHO',
        'ONDA BAIXA: SALTE POR CIMA. R: RETOMAR','ATINGIDO! USE ALTURA E ABRIGO. R: RETOMAR']){
        Object.defineProperty(h.game,'chaseDefeat',{value:{hint:text}});
        assert.equal(hint.call(h.game),text.split(' R:')[0]);
    }
    h.preferences.controlPreferences.keys.jump=['Space'];h.game.render();
    assert.match(h.game.status.textContent??'',/R: retomar o trecho/);
    assert.match(hint.call(h.game),/R: RETOMAR$/);
});

test('every configured action takes precedence over legacy retry',t=>{
    const h=fixture();t.after(()=>h.game.dispose());const model=h.model();
    for(const action of h.preferences.CONTROL_ACTIONS){
        Object.assign(h.preferences.controlPreferences.keys,structuredClone(h.preferences.DEFAULT_KEYS));
        h.preferences.controlPreferences.keys[action]=['KeyR'];
        h.key('keydown');h.key('keyup');assert.equal(h.model(),model,action);
    }
});
