import type { IntroCue } from './JuiceIntroDirector';

/** The existing WorldAudio effects bus owns volume, mute and the user-gesture unlock. */
export interface IntroAudioRoute {
    context: BaseAudioContext;
    destination: AudioNode;
    enabled: boolean;
}
export interface IntroSound {
    at: number;
    duration: number;
    frequency: number;
    endFrequency?: number;
    type: OscillatorType | 'noise';
    volume: number;
}
const note = (at: number, duration: number, frequency: number, volume: number, type: IntroSound['type'] = 'triangle', endFrequency?: number): IntroSound =>
    ({ at, duration, frequency, volume, type, endFrequency });
/** Seconds relative to a semantic cue. No speech, samples, timers or persistent loops. */
export function juiceIntroScore(cue: IntroCue): readonly IntroSound[] {
    switch (cue) {
        case 'fanfare': return [
            note(0, .18, 311.13, .15), note(.2, .18, 392, .14), note(.4, .24, 466.16, .15),
            note(.68, .5, 622.25, .15), note(.68, .5, 311.13, .08),
            note(0, .055, 1200, .09, 'noise'), note(.32, .055, 1400, .07, 'noise'), note(.64, .055, 1600, .06, 'noise')
        ];
        case 'footstep': return [note(0, .08, 100, .17, 'triangle', 65), note(.18, .08, 110, .14, 'triangle', 70)];
        case 'pose': return [0, .07, .135, .195].map((at, i) => note(at, .04, 850 + i * 120, .07 + i * .015, 'noise'));
        // A lonely bell, then at least 450 ms of silence before the chair creaks.
        case 'awkward': return [note(0, .18, 1244.5, .12, 'sine'), note(0, .12, 2489, .025, 'sine'), note(.7, .16, 340, .045, 'triangle', 220)];
        case 'laugh': return [.1, .24, .39].map((at, i) => note(at, .085, 380 - i * 30, .04, 'triangle', 280 - i * 20));
        // Stylized descending crowd-like reeds, never a recorded or imitated person.
        // Foreground ends before 1.5 s; a single quieter late reed ends at 1.95 s.
        case 'boo': return [note(0, 1.35, 174, .07, 'triangle', 147), note(.1, 1.2, 220, .045, 'triangle', 185), note(.23, 1.15, 261, .035, 'triangle', 208), note(1.58, .35, 196, .025, 'sine', 164)];
        case 'pressure': return [
            note(0, 1.5, 85, .095, 'sine', 115), note(.1, 1.2, 450, .055, 'noise', 900),
            note(.5, .16, 170, .11, 'sine', 350), note(1.25, .19, 210, .13, 'sine', 450), note(2.15, .24, 260, .15, 'sine', 580),
            note(2.55, .3, 720, .04, 'triangle', 640), note(2.7, .3, 1300, .065, 'noise', 180)
        ];
        case 'invitation': return [note(0, .6, 116.54, .075, 'sine'), note(.55, .7, 155.56, .065, 'sine'), note(3.4, .13, 190, .07, 'sine', 390)];
        case 'resolve': return [note(0, .32, 311.13, .11), note(.36, .36, 466.16, .13), note(.76, .7, 622.25, .14), note(.76, .7, 155.56, .055, 'sine')];
        case 'combat': return [note(0, .18, 155.56, .13, 'triangle', 77.78), note(0, .07, 700, .08, 'noise')];
        case 'cancel': return [];
    }
}

/**
 * One-shot procedural cues on an injected, already-unlocked engine route.
 * Call sync every frame, setPaused on pause/focus loss, cancel on skip/replay/handoff,
 * and dispose on teardown. Interrupted cues are discarded, never replayed on resume.
 * The owner continues to control WorldAudio music; this adapter never ticks music.
 */
export class JuiceIntroAudio {
    private voices = new Set<() => void>();
    private paused = false;
    private disposed = false;
    constructor(private readonly getRoute: () => IntroAudioRoute | null) {}
    get activeVoiceCount(): number { return this.voices.size; }
    sync(): void {
        const route = this.getRoute();
        if (this.disposed || this.paused || !route?.enabled || route.context.state !== 'running') this.cancel();
    }
    setPaused(value: boolean): void { this.paused = value; if (value) this.cancel(); }
    cancel(): void { for (const stop of [...this.voices]) stop(); }
    dispose(): void { this.cancel(); this.disposed = true; }
    play(cue: IntroCue): boolean {
        if (cue === 'cancel') { this.cancel(); return false; }
        this.sync();
        const route = this.getRoute();
        if (this.disposed || this.paused || !route?.enabled || route.context.state !== 'running') return false;
        // Bound accidental duplicate input even if a caller fails one-shot semantics.
        this.cancel();
        for (const sound of juiceIntroScore(cue)) this.schedule(route, sound);
        return this.voices.size > 0;
    }
    private schedule(route: IntroAudioRoute, sound: IntroSound): void {
        const ctx = route.context, start = ctx.currentTime + sound.at, end = start + sound.duration;
        const env = ctx.createGain();
        const nodes: AudioNode[] = [env];
        let source: AudioScheduledSourceNode;
        if (sound.type === 'noise') {
            const buffer = ctx.createBuffer(1, Math.ceil(sound.duration * ctx.sampleRate), ctx.sampleRate);
            const data = buffer.getChannelData(0);
            let seed = 517;
            for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
            const noise = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
            noise.buffer = buffer; filter.type = 'lowpass'; filter.frequency.setValueAtTime(sound.frequency, start);
            filter.frequency.exponentialRampToValueAtTime(sound.endFrequency ?? sound.frequency, end);
            noise.connect(filter); filter.connect(env); nodes.push(filter); source = noise;
        } else {
            const osc = ctx.createOscillator(); osc.type = sound.type;
            osc.frequency.setValueAtTime(sound.frequency, start);
            osc.frequency.exponentialRampToValueAtTime(sound.endFrequency ?? sound.frequency, end);
            osc.connect(env); source = osc;
        }
        nodes.push(source);
        env.gain.setValueAtTime(0, start);
        env.gain.linearRampToValueAtTime(sound.volume, start + Math.min(.015, sound.duration / 4));
        env.gain.exponentialRampToValueAtTime(.0001, end);
        env.connect(route.destination);
        let ended = false;
        const cleanup = () => {
            if (ended) return;
            ended = true; source.onended = null;
            for (const node of nodes) node.disconnect();
            this.voices.delete(stop);
        };
        const stop = () => {
            if (ended) return;
            // Disconnect immediately even if a suspended engine delays onended.
            source.stop(); cleanup();
        };
        source.onended = cleanup;
        this.voices.add(stop);
        source.start(start); source.stop(end + .015);
    }
}
