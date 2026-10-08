import { PLAYER_PALETTE, PLAYER_SPRITES } from '../assets/playerSpriteSpec';
import { ART, hashAt, mixColor } from '../graphics/palette';
import type { SpriteAtlas } from '../graphics/pixels';
import { BOSS_LOOPS, WORLD_PALETTE } from './WorldAssets';
import { box, oval, pixelLine, polygon, type Point } from './WorldPainting';

// A fixed overlook, authored around the Oficina sign. The camera never travels:
// roots, cliffs and the horizon keep their anchors while the weather moves.
const P = {
    sky: '#74b9ce', haze: '#d7e5cd', cloud: '#f3efd7', cloudShade: '#d5e3d5',
    far: '#a0c4bf', farLight: '#bad2c5', island: '#739f96', islandLight: '#95b4a0',
    sea: '#6daeb4', seaLight: '#a3cfca', shallows: '#8cbfba', foam: '#d5dfc4',
    leafDark: '#426f5a', leaf: '#648e66', leafLight: '#92b777', leafTip: '#bdcf8d',
    trunk: '#826f52', trunkLight: '#b29b6a', grass: '#819f65', grassLight: '#bbce87',
    grassShade: '#537b5d', earth: '#9f8c69', earthLight: '#baa17a', earthShade: '#7e7760',
    sand: '#d5c497', sandLight: '#e6d5a9', shadow: '#526f60',
} as const;
const TAU = Math.PI * 2;
const cycle = (time: number, duration: number) => ((time % duration) + duration) % duration / duration;

function surface(paint: (c: CanvasRenderingContext2D) => void, width = 320, height = 180): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const c = canvas.getContext('2d')!;
    c.imageSmoothingEnabled = false; paint(c);
    return canvas;
}

function cloud(width: number, height: number): HTMLCanvasElement {
    return surface(c => {
        oval(c, 0, height * .42, width, height * .48, P.cloudShade);
        oval(c, 1, height * .38, width - 2, height * .42, P.cloud);
        oval(c, width * .14, height * .18, width * .4, height * .6, P.cloud);
        oval(c, width * .43, 0, width * .37, height * .76, P.cloud);
        box(c, 6, height - 3, width - 12, 1, P.cloudShade);
    }, width, height);
}

function sky(c: CanvasRenderingContext2D): void {
    for (let y = 0; y < 180; y += 3)
        box(c, 0, y, 320, 3, mixColor(P.sky, P.haze, Math.min(1, y / 150)));
    // A quiet late-morning sun, without a pulsing halo or screen-wide effects.
    oval(c, 266, 23, 23, 23, '#dce6cc');
    oval(c, 269, 26, 17, 17, '#f0eac7');
}

function coast(c: CanvasRenderingContext2D): void {
    // Every silhouette reaches the waterline; no isolated props in a parallax plane.
    polygon(c, [[0, 112], [0, 99], [12, 94], [22, 91], [30, 95], [36, 91], [48, 100],
        [62, 104], [76, 112], [105, 119], [0, 121]], P.far);
    polygon(c, [[0, 105], [21, 94], [30, 99], [35, 97], [49, 105], [75, 116], [0, 120]], P.farLight);
    polygon(c, [[220, 119], [239, 111], [253, 100], [266, 96], [277, 99], [287, 107],
        [300, 102], [320, 108], [320, 122]], P.island);
    polygon(c, [[238, 114], [255, 104], [263, 99], [274, 100], [280, 108], [268, 115]], P.islandLight);
    // The lighthouse sits on the distant headland, small enough to stay scenery.
    polygon(c, [[264, 97], [265, 76], [272, 76], [273, 98]], '#d8d4b4');
    box(c, 266, 77, 2, 19, '#eee2bf');
    box(c, 265, 83, 7, 3, '#b98e79'); box(c, 264, 92, 9, 3, '#b98e79');
    box(c, 263, 75, 11, 2, '#668782'); box(c, 265, 71, 7, 4, '#739997');
    box(c, 266, 72, 3, 2, '#e9d9a7');
    polygon(c, [[263, 71], [269, 67], [275, 71]], '#a67e69');
    box(c, 261, 98, 15, 2, '#b3b9a1');
    box(c, 0, 119, 320, 37, P.sea);
    box(c, 0, 119, 320, 1, '#b3d2c7');
    box(c, 0, 133, 320, 23, '#79b5b6');
    box(c, 0, 143, 320, 13, P.shallows);
    // Broken reflections share the lighthouse's horizontal anchor.
    box(c, 264, 121, 9, 1, '#bdcec0'); box(c, 262, 124, 11, 1, '#a4c7bd');
    box(c, 266, 127, 8, 1, '#a4c7bd');
}

