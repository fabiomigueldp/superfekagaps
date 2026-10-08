import { ALL_DELICIA_STAGES, DELICIA_ENDING, DELICIA_LORE, DELICIA_STAGES, deliciaStageById, type DeliciaStage, type SceneLine } from './DeliciaContent';
import { DeliciaStore, completeDeliciaStage, deliciaUnlocked, awardDeliciaMedals, DELICIA_MEDALS } from './DeliciaProgress';
import { DeliciaSimulation, type DeliciaInput } from './DeliciaSimulation';
import { DeliciaAudio } from './DeliciaAudio';
import { DeliciaArt } from './DeliciaArt';
import { DELICIA_STEP } from './DeliciaNative';
import { DELICIA_MAP_IMAGE, DELICIA_MAP_METADATA } from './DeliciaIsland';
import { ART } from '../../graphics/palette';
import { wrapText } from '../../graphics/BitmapFont';
import { WORLD_DIALOGUE_ACTION, WORLD_PAUSE_ACTIONS } from '../WorldSceneUI';
import { DeliciaPresentation, DELICIA_TOUCH_BUTTONS, type DeliciaMenu, type DeliciaMenuChoice } from './DeliciaPresentation';
import type { Preferences } from '../types';
import { button, element, formatTime, heading, lettering, worldLink } from './DeliciaUI';
import './delicia.css';
const INPUT_KEYS:Record<string,string>={arrowleft:'arrowleft',a:'arrowleft','pad-left':'arrowleft',arrowright:'arrowright',d:'arrowright','pad-right':'arrowright',' ':' ',w:' ',z:' ',arrowup:' ','pad-jump':' ',shift:'shift',x:'shift','pad-dash':'shift',s:'s',arrowdown:'s','pad-pound':'s',j:'j','pad-seed':'j',q:'q','pad-parry':'q',e:'e','pad-interact':'e'};
type Screen='title'|'map'|'menu'|'playing'|'pause'|'dialogue'|'clear'|'journal'|'settings'|'ending'|'dead';
export interface DeliciaAppOptions { store?: DeliciaStore; initialStage?: string; returnToWorldMap?: () => void; preferences?: Preferences; savePreferences?: () => void }
export class DeliciaApp {
    readonly store:DeliciaStore;readonly audio=new DeliciaAudio();readonly art=new DeliciaArt();
    readonly root=element('main','delicia');readonly surface=element('section','dl-surface');readonly canvas=element('canvas','dl-canvas');
    readonly hud=element('div','dl-hud');readonly panel=element('section','dl-panel');readonly status=element('p','dl-status');
    readonly playfield=element('div','dl-playfield');
    readonly touch=element('div','dl-touch');screen:Screen='title';sim:DeliciaSimulation|null=null;
    private readonly presentation:DeliciaPresentation;private frame:number|null=null;private frameGeneration=0;private last=0;private accumulator=0;private disposed=false;
    private menu:DeliciaMenu|null=null;private menuSelection=0;private dialogueTime=0;private menuEpoch=0;
    private voiceVolume=.8;
    private pausedPaint:{toastTime:number;toast:string;shake:number;zoneBannerTime:number;zoneBanner:string;reducedMotion:boolean;images:number}|null=null;
    private held=new Set<string>();private pressed=new Set<string>();private released=new Set<string>();private sources=new Map<string,string>();private buttonKeys=new Map<string,HTMLButtonElement>();
    private lines:readonly SceneLine[]=[];private lineIndex=0;private dialogueDone:()=>void=()=>{};
    private journalReturn:()=>void=()=>this.showMap();private settingsReturn:()=>void=()=>this.showMap();
    private saveImportCleanup?:()=>void;
    private listOpen=false;private settingsMessage?:HTMLParagraphElement;

