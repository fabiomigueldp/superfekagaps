import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, TileType, FALLING_PLATFORM_FALL_MS, FALLING_PLATFORM_FALL_DISTANCE, PLAYER_RESPAWN_REVEAL_MS } from '../constants';
import { CameraData, PlayerData, EnemyData, CollectibleData, FlagData, Particle, Firework, EnemyType, CollectibleType, GroundPoundState, SpeechBubbleRenderState, FallingPlatformPhase, LevelTheme, PaletteItem, LevelTrigger, TriggerType } from '../types';
import { PLAYER_PALETTE, PLAYER_SPRITES, PLAYER_WALK } from '../assets/playerSpriteSpec';
import { playerDeathMotion, deathIrisProgress, DEATH_HIT_STOP_MS } from '../graphics/playerDeathMotion';
import { ART, hashAt } from '../graphics/palette';
import { SpriteAtlas, VisualClock, animationIndex, PixelFrame, sceneZoom } from '../graphics/pixels';
import { TilePainter } from '../graphics/TilePainter';
import { BackgroundScene } from '../graphics/BackgroundScene';
import { GameUI } from '../graphics/GameUI';
import { pixelText, panel, textWidth, wrapText, fitText } from '../graphics/BitmapFont';
import { MINION_FRAMES, MINION_SQUASH, BOSS_FRAMES, YASMIN_FRAMES, COIN_FRAMES, FANTA_SPRITE, PROJECTILE_FRAMES, SPRITE_PALETTE } from '../graphics/sprites';

type PlatformVisual = { col:number; row:number; phase:FallingPlatformPhase; timer:number; contact:number };
type Impact = { x:number; y:number; time:number; kind:'land'|'pound'|'spring'|'boss' };

/** One native 320×180 composition, then one nearest-neighbour presentation.
 * World art, particles, typography and overlays share the same pixel density.
 * The editor calls the same painters with its own context and transform.
 */
export class Renderer {
  private canvas:HTMLCanvasElement;
  private ctx:CanvasRenderingContext2D;
  private offscreenCanvas:HTMLCanvasElement;
  private offscreenCtx:CanvasRenderingContext2D;
  private worldCanvas:HTMLCanvasElement;
  private worldCtx:CanvasRenderingContext2D;
  private compositeCtx:CanvasRenderingContext2D;
  private composed=false;
  private atlas=new SpriteAtlas();
  private tiles=new TilePainter();
  private clock=new VisualClock();
  private ui=new GameUI(this.atlas);
  private background=new BackgroundScene();
  private menuBackground=new BackgroundScene();
  private impacts:Impact[]=[];
  private editorLink:HTMLElement|null;
  private debug=false;
  private zoom=1;
  private touch=false;
  private interpolationMs=0;

  constructor() {
    this.canvas=document.getElementById('game-canvas') as HTMLCanvasElement;
    this.ctx=this.canvas.getContext('2d')!;
    this.offscreenCanvas=document.createElement('canvas');
    this.offscreenCanvas.width=GAME_WIDTH;this.offscreenCanvas.height=GAME_HEIGHT;
    this.compositeCtx=this.offscreenCanvas.getContext('2d')!;
    this.worldCanvas=document.createElement('canvas');
    this.worldCanvas.width=GAME_WIDTH;this.worldCanvas.height=GAME_HEIGHT;
    this.worldCtx=this.worldCanvas.getContext('2d')!;this.offscreenCtx=this.worldCtx;
    this.editorLink=document.getElementById('open-editor');
    this.touch=navigator.maxTouchPoints>0;
    this.debug=location.hash.includes('debug');
    (window as unknown as {renderer:Renderer}).renderer=this;
    this.resize();window.addEventListener('resize',()=>this.resize());
  }