function shrub(c: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    box(c, x + 3, y - 2, width - 6, 3, P.leafDark);
    oval(c, x, y - height, width, height, P.leafDark);
    oval(c, x + 2, y - height, width * .52, height * .72, P.leaf);
    oval(c, x + width * .4, y - height + 1, width * .5, height * .62, P.leaf);
    box(c, x + 5, y - height + 1, width * .24, 2, P.leafLight);
    box(c, x + width * .64, y - height + 2, width * .2, 1, P.leafLight);
}

function foreground(c: CanvasRenderingContext2D): void {
    // The left shore leads the eye into the cove instead of cutting through the sky.
    polygon(c, [[0, 126], [17, 125], [27, 130], [42, 132], [54, 140], [76, 145],
        [94, 149], [95, 158], [0, 158]], P.sand);
    polygon(c, [[0, 125], [18, 125], [27, 130], [42, 131], [56, 140], [43, 138], [24, 134], [0, 135]], '#9db48a');
    pixelLine(c, 56, 143, 78, 148, P.sandLight);
    box(c, 79, 149, 16, 1, P.sandLight);
    // A smaller palm has a visible bank beneath its roots.
    pixelLine(c, 18, 127, 20, 105, '#9a9e76', 2);
    polygon(c, [[19, 106], [6, 99], [1, 104], [9, 102], [19, 110], [29, 104], [38, 106], [30, 101]], '#86a583');
    polygon(c, [[18, 108], [20, 97], [24, 93], [23, 104]], '#9ab790');
    oval(c, 13, 126, 12, 3, '#93ab80');

    box(c, 0, 157, 320, 23, P.earth);
    box(c, 0, 170, 320, 10, P.earthShade);
    polygon(c, [[0, 151], [23, 152], [48, 154], [74, 154], [95, 153], [125, 155],
        [194, 155], [225, 153], [252, 154], [284, 152], [320, 150], [320, 160], [0, 160]], P.grassShade);
    polygon(c, [[0, 150], [23, 151], [48, 153], [74, 153], [95, 152], [125, 154],
        [194, 154], [225, 152], [252, 153], [284, 151], [320, 149], [320, 155], [0, 157]], P.grass);
    // The actors stand on the same level as the posts, with a warm worn footpath.
    box(c, 27, 154, 272, 3, P.sand);
    box(c, 34, 154, 253, 1, P.sandLight);
    box(c, 48, 157, 227, 2, P.earthLight);
    for (let i = 0; i < 43; i++) {
        const x = hashAt(i, 4, 12) % 320, y = 161 + hashAt(i, 9, 71) % 18;
        box(c, x, y, 2 + i % 4, 1, y < 170 ? P.earthLight : P.earth);
    }
    for (const [x, y, w] of [[4, 154, 8], [20, 155, 6], [59, 155, 12], [78, 155, 6], [231, 155, 10], [304, 153, 12]]) {
        box(c, x, y, w, 1, P.grassLight); box(c, x + 2, y + 1, w - 3, 2, P.grassShade);
    }
    shrub(c, -12, 153, 40, 18); shrub(c, 58, 154, 28, 9);
    shrub(c, 297, 153, 36, 15);
    oval(c, 78, 152, 9, 4, '#818e79'); box(c, 79, 152, 6, 1, '#b3b39a');
    oval(c, 300, 158, 9, 4, '#818e79'); box(c, 301, 158, 5, 1, '#b3b39a');
    // Contact shadows are fixed. Idle animation must never lift the cast off the path.
    oval(c, 31, 153, 19, 4, P.shadow); oval(c, 253, 152, 47, 5, P.shadow);
    oval(c, 99, 158, 16, 4, P.earthShade); oval(c, 207, 158, 16, 4, P.earthShade);
    // Cropped near leaves frame the overlook without crowding either character.
    for (const [x, direction] of [[1, 1], [319, -1]]) {
        for (const [dx, dy] of [[-8, -22], [3, -19], [15, -13], [20, -6]]) {
            polygon(c, [[x, 180], [x + (dx * .4 - 3) * direction, 180 + dy * .6],
                [x + dx * direction, 180 + dy], [x + (dx * .6 + 2) * direction, 180 + dy * .4], [x + 3 * direction, 180]], P.leafDark);
            pixelLine(c, x, 178, x + dx * direction, 181 + dy, P.leaf);
        }
    }
}

