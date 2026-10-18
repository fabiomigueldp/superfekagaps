import { WorldGame } from '../WorldGame';
import { BossEncounter } from '../BossEncounter';
import { HypotheticalGuard } from './HypotheticalGuards';
import type { WorldLevel, WorldObjects } from '../WorldPhysics';
import type { Rect } from '../../types';
import { TileType } from '../../constants';
import type { AdventureStage } from '../types';
import { clamp } from '../types';
import { pixelText } from '../../graphics/BitmapFont';
import { drawWorldResult } from '../WorldSceneUI';
import { workshopPanel, workshopButton, WORKSHOP_UI } from '../WorldWorkshopUI';
import { HYPOTHETICAL, HypotheticalModel, type HypotheticalAct } from './HypotheticalModel';
import { hypotheticalStage, hypotheticalWave } from './HypotheticalStage';
import { drawHypotheticalBackground, drawHypotheticalCombat, drawHypotheticalGuard, drawHypotheticalObjects, drawHypotheticalTerrain } from './HypotheticalArt';
import { HypotheticalAudio } from './HypotheticalAudio';

export class HypotheticalEncounter extends BossEncounter {
    readonly model: HypotheticalModel;
    livingGuards = 0;
    private collapsedColumns=0;
    constructor(act: HypotheticalAct, health: number) {
        super('J1'); this.character = 'yasmin'; this.model = new HypotheticalModel(act, health); this.sync();
    }
    private sync() {
        const b=this.model,body=b.vulnerable?b.weakpoint:b.body;
        this.x=body.x;this.y=body.y;this.width=body.width;this.height=body.height;
        this.health=b.health;this.maxHealth=HYPOTHETICAL.health;this.timer=b.age*HYPOTHETICAL.step;
        // The bonus encounter ends in its own receipt; it must never unlock a campaign stage.
        this.phase=b.vulnerable?'open':b.state==='tell'||b.state==='turn'||b.state==='reload'?'warning':b.state==='attack'?'attack':b.state==='hurt'?'hurt':'rest';
    }
    override update(dt:number,p:Rect,o:WorldObjects,level:WorldLevel) {
        for(const e of o.events)if(e.kind==='switch')this.model.arm(e.x<160?0:1);
        this.model.update(dt,p,this.livingGuards);this.sync();
        if(this.model.nextAct||this.model.won)o.barrels=[];
        if(this.model.act==='chase'){
            const edge=Math.min(level.data.width,Math.max(0,Math.floor((this.model.x-78)/16)));
            while(this.collapsedColumns<edge){
                for(let row=13;row<level.data.height;row++)level.data.tiles[row][this.collapsedColumns]=TileType.EMPTY;
                this.collapsedColumns++;
            }
            // Terraces are fixed to the bridge, so they lose both art and collision with their footing.
            for(let i=o.bodies.length-1;i>=0;i--){
                const body=o.bodies[i];
                if(body.id.startsWith('chase-terrace-')&&body.x<edge*16)o.bodies.splice(i,1);
            }
        }
        this.impact=this.model.events.some(e=>e==='slam'||e==='snare');
        this.impactPoint={x:this.model.x,y:HYPOTHETICAL.floor};this.danger=null;this.released=false;
    }
    override contact(p:Rect,previous:Rect,falling:boolean) { const hit=this.model.contact(p,previous,falling);this.sync();return hit; }
    override get shockWarning(){return this.model.act==='siege'&&this.model.events.includes('warning')||this.model.state==='roar'&&this.model.age===0;}
    override get name(){return 'F. HIPOTETICO';}
    override get hint(){return this.model.hint;}
}

