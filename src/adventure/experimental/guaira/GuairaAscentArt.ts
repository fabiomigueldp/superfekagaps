import { box as r, pixelLine as line, polygon, roof } from '../../WorldPainting';
import type { WorldLevel, WorldObjects, MovingBody } from '../../WorldPhysics';
import { drawGuairaWorker } from './GuairaWorkerArt';
import { pixelText } from '../../../graphics/BitmapFont';
import { isOneWayTile, supportsStanding } from '../../../world/tileRules';
import { ascentMechanicalPose } from './GuairaAscentMotion';
import { ascentTravelDirection } from './GuairaAscentTravelCue';
import { drawGuairaClayGrain, drawGuairaPlaster, drawGuairaTimber } from './GuairaMaterials';
import { drawGuairaLandscape, drawGuairaTree, drawGuairaAwning, guairaBreeze } from './GuairaScenery';
import { drawGuairaPipe, drawGuairaPipeElbow, drawGuairaPipeFlow, drawGuairaPipeSaddle, guairaPipeRoute } from './GuairaPipeArt';

/** Scenery is presentation only. Tiles and WorldObjects own every supporting surface. */
export const GUAIRA_ASCENT_ART = Object.freeze({
    width: 1344, height: 400, departureY: 304, terraceY: 144, recoveryY: 368,
    plankId: 'guaira-plank', liftId: 'guaira-service-lift', serviceId: 'guaira-inspection-carriage',
    workerFeet: Object.freeze([{ x: 166, y: 296 }, { x: 571, y: 295 }]),
});

const P = {
    ink: '#493c43', earth: '#b86b4c', earthLight: '#d68b5b', earthDark: '#874a3e',
    dust: '#e8b17c', plaster: '#e3c49a', plasterShade: '#bf967d', tile: '#b76656',
    leaf: '#7e9851', leafShade: '#526e48', leafLight: '#b2ba6b',
    water: '#63b6bf', waterShade: '#326f81', waterLight: '#b0dcce',
    wood: '#997454', woodLight: '#d1ac77', woodShade: '#695449', bronze: '#b78a56',
    deck: '#f2d69b', iron: '#687776', ironDark: '#4e5c5c',
} as const;

const visible = (x: number, w: number, cx: number) => x + w >= cx - 2 && x <= cx + 322;
const artTime = (t: number, reduced: boolean) => reduced || !Number.isFinite(t) ? 0 : Math.max(0, t);
const PIPE=Object.freeze({edge:'#72584d',brass:'#ab8157',light:'#c7a16d',shade:'#82624c',
    water:'#80afa7',glint:'#bad0b5',dry:'#b18b62'});
const PRIVATE_FEED=guairaPipeRoute([[824,77],[824,103],[1003,103]]);

// Round the origin before the local scan conversion; tiny odd wheels must not shimmer on scroll.
function oval(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
    const ox = Math.round(x), oy = Math.round(y);
    for (let j = 0; j < h; j++) {
        const half = Math.sqrt(Math.max(0, 1 - ((j + .5 - h / 2) / (h / 2)) ** 2)) * w / 2;
        r(c, ox + Math.ceil(w / 2 - half), oy + j, Math.floor(half * 2), 1, color);
    }
}

function layer(c: CanvasRenderingContext2D, cx: number, cy: number, draw: (x: number, y: number) => void) {
    c.save();
    c.beginPath(); c.rect(0, 0, 320, 180); c.clip();
    draw(Number.isFinite(cx) ? Math.round(cx) : 0, Number.isFinite(cy) ? Math.round(cy) : 0);
    c.restore();
}

function cactus(c: CanvasRenderingContext2D, x: number, y: number, h: number) {
    oval(c, x - 5, y - 1, 17, 3, '#ad8766');
    r(c, x, y - h + 2, 6, h - 2, P.leafShade);
    r(c, x + 1, y - h, 4, h - 2, P.leaf);
    r(c, x + 2, y - h + 2, 1, h - 5, P.leafLight);
    r(c, x - 6, y - h + 14, 7, 4, P.leafShade);
    r(c, x - 6, y - h + 8, 3, 8, P.leaf);
    r(c, x + 5, y - h + 19, 8, 4, P.leafShade);
    r(c, x + 10, y - h + 13, 3, 8, P.leaf);
}

function sign(c: CanvasRenderingContext2D, x: number, y: number, w: number, rows: readonly string[], supportY: number) {
    const h = rows.length * 8 + 5;
    r(c, x + 5, y + h, 2, supportY - y - h, '#a58a68');
    r(c, x + w - 7, y + h, 2, supportY - y - h, '#a58a68');
    r(c, x, y, w, h, '#967257');
    r(c, x + 1, y + 1, w - 2, h - 2, '#d7b787');
    r(c, x + 2, y + 2, w - 4, 1, '#e4c79a');
    rows.forEach((text, i) => pixelText(c, text, x + 4, y + 4 + i * 8, '#624f48'));
}

