import { pixelText } from '../../graphics/BitmapFont';

/** Decorative only. All coordinates are the game's 320 × 180 logical pixels.
 * time is milliseconds, floorY is screen space (world floor minus cameraY).
 * Draw background, then cast, then the original Feka/boss, then floor.
 * No timers, randomness, DOM, textures, collisions, or persistent state. */
export type CalabrezzoReaction = 'neutral' | 'mock' | 'shock' | 'cheer';
export interface CalabrezzoStageState {
    time: number;
    reaction?: CalabrezzoReaction;
    reducedMotion?: boolean;
    floorY?: number;
    /** Fade/retract secondary cast before gameplay. 0 hides everyone and the desk. */
    castOpacity?: number;
    /** Default 56 and 167 leave original Feka a central presentation mark at x112. */
    athletePositions?: readonly [number, number];
}
const P = { ink: '#171523', dark: '#262231', wall: '#39313c', iron: '#655962',
    rim: '#a08b87', gold: '#d7ac60', light: '#f6d896', curtain: '#583341', fold: '#402a37',
    skin: '#c18564', shadow: '#855449', skinLight: '#e4af82', pale: '#d8b798', shirt: '#858794' };
function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
    c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h);
}
function poly(c: CanvasRenderingContext2D, points: number[], color: string) {
    c.fillStyle = color; c.beginPath(); c.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
    c.closePath(); c.fill();
}
function beat(s: CalabrezzoStageState, offset = 0): number {
    return s.reducedMotion ? 0 : Math.floor((Number.isFinite(s.time) ? s.time : 0) / 180 + offset) % 2;
}
function floor(s: CalabrezzoStageState): number { return Number.isFinite(s.floorY) ? s.floorY! : 160; }

export function drawCalabrezzoStageBackground(c: CanvasRenderingContext2D, s: CalabrezzoStageState) {
    c.save();
    const fy = floor(s);
    rect(c, 0, 0, 320, 180, P.ink);
    rect(c, 7, 24, 306, fy - 24, P.wall);
    // Concept-derived masonry and low furnace glow stay subdued behind actors.
    for (let row = 0; row < 7; row++) for (let col = 0; col < 9; col++) {
        const x = 24 + col * 32 + (row % 2) * 15, y = 39 + row * 15;
        if (x < 293) { rect(c, x, y, Math.min(28, 295 - x), 1, '#453943'); rect(c, x, y, 1, 12, '#302b35'); }
    }
    rect(c, 129, fy - 53, 49, 25, '#272330');
    for (let i = 0; i < 6; i++) {
        rect(c, 133 + i * 7, fy - 47, 4, 18, '#705041');
        rect(c, 134 + i * 7, fy - 37, 2, 8, '#aa7546');
    }
    // Heavy factory truss, warm footlights, wine curtains: an improvised championship.
    for (const x of [8, 301]) {
        rect(c, x, 24, 11, fy - 24, P.dark); rect(c, x + 1, 25, 2, fy - 25, P.iron);
        for (let y = 30; y < fy - 7; y += 17) {
            poly(c, [x + 3, y, x + 10, y + 12, x + 10, y + 15, x + 3, y + 3], P.iron);
            rect(c, x + 2, y, 2, 2, P.rim);
        }
    }
    rect(c, 19, 27, 282, 7, P.dark);
    for (let x = 22; x < 299; x += 18) { rect(c, x, 29, 13, 1, P.iron); rect(c, x + 2, 31, 2, 1, P.rim); }
    for (const x of [20, 271]) {
        rect(c, x, 35, 29, fy - 44, P.curtain);
        for (let i = 0; i < 4; i++) { rect(c, x + i * 7, 37, 3, fy - 48, P.fold); }
        rect(c, x, 87, 29, 3, P.gold);
    }
    // Sign is intentionally above the quiet combat plane.
    rect(c, 69, 35, 182, 36, P.ink); rect(c, 71, 36, 178, 1, P.rim);
    rect(c, 73, 39, 174, 29, '#49333a');
    for (const x of [74, 243]) for (const y of [39, 65]) rect(c, x, y, 2, 2, P.gold);
    // Tiny stepped crown and laurel terminals borrowed from the concept's heraldry.
    poly(c, [153, 35, 151, 29, 156, 32, 160, 27, 164, 32, 169, 29, 167, 35], P.gold);
    pixelText(c, 'CALABREZZO', 160, 42, P.light, 2, 'center');
    pixelText(c, 'CAMPEONATO DE SHAPE', 160, 60, P.gold, 1, 'center');
    // Dumbbell insignia. No beverage, fruit, or medical imagery.
    for (const x of [55, 260]) {
        rect(c, x - 4, 47, 13, 3, P.rim);
        rect(c, x - 6, 41, 3, 15, P.gold); rect(c, x + 8, 41, 3, 15, P.gold);
        rect(c, x - 8, 44, 2, 9, P.rim); rect(c, x + 11, 44, 2, 9, P.rim);
    }
    for (const x of [44, 276]) {
        poly(c, [x - 4, 36, x + 4, 36, x + 36, fy - 15, x - 35, fy - 15], '#443940');
        rect(c, x - 5, 31, 10, 6, P.ink); rect(c, x - 3, 36, 6, 2, P.light);
    }
    rect(c, 20, fy - 27, 280, 27, '#302932');
    rect(c, 20, fy - 27, 280, 1, '#76605c');
    for (let x = 26; x < 300; x += 29) rect(c, x, fy - 22, 1, 19, '#3d333b');
    // Center presentation mark is under the playable silhouette, never a fake hitbox.
    rect(c, 89, fy - 3, 46, 1, '#886d53');
    rect(c, 89, fy - 6, 1, 4, '#886d53'); rect(c, 134, fy - 6, 1, 4, '#886d53');
    c.restore();
}

