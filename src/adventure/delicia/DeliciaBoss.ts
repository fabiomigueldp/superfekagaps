import type { Box } from './DeliciaContent';
export type BossBeat = 'intro'|'idle'|'tell'|'attack'|'recover'|'stagger'|'transition'|'defeated';
export type BossAttack = 'cup'|'wave'|'charge'|'whirlpool'|'geyser'|'gap'|'court'|'press'|'overload';
export interface BossMissile extends Box {vx:number;vy:number;gravity:number;kind:'juice'|'heart'|'seed'|'wave';life:number;friendly:boolean}
export interface BossEvent {kind:'tell'|'impact'|'shot'|'gap'|'phase'|'defeat';x:number;y:number;w?:number;attack?:BossAttack}
export const bossPhase = (hp:number,max:number) => hp>max*.66?1:hp>max*.33?2:3;
export const intersects = (a:Box,b:Box):boolean => a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
/** Attack positions lock during the tell; dangerous gaps never chase the player. */
export function gapTarget(playerX:number):Box {return{x:Math.max(340,Math.min(760,playerX-90)),y:450,w:180,h:450};}
export class DeliciaBoss {
    beat:BossBeat='intro'; attack:BossAttack='cup'; hp:number; readonly maxHp:number;
    x=890;y=305;w=96;h=145;time=0;phase=1;pressure=0;shield=false;direction=-1;
    target:Box={x:500,y:450,w:180,h:450};missiles:BossMissile[]=[];events:BossEvent[]=[];
    danger:Box[]=[];gaps:(Box&{life:number})[]=[];private timer=0;private combo=0;private shot=false;private hitCooldown=0;
    private startX=890;private relief=0;private pressureShield=false;
    beatTime=0;hitFlash=0;attackSerial=0;private duration=1;private pulses=0;private chargeEnd=290;
    constructor(readonly character:'jaja'|'guina',readonly assist=false){this.maxHp=character==='jaja'?12:24;this.hp=this.maxHp;this.shield=character==='guina';}
    start():void{this.beat='idle';this.timer=.6;}
    get vulnerable():boolean{return(this.beat==='recover'||this.beat==='stagger')&&!this.shield&&this.hp>0;}
    get progress():number{return this.beat==='tell'?Math.min(1,1-this.timer/this.tellDuration):0;}
    get attackProgress():number{return Math.max(0,Math.min(1,this.beatTime/this.duration));}
    get phaseTitle():string{return(this.character==='jaja'?['A promessa','A nascente desperta','A última caneca']:['O dono da reserva','Sete safras de silêncio','Nem uma gota a mais'])[this.phase-1];}
    get warnings():Box[]{
        if(this.attack==='press')return[{x:this.target.x,y:50,w:140,h:400},...(this.phase>=2?[{x:this.target.x+230,y:50,w:70,h:400}]:[])];
        if(this.attack==='geyser')return[0,1,2].map(i=>({x:350+i*270,y:190,w:65,h:260}));
        if(this.attack==='overload')return[{x:650,y:0,w:45,h:450}];
        if(this.attack==='gap')return[this.target];
        if(this.attack==='charge')return[{x:Math.min(this.x,this.chargeEnd),y:420,w:Math.abs(this.x-this.chargeEnd)+this.w,h:30}];
        return[];
    }
    get tellDuration():number{return(this.character==='jaja'?1.05:1.15)-.12*(this.phase-1)+(this.assist?.35:0);}
    get rect():Box{return{x:this.x,y:this.y,w:this.w,h:this.h};}
    get title():string{return this.character==='jaja'?'Jajá · Guardião da Nascente':'Paulo Guina · Barão da Delícia';}
    get cue():string{
        if(this.beat==='defeated')return 'Caminho livre!';
        if(this.beat==='transition')return `Fase ${this.phase}`;
        if(this.vulnerable)return 'Ataque! Semente ou sentada.';
        if(this.beat==='recover')return 'Abra uma válvula para tirar a armadura.';
        if(this.beat==='stagger')return 'Pressão liberada. Ataque!';
        return{cup:'Desvie dos jatos da caneca.',wave:'Pule a onda.',charge:'Pule ou use impulso.',whirlpool:'Pule as ondas em sequência.',geyser:'Fique entre os jatos.',gap:'Saia da marca dourada.',court:'Rebata os corações.',press:'Saia das colunas.',overload:'Abra as válvulas para baixar a pressão.'}[this.attack];
    }
    openValve():boolean{
        if(this.hp<=0||this.beat==='intro')return false;
        this.relief=12;this.pressure=Math.max(0,this.pressure-45);this.shield=false;
        if(this.beat==='recover'){this.beat='stagger';this.timer=1.7;}
        return true;
    }
    hit(power=1):boolean {
        if(!this.vulnerable||this.hitCooldown>0)return false;
        this.hp=Math.max(0,this.hp-power);this.hitCooldown=.8;this.hitFlash=.2;
        if(this.hp===0){this.beat='defeated';this.danger=[];this.missiles=[];this.gaps=[];this.events.push({kind:'defeat',x:this.x,y:this.y});return true;}
        const phase=bossPhase(this.hp,this.maxHp);
        if(phase!==this.phase){this.phase=phase;this.events.push({kind:'phase',x:this.x,y:this.y});this.beat='transition';this.timer=1.8;this.beatTime=0;this.shield=false;this.danger=[];this.missiles=[];this.gaps=[];}
        return true;
    }
    reflect(missile:BossMissile):void {missile.friendly=true;missile.vx=Math.sign(this.x-missile.x)*580;missile.vy=-50;missile.gravity=0;missile.life=2;}
    update(dt:number,player:Box):void {
        this.events=[];this.time+=dt;this.beatTime+=dt;this.hitFlash=Math.max(0,this.hitFlash-dt);this.hitCooldown=Math.max(0,this.hitCooldown-dt);this.relief=Math.max(0,this.relief-dt);
        this.gaps=this.gaps.filter(g=>{g.life-=dt;return g.life>0;});
        for(const m of this.missiles){m.life-=dt;m.x+=m.vx*dt;m.y+=m.vy*dt;m.vy+=m.gravity*dt;if(m.friendly&&intersects(m,this.rect)){
            if(!this.hit()){this.pressure=Math.max(0,this.pressure-30);if(this.pressure<25){this.shield=false;this.relief=4;if(this.beat==='recover'){this.beat='stagger';this.timer=1.1;}}}m.life=0;}}
        this.missiles=this.missiles.filter(m=>m.life>0&&m.y<700&&m.x>-100&&m.x<1440);
        if(this.beat==='intro'||this.beat==='defeated')return;
        this.timer-=dt;this.danger=[];
        if(this.beat==='transition'){if(this.timer<=0){this.beat='idle';this.timer=.7;this.beatTime=0;}return;}
        if(this.beat==='idle'&&this.timer<=0){this.chooseAttack(player);return;}
        if(this.beat==='tell'&&this.timer<=0){this.beat='attack';this.duration=this.attack==='charge'?.85:this.attack==='whirlpool'?2.2:this.attack==='overload'?1.8:this.attack==='geyser'?1.25:1;this.timer=this.duration;this.beatTime=0;this.pulses=0;this.startX=this.x;this.shot=false;
            this.events.push({kind:'impact',x:this.target.x,y:450,attack:this.attack});return;}
        if(this.beat==='attack'){
            this.performAttack(dt);
            if(this.timer<=0){this.beat='recover';this.beatTime=0;this.danger=[];this.timer=(this.assist?1.9:1.25)+(this.attack==='overload'||this.attack==='whirlpool'?.35:0);this.shield=this.character==='guina'&&this.pressureShield&&this.relief<=0;}
        }
        if((this.beat==='recover'||this.beat==='stagger')&&this.timer<=0){this.beat='idle';this.beatTime=0;this.timer=.5;this.shield=this.character==='guina'&&this.relief<=0;}
        if(this.beat==='idle')this.x+=(890-this.x)*Math.min(1,dt*3);
    }
    private chooseAttack(player:Box):void {
        const jaja:BossAttack[][]=[['cup','wave','charge'],['wave','geyser','cup','whirlpool','charge'],['whirlpool','charge','geyser','cup','wave']];
        const guina:BossAttack[][]=[['gap','court','charge'],['press','court','gap','charge'],['overload','court','gap','press','charge']];
        const list=(this.character==='jaja'?jaja:guina)[this.phase-1];this.attack=list[this.combo++%list.length];
        this.direction=player.x<this.x?-1:1;this.beat='tell';this.beatTime=0;this.timer=this.tellDuration;this.attackSerial++;
        this.chargeEnd=this.direction<0?260:1110;
        this.target=this.attack==='gap'?gapTarget(player.x):{x:Math.max(120,Math.min(this.attack==='press'?940:1190,player.x-55)),y:0,w:this.attack==='press'?140:100,h:450};
        this.pressure=Math.min(100,this.pressure+20+this.phase*8);this.pressureShield=this.pressure>=45;
        this.events.push({kind:'tell',x:this.target.x,y:450,attack:this.attack});
    }
    private missile(x:number,y:number,vx:number,vy:number,kind:BossMissile['kind'],gravity=500):void {
        this.missiles.push({x,y,w:kind==='wave'?65:kind==='heart'?26:22,h:kind==='wave'?30:kind==='heart'?26:22,vx,vy,gravity,kind,life:5,friendly:false});
        this.events.push({kind:'shot',x,y});
    }
    private performAttack(_dt:number):void {
        if(!this.shot){this.shot=true;
            if(this.attack==='gap'){this.gaps.push({...this.target,life:4.3});}
            if(this.attack==='cup')for(let i=0;i<2+this.phase;i++){
                const landing=this.target.x+50+(i-(1+this.phase)*.5)*62,flight=1.4+i*.06;
                const vy=(414-(this.y+20)-.5*600*flight*flight)/flight;
                this.missile(this.x+45,this.y+20,(landing-(this.x+45))/flight,vy,'juice',600);
            }
            if(this.attack==='court')for(let i=0;i<2+this.phase;i++)this.missile(this.x+45,this.y+70,this.direction*(180+i*50),18-i*15,'heart',110);
            if(this.attack==='wave')this.missile(this.x+45,420,this.direction*340,0,'wave',0);
            if(this.attack==='overload')for(let i=0;i<6;i++)this.missile(this.x,340,-180-i*42,-210-(i%3)*90,'juice',400);
        }
        if(this.attack==='whirlpool'&&this.pulses<this.phase+1&&this.beatTime>=this.pulses*.58){this.missile(this.x+45,420,this.direction*(280+this.pulses*20),0,'wave',0);this.pulses++;}
        if(this.attack==='charge'){
            const t=Math.max(0,Math.min(1,1-this.timer/.85)),dest=this.chargeEnd;
            this.x=this.startX+(dest-this.startX)*(t*t*(3-2*t));this.danger=[{x:this.x+8,y:this.y+60,w:this.w-16,h:this.h-60}];
        }
        if(this.attack==='press'||this.attack==='geyser')this.danger=this.warnings;
        if(this.attack==='overload'&&this.timer>.6)this.danger=this.warnings;
    }
}
