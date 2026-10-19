import { WorldGame } from '../WorldGame';
import { BossEncounter } from '../BossEncounter';
import { HypotheticalGuard } from './HypotheticalGuards';
import { HypotheticalVanguard } from './HypotheticalVanguard';
import {drawBastionEdgeCue} from './HypotheticalGuardCues';
import type { HypotheticalBackdrop } from './HypotheticalBackdrop';
import type { WorldLevel, WorldObjects } from '../WorldPhysics';
import type { Rect } from '../../types';
import { TileType } from '../../constants';
import type { AdventureStage } from '../types';
import { clamp } from '../types';
import { pixelText } from '../../graphics/BitmapFont';
import { drawWorldResult } from '../WorldSceneUI';
import { workshopPanel, workshopButton, WORKSHOP_UI } from '../WorldWorkshopUI';
import { HYPOTHETICAL, HypotheticalModel, type HypotheticalAct } from './HypotheticalModel';
import { hypotheticalStage } from './HypotheticalStage';
import { SIEGE_SECTORS, SIEGE_WIDTH, siegeGarrison } from './HypotheticalSiege';
import { drawHypotheticalBackground, drawHypotheticalCombat, drawHypotheticalGuard, drawHypotheticalObjects, drawHypotheticalTerrain } from './HypotheticalArt';
import { HypotheticalAudio } from './HypotheticalAudio';
import {chaseCollapsedEdge} from './HypotheticalChaseDetails';
import { CHASE_WIDTH, CHASE_CHECKPOINT, CHASE_DISTRICTS } from './HypotheticalLayout';
import {ARRIVAL,arrivalFade,arrivalDeployment,arrivalLookAhead} from './HypotheticalArrival';

