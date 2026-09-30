import { SpriteAtlas } from '../graphics/pixels';
import { WorldBackdrop } from './WorldBackdrop';
import { drawWorldObjects } from './WorldMechanisms';
import { drawArena, drawIsland } from './WorldStageArt';
import { container, wheel, pixelLine, polygon, oval } from './WorldPainting';
import { drawWorldTerrain } from './WorldTerrain';
import { pixelText } from '../graphics/BitmapFont';
import { MINION_FRAMES, MINION_SQUASH, SPRITE_PALETTE } from '../graphics/sprites';
import { BOSS_LOOPS, WORLD_PALETTE, SEALS, foeFrame, bossFrame, type BossPose } from './WorldAssets';
import type { Island } from './types';
import type { WorldLevel, WorldObjects } from './WorldPhysics';
import type { WorldFoe } from './WorldEnemies';
import type { BossEncounter } from './BossEncounter';
export const rect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
export class WorldArt {
    atlas = new SpriteAtlas();
    private backdrop = new WorldBackdrop();
    background(c: CanvasRenderingContext2D, island: Island, cx: number, cy: number, time: number, variant = 0) {
        this.backdrop.draw(c, island, cx, cy, time, variant);
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
        drawWorldTerrain(c, level, island, cx, cy, time);
    }
    objects(c: CanvasRenderingContext2D, objects: WorldObjects, cx: number, cy: number, time: number, world = 3) {
        drawWorldObjects(c, objects, this.atlas, cx, cy, time, world);
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
        const frame = frames ? e.dead ? MINION_SQUASH : frames[Math.floor(e.age / 150) % frames.length] : foeFrame(e.spec.kind as Exclude<typeof e.spec.kind, 'minion'>, e.dead ? 'stunned' : e.phase, e.phase === 'walk' ? e.age : e.timer, e.armor);
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
    arena(c: CanvasRenderingContext2D, b: BossEncounter, cx: number, cy: number, time: number) { drawArena(c, b, cx, cy, time); }
    boss(c: CanvasRenderingContext2D, b: BossEncounter, cx: number, cy: number, time: number) {
        if (b.shockWarning) {
            for (let x = 160; x < 288; x += 22)
                pixelText(c, '←', x - cx, 218 - cy, '#f6ce86', 1, 'center');
            pixelText(c, '!', 280 - cx, 202 - cy, '#ffebbb', 1, 'center');
        }
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
        if (b.danger && b.character === 'joao' && b.id === 'J2' && b.phase === 'rest') {
            const d = b.danger;
            rect(c, d.x - cx, d.y - cy, d.width, 4, '#f4ce80');
            rect(c, d.x - cx + 2, d.y - cy - 3, d.width - 4, 3, '#fff0b8');
        }
        if (b.danger && b.character === 'joao' && b.phase === 'attack') {
            const d = b.danger;
            oval(c, d.x - cx, d.y + d.height - 6 - cy, d.width, 6, '#e6bc7c');
            for (let i = 0; i < 5; i++) {
                const xx = d.x + i * d.width / 5 - cx;
                rect(c, xx, d.y - cy + (i % 2) * 8, 3, 4, '#d7ae7c');
            }
        }
        if (b.character === 'biel' && (b.danger || b.phase === 'warning')) {
            const d = b.danger ?? { x: b.id === 'B2' ? Math.max(20, Math.min(272, b.targetX - 80)) : b.targetX - 21, y: 90, width: 42, height: 36 }, xx = d.x - cx, yy = d.y - cy;
            pixelLine(c, xx + 20, 0, xx + 20, yy - 6, '#9cabb5', 2);
            wheel(c, xx + 14, yy - 14, 13, time);
            container(c, xx, yy, d.width, d.height, 2);
            for (let i = 0; i < d.width - 5; i += 9)
                polygon(c, [[xx + i, yy + d.height - 7], [xx + i + 4, yy + d.height - 7], [xx + i + 9, yy + d.height - 2], [xx + i + 5, yy + d.height - 2]], '#34495c');
        }
        const loops = BOSS_LOOPS[b.id === 'C2' ? 'calabrezzoCold' : b.character as 'joao' | 'biel' | 'calabrezzo'];
        const animation = loops[b.pose as BossPose];
        const phaseTime = b.poseTime;
        const index = ['windup', 'shoot', 'smash'].includes(b.pose) ? Math.min(2, Math.floor(phaseTime / (b.pose === 'windup' ? 280 : 130))) : Math.floor(phaseTime / 240) % 3;
        const frame = animation ? animation[index] : bossFrame(b.character, b.pose as BossPose);
        const recoil = b.phase === 'hurt' ? Math.sin(Math.min(1, b.timer / 700) * Math.PI) * 5 : 0;
        c.save();
        if (b.phase === 'hurt' && Math.floor(b.timer / 80) % 2)
            c.globalAlpha = .55;
        const xx = b.x - cx + b.width / 2 - frame[0].length / 2, yy = b.y - cy + b.height - frame.length + recoil;
        if (b.phase === 'defeated') {
            const t = Math.min(1, b.timer / 750);
            c.translate(Math.round(xx), Math.round(yy + frame.length * t * .55));
            c.scale(1 + t * .1, 1 - t * .55);
            this.atlas.draw(c, frame, WORLD_PALETTE, 0, 0, false);
        }
        else
            this.atlas.draw(c, frame, WORLD_PALETTE, xx, yy, false);
        c.restore();
        if (['open', 'defeated'].includes(b.phase))
            for (let i = 0; i < 3; i++) {
                const a = time / 250 + i * Math.PI * 2 / 3;
                pixelText(c, '★', b.x - cx + b.width / 2 + Math.cos(a) * 22, b.y - cy - 12 + Math.sin(a) * 5, '#f8d887', 1, 'center');
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
    island(c: CanvasRenderingContext2D, w: Island, selected: boolean, time: number) { drawIsland(c, w, selected, time); }
}