function palm(c: CanvasRenderingContext2D, rootX: number, rootY: number, height: number, time: number, phase: number): void {
    const wind = Math.sin(time / 3200 + phase) * .8 + Math.sin(time / 5700 + phase) * .4;
    const crownX = rootX + 5 + wind, crownY = rootY - height;
    // Continuous tapered trunk, rooted at exactly the same pixel in every frame.
    for (let y = 0; y < height; y++) {
        const u = y / height, x = rootX + (5 + wind) * u * u;
        box(c, x - 2, rootY - y, 5 - u * 2, 1, P.trunk);
        box(c, x - 2, rootY - y, 1, 1, P.trunkLight);
        if (y % 9 === 4) box(c, x - 1, rootY - y, 3, 1, '#6e7254');
    }
    const leaves: readonly [number, number, number, number][] = [[-29, 9, -9, 4.5], [-25, -5, -11, 4], [-10, -20, -16, 3.5],
        [14, -20, -16, 3.5], [31, -5, -12, 4.5], [34, 11, -6, 4.5], [20, 26, 4, 4.5], [-21, 24, 3, 4.5]];
    leaves.forEach(([dx, dy, arch, width], i) => {
        const flutter = Math.sin(time / 2700 + phase + i * .75) * .9;
        const endX = crownX + dx + wind * .6, endY = crownY + dy + flutter;
        const upper: Point[] = [], lower: Point[] = [], spine: Point[] = [];
        for (let j = 0; j <= 6; j++) {
            const u = j / 6, v = 1 - u;
            const x = v * v * crownX + 2 * v * u * (crownX + dx * .45) + u * u * endX;
            const y = v * v * (crownY + 2) + 2 * v * u * (crownY + arch - 5) + u * u * endY;
            const thickness = Math.sin(u * Math.PI) * width;
            const tx = 2 * v * dx * .45 + 2 * u * (endX - crownX - dx * .45);
            const ty = 2 * v * (arch - 7) + 2 * u * (endY - crownY - arch + 5);
            const length = Math.hypot(tx, ty) || 1, nx = -ty / length, ny = tx / length;
            spine.push([x, y]);
            upper.push([x + nx * thickness * .4, y + ny * thickness * .4]);
            lower.push([x - nx * thickness, y - ny * thickness]);
        }
        polygon(c, [...upper, ...lower.reverse()], i < 4 ? P.leaf : P.leafDark);
        for (let j = 1; j < spine.length - 1; j++) {
            const [x, y] = spine[j], [px, py] = spine[j - 1];
            pixelLine(c, px, py, x, y, i < 4 ? P.leafLight : P.leaf);
        }
    });
    oval(c, crownX - 2, crownY + 3, 4, 5, '#88764e');
    oval(c, crownX + 2, crownY + 4, 4, 4, '#b29a65');
}

function waves(c: CanvasRenderingContext2D, time: number): void {
    // Each ripple moves within its own patch of water; no recycled strips or sparkle noise.
    for (let i = 0; i < 21; i++) {
        const x = (i * 47 + 13) % 320, y = 123 + i * 7 % 26;
        const drift = Math.sin(time / 2600 + i * 1.7) * 2;
        const length = 3 + i % 8 + Math.round(Math.sin(time / 3400 + i) * 2);
        box(c, x + drift, y, length, 1, i % 4 === 0 ? P.seaLight : '#8ac0bf');
    }
    for (let i = 0; i < 3; i++) {
        const u = cycle(time + i * 4100, 12400), y = 140 + u * 7;
        c.globalAlpha = Math.sin(u * Math.PI) * .55;
        box(c, 52 + i * 23 + Math.sin(u * Math.PI) * 3, y, 20 + i * 4, 1, P.foam);
    }
    c.globalAlpha = 1;
}

function sailboat(c: CanvasRenderingContext2D, time: number): void {
    const x = Math.round(66 + Math.sin(time / 17000) * 9), y = 130 + Math.round(Math.sin(time / 2300) * .6);
    box(c, x - 6, y + 3, 21, 1, '#9bcac4');
    pixelLine(c, x + 4, y - 13, x + 4, y, '#8a917a');
    polygon(c, [[x + 3, y - 13], [x - 4, y - 2], [x + 3, y - 2]], '#e9e2bc');
    polygon(c, [[x + 6, y - 11], [x + 12, y - 2], [x + 6, y - 2]], '#cfdbbf');
    polygon(c, [[x - 5, y], [x + 14, y], [x + 10, y + 3], [x - 2, y + 3]], '#77978d');
    box(c, x - 4, y, 17, 1, '#cad4b5');
}

