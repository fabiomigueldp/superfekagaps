import { box as r, pixelLine as line, polygon, type Point } from '../../WorldPainting';
import { GUAIRA_FLOW_STEP, guairaFluidTime as clock } from './GuairaFluidArt';

/** Decoration only: callers supply the game's clock and the real bridge's active state. */

/** Keep every moving reflection inside the authored water, on the native pixel grid. */
function waterWindow(c: CanvasRenderingContext2D, x: number, y: number, width: number, height: number,
    paint: (left: number, top: number, w: number, h: number) => void) {
    const left = Math.round(x), top = Math.round(y), w = Math.round(width), h = Math.round(height);
    if (w <= 0 || h <= 0) return;
    c.save();
    c.beginPath(); c.rect(left, top, w, h); c.clip();
    paint(left, top, w, h);
    c.restore();
}

/** Four rigid sails turn around one fixed axle; the tower never rotates or changes pose. */
export function drawGuairaWindPump(c: CanvasRenderingContext2D, x: number, y: number,
    time: number, reducedMotion: boolean) {
    c.save();
    x = Math.round(x); y = Math.round(y);
    // Preserve the original tower, its footprint and all of its cross braces.
    line(c, x - 9, y, x - 3, y - 55, '#a17e62', 2);
    line(c, x + 10, y, x + 3, y - 55, '#97745b', 2);
    for (let yy = 8; yy < 45; yy += 12) {
        line(c, x - 7, y - yy, x + 7, y - yy - 9, '#ae8c68');
        r(c, x - 7, y - yy, 14, 2, '#bf9d72');
    }
    const hubY = y - 57;
    const angle = (clock(time, reducedMotion) % 9600) * Math.PI * 2 / 9600 - Math.PI / 8;
    for (let blade = 0; blade < 4; blade++) {
        const a = angle + blade * Math.PI / 2, dx = Math.cos(a), dy = Math.sin(a);
        const point = (radius: number, across: number): Point =>
            [Math.round(x + dx * radius - dy * across), Math.round(hubY + dy * radius + dx * across)];
        const root = point(3, 0), tip = point(13, 0);
        line(c, root[0], root[1], tip[0], tip[1], '#957257');
        // A narrow root and a broad outer sail share the same radial transform.
        polygon(c, [point(5, -1), point(13, -1), point(13, 3), point(6, 1)], '#bd936a');
        const brightRoot = point(6, -1), brightTip = point(12, -1);
        line(c, brightRoot[0], brightRoot[1], brightTip[0], brightTip[1], '#d1ac77');
    }
    // Stationary bearing masks all sail roots, preventing a wobbling centre.
    r(c, x - 2, hubY - 2, 5, 5, '#ae875f');
    r(c, x - 1, hubY - 1, 3, 3, '#dbb079');
    r(c, x, hubY, 1, 1, '#80664f');
    c.restore();
}

/** Surface trails follow the outlet: left toward town, right toward the rice fields. */
export function drawGuairaChannelFlow(c: CanvasRenderingContext2D, left: number, right: number, y: number,
    wet: boolean, time: number, reducedMotion: boolean, direction: -1 | 1 = 1) {
    if (!wet) return;
    const drift = Math.floor(clock(time, reducedMotion) / GUAIRA_FLOW_STEP.channel) % 32;
    waterWindow(c, left, y + 2, right - left, 3, (x, top, width) => {
        for (let offset = -32; offset < width + 32; offset += 32) {
            const head = x + offset + direction * drift;
            r(c, head, top + 1, 5, 1, '#a6d6c8');
            r(c, head - direction * 4, top + 2, 2, 1, '#85c6c1');
        }
    });
}

/** Called before the rice stalks, so the crop and its earth berm always occlude the water. */
export function drawGuairaRiceFlow(c: CanvasRenderingContext2D, x: number, y: number, width: number,
    wet: boolean, time: number, reducedMotion: boolean, row = 0) {
    if (!wet) return;
    const drift = Math.floor(clock(time, reducedMotion) / GUAIRA_FLOW_STEP.rice) % 39;
    waterWindow(c, x + 2, y + 6, width - 4, 6, (left, top, w) => {
        for (let offset = -39; offset < w + 39; offset += 39) {
            const head = left + offset + drift + row * 11;
            r(c, head, top + 1, 5, 1, '#b4cbb0');
            r(c, head - 9, top + 4, 3, 1, '#9dbfa6');
        }
    });
}

