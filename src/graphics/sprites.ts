import { ART } from './palette';
import { PixelGrid } from './pixels';

export const SPRITE_PALETTE = {
  _:null, K:ART.ink, k:ART.inkLight, W:ART.white,
  R:ART.red, r:ART.redDark, L:ART.redLight,
  G:ART.green, g:ART.greenDark, l:ART.greenLight,
  P:ART.purple, p:ART.purpleDark, H:ART.purpleLight,
  Y:ART.gold, y:ART.goldDark, B:ART.goldLight,
  T:ART.teal, t:ART.tealDark, C:ART.tealLight,
  S:ART.skin, s:ART.skinDark, f:ART.skinLight,
  O:ART.orange, o:ART.orangeDark, F:ART.orangeLight,
  h:ART.hair, a:ART.hairLight,
};

function minion(frame: number) {
  const g=new PixelGrid(18,20), bob=frame%2;
  const foot=frame===1?-1:frame===3?1:0;
  g.rect(2-foot,17,5,3,'K').rect(11+foot,17,5,3,'K').rect(3-foot,17,3,1,'r').rect(12+foot,17,3,1,'r');
  g.rect(4,2+bob,9,1,'K').rect(2,3+bob,13,2,'K').rect(1,5+bob,16,9,'K').rect(2,14+bob,13,3,'K');
  g.rect(3,5+bob,12,9,'R').rect(5,3+bob,7,2,'R').rect(2,7+bob,14,5,'R');
  g.rect(4,4+bob,6,2,'L').rect(3,6+bob,2,2,'L').rect(3,14+bob,11,2,'r').rect(14,8+bob,2,6,'r');
  g.rect(4,8+bob,4,4,'W').rect(10,8+bob,4,4,'W').rect(6,9+bob,2,2,'K').rect(12,9+bob,2,2,'K');
  g.line(3,6+bob,7,8+bob,'K').line(10,8+bob,14,6+bob,'K');
  g.rect(7,13+bob,5,1,'K').dot(11,12+bob,'W');
  return g.finish();
}
export const MINION_FRAMES=Array.from({length:4},(_,i)=>minion(i));
export const MINION_SQUASH=new PixelGrid(18,20).rect(1,16,16,3,'K').rect(3,15,12,3,'R').rect(4,16,4,1,'L').rect(11,16,3,1,'W').finish();

function boss(pose: 'idle'|'walk'|'windup'|'smash'|'hurt'|'shoot'|'dead', frame=0) {
  const g=new PixelGrid(40,48);
  const dy=pose==='smash'?4:pose==='windup'?-2:pose==='hurt'?1:0;
  const body=20+dy;
  const step=pose==='walk'?(frame%2===0?-1:1):0;
  g.rect(9,35,10,10,'K').rect(24,35,9,10,'K').rect(11,36,6,7,'p').rect(25,36,5,7,'p');
  g.rect(7-step,43,12,4,'K').rect(24+step,43,11,4,'K').rect(9-step,43,8,1,'k').rect(25+step,43,8,1,'k');
  g.rect(7,body,27,18,'K').rect(9,body,23,16,'P').rect(10,body+1,9,3,'H').rect(27,body+4,5,12,'p');
  g.rect(12,body+14,17,2,'p').rect(18,body+12,5,4,'K').rect(19,body+13,3,2,'Y');
  g.rect(14,body-4,13,6,'g');
  const ay=pose==='windup'?5:pose==='smash'?body+4:pose==='shoot'?body-2:body+1;
  for(const x of [2,31]) {
    g.rect(x,ay,8,17,'K').rect(x+1,ay+1,6,14,'G').rect(x+1,ay+1,3,7,'l').rect(x+5,ay+5,2,10,'g');
    g.rect(x,ay+12,9,7,'K').rect(x+1,ay+13,7,5,'G').rect(x+2,ay+13,5,1,'l');
    g.dot(x+3,ay+16,'g').dot(x+6,ay+16,'g');
  }
  const hy=7+dy;
  g.rect(10,hy,21,17,'K').rect(9,hy+5,23,8,'K').rect(11,hy+1,19,14,'G');
  g.rect(12,hy+3,15,4,'l').rect(27,hy+5,3,10,'g').rect(13,hy+15,15,2,'g');
  g.rect(10,hy-2,20,5,'K').rect(11,hy-3,5,4,'g').rect(17,hy-4,5,5,'g').rect(24,hy-2,5,3,'g');
  g.rect(12,hy+7,7,4,'W').rect(22,hy+7,6,4,'W').rect(16,hy+8,3,3,'K').rect(25,hy+8,3,3,'K');
  g.line(11,hy+5,19,hy+7,'K').line(22,hy+7,29,hy+4,'K');
  g.rect(15,hy+12,12,3,'K').rect(16,hy+12,9,1,'W').dot(16,hy+14,'W').dot(25,hy+14,'W');
  g.rect(20,hy+9,3,2,'g');
  if(pose==='hurt'||pose==='dead') {g.rect(12,hy+7,7,4,'G').rect(22,hy+7,6,4,'G').line(14,hy+7,18,hy+10,'K').line(18,hy+7,14,hy+10,'K').line(23,hy+7,27,hy+10,'K').line(27,hy+7,23,hy+10,'K');}
  return g.finish();
}
export const BOSS_FRAMES={idle:boss('idle'),walk:[boss('walk',0),boss('walk',1)],windup:boss('windup'),smash:boss('smash'),hurt:boss('hurt'),shoot:boss('shoot'),dead:boss('dead')};

