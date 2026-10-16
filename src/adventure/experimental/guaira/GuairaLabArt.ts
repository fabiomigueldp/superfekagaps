import { drawSkeletonBull } from './SkeletonBullArt';
import { drawBullBones } from './SkeletonBullBoneArt';
import { drawGuairaClayGrain } from './GuairaMaterials';
import { bullBoneY, BULL_RULES, type SkeletonBullModel } from './SkeletonBullModel';
import { box as r, pixelLine as line, polygon, oval, roof } from '../../WorldPainting';
import { drawGuairaLandscape, drawGuairaTree, drawGuairaPerchedBird, guairaBreeze, sceneryTime } from './GuairaScenery';

const rect = (c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => {
    c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h);
};

/** An inhabited corral, with every prop rooted behind a quiet combat lane. */
export function drawGuairaBackground(c: CanvasRenderingContext2D, cx = 0, cy = 64, time = 0, reducedMotion = false, bull?:SkeletonBullModel) {
    const x = Number.isFinite(cx) ? Math.round(cx) : 0, y = Number.isFinite(cy) ? Math.round(cy) : 64;
    const t = sceneryTime(time, reducedMotion);
    c.save(); c.beginPath(); c.rect(0, 0, 320, 180); c.clip();
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    drawGuairaLandscape(c, x, y, t, reducedMotion, 'corral');
    // Far fields follow the same dry banks as the approach to Ossabravo.
    r(c, 0, 155 - y, 320, 180, '#b8a47b');
    for (const [left, top, width] of [[-15,155,124],[191,151,143]] as const) {
        polygon(c, [[left-x,top-y],[left+width-x,top+3-y],[left+width+14-x,top+14-y],[left-5-x,top+11-y]], '#8f9d72');
        line(c, left + 6 - x, top + 8 - y, left + width - 5 - x, top + 9 - y, '#aeb99a', 2);
        for (let xx = left + 9; xx < left + width; xx += 17) {
            const sway = guairaBreeze(t, xx, 1);
            line(c, xx - x, top + 9 - y, xx - 2 + sway - x, top + 3 - y, '#7e9368');
            line(c, xx + 1 - x, top + 9 - y, xx + 4 + sway - x, top + 2 - y, '#9caa79');
        }
    }
    r(c, 0, 174 - y, 320, 180, '#bf926b');
    polygon(c, [[112-x,174-y],[177-x,174-y],[225-x,209-y],[72-x,209-y]], '#cda177');
    drawCorralGate(c,x,y,t,reducedMotion,bull);
    // Shade trees frame the arena, never hide the bull's feet or charge warning.
    drawGuairaTree(c, 18 - x, 194 - y, 90, t, 18);
    drawGuairaTree(c, 309 - x, 193 - y, 68, t, 309, true);
    // Worn fence has ordinary dull upper edges, no platform-coloured cap.
    for (let wx = -7; wx < 340; wx += 37) {
        oval(c, wx - 3 - x, 196 - y, 12, 3, '#ae8663');
        r(c, wx - x, 172 - y, 4, 26, '#9c805f');
        r(c, wx + 1 - x, 174 - y, 1, 23, '#b6a075');
        r(c, wx - x, 179 - y, 38, 3, '#a48a65');
        r(c, wx - x, 191 - y, 38, 2, '#a48a65');
        if (wx % 2) line(c, wx + 5 - x, 190 - y, wx + 34 - x, 182 - y, '#ad946d');
    }
    // Compact feed trough belongs to the fence line, with a soil contact shadow.
    oval(c, 42 - x, 202 - y, 42, 4, '#af865e');
    polygon(c, [[44-x,191-y],[79-x,191-y],[75-x,202-y],[48-x,202-y]], '#a58a62');
    r(c, 45 - x, 191 - y, 33, 3, '#8d7a59');
    r(c, 49 - x, 191 - y, 25, 1, '#b6aa77');
    if(bull?.state==='defeated'){
        const filled=reducedMotion||bull.stateTick>=BULL_RULES.collapse;
        if(filled){r(c,49-x,193-y,25,2,'#8eafa0');r(c,51-x,193-y,13,1,'#c2d0ae');}
    }
    // Broad, quiet clay in front keeps the bone silhouettes and tells readable.
    r(c, 0, 207 - y, 320, 23, '#bb865e');
    for (const [wx, wy, width] of [[13,214,11],[113,218,18],[190,211,10],[274,216,19]])
        r(c, wx - x, wy - y, width, 1, '#c5976b');
    c.restore();
}

