import type { EncounterId, Character } from './types';
import { overlaps, clamp } from './types';
import type { Rect } from '../types';
import type { WorldLevel, WorldObjects } from './WorldPhysics';
export type BossPattern = 'gap' | 'leap' | 'structure' | 'cargo' | 'doubleCargo' | 'sweep' | 'barrel' | 'volley';
export type BossPhase = 'rest' | 'warning' | 'attack' | 'open' | 'hurt' | 'defeated';
export class BossEncounter implements Rect {
    x = 268;
    y = 180;
    width = 34;
    height = 42;
    health: number;
    maxHealth: number;
    phase: BossPhase = 'rest';
    timer = 0;
    cycle = 0;
    targetX = 100;
    character: Character;
    danger: Rect | null = null;
    impact = false;
    opened = false;
    pose = 'idle';
    poseTime = 0;
    released = false;
    impactPoint = { x: 100, y: 224 };
    pattern: BossPattern = 'gap';
    private launchX = 0;
    private homeY = 180;
    private releasedExtra = false;
    private resetAfterHit = false;
    private retryAt = 0;
    private throwPoseAt: number | null = null;
    constructor(readonly id: EncounterId) {
        this.character = id[0] === 'J' ? 'joao' : id[0] === 'B' ? 'biel' : 'calabrezzo';
        this.health = this.maxHealth = id.endsWith('2') ? 4 : 3;
        if (this.character === 'biel') {
            this.x = 205;
            this.y = 123;
            this.width = 38;
            this.height = 48;
        }
        if (this.character === 'calabrezzo') {
            this.x = 260;
            this.y = 151;
            this.width = 38;
            this.height = 50;
        }
        if (id === 'J2') {
            this.x = 270;
            this.y = 147;
        }
        this.homeY = this.y;
    }
    private enter(phase: BossPhase) {
        this.phase = phase;
        this.timer = 0;
        this.danger = null;
        this.throwPoseAt = null;
        if (phase === 'hurt')
            this.resetAfterHit = false;
    }
    private expose(objects: WorldObjects) {
        this.enter('open');
        this.pose = 'recover';
        this.poseTime = 0;
        objects.barrels = objects.barrels.filter(b => !b.boss);
        const lift = objects.get('access');
        if (lift)
            lift.active = true;
    }
    private throwBarrel(objects: WorldObjects) {
        const barrel = objects.spawnBarrel(this.x - 12, this.y + 8, -1, this.id === 'C2', true);
        barrel.vy = -2.5;
        this.released = true;
        this.pose = 'shoot';
        this.poseTime = 0;
        this.throwPoseAt = this.timer;
    }
    get shockWarning() { return this.id === 'J2' && this.health <= 2 && this.phase === 'rest' && this.timer < 650; }
    get secondTarget() { return clamp(this.targetX + (this.targetX > 155 ? -76 : 76), 28, 272); }
    update(dt: number, player: Rect, objects: WorldObjects, level: WorldLevel) {
        this.timer += dt;
        this.impact = false;
        this.released = false;
        this.danger = null;
        this.pose = 'idle';
        this.poseTime = this.timer;
        const pressure = objects.get('bossJet');
        if (pressure) {
            const enabled = this.health < this.maxHealth && !['open', 'hurt', 'defeated'].includes(this.phase);
            if (enabled && pressure.active) {
                pressure.active = false;
                pressure.phase = -objects.time;
            }
            else if (!enabled)
                pressure.active = true;
        }
        if (this.phase === 'defeated') {
            this.pose = 'dead';
            return;
        }
        if (this.phase === 'hurt') {
            if (!this.resetAfterHit) {
                this.resetAfterHit = true;
                const access = objects.get('access');
                if (access)
                    access.active = false;
                if (this.character === 'biel')
                    for (const body of objects.bodies) {
                        const selected = this.id === 'B1' || body.id === (this.health % 2 ? 'left' : 'right') || body.link === (this.health % 2 ? 'left' : 'right');
                        if (selected && ['lift', 'switch'].includes(body.kind))
                            body.active = false;
                    }
                if (this.id === 'C1') {
                    const belt = objects.get('bossBelt');
                    if (belt)
                        belt.active = false;
                    const button = objects.get('a');
                    if (button)
                        button.active = false;
                }
            }
            this.pose = 'hurt';
            if (this.timer > 700)
                this.enter('rest');
            return;
        }
        if (this.phase === 'rest') {
            const shock = this.id === 'J2' && this.health <= 2;
            if (this.shockWarning)
                this.pose = 'windup';
            if (shock && this.timer >= 650 && this.timer < 1500) {
                this.danger = { x: 270 - (this.timer - 650) * .30, y: 214, width: 20, height: 10 };
                this.pose = 'smash';
                this.poseTime = this.timer - 650;
            }
            if (this.timer > (shock ? 1900 : 1100)) {
                this.targetX = clamp(player.x + player.width / 2, 24, 294);
                this.enter('warning');
                this.opened = false;
                this.cycle++;
                this.pattern = this.id === 'J1' ? (this.health < this.maxHealth && this.cycle % 2 === 0 ? 'leap' : 'gap') : this.id === 'J2' ? 'structure' : this.id === 'B2' ? 'sweep' : this.id === 'B1' ? (this.health < this.maxHealth ? 'doubleCargo' : 'cargo') : this.health < this.maxHealth ? 'volley' : 'barrel';
                if (this.pattern === 'leap')
                    this.targetX = clamp(this.targetX, 110, 262);
                this.launchX = this.x;
                this.releasedExtra = false;
                this.retryAt = 0;
                this.pose = 'windup';
                this.poseTime = 0;
                const access = objects.get('access');
                if (access)
                    access.active = false;
                for (const target of objects.bodies)
                    if (target.id.startsWith('ice'))
                        target.active = false;
            }
        }
        else if (this.phase === 'warning') {
            this.pose = 'windup';
            if (this.timer > 950) {
                this.enter('attack');
                this.poseTime = 0;
                this.impact = this.character === 'joao' && this.pattern !== 'leap';
                this.impactPoint = { x: this.targetX, y: 224 };
                if (this.character === 'calabrezzo')
                    this.throwBarrel(objects);
                if (this.character === 'joao') {
                    if (this.id === 'J1' && this.pattern === 'gap') {
                        for (let c = Math.floor(this.targetX / 16) - 1; c <= Math.floor(this.targetX / 16) + 1; c++) {
                            if (c > 3 && c < 17)
                                for (let r = 14; r < level.data.height; r++)
                                    level.removeTileTemporarily(c, r, 1600);
                        }
                    }
                    else if (this.id === 'J2')
                        for (const s of objects.bodies)
                            if (s.kind === 'support' && Math.abs(s.x + s.width / 2 - this.targetX) < 64) {
                                this.impactPoint = { x: s.x + s.width / 2, y: s.y };
                                s.active = true;
                                this.opened = true;
                            }
                }
            }
        }
        else if (this.phase === 'attack') {
            this.pose = this.character === 'calabrezzo' ? 'idle' : 'smash';
            // Every released barrel gets the same follow-through, including retries.
            // The attack clock still owns all windups, projectiles and hit windows.
            if (this.character === 'calabrezzo' && this.throwPoseAt !== null && this.timer - this.throwPoseAt < 430) {
                this.pose = 'shoot';
                this.poseTime = this.timer - this.throwPoseAt;
            }
            if (this.character === 'joao') {
                if (this.pattern === 'leap') {
                    const t = Math.min(1, this.timer / 650);
                    this.x = this.launchX + (this.targetX - this.width / 2 - this.launchX) * t;
                    this.y = this.homeY - Math.sin(t * Math.PI) * 72;
                    this.pose = t < .75 ? 'windup' : 'smash';
                    if (t >= 1 && this.timer < 850) {
                        this.danger = { x: this.targetX - 28, y: 211, width: 56, height: 13 };
                        if (!this.releasedExtra) {
                            this.impact = true;
                            this.impactPoint = { x: this.targetX, y: 224 };
                            this.releasedExtra = true;
                        }
                    }
                }
                else if (this.timer < 230)
                    this.danger = { x: this.targetX - 25, y: 198, width: 50, height: 26 };
                if (this.timer > (this.pattern === 'leap' ? 900 : 600) && (this.id === 'J1' || this.opened))
                    this.expose(objects);
                else if (this.timer > 1500)
                    this.enter('rest');
            }
            else if (this.character === 'biel') {
                const second = this.pattern === 'doubleCargo' && this.timer >= 1000;
                const local = this.timer - (second ? 1000 : 0), dropY = Math.min(188, 90 + local * .18);
                this.pose = local < 500 ? 'shoot' : 'smash';
                this.poseTime = local;
                this.danger = local < 800 ? { x: this.id === 'B2' ? clamp(this.targetX - 80 + local * .16, 20, 272) : (second ? this.secondTarget : this.targetX) - 21, y: dropY, width: 42, height: 36 } : null;
                const elevated = this.id === 'B2' ? objects.get('left')!.active && objects.get('right')!.active && player.y < 175 : objects.bodies.some(b => b.kind === 'lift' && b.active);
                if (this.timer > (this.pattern === 'doubleCargo' ? 2050 : 1100) && elevated)
                    this.expose(objects);
                else if (this.timer > (this.pattern === 'doubleCargo' ? 3000 : 2200))
                    this.enter('rest');
            }
            else {
                if (this.id === 'C2' && objects.get(this.cycle % 2 ? 'iceRight' : 'iceLeft')?.active) {
                    this.expose(objects);
                    objects.barrels = [];
                    this.impact = true;
                    this.impactPoint = { x: this.cycle % 2 ? 296 : 136, y: 208 };
                }
                if (this.phase === 'attack' && this.pattern === 'volley' && !this.releasedExtra) {
                    if (this.timer > 650 && this.timer < 1200) {
                        this.pose = 'windup';
                        this.poseTime = (this.timer - 650) * 1.7;
                    }
                    if (this.timer >= 1200) {
                        this.throwBarrel(objects);
                        this.releasedExtra = true;
                    }
                }
                if (this.phase === 'attack' && this.id === 'C2' && this.timer > 1800 && (this.timer < 5400 || this.retryAt > 0) && !objects.barrels.some(b => b.boss)) {
                    this.retryAt ||= this.timer + 750;
                    this.pose = 'windup';
                    this.poseTime = 750 - (this.retryAt - this.timer);
                    if (this.timer >= this.retryAt) {
                        this.throwBarrel(objects);
                        this.retryAt = 0;
                    }
                }
                for (const barrel of objects.barrels)
                    if (this.id === 'C1' && barrel.boss && barrel.returned && barrel.x > this.x - 26 && barrel.y + barrel.height > 202 && barrel.y < 224) {
                        barrel.life = 0;
                        this.expose(objects);
                        this.impact = true;
                        this.impactPoint = { x: 249, y: 215 };
                        break;
                    }
                if (this.timer > 6800) {
                    objects.barrels = objects.barrels.filter(b => !b.boss);
                    this.enter('rest');
                }
            }
        }
        else if (this.phase === 'open') {
            this.pose = 'recover';
            if (this.timer > 3200)
                this.enter('rest');
        }
    }
    contact(player: Rect, previous: Rect, falling: boolean): 'none' | 'hurt' | 'bounce' | 'hit' | 'defeated' {
        if (this.phase === 'defeated' || this.phase === 'hurt' || !overlaps(player, this))
            return 'none';
        if (falling && previous.y + previous.height <= this.y + 12) {
            if (this.phase !== 'open')
                return 'bounce';
            this.health--;
            this.enter(this.health === 0 ? 'defeated' : 'hurt');
            this.pose = this.health === 0 ? 'dead' : 'hurt';
            return this.health === 0 ? 'defeated' : 'hit';
        }
        // A stunned boss cannot punish a slightly low approach. Only a landing deals damage.
        return this.phase === 'open' ? 'none' : 'hurt';
    }
    get name(): string { return this.character === 'joao' ? 'JOÃOZÃO' : this.character === 'biel' ? 'BIELZÃO' : 'CALABREZZO'; }
    get hint(): string { return this.shockWarning ? 'ONDA NO CHÃO! PULE' : this.phase === 'open' ? 'AGORA! PULE NA CABEÇA' : this.pattern === 'leap' && ['warning', 'attack'].includes(this.phase) ? 'SALTO! SAIA DA SOMBRA' : this.pattern === 'doubleCargo' && ['warning', 'attack'].includes(this.phase) ? 'DUAS CARGAS. DOIS AVISOS' : this.id === 'B2' ? 'ATIVE OS APOIOS E SUBA' : this.character === 'biel' ? 'LEVANTE UM APOIO' : this.id === 'C2' ? (this.cycle % 2 ? 'GELO DA DIREITA' : 'GELO DA ESQUERDA') : this.character === 'calabrezzo' ? 'INVERTA A ESTEIRA' : this.id === 'J2' ? 'ATRAIA O GOLPE ATÉ O APOIO' : 'SAIA DA MARCAÇÃO'; }
}