function house(c: CanvasRenderingContext2D, x: number, floor: number, w: number, h: number) {
    const top = floor - h;
    oval(c, x + 1, floor - 2, w, 5, '#ad8766');
    r(c, x + 4, top + 14, w - 8, h - 14, P.plasterShade);
    r(c, x + 5, top + 15, w - 18, h - 16, P.plaster);
    drawGuairaPlaster(c, x + 5, top + 18, w - 18, h - 19, w);
    roof(c, x, top, w, 16);
    r(c, x + 13, floor - 27, 16, 26, '#9a765e');
    r(c, x + 15, floor - 26, 12, 25, '#6c5750');
    r(c, x + 16, floor - 24, 2, 22, '#90715b');
    r(c, x + 25, floor - 15, 1, 2, '#d6b488');
    r(c, x + w - 30, top + 29, 16, 15, '#648a83');
    r(c, x + w - 28, top + 31, 5, 10, '#91aaa0');
    r(c, x + w - 23, top + 30, 2, 13, '#d7bb8c');
    r(c, x + w - 32, top + 44, 20, 2, '#bc9a78');
    r(c, x + 7, floor - 8, 7, 4, '#caa47e');
    r(c, x + w - 18, floor - 5, 8, 4, '#bc9677');
}

function pipe(c: CanvasRenderingContext2D, x: number, y: number, w: number) {
    drawGuairaPipe(c,x,y,w,false,0,true,false,1,false,PIPE);
}

/** The workshop stair is part of the lift's maintenance structure. Recessed
 * supports stop below native caps, and never suggest a solid wall to jump into. */
function workshopScaffold(c: CanvasRenderingContext2D, cx: number, cy: number, t: number) {
    if (!visible(540, 128, cx)) return;
    // Low roof: bearing posts land on the existing workshop, not in empty sky.
    for (const wx of [550, 582]) {
        r(c, wx - cx, 200 - cy, 4, 29, '#8d745b');
        r(c, wx + 1 - cx, 201 - cy, 1, 26, '#bca17a');
        r(c, wx - 2 - cx, 222 - cy, 8, 4, '#8a7961');
        r(c, wx - 1 - cx, 223 - cy, 1, 1, '#c0ab82');
    }
    line(c, 554 - cx, 222 - cy, 581 - cx, 201 - cy, '#987c5c', 2);
    // High scaffold: both legs meet the boarding balcony at y256. The right
    // cap ends before the moving deck; no fixed rail crosses the lift's shaft.
    for (const wx of [612, 650]) {
        r(c, wx - cx, 152 - cy, 4, 104, '#8d745b');
        r(c, wx + 1 - cx, 153 - cy, 1, 101, '#bca17a');
        for (const wy of [155, 220, 247]) {
            r(c, wx - 2 - cx, wy - cy, 8, 4, '#857962');
            r(c, wx - 1 - cx, wy + 1 - cy, 1, 1, '#c6ae7d');
        }
    }
    line(c, 616 - cx, 181 - cy, 649 - cx, 154 - cy, '#987c5c', 2);
    line(c, 616 - cx, 222 - cy, 649 - cx, 252 - cy, '#987c5c', 2);
    // An open tool rack gives the service route a reason to exist. Its muted
    // slats are behind the player and do not carry the pale standing edge.
    r(c, 619 - cx, 166 - cy, 25, 2, '#a58a68');
    for (const [wx, length] of [[624, 10], [633, 7], [640, 12]]) {
        r(c, wx - cx, 169 - cy, 2, length, '#758179');
        r(c, wx - 1 - cx, 168 - cy, 4, 2, '#8f9b8a');
    }
    // Small route carvings sit under the actual surfaces, outside jump arcs.
    r(c, 554 - cx, 202 - cy, 27, 8, '#c1a47c');
    pixelText(c, 'ALTO', 555 - cx, 204 - cy, '#755f4f');
    r(c, 620 - cx, 154 - cy, 26, 8, '#c1a47c');
    line(c, 624 - cx, 158 - cy, 642 - cx, 158 - cy, '#755f4f');
    line(c, 638 - cx, 155 - cy, 642 - cx, 158 - cy, '#755f4f');
    line(c, 638 - cx, 161 - cy, 642 - cx, 158 - cy, '#755f4f');
    // Cloth is tied beneath the cap, never across the receiving edge. It uses
    // the same breeze/clock as the township and holds still on reduced motion.
    const sway = guairaBreeze(t, 655, 2);
    r(c, 655 - cx, 153 - cy, 2, 15, '#ba7860');
    r(c, 657 - cx, 156 - cy, 2, 7, '#d09671');
    r(c, 657 + sway - cx, 163 - cy, 2, 6, '#ba7860');
}

