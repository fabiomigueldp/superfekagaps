import { ART } from '../graphics/palette';
import { PixelGrid } from '../graphics/pixels';

export const PLAYER_PALETTE: Record<string, string | null> = {
  _: null, K: ART.ink, H: ART.hair, h: ART.hairLight,
  S: ART.skin, s: ART.skinDark, L: ART.skinLight,
  B: ART.blue, b: ART.blueLight, D: ART.blueDark,
  W: ART.white, G: ART.rockLight, Y: ART.gold, y: ART.goldDark, l: ART.goldLight,
};
export const PLAYER_FRAME_W = 16;
export const PLAYER_FRAME_H = 26;
export const PLAYER_HELMET_H = 8;
export const PLAYER_PIXEL_SIZE = 1;
export const PLAYER_HITBOX_W = 14;
export const PLAYER_HITBOX_H = 24;
export const PLAYER_RENDER_OFFSET_X = -1;
export const PLAYER_RENDER_OFFSET_Y = -2;

type Pose = 'idle' | 'walk' | 'jump' | 'fall' | 'windup' | 'sit' | 'land' | 'hurt' | 'deathImpact' | 'deathCrouch' | 'deathRise' | 'deathFall' | 'celebrate';
function hero(pose: Pose, frame = 0): string[] {
  const g = new PixelGrid(16, 26);
  const dying = pose.startsWith('death');
  const seated = pose === 'sit' || pose === 'land' || pose === 'deathCrouch';
  const headY = seated ? 7 : pose === 'windup' ? 3 : pose === 'deathImpact' ? 2 : pose === 'walk' && frame % 3 === 1 ? 1 : 0;
  const hipY = seated ? 23 : 19;
  if (seated) {
    g.rect(3,21,11,4,'K').rect(4,21,9,2,'D').rect(2,24,5,2,'K').rect(10,24,5,2,'K');
    g.rect(3,24,3,1,'G').rect(11,24,3,1,'G');
  } else if (pose === 'deathRise') {
    g.rect(2,19,5,4,'K').rect(3,20,3,2,'D').rect(1,22,6,3,'K').rect(2,22,4,1,'G');
    g.rect(10,19,5,4,'K').rect(11,20,3,2,'B').rect(10,22,6,3,'K').rect(11,22,4,1,'G');
  } else if (pose === 'deathFall') {
    g.rect(3,18,4,7,'K').rect(4,19,2,5,'D').rect(2,24,5,2,'K').rect(3,24,3,1,'G');
    g.rect(10,18,4,6,'K').rect(11,19,2,4,'B').rect(10,23,6,2,'K').rect(11,23,4,1,'G');
  } else if (pose === 'jump' || pose === 'windup' || pose === 'fall') {
    g.rect(4,18,4,6,'K').rect(5,18,2,4,'D').rect(2,23,5,2,'K');
    if (pose === 'fall') g.rect(10,18,4,7,'K').rect(11,19,2,5,'B').rect(10,24,6,2,'K').rect(11,24,3,1,'G');
    else g.rect(9,18,4,3,'K').rect(11,20,4,3,'K').rect(10,19,2,2,'B').rect(12,23,4,2,'K');
  } else if (pose === 'walk') {
    const steps = [[-2,2,0,-2],[-1,1,0,-3],[0,0,0,-1],[2,-2,-2,0],[1,-1,-3,0],[0,0,-1,0]][frame % 6];
    for (let leg=0;leg<2;leg++) {
      const hx=leg===0?5:10, fx=hx+steps[leg], fy=24+steps[leg+2];
      for(let i=0;i<=5;i++) { const x=Math.round(hx+(fx-hx)*i/5), y=Math.round(19+(fy-19)*i/5);g.rect(x-1,y,4,2,'K').rect(x,y,2,1,leg===0?'D':'B'); }
      g.rect(fx-1,fy,5,2,'K').rect(fx,fy,3,1,'G');
    }
  } else {
    g.rect(4,18,4,7,'K').rect(10,18,4,7,'K').rect(5,19,2,5,'D').rect(11,19,2,5,'B');
    g.rect(3,24,5,2,'K').rect(10,24,6,2,'K').rect(4,24,3,1,'G').rect(11,24,3,1,'G');
  }
  const bodyY = seated ? 17 : 11 + Math.min(headY, 2);
  g.rect(4,bodyY,9,hipY-bodyY+2,'K').rect(5,bodyY+1,7,hipY-bodyY,'B');
  g.rect(5,bodyY+1,5,2,'b').rect(10,bodyY+3,2,Math.max(1,hipY-bodyY-2),'D');
  g.rect(5,hipY,7,1,'D').dot(8,hipY,'y');
  if (pose === 'deathImpact') {
    g.rect(0,bodyY+1,5,3,'K').rect(1,bodyY+1,3,1,'D').rect(0,bodyY+3,2,2,'s');
    g.rect(12,bodyY+1,4,3,'K').rect(13,bodyY+1,2,1,'B').rect(14,bodyY+3,2,2,'L');
  } else if (pose === 'deathRise') {
    g.rect(0,bodyY-2,5,5,'K').rect(1,bodyY-3,2,3,'S').rect(2,bodyY+1,2,1,'D');
    g.rect(12,bodyY-2,4,5,'K').rect(13,bodyY-3,2,3,'L').rect(13,bodyY+1,2,1,'B');
  } else if (pose === 'deathFall') {
    g.rect(1,bodyY+3,4,7,'K').rect(2,bodyY+4,2,2,'D').rect(1,bodyY+8,2,2,'s');
    g.rect(12,bodyY+3,4,7,'K').rect(13,bodyY+4,2,2,'B').rect(14,bodyY+8,2,2,'L');
  } else if (pose==='jump'||pose==='celebrate'||pose==='windup'||pose==='fall') {
    g.rect(1,bodyY-2,4,6,'K').rect(2,bodyY-3,2,3,'S').rect(2,bodyY+1,2,2,'B');
    g.rect(12,bodyY-3,4,6,'K').rect(13,bodyY-4,2,3,'L').rect(13,bodyY,2,2,'B');
  } else if (seated) {
    g.rect(1,bodyY+1,4,6,'K').rect(2,bodyY+2,2,2,'B').rect(2,bodyY+4,2,2,'L');
    g.rect(12,bodyY+1,4,6,'K').rect(13,bodyY+2,2,2,'b').rect(13,bodyY+4,2,2,'S');
  } else {
    const swing=pose==='walk'?[0,-2,-1,1,2,1][frame%6]:0;
    g.rect(2,bodyY+1-swing,4,6,'K').rect(3,bodyY+2-swing,2,2,'D').rect(3,bodyY+4-swing,2,2,'s');
    g.rect(11,bodyY+1+swing,4,6,'K').rect(12,bodyY+2+swing,2,2,'B').rect(12,bodyY+4+swing,2,2,'L');
  }
  // A single-pixel outline, warm face and readable glasses shared by all poses.
  g.rect(5,headY,7,1,'K').rect(3,headY+1,11,9,'K').rect(4,headY+2,9,8,'S');
  g.rect(4,headY+1,9,4,'H').rect(5,headY+1,6,1,'h').dot(4,headY+3,'h');
  g.rect(3,headY+4,2,5,'H').rect(4,headY+7,2,2,'s');
  g.rect(6,headY+4,7,2,'L').rect(12,headY+7,3,2,'S').dot(14,headY+7,'L');
  g.rect(5,headY+6,4,3,'K').rect(10,headY+6,4,3,'K').dot(9,headY+6,'K');
  if (dying) {
    if (pose === 'deathImpact') {
      g.rect(6,headY+7,2,2,'W').dot(7,headY+8,'K');
      g.rect(11,headY+7,2,2,'W').dot(12,headY+8,'K');
    } else {
      g.dot(6,headY+6,'W').dot(8,headY+8,'W').dot(8,headY+6,'W').dot(6,headY+8,'W');
      g.dot(11,headY+6,'W').dot(13,headY+8,'W').dot(13,headY+6,'W').dot(11,headY+8,'W');
    }
  } else if(pose!=='hurt' && !(pose==='idle'&&frame===1)) { g.rect(6,headY+7,2,1,'W').dot(7,headY+7,'K').rect(11,headY+7,2,1,'W').dot(12,headY+7,'K'); }
  g.rect(6,headY+9,7,2,'S').rect(7,headY+11,4,1,'s').rect(10,headY+10,3,1,pose==='hurt'?'K':'s');
  if (dying) g.rect(6,headY+9,7,3,'S').rect(9,headY+9,3,3,'K').dot(10,headY+10,'s');
  return g.finish();
}
const helmet = new PixelGrid(16,8).rect(5,0,6,1,'K').rect(3,1,10,5,'K').rect(4,1,8,4,'Y')
  .rect(5,1,2,3,'l').rect(11,2,1,3,'y').rect(1,5,14,2,'K').rect(2,5,12,1,'Y').rect(6,0,2,5,'l').finish();

export const PLAYER_SPRITES = {
  idle: hero('idle'), blink: hero('idle',1),
  walk1: hero('walk',0), walk2: hero('walk',1), walk3: hero('walk',2),
  walk4: hero('walk',3), walk5: hero('walk',4), walk6: hero('walk',5),
  jump: hero('jump'), fall: hero('fall'), windup: hero('windup'), sit: hero('sit'),
  land: hero('land'), hurt: hero('hurt'),
  deathImpact: hero('deathImpact'), deathCrouch: hero('deathCrouch'),
  deathRise: hero('deathRise'), deathFall: hero('deathFall'),
  celebrate: hero('celebrate'), helmet,
};
export const PLAYER_WALK = [PLAYER_SPRITES.walk1,PLAYER_SPRITES.walk2,PLAYER_SPRITES.walk3,PLAYER_SPRITES.walk4,PLAYER_SPRITES.walk5,PLAYER_SPRITES.walk6];