/** Surface currents converge on the basin's front throat, then descend into the gate.
 * Only the local valve draws water; a filled but closed basin remains still. */
export function drawGuairaReservoirFlow(c: CanvasRenderingContext2D, x: number, y: number,
    flowing: boolean, time: number, reducedMotion: boolean) {
    if (!flowing) return;
    const t=clock(time,reducedMotion), drift=Math.floor(t/GUAIRA_FLOW_STEP.surface)%22;
    for (const [row,inset] of [[7,14],[11,23]]) for (const side of [-1,1]) {
        const centre=x+42, left=side<0?x+inset:centre, right=side<0?centre:x+84-inset;
        waterWindow(c,left,y+row,right-left,1,(_left,top)=>{
            for (let offset=-22; offset<66; offset+=22) {
                const distance=offset-drift;
                r(c,side<0?centre-distance-4:centre+distance,top,4,1,'#beddd0');
            }
        });
    }
    const fall=Math.floor(t/GUAIRA_FLOW_STEP.falling)%13;
    waterWindow(c,x+35,y+13,14,13,(left,top)=>{
        for (let offset=-13; offset<26; offset+=13) {
            r(c,left+4,top+offset+fall,5,1,'#b5d7c8');
            r(c,left+6,top+offset+fall+1,2,2,'#8bbfb6');
        }
    });
}

/** Vertical threads descend within the existing spill; geometry follows the real gate. */
export function drawGuairaSluiceFlow(c: CanvasRenderingContext2D, x: number, spillY: number, bottomY: number,
    wet: boolean, time: number, reducedMotion: boolean, flowOriginY = spillY) {
    if (!wet) return;
    const drift = Math.floor(clock(time, reducedMotion) / GUAIRA_FLOW_STEP.falling) % 19;
    waterWindow(c, x + 17, spillY, 18, bottomY - spillY, (left, top, _w, height) => {
        const origin = Math.round(flowOriginY);
        const first = origin + Math.floor((top-origin)/19)*19-19;
        for (let yy = first+drift; yy < top+height+19; yy += 19) {
            r(c, left + 6, yy, 2, 3, '#a6d6c8');
            r(c, left + 7, yy + 3, 2, 5, '#85c6c1');
            r(c, left + 8, yy + 8, 1, 3, '#85c6c1');
            r(c, left + 1, yy + 9, 1, 7, '#8bcec7');
            r(c, left + 15, yy + 5, 1, 5, '#77c1c0');
        }
    });
}

/** The pool's existing surface marks drift away from the falling water without a reset jump. */
export function drawGuairaPoolFlow(c: CanvasRenderingContext2D, left: number, right: number, y: number,
    wet: boolean, time: number, reducedMotion: boolean, sourceX = (left + right) / 2) {
    if (!wet) return;
    const drift = Math.floor(clock(time, reducedMotion) / GUAIRA_FLOW_STEP.surface) % 27;
    const source = Math.round(Math.max(left, Math.min(right, sourceX)));
    // Mirrored fronts originate at the falling stream, not at the pool's left edge.
    for (const direction of [-1, 1] as const) {
        const from = direction < 0 ? left : source, to = direction < 0 ? source : right;
        waterWindow(c, from, y + 3, to - from, 1, (_x, top) => {
            for (let offset = -27; offset < right - left + 27; offset += 27) {
                const distance=offset+drift;
                r(c, direction<0 ? source-distance-9 : source+distance, top, 9, 1, '#b0dcce');
            }
        });
    }
}

/** Submerged reflections fade with depth. The source stays tied to the spill;
 * muted blue-green marks never borrow the cyan used for damaging pressure. */