/** The sluice is scenery, behind the combat fence. Its opening is a consequence
 * of the real victory, never a second switch or a false platform. */
function drawCorralGate(c:CanvasRenderingContext2D,x:number,y:number,t:number,reduced:boolean,bull?:SkeletonBullModel){
    const box=(wx:number,wy:number,w:number,h:number,color:string)=>r(c,wx-x,wy-y,w,h,color);
    const released=bull?.state==='defeated',age=released?bull.stateTick:0;
    const lift=released?(reduced?37:Math.min(37,Math.max(0,Math.floor((age-12)*37/48)))):0;
    oval(c,109-x,194-y,88,6,'#ac835f');
    box(115,134,74,61,'#a18164');box(119,136,66,56,'#c4aa80');
    box(119,136,66,3,'#dcc195');box(119,139,66,3,'#b19672');
    box(128,143,46,48,'#746d59');box(131,145,40,45,'#8d8d70');
    if(lift){box(132,189-lift,38,lift,'#6e8c7b');box(135,190-Math.min(lift,13),32,Math.min(lift,13),'#8aaa90');}
    c.save();c.beginPath();c.rect(131-x,145-y,40,45);c.clip();
    for(let row=0;row<7;row++){
        const top=145+row*7-lift;
        box(132,top,38,6,row%2?'#b39b75':'#bca47d');box(133,top,36,1,'#cfb68b');
        box(135+(row%3)*8,top+3,11,1,'#a58c6b');box(132,top+5,38,1,'#89775e');
    }
    for(const rail of [137,162]){box(rail,146-lift,3,44,'#82775f');for(const top of [150,165,181])box(rail+1,top-lift,1,2,'#d7bf8d');}
    c.restore();
    for(const post of [123,175]){
        box(post,141,5,51,'#9d8465');box(post,141,2,51,'#d1b68b');box(post-2,187,9,7,'#a98b66');box(post-2,187,9,2,'#ccb184');
    }
    box(113,192,78,4,'#967951');box(116,192,72,1,'#c5aa7d');
    roof(c,108-x,117-y,86,20);
    for(let row=0;row<3;row++)for(let tile=0;tile<10;tile++){
        const tx=114+tile*7+(row%2?3:0),ty=121+row*5;
        box(tx,ty,5,1,'#cd9b78');box(tx+5,ty+1,1,3,'#936e58');
    }
    box(111,136,81,2,'#8f725c');box(116,138,72,1,'#d3b58a');
    // Weight-bearing spindle, split brackets and a little worn brass handwheel.
    box(150,130,3,55-lift,'#a79068');box(151,133,1,49-lift,'#d2bb87');
    for(const ty of [140,173]){box(146,ty,11,3,'#89785d');box(147,ty,2,1,'#cab287');box(154,ty,2,1,'#cab287');}
    box(146,126,11,8,'#8b795f');box(148,127,7,6,'#c5aa79');box(149,129,5,2,'#8b795f');
    box(151,128,1,4,'#dac18c');
    // Quiet masonry channel, continuous from the gate to the feeding trough.
    box(63,188,91,6,'#9b8261');box(64,189,89,3,lift>10?'#8ba28a':'#b5a17b');box(65,188,88,1,'#c5ac82');
    if(lift>10)for(let i=0;i<5;i++){const xx=68+(i*17+Math.floor(t/120))%78;box(xx,190,8,1,'#bdc9a5');}
    for(const [wx,wy]of [[120,159],[180,151],[120,178],[179,181]]){box(wx,wy,4,3,'#b49a74');box(wx,wy,3,1,'#d1b58a');}
    drawGuairaPerchedBird(c,179-x,117-y,t,179);
}