    private readonly systemMotion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
    private mapNodes:Record<string,{x:number;y:number}>={};private mapSelection='delicia-1';private toast='';private toastTime=0;private shake=0;
    private cleanups:(()=>void)[]=[];private mapCanvas?:HTMLCanvasElement;private mapControls:HTMLButtonElement[]=[];
    private hitStop=0;private zoneBanner='';private zoneBannerTime=0;private gamepadPause=false;
    private menuPad=new Set<string>();
    private windowFocused=typeof document.hasFocus!=='function'||document.hasFocus();
    private padArmed=false;private padDevice:string|null=null;
    private padMenuLatch=new Set<string>();
    constructor(host:HTMLElement=document.body, private readonly options:DeliciaAppOptions={}){
        if(navigator.maxTouchPoints>0)this.root.classList.add('dl-has-touch');
        let storage:Storage|null=null;try{storage=localStorage;}catch{}this.store=options.store??new DeliciaStore(storage);this.mapSelection=this.store.save.selected;
        this.canvas.width=960;this.canvas.height=540;this.canvas.tabIndex=0;this.canvas.setAttribute('aria-label','Feka na ilha da Delícia. Setas movem, Espaço pula, Shift corre, S dá sentada, J lança sementes, Q rebate e E abre válvulas.');
        this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');
        this.hud.hidden=true;this.touch.hidden=true;this.playfield.append(this.canvas,this.hud,this.touch);this.surface.append(this.playfield,this.panel);this.root.append(this.surface,this.status);host.append(this.root);
        this.presentation=new DeliciaPresentation(this.canvas,this.root,{
            select:index=>{this.menuSelection=index;this.invalidatePausedPaint();},
            activate:index=>this.activateMenu(index),escape:()=>this.goBack(),resetInput:()=>this.resetInput(),
        },()=>this.pause());
        this.applyVolume();this.canvas.hidden=true;this.buildTouch();
        if(options.initialStage){if(!this.loadStage(options.initialStage))queueMicrotask(()=>{if(!this.disposed)this.showMap();});}else this.showTitle();
        this.listen(window,'keydown',this.keyDown);this.listen(window,'keyup',this.keyUp);this.listen(window,'blur',()=>{this.windowFocused=false;this.loseFocus();});
        this.listen(window,'focus',()=>{this.windowFocused=true;this.disarmGamepad();});
        for(const event of ['gamepadconnected','gamepaddisconnected'])this.listen(window,event,()=>{this.padDevice=null;this.disarmGamepad();});
        this.listen(document,'visibilitychange',()=>{
            this.stopFrames();this.disarmGamepad();if(document.hidden)this.loseFocus();else{this.invalidatePausedPaint();this.requestFrame();}

        });
        this.listen(window,'pointerup',(e:PointerEvent)=>this.releaseInput(`pointer:${e.pointerId}`));this.listen(window,'pointercancel',(e:PointerEvent)=>this.releaseInput(`pointer:${e.pointerId}`,true));
        this.listen(this.canvas,'pointerdown',()=>this.canvas.focus({preventScroll:true}));this.listen(window,'pagehide',()=>this.dispose());
        this.listen(window,'resize',()=>{this.invalidatePausedPaint();if(this.screen==='map')this.fitMapTitle();});
        if(this.systemMotion){
            const changed=()=>{if(!this.disposed)this.invalidatePausedPaint();};
            if(typeof this.systemMotion.addEventListener==='function')this.listen(this.systemMotion,'change',changed);
            else{this.systemMotion.addListener(changed);this.cleanups.push(()=>this.systemMotion?.removeListener(changed));}
        }
        void this.art.load().then(()=>{if(!this.disposed)this.invalidatePausedPaint();});if(!options.returnToWorldMap)void fetch(DELICIA_MAP_METADATA).then(r=>r.ok?r.json():null).then((data:unknown)=>{
            if(this.disposed||!data||typeof data!=='object')return;const nodes=(data as {nodes?:unknown}).nodes;
            if(nodes&&typeof nodes==='object')for(const s of DELICIA_STAGES){const p=(nodes as Record<string,unknown>)[s.id] as {x?:unknown;y?:unknown};if(p&&typeof p.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)this.mapNodes[s.id]={x:p.x,y:p.y};}
            if(this.screen==='map')this.showMap(this.mapSelection);
        }).catch(()=>{});
        this.requestFrame();document.title='Império da Delícia · Super Feka Gaps World';
        if((import.meta as ImportMeta & {env:{DEV:boolean}}).env.DEV)(window as unknown as {deliciaGame:DeliciaApp}).deliciaGame=this;
    }
    private listen<E extends Event>(target:EventTarget,event:string,handler:(event:E)=>void):void{const listener:EventListener=e=>handler(e as E);target.addEventListener(event,listener);this.cleanups.push(()=>target.removeEventListener(event,listener));}
    // The save is a manual opt-in; system changes never overwrite it.
    private get reducedMotion():boolean{return (this.options.preferences?!this.options.preferences.shake:this.store.save.reducedMotion)||!!this.systemMotion?.matches;}
    private applyVolume():void{const p=this.options.preferences;this.audio.setVolume(p?.music??this.store.save.music,p?.effects??this.store.save.effects,p?.voice??this.voiceVolume);}
    private keyDown=(event:KeyboardEvent):void=>{
        const key=event.key.toLowerCase();if(this.disposed)return;
        if((event.target as HTMLElement)?.closest('.canvas-menu-accessibility'))return;
        if(event.repeat){if(this.screen!=='playing'&&(key==='enter'||key===' '))event.preventDefault();return;}
        if(key==='escape'){event.preventDefault();this.goBack();return;}
        if(this.menu&&event.target===this.canvas){
            if(['arrowup','arrowdown','arrowleft','arrowright'].includes(key)){event.preventDefault();this.selectNativeMenu(key==='arrowup'||key==='arrowleft'?-1:1);}
            else if(key==='enter'||key===' '){event.preventDefault();this.activateMenu(this.menuSelection);}
            else if(key==='tab'){event.preventDefault();this.presentation.menus.requestFocusFromCanvas();this.renderGame();}
            return;
        }
        const editable=(event.target as HTMLElement)?.closest('input,textarea,select');if(editable){if(key==='tab')this.menuKeyboard(event);return;}
        const active=(this.screen==='playing'&&!(event.target as HTMLElement)?.closest('button,a,summary'))||event.target===this.canvas;
        if(INPUT_KEYS[key]&&active){event.preventDefault();this.holdInput(`key:${this.physicalKey(event)}`,key);}
        if((key==='enter'||key===' ')&&event.target===this.canvas&&this.screen==='dialogue'){event.preventDefault();this.advanceDialogue();}
        if(this.screen==='map'&&!this.listOpen){
            if(['arrowleft','arrowright','arrowup','arrowdown'].includes(key)){
                event.preventDefault();const index=Math.max(0,DELICIA_STAGES.findIndex(s=>s.id===this.mapSelection)),delta=key==='arrowleft'||key==='arrowup'?-1:1;
                this.selectMap(DELICIA_STAGES[(index+delta+DELICIA_STAGES.length)%DELICIA_STAGES.length].id);this.focusMapPin();
            }else if(key==='enter'&&(event.target===document.body||(event.target as HTMLElement)?.closest('.dl-pin'))){event.preventDefault();this.loadStage(this.mapSelection);}
        }
        if(this.screen!=='playing'&&(this.screen!=='map'||this.listOpen))this.menuKeyboard(event);
        if(key==='m'){this.audio.toggleMute();this.announce(this.audio.muted?'Som desligado.':'Som ligado.');}if(key==='r'&&this.screen==='dead')this.retry();
    };
    private physicalKey(event:KeyboardEvent):string{return(event.code&&event.code!=='Unidentified'?event.code:event.key).toLowerCase();}
    private keyUp=(event:KeyboardEvent):void=>{
        const physical=this.physicalKey(event);this.releaseInput(`key:${physical}`);this.releaseInput(`button:${physical}`);this.buttonKeys.delete(physical);
    };
    // A logical action stays down until its last keyboard, button, pointer or pad owner ends.
    private holdInput(source:string,key:string):void{
        if(this.disposed||this.screen!=='playing'||this.sources.has(source))return;
        const action=INPUT_KEYS[key];if(!action)return;this.sources.set(source,action);
        if(!this.held.has(action)){this.pressed.add(action);this.released.delete(action);}this.held.add(action);
    }
    private releaseInput(source:string,cancel=false):void{
        const action=this.sources.get(source);if(action===undefined)return;this.sources.delete(source);
        if([...this.sources.values()].includes(action))return;
        this.held.delete(action);this.released.add(action);if(cancel)this.pressed.delete(action);
    }
    private goBack():void {
        if(this.menu?.back){this.menu.back();return;}
        if(this.screen==='playing')this.pause();else if(this.screen==='pause')this.resume();else if(this.screen==='dialogue')this.advanceDialogue();else if(this.screen==='journal')this.closeJournal();else if(this.screen==='settings')this.settingsReturn();else if(this.screen==='menu')this.showMap();else if(this.screen==='map'){if(this.listOpen)this.toggleStageList();else this.showMenu();}
    }
    private loseFocus():void{this.disarmGamepad();this.resetInput();if(this.screen==='playing')this.pause();}
    private input():DeliciaInput{
        const down=(...keys:string[])=>keys.some(k=>this.held.has(k)),tap=(...keys:string[])=>keys.some(k=>this.pressed.has(k));
        const horizontal=[...this.sources.values()].filter(action=>action==='arrowleft'||action==='arrowright');
        const latest=horizontal[horizontal.length-1];
        return{left:latest==='arrowleft',right:latest==='arrowright',jump:down(' ','w','z','arrowup','pad-jump'),jumpPressed:tap(' ','w','z','arrowup','pad-jump'),jumpReleased:[' ','w','z','arrowup','pad-jump'].some(k=>this.released.has(k)),run:down('shift','x','pad-dash'),dash:false,pound:tap('s','arrowdown','pad-pound'),seed:tap('j','pad-seed'),parry:tap('q','pad-parry'),interact:tap('e','pad-interact')};
    }
    /** Interrupt only this controller; keyboard/touch owners retain their inputs. */
    private disarmGamepad():void{
        this.padArmed=false;this.gamepadPause=false;this.menuPad.clear();this.padMenuLatch.clear();
        for(const source of this.sources.keys())if(source.startsWith('gamepad:'))this.releaseInput(source,true);
    }
    private pollGamepad():void {
        if(this.disposed)return;
        if(document.hidden||!this.windowFocused||(typeof document.hasFocus==='function'&&!document.hasFocus())){this.disarmGamepad();return;}
        let pad:Gamepad|undefined;try{pad=Array.from(navigator.getGamepads?.()??[]).find((p):p is Gamepad=>!!p&&p.connected!==false&&p.mapping==='standard');}catch{}
        if(!pad){this.padDevice=null;this.disarmGamepad();return;}
        const device=`${pad.index}:${pad.id}`;
        if(device!==this.padDevice){this.padDevice=device;this.disarmGamepad();}
        // Returning/connecting with controls held must never activate a menu or
        // resume gameplay. Require raw neutral, including opposed directions.
        if(!this.padArmed){
            this.padArmed=![0,1,2,3,4,5,9,12,13,14,15].some(index=>pad.buttons[index]?.pressed)
                &&[0,1].every(index=>Math.abs(pad.axes[index]??0)<=.25);
            return;

        }
        const down=(i:number)=>!!pad?.buttons[i]?.pressed,wasMenu=this.screen!=='playing';
        const menuKeys:Record<string,boolean>={up:(pad?.axes[1]??0)<-.5||down(12),down:(pad?.axes[1]??0)>.5||down(13),left:(pad?.axes[0]??0)<-.5||down(14),right:(pad?.axes[0]??0)>.5||down(15),accept:down(0),back:down(1)};
        const taps=new Set(Object.keys(menuKeys).filter(key=>menuKeys[key]&&!this.menuPad.has(key)));this.menuPad=new Set(Object.keys(menuKeys).filter(key=>menuKeys[key]));
        if(this.screen!=='playing'&&(!this.menu||document.activeElement===this.canvas||this.presentation.menus.canControl())){
            if(taps.has('back'))this.goBack();
            else if(this.screen==='map'&&!this.listOpen){
                const delta=taps.has('left')||taps.has('up')?-1:taps.has('right')||taps.has('down')?1:0;
                if(delta){const i=Math.max(0,DELICIA_STAGES.findIndex(s=>s.id===this.mapSelection));this.selectMap(DELICIA_STAGES[(i+delta+DELICIA_STAGES.length)%DELICIA_STAGES.length].id);this.focusMapPin();}
                if(taps.has('accept')){const focused=document.activeElement as HTMLElement;if(focused?.closest('.dl-map-tools'))focused.click();else this.loadStage(this.mapSelection);}
            }else if(this.menu){
                if(taps.has('up')||taps.has('left')||taps.has('down')||taps.has('right'))this.selectNativeMenu(taps.has('down')||taps.has('right')?1:-1);
                if(taps.has('accept'))this.activateMenu(this.menuSelection);
            }else{
                const range=document.activeElement as HTMLInputElement;
                if(range?.type==='range'&&(taps.has('left')||taps.has('right'))){taps.has('right')?range.stepUp():range.stepDown();range.dispatchEvent(new Event('input',{bubbles:true}));}
                if(taps.has('up')||taps.has('down'))this.moveMenuFocus(taps.has('down')?1:-1);
                if(taps.has('accept'))(document.activeElement as HTMLElement)?.click();
            }
        }
        const state:Record<string,boolean>={'pad-left':(pad?.axes[0]??0)<-.25||down(14),'pad-right':(pad?.axes[0]??0)>.25||down(15),'pad-jump':down(0),'pad-dash':down(2),'pad-seed':down(1),'pad-parry':down(3),'pad-pound':down(4)||down(13),'pad-interact':down(5)};
        for(const [key,active] of Object.entries(state)){
            if(wasMenu&&active)this.padMenuLatch.add(key);else if(!active)this.padMenuLatch.delete(key);
            const source=`gamepad:${key}`;
            if(this.padMenuLatch.has(key)){this.releaseInput(source,true);continue;}
            if(active)this.holdInput(source,key);else this.releaseInput(source);
        }
        const pause=down(9);if(pause&&!this.gamepadPause){if(this.screen==='playing')this.pause();else if(this.screen==='pause')this.resume();else this.goBack();}this.gamepadPause=pause;
    }
    private invalidatePausedPaint():void{this.pausedPaint=null;}
    private stopFrames():void{
        ++this.frameGeneration;if(this.frame!==null)cancelAnimationFrame(this.frame);this.frame=null;this.last=0;
    }
    private requestFrame():void{
        if(this.disposed||document.hidden||this.frame!==null)return;
        const generation=++this.frameGeneration;
        this.frame=requestAnimationFrame(now=>{
            if(this.disposed||generation!==this.frameGeneration)return;this.frame=null;this.loop(now);
        });
    }
    private paintPausedGame():void{
        // Simulation time is frozen; only feedback, loaded art or display changes can alter this scene.
        const previous=this.pausedPaint,reducedMotion=this.reducedMotion,images=this.art.images.size;
        if(previous&&previous.toastTime===this.toastTime&&previous.toast===this.toast&&previous.shake===this.shake
            &&previous.zoneBannerTime===this.zoneBannerTime&&previous.zoneBanner===this.zoneBanner
            &&previous.reducedMotion===reducedMotion&&previous.images===images)return;
        this.renderGame();
        this.pausedPaint={toastTime:this.toastTime,toast:this.toast,shake:this.shake,zoneBannerTime:this.zoneBannerTime,zoneBanner:this.zoneBanner,reducedMotion,images};
    }
    private loop=(now:number):void=>{
        if(this.disposed||document.hidden)return;const dt=this.last?Math.min(.05,(now-this.last)/1000):0;this.last=now;this.pollGamepad();
        if(this.disposed||document.hidden)return;
        if(this.screen==='playing'&&this.sim){
            if(this.hitStop>0){this.hitStop=Math.max(0,this.hitStop-dt);this.accumulator=0;}else this.accumulator+=dt;
            let first=true;while(this.accumulator+1e-9>=DELICIA_STEP){this.step(DELICIA_STEP,first?this.input():{...this.input(),jumpPressed:false,jumpReleased:false,dash:false,pound:false,seed:false,parry:false,interact:false});this.accumulator=Math.max(0,this.accumulator-DELICIA_STEP);first=false;if(this.screen!=='playing'||this.hitStop>0){this.accumulator=0;break;}}
            if(!first){this.pressed.clear();this.released.clear();}this.renderGame();
        }else if(this.screen==='map')this.paintMap(now/1000);
        else if(!this.canvas.hidden&&(this.sim||this.menu)){this.dialogueTime+=dt*1000;if(this.screen==='pause')this.paintPausedGame();else this.renderGame();}
        this.toastTime=Math.max(0,this.toastTime-dt);this.shake=Math.max(0,this.shake-dt);this.zoneBannerTime=Math.max(0,this.zoneBannerTime-dt);
        this.requestFrame();
    };
    private step(dt:number,input:DeliciaInput):void{
        const sim=this.sim!;sim.update(dt,input);
        for(const event of sim.events){
            if(event.kind==='zone'){this.zoneBanner=event.text??'';this.zoneBannerTime=3.5;continue;}
            if(event.kind==='echo'){this.notify(event.text??'');continue;}
            if(event.kind==='jet'){this.audio.effect('pressure',.35);continue;}
            if(event.kind==='collect'&&event.pickup){const p=event.pickup;this.audio.effect('collect',p.kind==='orange'?.4:1);if(p.kind!=='orange'&&p.kind!=='heart')this.store.collect(p.id,p.lore);if(p.kind==='memory'){const lore=DELICIA_LORE.find(l=>l.id===p.lore);this.notify('Memória encontrada: '+(lore?.title??'O eco da ilha'));}if(p.kind==='seal')this.notify('Selo encontrado.');}
            else if(event.kind==='checkpoint'){this.store.save.checkpoint={stage:sim.stage.id,index:sim.checkpoint,valves:[...sim.valves]};const saved=this.store.persist();this.audio.effect('collect');this.notify(saved?'Checkpoint salvo.':'Checkpoint só nesta sessão.');if(!saved)this.toastTime=5;}
            else if(event.kind==='valve'){if(this.store.save.checkpoint?.stage===sim.stage.id){this.store.save.checkpoint.valves=[...sim.valves];this.store.persist();}this.audio.effect('pressure');this.notify(sim.boss?'Pressão liberada!':`${sim.valves.size}/${sim.stage.valves.length} fontes abertas.`);}
            else if(event.kind==='tell'){this.audio.effect('warning',.7);if(event.attack==='order')this.notify('Abra primeiro a fonte do bairro.');if(sim.boss?.character==='guina')this.audio.voice(event.attack==='court'?'guina-namoro':event.attack==='gap'?'guina-oco':event.attack==='overload'?'guina-reserva':'guina-fugir');}
            else if(event.kind==='phase'){this.audio.effect('pressure');this.zoneBanner=sim.boss?.phaseTitle??'';this.zoneBannerTime=2.6;this.shake=.18;this.notify(sim.boss?.character==='guina'?'Guina aumentou a pressão!':'Jajá mudou o ritmo!');}
            else if(event.kind==='gap'){this.audio.effect('pound');this.notify(sim.boss?'Um gap!':'Um gap!');}
            else if(event.kind==='defeat'){this.audio.effect('victory');this.audio.voice(sim.boss?.character==='jaja'?'jaja-promessa':'guina-final');this.notify(sim.boss?.character==='jaja'?'Jajá derrotado!':'Guina derrotado!');}
            else if(event.kind==='clear'){this.clearStage();return;}
            else if(event.kind==='boss-hit'||event.kind==='enemy'){this.audio.effect('boss-hit');this.shake=.1;this.hitStop=event.kind==='boss-hit'?.055:.025;}
            else if(event.kind==='hurt'){this.audio.effect('boss-hit',.5);this.shake=.16;}
            else if(event.kind==='pound'){this.audio.effect('pound',.65);this.shake=.15;}
            else if(event.kind==='parry'){this.audio.effect('parry',.7);this.hitStop=.065;this.notify('Rebatida perfeita!');}
            else if(['dash','seed','jump'].includes(event.kind))this.audio.effect(event.kind,.5);
        }
        if(sim.dead){this.setScreen('dead');this.showDeath();}
        this.updateHud();
    }
    private resetInput():void{
        for(const source of this.sources.keys())if(source.startsWith('gamepad:'))this.padMenuLatch.add(source.slice(8));
        this.held.clear();this.pressed.clear();this.released.clear();this.sources.clear();this.buttonKeys.clear();this.accumulator=0;}
    private setScreen(screen:Screen):void{
        this.saveImportCleanup?.();
        this.invalidatePausedPaint();
        this.screen=screen;this.menu=null;this.presentation.hide();this.root.dataset.screen=screen;this.panel.replaceChildren();this.panel.className='dl-panel';this.panel.hidden=false;
        this.panel.removeAttribute('role');this.panel.removeAttribute('aria-modal');this.panel.removeAttribute('aria-labelledby');
        this.hud.hidden=true;this.canvas.hidden=!['playing','pause','dialogue','dead','clear'].includes(screen);this.playfield.hidden=this.canvas.hidden;
        this.playfield.inert=false;
        this.touch.hidden=screen!=='playing';this.listOpen=false;this.resetInput();
    }
    private nativeMenu(menu:DeliciaMenu):void{
        if(this.store.warning&&['pause','result','settings','title'].includes(menu.kind)){
            const original=menu;
            menu={...menu,choices:[...menu.choices,{label:'REVER PROGRESSO',x:176,y:1,width:140,height:20,run:()=>this.showSaveRecovery(original)}]};
        }
        this.menu={...menu,id:`${menu.id}:${++this.menuEpoch}`};this.menuSelection=0;this.panel.hidden=true;
        this.canvas.hidden=false;this.playfield.hidden=false;this.canvas.focus({preventScroll:true});
        this.presentation.menus.requestFocusFromCanvas();this.invalidatePausedPaint();this.renderGame();
    }
    private showSaveRecovery(back:DeliciaMenu):void{
        this.nativeMenu({id:'recovery',kind:'journal',title:'PROGRESSO',text:()=>this.store.warning,back:()=>this.nativeMenu(back),choices:[
            {label:'EXPORTAR',x:20,y:145,width:88,height:20,run:()=>this.exportSave()},
            {label:'TENTAR SALVAR',x:116,y:145,width:106,height:20,run:()=>{
                if(this.store.persist()){this.announce('Progresso salvo.');this.nativeMenu(back);}else{this.announce(this.store.warning);this.renderGame();}
            }},
            {label:'VOLTAR',x:230,y:145,width:70,height:20,run:()=>this.nativeMenu(back)},
        ]});
    }
    private activateMenu(index:number):void{if(this.disposed||document.hidden)return;this.menu?.choices[index]?.run();}
    private selectNativeMenu(delta:number):void{
        if(!this.menu)return;this.menuSelection=(this.menuSelection+delta+this.menu.choices.length)%this.menu.choices.length;
        this.invalidatePausedPaint();this.renderGame();this.presentation.menus.focusFromController(this.menuSelection);
    }
    private focusFirst():void{this.panel.querySelector<HTMLElement>('button:not(:disabled),a[href],summary,input')?.focus({preventScroll:true});}
    private menuFocusables():HTMLElement[]{
        const scope=this.listOpen?this.panel.querySelector('#dl-stage-list')??this.panel:this.panel;
        return Array.from(scope.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],summary,input')).filter(n=>n.getClientRects().length>0&&!n.closest('details:not([open]) > :not(summary)'));
    }
    private moveMenuFocus(delta:number):void {
        const nodes=this.menuFocusables();if(!nodes.length)return;const index=nodes.indexOf(document.activeElement as HTMLElement);nodes[(Math.max(0,index)+delta+nodes.length)%nodes.length].focus();
    }
    private menuKeyboard(event:KeyboardEvent):void{
        const nodes=this.menuFocusables();
        if(!nodes.length)return;const index=nodes.indexOf(document.activeElement as HTMLElement);
        if(event.key==='Tab'&&(event.shiftKey?index<=0:index===nodes.length-1)){event.preventDefault();nodes[event.shiftKey?nodes.length-1:0].focus();}
        else if(['ArrowUp','ArrowDown'].includes(event.key)&&!(event.target as HTMLElement)?.closest('details')){event.preventDefault();this.moveMenuFocus(event.key==='ArrowDown'?1:-1);}
    }
    private menuPanel(title:string):void{
        this.panel.classList.add('dl-overlay');const h=heading(title);h.id='dl-dialog-title';this.panel.append(h);
        this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-modal','true');this.panel.setAttribute('aria-labelledby',h.id);
    }
    private announce(message:string):void{this.status.textContent=message;}
    private notify(message:string):void{this.toast=message;this.toastTime=3;this.announce(message);}
    showTitle():void {
        this.setScreen('title');this.audio.pause(false);this.panel.classList.add('dl-title');
        const image=element('canvas','dl-key-art');image.width=960;image.height=540;image.setAttribute('aria-hidden','true');
        const preview=image.getContext('2d');if(preview){const scene=new DeliciaSimulation();scene.cameraX=1200;this.art.draw(preview,scene,true);}
        const content=element('div','dl-title-copy');
        const brand=element('p','dl-brand');brand.append(lettering('Super Feka Gaps World',ART.paper));
        const title=heading('Império da Delícia',1,3);
        const actions=element('div','dl-title-actions');
        actions.append(button(this.store.save.completed.length||this.store.save.checkpoint?'Continuar':'Jogar',()=>{
            void this.audio.unlock();this.showMap();
        },'dl-button dl-primary'),button('Memórias',()=>this.openJournal(()=>this.showTitle())),button('Opções',()=>this.showSettings(()=>this.showTitle())),worldLink());
        content.append(brand,title,actions);this.panel.append(image,content);
        this.saveWarning();this.focusFirst();
    }
    private saveWarning(recovery=false):void {
        if(!this.store.warning)return;
        const warning=element('div','dl-save-warning'+(recovery?' dl-save-recovery':''));
        const message=element('p','',this.store.warning);message.setAttribute('role','alert');warning.append(message);
        if(recovery){
            const actions=element('div','dl-save-actions');
            actions.append(button('Exportar cópia',()=>this.exportSave()),button('Tentar salvar',()=>{
                if(this.store.persist()){warning.remove();this.announce('Progresso salvo.');this.focusFirst();}
                else{message.textContent=this.store.warning;this.announce(this.store.warning);}
            }));warning.append(actions);
        }
        this.panel.append(warning);
    }
    showMap(id=this.store.save.selected):void {
        if(this.options.returnToWorldMap){this.resetInput();this.audio.pause(true);this.options.returnToWorldMap();return;}
        this.setScreen('map');
        // Audio availability must not prevent navigation after a durable import.
        try{this.audio.pause(false);this.audio.music('orchard');}catch{}

        this.mapSelection=deliciaStageById(id)?id:'delicia-1';this.store.save.selected=this.mapSelection;this.store.persist();
        this.panel.classList.add('dl-map');
        const top=element('header','dl-map-header'),title=heading('Império da Delícia');
        const tools=element('nav','dl-map-tools');tools.setAttribute('aria-label','Mapa');
        const list=button('Fases',()=>this.toggleStageList(),'dl-button dl-tool');list.id='dl-stage-toggle';list.setAttribute('aria-expanded','false');list.setAttribute('aria-controls','dl-stage-list');
        tools.append(list,button('Menu',()=>this.showMenu(),'dl-button dl-tool'));top.append(title,tools);
        const geography=element('div','dl-map-geography'),map=element('div','dl-map-land');
        const canvas=element('canvas','dl-sea');canvas.width=960;canvas.height=700;this.mapCanvas=canvas;this.panel.append(canvas);
        const art=element('img','dl-map-island');art.src=DELICIA_MAP_IMAGE;art.alt='Ilha da Delícia, com o cais, pomares, aqueduto, fábrica e palácio.';map.append(art);
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 1600 1000');svg.setAttribute('aria-hidden','true');svg.classList.add('dl-routes');
        for(let i=0;i<11;i++){
            const a=this.mapNodes[DELICIA_STAGES[i].id]??DELICIA_STAGES[i].map,b=this.mapNodes[DELICIA_STAGES[i+1].id]??DELICIA_STAGES[i+1].map,path=document.createElementNS(svg.namespaceURI,'path');
            path.setAttribute('d',`M ${a.x*1600} ${a.y*1000} L ${b.x*1600} ${b.y*1000}`);path.setAttribute('class',this.store.save.completed.includes(DELICIA_STAGES[i].id)?'open':'closed');svg.append(path);
        }
        map.append(svg);this.mapControls=[];
        for(const stage of DELICIA_STAGES){
            const point=this.mapNodes[stage.id]??stage.map,unlocked=deliciaUnlocked(stage.id,this.store.save),done=this.store.save.completed.includes(stage.id);
            const pin=button(String(stage.number),()=>this.selectMap(stage.id),'dl-pin'+(done?' done':'')+(!unlocked?' locked':'')+(stage.id===this.mapSelection?' selected':'')+(stage.boss?' boss':''));
            pin.dataset.stage=stage.id;pin.style.left=`${point.x*100}%`;pin.style.top=`${point.y*100}%`;
            pin.setAttribute('aria-label',`${stage.number}. ${stage.name}, ${done?'concluída':unlocked?'disponível':'bloqueada'}`);pin.title=stage.name;pin.setAttribute('aria-pressed',String(stage.id===this.mapSelection));pin.tabIndex=stage.id===this.mapSelection?0:-1;
            map.append(pin);this.mapControls.push(pin);
        }
        geography.append(map);const detail=element('aside','dl-map-detail');detail.id='delicia-stage-detail';detail.setAttribute('aria-label','Fase selecionada');
        this.panel.append(geography,top,detail);this.updateMapDetail();this.paintMap(0);this.saveWarning();
        requestAnimationFrame(()=>{if(this.screen==='map')this.focusMapPin();});
        this.announce(`${this.store.save.completed.filter(x=>DELICIA_STAGES.some(s=>s.id===x)).length} de 12 fases concluídas.`);
    }
    private focusMapPin():void {
        const pin=this.mapControls.find(b=>b.dataset.stage===this.mapSelection);
        if(pin){pin.focus({preventScroll:true});const geography=pin.closest<HTMLElement>('.dl-map-geography');if(geography){geography.scrollLeft=pin.offsetLeft-geography.clientWidth/2;geography.scrollTop=pin.offsetTop-geography.clientHeight/2;}}
        else this.panel.querySelector<HTMLElement>('.dl-map-detail button')?.focus({preventScroll:true});
    }
    private selectMap(id:string):void {
        this.mapSelection=id;this.store.save.selected=id;this.store.persist();
        this.mapControls.forEach(b=>{const selected=b.dataset.stage===id;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));b.tabIndex=selected?0:-1;});
        this.updateMapDetail();this.announce(deliciaStageById(id)?.name??'');
    }
    private updateMapDetail():void {
        const detail=this.panel.querySelector('#delicia-stage-detail');if(!detail)return;
        const s=deliciaStageById(this.mapSelection)!;detail.replaceChildren();
        const unlocked=deliciaUnlocked(s.id,this.store.save),done=this.store.save.completed.includes(s.id),seals=this.store.save.collected.filter(id=>id.startsWith(s.id+':s')).length,record=this.store.save.times[s.id];
        const copy=element('div','dl-stage-copy'),label=element('p','dl-stage-number',s.optional?'EXTRA':`FASE ${String(s.number).padStart(2,'0')}`);
        const name=heading(s.name,2);copy.append(label,name);
        const stats=element('p','dl-map-stats');
        if(unlocked){
            stats.textContent=s.boss?(done?'Concluída':'Chefe'):`${seals}/3 selos`;
            if(record)stats.append(document.createTextNode(` · ${formatTime(record)}`));
            const medals=this.store.save.medals[s.id]??[];if(medals.length){const badge=element('span','dl-medals',` · ${medals.length} medalha${medals.length>1?'s':''}`);badge.title=medals.map(m=>DELICIA_MEDALS[m as keyof typeof DELICIA_MEDALS]).join(', ');stats.append(badge);}
        }else stats.textContent=`Conclua a fase ${String(s.number-1).padStart(2,'0')}.`;
        copy.append(stats);
        const play=button(unlocked?(done?'Jogar de novo':'Jogar'):'Bloqueada',()=>this.loadStage(s.id),'dl-button dl-primary');play.disabled=!unlocked;
        detail.append(copy,play);
        this.fitMapTitle();
    }
    private fitMapTitle():void {
        const name=this.panel.querySelector<HTMLElement>('.dl-stage-copy h2'),copy=name?.parentElement,stage=deliciaStageById(this.mapSelection);
        if(name&&copy&&stage)name.replaceChildren(lettering(stage.name,ART.goldLight,2,Math.max(50,Math.floor(copy.clientWidth/2))));
    }
    private toggleStageList():void {
        const toggle=this.panel.querySelector<HTMLButtonElement>('#dl-stage-toggle');
        if(this.listOpen){this.panel.querySelector('#dl-stage-list')?.remove();this.listOpen=false;toggle?.setAttribute('aria-expanded','false');toggle?.focus();return;}
        this.listOpen=true;toggle?.setAttribute('aria-expanded','true');
        const list=element('section','dl-stage-list');list.id='dl-stage-list';list.setAttribute('aria-label','Fases');
        const header=element('div','dl-section-head');header.append(heading('Fases',2),button('Fechar',()=>this.toggleStageList(),'dl-button dl-small'));list.append(header);
        list.append(element('p','dl-muted',`${this.store.save.completed.filter(id=>DELICIA_STAGES.some(s=>s.id===id)).length}/12 concluídas`));
        for(const s of ALL_DELICIA_STAGES){
            if(s.optional&&!deliciaUnlocked(s.id,this.store.save))continue;
            const done=this.store.save.completed.includes(s.id),unlocked=deliciaUnlocked(s.id,this.store.save);
            const row=element('button','dl-stage-row');row.type='button';row.dataset.stage=s.id;
            row.append(element('span','dl-stage-index',s.optional?'+':String(s.number).padStart(2,'0')),element('span','',s.name),element('span','dl-row-state',done?'✓':unlocked?'':'−'));
            row.setAttribute('aria-label',`${s.name}, ${done?'concluída':unlocked?'disponível':'bloqueada'}`);row.setAttribute('aria-current',String(s.id===this.mapSelection));
            row.addEventListener('click',()=>{this.toggleStageList();this.selectMap(s.id);this.focusMapPin();});list.append(row);
        }
        this.panel.append(list);list.querySelector<HTMLButtonElement>('.dl-stage-row[aria-current="true"]')?.focus();
    }
    private showMenu():void {
        this.setScreen('menu');this.menuPanel('Menu');
        this.panel.append(button('Continuar',()=>this.showMap(),'dl-button dl-primary'),button('Memórias',()=>this.openJournal(()=>this.showMenu())),button('Opções',()=>this.showSettings(()=>this.showMenu())),worldLink());this.focusFirst();
    }
    private paintMap(time:number):void{
        const canvas=this.mapCanvas,c=canvas?.getContext('2d');if(!canvas||!c)return;c.fillStyle='#286c75';c.fillRect(0,0,960,700);const gradient=c.createLinearGradient(0,0,960,700);gradient.addColorStop(0,'#153f55');gradient.addColorStop(1,'#419ba0');c.fillStyle=gradient;c.fillRect(0,0,960,700);
        c.strokeStyle='#c6e7cf25';c.lineWidth=1;const t=this.reducedMotion?0:time;
        for(let row=0;row<20;row++){c.beginPath();for(let x=0;x<=960;x+=10){const y=row*38+Math.sin(x*.012+t*.6+row)*5;if(!x)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}
    }
    loadStage(id:string,retry=false):boolean{
        const stage=deliciaStageById(id);if(!stage||!deliciaUnlocked(id,this.store.save))return false;
        if(this.options?.returnToWorldMap){this.store.save.selected=id;this.store.persist();}
        const saved=this.store.save.checkpoint;this.sim=new DeliciaSimulation(stage,this.store.save.assists,saved?.stage===id?saved.index:-1);this.hitStop=0;this.zoneBannerTime=0;
        if(saved?.stage===id)for(const valve of saved.valves)this.sim.valves.add(valve);
        for(const p of this.store.save.collected)this.sim.collected.add(p);
        this.audio.pause(false);void this.audio.unlock();this.audio.music(stage.boss?'guina':stage.biome==='orchard'||stage.biome==='harbor'?'orchard':'reservoir');
        this.setScreen('playing');this.panel.hidden=true;this.updateHud();this.canvas.focus({preventScroll:true});
        if(!retry&&!this.store.save.completed.includes(stage.id))this.showDialogue(stage.intro,()=>{this.setScreen('playing');this.panel.hidden=true;this.sim?.startBoss();this.canvas.focus();},stage);
        else this.sim.startBoss();this.announce(stage.name+'. '+stage.mechanic);return true;
    }
    private renderGame():void {
        this.presentation.draw(this.sim,this.art,this.menu,this.menuSelection,{
            playing:this.screen==='playing',reduced:this.reducedMotion,shake:this.shake,
            toast:this.toastTime>0?this.toast:'',banner:this.zoneBannerTime>0?this.zoneBanner:'',
            characters:this.reducedMotion?Infinity:Math.floor(this.dialogueTime/34),
            status:this.store.warning||this.toastTime>0&&this.toast||'',
        });
    }
    private updateHud():void {
        // The renderer composes World HUD and its accessibility mirror together each frame.
        this.hud.hidden=true;
    }
    private showDialogue(lines:readonly SceneLine[],done:()=>void,stage?:DeliciaStage):void {
        if(!lines.length){done();return;}this.setScreen('dialogue');this.lines=lines;this.lineIndex=0;this.dialogueDone=done;this.renderDialogue(stage);
    }
    private renderDialogue(_stage?:DeliciaStage):void {
        const line=this.lines[this.lineIndex];this.dialogueTime=0;
        const text=line.text.toLowerCase(),voice=line.speaker==='Guina'?(text.includes('sem gap')?'guina-final':text.includes('deixar oco')?'guina-oco':text.includes('namora comigo')?'guina-namoro':''):line.speaker==='Jajá'?(text.includes('pressão da caneca')?'jaja-delicia':text.includes('acabei protegendo')?'jaja-promessa':''):'';
        this.audio.voice(voice);this.announce(line.speaker+': '+line.text);
        this.nativeMenu({id:'dialogue',kind:'dialogue',title:line.speaker,text:line.text,choices:[
            {...WORLD_DIALOGUE_ACTION,label:'CONTINUAR',run:()=>this.advanceDialogue()},
        ]});
    }
    private advanceDialogue():void{
        if(this.screen!=='dialogue')return;
        if(!this.reducedMotion&&this.dialogueTime<this.lines[this.lineIndex].text.length*34){this.dialogueTime=Infinity;this.renderGame();return;}
        this.lineIndex++;if(this.lineIndex>=this.lines.length)this.dialogueDone();else this.renderDialogue(this.sim?.stage);
    }
    pause():void{if(this.screen!=='playing')return;this.pauseMenu();}
    private pauseMenu():void {
        this.setScreen('pause');this.audio.pause(true);
        const actions=[()=>this.resume(),()=>this.showSettings(()=>this.pauseMenu()),()=>this.showMap()];
        this.nativeMenu({id:'paused',kind:'pause',title:'Pausa',text:`D-${this.sim?.stage.number} · ${this.sim?.stage.name}`,choices:
            WORLD_PAUSE_ACTIONS.map((box,i)=>({...box,label:['CONTINUAR','OPÇÕES','VOLTAR AO MAPA'][i],run:actions[i]}))});
    }
    private resume():void{if(this.screen!=='pause')return;this.setScreen('playing');this.panel.hidden=true;this.audio.pause(false);this.canvas.focus({preventScroll:true});}
    private showDeath():void {
        this.nativeMenu({id:'dead',kind:'result',title:'TENTE DE NOVO',text:'Feka volta ao último checkpoint.',choices:[
            {label:'TENTAR DE NOVO',x:52,y:120,width:112,height:20,run:()=>this.retry()},
            {label:'VOLTAR AO MAPA',x:172,y:120,width:100,height:20,run:()=>this.showMap()},
        ]});
    }
    private retry():void{if(this.sim)this.loadStage(this.sim.stage.id,true);}
    private clearStage():void {
        const sim=this.sim!;completeDeliciaStage(this.store.save,sim.stage.id,sim.elapsed,sim.recordEligible);const medals=awardDeliciaMedals(this.store.save,sim.stage.id,{eligible:sim.recordEligible,damage:sim.damageTaken,seals:sim.stage.pickups.filter(p=>p.kind==='seal'&&sim.collected.has(p.id)).length,seconds:sim.elapsed,parries:sim.parries});this.store.persist();this.audio.effect('victory');
        const finish=()=>{
            this.setScreen('clear');
            const seals=sim.stage.pickups.filter(p=>p.kind==='seal'&&sim.collected.has(p.id)).length;
            this.nativeMenu({id:'clear',kind:'result',title:'FASE CONCLUÍDA!',text:`${sim.stage.name}\n${formatTime(sim.elapsed)} · ${sim.coins} LARANJAS${sim.stage.boss?'':` · ${seals}/3 SELOS`}`,
                detail:!sim.recordEligible?'TEMPO PARCIAL · SEM RECORDE':medals.map(m=>DELICIA_MEDALS[m as keyof typeof DELICIA_MEDALS]).join(' · '),choices:[
                {label:'SEGUIR VIAGEM',x:86,y:120,width:148,height:20,run:()=>sim.stage.id==='delicia-12'?this.showEnding():this.showMap()},
            ]});
        };
        if(sim.stage.outro.length)this.showDialogue(sim.stage.outro,finish,sim.stage);else finish();
    }
    private showEnding():void {
        this.showDialogue(DELICIA_ENDING,()=>{
            this.setScreen('ending');this.audio.music('orchard');
            this.nativeMenu({id:'ending',kind:'result',title:'ILHA CONCLUÍDA!',text:'As fontes voltaram a correr.',choices:[
                {label:'VOLTAR AO MAPA',x:86,y:120,width:148,height:20,run:()=>this.showMap()},
            ]});
        });
    }
    private openJournal(back:()=>void=()=>this.showMap(),page=0):void {
        this.journalReturn=back;this.setScreen('journal');
        const found=DELICIA_LORE.filter(lore=>this.store.save.lore.includes(lore.id));
        // Paginate prose on the native grid; every memory remains readable without scrolling over the game.
        const pages=found.flatMap(lore=>{
            const lines=wrapText(lore.text,272),parts=[];
            for(let i=0;i<lines.length;i+=8)parts.push({title:lore.title,text:lines.slice(i,i+8).join('\n'),source:lore.source});
            return parts;
        });
        const index=Math.max(0,Math.min(page,pages.length-1)),entry=pages[index];
        const choices:DeliciaMenuChoice[]=[];
        if(index>0)choices.push({label:'ANTERIOR',x:24,y:145,width:80,height:20,run:()=>this.openJournal(back,index-1)});
        if(index<pages.length-1)choices.push({label:'PRÓXIMA',x:112,y:145,width:80,height:20,run:()=>this.openJournal(back,index+1)});
        choices.push({label:'VOLTAR',x:215,y:145,width:80,height:20,run:()=>this.closeJournal()});
        this.nativeMenu({id:'journal',kind:'journal',title:entry?.title??'MEMÓRIAS',text:entry?.text??'Encontre as memórias espalhadas pela ilha.',
            detail:`${found.length}/${DELICIA_LORE.length} MEMÓRIAS${entry?` · PÁGINA ${index+1}/${pages.length}`:''}`,choices});
    }
    private closeJournal():void{this.journalReturn();}
    private persistSettings():void {
        const previousWarning=this.store.warning;
        if(!this.store.persist()){
            const message=this.panel.querySelector('.dl-save-warning p');
            if(message&&message.textContent!==this.store.warning)message.textContent=this.store.warning;
            if(this.settingsMessage?.textContent!==this.store.warning)this.announce(this.store.warning);
            if(this.menu&&!this.menu.choices.some(choice=>choice.label==='REVER PROGRESSO')){
                const back=this.menu;
                this.menu={...back,choices:[...back.choices,{label:'REVER PROGRESSO',x:176,y:1,width:140,height:20,run:()=>this.showSaveRecovery(back)}]};
            }
        }else{
            this.panel.querySelector('.dl-save-warning')?.remove();
            if(previousWarning&&this.settingsMessage?.textContent===previousWarning)this.announce('');
        }
    }
    private showSettings(back:()=>void=()=>this.showMap()):void {
        this.settingsReturn=back;this.setScreen('settings');
        this.settingsMessage=this.status;
        const prefs=this.options.preferences;
        const level=(key:'music'|'effects'|'voice')=>prefs?.[key]??(key==='voice'?this.voiceVolume:this.store.save[key]);
        const volume=(key:'music'|'effects'|'voice')=>{
            const current=level(key),value=current>=.99?0:Math.min(1,Math.round((current+.25)*100)/100);
            if(prefs){prefs[key]=value;this.options.savePreferences?.();}
            else if(key==='voice')this.voiceVolume=value;else{this.store.save[key]=value;this.persistSettings();}
            this.applyVolume();
        };
        const motion=()=>prefs?!prefs.shake:this.store.save.reducedMotion;
        this.nativeMenu({id:'settings',kind:'settings',title:'OPÇÕES',choices:[
            ...(['music','effects','voice'] as const).map((key,i)=>({label:()=>`${['MÚSICA','EFEITOS','VOZES'][i]}: ${Math.round(level(key)*100)}%`,
                x:62,y:55+i*23,width:196,height:20,run:()=>volume(key)})),
            {label:'EXPORTAR',ariaLabel:'Exportar progresso da Delícia',x:10,y:127,width:98,height:20,run:()=>this.exportSave()},
            {label:'IMPORTAR',ariaLabel:'Importar progresso da Delícia',x:112,y:127,width:98,height:20,run:()=>this.importSave()},
            {label:()=>`TREMOR: ${motion()?'NÃO':'SIM'}`,ariaLabel:()=>`Sempre reduzir movimento: ${motion()?'ativado':'desativado'}. ${this.systemMotion?.matches?'Redução ativa pelo sistema.':'Tremores e animações seguem o sistema.'}`,
                x:214,y:127,width:96,height:20,run:()=>{if(prefs){prefs.shake=!prefs.shake;this.options.savePreferences?.();}else{this.store.save.reducedMotion=!this.store.save.reducedMotion;this.persistSettings();}this.invalidatePausedPaint();}},
            {label:'CONTROLES',x:10,y:153,width:98,height:20,run:()=>this.showControls()},
            {label:'VOLTAR',x:114,y:153,width:92,height:20,run:()=>this.settingsReturn()},
            {label:'MEMÓRIAS',x:214,y:153,width:96,height:20,run:()=>this.openJournal(()=>this.showSettings(back))},
        ]});
    }
    private showControls():void{
        const back=this.settingsReturn;
        this.nativeMenu({id:'controls',kind:'journal',title:'CONTROLES',back:()=>this.showSettings(back),text:[
            'MOVER: SETAS / A D · DIRECIONAL',
            'PULAR: ESPAÇO / W / Z · A / ×',
            'CORRER: SHIFT / X · X / □',
            'SENTADA: S / BAIXO · LB / BAIXO',
            'SEMENTE: J · B / ○',
            'REBATER: Q · Y / △',
            'ABRIR FONTE: E · RB',
            'PAUSA: ESC · MENU   SOM: M',
        ].join('\n'),detail:'AJUDA: MAIS VIDA, SEM RECORDES OU MEDALHAS.',choices:[
            {label:()=>`AJUDA: ${this.store.save.assists?'SIM':'NÃO'}`,ariaLabel:()=>`Mais vida e avisos longos: ${this.store.save.assists?'ativados':'desativados'}. Vale na próxima fase. Desativa recordes e medalhas.`,
                x:24,y:145,width:150,height:20,run:()=>{this.store.save.assists=!this.store.save.assists;this.persistSettings();if(!this.store.warning)this.announce('Ajuda vale na próxima fase. Desativa recordes e medalhas.');}},
            {label:'VOLTAR',x:215,y:145,width:80,height:20,run:()=>this.showSettings(back)},
        ]});
    }
    private exportSave():void{const url=URL.createObjectURL(new Blob([JSON.stringify(this.store.save,null,2)],{type:'application/json'})),a=element('a');a.href=url;a.download='feka-imperio-delicia-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
    private importSave():void{
        this.saveImportCleanup?.();if(this.disposed||this.screen!=='settings')return;
        const input=element('input');input.type='file';input.accept='.json';input.hidden=true;
        let active=true,reading=false;
        const cleanup=()=>{active=false;input.onchange=null;input.oncancel=null;input.remove();if(this.saveImportCleanup===cleanup)this.saveImportCleanup=undefined;};
        const isActive=()=>active&&!this.disposed&&this.screen==='settings'&&this.saveImportCleanup===cleanup;
        this.saveImportCleanup=cleanup;this.root.append(input);input.oncancel=cleanup;
        input.onchange=async()=>{
            if(!isActive()||reading)return;reading=true;
            const file=input.files?.[0];if(!file){cleanup();return;}
            if(!(file.size<1_000_000)){cleanup();this.announce('Escolha um arquivo de progresso válido.');return;}
            let imported=false;
            try{
                const raw=await file.text();if(!isActive())return;
                imported=this.store.import(raw);
            }catch{
                if(isActive())this.announce('Arquivo inválido. Progresso atual mantido.');return;
            }finally{cleanup();}
            if(!imported){this.announce(this.store.warning);return;}
            // The durable commit already succeeded; optional audio cannot make the file invalid.
            try{this.applyVolume();}catch{}
            this.showMap();this.announce('Progresso importado.');
        };
        try{input.click();}catch{cleanup();this.announce('Não foi possível abrir o arquivo. Tente novamente.');}

    }
    private buildTouch():void{
        const directions=element('div','dl-touch-group'),actions=element('div','dl-touch-group dl-touch-actions');
        this.touch.append(directions,actions);
        for(const {key,name,x,y,width,height} of DELICIA_TOUCH_BUTTONS){
            const b=element('button','dl-touch-button');b.dataset.key=key;b.setAttribute('aria-label',name);b.type='button';
            Object.assign(b.style,{left:`${x/320*100}%`,top:`${y/180*100}%`,width:`${width/320*100}%`,height:`${height/180*100}%`});
            this.listen(b,'pointerdown',(e:PointerEvent)=>{
                if(this.disposed||this.screen!=='playing'||e.button!==0)return;e.preventDefault();this.holdInput(`pointer:${e.pointerId}`,key);
                try{b.setPointerCapture(e.pointerId);}catch{/* Window terminal events still release this owner. */}
            });
            this.listen(b,'keydown',(e:KeyboardEvent)=>{
                if(this.disposed||this.screen!=='playing'||(e.key!=='Enter'&&e.key!==' '))return;e.preventDefault();if(e.repeat)return;
                const physical=this.physicalKey(e);this.buttonKeys.set(physical,b);this.holdInput(`button:${physical}`,key);
            });
            this.listen(b,'keyup',(e:KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.keyUp(e);}});
            this.listen(b,'blur',()=>{for(const [physical,button] of this.buttonKeys)if(button===b){this.releaseInput(`button:${physical}`,true);this.buttonKeys.delete(physical);}});
            this.listen(b,'pointerup',(e:PointerEvent)=>this.releaseInput(`pointer:${e.pointerId}`));
            for(const event of ['pointercancel','lostpointercapture'])this.listen(b,event,(e:PointerEvent)=>this.releaseInput(`pointer:${e.pointerId}`,true));
            (key.startsWith('arrow')?directions:actions).append(b);
        }
    }
    dispose():void{if(this.disposed)return;this.disposed=true;this.saveImportCleanup?.();this.stopFrames();this.cleanups.forEach(fn=>fn());this.cleanups=[];this.audio.dispose();this.art.dispose();this.presentation.dispose();this.resetInput();this.root.remove();
        const globals=window as unknown as {deliciaGame?:DeliciaApp};if(globals.deliciaGame===this)delete globals.deliciaGame;
    }

}
