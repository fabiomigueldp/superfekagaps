/** Local, pre-produced audio only. No provider credentials or generation at runtime. */
export interface WorldSample {
    /** Relative public asset path, under assets/audio/. */
    path: string;
    gain: number;
    /** Edited and measured loop bounds in decoded seconds; required for music. */
    loop?: { start: number; end: number };
    /** Optional hard limit for a gameplay one-shot, independent of game timers. */
    maxSeconds?: number;
}
export interface WorldSampleScene {
    music?: WorldSample;
    effects: Readonly<Record<string, readonly WorldSample[]>>;
    ambience?: Readonly<Record<string, WorldSample>>;
}
export interface WorldSamplePack {
    scenes: Readonly<Record<string, WorldSampleScene>>;
}
export interface WorldSampleRoute {
    context: AudioContext;
    music: GainNode;
    effects: GainNode;
    enabled: boolean;
    musicEnabled: boolean;
    effectsEnabled: boolean;
}
interface Voice { kind: string; release(): void; level(value: number): void }

function valid(sample: WorldSample): boolean {
    return /^assets\/audio\/[a-zA-Z0-9_/-]+\.(?:mp3|ogg|wav|opus)$/.test(sample.path)
        && Number.isFinite(sample.gain) && sample.gain > 0 && sample.gain <= 2
        && (sample.maxSeconds === undefined || (Number.isFinite(sample.maxSeconds) && sample.maxSeconds > 0 && sample.maxSeconds <= 30));
}

/** Owns fetches, decoded buffers and sample sources for one WorldAudio instance. */
export class WorldSampleAudio {
    private disposed = false;
    private scene: WorldSampleScene | undefined;
    private readonly buffers = new Map<string, AudioBuffer>();
    private readonly pending = new Map<string, AbortController>();
    private readonly failed = new Set<string>();
    private readonly variants = new Map<string, number>();
    private readonly effects = new Set<Voice>();
    private music: Voice | undefined;
    private ambience: Voice | undefined;
    private ambientRequest: { kind: string; level: number } | undefined;

    constructor(private readonly route: () => WorldSampleRoute | null, private readonly pack: WorldSamplePack, private readonly onReady?: () => void) { }

    select(sceneId?: string): void {
        if (this.disposed) return;
        this.stop(); this.abort(); this.variants.clear(); this.ambientRequest = undefined;
        this.scene = sceneId ? this.pack.scenes[sceneId] : undefined;
    }

    /** Called by the game tick. Async completion itself never starts a sound. */
    tick(): boolean {
        if (this.disposed) return false;
        const route = this.route();
        if (!route || !route.enabled || route.context.state !== 'running') {
            this.cancelEffects(); this.cancelAmbience();
            return !!this.music;
        }
        this.preload(route);
        if (!route.effectsEnabled) { this.cancelEffects(); this.cancelAmbience(); }
        else this.syncAmbience(route);
        const sample = this.scene?.music;
        if (!this.music && sample && route.musicEnabled) {
            const buffer = this.buffers.get(sample.path), loop = sample.loop;
            if (buffer && loop && Number.isFinite(loop.start) && Number.isFinite(loop.end)
                && loop.start >= 0 && loop.end > loop.start && loop.end <= buffer.duration) {
                this.music = this.start('music', sample, buffer, route.music, route.context, true);
            }
        }
        return !!this.music;
    }

    /** True only when a sample starts now. A missing sample lets the caller synthesize its fallback. */
    play(kind: string, delaySeconds = 0): boolean {
        const route = this.route();
        if (this.disposed || !route || !route.enabled || !route.effectsEnabled || route.context.state !== 'running'
            || !Number.isFinite(delaySeconds) || delaySeconds < 0 || delaySeconds > 1) return false;
        this.preload(route);
        const variants = this.scene?.effects[kind];
        if (!variants?.length) return false;
        const next = this.variants.get(kind) ?? 0;
        for (let i = 0; i < variants.length; i++) {
            const index = (next + i) % variants.length, sample = variants[index];
            const buffer = this.buffers.get(sample.path);
            if (!buffer || !valid(sample)) continue;
            // Cancel a repeated cue, and bound voices without touching gameplay RNG or timing.
            for (const voice of this.effects) if (voice.kind === kind) voice.release();
            if (this.effects.size >= 6) this.effects.values().next().value?.release();
            const voice = this.start(kind, sample, buffer, route.effects, route.context, false, 1, delaySeconds);
            if (!voice) return false;
            this.effects.add(voice); this.variants.set(kind, index + 1);
            return true;
        }
        return false;
    }

