import { PLAYER_PALETTE, PLAYER_SPRITES, PLAYER_WALK } from '../../assets/playerSpriteSpec';
import { SpriteAtlas, animationIndex } from '../../graphics/pixels';
import { ART } from '../../graphics/palette';
import { panel, pixelText } from '../../graphics/BitmapFont';
import { drawPlayerProtection } from '../../graphics/playerProtectionArt';
import { GroundPoundState } from '../../types';
import { drawWorldCheckpoint, drawWorldGoal } from '../WorldCheckpointArt';
import { DELICIA_UNIT as U } from './DeliciaNative';
import { DELICIA_ICONS, DELICIA_PIXEL_PALETTE, deliciaBossFrame, deliciaFoeFrame, deliciaProjectileFrame } from './DeliciaPixelSprites';
import { drawDeliciaBackdrop, drawDeliciaLiquid, drawDeliciaMachine, drawDeliciaProps, drawDeliciaTerrain, px } from './DeliciaPixelScenery';
import { steamPhase, type DeliciaSimulation } from './DeliciaSimulation';
import { drawDeliciaSteam, drawDeliciaThorns, drawDeliciaValve } from './DeliciaObjectArt';
import { deliciaFoePresentation } from './DeliciaFoePresentation';
import type { Box } from './DeliciaContent';

/** Same 320 × 180 grid, palette and sprite atlas as World. No filtered bitmaps. */
export class DeliciaArt {
    readonly atlas = new SpriteAtlas();
    /** Kept for host invalidation; native gameplay art has no network dependency. */
    readonly images = new Map<string, HTMLImageElement>();
    async load(): Promise<void> {}
    dispose(): void { this.images.clear(); }