  advanceClock(deltaMs:number):void {
    this.clock.advance(deltaMs);
    this.impacts=this.impacts.filter(p=>this.clock.time-p.time<350);
  }
  setFrameInterpolation(deltaMs:number):void {
    this.interpolationMs=Math.max(0,Math.min(1000/60,deltaMs));
  }
  private deathElapsed(p:PlayerData):number {
    return Math.min(p.deathTimerMax,p.deathTimerMax-p.deathTimer+(this.interpolationMs??0));
  }
  addImpact(x:number,y:number,kind:Impact['kind']):void {
    this.impacts.push({x,y,kind,time:this.clock.time});
    if(this.impacts.length>32)this.impacts.shift();
  }
  private resize():void {
    const cssScale=Math.max(1,Math.floor(Math.min(window.innerWidth/GAME_WIDTH,window.innerHeight/GAME_HEIGHT)));
    const physicalScale=Math.max(1,Math.round(cssScale*(window.devicePixelRatio||1)));
    this.canvas.style.width=GAME_WIDTH*cssScale+'px';
    this.canvas.style.height=GAME_HEIGHT*cssScale+'px';
    this.canvas.width=GAME_WIDTH*physicalScale;this.canvas.height=GAME_HEIGHT*physicalScale;
    this.ctx.imageSmoothingEnabled=false;
  }
  clear():void {
    this.composed=false;this.offscreenCtx=this.worldCtx;
    const c=this.offscreenCtx;c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.imageSmoothingEnabled=false;
    c.fillStyle=ART.ink;c.fillRect(0,0,this.worldCanvas.width,this.worldCanvas.height);
    if(this.editorLink)this.editorLink.hidden=true;
  }
  startScene(zoom=1):void {
    this.zoom=sceneZoom(zoom);
    const w=Math.ceil(GAME_WIDTH/this.zoom),h=Math.ceil(GAME_HEIGHT/this.zoom);
    if(this.worldCanvas.width!==w)this.worldCanvas.width=w;
    if(this.worldCanvas.height!==h)this.worldCanvas.height=h;
    this.clear();
  }
  private composeWorld():void {
    if(this.composed)return;
    this.compositeCtx.setTransform(1,0,0,1,0,0);this.compositeCtx.imageSmoothingEnabled=false;
    // Zoom the finished world once. Transforming individual rectangles causes antialiased edges at fractional zoom.
    this.compositeCtx.drawImage(this.worldCanvas,0,0,GAME_WIDTH/this.zoom,GAME_HEIGHT/this.zoom,0,0,GAME_WIDTH,GAME_HEIGHT);
    this.composed=true;this.offscreenCtx=this.compositeCtx;
  }
  present():void {
    this.composeWorld();
    if(this.debug)this.screen(c=>{panel(c,2,164,111,14);pixelText(c,'320 × 180  PIXEL',7,168,ART.tealLight);});
    this.ctx.setTransform(1,0,0,1,0,0);this.ctx.imageSmoothingEnabled=false;
    this.ctx.drawImage(this.offscreenCanvas,0,0,this.canvas.width,this.canvas.height);
  }
  private screen(draw:(c:CanvasRenderingContext2D)=>void):void {
    this.composeWorld();
    const c=this.offscreenCtx;c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;draw(c);c.restore();
  }
  getContext():CanvasRenderingContext2D {return this.offscreenCtx;}
  getDimensions():{width:number;height:number} {return {width:GAME_WIDTH,height:GAME_HEIGHT};}
  prepareLevelBackground(theme?:LevelTheme):void {
    this.background=new BackgroundScene(theme);this.impacts=[];
  }
  drawBackground(camera:CameraData,ctx=this.offscreenCtx,width=GAME_WIDTH,height=GAME_HEIGHT):void {
    this.background.draw(ctx,Math.round(camera.x),Math.round(camera.y),width,height,this.clock.time);
  }
  drawTiles(tiles:number[][],camera:CameraData,originX=0,originY=0):void {
    const cx=Math.round(camera.x),cy=Math.round(camera.y);
    const startCol=Math.max(0,Math.floor(cx/TILE_SIZE)-originX-1);
    const endCol=Math.min(tiles[0]?.length??0,Math.ceil((cx+GAME_WIDTH/this.zoom)/TILE_SIZE)-originX+1);
    const startRow=Math.max(0,Math.floor(cy/TILE_SIZE)-originY-1);
    const endRow=Math.min(tiles.length,Math.ceil((cy+GAME_HEIGHT/this.zoom)/TILE_SIZE)-originY+1);
    for(let row=startRow;row<endRow;row++)for(let col=startCol;col<endCol;col++){
      this.drawTile(tiles[row][col],(col+originX)*TILE_SIZE-cx,(row+originY)*TILE_SIZE-cy,tiles,row,col,undefined,col+originX,row+originY);
    }
  }
  drawTile(type:number,x:number,y:number,tiles:number[][],row:number,col:number,ctx=this.offscreenCtx,worldCol=col,worldRow=row):void {
    this.tiles.draw(ctx,type,x,y,tiles,row,col,this.background.theme.biome??'meadow',this.clock.time,worldCol,worldRow);
  }
  drawFallingPlatforms(platforms:PlatformVisual[],camera:CameraData,originX=0,originY=0):void {
    const c=this.offscreenCtx;
    for(const p of platforms){
      if(p.phase==='cooldown')continue;
      const progress=p.phase==='falling'?Math.max(0,1-p.timer/FALLING_PLATFORM_FALL_MS):0;
      const shake=p.phase==='arming'?(Math.floor(p.timer/40)%2?1:-1):0;
      const x=(p.col+originX)*16-Math.round(camera.x)+shake;
      const y=(p.row+originY)*16-Math.round(camera.y)+Math.round(progress*FALLING_PLATFORM_FALL_DISTANCE);
      c.save();c.globalAlpha=1-progress*.4;
      this.drawTile(TileType.PLATFORM_FALLING,x,y,[[TileType.PLATFORM_FALLING]],0,0,c,p.col+originX,p.row+originY);
      c.restore();
    }
  }
  private shadow(c:CanvasRenderingContext2D,x:number,y:number,w:number):void {
    c.save();c.globalAlpha*=.35;c.fillStyle=ART.ink;c.fillRect(Math.round(x),Math.round(y)-1,w,2);
    c.fillRect(Math.round(x)+2,Math.round(y)-2,Math.max(1,w-4),1);c.restore();
  }
  drawPlayer(p:PlayerData,camera:CameraData,ctx=this.offscreenCtx):void {
    const position=p.isDead?(p.deathOrigin??p.position):p.position;
    const x=Math.round(position.x)-Math.round(camera.x)-1,y=Math.round(position.y)-Math.round(camera.y)-2;
    if(p.isDead){
      const elapsed=this.deathElapsed(p);
      ctx.save();ctx.globalAlpha*=Math.min(.2,elapsed/160*.2);ctx.fillStyle=ART.ink;
      ctx.fillRect(0,0,GAME_WIDTH/(this.zoom??1),GAME_HEIGHT/(this.zoom??1));ctx.restore();
      if(p.deathKind==='fall')return;
      const grounded=p.deathWasGrounded??p.isGrounded;
      const direction=p.deathDirection??(p.facingRight?-1:1);
      const motion=playerDeathMotion(elapsed,grounded,direction);
      if(grounded && elapsed<650){
        ctx.save();ctx.globalAlpha*=Math.max(0,1-elapsed/650);
        const width=Math.round(Math.max(4,12+Math.min(0,motion.y)*.18));
        this.shadow(ctx,x+8-width/2,y+26,width);ctx.restore();
      }
      if(elapsed<260)this.drawDeathImpact(ctx,x+8-direction*6,y+12,elapsed);
      if(motion.alpha<=0)return;
      ctx.save();
      ctx.globalAlpha*=motion.alpha;
      this.atlas.draw(ctx,PLAYER_SPRITES[motion.pose],PLAYER_PALETTE,
        x+motion.x,y+motion.y,!p.facingRight,1,elapsed<45?ART.paper:undefined);
      ctx.restore();
      return;
    }
    let frame:PixelFrame=PLAYER_SPRITES.idle,headY=0;
    if(p.groundPoundState===GroundPoundState.WINDUP){frame=PLAYER_SPRITES.windup;headY=3;}
    else if(p.groundPoundState===GroundPoundState.FALL||p.groundPoundState===GroundPoundState.RECOVERY){frame=PLAYER_SPRITES.sit;headY=7;}
    else if(!p.isGrounded)frame=p.velocity.y<0?PLAYER_SPRITES.jump:PLAYER_SPRITES.fall;
    else if((p.landingTimer??0)>0){frame=PLAYER_SPRITES.land;headY=7;}
    else if(Math.abs(p.velocity.x)>.1){
      const i=animationIndex(p.animationTimer,6,p.isRunning?65:100);frame=PLAYER_WALK[i];headY=i%3===1?1:0;
    }else if(this.clock.time%3400>3260)frame=PLAYER_SPRITES.blink;
    if(p.isGrounded)this.shadow(ctx,x+3,y+26,12);
    // Flash between complete palette variants; silhouette remains readable during invulnerability.
    const tint=!(p.respawnRevealTimer!>0)&&p.invincibleTimer>0&&animationIndex(p.invincibleTimer,2,90)===1?ART.paper:undefined;
    this.atlas.draw(ctx,frame,PLAYER_PALETTE,x,y,!p.facingRight,1,tint);
    if(p.hasHelmet)this.atlas.draw(ctx,PLAYER_SPRITES.helmet,PLAYER_PALETTE,x,y+headY-2,!p.facingRight);
    if(p.miniFantaTimer>0){
      for(let i=0;i<3;i++){
        const step=animationIndex(this.clock.time+i*140,8,90),sx=x-3+(i*11)%23,sy=y+24-step*3;
        ctx.fillStyle=i===1?ART.orangeLight:ART.gold;ctx.fillRect(sx,sy,1,2);
      }
    }
    if(p.groundPoundState===GroundPoundState.FALL){
      ctx.fillStyle=ART.paper;ctx.fillRect(x-2,y+9,1,6);ctx.fillRect(x+18,y+5,1,8);
    }
    if((p.respawnRevealTimer??0)>0){
      this.drawRespawnBurst(ctx,x+8,y+13,Math.min(1,1-(p.respawnRevealTimer!-(this.interpolationMs??0))/PLAYER_RESPAWN_REVEAL_MS));
    }
  }
  private drawDeathImpact(c:CanvasRenderingContext2D,x:number,y:number,elapsed:number):void {
    c.save();c.globalAlpha*=1-elapsed/260;
    for(let i=0;i<6;i++){
      const angle=i*Math.PI/3-.4,radius=4+elapsed*.055;
      const px=Math.round(x+Math.cos(angle)*radius),py=Math.round(y+Math.sin(angle)*radius+elapsed*elapsed*.00009);
      c.fillStyle=i%2?ART.goldLight:ART.paper;c.fillRect(px,py,2,2);
    }
    if(elapsed<DEATH_HIT_STOP_MS){
      c.fillStyle=ART.paper;c.fillRect(x-5,y-1,11,2);c.fillRect(x-1,y-5,2,11);
    }
    c.restore();
  }
  private drawRespawnBurst(c:CanvasRenderingContext2D,x:number,y:number,progress:number):void {
    const radius=Math.round(4+20*progress);
    c.save();c.globalAlpha*=Math.sin(Math.PI*progress);
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4;
      const px=Math.round(x+Math.cos(angle)*radius),py=Math.round(y+Math.sin(angle)*radius);
      c.fillStyle=i%2?ART.goldLight:ART.paper;
      c.fillRect(px,py,i%2?2:3,2);
    }
    c.fillStyle=ART.tealLight;
    c.fillRect(x-radius-2,y,3,1);c.fillRect(x+radius,y,3,1);
    c.fillRect(x,y-radius-2,1,3);c.fillRect(x,y+radius,1,3);
    c.restore();
  }
  drawPlayerTransition(p:PlayerData,camera:CameraData,ctx?:CanvasRenderingContext2D):void {
    if(!p.isDead && !(p.respawnRevealTimer && p.respawnRevealTimer>0))return;
    const draw=(c:CanvasRenderingContext2D)=>{
      const elapsed=this.deathElapsed(p);
      const amount=p.isDead
        ? deathIrisProgress(elapsed,p.deathKind??'hit',p.deathTimerMax)
        : Math.max(0,Math.min(1,((p.respawnRevealTimer??0)-(this.interpolationMs??0))/PLAYER_RESPAWN_REVEAL_MS));
      if(amount<=0)return;
      const eased=amount*amount*(3-2*amount);
      // Native scanlines keep the iris smooth without introducing antialiasing.
      const position=p.isDead?(p.deathOrigin??p.position):p.position;
      const motion=p.isDead&&p.deathKind!=='fall'
        ? playerDeathMotion(elapsed,p.deathWasGrounded??p.isGrounded,p.deathDirection??-1) : {x:0,y:0};
      const centerX=Math.max(20,Math.min(GAME_WIDTH-20,Math.round((position.x+motion.x+p.width/2-camera.x)*this.zoom)));
      const centerY=Math.max(24,Math.min(GAME_HEIGHT-24,Math.round((position.y+motion.y+p.height/2-camera.y)*this.zoom)));
      const farthestCorner=Math.max(
        Math.hypot(centerX,centerY),Math.hypot(GAME_WIDTH-centerX,centerY),
        Math.hypot(centerX,GAME_HEIGHT-centerY),Math.hypot(GAME_WIDTH-centerX,GAME_HEIGHT-centerY)
      );
      const radius=Math.ceil(farthestCorner*(1-eased));
      c.fillStyle=ART.ink;
      for(let y=0;y<GAME_HEIGHT;y++){
        const half=Math.floor(Math.sqrt(Math.max(0,radius*radius-(y+.5-centerY)**2)));
        if(half===0){c.fillRect(0,y,GAME_WIDTH,1);continue;}
        const left=Math.max(0,centerX-half),right=Math.min(GAME_WIDTH,centerX+half);
        if(left>0)c.fillRect(0,y,left,1);
        if(right<GAME_WIDTH)c.fillRect(right,y,GAME_WIDTH-right,1);
      }
    };
    if(ctx)draw(ctx);else this.screen(draw);
  }
  drawEnemy(e:EnemyData,camera:CameraData,ctx=this.offscreenCtx):void {
    if(!e.active)return;
    const x=Math.round(e.position.x)-Math.round(camera.x),y=Math.round(e.position.y)-Math.round(camera.y);
    if(e.attackPreview)this.drawAttackPreview(e.attackPreview,camera,ctx);
    if(e.type===EnemyType.MINION){
      if(!e.isDead&&(!e.velocity||Math.abs(e.velocity.y)<.1))this.shadow(ctx,x+1,y+19,14);
      const frame=e.isDead?MINION_SQUASH:MINION_FRAMES[animationIndex(e.animationTimer,4,140)];
      this.atlas.draw(ctx,frame,SPRITE_PALETTE,x-1,y-1,!e.facingRight);
    }else{
      const frame=e.isDead?BOSS_FRAMES.dead:e.animationFrame===1?BOSS_FRAMES.windup:e.animationFrame===2?BOSS_FRAMES.smash:
        e.animationFrame===3?BOSS_FRAMES.hurt:e.animationFrame===4?BOSS_FRAMES.shoot:
        Math.abs(e.velocity?.x??0)>.2?BOSS_FRAMES.walk[animationIndex(e.animationTimer,2,190)]:BOSS_FRAMES.idle;
      if(!e.isDead)this.shadow(ctx,x+1,y+40,31);
      ctx.save();
      if(e.isDead&&(e.deadRotation??0)>.7){
        // Quarter turn preserves the native pixel grid; arbitrary rotation would blur the sprite.
        ctx.translate(x+16,y+38);ctx.rotate(e.facingRight?Math.PI/2:-Math.PI/2);
        this.atlas.draw(ctx,frame,SPRITE_PALETTE,-20,-43,!e.facingRight);
      }else this.atlas.draw(ctx,frame,SPRITE_PALETTE,x-4,y-7,!e.facingRight);
      ctx.restore();
    }
  }
  private drawAttackPreview(p:NonNullable<EnemyData['attackPreview']>,camera:CameraData,c:CanvasRenderingContext2D):void {
    const x=Math.round(p.x-camera.x),y=Math.round(p.y-camera.y);
    const color=animationIndex(this.clock.time,2,90)?ART.redLight:ART.goldLight;
    c.fillStyle=ART.ink;c.fillRect(x,y-3,p.width,5);c.fillStyle=color;c.fillRect(x,y-2,p.width,2);
    const filled=Math.round(p.width*p.progress);
    c.fillStyle=ART.red;c.fillRect(x,y+1,filled,1);
    for(let i=4;i<p.width;i+=8){c.fillStyle=ART.ink;c.fillRect(x+i,y-2,3,2);}
    pixelText(c,'!',x+p.width/2,y-13,color,1,'center');
  }
  drawCollectible(p:CollectibleData,camera:CameraData,ctx=this.offscreenCtx):void {
    if(!p.active||p.collected)return;
    const x=Math.round(p.position.x)-Math.round(camera.x),y=Math.round(p.position.y)-Math.round(camera.y);
    if(p.type===CollectibleType.COIN)this.drawCoin(x,y,p.animationTimer,ctx);
    else if(p.type===CollectibleType.MINI_FANTA)this.drawFanta(x,y,p.animationTimer,ctx);
    else this.drawHelmet(x,y,ctx);
  }
  drawCoin(x:number,y:number,time:number,ctx=this.offscreenCtx):void {
    this.atlas.draw(ctx,COIN_FRAMES[animationIndex(time,6,110)],SPRITE_PALETTE,x,y);
  }
  drawFanta(x:number,y:number,time=0,ctx=this.offscreenCtx):void {
    this.atlas.draw(ctx,FANTA_SPRITE,SPRITE_PALETTE,x,y);
    if(animationIndex(time,8,150)===0){ctx.fillStyle=ART.white;ctx.fillRect(Math.round(x)+10,Math.round(y)+4,1,2);}
  }
  drawHelmet(x:number,y:number,ctx=this.offscreenCtx):void {
    this.atlas.draw(ctx,PLAYER_SPRITES.helmet,PLAYER_PALETTE,x,y+4);
  }
  drawProjectile(x:number,y:number,_radius=4):void {
    this.atlas.draw(this.offscreenCtx,PROJECTILE_FRAMES[animationIndex(this.clock.time,4,80)],SPRITE_PALETTE,x-1,y-1);
  }
  drawFlagTile(x:number,y:number,ctx=this.offscreenCtx,kind:'checkpoint'|'goal'='checkpoint'):void {
    this.flagAt(ctx,Math.round(x),Math.round(y),kind,'inactive');
  }
  drawFlag(flag:FlagData,camera:CameraData):void {
    if(flag.enabled)this.flagAt(this.offscreenCtx,Math.round(flag.anchor.x-camera.x),Math.round(flag.anchor.y-camera.y),flag.kind,flag.state);
  }
  private flagAt(c:CanvasRenderingContext2D,x:number,y:number,kind:FlagData['kind'],state:FlagData['state']):void {
    const h=kind==='goal'?34:28,w=kind==='goal'?18:14,top=y-h;
    const active=state!=='inactive',color=kind==='goal'?ART.gold:active?ART.teal:ART.red;
    c.fillStyle=ART.ink;c.fillRect(x-2,top,4,h);c.fillRect(x-5,y-2,10,2);
    c.fillStyle=ART.soilTop;c.fillRect(x-1,top+2,1,h-4);c.fillStyle=ART.goldLight;c.fillRect(x-2,top-1,3,2);
    const wave=animationIndex(this.clock.time,4,180);
    for(let i=0;i<w;i++){
      const shift=i<5?0:Math.round(Math.sin((i/5+wave)*Math.PI/2));
      c.fillStyle=ART.ink;c.fillRect(x+2+i,top+4+shift,1,11);
      c.fillStyle=color;c.fillRect(x+2+i,top+5+shift,1,8);
      c.fillStyle=kind==='goal'?ART.goldLight:active?ART.tealLight:ART.redLight;c.fillRect(x+2+i,top+5+shift,1,1);
    }
    if(kind==='goal'){c.fillStyle=ART.ink;c.fillRect(x+7,top+7,5,4);c.fillStyle=ART.paper;c.fillRect(x+8,top+7,1,3);c.fillRect(x+10,top+8,1,3);}
    else if(active){c.fillStyle=ART.paper;c.fillRect(x+6,top+9,2,2);c.fillRect(x+8,top+8,2,2);c.fillRect(x+10,top+7,2,2);}
    else {c.fillStyle=ART.paper;c.fillRect(x+8,top+7,1,3);c.fillRect(x+8,top+11,1,1);}
  }
  drawYasmin(x:number,y:number):void {
    this.atlas.draw(this.offscreenCtx,YASMIN_FRAMES[animationIndex(this.clock.time,2,600)],SPRITE_PALETTE,x,y);
  }
  drawSpeechBubble(bubble:SpeechBubbleRenderState,camera:CameraData):void {
    const c=this.offscreenCtx,lines=wrapText(bubble.text,210).slice(0,5);
    if(!lines.length)return;
    const w=Math.max(...lines.map(s=>textWidth(s)))+12,h=lines.length*12+8;
    const viewWidth=GAME_WIDTH/this.zoom,viewHeight=GAME_HEIGHT/this.zoom;
    const x=Math.round(Math.max(4,Math.min(viewWidth-w-4,bubble.position.x-camera.x-w/2)));
    const y=Math.round(Math.max(25/this.zoom,Math.min(viewHeight-h-5,bubble.position.y-camera.y-h-8)));
    c.save();c.globalAlpha=bubble.alpha;panel(c,x,y,w,h,ART.paper,ART.ink);
    lines.forEach((s,i)=>pixelText(c,s,x+6,y+6+i*12,ART.ink));
    c.fillStyle=ART.ink;c.fillRect(Math.round(x+w/2)-3,y+h,6,2);c.fillRect(Math.round(x+w/2)-1,y+h+2,2,2);
    c.restore();
  }
  drawParticles(particles:Particle[]):void {
    const c=this.offscreenCtx;c.save();
    for(const p of particles){
      if(p.life<=0)continue;
      c.globalAlpha=Math.ceil(Math.min(1,p.life/p.maxLife)*4)/4;c.fillStyle=p.color;
      const size=Math.max(1,Math.round(p.size));c.fillRect(Math.round(p.position.x),Math.round(p.position.y),size,size);
    }
    c.restore();
  }
  drawWorldEffects(camera:CameraData):void {
    const c=this.offscreenCtx;
    for(const p of this.impacts){
      const t=(this.clock.time-p.time)/350,step=Math.floor(t*5),x=Math.round(p.x-camera.x),y=Math.round(p.y-camera.y);
      c.fillStyle=p.kind==='boss'?ART.purpleLight:p.kind==='spring'?ART.goldLight:ART.soilTop;
      const distance=4+step*(p.kind==='pound'||p.kind==='boss'?5:3),width=Math.max(1,5-step);
      for(const dir of [-1,1]){c.fillRect(x+dir*distance,y-3-step%2,width,2);c.fillRect(x+dir*(distance+3),y-1,width+1,1);}
      if(p.kind==='pound'||p.kind==='boss'){c.fillStyle=ART.paper;c.fillRect(x-distance,y-1,4,1);c.fillRect(x+distance,y-1,4,1);}
    }
  }
  drawFireworks(fireworks:Firework[],cameraX=0,cameraY=0):void {
    const c=this.offscreenCtx;
    for(const f of fireworks){
      if(f.phase==='ROCKET'){
        c.fillStyle=ART.goldLight;c.fillRect(Math.round(f.x-cameraX),Math.round(f.y-cameraY),1,4);
        c.fillStyle=ART.orange;c.fillRect(Math.round(f.x-cameraX),Math.round(f.y-cameraY)+5,1,2);
      }else this.drawParticles(f.particles.map(p=>({...p,position:{x:p.position.x-cameraX,y:p.position.y-cameraY}})));
    }
  }
  drawOrangeRain(active:boolean):void {
    if(!active)return;
    const c=this.offscreenCtx;c.save();c.globalAlpha=.6;
    const width=GAME_WIDTH/this.zoom,height=GAME_HEIGHT/this.zoom;
    for(let i=0;i<36;i++){
      const x=hashAt(i,1)%Math.ceil(width),speed=35+hashAt(i,2)%40;
      const y=Math.floor((hashAt(i,3)%200+this.clock.time/1000*speed)%(height+16))-8;
      c.fillStyle=i%3===0?ART.goldLight:ART.orange;c.fillRect(x,y,1,3+hashAt(i,4)%5);
    }
    c.restore();
  }
  drawHUD(score:number,lives:number,time:number,level:string,soundEnabled:boolean,hasHelmet:boolean,miniFantaTimer:number,coins=0,bossHealth?:number):void {
    this.screen(c=>this.ui.hud(c,{score,lives,time,level,soundEnabled,hasHelmet,miniFantaTimer,coins,bossHealth}));
  }
  private postcard(c:CanvasRenderingContext2D):void {
    this.menuBackground.draw(c,0,15,320,180,this.clock.time);
    const ground=Array.from({length:4},()=>Array<number>(22).fill(TileType.GROUND));
    for(let row=0;row<4;row++)for(let col=0;col<22;col++)this.tiles.draw(c,TileType.GROUND,col*16,130+row*16,ground,row,col,'meadow',this.clock.time);
  }
  drawTitleScreen():void {
    if(this.editorLink)this.editorLink.hidden=false;
    this.screen(c=>{
      this.postcard(c);
      this.shadow(c,125,130,14);this.atlas.draw(c,PLAYER_SPRITES.idle,PLAYER_PALETTE,123,104);
      this.atlas.draw(c,FANTA_SPRITE,SPRITE_PALETTE,150,114);
      this.atlas.draw(c,MINION_FRAMES[animationIndex(this.clock.time,4,140)],SPRITE_PALETTE,181,110,true);
      this.ui.title(c,this.clock.time,this.touch);
    });
  }
  drawPauseOverlay():void {this.screen(c=>this.ui.pause(c,this.touch));}
  drawBoot(time:number):void {this.screen(c=>this.ui.boot(c,time));}
  drawGameOver(score:number,highScore:number,newRecord:boolean,totalRunTime:number,bestTime:number,newTimeRecord:boolean):void {
    this.screen(c=>this.ui.gameOver(c,{score,highScore,newRecord,totalRunTime,bestTime,newTimeRecord},this.touch));
  }
  drawLevelClear(level:string,score:number,timeBonus:number):void {this.screen(c=>this.ui.clear(c,level,score,timeBonus));}
  drawBossIntro(name:string):void {this.screen(c=>this.ui.bossIntro(c,name));}
  drawEnding(fireworks:Firework[],score:number,highScore:number,newRecord:boolean,totalRunTime:number,bestTime:number,newTimeRecord:boolean,endingTime=0):void {
    this.screen(c=>{
      this.postcard(c);this.drawFireworks(fireworks);
      this.shadow(c,129,130,14);this.atlas.draw(c,PLAYER_SPRITES.celebrate,PLAYER_PALETTE,127,104);
      this.shadow(c,172,130,15);this.drawYasmin(169,100);
      this.ui.ending(c,{score,highScore,newRecord,totalRunTime,bestTime,newTimeRecord},this.touch,endingTime);
    });
  }
  drawTouchControls():void {
    if(!this.touch)return;
    this.screen(c=>{
      c.globalAlpha=.72;
      for(const [x,label] of [[8,'←'],[56,'→'],[144,'↓'],[232,'X'],[280,'↑']] as const){
        panel(c,x,145,32,29,ART.ink,ART.rockLight);pixelText(c,label,x+16,153,ART.paper,2,'center');
      }
      c.globalAlpha=1;c.fillStyle=ART.paper;c.fillRect(171,7,1,7);c.fillRect(174,7,1,7);
    });
  }
  drawMenu(title:string,options:string[],selected:number):void {
    this.screen(c=>{panel(c,28,30,264,128);pixelText(c,title,160,44,ART.goldLight,2,'center');
      options.forEach((label,i)=>pixelText(c,fitText((i===selected?'→ ':'')+label,240),160,78+i*18,i===selected?ART.goldLight:ART.paper,1,'center'));
    });
  }
  drawEditorGhost(content:PaletteItem,x:number,y:number,opacity:number,ctx=this.offscreenCtx):void {
    ctx.save();ctx.globalAlpha=opacity;
    if(content.type==='TILE'){
      if(content.id===TileType.EMPTY){ctx.fillStyle=ART.red;ctx.fillRect(x,y,16,16);pixelText(ctx,'×',x+5,y+4,ART.ink);}
      else this.drawTile(content.id,x,y,[[content.id]],0,0,ctx);
    }else if(content.type==='ENTITY'){
      if(content.id==='coin')this.drawCoin(x,y,0,ctx);
      else if(content.id==='mini_fanta')this.drawFanta(x,y,0,ctx);
      else if(content.id==='helmet')this.drawHelmet(x,y,ctx);
      else if(content.id==='checkpoint'||content.id==='goal')this.drawFlagTile(x,y,ctx,content.id);
      else if(content.id==='spawn')this.atlas.draw(ctx,PLAYER_SPRITES.idle,PLAYER_PALETTE,x-1,y-26);
      else if(content.id==='minion')this.atlas.draw(ctx,MINION_FRAMES[0],SPRITE_PALETTE,x-1,y-20,true);
      else if(content.id==='boss_joaozao')this.atlas.draw(ctx,BOSS_FRAMES.idle,SPRITE_PALETTE,x-4,y-47,true);
    }
    ctx.restore();
  }
  drawTrigger(trigger:LevelTrigger,camera:CameraData,ctx=this.offscreenCtx):void {
    const x=Math.round(trigger.x-camera.x),y=Math.round(trigger.y-camera.y);
    const color=trigger.type===TriggerType.AUDIO?ART.gold:trigger.type===TriggerType.CAMERA?ART.teal:trigger.type===TriggerType.DAMAGE?ART.red:ART.leafLight;
    ctx.save();ctx.fillStyle=color;ctx.globalAlpha=.2;ctx.fillRect(x,y,trigger.width,trigger.height);ctx.globalAlpha=1;
    ctx.strokeStyle=color;ctx.lineWidth=1;ctx.setLineDash([4,2]);ctx.strokeRect(x,y,trigger.width,trigger.height);
    pixelText(ctx,fitText(trigger.type,trigger.width-4),x+trigger.width/2,y+trigger.height/2-3,color,1,'center');ctx.restore();
  }
}