/** The closed public gate and the working private sight glass remain distinct in every state. */
function bureau(c: CanvasRenderingContext2D, cx: number, cy: number, t: number) {
    const x = 858 - cx, y = 38 - cy;
    // A handsome but quiet civic facade, set twelve pixels back from the playable terrace.
    r(c, x + 3, y + 20, 153, 72, '#b6977c');
    r(c, x + 5, y + 20, 137, 69, '#dfc096');
    r(c, x + 8, y + 23, 130, 3, '#ecd2aa');
    roof(c, x - 2, y + 5, 161, 19);
    polygon(c, [[x + 51,y + 7],[x + 78,y - 6],[x + 104,y + 7]], '#bc795e');
    polygon(c, [[x + 57,y + 7],[x + 78,y - 2],[x + 98,y + 7]], '#e3c49a');
    r(c, x + 69, y + 5, 18, 12, '#b68d69');
    polygon(c, [[x + 78,y + 7],[x + 74,y + 13],[x + 75,y + 16],[x + 81,y + 16],[x + 82,y + 13]], '#709b99');
    r(c, x + 33, y + 27, 81, 11, '#bb9777');
    pixelText(c, 'CASA DA VAZAO', x + 37, y + 29, '#65564e');
    for (const wx of [x + 17, x + 118]) {
        r(c, wx, y + 39, 15, 25, '#8e8777');
        r(c, wx + 2, y + 41, 11, 21, '#668b87');
        r(c, wx + 3, y + 42, 3, 18, '#91b4a7');
        r(c, wx + 7, y + 41, 1, 21, '#c4ae87');
        r(c, wx - 1, y + 64, 17, 2, '#b79978');
    }
    r(c, x + 56, y + 56, 35, 35, '#a07859');
    r(c, x + 58, y + 57, 31, 34, '#715a4c');
    for (let dx = 60; dx < 89; dx += 7) r(c, x + dx, y + 58, 1, 32, '#92745a');
    r(c, x + 73, y + 58, 1, 32, '#b59264');
    r(c, x + 69, y + 73, 10, 2, '#caa168');
    r(c, x + 72, y + 71, 4, 5, '#80694e');
    // A masonry cistern supports the intake down to the terrace. Its muted curved
    // body and base stay behind the plumbing; neither uses the playable deck edge.
    polygon(c, [[790 - cx,72 - cy],[835 - cx,72 - cy],[835 - cx,119 - cy],
        [830 - cx,128 - cy],[795 - cx,128 - cy],[790 - cx,119 - cy]], '#af9172');
    r(c, 792 - cx, 74 - cy, 35, 44, '#c5a882');
    r(c, 793 - cx, 76 - cy, 6, 42, '#d1b690');
    r(c, 828 - cx, 75 - cy, 5, 44, '#a48668');
    for (const [yy, joint] of [[84,808],[96,799],[108,810]]) {
        r(c, 794 - cx, yy - cy, 35, 1, '#b39876');
        r(c, joint - cx, yy - 9 - cy, 1, 9, '#b39876');
    }
    r(c, 790 - cx, 119 - cy, 45, 8, '#baa07c');
    r(c, 786 - cx, 127 - cy, 53, 6, '#a98c6c');
    r(c, 789 - cx, 128 - cy, 47, 3, '#c0a17a');
    // Intake -> fork -> private tank. Cyan is contained inside a real bronze pipe.
    oval(c, 787 - cx, 65 - cy, 51, 14, '#ae9375');
    oval(c, 790 - cx, 66 - cy, 45, 10, '#d0b892');
    oval(c, 794 - cx, 68 - cy, 37, 6, P.waterShade);
    r(c, 798 - cx, 68 - cy, 28, 3, P.water);
    drawGuairaPipe(c,820-cx,77-cy,22,true,t,false,true,1,false,PIPE);
    drawGuairaPipeElbow(c,820-cx,99-cy,true,false,true,PIPE);
    drawGuairaPipe(c,829-cx,99-cy,175,true,t,false,false,1,false,PIPE);
    drawGuairaPipeFlow(c,PRIVATE_FEED,cx,cy,t,false,PIPE.glint);
    for(const xx of [874,933,984])drawGuairaPipeSaddle(c,xx-cx,103-cy,false,PIPE);
    drawGuairaPipeSaddle(c,824-cx,87-cy,true,PIPE);
    r(c, 992 - cx, 95 - cy, 23, 35, '#896e56');
    r(c, 994 - cx, 96 - cy, 18, 32, '#b89161');
    r(c, 997 - cx, 98 - cy, 3, 29, '#d4b17d');
    for (const yy of [97,121]) r(c, 993 - cx, yy - cy, 21, 3, '#7d6a56');
    oval(c, 992 - cx, 92 - cy, 23, 7, '#cfad79');
    oval(c, 995 - cx, 93 - cy, 17, 3, P.water);
    r(c,990-cx,98-cy,3,3,'#aa8e64');r(c,990-cx,106-cy,3,3,'#876d52');
    sign(c, 948 - cx, 77 - cy, 72, ['PARTICULAR'], 99 - cy);
    // Public branch: shut shutter, cross brace and dry cracked trough. No victory implied.
    drawGuairaPipe(c,820-cx,108-cy,21,false,0,true,true,1,false,PIPE);
    r(c, 815 - cx, 111 - cy, 18, 12, '#66594b');
    r(c, 817 - cx, 112 - cy, 14, 10, '#ad7659');
    line(c, 818 - cx, 113 - cy, 829 - cx, 120 - cy, '#d4ae7b', 2);
    line(c, 829 - cx, 113 - cy, 818 - cx, 120 - cy, '#d4ae7b', 2);
    r(c, 823 - cx, 115 - cy, 3, 4, '#655c4d');
    for(const xx of [815,831]) {r(c,xx-cx,109-cy,2,16,'#87745b');r(c,xx-cx,110-cy,1,1,'#c6aa7d');}
    r(c, 778 - cx, 128 - cy, 70, 5, '#ad8764');
    r(c, 780 - cx, 129 - cy, 66, 2, '#947051');
    line(c, 790 - cx, 129 - cy, 794 - cx, 131 - cy, '#745846');
    line(c, 803 - cx, 129 - cy, 806 - cx, 131 - cy, '#745846');
    pixelText(c, 'BAIRRO', 780 - cx, 116 - cy, '#685a4e');
    r(c, 777 - cx, 133 - cy, 247, 11, '#c99870');
}

