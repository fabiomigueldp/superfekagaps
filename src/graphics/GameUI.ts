import { ART } from './palette';
import { pixelText, panel, fitText } from './BitmapFont';
import { SpriteAtlas } from './pixels';
import { PLAYER_PALETTE, PLAYER_SPRITES } from '../assets/playerSpriteSpec';
import { COIN_FRAMES, FANTA_SPRITE, SPRITE_PALETTE } from './sprites';

export interface HudModel {
  score:number; lives:number; time:number; level:string; soundEnabled:boolean;
  hasHelmet:boolean; miniFantaTimer:number; coins:number; bossHealth?:number;
}
export interface ResultsModel { score:number; highScore:number; newRecord:boolean; totalRunTime:number; bestTime:number; newTimeRecord:boolean }

/** All game UI shares the world pixel grid. Browser/editor UI remains normal HTML. */
export class GameUI {
  constructor(private atlas:SpriteAtlas){}
  hud(c:CanvasRenderingContext2D,p:HudModel):void {
    c.fillStyle=ART.ink;c.fillRect(0,0,320,21);c.fillStyle=ART.rock;c.fillRect(0,20,320,1);
    c.save();c.beginPath();c.rect(2,2,16,15);c.clip();this.atlas.draw(c,PLAYER_SPRITES.idle,PLAYER_PALETTE,1,3);c.restore();
    pixelText(c,'×'+(p.lives>99?'99+':Math.max(0,p.lives)),20,7);
    this.atlas.draw(c,COIN_FRAMES[0],SPRITE_PALETTE,43,2);pixelText(c,String(p.coins).padStart(2,'0'),61,7,ART.goldLight);
    c.fillStyle=ART.rock;c.fillRect(82,5,1,10);c.fillRect(133,5,1,10);
    pixelText(c,String(Math.max(0,p.score)).padStart(6,'0').slice(-7),88,7);
    c.fillStyle=ART.rockLight;c.fillRect(140,6,7,9);c.fillRect(139,7,9,7);
    c.fillStyle=ART.ink;c.fillRect(141,7,5,6);c.fillStyle=ART.paper;c.fillRect(143,7,1,4);c.fillRect(143,10,2,1);
    pixelText(c,String(Math.max(0,Math.ceil(p.time))).padStart(3,'0'),151,7,p.time<30?ART.redLight:ART.paper);
    const name=p.level.replace('WORLD ','').replace('BOSS: ','');
    pixelText(c,fitText(name,78),179,7,ART.tealLight);
    if(p.hasHelmet)this.atlas.draw(c,PLAYER_SPRITES.helmet,PLAYER_PALETTE,265,7);
    if(p.miniFantaTimer>0){
      this.atlas.draw(c,FANTA_SPRITE,SPRITE_PALETTE,284,2);
      c.fillStyle=ART.orangeDark;c.fillRect(285,18,14,1);c.fillStyle=ART.goldLight;c.fillRect(285,18,Math.ceil(14*Math.min(1,p.miniFantaTimer/10000)),1);
    }
    c.fillStyle=p.soundEnabled?ART.tealLight:ART.muted;c.fillRect(308,8,2,5);c.fillRect(310,6,2,9);
    if(p.soundEnabled){c.fillRect(314,7,1,7);c.fillRect(316,9,1,3);}else{c.fillStyle=ART.redLight;c.fillRect(314,9,3,1);c.fillRect(315,8,1,3);}
    if(p.bossHealth!==undefined){
      panel(c,216,25,98,13,ART.ink,ART.purple);
      pixelText(c,'JOÃOZÃO',221,28,ART.purpleLight);
      for(let i=0;i<3;i++){c.fillStyle=i<p.bossHealth?ART.redLight:ART.purpleDark;c.fillRect(268+i*14,29,10,4);}
    }
  }
  title(c:CanvasRenderingContext2D,time:number,touch:boolean):void {
    pixelText(c,'SUPER',160,20,ART.ink,1,'center');
    pixelText(c,'FEKA GAPS',162,36,ART.ink,3,'center');
    pixelText(c,'FEKA GAPS',160,33,ART.goldDark,3,'center');
    pixelText(c,'FEKA GAPS',160,31,ART.goldLight,3,'center');
    pixelText(c,'UMA AVENTURA CHEIA DE GAPS',160,62,ART.ink,1,'center');
    panel(c,82,80,156,21,ART.ink,ART.gold);
    pixelText(c,touch?'TOQUE PARA JOGAR':'ENTER PARA JOGAR',160,87,ART.paper,1,'center');
    c.fillStyle=ART.goldLight;c.fillRect(91,88+Math.floor(time/700)%2,2,3);
    c.fillStyle=ART.ink;c.fillRect(0,146,320,34);
    pixelText(c,touch?'← → MOVER   X CORRER   ↑ PULAR':'A/D OU ←/→ MOVER  W/ESPAÇO PULAR  SHIFT CORRER',160,153,ART.paper,1,'center');
    pixelText(c,touch?'↓ NO AR: SENTADA   TOPO: PAUSA':'S/↓ NO AR: SENTADA  ESC PAUSA  M SOM',160,166,ART.muted,1,'center');
  }
  pause(c:CanvasRenderingContext2D,touch:boolean):void {
    this.dim(c);panel(c,49,52,222,78,ART.ink,ART.teal);
    pixelText(c,'PAUSA',160,65,ART.goldLight,2,'center');
    pixelText(c,touch?'TOQUE PARA CONTINUAR':'ESC PARA CONTINUAR',160,92,ART.paper,1,'center');
    pixelText(c,'RESPIRE. O PRÓXIMO SALTO ESPERA.',160,112,ART.muted,1,'center');
  }
  gameOver(c:CanvasRenderingContext2D,p:ResultsModel,touch:boolean):void {
    this.dim(c);panel(c,32,27,256,130,ART.ink,ART.red);
    pixelText(c,'FIM DE AVENTURA',160,40,ART.redLight,2,'center');
    pixelText(c,p.newRecord?'NOVO RECORDE!':'MAIS UM SALTO?',160,65,ART.goldLight,1,'center');
    pixelText(c,'PONTOS  '+p.score,160,85,ART.paper,1,'center');
    pixelText(c,'RECORDE '+p.highScore,160,98,ART.muted,1,'center');
    if(Number.isFinite(p.bestTime)&&p.bestTime>0)pixelText(c,'MELHOR TEMPO '+p.bestTime.toFixed(1)+'S',160,114,ART.tealLight,1,'center');
    pixelText(c,touch?'TOQUE PARA RECOMEÇAR':'ENTER PARA RECOMEÇAR',160,138,ART.paper,1,'center');
  }
  clear(c:CanvasRenderingContext2D,level:string,score:number,bonus:number):void {
    this.dim(c);panel(c,33,37,254,107,ART.ink,ART.leafLight);
    pixelText(c,'CAMINHO LIVRE!',160,51,ART.goldLight,2,'center');
    pixelText(c,fitText(level,220),160,78,ART.tealLight,1,'center');
    pixelText(c,'PONTOS '+score,160,98,ART.paper,1,'center');
    pixelText(c,'BÔNUS DE TEMPO +'+bonus,160,119,ART.muted,1,'center');
  }
  bossIntro(c:CanvasRenderingContext2D,name:string):void {
    this.dim(c);panel(c,32,44,256,94,ART.ink,ART.purple);
    pixelText(c,'ALGUÉM ESTÁ NO CAMINHO...',160,57,ART.purpleLight,1,'center');
    pixelText(c,fitText(name,220,2),160,78,ART.greenLight,2,'center');
    pixelText(c,'"VOCÊ VAI CAIR NOS MEUS GAPS!"',160,115,ART.paper,1,'center');
  }
  ending(c:CanvasRenderingContext2D,p:ResultsModel,touch:boolean,time:number):void {
    pixelText(c,'UMA VITÓRIA E TANTO!',161,17,ART.ink,2,'center');
    pixelText(c,'UMA VITÓRIA E TANTO!',160,15,ART.goldLight,2,'center');
    pixelText(c,'FEKA SALVOU YASMIN?',160,42,ART.ink,1,'center');
    pixelText(c,'JOÃOZÃO FICOU PARA TRÁS.',160,55,ART.ink,1,'center');
    pixelText(c,'♥',157,89+Math.floor(time/500)%2,ART.red,1,'center');
    c.fillStyle=ART.ink;c.fillRect(0,132,320,48);
    pixelText(c,'PONTOS '+p.score,12,140,ART.paper);
    pixelText(c,p.newRecord?'NOVO RECORDE!':'RECORDE '+p.highScore,308,140,ART.goldLight,1,'right');
    pixelText(c,'TEMPO '+p.totalRunTime.toFixed(1)+'S'+(p.newTimeRecord?'  NOVO RECORDE!':''),160,153,ART.tealLight,1,'center');
    pixelText(c,time<5000?'OBRIGADO POR JOGAR!':touch?'TOQUE PARA VOLTAR':'ENTER PARA VOLTAR',160,168,ART.paper,1,'center');
  }
  boot(c:CanvasRenderingContext2D,time:number):void {
    c.fillStyle=ART.ink;c.fillRect(0,0,320,180);
    pixelText(c,'TORBWARE',160,71,ART.goldLight,2,'center');
    pixelText(c,'PEQUENOS PIXELS. GRANDES SALTOS.',160,101,ART.muted,1,'center');
    c.fillStyle=ART.rock;c.fillRect(120,120,80,2);c.fillStyle=ART.teal;c.fillRect(120,120,Math.min(80,Math.floor(time/1500*80)),2);
  }
  private dim(c:CanvasRenderingContext2D):void {c.fillStyle='rgba(25,31,53,0.78)';c.fillRect(0,0,320,180);}
}