export class HypotheticalEncounter extends BossEncounter {
    readonly model: HypotheticalModel;
    livingGuards = 0;
    garrison: HypotheticalGuard[] = [];
    private collapsedColumns=0;
    constructor(act: HypotheticalAct, health: number, cleared = 0, chaseStart=0, arrivalSeen=false,backdrop?:HypotheticalBackdrop) {
        super('J1'); this.character = 'yasmin'; this.model = new HypotheticalModel(act, health, cleared,chaseStart,arrivalSeen,backdrop); this.sync();
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
        const cleared = this.model.route.cleared;
        if(this.model.act==='siege')this.livingGuards=this.garrison.filter(e=>!e.dead&&e.wave===cleared+1).length;
        this.model.update(dt,p,this.livingGuards);this.sync();
        if(this.model.act==='siege'){
            for(const [id,pose] of [['arrival-gate',this.model.arrival],['arrival-forecourt',this.model.forecourt]] as const){
                const entrance=o.bodies.find(body=>body.id===id);
                if(entrance){entrance.height=pose.height;entrance.active=entrance.height===0;}
            }
            for(const e of this.garrison)e.awake=e.wave===this.model.wave&&this.model.route.active;
            if(this.model.route.cleared>cleared)o.barrels=[];
            for(const [i] of SIEGE_SECTORS.entries()){
                const gate=o.bodies.find(b=>b.id===`siege-gate-${i}`);
                if(gate){gate.height=this.model.route.gateHeight(i);gate.active=gate.height===0;}
            }
        }
        if(this.model.nextAct||this.model.won)o.barrels=[];
        if(this.model.act==='chase'){
            const edge=Math.min(level.data.width,chaseCollapsedEdge(this.model.x)/16);
            while(this.collapsedColumns<edge){
                if(level.data.tiles[14][this.collapsedColumns]&&this.model.tick>1){
                    this.model.bridgeDebris.push({x:this.collapsedColumns*16,born:this.model.tick,material:Math.min(3,Math.floor(this.collapsedColumns*16/1120))});
                    if(this.model.bridgeDebris.length>18)this.model.bridgeDebris.shift();
                }
                for(let row=13;row<level.data.height;row++)level.data.tiles[row][this.collapsedColumns]=TileType.EMPTY;
                this.collapsedColumns++;
            }
            // The head breaks the first brace once Feka has cleared the whole deck.
            // Losing the bank is still unconditional: standing still cannot preserve an unsupported terrace.
            for(let i=o.bodies.length-1;i>=0;i--){
                const body=o.bodies[i];
                const struck=this.model.x+56>=body.x+5&&p.x>=body.x+body.width+10;
                if(body.id.startsWith('chase-terrace-')&&(body.x<edge*16||struck)){
                    if(this.model.tick>1){
                        this.model.terraceDebris.push({x:body.x,y:body.y,width:body.width,born:this.model.tick});
                        if(this.model.terraceDebris.length>4)this.model.terraceDebris.shift();
                    }
                    o.bodies.splice(i,1);
                }
            }
        }
        this.impact=this.model.events.some(e=>e==='slam'||e==='snare');
        this.impactPoint={x:this.model.act==='siege'&&this.model.events.includes('snare')
            ?SIEGE_SECTORS[Math.max(0,this.model.route.cleared-1)].gate:this.model.x,y:HYPOTHETICAL.floor};this.danger=null;this.released=false;
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
    private siegeCheckpoint=0;
    private chaseCheckpoint=0;
    private transitionTicks=0;
    private arrivalSeen=false;
    private attemptDeaths=0;
    private totalTicks=0;
    private exiting=false;
    private readonly guardImpacts=new WeakMap<HypotheticalGuard,number>();
    private readonly vanguardSounds=new WeakMap<HypotheticalVanguard,{swing:number;parry:number}>();
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
            this.art.objects=(c,o,cx,cy)=>drawHypotheticalObjects(c,o,this.fight,cx,cy,this.renderer.reducedMotion);
            this.art.boss=(c,_b,cx,cy)=>drawHypotheticalCombat(c,this.fight,cx,cy,this.renderer.reducedMotion);
            this.art.foe=(c,e,cx,cy)=>{
                const deployment=this.act==='siege'?arrivalDeployment(this.fight.arrivalTime,this.fight.arrivalSkipped):1;
                if(deployment===0)return;
                if(deployment<1){
                    c.save();c.beginPath();c.rect(e.x-cx-8,e.y+e.height-cy-30*deployment+1,e.width+16,30*deployment+2);c.clip();
                    drawHypotheticalGuard(c,e,cx,cy,this.renderer.reducedMotion);c.restore();return;
                }
                drawHypotheticalGuard(c,e,cx,cy,this.renderer.reducedMotion);
            };
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
        if(this.act==='siege'&&!b.arrival.ready){
            const t=b.arrivalTime;
            return t<90?'REFUGIO! A GRADE PROTEGE A PASSAGEM':t<200?'ELE VIROU PARA A RUA!'
                :t<ARRIVAL.firstRelease?'O ARSENAL ESTA CEDENDO!':t<=ARRIVAL.hold?'SIGA PELO PATIO PARA A PRACA'
                :t<480?'ABRIGUE-SE! OUTRA RAJADA!':t<574?'A GALERIA VAI DESABAR!':'PREPARE-SE: A GRADE VAI ABRIR';
        }
        if(this.act!=='siege'||b.marks.length||!b.route.active||b.nextAct)return b.hint;
        const patrol=this.foes.filter(e=>e instanceof HypotheticalGuard&&e.awake&&!e.dead);
        const visible=patrol.filter(e=>e.x+e.width>this.camera.x+4&&e.x<this.camera.x+316);
        if(!visible.length&&patrol.length){
            const closest=patrol.reduce((a,e)=>Math.abs(e.x-this.player.data.position.x)<Math.abs(a.x-this.player.data.position.x)?e:a);
            return closest.x<this.player.data.position.x?'PATRULHA A ESQUERDA. VOLTE AO POSTO':'PATRULHA A DIREITA. AVANCE COM CUIDADO';
        }
        const stunned=visible.find(e=>e.phase==='stunned');
        const elite=visible.find(e=>e instanceof HypotheticalVanguard);
        if(elite instanceof HypotheticalVanguard){
            const cover=visible.find(e=>e instanceof HypotheticalGuard&&e.coveringElite&&e.phase==='warning') as HypotheticalGuard|undefined;
            if(cover&&elite.exposed)return 'ABERTURA! CUIDADO COM O BARRIL';
            if(elite.exposed)return 'VANGUARDA EXPOSTO! SALTE OU USE A SENTADA';
            if(cover&&['warning','attack'].includes(elite.phase)){
                const move=elite.move==='vault'?'SALTO':elite.move==='sweep'?'VARREDURA':elite.move==='cross'?'CORTE DUPLO':'INVESTIDA';
                return `${move} + BARRIL ${cover.highThrow?'ALTO':'BAIXO'}! OBSERVE O ARCO`;
            }
            if(elite.move==='sweep'&&['warning','attack'].includes(elite.phase))return 'VARREDURA BAIXA! SALTE OU USE A SACADA';
            if(elite.move==='vault'&&['warning','attack'].includes(elite.phase))return 'SALTO MARCADO! SAIA DO POUSO E CONTRA-ATAQUE';
            if(elite.move==='cross'&&['warning','attack'].includes(elite.phase))return elite.strike?'SEGUNDO CORTE! CRUZE POR CIMA':'CORTE DUPLO! GUARDE ESPACO PARA O SEGUNDO';
            return elite.enraged?'INVESTIDA! CUIDADO COM A VARREDURA':'INVESTIDA! SALTE E ATAQUE PELAS COSTAS';
        }
        if(stunned)return stunned.spec.kind==='charger'?'TETO QUEBRADO! SALTE NO ARIETE':'SEM CAPACETE! SALTE DE NOVO';
        const vault=visible.find(e=>e instanceof HypotheticalGuard&&e.vaultTarget);
        if(vault instanceof HypotheticalGuard){
            if(vault.phase==='warning')return 'BATEDOR VAI SALTAR! SAIA DA MARCA';
            if(vault.phase==='attack')return 'SALTO COMPROMETIDO! CRUZE OU CONTRA-ATAQUE';
            if(vault.phase==='rest')return 'ELE POUSOU! ATAQUE ANTES DE REAGRUPAR';
        }
        const thrower=visible.find(e=>e.spec.kind==='loader'&&e.phase==='warning');
        if(thrower){
            const pair=thrower instanceof HypotheticalGuard&&thrower.comboLength===2?`${thrower.comboStep+1}/2 `:'';
            if(thrower instanceof HypotheticalGuard&&thrower.coveringCharge)return 'ARIETE + BARRIL! SALTE PARA A SACADA';
            return thrower.highThrow?`BARRIL ${pair}ALTO! OBSERVE O ARCO`:`BARRIL ${pair}BAIXO! USE AS SACADAS`;
        }
        if(visible.some(e=>e instanceof HypotheticalGuard&&e.longLunge&&['warning','attack'].includes(e.phase)))return 'PASSO LONGO! SALTE OU CRUZE ATRAS';
        if(b.wave===2&&Math.abs(this.player.data.position.x-836)<62
            &&!visible.some(e=>e.phase==='warning'||e.phase==='attack'))return 'MONTA-CARGAS: SUBA E FLANQUEIE A SACADA';
        if(visible.some(e=>e.spec.kind==='charger'))return 'ARIETE: QUEBRE O TETO OU ATAQUE AO FREAR';
        return b.wave===1?'BLINDADO: SENTADA, DEPOIS OUTRO SALTO':'CRUZE OS BARRIS E ATAQUE A SACADA';
    }
    get resultReady(){return this.fight.won&&this.fight.age>=60;}
    get receipt(){return {act:this.act,phase:this.fight.phaseNumber,health:this.fight.health,won:this.fight.won,deaths:this.attemptDeaths,ticks:this.totalTicks};}
    replay(){this.act='chase';this.arrivalSeen=false;this.retryHealth=HYPOTHETICAL.health;this.totalTicks=0;this.attemptDeaths=0;this.chaseCheckpoint=0;this.siegeCheckpoint=0;this.load('hipotetico-chase');}
    override load(_id:string,resume=false,_custom?:AdventureStage) {
        if(this.isDisposed)return;
        this.weaponAudio?.cancel();
        if(!resume){this.act='chase';this.arrivalSeen=false;this.retryHealth=HYPOTHETICAL.health;this.siegeCheckpoint=0;this.chaseCheckpoint=0;}
        const stage=hypotheticalStage(this.act);
        const backdrop=resume&&this.arrivalSeen&&this.act==='siege'&&this.encounter?.model.act==='siege'?this.encounter.model.backdrop:undefined;
        if(this.act==='chase'&&this.chaseCheckpoint)stage.level.playerSpawn.x=this.chaseCheckpoint/16;
        super.load(stage.id,false,stage);
        this.encounter=new HypotheticalEncounter(this.act,this.retryHealth,this.siegeCheckpoint,this.chaseCheckpoint,this.arrivalSeen,backdrop);this.boss=this.encounter;
        if(this.act==='siege'){
            this.foes=SIEGE_SECTORS.flatMap((s,i)=>i<this.siegeCheckpoint?[]:siegeGarrison(i).map(spec=>
                spec.id.endsWith(':vanguard')
                    ?new HypotheticalVanguard(spec,i+1,()=>this.foes,{left:s.origin+12,right:s.gate})
                    :new HypotheticalGuard(spec,i+1,()=>this.foes,{left:s.origin+12,right:s.gate})));
            this.encounter.garrison=this.foes as HypotheticalGuard[];
            for(const e of this.encounter.garrison)e.awake=false;
            this.player.data.position.x=this.fight.arrivalSkipped?this.fight.route.checkpoint:48;
            for(const [id,pose] of [['arrival-gate',this.fight.arrival],['arrival-forecourt',this.fight.forecourt]] as const){
                const entrance=this.objects.bodies.find(body=>body.id===id);
                if(entrance){entrance.height=pose.height;entrance.active=entrance.height===0;}
            }
            for(const [i] of SIEGE_SECTORS.entries()){
                const gate=this.objects.bodies.find(b=>b.id===`siege-gate-${i}`);
                if(gate){gate.height=this.fight.route.gateHeight(i);gate.active=gate.height===0;}
            }
        }
        this.player.data.hasHelmet=true;this.player.data.isGrounded=true;this.player.data.respawnRevealTimer=0;
        this.camera.x=this.act==='siege'?clamp(this.player.data.position.x-132,0,SIEGE_WIDTH-320)
            :this.act==='chase'?clamp(this.player.data.position.x-150,0,CHASE_WIDTH-320):0;this.camera.y=64;this.transitionTicks=0;
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
        const before=this.fight.tick,beforeArrival=this.fight.arrivalTime,dead=this.player.data.isDead,wasWon=this.fight.won;
        this.encounter.livingGuards=this.foes.filter(e=>!e.dead).length;
        super.update(dt);
        this.weaponAudio.sync();
        if(wasWon&&this.resultReady&&this.state==='playing'&&this.input.getState().jumpPressed){this.replay();return;}
        if(!dead&&this.player.data.isDead){this.attemptDeaths++;this.fight.cancelAttacks();}
        if(this.player.data.isDead||this.state!=='playing')return;
        const steps=Math.max(0,this.fight.tick-before);
        if(!steps)return;
        if(this.act==='siege'&&this.fight.arrivalTime>=ARRIVAL.release)this.arrivalSeen=true;
        if(this.act==='siege'&&!this.fight.arrivalSkipped){
            if([ARRIVAL.firstRelease,ARRIVAL.deployment].some(t=>beforeArrival<t&&this.fight.arrivalTime>=t))this.audio.sfx('switch');
            if(beforeArrival<ARRIVAL.release&&this.fight.arrivalTime>=ARRIVAL.release)this.audio.sfx('checkpoint');
        }
        if(this.act==='siege')for(const e of this.foes)if(e instanceof HypotheticalGuard&&!e.dead){
            const at=Math.max(e.impactAt,e.vaultLandedAt);
            if(Number.isFinite(at)&&at>(this.guardImpacts.get(e)??-Infinity)){
                this.guardImpacts.set(e,at);
                if(Math.abs(e.x-this.player.data.position.x)<220){
                    if(e instanceof HypotheticalVanguard)this.weaponAudio.play('guard-stomp');
                    else this.audio.sfx(e.spec.kind==='charger'?'barrelBreak':'land');
                }
            }
            if(e instanceof HypotheticalVanguard){
                const prior=this.vanguardSounds.get(e)??{swing:-Infinity,parry:-Infinity};
                const near=Math.abs(e.x-this.player.data.position.x)<220;
                if(e.swungAt>prior.swing&&near)this.weaponAudio.play(e.swingKind);
                if(e.parryAt>prior.parry&&near)this.weaponAudio.play('guard-parry');
                this.vanguardSounds.set(e,{swing:e.swungAt,parry:e.parryAt});
            }
        }
        if(!wasWon)this.totalTicks+=steps;
        if(this.fight.health===6||this.fight.health===3)this.retryHealth=this.fight.health;
        if(this.act==='chase'&&!this.chaseCheckpoint&&this.player.data.position.x>=CHASE_CHECKPOINT){this.chaseCheckpoint=CHASE_CHECKPOINT;this.audio.sfx('checkpoint');}
        if(this.act==='siege'&&this.fight.route.cleared>this.siegeCheckpoint){
            this.siegeCheckpoint=this.fight.route.cleared;this.audio.sfx('checkpoint');
        }else if(this.act==='siege'&&this.fight.route.releasedThisTick)this.audio.sfx('switch');
        for(const event of this.fight.events){
            if(event==='shot'||event==='impact'||event==='splash'||event==='collapse-water'||event==='debris-land'||event==='reload'||event==='distant-shot'||event==='distant-hit'||event==='distant-debris'||event==='distant-thud'||event==='distant-roar'||event==='distant-wood'||event==='distant-stone'||event==='distant-metal'||event==='distant-launch'||event==='distant-rocket'||event==='distant-blast'||event==='distant-bell')this.weaponAudio.play(event);
            if(event==='step'&&this.fight.tick%3===0)this.audio.sfx('land');
            if(event==='break'){
                if(this.act==='siege'){
                    if(Math.abs(this.fight.backgroundX-this.player.data.position.x)<360)this.weaponAudio.play('distant-crash');
                }else {this.audio.sfx('break');if(this.act==='chase')this.weaponAudio.play('distant-crash');}
            }
            if(event==='won')this.audio.sfx('checkpoint');
        }
        if(this.fight.nextAct){this.transitionTicks+=steps;if(this.transitionTicks>=60)this.nextAct();}
        if(this.act==='chase')this.camera.x=clamp(this.player.data.position.x-150,0,CHASE_WIDTH-320);
        else if(this.act==='siege')this.camera.x=clamp(this.player.data.position.x-132+arrivalLookAhead(this.fight.arrivalTime,this.fight.arrivalSkipped),0,SIEGE_WIDTH-320);
        else this.camera.x=0;
        // Keep the complete jump arc visible without shaking the backdrop vertically.
        const headroom=this.act==='siege'&&this.fight.route.entered===3?32:38;
        this.camera.y=clamp(Math.min(64,this.player.data.position.y-headroom),0,64);
    }
    protected override renderEncounterHud(c:CanvasRenderingContext2D) {
        const b=this.fight;
        workshopPanel(c,0,0,320,31,false,true);
        pixelText(c,'FLAVIO HIPOTETICO',7,5,WORKSHOP_UI.paper);
        const district=Math.min(3,Math.floor(this.player.data.position.x/1120));
        pixelText(c,this.act==='chase'?`${district+1}/4 ${CHASE_DISTRICTS[district].name}`:this.act==='siege'&&!b.arrival.ready?'CHEGADA AO ARSENAL':this.act==='siege'?`${b.route.entered+1}/${SIEGE_SECTORS.length} ${b.route.currentSector.name}`:`FASE ${b.phaseNumber}/3`,121,5,WORKSHOP_UI.light);
        if(this.act==='chase')for(let i=0;i<4;i++){c.fillStyle=i<=district?'#dfad56':'#435969';c.fillRect(244+i*6,6,4,5);}
        if(this.act==='siege'&&b.arrival.ready){
            const i=b.route.entered,total=SIEGE_SECTORS[i].guards.length,left=b.route.remaining[i];
            pixelText(c,`${left}/${total}`,251,5,left?'#edc586':'#99d6bd');
            for(let j=0;j<total;j++){
                const x=222+j*6;c.fillStyle=WORKSHOP_UI.ink;c.fillRect(x,5,5,7);
                c.fillStyle=j<total-left?'#99d6bd':'#ca9951';c.fillRect(x+1,6,3,j<total-left?2:5);
            }
        }
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
        if(this.act==='siege'&&b.route.entered===3&&!this.player.data.isDead)
            drawBastionEdgeCue(c,this.foes,this.camera.x,this.camera.y);
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
            }else if(b.tick<(this.act==='siege'?54:110)&&(this.act!=='siege'||!b.arrivalSkipped)){
                if(this.act==='chase')pixelText(c,'FLAVIO BOLSONARO HIPOTETICO',160,60,'#ffedbf',1,'center');
                pixelText(c,this.act==='chase'?'I · A PONTE DO IMPOSSIVEL':this.act==='siege'?'II · A TRAVESSIA DO ARSENAL':'III · O ULTIMO LACRE',160,this.act==='siege'?39:72,'#ffedbf',1,'center');
                if(this.act==='chase')pixelText(c,'FANTASIA SATIRICA',160,83,'#d2c6b1',1,'center');
                this.renderer.present();
            }
            const fade=arrivalFade(this.act,b.tick,this.transitionTicks,b.arrivalSkipped);
            if(fade>0){c.save();c.globalAlpha=fade;c.fillStyle='#122630';c.fillRect(0,0,320,180);c.restore();this.renderer.present();}
        }
        const status=`Flávio Bolsonaro Hipotético. ${this.act==='chase'?'Perseguição':this.act==='siege'?`Cerco, ${b.route.currentSector.name}, ${b.route.remaining[b.route.entered]} de ${b.route.currentSector.guards.length} guardas restantes`:`Confronto, fase ${b.phaseNumber}`}. ${this.state==='paused'?'Pausado.':this.encounterHint} ${b.health} lacres. Setas: mover; Shift: correr; Espaço: pular; baixo no ar: sentada; Esc: pausa; R: retomar o trecho.`;
        if(this.status.textContent!==status)this.status.textContent=status;
    }
}