export interface TitleBird { x: number; y: number; wing: number; near: boolean }
/** Long, staggered passages with offscreen resets and a glide between wingbeats. */
export function titleBirds(time: number, reducedMotion = false): TitleBird[] {
    if (reducedMotion) return [];
    const birds: TitleBird[] = [];
    for (const [start, duration, period, direction, height, count] of [
        [-4000, 39000, 68000, 1, 48, 3], [25000, 47000, 91000, -1, 84, 2],
    ]) {
        const age = cycle(time - start, period) * period;
        if (age >= duration) continue;
        for (let i = 0; i < count; i++) {
            const u = age / duration, x = direction > 0 ? -36 + u * 410 - i * 10 : 356 - u * 410 + i * 12;
            const flight = cycle(age + i * 190, 4200);
            const wing = flight < .28 ? Math.round(Math.sin(flight / .28 * TAU) * 2) : -1;
            birds.push({ x: Math.round(x), y: Math.round(height + Math.sin(u * TAU + i * .3) * 4 + i * 4), wing, near: direction < 0 });
        }
    }
    return birds;
}

function birds(c: CanvasRenderingContext2D, time: number, reducedMotion: boolean): void {
    for (const bird of titleBirds(time, reducedMotion)) {
        if (bird.x < -8 || bird.x > 328) continue;
        const { x, y, wing, near } = bird, color = near ? '#6c9295' : '#8aa9a6', span = near ? 4 : 3;
        pixelLine(c, x - span, y + wing, x - 1, y, color);
        pixelLine(c, x + 1, y, x + span, y + wing, color);
        box(c, x, y + 1, 1, 1, color);
    }
}

function flowers(c: CanvasRenderingContext2D, time: number): void {
    for (const [x, y, phase] of [[8, 154, 0], [24, 156, 2], [63, 155, 1], [311, 154, 4]]) {
        const sway = Math.round(Math.sin(time / 3100 + phase) * .65);
        pixelLine(c, x, y, x + sway, y - 5, P.leafDark);
        box(c, x + sway - 1, y - 6, 3, 2, '#e8d8a5');
        box(c, x + sway, y - 6, 1, 1, '#c69e61');
    }
}

function restingGull(c: CanvasRenderingContext2D, time: number): void {
    // Feet touch the little rock at (78, 152). A rare head turn, not another loop in the air.
    const looksLeft = cycle(time, 11800) > .83;
    box(c, 81, 151, 1, 1, '#a9956c'); box(c, 84, 151, 1, 1, '#a9956c');
    box(c, 80, 148, 5, 3, '#e4e5ca'); box(c, 80, 149, 3, 1, '#a6bcb1');
    const head = looksLeft ? 80 : 84;
    box(c, head, 146, 2, 3, '#f0ecd1'); box(c, head + (looksLeft ? 0 : 1), 147, 1, 1, '#718c86');
    box(c, head + (looksLeft ? -1 : 2), 148, 1, 1, '#c6ad73');
}

/** Title-only scenery. Cached native planes, one simulation clock, no timers or random state. */
export class WorldTitleScene {
    private readonly sky = surface(sky);
    private readonly coast = surface(coast);
    private readonly foreground = surface(foreground);
    private readonly clouds = [cloud(49, 16), cloud(64, 21), cloud(37, 12)];

    draw(c: CanvasRenderingContext2D, atlas: SpriteAtlas, time: number, reducedMotion = false): void {
        const t = reducedMotion ? 0 : time;
        c.save(); c.imageSmoothingEnabled = false;
        c.drawImage(this.sky, 0, 0);
        this.clouds.forEach((image, i) => {
            const x = cycle(t * [.7, 1, .45][i] + [93000, 283000, 207000][i], 420000) * 420 - 80;
            c.drawImage(image, Math.round(x), [31, 52, 91][i]);
        });
        c.drawImage(this.coast, 0, 0);
        waves(c, t); sailboat(c, t); birds(c, t, reducedMotion);
        c.drawImage(this.foreground, 0, 0);
        palm(c, 9, 151, 65, t, .2); palm(c, 312, 153, 85, t, 1.8);
        // The existing idle artwork keeps both feet planted; only an occasional blink.
        const blink = !reducedMotion && cycle(t, 6400) > .968;
        atlas.draw(c, blink ? PLAYER_SPRITES.blink : PLAYER_SPRITES.idle, PLAYER_PALETTE, 32, 130);
        // Two authored shoulder poses, held for seconds rather than a rapid whole-body bob.
        const breath = !reducedMotion && cycle(t + 900, 6200) > .65 ? 1 : 0;
        atlas.draw(c, BOSS_LOOPS.joao.idle[breath], WORLD_PALETTE, 252, 99);
        flowers(c, t); restingGull(c, t);
        // A tiny shell belongs to the path, with the same light as the sign.
        box(c, 53, 157, 3, 1, ART.paper); box(c, 54, 156, 1, 1, P.sandLight);
        c.restore();
    }
}
