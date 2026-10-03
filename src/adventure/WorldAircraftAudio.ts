/** An already unlocked WorldAudio effects route. enabled includes the SFX preference. */
export interface AircraftAudioRoute {
    context: BaseAudioContext;
    destination: AudioNode;
    enabled: boolean;
}
/** Structural subset of AircraftPose; the visual motion sampler remains authoritative. */
export interface AircraftAudioFrame {
    progress: number;
    propellerSpeed: number;
    airWisps: number;
    complete: boolean;
    reducedMotion: boolean;
}
const unit = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
/** Conservative peak budget before the existing effects-volume bus (maximum .184). */
export function aircraftAudioEnvelope(frame: AircraftAudioFrame) {
    const progress = unit(frame.progress), throttle = unit(frame.propellerSpeed / 37);
    const fade = Math.min(1, progress / .035, (1 - progress) / .045);
    const quiet = frame.complete || frame.reducedMotion;
    return { frequency: 48 + throttle * 58,
        engine: quiet ? 0 : (.035 + throttle * .125) * fade,
        wind: quiet ? 0 : .024 * unit(frame.airWisps * 5) * fade };
}
interface Voice {
    route: AircraftAudioRoute;
    engine: OscillatorNode;
    wind: AudioBufferSourceNode;
    engineGain: GainNode;
    windGain: GainNode;
    master: GainNode;
    release: () => void;
}
/**
 * One restrained filtered propeller layer and a barely audible air bed. No new
 * AudioContext, autoplay/resume, music controls, network assets or wall-clock timers.
 * start once at departure; sync with each sampled pose. Cancel on skip, navigation
 * and focus loss. Muting/suspension discards playback; unmuting never restarts it.
 * Reduced motion is silent, matching its stationary propeller and calm transfer.
 */
export class WorldAircraftAudio {
    private voice: Voice | null = null;
    private retired = new Set<() => void>();
    private paused = false;
    private disposed = false;
    constructor(private readonly getRoute: () => AircraftAudioRoute | null) {}
    get activeVoiceCount(): number { return this.voice ? 1 : 0; }
    start(frame: AircraftAudioFrame): boolean {
        this.cancel();
        // Repeated input cannot accumulate fading graphs.
        for (const release of [...this.retired]) release();
        const route = this.getRoute();
        if (this.disposed || this.paused || frame.complete || frame.reducedMotion || !route?.enabled || route.context.state !== 'running') return false;
        const ctx = route.context, now = ctx.currentTime;
        const nodes: AudioNode[] = [];
        let engine: OscillatorNode | undefined, wind: AudioBufferSourceNode | undefined;
        let released = false;
        const release = () => {
            if (released) return;
            released = true;
            for (const source of [engine, wind]) if (source) {
                source.onended = null;
                try { source.stop(); } catch { /* Already stopped or not yet started. */ }
            }
            for (const node of nodes) { try { node.disconnect(); } catch { /* Device closed. */ } }
            if (this.voice?.release === release) this.voice = null;
            this.retired.delete(release);
        };
        try {
            const master = ctx.createGain(); nodes.push(master);
            const engineGain = ctx.createGain(); nodes.push(engineGain);
            const windGain = ctx.createGain(); nodes.push(windGain);
            const engineFilter = ctx.createBiquadFilter(); nodes.push(engineFilter);
            const windFilter = ctx.createBiquadFilter(); nodes.push(windFilter);
            engine = ctx.createOscillator(); nodes.push(engine);
            wind = ctx.createBufferSource(); nodes.push(wind);
            engine.type = 'triangle'; engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420; engineFilter.Q.value = .5;
            windFilter.type = 'lowpass'; windFilter.frequency.value = 850; windFilter.Q.value = .5;
            const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), samples = buffer.getChannelData(0);
            let seed = 517;
            for (let i = 0; i < samples.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; samples[i] = seed / 2147483648 - 1; }
            // Window the loop seam; avoids a periodic click without a second voice.
            const seam = Math.min(256, samples.length / 2);
            for (let i = 0; i < seam; i++) { const gain = i / seam; samples[i] *= gain; samples[samples.length - 1 - i] *= gain; }
            wind.buffer = buffer; wind.loop = true;
            engineGain.gain.setValueAtTime(0, now); windGain.gain.setValueAtTime(0, now);
            master.gain.setValueAtTime(1, now);
            engine.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
            wind.connect(windFilter); windFilter.connect(windGain); windGain.connect(master); master.connect(route.destination);
            this.voice = { route, engine, wind, engineGain, windGain, master, release };
            engine.onended = release;
            engine.start(now); wind.start(now);
            // Failsafe if the host vanishes without its normal dispose path.
            engine.stop(now + 9); wind.stop(now + 9);
            this.sync(frame);
            return this.voice !== null;
        } catch { release(); return false; }
    }
    sync(frame: AircraftAudioFrame): void {
        const voice = this.voice;
        if (!voice) return;
        const route = this.getRoute();
        if (this.disposed || this.paused || frame.complete || frame.reducedMotion || !route?.enabled || route.context.state !== 'running' ||
            route.context !== voice.route.context || route.destination !== voice.route.destination) { this.cancel(); return; }
        const envelope = aircraftAudioEnvelope(frame), now = route.context.currentTime;
        voice.engine.frequency.setTargetAtTime(envelope.frequency, now, .07);
        voice.engineGain.gain.setTargetAtTime(envelope.engine, now, .045);
        voice.windGain.gain.setTargetAtTime(envelope.wind, now, .07);
    }
    cancel(): void {
        const voice = this.voice;
        this.voice = null;
        if (!voice) return;
        if (voice.route.context.state !== 'running') { voice.release(); return; }
        this.retired.add(voice.release);
        try {
            const now = voice.route.context.currentTime;
            voice.master.gain.cancelScheduledValues(now);
            voice.master.gain.setValueAtTime(1, now);
            voice.master.gain.linearRampToValueAtTime(0, now + .015);
            voice.engine.stop(now + .016); voice.wind.stop(now + .016);
        } catch { voice.release(); }
    }
    setPaused(value: boolean): void { this.paused = value; if (value) this.cancel(); }
    dispose(): void {
        this.cancel(); this.disposed = true;
        // A suspended context cannot deliver onended; never leave its graph attached.
        if ([...this.retired].length && this.getRoute()?.context.state !== 'running') {
            for (const release of [...this.retired]) release();
        }
    }
}
