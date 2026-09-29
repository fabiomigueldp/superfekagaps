import { SpriteAtlas } from '../graphics/pixels';
import { TilePainter } from '../graphics/TilePainter';
import { pixelText } from '../graphics/BitmapFont';
import { MINION_FRAMES, SPRITE_PALETTE } from '../graphics/sprites';
import { BOSS_LOOPS, WORLD_PALETTE, BARRELS, PRESSURE_BARRELS, SEALS, foeFrame, bossFrame, type BossPose } from './WorldAssets';
import type { Island } from './types';
import type { WorldLevel, WorldObjects } from './WorldPhysics';
import type { WorldFoe } from './WorldEnemies';
import type { BossEncounter } from './BossEncounter';
import { TileType as T } from '../constants';
export const rect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function mountain(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
    for (let i = 0; i < h; i++) {
        const width = w * i / h;
        rect(c, x + (w - width) / 2, y + i, width, 1, color);
    }
}
export class WorldArt {
    atlas = new SpriteAtlas();
    private tiles = new TilePainter();
    private backgrounds = new Map<number, HTMLCanvasElement[]>();
    private layers(world: number) {
        if (this.backgrounds.has(world))
            return this.backgrounds.get(world)!;
        const layers = [0, 1, 2].map(depth => {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 240;
            const c = canvas.getContext('2d')!;
            if (depth === 0) {
                for (let i = 0; i < 7; i++) {
                    const x = i * 99 + 13, y = 29 + i % 3 * 12;
                    rect(c, x + 5, y, 34, 7, '#e6e2db');
                    rect(c, x + 13, y - 5, 19, 7, '#e6e2db');
                    rect(c, x, y + 5, 46, 3, '#cad5d4');
                }
                for (let i = 0; i < 6; i++)
                    mountain(c, i * 120 - 30, 68 + i % 2 * 15, 170, 170, world === 5 ? '#83b6cd' : world === 3 ? '#8990af' : '#9eafbd');
            }
            if (depth === 1) {
                if (world === 1) {
                    rect(c, 0, 133, 640, 107, '#529baa');
                    for (let i = 0; i < 80; i++)
                        rect(c, (i * 41) % 640, 141 + i % 13 * 5, 9 + i % 7, 1, '#79b8be');
                    for (let i = 0; i < 7; i++)
                        mountain(c, i * 107, 107 + i % 2 * 12, 73, 60, '#80a99a');
                }
                if (world === 2 || world === 4) {
                    for (let i = 0; i < 5; i++) {
                        const x = i * 139, y = 63 + i % 3 * 13;
                        rect(c, x, y, 7, 177, '#698494');
                        rect(c, x - 24, y, 89, 5, '#7892a0');
                        rect(c, x + 53, y + 5, 2, 54, '#698494');
                        rect(c, x + 41, y + 57, 27, 22, '#839da6');
                        for (let n = 0; n < 6; n++)
                            rect(c, x + 4, y + n * 25, 17, 2, '#849eaa');
                        if (world === 4) {
                            rect(c, x + 20, y + 24, 110, 1, '#71849c');
                            mountain(c, x - 30, 134, 170, 130, '#879ca5');
                        }
                    }
                }
                if (world === 3 || world === 5) {
                    for (let i = 0; i < 5; i++) {
                        const x = i * 137 + 11, y = 63 + i % 2 * 17;
                        rect(c, x, y, 69, 161, '#657b94');
                        rect(c, x + 4, y - 5, 61, 6, '#91a8b8');
                        rect(c, x + 6, y + 9, 57, 135, '#8494b0');
                        rect(c, x + 8, y + 53, 53, 86, world === 3 ? '#9782b4' : '#91b5d2');
                        rect(c, x + 11, y + 14, 5, 106, '#b0becd');
                        rect(c, x + 64, y + 8, 3, 130, '#566d88');
                        rect(c, x + 69, y + 22, 55, 7, '#7c8fa4');
                        rect(c, x + 113, y + 22, 7, 134, '#7c8fa4');
                        for (let b = 0; b < 4; b++)
                            rect(c, x + 24 + b % 2 * 13, y + 66 + b * 17, 3, 3, '#b0a5cd');
                    }
                }
                if (world === 6) {
                    for (let i = 0; i < 5; i++) {
                        const x = i * 141 + 10, y = 73 + i % 2 * 24;
                        rect(c, x, y, 60, 170, '#aea3ae');
                        rect(c, x - 4, y - 6, 68, 7, '#c9bcb9');
                        for (let a = 0; a < 5; a++)
                            rect(c, x + a * 13, y - 12, 7, 7, '#c9bcb9');
                        for (let a = 0; a < 3; a++) {
                            rect(c, x + 11 + a * 16, y + 21, 7, 16, '#827f99');
                            rect(c, x + 12 + a * 16, y + 18, 5, 5, '#827f99');
                        }
                        rect(c, x + 60, y + 65, 90, 120, '#b8aab1');
                    }
                }
            }
            if (depth === 2) {
                if (world === 1 || world === 4 || world === 6) {
                    for (let i = 0; i < 13; i++) {
                        const x = i * 57 + 11, y = 153 + i % 3 * 9;
                        rect(c, x + 7, y, 4, 60, '#547c79');
                        if (world === 4) {
                            mountain(c, x - 5, y - 33, 30, 47, '#638e89');
                            mountain(c, x - 8, y - 16, 36, 40, '#709b91');
                        }
                        else {
                            rect(c, x - 7, y - 11, 31, 18, '#739d83');
                            rect(c, x - 2, y - 17, 23, 16, '#85ad8e');
                            rect(c, x + 1, y - 19, 14, 5, '#a0bf9b');
                        }
                    }
                }
                else if (world === 2) {
                    for (let i = 0; i < 9; i++) {
                        const x = i * 84;
                        rect(c, x, 166, 63, 42, '#8c9397');
                        rect(c, x + 3, 168, 57, 2, '#b1b6ac');
                        for (let j = 0; j < 5; j++)
                            rect(c, x + 9 + j * 10, 173, 2, 30, '#778991');
                    }
                }
                else {
                    for (let i = 0; i < 8; i++) {
                        const x = i * 91;
                        rect(c, x, 155, 8, 85, '#728799');
                        rect(c, x, 153, 63, 9, '#8194a4');
                        rect(c, x + 57, 153, 7, 72, '#728799');
                        rect(c, x - 2, 168, 12, 4, '#9fb1b9');
                    }
                }
            }
            return canvas;
        });
        this.backgrounds.set(world, layers);
        return layers;
    }
    background(c: CanvasRenderingContext2D, island: Island, cx: number, cy: number, time: number) {
        // Native horizontal bands keep the backdrop on the pixel grid.
        const hex = (s: string) => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
        const a = hex(island.sky[0]), b = hex(island.sky[1]);
        for (let y = 0; y < 180; y += 4) {
            const t = y / 180;
            rect(c, 0, y, 320, 4, `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`);
        }
        this.layers(island.id).forEach((layer, i) => { const f = [.08, .22, .42][i], x = -((cx * f + (i === 0 ? time * .001 : 0)) % 640); c.drawImage(layer, Math.round(x), Math.round(-cy * .09)); c.drawImage(layer, Math.round(x + 640), Math.round(-cy * .09)); });
    }
    decor(c: CanvasRenderingContext2D, world: number, cx: number, cy: number, time: number) {
        const x = 116 - cx, y = 154 - cy;
        if (x > -160 && x < 340) {
            const labels = ['COSTA DOS GAPS', 'PORTO DO BIELZÃO', 'FÁBRICA DE SUCO', 'SERRA SUSPENSA', 'RESERVA GELADA', 'DOMÍNIO PIZZARINO'];
            rect(c, x + 7, y + 27, 4, 43, '#556475');
            rect(c, x + 121, y + 27, 4, 43, '#556475');
            rect(c, x, y, 133, 30, '#273b50');
            rect(c, x + 2, y + 2, 129, 26, '#617d8d');
            rect(c, x + 3, y + 3, 127, 1, '#afc6c5');
            pixelText(c, labels[world - 1], x + 66, y + 8, '#f9e3af', 1, 'center');
            pixelText(c, world === 3 ? 'QUALIDADE CALABREZZO' : 'BOA VIAGEM!', x + 66, y + 20, '#c6dedc', 1, 'center');
        }
        if (world === 3 || world === 5) {
            for (let i = Math.max(0, Math.floor(cx / 480)); i < Math.ceil((cx + 320) / 480); i++) {
                const xx = i * 480 + 324 - cx, yy = 194 - cy;
                rect(c, xx, yy, 33, 30, '#304759');
                rect(c, xx + 2, yy + 2, 29, 26, '#677f91');
                rect(c, xx + 5, yy + 5, 23, 15, '#293d52');
                for (let n = 0; n < 3; n++) {
                    rect(c, xx + 8 + n * 6, yy + 8, 3, 9, '#9963bd');
                    rect(c, xx + 8 + n * 6, yy + 7, 3, 2, '#cbacd8');
                }
                rect(c, xx + 5, yy + 23, 4, 2, Math.floor(time / 350) % 2 ? '#b0d982' : '#7cab72');
                rect(c, xx + 17, yy + 23, 11, 2, '#b9ccd3');
            }
        }
    }
    terrain(c: CanvasRenderingContext2D, level: WorldLevel, island: Island, cx: number, cy: number, time: number) {
        const tiles = level.getModifiedTiles();
        for (let r = Math.max(0, Math.floor(cy / 16)); r < Math.min(tiles.length, Math.ceil((cy + 180) / 16) + 1); r++)
            for (let col = Math.max(0, Math.floor(cx / 16)); col < Math.min(level.data.width, Math.ceil((cx + 320) / 16) + 1); col++) {
                const t = tiles[r][col];
                if (!t)
                    continue;
                const x = col * 16 - cx, y = r * 16 - cy;
                if (t === T.GROUND) {
                    const [top, base, dark] = island.soil;
                    rect(c, x, y, 16, 16, base);
                    if (!tiles[r - 1]?.[col]) {
                        rect(c, x, y, 16, 2, top);
                        rect(c, x, y + 2, 16, 2, island.id === 1 ? '#4a844b' : dark);
                        if (island.id === 1 && col % 5 === 2) {
                            rect(c, x + 4, y - 3, 1, 3, '#588b50');
                            rect(c, x + 3, y - 4, 3, 2, '#e8e1b5');
                        }
                    }
                    if (!tiles[r]?.[col - 1])
                        rect(c, x, y, 2, 16, dark);
                    if (!tiles[r]?.[col + 1])
                        rect(c, x + 14, y, 2, 16, dark);
                    if (island.id === 2) {
                        rect(c, x, y + 14, 16, 2, '#4c5660');
                        rect(c, x + ((r % 2) * 8), y, 1, 16, '#5d665e');
                        rect(c, x + 3, y + 5, 9, 1, '#b1a17a');
                    }
                    if (island.id === 3 || island.id === 5) {
                        rect(c, x, y + 15, 16, 1, '#243e55');
                        rect(c, x + 15, y, 1, 16, '#243e55');
                        if (col % 4 === 1 && r % 3 === 0)
                            for (let v = 0; v < 3; v++)
                                rect(c, x + 4, y + 5 + v * 3, 8, 1, island.id === 5 ? '#5a91ad' : '#2a455c');
                    }
                    if (island.id === 4) {
                        rect(c, x, y + 13, 16, 1, '#516778');
                        rect(c, x + ((r % 2) * 7), y + 3, 1, 10, '#677c86');
                        if (!tiles[r - 1]?.[col])
                            rect(c, x, y, 16, 2, '#e0e4d3');
                    }
                    if (island.id === 6) {
                        rect(c, x, y + 15, 16, 1, '#57506d');
                        rect(c, x + (r % 2 ? 7 : 15), y, 1, 16, '#57506d');
                        rect(c, x + 2, y + 3, 11, 1, '#b1a6af');
                    }
                    const v = ((Math.imul(col + 7, 73856093) ^ Math.imul(r + 3, 19349663)) >>> 0) % 19;
                    if (island.id === 1) {
                        if (tiles[r - 1]?.[col] === T.GROUND && tiles[r - 2]?.[col] === T.GROUND) {
                            rect(c, x + 1, y + 1, 14, 14, v % 3 ? '#987c60' : '#907761');
                            if (v % 4 === 0) {
                                rect(c, x + 3, y + 4, 9, 6, '#7c6e5c');
                                rect(c, x + 4, y + 4, 7, 1, '#b39c79');
                            }
                        }
                        else if (v % 3 === 0) {
                            rect(c, x + 3, y + 4, 2, 6, '#706744');
                            rect(c, x + 4, y + 9, 4, 1, '#706744');
                        }
                    }
                    if (v % 3 !== 0)
                        rect(c, x + 3 + v % 5, y + 8, 3 + v % 4, 1, dark);
                    if (island.id === 3 || island.id === 5) {
                        rect(c, x + 2, y + 2, 1, 1, top);
                        rect(c, x + 13, y + 13, 1, 1, dark);
                    }
                    else
                        rect(c, x + 9, y + 12 - v % 3, 3, 1, top);
                }
                else
                    this.tiles.draw(c, t, x, y, tiles, r, col, island.id === 6 ? 'citadel' : island.id === 5 ? 'ember' : 'meadow', time, col, r);
            }
    }
    objects(c: CanvasRenderingContext2D, objects: WorldObjects, cx: number, cy: number, time: number) {
        for (const b of objects.bodies) {
            const x = Math.round(b.x - cx), y = Math.round(b.y - cy), w = b.width, h = b.height;
            if(b.to&&['platform','lift','support','swing'].includes(b.kind)) {
                const home=b.home??{x:b.x,y:b.y},from={x:home.x+w/2-cx,y:home.y-24-cy},to={x:b.to.x+w/2-cx,y:b.to.y-24-cy};
                if(Math.max(from.x,to.x)>-40&&Math.min(from.x,to.x)<360){
                    const steps=Math.max(Math.abs(to.x-from.x),Math.abs(to.y-from.y),1);
                    for(let t=0;t<=steps;t+=3){const xx=from.x+(to.x-from.x)*t/steps,yy=from.y+(to.y-from.y)*t/steps;rect(c,xx,yy,3,1,'#637c88');}
                    for(const end of [from,to]){rect(c,end.x-3,end.y-3,7,7,'#30475b');rect(c,end.x-1,end.y-1,3,3,b.active?'#a1d59a':'#d7ba7d');}
                }
            }
            if (x + w < 0 || x > 320 || y > 180 || y + h < 0)
                continue;
            if (['platform', 'lift', 'swing', 'support'].includes(b.kind)) {
                if (b.kind === 'lift' || b.kind === 'swing' || b.kind === 'platform' && b.to) {
                    rect(c, x + 5, y - 24, 1, 24, '#52687b');
                    rect(c, x + w - 6, y - 24, 1, 24, '#52687b');
                    rect(c,x+3,y-25,w-6,3,'#536b7b');rect(c,x+w/2-3,y-27,6,4,'#c5bd95');
                }
                rect(c, x, y, w, h, '#233c51');
                rect(c, x + 1, y, w - 2, 2, '#f2d394');
                rect(c, x + 2, y + 3, w - 4, 2, '#ba9254');
                for (let i = 7; i < w; i += 12)
                    rect(c, x + i, y + 2, 1, 4, '#576574');
                if (b.kind === 'support')
                    rect(c, x + w / 2, y, 3, h, '#cb6770');
            }
            else if (b.kind === 'belt') {
                rect(c, x, y, w, h + 5, '#26364a');
                rect(c, x, y, w, 2, '#bdcdd1');
                for (let i = 0; i < w; i += 12) {
                    const shift = (Math.floor(time / 100) * (b.direction ?? 1) * (b.active ? -1 : 1)) % 12;
                    rect(c, x + i + shift, y + 3, 5, 2, '#6c94a4');
                }
                pixelText(c, (b.direction ?? 1) * (b.active ? -1 : 1) < 0 ? '←' : '→', x + w / 2, y + 7, '#f1c35a', 1, 'center');
            }
            else if (b.kind === 'switch') {
                rect(c, x - 2, y - 2, w + 4, h + 3, '#25374b');
                rect(c, x, y - 4 + (b.timer > 0 ? 2 : 0), w, 5, b.active ? '#a0d879' : '#ecc166');
                pixelText(c, '↓', x + w / 2, y - 14, '#f9e6b1', 1, 'center');
            }
            else if (b.kind === 'jet') {
                const state = objects.jetState(b);
                rect(c, x - 4, y + h - 6, w + 8, 8, '#223b50');
                rect(c, x - 3, y + h - 7, w + 6, 3, '#9cafb8');
                if (state === 'warning') {
                    rect(c, x - 2, y + h - 12, w + 4, 3, Math.floor(time / 100) % 2 ? '#eec769' : '#b9695e');
                    for (let i = 0; i < 3; i++)
                        rect(c, x + i * 4, y + h - 18 - i % 2 * 2, 1, 4, '#e3b4ee');
                }
                if (state === 'active') {
                    rect(c, x, y, w, h - 5, '#814aaa');
                    rect(c, x + 2, y + 2, w - 4, h - 9, '#c78bea');
                    for (let i = 0; i < h; i += 8)
                        rect(c, x - 1 + (Math.floor(time / 80) + i) % 3, y + i, w + 2, 2, '#ecc0f2');
                }
            }
            else if (b.kind === 'target' && !b.active) {
                rect(c, x, y, w, h, '#597a99');
                rect(c, x + 2, y + 1, w - 4, h - 2, '#b2d7e1');
                rect(c, x + 5, y + 4, 2, h - 8, '#ecf9f0');
                pixelText(c, '×', x + w / 2, y + h / 2 - 3, '#775799', 1, 'center');
            }
            else if (b.kind === 'launcher') {
                rect(c, x - 2, y + 8, w + 5, 10, '#354b62');
                rect(c, x - 6, y + 4, w + 6, 8, '#7998a7');
            }
        }
        for (const p of objects.barrels)
            this.atlas.draw(c, (p.pressurized ? PRESSURE_BARRELS : BARRELS)[Math.floor(time / 100) % 4], WORLD_PALETTE, p.x - cx - 2, p.y - cy - 4);
    }
    foe(c: CanvasRenderingContext2D, e: WorldFoe, cx: number, cy: number, _time: number) {
        if (e.dead && e.deadTimer > 360)
            return;
        const x = Math.round(e.x - cx), y = Math.round(e.y - cy);
        if (x < -45 || x > 350)
            return;
        if (e.spec.kind === 'rail') {
            rect(c, e.homeX - (e.spec.range ?? 48) - cx, y - 10, (e.spec.range ?? 48) * 2 + 22, 2, '#43596d');
            rect(c, x + 10, y - 10, 2, 12, '#a4b3b9');
        }
        if (e.phase === 'warning') {
            pixelText(c, '!', x + e.width / 2, y - 12, '#fff0b6', 1, 'center');
            rect(c, x - 1, y - 4, e.width + 2, 2, '#3c344c');
            rect(c, x, y - 4, e.width * Math.min(1, e.timer / 800), 2, '#edbb68');
            if (e.spec.kind === 'charger')
                for (let i = 1; i <= 3; i++)
                    pixelText(c, e.facing > 0 ? '→' : '←', x + e.width / 2 + e.facing * i * 18, y + e.height - 4, '#f4c895', 1, 'center');
        }
        if (e.phase === 'attack' && e.spec.kind === 'charger')
            for (let i = 0; i < 3; i++)
                rect(c, x - e.facing * (i * 8 + 4), y + e.height - 3, 5 - i, 2, '#d9c094');
        c.save();
        if (e.dead)
            c.globalAlpha = Math.max(0, 1 - e.deadTimer / 360);
        else if (e.flash > 0 && Math.floor(e.flash / 45) % 2)
            c.globalAlpha = .55;
        const frames = e.spec.kind === 'minion' ? MINION_FRAMES : null;
        const frame = frames ? frames[Math.floor(e.age / 150) % frames.length] : foeFrame(e.spec.kind as Exclude<typeof e.spec.kind, 'minion'>, e.phase, e.timer, e.armor);
        const xx = x + e.width / 2 - frame[0].length / 2, yy = y + e.height - frame.length - (e.dead ? Math.sin(e.deadTimer / 360 * Math.PI) * 12 : 0);
        this.atlas.draw(c, frame, frames ? SPRITE_PALETTE : WORLD_PALETTE, xx, yy, e.facing > 0);
        if (e.spec.kind === 'helmet' && !e.armor && e.phase === 'stunned') {
            rect(c, x - 7, y - 12 - e.timer * .012, 13, 4, '#edc267');
            rect(c, x - 4, y - 15 - e.timer * .012, 7, 3, '#ffe7a4');
        }
        if (e.phase === 'rest' && e.spec.kind === 'charger')
            pixelText(c, '...', x + e.width / 2, y - 9, '#a8d3da', 1, 'center');
        c.restore();
    }
    arena(c: CanvasRenderingContext2D, b: BossEncounter, cx: number, cy: number, _time: number) {
        const ground = 224 - cy;
        if (b.character === 'joao') {
            if (b.id === 'J1') {
                for (const x of [8, 300]) {
                    rect(c, x, ground - 78, 8, 80, '#706951');
                    rect(c, x + 2, ground - 77, 3, 77, '#b59b74');
                    rect(c, x - 3, ground - 84, 14, 8, '#d2b484');
                }
                for (let x = 14; x < 306; x += 8) {
                    const yy = ground - 67 + Math.sin((x - 14) / 292 * Math.PI) * 23;
                    rect(c, x, yy, 8, 1, '#c2a97d');
                    if (x % 16 === 14)
                        rect(c, x, yy, 1, ground - yy, '#8c8063');
                }
            }
            else {
                for (const x of [8, 89, 184, 291]) {
                    rect(c, x, ground - 133, 14, 133, '#7a708b');
                    rect(c, x - 3, ground - 134, 20, 5, '#d0bea8');
                    for (let y = ground - 120; y < ground; y += 20)
                        rect(c, x, y, 14, 1, '#a59aa7');
                }
                rect(c, 122, ground - 116, 53, 92, '#8b5d85');
                rect(c, 125, ground - 115, 3, 88, '#c194a3');
                pixelText(c, 'JP', 148, ground - 99, '#ead0a1', 2, 'center');
            }
        }
        else if (b.character === 'biel') {
            for (const x of [8, 304]) {
                rect(c, x, ground - 137, 7, 139, '#536b7b');
                rect(c, x + 1, ground - 136, 3, 136, '#ad996c');
                for (let y = ground - 130; y < ground; y += 16)
                    rect(c, x, y, 7, 2, '#d5b87b');
            }
            rect(c, 8, ground - 137, 303, 6, '#3a4f61');
            rect(c, 9, ground - 136, 301, 2, '#c2ae7a');
            for (let x = 16; x < 301; x += 16)
                rect(c, x, ground - 134, 7, 3, '#907655');
            rect(c, 204 - cx, 171 - cy, 42, 5, '#d0b77e');
            rect(c, 209 - cx, 176 - cy, 3, 48, '#526777');
            rect(c, 238 - cx, 176 - cy, 3, 48, '#526777');
            pixelText(c, b.id === 'B2' ? 'CABO 02 / SERVIÇO' : 'GUINDASTE DO BIEL', 157, ground - 121, '#e6d2a8', 1, 'center');
        }
        else {
            rect(c, 12, ground - 136, 296, 129, '#24394daa');
            for (const x of [17, 77, 137, 197, 257]) {
                rect(c, x, ground - 118, 38, 82, '#344963');
                rect(c, x + 3, ground - 114, 32, 73, b.id === 'C2' ? '#668fa7' : '#65497e');
                rect(c, x + 7, ground - 111, 3, 66, '#aacbd777');
                rect(c, x + 4, ground - 114, 30, 3, '#b1bec8');
                rect(c, x + 3, ground - 44, 32, 4, '#8fa6b3');
            }
            rect(c, 12, ground - 133, 296, 8, '#728e9b');
            rect(c, 15, ground - 132, 290, 2, '#bacbbf');
            pixelText(c, b.id === 'C2' ? 'RESERVA ESPECIAL' : 'FÁBRICA DE SUCO', 160, ground - 101, '#eddfb3', 1, 'center');
            rect(c, 256 - cx, 201 - cy, 57, 5, '#b8cfcd');
            rect(c, 263 - cx, 206 - cy, 4, 18, '#688391');
            rect(c, 300 - cx, 206 - cy, 4, 18, '#688391');
        }
    }
    boss(c: CanvasRenderingContext2D, b: BossEncounter, cx: number, cy: number, time: number) {
        if (b.phase === 'warning' && b.character !== 'calabrezzo') {
            const x = b.targetX - cx - 25;
            rect(c, x, 222 - cy, 50, 2, Math.floor(time / 100) % 2 ? '#ffdb8c' : '#c95f69');
            for (let i = 0; i < 5; i++)
                rect(c, x + i * 11, 216 - cy, 4, 3, '#e7ba73');
        }
        if (b.pattern === 'leap' && ['warning', 'attack'].includes(b.phase)) {
            rect(c, b.targetX - cx - 22, 222 - cy, 44, 2, '#eabd7f');
            pixelText(c, '↓', b.targetX - cx, 205 - cy, '#ffe0a3', 1, 'center');
        }
        if (b.character === 'biel' && b.pattern === 'doubleCargo' && ['warning', 'attack'].includes(b.phase)) {
            const x = b.secondTarget - cx;
            rect(c, x - 21, 222 - cy, 42, 2, '#f1c27e');
            pixelText(c, '2', x, 208 - cy, '#edd599', 1, 'center');
        }
        if (b.character === 'biel' && b.pattern === 'sweep' && b.phase === 'warning') {
            for (let x = Math.max(20, b.targetX - 80); x < Math.min(300, b.targetX + 100); x += 12)
                pixelText(c, '→', x - cx, 212 - cy, '#e9b17c', 1, 'center');
        }
        if (b.id === 'C2' && b.phase !== 'hurt' && b.phase !== 'defeated') {
            const x = (b.cycle % 2 ? 296 : 136) - cx;
            pixelText(c, '↓', x, 161 - cy, '#fff0b3', 1, 'center');
        }
        if (b.danger && b.character === 'joao' && b.id === 'J2') {
            const d = b.danger;
            rect(c, d.x - cx, d.y - cy, d.width, 4, '#f4ce80');
            rect(c, d.x - cx + 2, d.y - cy - 3, d.width - 4, 3, '#fff0b8');
        }
        if (b.danger && b.character === 'biel') {
            const d = b.danger;
            rect(c, d.x - cx + 20, 0, 1, d.y - cy, '#9ba7ad');
            rect(c, d.x - cx, d.y - cy, d.width, d.height, '#263c52');
            rect(c, d.x - cx + 2, d.y - cy + 2, d.width - 4, d.height - 4, '#b68e57');
            for (let i = 0; i < 4; i++)
                rect(c, d.x - cx + i * 11, d.y - cy + 3, 4, d.height - 6, '#e0bd79');
        }
        const loops = b.character === 'biel' || b.character === 'calabrezzo' ? BOSS_LOOPS[b.character] : null;
        const animation = loops?.[b.pose as keyof typeof loops];
        const frame = animation ? animation[Math.floor(b.timer / (b.pose === 'idle' ? 420 : 140)) % animation.length] : bossFrame(b.character, b.pose as BossPose);
        const recoil = b.phase === 'hurt' ? Math.sin(Math.min(1, b.timer / 700) * Math.PI) * 5 : 0;
        c.save();
        if (b.phase === 'hurt' && Math.floor(b.timer / 80) % 2)
            c.globalAlpha = .55;
        const xx = b.x - cx - 5, yy = b.y - cy - 8 + recoil;
        if (b.phase === 'defeated') {
            const t = Math.min(1, b.timer / 750);
            c.translate(Math.round(xx), Math.round(yy + frame.length * t * .55));
            c.scale(1 + t * .1, 1 - t * .55);
            this.atlas.draw(c, frame, WORLD_PALETTE, 0, 0, b.character !== 'joao');
        }
        else
            this.atlas.draw(c, frame, WORLD_PALETTE, xx, yy, b.character !== 'joao');
        c.restore();
        if (['open', 'defeated'].includes(b.phase))
            for (let i = 0; i < 3; i++) {
                const a = time / 250 + i * Math.PI * 2 / 3;
                pixelText(c, '★', b.x - cx + b.width / 2 + Math.cos(a) * 22, b.y - cy - 12 + Math.sin(a) * 5, '#f8d887', 1, 'center');
            }
        if (b.id === 'C2') {
            rect(c, b.x - cx + 7, b.y - cy + 19, 24, 4, '#a3d5e1');
        }
        if (b.phase === 'open') {
            pixelText(c, '↓', b.x - cx + b.width / 2, b.y - cy - 20, '#ffe3a3', 1, 'center');
        }
    }
    seal(c: CanvasRenderingContext2D, x: number, y: number, time: number, collected = false) {
        c.save();
        if (collected)
            c.globalAlpha = .25;
        this.atlas.draw(c, SEALS[Math.floor(time / 160) % 4], WORLD_PALETTE, x, y + Math.round(Math.sin(time / 320) * 2));
        c.restore();
    }
    island(c: CanvasRenderingContext2D, w: Island, selected: boolean, time: number) {
        const [x, y] = w.map;
        for (let yy = -7; yy <= 14; yy++) {
            const half = Math.round(22 * Math.sqrt(Math.max(0, 1 - ((yy - 2) / 13) ** 2)));
            rect(c, x - half, y + yy, half * 2, 1, yy > 8 ? '#596279' : yy > 3 ? '#927e70' : '#d3bd89');
        }
        for (let yy = -7; yy <= 5; yy++) {
            const half = Math.round(20 * Math.sqrt(Math.max(0, 1 - ((yy + 1) / 7) ** 2)));
            rect(c, x - half, y + yy, half * 2, 1, w.id === 5 ? '#c5e7e7' : yy < 0 ? '#a7c386' : '#83ac79');
        }
        rect(c, x - 12, y + 8, 3, 4, '#b49a78');
        rect(c, x + 9, y + 7, 2, 5, '#746d70');
        rect(c, x - 23, y + 13, 12, 1, '#77a7ac');
        rect(c, x + 9, y + 15, 15, 1, '#6697a5');
        for (let i = 0; i < 3; i++) {
            rect(c, x - 17 + i * 14, y + i % 2 * 3, 4, 2, w.id === 5 ? '#e7f6e9' : '#648f65');
        }
        if (w.id === 3 || w.id === 5) {
            rect(c, x - 8, y - 23, 16, 18, '#506984');
            rect(c, x - 6, y - 21, 12, 14, '#ae78ca');
            rect(c, x - 6, y - 24, 12, 3, '#d2dce0');
            rect(c, x + 8, y - 27, 4, 22, '#6b839b');
        }
        else if (w.id === 2) {
            rect(c, x - 9, y - 26, 3, 22, '#ecd080');
            rect(c, x - 10, y - 27, 25, 3, '#ecd080');
            rect(c, x + 11, y - 24, 1, 12, '#d4c8a3');
            rect(c, x + 7, y - 13, 9, 7, '#b78f63');
        }
        else if (w.id === 4) {
            mountain(c, x - 12, y - 30, 24, 26, '#b5c7d3');
            rect(c, x - 2, y - 27, 4, 4, '#eef4ee');
        }
        else if (w.id === 6) {
            rect(c, x - 10, y - 26, 21, 21, '#bdafbd');
            rect(c, x - 12, y - 28, 25, 4, '#e7cfb2');
            for (let i = 0; i < 3; i++)
                rect(c, x - 11 + i * 10, y - 32, 5, 4, '#e7cfb2');
            rect(c, x - 2, y - 15, 5, 10, '#62546f');
        }
        else {
            rect(c, x - 6, y - 20, 3, 15, '#726b58');
            rect(c, x - 13, y - 25, 17, 10, '#97ba76');
        }
        if (selected) {
            const yy = y - 39 + Math.round(Math.sin(time / 220) * 2);
            pixelText(c, '↓', x, yy, w.accent, 1, 'center');
        }
    }
}