    cancelEffects(): void { for (const voice of [...this.effects]) voice.release(); }
    cancelEffect(kind: string): void { for (const voice of [...this.effects]) if (voice.kind === kind) voice.release(); }
    setAmbience(kind?: string, level = 1): void {
        const amount = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
        if (!kind || amount === 0) { this.ambientRequest = undefined; this.cancelAmbience(); return; }
        if (this.ambientRequest?.kind !== kind) this.cancelAmbience();
        this.ambientRequest = { kind, level: amount }; this.ambience?.level(amount);
    }
    cancelAmbience(): void { this.ambience?.release(); this.ambience = undefined; }

    private syncAmbience(route: WorldSampleRoute): void {
        const request = this.ambientRequest, sample = request && this.scene?.ambience?.[request.kind];
        if (!request || !sample) { this.cancelAmbience(); return; }
        this.load(sample, route.context);
        const buffer = this.buffers.get(sample.path), loop = sample.loop;
        if (!this.ambience && buffer && loop && Number.isFinite(loop.start) && Number.isFinite(loop.end)
            && loop.start >= 0 && loop.end > loop.start && loop.end <= buffer.duration) {
            this.ambience = this.start(request.kind, sample, buffer, route.effects, route.context, true, request.level);
        }
    }

    /** Device initialization may fail or be retried; never retain buffers from that device. */
    reset(): void { this.stop(); this.abort(); this.buffers.clear(); this.failed.clear(); }
    dispose(): void { if (this.disposed) return; this.disposed = true; this.reset(); this.scene = undefined; }

    private stop(): void { this.music?.release(); this.music = undefined; this.cancelEffects(); this.cancelAmbience(); }
    private abort(): void { for (const controller of this.pending.values()) controller.abort(); this.pending.clear(); }

    private preload(route: WorldSampleRoute): void {
        if (!this.scene) return;
        if (route.musicEnabled && this.scene.music) this.load(this.scene.music, route.context);
        if (route.effectsEnabled) for (const variants of Object.values(this.scene.effects))
            for (const sample of variants) this.load(sample, route.context);
    }

    private load(sample: WorldSample, context: AudioContext): void {
        const key = sample.path;
        if (!valid(sample) || this.buffers.has(key) || this.pending.has(key) || this.failed.has(key)) return;
        const controller = new AbortController(); this.pending.set(key, controller);
        const current = () => !this.disposed && !controller.signal.aborted && this.pending.get(key) === controller;
        const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
        void (async () => {
            try {
                const response = await fetch(base + key, { signal: controller.signal, credentials: 'omit' });
                if (!current()) return;
                if (!response.ok) throw new Error('Local audio unavailable');
                const bytes = await response.arrayBuffer();
                if (!current()) return;
                const buffer = await context.decodeAudioData(bytes);
                if (current()) {
                    if (!Number.isFinite(buffer.duration) || buffer.duration <= 0) throw new Error('Empty local audio');
                    this.buffers.set(key, buffer);
                    this.onReady?.();
                }
            } catch {
                if (current()) this.failed.add(key); // One attempt per device; no frame-by-frame retries.
            } finally {
                if (this.pending.get(key) === controller) this.pending.delete(key);
            }
        })();
    }

    private start(kind: string, sample: WorldSample, buffer: AudioBuffer, bus: GainNode, context: AudioContext, looped: boolean, level = 1, delay = 0): Voice | undefined {
        let source: AudioBufferSourceNode | undefined, env: GainNode | undefined, live = true;
        const detach = () => {
            if (!live) return;
            live = false; this.effects.delete(voice);
            if (this.music === voice) this.music = undefined;
            if (this.ambience === voice) this.ambience = undefined;
            if (source) source.onended = null;
            for (const node of [source, env]) { try { node?.disconnect(); } catch { /* Already detached. */ } }
        };
        const voice: Voice = {
            kind, release: () => { try { source?.stop(); } catch { /* Ended or not started. */ } detach(); },
            level: value => { if (live) env?.gain.setTargetAtTime(sample.gain * value, context.currentTime, .08); },
        };
        try {
            source = context.createBufferSource(); env = context.createGain();
            source.buffer = buffer; source.loop = looped;
            const now = context.currentTime + delay;
            env.gain.setValueAtTime(0, now);
            if (looped) {
                source.loopStart = sample.loop!.start; source.loopEnd = sample.loop!.end;
                env.gain.linearRampToValueAtTime(sample.gain * level, now + .08);
            } else {
                const duration = Math.min(buffer.duration, sample.maxSeconds ?? buffer.duration);
                const fade = Math.min(.012, duration / 3);
                env.gain.linearRampToValueAtTime(sample.gain, now + Math.min(.003, fade));
                env.gain.setValueAtTime(sample.gain, now + duration - fade);
                env.gain.linearRampToValueAtTime(0, now + duration);
            }
            source.connect(env); env.connect(bus); source.onended = detach;
            source.start(now);
            if (!looped) source.stop(now + Math.min(buffer.duration, sample.maxSeconds ?? buffer.duration));
            return voice;
        } catch {
            voice.release(); this.buffers.delete(sample.path); this.failed.add(sample.path);
            return undefined;
        }
    }
}