/** Warm township below a pale, quiet sky. All scenery sits behind the running strip. */
export function drawGuairaAscentBackground(c: CanvasRenderingContext2D, cx: number, cy: number, time: number, reducedMotion: boolean) {
    layer(c, cx, cy, (cameraX, cameraY) => {
        const t = artTime(time, reducedMotion);
        drawGuairaLandscape(c, cameraX, cameraY, t, reducedMotion, 'heights');
        // The low distant irrigated valley has muted banks; no bright walkable ledges.
        const valley = 246 - Math.round(cameraY * .64);
        r(c, 0, valley, 320, 154, '#c49269');
        for (let i = -1; i < 7; i++) {
            const x = i * 73 - Math.round(cameraX * .4) % 73;
            polygon(c, [[x,valley + 10],[x + 26,valley + 3],[x + 74,valley + 8],[x + 75,valley + 22],[x,valley + 24]], '#aaa071');
            r(c, x + 7, valley + 14, 48, 4, '#95ab86');
            r(c, x + 12, valley + 15, 35, 1, '#a5b995');
        }
        // Dry cut earth behind the two recoverable pits, explicitly separate from the canal.
        for (const [left, right] of [[224,496],[656,768]]) if (visible(left, right - left, cameraX)) {
            const x = left - cameraX, w = right - left;
            r(c, x, 315 - cameraY, w, 53, '#bd8b66');
            r(c, x + 4, 324 - cameraY, w - 8, 9, '#a18b6d');
            r(c, x + 6, 326 - cameraY, w - 12, 3, '#83aaa1');
            for (let xx = left + 12; xx < right - 15; xx += 30) {
                r(c, xx - cameraX, 337 - cameraY, 4, 3, '#b17c5b');
                line(c, xx - cameraX, 350 - cameraY, xx + 5 - cameraX, 356 - cameraY, '#a97656');
            }
            r(c, x, 361 - cameraY, w, 7, '#d1a278');
        }
        // Both ends of the first dry canal join real return boards. Recessed
        // diagonal braces explain their support without hiding the walk below.
        for (const [left,right] of [[240,288],[448,496]]) {
            for (const xx of [left+4,right-7]) {
                r(c,xx-cameraX,344-cameraY,3,24,'#967654');
                r(c,xx+1-cameraX,345-cameraY,1,22,'#bea17a');
            }
            line(c,left+7-cameraX,361-cameraY,right-7-cameraX,344-cameraY,'#967654',2);
        }
        sign(c,350-cameraX,327-cameraY,75,['INSPECAO'],361-cameraY);
        line(c,430-cameraX,351-cameraY,442-cameraX,351-cameraY,'#755f4f');
        line(c,437-cameraX,347-cameraY,442-cameraX,351-cameraY,'#755f4f');
        line(c,437-cameraX,355-cameraY,442-cameraX,351-cameraY,'#755f4f');
        // A broad yard physically joins the architecture to each real bank.
        // These matte slopes stop at the bank's edge, leaving both pits open.
        for (const [left, right, top, bottom] of [[0,224,284,304],[496,656,284,304],[768,880,131,144]]) {
            if (!visible(left, right - left, cameraX)) continue;
            polygon(c, [[left-cameraX,top+5-cameraY],[left+14-cameraX,top+1-cameraY],
                [right-18-cameraX,top-cameraY],[right-cameraX,top+6-cameraY],
                [right-cameraX,bottom-cameraY],[left-cameraX,bottom-cameraY]], '#c49c74');
        }
        if (visible(0, 224, cameraX)) {
            drawGuairaTree(c, 149 - cameraX, 288 - cameraY, 58, t, 149, true);
            house(c, 10 - cameraX, 289 - cameraY, 68, 63);
            drawGuairaAwning(c, 23 - cameraX, 257 - cameraY, 22, t, 23);
            cactus(c, 101 - cameraX, 293 - cameraY, 39);
            for (const wx of [111,137,161]) {
                r(c, wx - cameraX, 269 - cameraY, 3, 26, '#a18a68');
                r(c, wx - cameraX, 270 - cameraY, 1, 23, '#c7ad7d');
            }
            r(c, 111 - cameraX, 276 - cameraY, 53, 2, '#b79b70');
            r(c, 111 - cameraX, 286 - cameraY, 53, 2, '#ac8f68');
            sign(c, 146 - cameraX, 243 - cameraY, 66, ['ELA VAI', 'E VOLTA'], 296 - cameraY);
            r(c, -cameraX, 296 - cameraY, 224, 8, '#cb9467');
        }
        // The canopy extends beyond the yard: cull the whole tree, not its bank.
        drawGuairaTree(c, 520 - cameraX, 290 - cameraY, 76, t, 520, true);
        if (visible(496, 160, cameraX)) {
            // Maintenance nook stays behind and away from the checkpoint and boarding lip.
            house(c, 539 - cameraX, 288 - cameraY, 56, 60);
            sign(c, 524 - cameraX, 250 - cameraY, 61, ['ELEVADOR'], 296 - cameraY);
            r(c, 588 - cameraX, 284 - cameraY, 18, 11, '#9d7858');
            r(c, 590 - cameraX, 285 - cameraY, 14, 2, '#ccb087');
            r(c, 594 - cameraX, 288 - cameraY, 5, 3, '#d0b488');
            r(c, 496 - cameraX, 296 - cameraY, 160, 8, '#cb9467');
            // A wall-supported boarding balcony. Timber is deliberately quiet
            // below the two-pixel native cap; the actor and lift remain in front.
            for (const xx of [597,649]) {
                r(c,xx-cameraX,264-cameraY,4,40,'#8d745b');
                r(c,xx+1-cameraX,265-cameraY,1,37,'#c3a17a');
            }
            line(c,601-cameraX,294-cameraY,645-cameraX,264-cameraY,'#8d745b',2);
            r(c,604-cameraX,270-cameraY,29,8,'#b59673');
            line(c,610-cameraX,274-cameraY,626-cameraX,274-cameraY,'#755f4f');
            line(c,622-cameraX,271-cameraY,626-cameraX,274-cameraY,'#755f4f');
            line(c,622-cameraX,277-cameraY,626-cameraX,274-cameraY,'#755f4f');
        }
        workshopScaffold(c, cameraX, cameraY, t);
        if (visible(1088, 256, cameraX)) bureau(c, cameraX - 320, cameraY, t);
        // The lookout lands on a balcony at the same height, visible through
        // the whole jump. Its brackets meet the real terrace at y144; muted
        // uprights never impersonate the native one-way cap at y96.
        if (visible(1072, 48, cameraX)) {
            for (const xx of [1091,1114]) {
                r(c,xx-cameraX,104-cameraY,3,40,'#8d745b');
                r(c,xx+1-cameraX,105-cameraY,1,37,'#c3a17a');
            }
            line(c,1077-cameraX,105-cameraY,1091-cameraX,125-cameraY,'#8d745b',2);
            line(c,1095-cameraX,131-cameraY,1112-cameraX,106-cameraY,'#8d745b',2);
            r(c,1074-cameraX,108-cameraY,27,8,'#c1a47c');
            pixelText(c,'CASA',1075-cameraX,110-cameraY,'#755f4f');
        }
        if (visible(768, 320, cameraX)) {
            house(c, 778 - cameraX, 136 - cameraY, 56, 60);
            drawGuairaAwning(c, 789 - cameraX, 102 - cameraY, 21, t, 789);
            sign(c, 823 - cameraX, 104 - cameraY, 54, ['VAZAO'], 144 - cameraY);
            for(const xx of [895,1068]) {
                r(c,xx-2-cameraX,190-cameraY,5,50,'#9a8063');
                r(c,xx-1-cameraX,191-cameraY,1,47,'#bea17a');
            }
            pipe(c, 884 - cameraX, 181 - cameraY, 196);
            for(const xx of [895,1068])drawGuairaPipeSaddle(c,xx-cameraX,185-cameraY,false,PIPE);
            sign(c, 943 - cameraX, 196 - cameraY, 83, ['INSPECAO'], 232 - cameraY);
            // The new right-hand return is supported by the inspection floor.
            for (const xx of [1044,1080]) {
                r(c,xx-cameraX,199-cameraY,3,41,'#9a8063');
                r(c,xx+1-cameraX,200-cameraY,1,38,'#bea17a');
            }
            line(c,1045-cameraX,221-cameraY,1067-cameraX,199-cameraY,'#9a8063',2);
            // Quiet directional carving; the native stair is the bright edge.
            line(c,1002-cameraX,220-cameraY,1023-cameraX,220-cameraY,'#755f4f');
            line(c,1018-cameraX,216-cameraY,1023-cameraX,220-cameraY,'#755f4f');
            line(c,1018-cameraX,224-cameraY,1023-cameraX,220-cameraY,'#755f4f');
            r(c, 883 - cameraX, 232 - cameraY, 202, 8, '#c99870');
            // The optional lookout belongs to the same inspection scaffold.
            // Its open legs sit behind the carriage, not across its live cap.
            for (const xx of [962,1003]) {
                r(c,xx-cameraX,104-cameraY,3,128,'#a18a68');
                r(c,xx+1-cameraX,105-cameraY,1,126,'#bca17a');
            }
            line(c,965-cameraX,129-cameraY,1002-cameraX,105-cameraY,'#a18a68',2);
            r(c,969-cameraX,110-cameraY,26,8,'#c1a47c');
            pixelText(c,'ALTO',970-cameraX,112-cameraY,'#755f4f');
        }
    });
}

