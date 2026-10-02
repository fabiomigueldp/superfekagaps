import { WorldSampleAudio, type WorldSamplePack } from './WorldSampleAudio';

/** A map's single ambient route, with gesture unlock and no independent timer/RAF. */
export class WorldAmbientAudio {
    private closed = false;
    private paused = false;
    private context: AudioContext | null = null;
    private bus: GainNode | null = null;
    private readonly samples: WorldSampleAudio;
    enabled = true;
    constructor(pack: WorldSamplePack, sceneId: string) {
        this.samples = new WorldSampleAudio(() => this.context && this.bus ? {
            context: this.context, music: this.bus, effects: this.bus,
            enabled: this.enabled && !this.paused && !this.closed, musicEnabled: false, effectsEnabled: true,
        } : null, pack, () => this.samples.tick());
        this.samples.select(sceneId);
    }
    unlock(): void {
        if (this.closed || this.paused || !this.enabled) return;
        try {
            if (!this.context) {
                this.context = new AudioContext(); this.bus = this.context.createGain();
                this.bus.gain.value = .3 * .7; this.bus.connect(this.context.destination);
            }
            void this.context.resume().then(() => this.samples.tick()).catch(() => {});
        } catch { this.release(); }
    }
    set(kind?: string, level = 1): void {
        if (this.closed) return;
        this.samples.setAmbience(kind, level); this.samples.tick();
    }
    pause(value: boolean): void {
        if (this.closed || this.paused === value) return;
        this.paused = value; this.samples.tick();
        if (!this.context) return;
        try {
            if (value) void this.context.suspend().catch(() => {});
            else if (this.enabled) void this.context.resume().then(() => this.samples.tick()).catch(() => {});
        } catch { /* Device interruption leaves the visual map usable. */ }
    }
    dispose(): void { if (this.closed) return; this.closed = true; this.samples.dispose(); this.release(); }
    private release(): void {
        this.samples.reset();
        try { this.bus?.disconnect(); } catch { /* Already detached. */ }
        try { void this.context?.close().catch(() => {}); } catch { /* Already closed. */ }
        this.context = null; this.bus = null;
    }
}
