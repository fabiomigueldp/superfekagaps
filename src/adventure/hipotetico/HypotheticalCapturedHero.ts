import {PLAYER_CAPTURE,PLAYER_PALETTE,PLAYER_SPRITES} from '../../assets/playerSpriteSpec';
import {polygon,type Point} from '../WorldPainting';

export interface CapturedHeroPose { x:number; y:number; angle:number; facing:number; frame:number; impact?:boolean }
export interface HeldHero { frame:number; swallow:number; facing:number }

/** Rotate the actual Feka pixels on the game's scanline grid. The optional
 * throat plane occludes whole pixels; the character never shrinks into a dot. */
export function drawCapturedHero(c:CanvasRenderingContext2D,p:CapturedHeroPose,transform:(point:Point)=>Point=p=>p,throat=-Infinity) {
    const frame=p.impact?PLAYER_SPRITES.deathImpact:PLAYER_CAPTURE[p.frame%PLAYER_CAPTURE.length];
    const co=Math.cos(p.angle),si=Math.sin(p.angle);
    const local=(x:number,y:number):Point=>[p.x+(x*co-y*si),p.y+(x*si+y*co)];
    for(let y=0;y<frame.length;y++)for(let x=0;x<frame[y].length;x++){
        const color=PLAYER_PALETTE[frame[y][x]];if(!color)continue;
        const xx=(x-8)*p.facing,yy=y-13;
        if(local(xx+p.facing*.5,yy+.5)[0]<throat)continue;
        polygon(c,[local(xx,yy),local(xx+p.facing,yy),local(xx+p.facing,yy+1),local(xx,yy+1)].map(transform),color);
    }
}