/** Larger quiet strata give the terrace the same terracotta mass as the diorama. */
function cutEarth(c: CanvasRenderingContext2D, left: number, right: number, top: number, cx: number, cy: number) {
    const x = left - cx, y = top - cy, w = right - left;
    r(c, x, y + 4, w, 400 - top - 4, '#ba8059');
    const seam = [[0,0],[31,2],[68,1],[105,6],[141,4],[181,10],[222,7],[261,8],[300,4]] as const;
    for (const [depth, color] of [[22,'#b47754'],[55,'#ab6d50'],[102,'#a7674d'],[160,'#a15f49'],[218,'#975b48']] as const) {
        if (top + depth > 400) continue;
        const edge = seam.map(([sx, sy]) => [x + sx, y + depth + sy] as const);
        polygon(c, [...edge, [x + 300,400 - cy],[x,400 - cy]], color);
    }
    // Sloping clay planes cross the tile grid. They end in soft, broken seams;
    // there are no isolated bright shelves for a player to mistake as support.
    for (const [dx, depth, span, height] of [[13,34,48,53],[86,41,63,77],[185,32,52,65],
        [30,121,55,63],[128,151,67,66],[218,117,40,81],[7,209,40,43]] as const) {
        if (top + depth > 400) continue;
        polygon(c, [[x + dx,y + depth],[x + dx + span,y + depth + 7],
            [x + dx + span - 17,y + depth + height],[x + dx + 10,y + depth + height + 9]],
        depth < 100 ? '#b67753' : '#ab6c50');
        line(c, x + dx + 4, y + depth + 2, x + dx + span - 10, y + depth + 7, depth < 100 ? '#c18a60' : '#b57b57');
    }
    for (const [dx, depth, span] of [[9,12,21],[96,16,16],[193,17,27],[51,47,16],[161,82,23],
        [14,92,18],[91,135,22],[213,160,14],[51,188,24],[139,229,27]] as const) {
        r(c, x + dx, y + depth, span, 1, depth < 50 ? '#c99568' : '#bc805b');
        r(c, x + dx + span - 3, y + depth + 1, 6, 1, '#b87d58');
    }
}