export function drawGuairaPoolDepth(c:CanvasRenderingContext2D,left:number,right:number,y:number,
    wet:boolean,time:number,reduced:boolean,sourceX=(left+right)/2) {
    if(!wet)return;
    const source=Math.round(Math.max(left,Math.min(right,sourceX))),t=clock(time,reduced);
    for(const side of [-1,1])waterWindow(c,side<0?left:source,y+5,side<0?source-left:right-source,17,(_x,top)=>{
        for(let row=0;row<3;row++){
            const spread=Math.floor(t/(110+row*40))+row*13;
            for(let offset=-42;offset<right-left+42;offset+=42){
                const distance=offset+spread%42;
                const width=9-row*2,x=side<0?source-distance-width:source+distance;
                r(c,x,top+row*5,width,1,row===0?'#57949a':'#427f89');
                r(c,x+(side<0?2:0),top+row*5+1,Math.max(2,width-3),1,'#3c7784');
            }
        }
    });
}

/** Overlapping rings expand from the falling sheet and lose contrast as they
 * settle. Independent ages prevent the whole impact patch snapping to one pose. */
export function drawGuairaSluiceImpact(c: CanvasRenderingContext2D, left: number, right: number, y: number,
    sourceX: number, wet: boolean, time: number, reducedMotion: boolean) {
    if (!wet) return;
    const t=clock(time,reducedMotion),source=Math.round(sourceX);
    const spread=Math.round(1+Math.sin(t*Math.PI*2/840));
    waterWindow(c,left,y,right-left,4,(_x,top)=>{
        r(c,source-10-spread,top,20+spread*2,1,'#8bcec7');
        r(c,source-7,top+1,14,2,'#a8d6c5');
        for(const delay of [0,280]){
            const age=((t+delay)%840)/840,distance=3+Math.round(age*16),width=age<.5?3:2;
            for (const side of [-1,1]) {
                r(c,side<0?source-distance-width:source+distance,top+1+Math.floor(age*2),width,1,
                    age<.48?'#c2dfcb':'#85c6c1');
            }
        }
        r(c,source-2,top,4,1,'#d0e5cf');
    });
}

/** Small receiving basins have gentle, overlapping currents contained in four
 * native pixels. The intake owns the origin, even when it sits at one edge. */
export function drawGuairaDrainSurface(c:CanvasRenderingContext2D,left:number,right:number,y:number,
    sourceX:number,time:number,reduced:boolean) {
    const source=Math.round(Math.max(left,Math.min(right,sourceX))),t=clock(time,reduced);
    for(const side of [-1,1])waterWindow(c,side<0?left:source,y,side<0?source-left:right-source,4,(_x,top)=>{
        for(let row=0;row<2;row++){
            const drift=Math.floor(t/(GUAIRA_FLOW_STEP.surface+row*40))%23;
            for(let offset=-23;offset<right-left+23;offset+=23){
                const distance=offset+drift+row*9,width=row?3:5;
                r(c,side<0?source-distance-width:source+distance,top+row*2,width,1,row?'#80afa7':'#b4c5ac');
            }
        }
    });
    waterWindow(c,left,y,right-left,4,(_x,top)=>{
        const spread=Math.round(1+Math.sin(t*Math.PI*2/720));
        r(c,source-2-spread,top,4+spread*2,1,'#9dc3b1');
        r(c,source-1,top+1,3,1,'#bad0b5');
    });
}

/** A narrow open-air stream leaves a cast mouth and enters the receiving water.
 * Reflections cross both ends by clipping; no whole streak teleports at a wrap. */
export function drawGuairaSpoutFlow(c:CanvasRenderingContext2D,x:number,top:number,bottom:number,
    time:number,reduced:boolean) {
    waterWindow(c,x,top,3,bottom-top,(left,y,_w,height)=>{
        r(c,left,y,3,height,'#80afa7');r(c,left,y,1,height,'#62958e');
        const drift=Math.floor(clock(time,reduced)/GUAIRA_FLOW_STEP.falling)%11;
        for(let offset=-11;offset<height+11;offset+=11)r(c,left+1,y+offset+drift,1,3,'#bad0b5');
    });
}