function yasmin(frame:number) {
  const g=new PixelGrid(20,30);
  g.rect(5,3,11,18,'K').rect(3,7,14,15,'h').rect(4,6,4,10,'a');
  g.rect(6,7,9,9,'S').rect(7,7,7,4,'f').rect(6,5,9,4,'h');
  g.rect(6,7,3,3,'h').rect(13,7,2,3,'h');
  g.rect(8,10,2,2,'K').rect(12,10,2,2,'K').dot(8,10,'W').dot(12,10,'W');
  g.rect(10,13,3,1,'s').rect(8,15,6,2,'s');
  g.rect(7,16,8,7,'K').rect(8,16,6,6,'P').rect(9,17,4,2,'H').dot(11,17,'Y');
  g.rect(5,19,3,5,'K').rect(6,19,2,4,'f').rect(14,18-frame,3,5,'K').rect(14,19-frame,2,3,'f');
  for(let y=22;y<28;y++) {const width=10+(y-22);g.rect(10-Math.floor(width/2),y,width,1,'K').rect(11-Math.floor(width/2),y,width-2,1,'P');}
  g.rect(8,22,3,5,'H').rect(12,24,2,3,'p').rect(4,27,14,1,'H').rect(6,28,4,2,'K').rect(12,28,4,2,'K');
  g.rect(5,3,12,2,'y').rect(6,1,2,3,'Y').rect(10,0,2,4,'Y').rect(14,1,2,3,'Y').rect(6,3,10,1,'B').dot(10,3,'R');
  return g.finish();
}
export const YASMIN_FRAMES=[yasmin(0),yasmin(1)];

function coin(frame:number){
  const g=new PixelGrid(16,16), widths=[9,7,3,1,3,7], w=widths[frame], x=Math.floor((16-w)/2);
  g.rect(x,2,w,12,'y').rect(x-1,4,w+2,8,'y').rect(x,3,w,10,'Y');
  if(w>3){g.rect(x+1,3,2,9,'B').rect(x+3,4,2,7,'y').rect(x+3,4,1,6,'B');}
  g.rect(x,2,w,1,'B').dot(x,3,'W');return g.finish();
}
export const COIN_FRAMES=Array.from({length:6},(_,i)=>coin(i));
export const FANTA_SPRITE=new PixelGrid(16,16).rect(4,2,8,13,'K').rect(5,3,6,11,'O').rect(5,4,1,8,'F').rect(10,4,1,9,'o')
  .rect(5,2,6,2,'W').rect(7,2,2,1,'k').rect(5,7,6,4,'W').rect(6,8,3,1,'T').rect(6,9,1,1,'T').rect(5,13,6,1,'F').finish();
export const PROJECTILE_FRAMES=[0,1,2,3].map(i=>new PixelGrid(10,10).rect(3,0,4,10,'p').rect(0,3,10,4,'p').rect(2,2,6,6,'P').rect(3,2,4,5,'H').rect(3+i%2,3,3,3,'W').finish());
