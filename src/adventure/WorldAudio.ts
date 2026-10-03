import type { Character, Preferences } from './types';
import { combatTones } from './WorldCombatFeedback';
import { WorldSampleAudio, type WorldSamplePack } from './WorldSampleAudio';
import { ARCADE_AUDIO_PACK } from './ArcadeAudioPack';
export const MELODIES = [
    [0, 4, 7, 9, 7, 4, 2, 4, 0, 4, 7, 12, 11, 7, 4, 2, 5, 9, 12, 14, 12, 9, 7, 5, 4, 7, 11, 9, 7, 4, 2, -1],
    [0, 0, 7, 4, 0, 2, 4, 7, 9, 7, 4, 2, 0, -1, 2, 4, 5, 5, 12, 9, 5, 7, 9, 12, 11, 7, 4, 2, 0, -1, 7, -1],
    [0, 7, 3, 10, 7, 3, 5, 7, 0, 3, 7, 12, 10, 7, 5, 3, 5, 12, 8, 15, 12, 8, 7, 5, 3, 10, 7, 5, 3, 2, 0, -1],
    [0, -1, 7, 12, 11, -1, 7, 4, 2, -1, 9, 14, 12, -1, 9, 7, 5, -1, 12, 16, 14, -1, 12, 9, 7, 4, 2, 4, 0, -1, -1, -1],
    [0, 7, 12, 15, 14, 12, 7, 3, 5, 12, 17, 15, 12, 8, 7, -1, 3, 10, 15, 19, 17, 15, 10, 7, 2, 7, 11, 14, 12, 7, 3, -1],
    [0, 4, 7, 12, 11, 9, 7, 4, 5, 9, 12, 17, 16, 14, 12, 9, 7, 11, 14, 19, 17, 14, 11, 7, 0, 7, 12, 11, 9, 7, 4, 0],
    [0, -1, 4, 7, 9, 7, 4, -1, 2, -1, 5, 9, 7, 5, 2, -1, 4, -1, 7, 11, 12, 11, 7, -1, 5, 4, 2, -1, 0, -1, -1, -1]
];
export function musicNotes(theme: number, step: number, boss = false) {
    const index = boss ? ([0, 5].includes(theme) ? 5 : [1, 3].includes(theme) ? 1 : 2) : theme;
    const tempo = boss ? (theme >= 3 ? .135 : .15) : [.2, .18, .16, .24, .23, .19, .22][theme];
    const root = boss ? 155.56 : [261.63, 220, 233.08, 246.94, 261.63, 261.63, 261.63][theme];
    const note = MELODIES[index][step % 32], minor = index === 2 || index === 4;
    const chord = [0, 0, 5, 7][Math.floor(step / 8) % 4], notes: {
        frequency: number;
        duration: number;
        type: OscillatorType;
        volume: number;
    }[] = [];
    if (note >= 0)
        notes.push({ frequency: root * 2 ** ((note + (Math.floor(step / 32) % 4 === 2 ? 12 : 0)) / 12), duration: tempo * 1.7, type: theme === 4 ? 'sine' : 'triangle', volume: .5 });
    if (step % 4 === 0)
        notes.push({ frequency: root / 2 * 2 ** (chord / 12), duration: tempo * 3, type: 'triangle', volume: .65 });
    if (step % 2 === 0)
        notes.push({ frequency: step % 4 === 0 ? 58 : 160, duration: tempo * .35, type: 'triangle', volume: .22 });
    if (Math.floor(step / 32) % 2 === 1)
        notes.push({ frequency: root * 2 ** ((chord + [0, minor ? 3 : 4, 7, 12][step % 4]) / 12), duration: tempo * 1.1, type: 'sine', volume: .12 });
    return { tempo, notes };
}
export class WorldAudio {
    private disposed = false;
    private readonly sources = new Set<() => void>();
    private readonly musicSources = new Set<() => void>();
    private readonly effectsSources = new Set<() => void>();
    private readonly voiceSources = new Set<() => void>();
    private readonly samples: WorldSampleAudio;
    get isDisposed(): boolean { return this.disposed; }
    private ctx: AudioContext | null = null;
    private music: GainNode | null = null;
    private effects: GainNode | null = null;
    private voice: GainNode | null = null;
    private next = 0;
    private step = 0;
    private theme = 0;
    private boss = false;
    private paused = false;
    private dying = false;
    private clip: HTMLAudioElement | null = null;
    private speechAt = 0;
    private speechIndex = 0;
    private speaking: {
        who: Character;
        text: string;
        at: number;
    } | null = null;
    private airBuffer: AudioBuffer | null = null;
    enabled = true;
    constructor(public preferences: Preferences, samplePack: WorldSamplePack = ARCADE_AUDIO_PACK) {
        this.samples = new WorldSampleAudio(() => this.ctx && this.music && this.effects ? {
            context: this.ctx, music: this.music, effects: this.effects,
            enabled: this.enabled && !this.paused, musicEnabled: this.preferences.music > 0,
            effectsEnabled: this.preferences.effects > 0,
        } : null, samplePack);
    }
    unlock() { if (this.disposed || this.paused) return; if (!this.ctx) {
        try {
            this.ctx = new AudioContext();
            this.music = this.ctx.createGain();
            this.effects = this.ctx.createGain();
            this.voice = this.ctx.createGain();
            for (const node of [this.music, this.effects, this.voice])
                node.connect(this.ctx.destination);
            this.volume();
        }
        catch {
            this.releaseContext();
            return;
        }
    } try { void this.ctx.resume().catch(() => {}); } catch { /* Device may have closed. */ } }
    /** Close only the context and nodes created by this instance. */
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.paused = true;
        this.samples.dispose(); this.cancelSpeech(); this.releaseContext();
    }
    private releaseContext(): void {
        this.samples.reset();
        for (const release of [...this.sources]) release();
        for (const bus of [this.music, this.effects, this.voice]) {
            try { bus?.disconnect(); } catch { /* Already detached by the device. */ }
        }
        const context = this.ctx;
        this.ctx = null; this.music = this.effects = this.voice = null; this.airBuffer = null;
        if (context && context.state !== 'closed') {
            try { void context.close().catch(() => {}); } catch { /* Closing is best effort. */ }
        }
    }
    private ownSource(source: AudioScheduledSourceNode, nodes: AudioNode[], bus?: 'music' | 'effects' | 'voice'): void {
        let live = true;
        const detach = () => {
            if (!live) return;
            live = false; this.sources.delete(release); this.musicSources.delete(release); this.effectsSources.delete(release); this.voiceSources.delete(release); source.onended = null;
            for (const node of [source, ...nodes]) {
                try { node.disconnect(); } catch { /* Already detached by the device. */ }
            }
        };
        const release = () => {
            try { source.stop(); } catch { /* Already ended or not started. */ }
            detach();
        };
        this.sources.add(release);
        if (bus === 'music') this.musicSources.add(release);
        if (bus === 'effects') this.effectsSources.add(release);
        if (bus === 'voice') this.voiceSources.add(release);
        source.onended = detach;
    }
    private cancelEffects(): void {
        this.samples.cancelEffects();
        for (const release of [...this.effectsSources]) release();
    }
    /** Read-only route for cancellable lab cues; never creates or resumes a context. */
    getEffectsRoute(): { context: AudioContext; destination: GainNode; enabled: boolean } | null {
        return !this.disposed && this.ctx && this.effects ? { context: this.ctx, destination: this.effects, enabled: this.enabled } : null;
    }
    volume() { if (this.disposed || !this.ctx)
        return; if (!this.enabled || this.preferences.effects <= 0) { this.cancelEffects(); this.samples.cancelAmbience(); } const now = this.ctx.currentTime; this.music!.gain.setTargetAtTime(this.enabled ? this.preferences.music * .14 * (this.dying ? .15 : 1) : 0, now, .06); this.effects!.gain.setTargetAtTime(this.enabled ? this.preferences.effects * .3 : 0, now, .02); this.voice!.gain.setTargetAtTime(this.enabled ? this.preferences.voice * .22 : 0, now, .02); if (this.clip)
        this.clip.volume = this.enabled ? this.preferences.voice : 0; }
    setDying(value: boolean) { if (this.disposed) return; this.dying = value; if (value) { this.cancelEffects(); this.samples.setAmbience(); } this.volume(); }
    ambience(kind?: string, level = 1) { if (!this.disposed) this.samples.setAmbience(this.dying ? undefined : kind, level); }
    toggle() { if (this.disposed) return; this.enabled = !this.enabled; this.volume(); }
    select(world: number, boss = false, sceneId?: string) { if (this.disposed) return; this.samples.select(sceneId); this.cancelEffects(); for (const release of [...this.musicSources]) release(); this.theme = world === 0 ? 6 : Math.max(0, world - 1); this.boss = boss; this.step = 0; this.next = this.ctx?.currentTime ?? 0; this.cancelSpeech(); }
    pause(value: boolean) { if (this.disposed) return; this.paused = value; if (value) {
        this.cancelEffects();
        this.samples.cancelAmbience();
        this.cancelSpeech();
        if (this.ctx)
            try { void this.ctx.suspend().catch(() => {}); } catch { /* Device may have closed. */ }
    }
    else {
        this.unlock();
        // AudioContext time freezes during suspension. Keep the scheduled beat
        // cursor so resumed notes are not overlaid with a second fresh beat.
        // tick() already catches up if a device interruption advanced its clock.
    } }
    private tone(freq: number, seconds: number, type: OscillatorType, gain: number, bus: GainNode | null, when?: number) {
        if (this.disposed || !this.ctx || !bus || this.ctx.state !== 'running')
            return;
        const t = when ?? this.ctx.currentTime;
        const osc = this.ctx.createOscillator(), env = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(gain, t + .008);
        env.gain.exponentialRampToValueAtTime(.001, t + seconds);
        osc.connect(env);
        env.connect(bus);
        this.ownSource(osc, [env], bus === this.music ? 'music' : bus === this.effects ? 'effects' : undefined);
        osc.start(t);
        osc.stop(t + seconds + .015);
    }
    private air(seconds: number, frequency: number, gain: number) {
        if (this.disposed || !this.ctx || !this.effects || this.ctx.state !== 'running') return;
        if (!this.airBuffer) {
            this.airBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
            const data = this.airBuffer.getChannelData(0);
            let seed = 31;
            for (let i = 0; i < data.length; i++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                data[i] = seed / 2147483648 - 1;
            }
        }
        const now = this.ctx.currentTime, source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), env = this.ctx.createGain();
        source.buffer = this.airBuffer;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(frequency, now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(100, frequency / 5), now + seconds);
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(gain, now + .015);
        env.gain.exponentialRampToValueAtTime(.001, now + seconds);
        source.connect(filter); filter.connect(env); env.connect(this.effects);
        this.ownSource(source, [filter, env], 'effects');
        source.start(now); source.stop(now + seconds + .02);
    }
    sfx(kind: string) {
        if (this.disposed || this.paused || !this.enabled || this.preferences.effects <= 0) return;
        if (kind === 'jet' || kind === 'cannon') { this.samples.cancelEffect('pressure'); this.samples.cancelEffect('warning'); }
        if (kind === 'pressure' && this.samples.play('pressure', .24)) {
            this.sfx('warning'); // Audio-only lead-in; the simulation still owns discharge timing.
            return;
        }
        if (this.samples.play(kind)) return;
        const combat = combatTones(kind);
        if (combat) {
            if (this.paused || !this.enabled || this.preferences.effects <= 0 || !this.ctx || this.ctx.state !== 'running') return;
            for (const n of combat)
                this.tone(n.frequency, n.duration, n.type, n.volume, this.effects, this.ctx.currentTime + n.at);
            return;
        }
        if (kind === 'pressure') {
            this.air(.22, 1900, .14);
            this.tone(260, .16, 'sine', .12, this.effects);
            return;
        }
        if (kind === 'jet' || kind === 'cannon') {
            this.air(kind === 'jet' ? .42 : .2, kind === 'jet' ? 2600 : 1200, .35);
            this.tone(kind === 'jet' ? 140 : 75, .16, 'triangle', .36, this.effects);
            return;
        }
        if (kind === 'barrelLand' || kind === 'barrelBreak') {
            this.air(.09, 750, .18);
            this.tone(85, .09, 'triangle', .17, this.effects);
            return;
        }
        const notes: Record<string, number[]> = { throw:[270,180,105], land:[100,75], jump: [400, 600], coin: [880, 1320], seal: [523, 659, 784, 1047], switch: [180, 360, 540], hit: [180, 70], death: [392, 330, 262, 196], fall: [320, 160, 70], break: [90, 60], checkpoint: [440, 660, 880], victory: [523, 659, 784, 1047], warning: [180, 180], pound: [100, 55] };
        const ns = notes[kind] ?? [330];
        ns.forEach((f, i) => this.tone(f, kind === 'death' ? .2 : .12, kind === 'pound' || kind === 'fall' || kind === 'throw' ? 'triangle' : 'square', .22, this.effects, (this.ctx?.currentTime ?? 0) + i * (kind === 'death' ? .14 : .07)));
    }
    say(who: Character, text: string, clip?: string) {
        if (this.disposed) return;
        this.cancelSpeech();
        if (clip) {
            const audio = new Audio(`${((import.meta as {
                env?: {
                    BASE_URL?: string;
                };
            }).env?.BASE_URL ?? '/')}assets/audio/vo/joaozao/${clip}_${({ aqui_e_o_joao_namorado_da_yasmin: '1.92', eu_sou_o_namorado_dela: '1.14', para_de_encher_o_saco: '0.96', porra_nenhuma: '0.36', sei_que_voce_quer: '0.66', voce_nao_vai_ter: '0.66' } as Record<string, string>)[clip]}s.ogg`);
            audio.volume = this.enabled ? this.preferences.voice : 0;
            this.clip = audio;
            audio.play().catch(() => {
                if (!this.disposed && !this.paused && this.clip === audio) this.speaking = { who, text, at: 0 };
            });
        }
        else
            this.speaking = { who, text, at: 0 };
        this.speechIndex = 0;
        this.speechAt = 0;
    }
    private vocal(pitch: number, unit: number) {
        if (this.disposed || !this.ctx || !this.voice)
            return;
        const now = this.ctx.currentTime, source = this.ctx.createOscillator(), env = this.ctx.createGain();
        source.type = 'sawtooth';
        source.frequency.value = pitch;
        const vowel = [[520, 1450], [700, 1100], [350, 1900], [430, 900]][unit % 4];
        const filters = vowel.map(f => { const filter = this.ctx!.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = f; filter.Q.value = 3.5; source.connect(filter); filter.connect(env); return filter; });
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(.22, now + .012);
        env.gain.exponentialRampToValueAtTime(.001, now + .085);
        env.connect(this.voice);
        this.ownSource(source, [env, ...filters], 'voice');
        source.start(now);
        source.stop(now + .09);
    }
    cancelSpeech() {
        for (const release of [...this.voiceSources]) release();
        const clip = this.clip; this.clip = null; this.speaking = null;
        if (clip) {
            try { clip.pause(); } catch { /* Device may already be gone. */ }
            try { clip.removeAttribute('src'); clip.load(); } catch { /* Release remaining media when supported. */ }
        }
    }
    tick(dt: number) {
        const sampledMusic = this.samples.tick();
        if (this.disposed || !this.ctx || this.paused || this.ctx.state !== 'running')
            return;
        const now = this.ctx.currentTime;
        if (this.next < now - .2)
            this.next = now;
        if (sampledMusic) {
            for (const release of [...this.musicSources]) release();
            this.next = now;
        }
        while (!sampledMusic && this.next < now + .07) {
            const plan = musicNotes(this.theme, this.step, this.boss);
            for (const n of plan.notes)
                this.tone(n.frequency, n.duration, n.type, n.volume, this.music, this.next);
            this.step++;
            this.next += plan.tempo;
        }
        if (this.speaking) {
            this.speechAt -= dt;
            if (this.speechAt <= 0) {
                const char = this.speaking.text[this.speechIndex++];
                if (!char) {
                    this.speaking = null;
                    return;
                }
                this.speechAt = /[ .,!?]/.test(char) ? 110 : 60;
                if (!/[ .,!?]/.test(char) && this.speechIndex % 2 === 0) {
                    const root = { feka: 200, joao: 115, biel: 95, calabrezzo: 135, yasmin: 240 }[this.speaking.who];
                    const pitch = root * (1 + (char.charCodeAt(0) % 7 - 3) * .035);
                    this.vocal(pitch, char.charCodeAt(0));
                }
            }
        }
    }
}
