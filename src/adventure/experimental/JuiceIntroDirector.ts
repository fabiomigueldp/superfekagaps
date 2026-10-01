/** Deterministic, ephemeral stage direction. No renderer, audio, campaign or storage. */
export type IntroBeat = 'establish' | 'walk' | 'push' | 'prepare' | 'reveal' | 'judges' | 'resolve' | 'emerge' | 'invite' | 'defy' | 'transition' | 'complete';
export type IntroCue = 'fanfare' | 'footstep' | 'pose' | 'awkward' | 'laugh' | 'boo' | 'pressure' | 'invitation' | 'resolve' | 'combat' | 'cancel';
export interface IntroInput { left?: boolean; right?: boolean; presentPressed?: boolean; skipPressed?: boolean; }
export interface IntroSubtitle { speaker: string; text: string; }
export interface IntroFrame {
    beat: IntroBeat; timeMs: number; elapsedMs: number; progress: number; fekaX: number;
    /** Scenic gait follows displacement, so held inputs at a boundary never march in place. */
    fekaMoving: boolean; fekaWalkDistance: number;
    subtitle: IntroSubtitle | null; prompt: string; bossReveal: number; stageExit: number;
}
export interface IntroBeatSpec { id: IntroBeat; durationMs: number; hold?: 'walkToMark' | 'present'; cue?: IntroCue; }
/** Edit pacing and holds here; rendering and integration consume the same named beat. */
export const JUICE_INTRO_SCRIPT: readonly IntroBeatSpec[] = [
    { id: 'establish', durationMs: 3000, cue: 'fanfare' },
    { id: 'walk', durationMs: Infinity, hold: 'walkToMark' },
    { id: 'push', durationMs: 650, cue: 'footstep' },
    { id: 'prepare', durationMs: Infinity, hold: 'present' },
    { id: 'reveal', durationMs: 2500, cue: 'pose' },
    { id: 'judges', durationMs: 4500, cue: 'laugh' },
    { id: 'resolve', durationMs: 2500, cue: 'boo' },
    { id: 'emerge', durationMs: 4500, cue: 'pressure' },
    { id: 'invite', durationMs: 4500, cue: 'invitation' },
    { id: 'defy', durationMs: 6500, cue: 'resolve' },
    { id: 'transition', durationMs: 3000 },
    { id: 'complete', durationMs: Infinity }
];
const SPEC = Object.fromEntries(JUICE_INTRO_SCRIPT.map(spec => [spec.id, spec])) as Record<IntroBeat, IntroBeatSpec>;
const ORDER = JUICE_INTRO_SCRIPT.map(spec => spec.id);
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export class JuiceIntroDirector {
    beat: IntroBeat = 'establish';
    elapsedMs = 0;
    timeMs = 0;
    fekaX = 36;
    private fekaMoving = false;
    private fekaWalkDistance = 0;
    private pending: IntroCue[] = ['fanfare'];
    private awkwardPlayed = false;
    private presentBufferMs = 0;
    get complete() { return this.beat === 'complete'; }
    drainCues(): IntroCue[] { const cues = this.pending; this.pending = []; return cues; }
    private enter(beat: IntroBeat) {
        this.beat = beat; this.elapsedMs = 0;
        const cue = SPEC[beat].cue; if (cue) this.pending.push(cue);
    }
    skip() {
        if (this.complete) return;
        this.pending = ['cancel']; this.fekaX = 68; this.fekaMoving = false; this.enter('complete');
    }
    private moveFeka(x: number) {
        const distance = Math.abs(x - this.fekaX);
        this.fekaMoving = distance > 0;
        this.fekaWalkDistance += distance;
        this.fekaX = x;
    }
    advance(dt: number, input: IntroInput = {}) {
        if (this.complete) return;
        if (input.skipPressed) { this.skip(); return; }
        if (!Number.isFinite(dt) || dt <= 0) return;
        this.fekaMoving = false;
        // Match lab fixed-step policy; background stalls may not consume entire dialogue pages.
        const step = Math.min(dt, 100);
        this.elapsedMs += step; this.timeMs += step;
        this.presentBufferMs = Math.max(0, this.presentBufferMs - step);
        if (input.presentPressed && (this.beat === 'prepare' || this.beat === 'push' && this.elapsedMs > 450)) this.presentBufferMs = 200;
        if (this.beat === 'walk') {
            this.moveFeka(clamp(this.fekaX + ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * step * .055, 28, 98));
            if (this.fekaX >= 97.9) this.enter('push');
            return;
        }
        if (this.beat === 'push') this.moveFeka(98 + smooth(this.elapsedMs / 400) * 14);
        if (this.beat === 'prepare') {
            if (this.presentBufferMs > 0 && this.elapsedMs >= 150) this.enter('reveal');
            return;
        }
        if (this.beat === 'emerge') this.moveFeka(112 - smooth((this.elapsedMs - 900) / 1400) * 44);
        if (this.beat === 'reveal' && this.elapsedMs >= 1000 && !this.awkwardPlayed) {
            this.awkwardPlayed = true; this.pending.push('awkward');
        }
        if (this.elapsedMs >= SPEC[this.beat].durationMs) this.enter(ORDER[ORDER.indexOf(this.beat) + 1]);
    }
    get frame(): IntroFrame {
        const b = this.beat, t = this.elapsedMs;
        let subtitle: IntroSubtitle | null = null;
        if (b === 'establish') subtitle = { speaker: 'LOCUTOR', text: 'Calabrezzo apresenta: o próximo competidor!' };
        if (b === 'push' || b === 'prepare') subtitle = { speaker: 'COMPETIDOR', text: 'Vai, campeão. Mostra o shape.' };
        if (b === 'judges') subtitle = t < 2250
            ? { speaker: 'JURADO 1', text: 'Isso é pose ou intervalo?' }
            : { speaker: 'JURADO 2', text: 'Nota: falta preencher.' };
        if (b === 'invite') subtitle = { speaker: 'TURBOSUCO', text: 'venha fazer amor com o suco' };
        if (b === 'defy') subtitle = { speaker: 'FEKA', text: t < 2800 ? 'Eu vou defender até a morte' : 'meus gaps e meu shape patético!' };
        const index = ORDER.indexOf(b);
        return { beat: b, timeMs: this.timeMs, elapsedMs: t, progress: clamp(t / SPEC[b].durationMs), fekaX: this.fekaX,
            fekaMoving: this.fekaMoving, fekaWalkDistance: this.fekaWalkDistance,
            subtitle, prompt: b === 'walk' ? 'VÁ ATÉ A MARCA →' : b === 'prepare' ? 'ESPAÇO · APRESENTAR' : '',
            bossReveal: b === 'emerge' ? smooth(t / 2800) : index > ORDER.indexOf('emerge') ? 1 : 0,
            stageExit: b === 'transition' ? smooth(t / 1800) : b === 'complete' ? 1 : 0 };
    }
}