function athlete(c: CanvasRenderingContext2D, x: number, y: number, index: number, s: CalabrezzoStageState) {
    const shock = s.reaction === 'shock', laugh = s.reaction === 'mock';
    const dy = laugh ? beat(s, index) : 0;
    c.save(); c.translate(x, y + dy);
    // Competitor 2 is shorter and barrel-chested; the first is taller and angular.
    if (index === 1) c.scale(1.12, .90);
    // Giant shoulders, tiny head, tapered waist, unmistakably posing trunks.
    poly(c, [-11,-37, 11,-37, 16,-32, 14,-25, 10,-23, 8,-15, -8,-15, -11,-23, -15,-25, -17,-31], P.ink);
    poly(c, [-10,-35, 10,-35, 14,-31, 12,-25, 8,-23, 7,-15, -7,-15, -9,-23, -13,-25, -15,-31], P.skin);
    rect(c, -12, -33, 10, 4, P.skinLight); rect(c, 2, -33, 10, 4, P.skinLight);
    rect(c, -10, -27, 20, 2, P.shadow); rect(c, 0, -32, 1, 14, P.shadow);
    for (let j = 0; j < 2; j++) { rect(c, -5, -23 + j * 4, 4, 2, P.skinLight); rect(c, 2, -23 + j * 4, 4, 2, P.skinLight); }
    rect(c, -6, -45, 13, 12, P.ink); rect(c, -5, -43, 11, 9, P.skin);
    if (index === 0) { rect(c, -5, -45, 11, 3, '#211d25'); rect(c, -5, -44, 3, 8, '#211d25'); }
    else { rect(c, -4, -44, 9, 2, P.skinLight); rect(c, -2, -38, 7, 2, '#47352f'); }
    rect(c, -3, -40, 2, 1, P.ink); rect(c, 3, -40, 2, 1, P.ink);
    rect(c, -1, -37, shock ? 3 : 5, shock ? 3 : 1, P.ink);
    if (laugh) rect(c, 0, -37, 4, 1, P.light);
    for (const side of [-1, 1]) {
        const ax = side < 0 ? -21 : 13;
        rect(c, ax, -36, 9, 16, P.ink); rect(c, ax + 1, -35, 7, 12, P.skin);
        rect(c, ax + 2, -34, 3, 5, P.skinLight);
        const raised = !shock && (index === 0 || side < 0);
        rect(c, side < 0 ? -23 : 17, raised ? -43 : -25, 6, raised ? 12 : 9, P.ink);
        rect(c, side < 0 ? -22 : 18, raised ? -42 : -24, 4, raised ? 10 : 7, P.skinLight);
        if (!raised) { rect(c, side < 0 ? -20 : 9, -19, 10, 4, P.ink); rect(c, side < 0 ? -19 : 9, -18, 10, 2, P.skinLight); }
        rect(c, side < 0 ? -9 : 2, -13, 8, 13, P.ink);
        rect(c, side < 0 ? -8 : 3, -12, 6, 11, P.skin);
        rect(c, side < 0 ? -10 : 2, -2, 10, 3, P.shadow);
    }
    poly(c, [-10, -16, 10, -16, 5, -8, -5, -8], index ? '#5e7780' : '#a25151');
    rect(c, -3, -16, 6, 4, P.light); rect(c, -1, -15, 2, 2, P.ink);
    c.restore();
}
function judge(c: CanvasRenderingContext2D, x: number, y: number, index: number, s: CalabrezzoStageState) {
    const mock = s.reaction === 'mock', shock = s.reaction === 'shock', cheer = s.reaction === 'cheer';
    c.save(); c.translate(x, y + (mock ? beat(s, index) : 0));
    rect(c, -9, -18, 19, 19, P.ink); rect(c, -8, -17, 17, 16, index === 1 ? '#887b7b' : '#505568');
    poly(c, [-4, -17, 0, -10, 5, -17], P.pale); rect(c, 0, -13, 2, 8, '#ac6b61');
    rect(c, -6, -31, 13, 15, P.ink); rect(c, -5, -29, 11, 11, P.pale);
    rect(c, -6, -31, 13, 4, index === 1 ? '#c7b6a0' : '#493633');
    rect(c, -4, -25, 4, 2, P.ink); rect(c, 2, -25, 4, 2, P.ink);
    rect(c, 0, -25, 2, 1, P.ink);
    rect(c, -1, -21, shock ? 3 : 5, shock || mock ? 3 : 1, P.ink);
    if (mock) rect(c, 0, -21, 4, 1, P.light);
    if (mock || cheer) {
        rect(c, 9, -18, 4, 12, P.pale); rect(c, 11, -29, 2, 12, P.gold);
        rect(c, 4, -39, 17, 14, P.ink); rect(c, 5, -38, 15, 12, '#e4d5b6');
        pixelText(c, cheer ? '10' : index === 1 ? '1' : '0', 13, -36, '#58383b', 1, 'center');
    } else if (shock) { rect(c, -13, -23, 4, 11, P.pale); rect(c, 10, -23, 4, 11, P.pale); }
    c.restore();
}