/** Only real supporting tiles receive a pale top. One-way recovery steps remain thin boards. */
export function drawGuairaAscentTerrain(c: CanvasRenderingContext2D, level: WorldLevel, cx: number, cy: number, _time: number, _reducedMotion: boolean) {
    layer(c, cx, cy, (cameraX, cameraY) => {
        const startCol = Math.max(0, level.worldToCol(cameraX)), endCol = Math.min(level.data.width - 1, level.worldToCol(cameraX + 319));
        const startRow = Math.max(0, level.worldToRow(cameraY)), endRow = Math.min(level.data.height - 1, level.worldToRow(cameraY + 179));
        for (let row = startRow; row <= endRow; row++) for (let col = startCol; col <= endCol; col++) {
            const tile = level.data.tiles[row]?.[col] ?? 0;
            if (!supportsStanding(tile)) continue;
            const wx = level.colToWorldX(col), wy = level.rowToWorldY(row), x = wx - cameraX, y = wy - cameraY;
            if (isOneWayTile(tile)) {
                r(c, x, y, 16, 2, P.deck);
                r(c, x, y + 2, 16, 4, '#ad8257');
                r(c, x, y + 6, 16, 2, '#705849');
                r(c, x + 3, y + 3, 10, 1, '#d0ad78');
                r(c, x + 1, y + 2, 1, 5, '#715e4e');
                continue;
            }
            const top = !supportsStanding(level.data.tiles[row - 1]?.[col] ?? 0), terrace = wy < 304;
            r(c, x, y, 16, 16, terrace ? '#ab805b' : '#aa664b');
            if (top) {
                r(c, x, y + 3, 16, 13, terrace ? '#bb9467' : '#bd7750');
                r(c, x, y, 16, 2, terrace ? '#eed4a0' : '#f1c189');
                r(c, x, y + 2, 16, 2, terrace ? '#d3b27f' : '#d89563');
            }
            // Retaining edges come from actual neighboring tiles, never from scenic assumptions.
            const left = !supportsStanding(level.data.tiles[row]?.[col - 1] ?? 0), right = !supportsStanding(level.data.tiles[row]?.[col + 1] ?? 0);
            if (left || right) {
                const edge = left ? x : x + 13;
                r(c, edge, y + (top ? 4 : 0), 3, top ? 12 : 16, '#86644f');
                r(c, edge + 1, y + (top ? 4 : 0), 1, top ? 12 : 16, '#c7a47b');
            }
        }
        // Scenery is clipped to existing solid interiors. Caps, side retainers,
        // one-way boards and every empty recovery space retain their own pixels.
        c.save(); c.beginPath();
        for (let row = startRow; row <= endRow; row++) for (let col = startCol; col <= endCol; col++) {
            const tile = level.data.tiles[row]?.[col] ?? 0;
            if (!supportsStanding(tile) || isOneWayTile(tile)) continue;
            const top = !supportsStanding(level.data.tiles[row - 1]?.[col] ?? 0);
            const left = !supportsStanding(level.data.tiles[row]?.[col - 1] ?? 0);
            const right = !supportsStanding(level.data.tiles[row]?.[col + 1] ?? 0);
            c.rect(level.colToWorldX(col) - cameraX + (left ? 3 : 0), level.rowToWorldY(row) - cameraY + (top ? 4 : 0),
                16 - (left ? 3 : 0) - (right ? 3 : 0), 16 - (top ? 4 : 0));
        }
        c.clip();
        for (const [left, right, top] of [[0,224,304],[496,656,304],[768,880,144],[1088,1344,144]]) {
            if (visible(left, right - left, cameraX)) cutEarth(c, left, right, top, cameraX, cameraY);
        }
        for (let row = startRow; row <= endRow; row++) for (let col = startCol; col <= endCol; col++) {
            const tile = level.data.tiles[row]?.[col] ?? 0;
            if (!supportsStanding(tile) || isOneWayTile(tile)) continue;
            drawGuairaClayGrain(c, level.colToWorldX(col) - cameraX, level.rowToWorldY(row) - cameraY, col, row);
        }
        c.restore();
    });
}