/** Full encounter hosted by WorldGame: native Feka, terrain, equipment, enemies, pause, input and sound. */
export class HypotheticalGame extends WorldGame {
    act:HypotheticalAct='chase';
    private encounter!:HypotheticalEncounter;
    private retryHealth:number=HYPOTHETICAL.health;
    private entranceTicks=0;
    private transitionTicks=0;
    private attemptDeaths=0;
    private totalTicks=0;
    private exiting=false;
    private readonly weaponAudio=new HypotheticalAudio(()=>{
        const route=this.audio.getEffectsRoute();
        return route?{...route,enabled:route.enabled&&this.audio.preferences.effects>0&&this.state==='playing'&&!this.player.data.isDead}:null;
    });
    readonly status:HTMLElement;
    constructor(canvas:HTMLCanvasElement,private readonly exitEncounter:()=>void=()=>{}) {
        super(canvas,true);
        this.addCleanup(()=>this.weaponAudio.dispose());
        this.status=document.createElement('p');this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');
        this.status.style.cssText='position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
        document.body.append(this.status);this.addCleanup(()=>this.status.remove());
        try {
            this.art.arena=()=>{};this.art.genericStructures=false;
            this.art.background=(c,_island,cx,cy)=>drawHypotheticalBackground(c,this.fight,cx,cy,this.renderer.reducedMotion);
            this.art.terrain=(c,l,_island,cx,cy)=>drawHypotheticalTerrain(c,l,this.fight,cx,cy);
            this.art.objects=(c,o,cx,cy)=>drawHypotheticalObjects(c,o,this.fight,cx,cy);
            this.art.boss=(c,_b,cx,cy)=>drawHypotheticalCombat(c,this.fight,cx,cy,this.renderer.reducedMotion);
            this.art.foe=(c,e,cx,cy)=>drawHypotheticalGuard(c,e,cx,cy,this.renderer.reducedMotion);
            this.tutorial.observe=()=>{};
            this.load('hipotetico-chase');
            this.listen(window,'keydown',e=>{
                if(e.repeat||this.isDisposed)return;
                if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Shift','a','d','w','s','x','z','r','R','Enter','m','M'].includes(e.key))this.audio.unlock();
                if(e.key==='Enter'&&this.fight.won&&this.state==='playing'){this.replay();e.preventDefault();}
                if((e.key==='r'||e.key==='R')&&this.state==='playing'&&!this.fight.won){this.load(this.stage.id,true);e.preventDefault();}
            });
            this.listen(canvas,'pointerdown',e=>{
                if(!this.resultReady||this.state!=='playing')return;
                const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*320/r.width,y=(e.clientY-r.top)*180/r.height;
                if(x>=80&&x<=240&&y>=151&&y<=173)this.replay();
            });
            this.enableGamepadControls();
            document.title='Super Feka Gaps · Flávio Bolsonaro Hipotético';
        } catch(error) {this.dispose();throw error;}
    }
    get fight(){return this.encounter.model;}
    private get encounterHint(){
        const b=this.fight;
        if(this.act!=='siege'||b.marks.length||b.waveReady||b.nextAct)return b.hint;
        if(this.foes.some(e=>!e.dead&&e.phase==='stunned'))return 'SEM CAPACETE! SALTE DE NOVO';
        const thrower=this.foes.find(e=>!e.dead&&e.spec.kind==='loader'&&e.phase==='warning');
        if(thrower){
            const pair=thrower instanceof HypotheticalGuard&&thrower.comboLength===2?`${thrower.comboStep+1}/2 `:'';
            return thrower.highThrow?`BARRIL ${pair}ALTO! OBSERVE O ARCO`:`BARRIL ${pair}BAIXO! USE AS SACADAS`;
        }
        if(this.foes.some(e=>e instanceof HypotheticalGuard&&!e.dead&&e.spec.kind==='minion'&&e.comboStep===1&&['warning','attack'].includes(e.phase)))return 'SEGUNDA ESTOCADA! SALTE OU CRUZE ATRAS';
        if(this.foes.some(e=>!e.dead&&e.spec.kind==='charger'))return 'ARIETE: SENTADA OU ATAQUE AO FREAR';
        return b.wave===1?'PULE. SENTADA QUEBRA A ARMADURA':'CRUZE OS BARRIS E ATAQUE A SACADA';
    }
    get resultReady(){return this.fight.won&&this.fight.age>=60;}
    get receipt(){return {act:this.act,phase:this.fight.phaseNumber,health:this.fight.health,won:this.fight.won,deaths:this.attemptDeaths,ticks:this.totalTicks};}
    replay(){this.act='chase';this.retryHealth=HYPOTHETICAL.health;this.totalTicks=0;this.attemptDeaths=0;this.load('hipotetico-chase');}
    override load(_id:string,resume=false,_custom?:AdventureStage) {
        if(this.isDisposed)return;
        this.weaponAudio?.cancel();
        if(!resume){this.act='chase';this.retryHealth=HYPOTHETICAL.health;}
        const stage=hypotheticalStage(this.act);
        super.load(stage.id,false,stage);
        this.encounter=new HypotheticalEncounter(this.act,this.retryHealth);this.boss=this.encounter;
        this.player.data.hasHelmet=true;this.player.data.isGrounded=true;this.player.data.respawnRevealTimer=0;
        this.camera.x=0;this.camera.y=64;this.entranceTicks=0;this.transitionTicks=0;
        this.input.reset();
    }
    private nextAct() {
        this.act=this.act==='chase'?'siege':'duel';this.retryHealth=HYPOTHETICAL.health;
        this.load(`hipotetico-${this.act}`,true);this.audio.sfx('checkpoint');
    }
    override update(dt:number) {
        if(this.isDisposed||!Number.isFinite(dt)||dt<=0)return;
        if(this.state==='map'||this.state==='title'||this.state==='intro'){
            if(!this.exiting){this.exiting=true;this.exitEncounter();}return;
        }
        const before=this.fight.tick,dead=this.player.data.isDead,wasWon=this.fight.won;
        this.encounter.livingGuards=this.foes.filter(e=>!e.dead).length;
        super.update(dt);
        this.weaponAudio.sync();
        if(wasWon&&this.resultReady&&this.state==='playing'&&this.input.getState().jumpPressed){this.replay();return;}
        if(!dead&&this.player.data.isDead){this.attemptDeaths++;this.fight.cancelAttacks();}
        if(this.player.data.isDead||this.state!=='playing')return;
        const steps=Math.max(0,this.fight.tick-before);
        if(!steps)return;
        if(!wasWon)this.totalTicks+=steps;
        if(this.fight.health===6||this.fight.health===3)this.retryHealth=this.fight.health;
        if(this.fight.waveReady){
            this.entranceTicks+=steps;
            if(this.entranceTicks>=60){
                this.foes=this.foes.filter(e=>!e.dead);
                this.foes.push(...hypotheticalWave(this.fight.wave,this.player.data.position.x).map(s=>new HypotheticalGuard(s,this.fight.wave,()=>this.foes)));
                this.fight.consumeWave();this.entranceTicks=0;
                // A single helmet in the last wave rewards movement without trivializing the duel.
                if(this.fight.wave===3)this.stage.pickups.push({id:'hipotetico:siege:helmet',kind:'helmet',x:62,y:163});
            }
        }
        for(const event of this.fight.events){
            if(event==='shot'||event==='impact'||event==='reload'||event==='distant-shot'||event==='distant-hit')this.weaponAudio.play(event);
            if(event==='step'&&this.fight.tick%3===0)this.audio.sfx('land');
            if(event==='break')this.audio.sfx('break');
            if(event==='won')this.audio.sfx('checkpoint');
        }
        if(this.fight.nextAct){this.transitionTicks+=steps;if(this.transitionTicks>=60)this.nextAct();}
        if(this.act==='chase')this.camera.x=clamp(this.player.data.position.x-132,0,1280);
        else this.camera.x=0;
        // Keep the complete jump arc visible without shaking the backdrop vertically.
        this.camera.y=clamp(Math.min(64,this.player.data.position.y-38),0,64);
    }
    protected override renderEncounterHud(c:CanvasRenderingContext2D) {
        const b=this.fight;
        workshopPanel(c,0,0,320,31,false,true);
        pixelText(c,'FLAVIO HIPOTETICO',7,5,WORKSHOP_UI.paper);
        pixelText(c,this.act==='chase'?'FUGA':this.act==='siege'?`CERCO ${b.wave}/3`:`FASE ${b.phaseNumber}/3`,121,5,WORKSHOP_UI.light);
        if(b.chaining)for(let i=0;i<b.chainLength;i++){
            const x=190-b.chainLength*7+i*7;
            c.fillStyle=i===b.chainStep?'#dfad56':'#607487';c.fillRect(x,6,5,5);
            if(i!==b.chainStep){c.fillStyle=WORKSHOP_UI.ink;c.fillRect(x+1,7,3,3);}
        }
        if(this.act==='duel')for(let i=0;i<9;i++){
            c.fillStyle=i<b.health?'#dfad56':'#435969';c.fillRect(194+i*9,6,6,5);
            if(i===2||i===5){c.fillStyle=WORKSHOP_UI.paper;c.fillRect(201+i*9,5,1,7);}
        }
        if(this.player.data.hasHelmet)this.renderer.drawHelmet(280,3,c);
        pixelText(c,'II',306,5,WORKSHOP_UI.paper);
        pixelText(c,this.encounterHint,7,20,WORKSHOP_UI.paper);
    }
    override render() {
        if(this.isDisposed)return;
        super.render();
        const b=this.fight;
        if(this.state==='playing'){
            const c=this.renderer.getContext();
            if(this.resultReady){
                drawWorldResult(c,'HIPOTESE DERRUBADA','FLAVIO BOLSONARO HIPOTETICO',`${Math.floor(this.totalTicks/60)}S · ${this.attemptDeaths} QUEDAS`,'ENTER: REJOGAR · ESC: MENU');
                workshopButton(c,'REJOGAR',80,151,160,22,true);
                this.renderer.present();
            }else if(b.tick<110){
                if(this.act==='chase')pixelText(c,'FLAVIO BOLSONARO HIPOTETICO',160,60,'#ffedbf',1,'center');
                pixelText(c,this.act==='chase'?'I · A PONTE DO IMPOSSIVEL':this.act==='siege'?'II · CERCO AO PATIO':'III · O ULTIMO LACRE',160,72,'#ffedbf',1,'center');
                if(this.act==='chase')pixelText(c,'FANTASIA SATIRICA',160,83,'#d2c6b1',1,'center');
                this.renderer.present();
            }
        }
        const status=`Flávio Bolsonaro Hipotético. ${this.act==='chase'?'Perseguição':this.act==='siege'?'Cerco':`Confronto, fase ${b.phaseNumber}`}. ${this.state==='paused'?'Pausado.':this.encounterHint} ${b.health} lacres. Setas: mover; Shift: correr; Espaço: pular; baixo no ar: sentada; Esc: pausa; R: retomar o trecho.`;
        if(this.status.textContent!==status)this.status.textContent=status;
    }
}