export function drawCalabrezzoStageCast(c: CanvasRenderingContext2D, s: CalabrezzoStageState) {
    c.save();
    const fy = floor(s);
    c.globalAlpha *= Math.max(0, Math.min(1, s.castOpacity ?? 1));
    // Rear gallery is painted behind Feka; audience silhouettes hug the apron edges.
    const positions = s.athletePositions ?? [56, 167];
    for (const x of positions) { rect(c, x - 24, fy - 37, 48, 12, P.dark); rect(c, x - 23, fy - 37, 46, 2, P.rim); }
    athlete(c, positions[0], fy - 38, 0, s); athlete(c, positions[1], fy - 38, 1, s);
    // A waiting competitor only peeks from the wing; clipped to preserve entry space.
    c.save(); c.beginPath(); c.rect(19, fy - 80, 11, 48); c.clip();
    athlete(c, 17, fy - 38, 1, s); c.restore();
    for (let i = 0; i < 3; i++) judge(c, 205 + i * 32, fy - 34, i, s);
    rect(c, 188, fy - 35, 102, 14, P.ink); rect(c, 189, fy - 34, 100, 2, P.gold);
    rect(c, 191, fy - 31, 96, 9, '#55424a');
    pixelText(c, 'JURADOS', 240, fy - 30, '#cbb598', 1, 'center');
    // Three compact audience boxes around the rear apron, never across center stage.
    for (let i = 0; i < 8; i++) {
        const x = i < 4 ? 22 + i * 15 : 252 + (i - 4) * 15;
        const y = fy - 9 + (s.reaction === 'mock' ? beat(s, i) : 0);
        const skin = i % 3 === 0 ? '#93634f' : i % 3 === 1 ? '#be9171' : '#b6a08b';
        poly(c, [x-7,y+6,x-6,y+1,x-3,y-1,x+5,y-1,x+8,y+2,x+9,y+6], P.ink);
        rect(c, x-4, y+1, 10, 4, i%2 ? '#49424d' : '#403544');
        rect(c, x-6, y+1, 2, 4, skin); rect(c, x+6, y+1, 2, 4, skin); rect(c, x - 4, y - 8, 10, 10, P.ink); rect(c, x - 3, y - 7, 8, 7, skin);
        rect(c, x - 4, y - 10, 10, 4, i % 2 ? '#50424a' : '#242332');
        rect(c, x - 2, y - 5, 1, 1, P.ink); rect(c, x + 2, y - 5, 1, 1, P.ink);
        rect(c, x, y - 2, s.reaction === 'shock' ? 2 : 3, s.reaction === 'neutral' ? 1 : 2, P.ink);
        if (s.reaction === 'cheer') { rect(c, x - 7, y - 9, 2, 10, skin); rect(c, x + 7, y - 9, 2, 10, skin); }
    }
    for (const x of [15, 245]) {
        rect(c, x, fy - 3, 67, 3, '#51434d'); rect(c, x, fy - 3, 67, 1, '#867063');
    }
    c.restore();
}

export function drawCalabrezzoStageFloor(c: CanvasRenderingContext2D, floorY: number, s?: CalabrezzoStageState) {
    c.save();
    const y = Number.isFinite(floorY) ? Math.round(floorY) : 160;
    rect(c, 0, y, 320, Math.max(0, 180 - y), P.ink);
    rect(c, 0, y, 320, 2, P.rim); rect(c, 0, y + 2, 320, 6, P.dark);
    for (let x = 0; x < 320; x += 16) {
        rect(c, x + 1, y + 3, 7, 4, '#8e7553'); rect(c, x + 2, y + 3, 5, 1, P.gold);
        rect(c, x + 10, y + 3, 4, 3, '#383341'); rect(c, x, y + 10, 1, 15, '#49404b');
    }
    for (const x of [34, 110, 204, 282]) {
        rect(c, x, y + 10, 12, 7, P.dark); rect(c, x + 2, y + 11, 8, 3, s?.reaction === 'shock' ? '#b17ac9' : P.gold);
    }
    c.restore();
}