export function drawGuairaFloor(c: CanvasRenderingContext2D, cy: number) {
    const y = 224 - cy;
    rect(c, '#773f35', 0, y, 320, 180 - y);
    rect(c, '#e6a270', 0, y, 320, 2);
    rect(c, '#c07851', 0, y + 2, 320, 4);
    for (let row = 14; row * 16 - cy < 180; row++) for (let col = 0; col < 20; col++)
        drawGuairaClayGrain(c, col * 16, row * 16 - cy, col, row, '#ac6b49', '#905039');
}

/** Full body sweep, including its starting position; no promised safe gap. */
export function bullChargeWarningRange(b: SkeletonBullModel) {
    const target = b.facing < 0 ? b.arena.left + 12 : b.arena.right - b.width - 12;
    return { left: Math.min(b.x, target), right: Math.max(b.x, target) + b.width };
}

export function drawBullWarning(c: CanvasRenderingContext2D, b: SkeletonBullModel) {
    if (b.state === 'tell' || b.state === 'turn' || b.state === 'rattle') {
        const y = b.arena.floor - 5, charge = b.state !== 'rattle';
        const range = charge ? bullChargeWarningRange(b) : { left: b.arena.left, right: b.arena.right };
        rect(c, '#653752', range.left, y, range.right - range.left, 3);
        for (let x = range.left + 7; x < range.right - 7; x += 20) {
            if (charge) for (let d = 0; d < 3; d++) {
                rect(c, '#edcaf5', x + b.facing * d, y - 1 + d, 1, 1);
                rect(c, '#edcaf5', x + b.facing * d, y + 3 - d, 1, 1);
            } else {
                rect(c, '#f0ddae', x - 3, y + 1, 7, 1);
                rect(c, '#f0ddae', x - 4, y, 2, 3); rect(c, '#f0ddae', x + 3, y, 2, 3);
            }
        }
        if(!charge&&b.bouncingBones){
            // This is the first bone's actual arc, including clipped corner
            // flights. No interpolation clock or guessed landing is involved.
            let px=b.x+b.width/2+5,py=bullBoneY(b.arena.floor,0,true)+3;
            for(let tick=1;tick<=b.boneFlightDuration;tick++){
                const xx=b.x+b.width/2+b.facing*tick*3+5,yy=bullBoneY(b.arena.floor,tick,true)+3;
                if(xx<b.arena.left||xx>b.arena.right)break;
                line(c,px,py,xx,yy,'#d4ad8c');px=xx;py=yy;
                if(tick%BULL_RULES.boneHop===0)rect(c,'#edcaf5',xx-2,b.arena.floor-11,5,2);
            }
        }
    }
}

export function drawGuairaBoss(c: CanvasRenderingContext2D, b: SkeletonBullModel, cx: number, cy: number, reducedMotion: boolean) {
    c.save(); c.translate(-cx, -cy);
    drawBullWarning(c, b);
    drawSkeletonBull(c, b, reducedMotion);
    if(b.chargeCount===2&&['tell','turn','charge'].includes(b.state)){
        // Two small horn signs promise the complete out-and-back sequence.
        // The spent sign goes dark; neither sign ever resembles an opening.
        for(let i=0;i<2;i++){
            const x=b.x+14+i*12,y=b.y-9,color=i+1<b.chargeLeg?'#957565':'#edcaf5';
            rect(c,'#493444',x-1,y-1,10,7);rect(c,color,x,y,2,4);rect(c,color,x+6,y,2,4);rect(c,color,x+2,y+3,4,2);
        }
    }
    drawBullBones(c, b, reducedMotion);
    if (b.vulnerable) {
        rect(c, '#fff1bf', b.x + 20, b.y - 10, 8, 2);
        rect(c, '#fff1bf', b.x + 22, b.y - 8, 4, 2);
        rect(c, '#fff1bf', b.x + 23, b.y - 6, 2, 2);
    }
    c.restore();
}
