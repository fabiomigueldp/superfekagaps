import { box as r, pixelLine as line, polygon, oval } from '../../WorldPainting';
import { GUAIRA_COURSES } from './GuairaCourseDesign';
import { drawWorkshopClerestory, drawWorkshopMasonryReveal } from './GuairaWorkshopArt';
import { sceneryTime } from './GuairaScenery';

type Interior = 'galeria' | 'alivio';
/** Room widths follow the different workshop uses. Window, pier and recess
 * positions are world-authored, so panning never restarts the facade pattern. */
const BAYS = {
    galeria: [[16,192,0],[240,160,1],[432,240,2],[704,176,0],[912,224,1],
        [1168,160,2],[1360,232,0],[1624,200,1],[1856,192,2],[2080,176,1],[2288,224,0],[2544,256,2]],
    alivio: [[16,208,1],[256,176,0],[464,224,2],[720,192,1],[944,232,0],
        [1208,160,2],[1400,224,1],[1656,192,0],[1880,208,2],[2120,200,1]],
} as const;

function arch(c: CanvasRenderingContext2D, x: number, top: number, width: number, height: number, wet: boolean) {
    const shape = [[x,top+14],[x+14,top],[x+width-14,top],[x+width,top+14],
        [x+width,top+height],[x,top+height]] as const;
    polygon(c, shape, '#ae9275');
    polygon(c, [[x+4,top+16],[x+16,top+4],[x+width-16,top+4],[x+width-4,top+16],
        [x+width-4,top+height],[x+4,top+height]], wet ? '#b2a58a' : '#c5a684');
    r(c, x + 5, top + 17, 3, height - 17, wet ? '#a59c83' : '#b49879');
    line(c, x + 15, top + 3, x + width - 16, top + 3, '#d2b38c');
    // Weathering follows a join, instead of scattered noise across the wall.
    for (const [dx, yy, w, h] of [[11,21,6,13],[width-16,37,5,21],[19,height-14,13,5]]) {
        r(c, x + dx, top + yy, w, h, wet ? '#a7a087' : '#bea17f');
        r(c, x + dx + 1, top + yy + h, 2, 4, wet ? '#b2aa8d' : '#c3a784');
    }
}

function servicePanel(c: CanvasRenderingContext2D, x: number, y: number, wet: boolean) {
    r(c, x, y, 36, 43, '#aa9073'); r(c, x + 3, y + 3, 30, 37, '#c4ac87');
    if (wet) {
        for (let row = 0; row < 7; row++) {
            r(c, x + 6, y + 7 + row * 4, 24, 2, '#9fa08a');
            r(c, x + 7, y + 9 + row * 4, 22, 1, '#b4b093');
        }
    } else {
        // Hanging tools, each attached to the backboard rather than floating.
        r(c, x + 6, y + 9, 24, 2, '#a38c71');
        line(c, x + 10, y + 10, x + 10, y + 29, '#aaa186', 2);
        r(c, x + 7, y + 27, 8, 5, '#a7997e');
        line(c, x + 24, y + 10, x + 24, y + 26, '#aaa186', 2);
        oval(c, x + 20, y + 24, 9, 7, '#a7997e');
        r(c, x + 23, y + 25, 3, 3, '#c4ac87');
    }
    for (const dx of [2,33]) for (const dy of [2,40]) r(c, x + dx, y + dy, 1, 1, '#d0b78f');
}

/** Back wall, roof joinery and buried foundations share the collision camera.
 * Only the landscape through the windows is distant. No false platform caps,
 * warning flashes, interactable-looking valves or independent animation clock. */
export function drawGuairaWorkshopBackground(c: CanvasRenderingContext2D, id: Interior,
    cx: number, cy: number, time: number, reduced: boolean) {
    const g = GUAIRA_COURSES[id], x = g.start - Math.round(cx), f = g.floor - Math.round(cy);
    const t = sceneryTime(time, reduced), wet = id === 'alivio';
    c.save(); c.beginPath(); c.rect(0, 0, 320, 180); c.clip();
    r(c, 0, 0, 320, 180, wet ? '#cfb18d' : '#d6b38c');
    r(c, 0, f - 204, 320, 25, wet ? '#c5a989' : '#c8a682');
    // Foundation joints remain below the plaster, including the inspection
    // tunnels. They are short, staggered and much quieter than solid tiles.
    r(c, 0, f - 20, 320, 420, wet ? '#baa589' : '#baa083');
    for (let row = -1; row < 14; row++) {
        const yy = f - 16 + row * 22;
        if (yy < -22 || yy > 180) continue;
        for (let col = Math.floor((cx - g.start) / 48) - 1; col < (cx + 320 - g.start) / 48 + 1; col++) {
            const xx = x + col * 48 + (row % 2 ? 24 : 0);
            r(c, xx + 3, yy + 2, 38, 1, wet ? '#b4a188' : '#b1997e');
            r(c, xx + 1, yy + 3, 1, 13, wet ? '#b4a188' : '#b1997e');
        }
    }
    for (const [at, width, use] of BAYS[id]) {
        const left = x + at;
        if (left + width + 12 < 0 || left - 20 > 320) continue;
        const top = f - (use === 2 ? 198 : 174);
        arch(c, left + 14, top, width - 28, f - 21 - top, wet);
        // Mortised roof posts continue to their foundation; there are no
        // cropped lower ends that look like unsupported hanging geometry.
        r(c, left - 9, f - 214, 9, 215, '#b09272');
        r(c, left - 7, f - 210, 2, 209, '#c0a17d');
        r(c, left - 12, f - 26, 15, 10, '#ac9275');
        r(c, left - 9, f - 24, 2, 2, '#cbb08a');
        line(c, left - 4, f - 178, left + 25, f - 208, '#b09272', 3);
        r(c, left - 9, f - 214, width + 33, 6, '#ad8e70');
        r(c, left - 7, f - 212, width + 29, 1, '#c0a17d');
        if (use !== 2) {
            drawWorkshopClerestory(c, left + 33, top + 17, Math.min(96, width - 74), t, reduced, wet && use === 1);
            servicePanel(c, left + width - 59, f - 74, wet);
        } else {
            // A high lantern above a wider, sealed service recess.
            drawWorkshopClerestory(c, left + Math.round(width / 2) - 27, top + 13, 54, t, reduced, wet);
            arch(c, left + 37, f - 104, width - 74, 83, wet);
            for (let dx = 48; dx < width - 39; dx += 21) {
                r(c, left + dx, f - 86, 3, 63, '#ab9679');
                r(c, left + dx + 1, f - 85, 1, 59, '#bfab88');
            }
            r(c, left + 41, f - 48, width - 82, 3, '#b49d7d');
        }
        // Old service conduits end inside a sealed wall box, with collars.
        if (wet && use === 0) {
            r(c, left + width - 24, top + 14, 4, f - 42 - top, '#a19b81');
            for (let yy = top + 25; yy < f - 45; yy += 32) r(c, left + width - 26, yy, 8, 3, '#b5a888');
            r(c, left + width - 29, f - 39, 14, 17, '#aaa080');
            r(c, left + width - 27, f - 37, 10, 13, '#b7aa87');
        }
    }
    // A full-height masonry jamb makes the old workshop/extension join physical.
    drawWorkshopMasonryReveal(c, x, f - 224, 320);
    c.restore();
}