/** Mechanical support follows the real body, including adjusted width, endpoints and intermediate y. */
function deck(c: CanvasRenderingContext2D, body: MovingBody, cx: number, cy: number, lift: boolean) {
    const x = Math.round(body.x) - cx, y = Math.round(body.y) - cy, w = Math.round(body.width), h = Math.round(body.height);
    r(c, x, y, w, h, P.woodShade);
    r(c, x, y, w, Math.min(2, h), P.deck);
    r(c, x, y + 2, w, Math.max(0, h - 4), P.wood);
    drawGuairaTimber(c, x, y + 2, w, h - 4, lift ? 1 : 2);
    r(c, x, y + Math.max(2, h - 2), w, Math.min(2, h), P.ironDark);
    for (const dx of [3, w - 8]) {
        r(c, x + dx, y + 2, 5, Math.max(0, h - 2), lift ? P.bronze : P.iron);
        r(c, x + dx + 1, y + 3, 2, 1, '#d6c59a');
    }
}

/** A single bright spoke turns within the existing rim; the axle never wobbles. */
function bearingSpoke(c: CanvasRenderingContext2D, x: number, y: number, turn: number, radius: number) {
    x = Math.round(x); y = Math.round(y);
    const dx = Math.round(Math.cos(turn) * radius), dy = Math.round(Math.sin(turn) * radius);
    line(c, x, y, x + dx, y + dy, '#d6c59a');
    r(c, x - Math.sign(dx), y - Math.sign(dy), 1, 1, '#766650');
    r(c, x, y, 1, 1, '#e0c99a');
}

/** End-stop pistons compress by at most two pixels, entirely below the safe cap. */
function carriageStop(c: CanvasRenderingContext2D, x: number, y: number, direction: -1 | 1, compression: number) {
    r(c, x - 1, y - 1, 3, 6, P.ironDark);
    for (let offset = 2; offset <= 6 - compression; offset += 2)
        r(c, x + direction * offset, y, 1, 4, '#9b8869');
    r(c, x + direction * (7 - compression) - 1, y - 1, 3, 6, P.woodShade);
    r(c, x + direction * (7 - compression), y, 1, 4, P.bronze);
}

/** A small mechanical direction dial hangs below the real supporting edge.
 * Shape, not colour or blinking, distinguishes both directions and a neutral rest.
 */
function travelDial(c: CanvasRenderingContext2D, body: MovingBody, cx: number, cy: number, axis: 'x' | 'y', running: boolean) {
    const x = Math.round(body.x) + Math.floor(body.width / 2) - cx;
    const y = Math.round(body.y) + body.height + 5 - cy;
    const direction = ascentTravelDirection(body, axis, running);
    r(c, x - 6, y - 5, 13, 11, P.ink);
    r(c, x - 5, y - 4, 11, 9, P.ironDark);
    r(c, x - 5, y, 1, 1, P.bronze); r(c, x + 5, y, 1, 1, P.bronze);
    const face = '#e0c99a';
    if (!direction) { r(c, x - 1, y - 1, 3, 3, face); return; }
    if (axis === 'x') {
        line(c, x - 3, y, x + 3, y, face);
        line(c, x + direction, y - 2, x + direction * 3, y, face);
        line(c, x + direction, y + 2, x + direction * 3, y, face);
    } else {
        line(c, x, y - 3, x, y + 3, face);
        line(c, x - 2, y + direction, x, y + direction * 3, face);
        line(c, x + 2, y + direction, x, y + direction * 3, face);
    }
}

