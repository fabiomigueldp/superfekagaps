import {PLAYER_CAPTURE,PLAYER_PALETTE,PLAYER_SPRITES} from '../../assets/playerSpriteSpec';
import {polygon,type Point} from '../WorldPainting';

export interface CapturedHeroPose { x:number; y:number; angle:number; facing:number; frame:number; impact?:boolean }
export interface HeldHero { frame:number; swallow:number; facing:number; angle:number }

/** Rotate the actual Feka pixels on the game's scanline grid. The throat clips
 * their polygons; the character never shrinks into a dot. */
export function drawCapturedHero(c:CanvasRenderingContext2D,p:CapturedHeroPose,transform:(point:Point)=>Point=p=>p,throat=-Infinity) {
    const frame=p.impact?PLAYER_SPRITES.deathImpact:PLAYER_CAPTURE[p.frame%PLAYER_CAPTURE.length];
    const co=Math.cos(p.angle),si=Math.sin(p.angle);
    const local=(x:number,y:number):Point=>[p.x+(x*co-y*si),p.y+(x*si+y*co)];
    for(let y=0;y<frame.length;y++)for(let x=0;x<frame[y].length;x++){
        const color=PLAYER_PALETTE[frame[y][x]];if(!color)continue;
        const xx=(x-8)*p.facing,yy=y-13;
        let visible=[local(xx,yy),local(xx+p.facing,yy),local(xx+p.facing,yy+1),local(xx,yy+1)];
        // Clip the polygon at the throat, rather than deleting a whole rotated
        // pixel by its center and making the last limb flicker between frames.
        if(Number.isFinite(throat)){
            const clipped:Point[]=[];
            for(let i=0;i<visible.length;i++){
                const a=visible[i],b=visible[(i+1)%visible.length],inside=a[0]>=throat;
                if(inside)clipped.push(a);
                if(inside!==(b[0]>=throat)){
                    const t=(throat-a[0])/(b[0]-a[0]);clipped.push([throat,a[1]+(b[1]-a[1])*t]);
                }
            }
            visible=clipped;
        }
        if(visible.length>=3)polygon(c,visible.map(transform),color);
    }
}