    draw(c: CanvasRenderingContext2D, sim: DeliciaSimulation, reduced = false, scale = U): void {
        const time = reduced ? 0 : sim.time, cx = Math.round(sim.cameraX / U), cy = Math.round(sim.cameraY / U);
        c.save(); c.imageSmoothingEnabled = false; c.scale(scale, scale);
        drawDeliciaBackdrop(c, sim, time);
        drawDeliciaProps(c, sim, time);
        for (const h of sim.stage.hazards) {
            if (h.x + h.w < sim.cameraX || h.x > sim.cameraX + 960) continue;
            if (h.kind === 'juice') drawDeliciaLiquid(c, h, sim, time);
            else if (h.kind === 'thorns') drawDeliciaThorns(c,h,cx,cy);
            else this.steam(c,h,steamPhase(sim.time,h.period,h.phase),time,cx,cy);
        }
        sim.stage.floors.forEach((f, index) => drawDeliciaTerrain(c, sim, f, index, time));
        for (const m of sim.stage.machines ?? []) if (m.x + m.w > sim.cameraX - 30 && m.x < sim.cameraX + 990) drawDeliciaMachine(c, m, sim, time);
        if (sim.boss) {
            const b = sim.boss;
            for (const gap of b.gaps) { px(c, gap.x / U - cx, 150 - cy, gap.w / U, 180, ART.ink);drawDeliciaLiquid(c, { ...gap, y: 570, h: 330 }, sim, time); }
            if (b.beat === 'tell') for (const danger of b.warnings) {
                const x = danger.x / U - cx, y = danger.y / U - cy, w = danger.w / U;
                for (let i = 0; i < w - 2; i += 5) { px(c, x + i, 146 - cy, 2, 2, ART.gold);px(c, x + i + 1, 145 - cy, 2, 1, ART.goldLight); }
                px(c, x, 149 - cy, w * b.progress, 1, ART.goldLight);
                if (b.attack !== 'charge' && b.attack !== 'gap') { px(c, x, y, 1, 147 - cy - y, ART.goldDark);px(c, x + w - 1, y, 1, 147 - cy - y, ART.goldDark); }
            }
            for (const danger of b.danger) {
                const x = danger.x / U - cx, y = danger.y / U - cy, w = danger.w / U, h = danger.h / U;
                if (b.attack === 'charge') continue;
                px(c, x, y, w, h, ART.orangeDark);px(c, x + 2, y, w - 4, h, ART.orange);
                for (let yy = 0; yy < h; yy += 8) px(c, x + 4, y + (yy + Math.floor(time * 35)) % h, w - 8, 3, ART.goldLight);
            }
        }
        for (const valve of sim.stage.valves) {
            const x = Math.round(valve.x / U) - cx, y = Math.round(valve.y / U) - cy;
            if (x < -35 || x > 355) continue;
            const active = sim.boss ? !sim.valveReady(valve.id) : sim.valves.has(valve.id);
            drawDeliciaValve(c,x,y,active);
        }
        sim.stage.checkpoints.forEach((cp, index) => {
            const x = cp.x / U - cx; if (x < -30 || x > 320) return;
            drawWorldCheckpoint(c, x, (cp.y + sim.player.h) / U - cy, index <= sim.checkpoint, { time: time * 1000, reducedMotion: reduced });
        });
        for (const p of sim.stage.pickups) if (!sim.collected.has(p.id) && p.x > sim.cameraX - 30 && p.x < sim.cameraX + 990) {
            const bob = reduced ? 0 : [0, -1, -2, -1][Math.floor(time * 4 + p.x) % 4];
            this.atlas.draw(c, DELICIA_ICONS[p.kind], DELICIA_PIXEL_PALETTE, p.x / U - cx - 6, p.y / U - cy - 6 + bob);
        }
        for (const e of sim.enemies) if (e.state !== 'dead' && e.x > sim.cameraX - 90 && e.x < sim.cameraX + 1020) {
            const x = Math.round((e.x + e.w / 2) / U) - cx, y = Math.round((e.y + e.h) / U) - cy;
            px(c, x - 7, y, 14, 2, ART.rockDark);
            const presentation=deliciaFoePresentation(e,sim.player.x,sim.time);
            this.atlas.draw(c, deliciaFoeFrame(e.kind, presentation.pose, presentation.dormant?0:time+e.phase), DELICIA_PIXEL_PALETTE, x - 12, y - 24, presentation.flip, 1, (e.flash ?? 0) > 0 ? ART.paper : undefined);
            if (e.state === 'tell') { panel(c, x - 4, y - 35, 9, 10, ART.ink, ART.goldDark);pixelText(c, '!', x + 1, y - 33, ART.goldLight, 1, 'center'); }
            if (e.state === 'stun') for (let i = 0; i < 3; i++) px(c, x - 8 + i * 7, y - 27 - (i % 2), 2, 2, ART.goldLight);
        }
        for (const m of [...sim.projectiles, ...(sim.boss?.missiles ?? [])]) {
            const x = m.x / U - cx, y = m.y / U - cy, w = m.w / U, h = m.h / U;
            if (m.kind === 'wave') {
                for (let i = 0; i < w; i++) {
                    const height = 2 + Math.round(Math.sin(i / Math.max(1,w) * Math.PI) * h);
                    px(c,x+i,y+h-height,1,height,ART.ink);px(c,x+i,y+h-height+1,1,height-1,m.friendly?ART.teal:ART.orange);
                    px(c,x+i,y+h-height+1,1,2,m.friendly?ART.tealLight:ART.goldLight);
                    if(i%5<2)px(c,x+i,y+h-2,1,1,m.friendly?ART.tealDark:ART.orangeDark);
                }
            } else {
                const frame=deliciaProjectileFrame(m.kind,!!m.friendly),centerX=x+w/2,centerY=y+h/2;
                this.atlas.draw(c,frame,DELICIA_PIXEL_PALETTE,centerX-frame[0].length/2,centerY-frame.length/2,m.vx>0);
                const tail=centerX-Math.sign(m.vx)*(frame[0].length/2+2);
                px(c,tail,centerY,2,1,m.friendly?ART.tealLight:ART.gold);
                if(m.friendly){px(c,tail-Math.sign(m.vx)*3,centerY,2,1,ART.teal);px(c,tail,centerY-2,1,1,ART.paper);}
            }
        }
        const gate = sim.stage.gate;
        drawWorldGoal(c, gate.x / U - cx, (gate.y + gate.h) / U - cy - 40, !!sim.stage.optional, !sim.gateOpen, sim.finished, { time: time * 1000, reducedMotion: reduced });
        if (sim.boss) {
            const b = sim.boss, x = Math.round((b.x + b.w / 2) / U) - cx, y = Math.round((b.y + b.h) / U) - cy;
            px(c, x - 21, y, 43, 2, ART.rockDark);
            this.atlas.draw(c, deliciaBossFrame(b.character, b.beat, time), DELICIA_PIXEL_PALETTE, x - 28, y - 60, b.direction > 0, 1, b.hitFlash > 0 ? ART.paper : undefined);
            const labelX=Math.max(30,Math.min(290,x));
            if (b.shield) { for (const side of [-1,1]) { px(c, x + side * 30, y - 48, 2, 36, ART.goldDark);px(c, x + side * 30, y - 48, 1, 36, ART.goldLight); }if(x>=0&&x<=320)pixelText(c, 'PROTEGIDO', labelX, y - 69, ART.goldLight, 1, 'center'); }
            else if (b.vulnerable&&x>=0&&x<=320) { panel(c, labelX - 22, y - 73, 44, 12, ART.ink, ART.teal);pixelText(c, 'ATAQUE', labelX, y - 70, ART.tealLight, 1, 'center'); }
        }
        const p = sim.player, n = sim.nativePlayer.data, x = Math.round(p.x / U) - cx - 1, y = Math.round(p.y / U) - cy - 2;
        const gp = n.groundPoundState;
        const frame = gp === GroundPoundState.WINDUP ? PLAYER_SPRITES.windup : p.pounding || gp === GroundPoundState.RECOVERY ? PLAYER_SPRITES.sit
            : !p.grounded ? p.vy < 0 ? PLAYER_SPRITES.jump : PLAYER_SPRITES.fall
            : p.land > 0 && !reduced ? p.land > .045 ? PLAYER_SPRITES.land : PLAYER_SPRITES.landSettle
            : Math.abs(p.vx) > 18 ? PLAYER_WALK[animationIndex(n.animationTimer, 6, n.isRunning ? 65 : 100)] : PLAYER_SPRITES.idle;
        if (p.grounded) px(c, x + 3, y + 26, 12, 1, ART.rockDark);
        this.atlas.draw(c, frame, PLAYER_PALETTE, x, y, p.facing < 0, 1,
            p.invincible > 0 && !reduced && animationIndex(p.invincible * 1000, 2, 90) === 1 ? ART.paper : undefined);
        if (p.invincible > 0 && reduced) drawPlayerProtection(c, x + 8, y + 13);
        if (p.parryTime > 0) { px(c, x - 3, y + 5, 2, 15, ART.tealLight);px(c, x + 18, y + 5, 2, 15, ART.tealLight);px(c, x + 1, y - 2, 12, 1, ART.tealLight); }
        for (const part of sim.particles) px(c, part.x / U - cx, part.y / U - cy, Math.max(1,part.size / U), 1, part.life > part.max * .5 ? ART.goldLight : ART.soilTop);
        // Interaction text is the last world layer, above pickups and particles.
        // Its raised baseline leaves the checkpoint heart visible underneath.
        const nearby=sim.nearbyValve;
        if(nearby){
            const x=Math.max(29,Math.min(290,Math.round(nearby.x/U)-cx)),y=Math.round(nearby.y/U)-cy;
            const active=sim.boss?!sim.valveReady(nearby.id):sim.valves.has(nearby.id);
            panel(c,x-28,y-64,58,12,ART.ink,ART.rockLight);pixelText(c,active?'ABERTA':'E: ABRIR',x+1,y-61,ART.paper,1,'center');
        }
        c.restore();c.imageSmoothingEnabled = false;
    }
    private steam(c:CanvasRenderingContext2D,b:Box,phase:string,time:number,cx=0,cy=0):void {
        drawDeliciaSteam(c,b,phase,time,cx,cy);
    }
}