export function drawGuairaAscentObjects(c: CanvasRenderingContext2D, objects: WorldObjects, cx: number, cy: number, _time: number, reducedMotion: boolean, running = true) {
    layer(c, cx, cy, (cameraX, cameraY) => {
        const lift = objects.get(GUAIRA_ASCENT_ART.liftId);
        for (const plank of [objects.get(GUAIRA_ASCENT_ART.plankId), objects.get(GUAIRA_ASCENT_ART.serviceId)]) if (plank) {
            const from = plank.home ?? { x: plank.x, y: plank.y }, to = plank.to ?? from;
            const left = Math.min(from.x, to.x), right = Math.max(from.x, to.x) + plank.width, railY = from.y + plank.height + 12;
            const pose = ascentMechanicalPose(plank, 'x', reducedMotion);
            if (visible(left - 12, right - left + 24, cameraX)) {
                // Recessed, dark guide rail under the carriage; bright top belongs only to its body.
                r(c, left - cameraX, railY - cameraY, right - left, 2, '#927956');
                r(c, left - cameraX, railY + 2 - cameraY, right - left, 1, '#b69870');
                for (const endpoint of [left, right]) {
                    r(c, endpoint - 2 - cameraX, railY - 6 - cameraY, 4, 14, '#8c7155');
                    r(c, endpoint - 1 - cameraX, railY - 5 - cameraY, 2, 12, '#b6996d');
                    r(c, endpoint - 4 - cameraX, railY - 5 - cameraY, 8, 2, '#9b7b56');
                    r(c, endpoint - 4 - cameraX, railY + 5 - cameraY, 8, 2, '#9b7b56');
                }
                carriageStop(c, left - cameraX, railY - 5 - cameraY, 1,
                    from.x <= to.x ? pose.homeCompression : pose.endCompression);
                carriageStop(c, right - cameraX, railY - 5 - cameraY, -1,
                    from.x <= to.x ? pose.endCompression : pose.homeCompression);
                for (const wx of [plank.x + 13, plank.x + plank.width - 16]) {
                    r(c, wx - cameraX, plank.y + plank.height - cameraY, 3, 10, '#756c58');
                    oval(c, wx - 2 - cameraX, plank.y + plank.height + 7 - cameraY, 7, 6, '#685f51');
                    bearingSpoke(c, wx + 1 - cameraX, plank.y + plank.height + 10 - cameraY, pose.turn, 2);
                }
            }
            if (visible(plank.x, plank.width, cameraX)) {
                deck(c, plank, cameraX, cameraY, false);
                travelDial(c, plank, cameraX, cameraY, 'x', running);
            }
        }
        if (lift) {
            const from = lift.home ?? { x: lift.x, y: lift.y }, to = lift.to ?? from;
            const top = Math.min(from.y, to.y), bottom = Math.max(from.y, to.y), left = from.x, right = from.x + lift.width;
            const pose = ascentMechanicalPose(lift, 'y', reducedMotion);
            if (visible(left - 12, lift.width + 24, cameraX)) {
                // Thin guides and cables flank an open central silhouette. No false roof or rungs.
                for (const [wx, cable] of [[left - 7,left + 5],[right + 5,right - 6]]) {
                    r(c, wx - cameraX, top - 17 - cameraY, 3, bottom - top + 35, '#a58c68');
                    r(c, wx + 1 - cameraX, top - 16 - cameraY, 1, bottom - top + 33, '#c2aa80');
                    r(c, cable - cameraX, top - 13 - cameraY, 1, Math.max(0, lift.y - top + 13), '#7d7665');
                    for (const yy of [top,bottom]) {
                        r(c, wx - 3 - cameraX, yy - 4 - cameraY, 9, 10, '#8c755a');
                        r(c, wx - 2 - cameraX, yy - 3 - cameraY, 7, 2, '#c3a272');
                        r(c, wx - cameraX, yy + 1 - cameraY, 2, 2, '#d6bf91');
                    }
                    oval(c, cable - 4 - cameraX, top - 21 - cameraY, 9, 9, '#8c7356');
                    oval(c, cable - 2 - cameraX, top - 19 - cameraY, 5, 5, '#c6a777');
                    bearingSpoke(c, cable - cameraX, top - 17 - cameraY, pose.turn, 2);
                }
                // Two short guide buffers take up the last part of the approach.
                // Their dark stops remain separate from the walkable deck.
                for (const [wy, direction, compression] of [
                    [top + 9, 1, from.y <= to.y ? pose.homeCompression : pose.endCompression],
                    [bottom - 9, -1, from.y <= to.y ? pose.endCompression : pose.homeCompression]
                ] as const) {
                    for (const wx of [left - 7, right + 5]) {
                        r(c, wx - 1 - cameraX, wy - 1 - cameraY, 5, 3, P.ironDark);
                        r(c, wx + 1 - cameraX, wy + (direction > 0 ? 1 : compression - 5) - cameraY, 1, 5 - compression, '#9b8869');
                        r(c, wx - cameraX, wy + direction * (6 - compression) - cameraY, 3, 2, P.bronze);
                    }
                }
                // Brackets travel with the body and stay entirely below its walkable top.
                for (const wx of [lift.x + 3,lift.x + lift.width - 7]) {
                    r(c, wx - cameraX, lift.y + lift.height - cameraY, 4, 11, '#806d54');
                    line(c, wx - cameraX, lift.y + lift.height + 9 - cameraY, wx + (wx < lift.x + lift.width / 2 ? 12 : -10) - cameraX, lift.y + lift.height - cameraY, '#a99167', 2);
                }
            }
            if (visible(lift.x, lift.width, cameraX)) {
                deck(c, lift, cameraX, cameraY, true);
                travelDial(c, lift, cameraX, cameraY, 'y', running);
            }
        }
        GUAIRA_ASCENT_ART.workerFeet.forEach((p, i) => {
            if (!visible(p.x - 8, 24, cameraX)) return;
            const body = objects.get(i ? GUAIRA_ASCENT_ART.liftId : GUAIRA_ASCENT_ART.plankId);
            const axis = i ? 'y' : 'x';
            const from = body?.home?.[axis], to = body?.to?.[axis];
            const progress = body && from !== undefined && to !== undefined && from !== to
                ? Math.max(0, Math.min(1, (body[axis] - from) / (to - from))) : 0;
            // Look up when the real platform is away; resume inspection when it
            // returns. The object's clock also freezes on pause and completion.
            // No remembered event, predicted travel or independent render clock.
            drawGuairaWorker(c, p.x - cameraX, p.y - cameraY, i ? 'inspector' : 'pump', {
                activeTimeMs: objects.time, valveActive: progress > .35,
                bridgeRise: .5, reducedMotion,
            });
        });
    });
}
