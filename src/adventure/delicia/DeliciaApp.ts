import { ALL_DELICIA_STAGES, DELICIA_ASSETS, DELICIA_ENDING, DELICIA_LORE, DELICIA_STAGES, deliciaStageById, type DeliciaStage, type SceneLine } from './DeliciaContent';
import { DeliciaStore, completeDeliciaStage, deliciaUnlocked, awardDeliciaMedals, DELICIA_MEDALS } from './DeliciaProgress';
import { DeliciaSimulation, type DeliciaInput } from './DeliciaSimulation';
import { DeliciaAudio } from './DeliciaAudio';
import { DeliciaArt } from './DeliciaArt';
import { DELICIA_MAP_IMAGE, DELICIA_MAP_METADATA } from './DeliciaIsland';
import { ART } from '../../graphics/palette';
import { panel as pixelPanel, pixelText, textWidth, wrapText } from '../../graphics/BitmapFont';
import { button, element, formatTime, heading, lettering, worldLink } from './DeliciaUI';
import './delicia.css';
type Screen='title'|'map'|'menu'|'playing'|'pause'|'dialogue'|'clear'|'journal'|'settings'|'ending'|'dead';
export class DeliciaApp {
    readonly store:DeliciaStore;readonly audio=new DeliciaAudio();readonly art=new DeliciaArt();
    readonly root=element('main','delicia');readonly surface=element('section','dl-surface');readonly canvas=element('canvas','dl-canvas');
    readonly hud=element('div','dl-hud');readonly panel=element('section','dl-panel');readonly status=element('p','dl-status');
    readonly playfield=element('div','dl-playfield');
    readonly touch=element('div','dl-touch');screen:Screen='title';sim:DeliciaSimulation|null=null;
    private ctx:CanvasRenderingContext2D;private frame=0;private last=0;private accumulator=0;private disposed=false;
    private held=new Set<string>();private pressed=new Set<string>();private released=new Set<string>();private sources=new Map<number,string>();
    private lines:readonly SceneLine[]=[];private lineIndex=0;private dialogueDone:()=>void=()=>{};
    private journalReturn:()=>void=()=>this.showMap();private settingsReturn:()=>void=()=>this.showMap();
    private listOpen=false;private settingsMessage?:HTMLParagraphElement;
    private mapNodes:Record<string,{x:number;y:number}>={};private mapSelection='delicia-1';private toast='';private toastTime=0;private shake=0;private hudKey='';
    private cleanups:(()=>void)[]=[];private mapCanvas?:HTMLCanvasElement;private mapControls:HTMLButtonElement[]=[];
    private hitStop=0;private zoneBanner='';private zoneBannerTime=0;private gamepadPause=false;
    private menuPad=new Set<string>();
    private padMenuLatch=new Set<string>();
    constructor(host:HTMLElement=document.body){
        if(navigator.maxTouchPoints>0)this.root.classList.add('dl-has-touch');
        let storage:Storage|null=null;try{storage=localStorage;}catch{}this.store=new DeliciaStore(storage);this.mapSelection=this.store.save.selected;
        this.canvas.width=960;this.canvas.height=540;this.canvas.tabIndex=0;this.canvas.setAttribute('aria-label','Feka na ilha da Delícia. Setas movem, Espaço pula, Shift dá impulso, S dá sentada, J lança sementes, Q rebate e E abre válvulas.');
        this.ctx=this.canvas.getContext('2d',{alpha:false})!;this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');
        this.hud.hidden=true;this.touch.hidden=true;this.playfield.append(this.canvas,this.hud);this.surface.append(this.playfield,this.panel,this.touch);this.root.append(this.surface,this.status);host.append(this.root);
        this.audio.setVolume(this.store.save.music,this.store.save.effects);this.canvas.hidden=true;this.buildTouch();this.showTitle();
        this.listen(window,'keydown',this.keyDown);this.listen(window,'keyup',this.keyUp);this.listen(window,'blur',()=>this.loseFocus());this.listen(document,'visibilitychange',()=>{if(document.hidden)this.loseFocus();});
        this.listen(this.canvas,'pointerdown',()=>this.canvas.focus({preventScroll:true}));this.listen(window,'pagehide',()=>this.dispose());
        this.listen(window,'resize',()=>{if(this.screen==='map')this.fitMapTitle();});
        void this.art.load();void fetch(DELICIA_MAP_METADATA).then(r=>r.ok?r.json():null).then((data:unknown)=>{
            if(this.disposed||!data||typeof data!=='object')return;const nodes=(data as {nodes?:unknown}).nodes;
            if(nodes&&typeof nodes==='object')for(const s of DELICIA_STAGES){const p=(nodes as Record<string,unknown>)[s.id] as {x?:unknown;y?:unknown};if(p&&typeof p.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)this.mapNodes[s.id]={x:p.x,y:p.y};}
            if(this.screen==='map')this.showMap(this.mapSelection);
        }).catch(()=>{});
        this.frame=requestAnimationFrame(this.loop);document.title='Império da Delícia · Super Feka Gaps World';
        if((import.meta as ImportMeta & {env:{DEV:boolean}}).env.DEV)(window as unknown as {deliciaGame:DeliciaApp}).deliciaGame=this;
    }
    private listen<E extends Event>(target:EventTarget,event:string,handler:(event:E)=>void):void{const listener:EventListener=e=>handler(e as E);target.addEventListener(event,listener);this.cleanups.push(()=>target.removeEventListener(event,listener));}
    private keyDown=(event:KeyboardEvent):void=>{
        const key=event.key.toLowerCase();if(this.disposed)return;
        if(event.repeat){if(this.screen!=='playing'&&(key==='enter'||key===' '))event.preventDefault();return;}
        if(key==='escape'){event.preventDefault();this.goBack();return;}
        const editable=(event.target as HTMLElement)?.closest('input,textarea,select');if(editable){if(key==='tab')this.menuKeyboard(event);return;}
        const active=(this.screen==='playing'&&!(event.target as HTMLElement)?.closest('button,a,summary'))||event.target===this.canvas;
        if(['arrowleft','arrowright','arrowup','arrowdown',' ','shift','j','q','e','s','a','d','w','z','x'].includes(key)&&active){event.preventDefault();if(!this.held.has(key))this.pressed.add(key);this.held.add(key);}
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
    private keyUp=(event:KeyboardEvent):void=>{const key=event.key.toLowerCase();this.held.delete(key);this.released.add(key);};
    private goBack():void {
        if(this.screen==='playing')this.pause();else if(this.screen==='pause')this.resume();else if(this.screen==='dialogue')this.advanceDialogue();else if(this.screen==='journal')this.closeJournal();else if(this.screen==='settings')this.settingsReturn();else if(this.screen==='menu')this.showMap();else if(this.screen==='map'){if(this.listOpen)this.toggleStageList();else this.showMenu();}
    }
    private loseFocus():void{this.held.clear();this.pressed.clear();this.sources.clear();if(this.screen==='playing')this.pause();}
    private input():DeliciaInput{
        const down=(...keys:string[])=>keys.some(k=>this.held.has(k)),tap=(...keys:string[])=>keys.some(k=>this.pressed.has(k));
        return{left:down('arrowleft','a','pad-left'),right:down('arrowright','d','pad-right'),jump:down(' ','w','z','arrowup','pad-jump'),jumpPressed:tap(' ','w','z','arrowup','pad-jump'),jumpReleased:[' ','w','z','arrowup','pad-jump'].some(k=>this.released.has(k)),dash:tap('shift','x','pad-dash'),pound:tap('s','arrowdown','pad-pound'),seed:tap('j','pad-seed'),parry:tap('q','pad-parry'),interact:tap('e','pad-interact')};
    }
    private pollGamepad():void {
        let pad:Gamepad|undefined;try{pad=Array.from(navigator.getGamepads?.()??[]).find((p):p is Gamepad=>!!p&&p.mapping==='standard');}catch{}
        const down=(i:number)=>!!pad?.buttons[i]?.pressed,wasMenu=this.screen!=='playing';
        const menuKeys:Record<string,boolean>={up:(pad?.axes[1]??0)<-.5||down(12),down:(pad?.axes[1]??0)>.5||down(13),left:(pad?.axes[0]??0)<-.5||down(14),right:(pad?.axes[0]??0)>.5||down(15),accept:down(0),back:down(1)};
        const taps=new Set(Object.keys(menuKeys).filter(key=>menuKeys[key]&&!this.menuPad.has(key)));this.menuPad=new Set(Object.keys(menuKeys).filter(key=>menuKeys[key]));
        if(this.screen!=='playing'){
            if(taps.has('back'))this.goBack();
            else if(this.screen==='map'&&!this.listOpen){
                const delta=taps.has('left')||taps.has('up')?-1:taps.has('right')||taps.has('down')?1:0;
                if(delta){const i=Math.max(0,DELICIA_STAGES.findIndex(s=>s.id===this.mapSelection));this.selectMap(DELICIA_STAGES[(i+delta+DELICIA_STAGES.length)%DELICIA_STAGES.length].id);this.focusMapPin();}
                if(taps.has('accept')){const focused=document.activeElement as HTMLElement;if(focused?.closest('.dl-map-tools'))focused.click();else this.loadStage(this.mapSelection);}
            }else{
                const range=document.activeElement as HTMLInputElement;
                if(range?.type==='range'&&(taps.has('left')||taps.has('right'))){taps.has('right')?range.stepUp():range.stepDown();range.dispatchEvent(new Event('input',{bubbles:true}));}
                if(taps.has('up')||taps.has('down'))this.moveMenuFocus(taps.has('down')?1:-1);
                if(taps.has('accept'))(document.activeElement as HTMLElement)?.click();
            }
        }
        const state:Record<string,boolean>={'pad-left':(pad?.axes[0]??0)<-.25||down(14),'pad-right':(pad?.axes[0]??0)>.25||down(15),'pad-jump':down(0),'pad-dash':down(1),'pad-seed':down(2),'pad-parry':down(3),'pad-pound':down(4)||down(13),'pad-interact':down(5)};
        for(const [key,active] of Object.entries(state)){
            if(wasMenu&&active)this.padMenuLatch.add(key);else if(!active)this.padMenuLatch.delete(key);
            if(this.padMenuLatch.has(key)){this.held.delete(key);continue;}
            if(active){if(!this.held.has(key))this.pressed.add(key);this.held.add(key);}else if(this.held.delete(key))this.released.add(key);
        }
        const pause=down(9);if(pause&&!this.gamepadPause){if(this.screen==='playing')this.pause();else if(this.screen==='pause')this.resume();else this.goBack();}this.gamepadPause=pause;
    }
    private loop=(now:number):void=>{
        if(this.disposed)return;const dt=this.last?Math.min(.05,(now-this.last)/1000):0;this.last=now;this.pollGamepad();
        if(this.screen==='playing'&&this.sim){
            if(this.hitStop>0){this.hitStop=Math.max(0,this.hitStop-dt);this.accumulator=0;}else this.accumulator+=dt;
            let first=true;while(this.accumulator>=1/120){this.step(1/120,first?this.input():{...this.input(),jumpPressed:false,jumpReleased:false,dash:false,pound:false,seed:false,parry:false,interact:false});this.accumulator-=1/120;first=false;if(this.screen!=='playing'||this.hitStop>0){this.accumulator=0;break;}}
            if(!first){this.pressed.clear();this.released.clear();}this.renderGame();
        }else if(this.screen==='map')this.paintMap(now/1000);
        else if(this.sim&&!this.canvas.hidden)this.renderGame();
        this.toastTime=Math.max(0,this.toastTime-dt);this.shake=Math.max(0,this.shake-dt);this.zoneBannerTime=Math.max(0,this.zoneBannerTime-dt);
        this.frame=requestAnimationFrame(this.loop);
    };
    private step(dt:number,input:DeliciaInput):void{
        const sim=this.sim!;sim.update(dt,input);
        for(const event of sim.events){
            if(event.kind==='zone'){this.zoneBanner=event.text??'';this.zoneBannerTime=3.5;continue;}
            if(event.kind==='echo'){this.notify(event.text??'');continue;}
            if(event.kind==='jet'){this.audio.effect('pressure',.35);continue;}
            if(event.kind==='collect'&&event.pickup){const p=event.pickup;this.audio.effect('collect',p.kind==='orange'?.4:1);if(p.kind!=='orange'&&p.kind!=='heart')this.store.collect(p.id,p.lore);if(p.kind==='memory'){const lore=DELICIA_LORE.find(l=>l.id===p.lore);this.notify('Memória encontrada: '+(lore?.title??'O eco da ilha'));}if(p.kind==='seal')this.notify('Selo encontrado.');}
            else if(event.kind==='checkpoint'){this.store.save.checkpoint={stage:sim.stage.id,index:sim.checkpoint,valves:[...sim.valves]};this.store.persist();this.audio.effect('collect');this.notify('Checkpoint salvo.');}
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
    private resetInput():void{this.held.clear();this.pressed.clear();this.released.clear();this.sources.clear();this.accumulator=0;}
    private setScreen(screen:Screen):void{
        this.screen=screen;this.root.dataset.screen=screen;this.panel.replaceChildren();this.panel.className='dl-panel';this.panel.hidden=false;
        this.panel.removeAttribute('role');this.panel.removeAttribute('aria-modal');this.panel.removeAttribute('aria-labelledby');
        this.hud.hidden=screen!=='playing'&&screen!=='dialogue';this.canvas.hidden=!['playing','pause','dialogue','dead','clear'].includes(screen);this.playfield.hidden=this.canvas.hidden;
        this.playfield.inert=screen!=='playing';
        this.touch.hidden=screen!=='playing';this.listOpen=false;this.settingsMessage=undefined;this.resetInput();
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
    private announce(message:string):void{this.status.textContent=this.settingsMessage?'':message;if(this.settingsMessage)this.settingsMessage.textContent=message;}
    private notify(message:string):void{this.toast=message;this.toastTime=3;this.announce(message);}
    showTitle():void {
        this.setScreen('title');this.audio.pause(false);this.panel.classList.add('dl-title');
        const image=element('img','dl-key-art');image.src=DELICIA_ASSETS+'world-concept-v2.webp';image.alt='';
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
    private saveWarning():void {
        if(this.store.warning){const warning=element('p','dl-save-warning',this.store.warning);warning.setAttribute('role','alert');this.panel.append(warning);}
    }
    showMap(id=this.store.save.selected):void {
        this.setScreen('map');this.audio.pause(false);this.audio.music('orchard');
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
        c.strokeStyle='#c6e7cf25';c.lineWidth=1;const t=this.store.save.reducedMotion?0:time;
        for(let row=0;row<20;row++){c.beginPath();for(let x=0;x<=960;x+=10){const y=row*38+Math.sin(x*.012+t*.6+row)*5;if(!x)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}
    }
    loadStage(id:string,retry=false):boolean{
        const stage=deliciaStageById(id);if(!stage||!deliciaUnlocked(id,this.store.save))return false;
        const saved=this.store.save.checkpoint;this.sim=new DeliciaSimulation(stage,this.store.save.assists,saved?.stage===id?saved.index:-1);this.hitStop=0;this.zoneBannerTime=0;this.hudKey='';
        if(saved?.stage===id)for(const valve of saved.valves)this.sim.valves.add(valve);
        for(const p of this.store.save.collected)this.sim.collected.add(p);
        this.audio.pause(false);void this.audio.unlock();this.audio.music(stage.boss?'guina':stage.biome==='orchard'||stage.biome==='harbor'?'orchard':'reservoir');
        this.setScreen('playing');this.panel.hidden=true;this.updateHud();this.canvas.focus({preventScroll:true});
        if(!retry&&!this.store.save.completed.includes(stage.id))this.showDialogue(stage.intro,()=>{this.setScreen('playing');this.panel.hidden=true;this.sim?.startBoss();this.canvas.focus();},stage);
        else this.sim.startBoss();this.announce(stage.name+'. '+stage.mechanic);return true;
    }
    private renderGame():void {
        const sim=this.sim;if(!sim)return;this.ctx.save();if(this.shake>0&&!this.store.save.reducedMotion){this.ctx.translate(Math.sin(sim.time*95)*this.shake*22,Math.cos(sim.time*71)*this.shake*15);}this.art.draw(this.ctx,sim,this.store.save.reducedMotion);this.ctx.restore();
        const scale=Math.max(2,Math.ceil(11*960/(Math.max(1,this.canvas.clientWidth)*7))),lineHeight=scale*11;
        if(this.toastTime>0){
            const lines=wrapText(this.toast,Math.floor(840/scale)),width=Math.max(...lines.map(line=>textWidth(line)))*scale+28,height=lines.length*lineHeight+18;
            pixelPanel(this.ctx,480-width/2,522-height,width,height,ART.ink,ART.rockLight);
            lines.forEach((line,i)=>pixelText(this.ctx,line,480,532-height+i*lineHeight,ART.paper,scale,'center'));
        }
        if(this.zoneBannerTime>0&&this.zoneBanner&&this.toastTime<=0){
            const c=this.ctx;c.save();c.globalAlpha=Math.min(1,this.zoneBannerTime);const lines=wrapText(this.zoneBanner,Math.floor(840/scale)),width=Math.max(...lines.map(line=>textWidth(line)))*scale+24,y=sim.boss?138:64;
            pixelPanel(c,480-width/2,y,width,lines.length*lineHeight+12,ART.ink,ART.rockLight);lines.forEach((line,i)=>pixelText(c,line,480,y+8+i*lineHeight,ART.goldLight,scale,'center'));c.restore();
        }
    }
    private updateHud():void {
        const sim=this.sim;if(!sim)return;const p=sim.player;
        const key=`${sim.stage.id}:${p.health}:${sim.coins}:${sim.valves.size}:${sim.boss?.hp}:${sim.boss?.phase}:${sim.boss?.cue}:${Math.round((sim.boss?.pressure??0)/5)}:${p.dashCooldown>0}:${p.parryCooldown>0}`;if(key===this.hudKey)return;this.hudKey=key;
        const focusPause=document.activeElement?.classList.contains('dl-pause-button');this.hud.replaceChildren();
        const stats=element('div','dl-hud-stats'),health=element('span','dl-health');health.setAttribute('role','img');health.setAttribute('aria-label',`${p.health} de ${sim.assists?6:4} vidas`);
        health.append(lettering('♥'.repeat(Math.max(0,p.health)),ART.redLight),lettering('♥'.repeat(Math.max(0,(sim.assists?6:4)-p.health)),ART.rock));
        const coins=element('span','dl-coins');coins.append(element('i','dl-orange'),lettering(String(sim.coins).padStart(2,'0'),ART.goldLight));coins.setAttribute('aria-label',`${sim.coins} laranjas`);
        stats.append(health,coins);
        if(!sim.boss&&sim.stage.valves.length){const valves=element('span','dl-valve-count');valves.append(lettering(`${sim.valves.size}/${sim.stage.valves.length}`,ART.tealLight));valves.title='Fontes abertas';valves.setAttribute('aria-label',`${sim.valves.size} de ${sim.stage.valves.length} fontes abertas`);stats.append(valves);}
        const controls=element('div','dl-hud-controls'),phase=element('span','dl-hud-stage');phase.append(lettering(sim.stage.optional?'EXTRA':String(sim.stage.number).padStart(2,'0'),ART.muted));phase.title=sim.stage.name;
        const pause=button('II',()=>this.pause(),'dl-button dl-pause-button');pause.setAttribute('aria-label','Pausar');pause.title='Pausar (Esc)';controls.append(phase,pause);this.hud.append(stats,controls);
        if(focusPause)pause.focus({preventScroll:true});
        if(sim.boss){
            const boss=sim.boss,group=element('div','dl-boss-hud'),label=element('span','dl-boss-label'),bar=element('progress','dl-boss-health');
            label.append(lettering(boss.character==='jaja'?'Jajá':'Guina',ART.goldLight));bar.max=boss.maxHp;bar.value=boss.hp;bar.setAttribute('aria-label',`Vida de ${boss.character==='jaja'?'Jajá':'Guina'}`);
            group.append(label,bar,element('span','dl-boss-phase',`${boss.phase}/3`),element('p','dl-boss-cue',boss.cue));
            if(boss.character==='guina'){const pressure=element('meter','dl-pressure');pressure.min=0;pressure.max=100;pressure.value=boss.pressure;pressure.setAttribute('aria-label','Pressão da armadura');group.append(element('span','dl-pressure-label',`Pressão ${Math.round(boss.pressure)}%`),pressure);}
            this.hud.append(group);
        }
    }
    private showDialogue(lines:readonly SceneLine[],done:()=>void,stage?:DeliciaStage):void {
        if(!lines.length){done();return;}this.setScreen('dialogue');this.lines=lines;this.lineIndex=0;this.dialogueDone=done;this.panel.classList.add('dl-dialogue');this.renderDialogue(stage);
    }
    private renderDialogue(_stage?:DeliciaStage):void {
        this.panel.replaceChildren();const line=this.lines[this.lineIndex],who=element('div','dl-speaker');who.append(heading(line.speaker,2));
        const text=line.text.toLowerCase(),voice=line.speaker==='Guina'?(text.includes('sem gap')?'guina-final':text.includes('deixar oco')?'guina-oco':text.includes('namora comigo')?'guina-namoro':''):line.speaker==='Jajá'?(text.includes('pressão da caneca')?'jaja-delicia':text.includes('acabei protegendo')?'jaja-promessa':''):'';
        this.audio.voice(voice);
        if(line.speaker==='Jajá'||line.speaker==='Guina'){const portrait=element('div','dl-portrait '+(line.speaker==='Guina'?'guina':'jaja'));portrait.setAttribute('role','img');portrait.setAttribute('aria-label',line.speaker);who.prepend(portrait);}
        const copy=element('div','dl-dialogue-copy'),actions=element('div','dl-dialogue-actions');
        actions.append(element('span','dl-muted',`${this.lineIndex+1}/${this.lines.length}`),button('Pular',()=>this.dialogueDone(),'dl-button dl-secondary'),button('Continuar',()=>this.advanceDialogue(),'dl-button dl-primary'));
        copy.append(element('p','',line.text),actions);this.panel.append(who,copy);this.announce(line.speaker+': '+line.text);
        this.panel.querySelector<HTMLButtonElement>('.dl-primary')?.focus({preventScroll:true});
    }
    private advanceDialogue():void{if(this.screen!=='dialogue')return;this.lineIndex++;if(this.lineIndex>=this.lines.length)this.dialogueDone();else this.renderDialogue(this.sim?.stage);}
    pause():void{if(this.screen!=='playing')return;this.pauseMenu();}
    private pauseMenu():void {
        this.setScreen('pause');this.audio.pause(true);this.menuPanel('Pausa');
        this.panel.append(button('Continuar',()=>this.resume(),'dl-button dl-primary'),button('Opções',()=>this.showSettings(()=>this.pauseMenu())),button('Memórias',()=>this.openJournal(()=>this.pauseMenu())),button('Voltar ao mapa',()=>this.showMap()));this.focusFirst();
    }
    private resume():void{if(this.screen!=='pause')return;this.setScreen('playing');this.panel.hidden=true;this.audio.pause(false);this.canvas.focus({preventScroll:true});}
    private showDeath():void {
        this.menuPanel('Fim de jogo');this.panel.append(button('Tentar de novo',()=>this.retry(),'dl-button dl-primary'),button('Voltar ao mapa',()=>this.showMap()));this.focusFirst();
    }
    private retry():void{if(this.sim)this.loadStage(this.sim.stage.id,true);}
    private clearStage():void {
        const sim=this.sim!;completeDeliciaStage(this.store.save,sim.stage.id,sim.elapsed,sim.recordEligible);const medals=awardDeliciaMedals(this.store.save,sim.stage.id,{eligible:sim.recordEligible,damage:sim.damageTaken,seals:sim.stage.pickups.filter(p=>p.kind==='seal'&&sim.collected.has(p.id)).length,seconds:sim.elapsed,parries:sim.parries});this.store.persist();this.audio.effect('victory');
        const finish=()=>{
            this.setScreen('clear');this.menuPanel('Fase concluída!');
            this.panel.append(element('p','dl-result',`${formatTime(sim.elapsed)} · ${sim.coins} laranjas${sim.stage.boss?'':` · ${sim.stage.pickups.filter(p=>p.kind==='seal'&&sim.collected.has(p.id)).length}/3 selos`}`));
            if(medals.length)this.panel.append(element('p','dl-medal-list',medals.map(m=>DELICIA_MEDALS[m as keyof typeof DELICIA_MEDALS]).join(' · ')));
            if(!sim.recordEligible)this.panel.append(element('small','dl-muted','Sem recorde nesta tentativa.'));
            this.panel.append(button(sim.stage.id==='delicia-12'?'Continuar':'Voltar ao mapa',()=>sim.stage.id==='delicia-12'?this.showEnding():this.showMap(),'dl-button dl-primary'),button('Jogar de novo',()=>this.loadStage(sim.stage.id,true)));this.focusFirst();
        };
        if(sim.stage.outro.length)this.showDialogue(sim.stage.outro,finish,sim.stage);else finish();
    }
    private showEnding():void {
        this.showDialogue(DELICIA_ENDING,()=>{
            this.setScreen('ending');this.menuPanel('Ilha concluída!');this.panel.append(element('p','','As fontes voltaram a correr.'),button('Voltar ao mapa',()=>this.showMap(),'dl-button dl-primary'),button('Memórias',()=>this.openJournal(()=>this.showMap())));this.audio.music('orchard');this.focusFirst();
        });
    }
    private openJournal(back:()=>void=()=>this.showMap()):void {
        this.journalReturn=back;this.setScreen('journal');this.panel.classList.add('dl-journal');
        const head=element('header','dl-section-head');head.append(heading('Memórias'),button('Voltar',()=>this.closeJournal(),'dl-button dl-small'));
        const found=DELICIA_LORE.filter(lore=>this.store.save.lore.includes(lore.id));
        this.panel.append(head,element('p','dl-muted',`${found.length}/${DELICIA_LORE.length} encontradas`));
        const entries=element('div','dl-lore-entries');
        DELICIA_LORE.forEach((lore,index)=>{
            if(!this.store.save.lore.includes(lore.id))return;const entry=element('details','dl-lore-entry');entry.open=found.length===1;
            const summary=element('summary');summary.append(element('span','dl-lore-number',String(index+1).padStart(2,'0')),element('span','',lore.title));
            entry.append(summary,element('small','dl-muted',lore.source),element('p','',lore.text));entries.append(entry);
        });
        this.panel.append(entries);this.focusFirst();
    }
    private closeJournal():void{this.journalReturn();}
    private showSettings(back:()=>void=()=>this.showMap()):void {
        this.settingsReturn=back;this.setScreen('settings');this.panel.classList.add('dl-settings');
        const head=element('header','dl-section-head');head.append(heading('Opções'),button('Voltar',()=>this.settingsReturn(),'dl-button dl-small'));this.panel.append(head);
        const audio=element('fieldset','dl-setting-group');audio.append(element('legend','','Som'));
        const mute=element('label','dl-setting');mute.append(element('span','','Ativado'));const muteInput=element('input');muteInput.type='checkbox';muteInput.checked=!this.audio.muted;
        muteInput.addEventListener('change',()=>{if(this.audio.muted===muteInput.checked)this.audio.toggleMute();void this.audio.unlock();});mute.append(muteInput);audio.append(mute);
        for(const key of ['music','effects'] as const){
            const label=element('label','dl-setting');label.append(element('span','',key==='music'?'Música':'Efeitos e vozes'));const range=element('input'),value=element('output','',`${Math.round(this.store.save[key]*100)}%`);
            range.type='range';range.min='0';range.max='1';range.step='.05';range.value=String(this.store.save[key]);
            range.addEventListener('input',()=>{this.store.save[key]=Number(range.value);value.value=`${Math.round(Number(range.value)*100)}%`;this.audio.setVolume(this.store.save.music,this.store.save.effects);this.store.persist();});label.append(range,value);audio.append(label);
        }
        this.panel.append(audio);
        const play=element('fieldset','dl-setting-group');play.append(element('legend','','Jogo'));
        for(const key of ['reducedMotion','assists'] as const){
            const label=element('label','dl-setting'),input=element('input');input.type='checkbox';input.checked=this.store.save[key];
            input.addEventListener('change',()=>{this.store.save[key]=input.checked;this.store.persist();});
            label.append(element('span','',key==='reducedMotion'?'Reduzir movimento':'Mais vida e avisos longos'),input);play.append(label);
            if(key==='assists'){const hint=element('small','dl-muted','Ajuda: vale na próxima fase. Desativa recordes e medalhas.');hint.id='dl-assists-hint';input.setAttribute('aria-describedby',hint.id);play.append(hint);}
        }
        this.panel.append(play);
        const controls=element('details','dl-options-details');controls.append(element('summary','','Controles'));
        const table=element('table','dl-controls-table'),caption=element('caption','dl-sr-only','Controles de teclado e controle de jogo'),thead=element('thead'),tr=element('tr');
        for(const label of ['Ação','Teclado','Controle']){const cell=element('th','',label);cell.scope='col';tr.append(cell);}thead.append(tr);table.append(caption,thead);
        const tbody=element('tbody');for(const row of [['Mover','← → / A D','Direcional'],['Pular','Espaço / W','A'],['Impulso','Shift / X','B'],['Sentada','↓ / S','LB'],['Semente','J','X'],['Rebater','Q','Y'],['Válvula','E','RB'],['Pausa','Esc','Menu']]){const tr=element('tr');row.forEach(text=>tr.append(element('td','',text)));tbody.append(tr);}table.append(tbody);controls.append(table);
        const progress=element('details','dl-options-details');progress.append(element('summary','','Progresso'));const actions=element('div','dl-save-actions');actions.append(button('Exportar',()=>this.exportSave()),button('Importar',()=>this.importSave()));progress.append(actions);
        this.settingsMessage=element('p','dl-save-message');this.settingsMessage.setAttribute('role','status');this.panel.append(controls,progress,this.settingsMessage);this.focusFirst();
    }
    private exportSave():void{const url=URL.createObjectURL(new Blob([JSON.stringify(this.store.save,null,2)],{type:'application/json'})),a=element('a');a.href=url;a.download='feka-imperio-delicia-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
    private importSave():void{
        const input=element('input');input.type='file';input.accept='.json';input.hidden=true;this.root.append(input);input.oncancel=()=>input.remove();input.onchange=async()=>{const file=input.files?.[0];try{if(file&&file.size<1_000_000){const raw=await file.text();if(this.disposed)return;if(this.store.import(raw)){this.audio.setVolume(this.store.save.music,this.store.save.effects);this.showMap();this.announce('Progresso importado.');}else this.announce(this.store.warning);}else this.announce('Escolha um arquivo de progresso válido.');}catch{this.announce('Arquivo inválido. Progresso atual mantido.');}finally{input.remove();}};input.click();
    }
    private buildTouch():void{
        const directions=element('div','dl-touch-group'),actions=element('div','dl-touch-group dl-touch-actions');
        this.touch.append(directions,actions);
        for(const [label,key,name] of [['←','arrowleft','Esquerda'],['→','arrowright','Direita'],['Semente','j','Semente'],['Rebater','q','Rebater'],['Abrir','e','Abrir'],['↓','s','Sentada'],['Impulso','shift','Impulso'],['↑',' ','Pular']]){
            const b=element('button','dl-touch-button');b.append(lettering(label,ART.paper,label.length===1?3:1));b.dataset.key=key;b.setAttribute('aria-label',name);b.type='button';
            b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);this.sources.set(e.pointerId,key);this.held.add(key);this.pressed.add(key);});
            b.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();this.held.add(key);this.pressed.add(key);}});
            b.addEventListener('keyup',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.held.delete(key);this.released.add(key);}});
            const release=(e:PointerEvent)=>{const action=this.sources.get(e.pointerId);this.sources.delete(e.pointerId);if(action&&![...this.sources.values()].includes(action)){this.held.delete(action);this.released.add(action);}};
            b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);(key.startsWith('arrow')?directions:actions).append(b);
        }
    }
    dispose():void{if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.frame);this.cleanups.forEach(fn=>fn());this.cleanups=[];this.audio.dispose();this.art.dispose();this.resetInput();this.root.remove();}
}
