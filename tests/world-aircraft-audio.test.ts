import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldAircraftAudio, aircraftAudioEnvelope, type AircraftAudioFrame, type AircraftAudioRoute } from '../src/adventure/WorldAircraftAudio';
class Param {
    value = 0;
    cancelScheduledValues(_t: number) {}
    events: number[][] = [];
    setValueAtTime(v: number, t: number) { this.events.push([v, t]); }
    linearRampToValueAtTime(v: number, t: number) { this.events.push([v, t]); }
    exponentialRampToValueAtTime(v: number, t: number) { this.events.push([v, t]); }
    setTargetAtTime(v: number, t: number) { this.events.push([v, t]); }
}
class Node {
    gain = new Param(); frequency = new Param(); Q = new Param(); loop = false; type = ''; buffer: unknown;
    destinations: Node[] = []; disconnected = false; stops: (number | undefined)[] = []; starts: number[] = [];
    onended: (() => void) | null = null;
    connect(n: Node) { this.destinations.push(n); }
    disconnect() { this.disconnected = true; }
    start(t: number) { this.starts.push(t); }
    stop(t?: number) { this.stops.push(t); }
}
class Context {
    state = 'running'; currentTime = 0; sampleRate = 8000;
    nodes: Node[] = []; destination = new Node(); resumes = 0;
    make() { const node = new Node(); this.nodes.push(node); return node; }
    createGain() { return this.make(); }
    createOscillator() { return this.make(); }
    createBufferSource() { return this.make(); }
    createBiquadFilter() { return this.make(); }
    createBuffer(_channels: number, size: number) { return { getChannelData: () => new Float32Array(size) }; }
    resume() { this.resumes++; return Promise.resolve(); }
}

const frame = (overrides: Partial<AircraftAudioFrame> = {}): AircraftAudioFrame => ({ progress: .5, propellerSpeed: 32, airWisps: .15, complete: false, reducedMotion: false, ...overrides });
function fixture() {
    const context = new Context(), destination = new Node();
    const route = { context, destination, enabled: true };
    const audio = new WorldAircraftAudio(() => route as unknown as AircraftAudioRoute);
    const finish = () => context.nodes.filter(n => n.starts.length).forEach(n => n.onended?.());
    return { context, destination, route, audio, finish };
}
test('envelope follows prop throttle, fades ends, and stays bounded for bad inputs', () => {
    assert.ok(aircraftAudioEnvelope(frame({ propellerSpeed: 37 })).frequency > aircraftAudioEnvelope(frame({ propellerSpeed: 15 })).frequency);
    assert.equal(aircraftAudioEnvelope(frame({ progress: 0 })).engine, 0);
    assert.equal(aircraftAudioEnvelope(frame({ progress: 1 })).wind, 0);
    for (const value of [-Infinity, -1, 0, .5, 1, 2, Infinity, NaN]) {
        const e = aircraftAudioEnvelope(frame({ progress: value, propellerSpeed: value, airWisps: value }));
        assert.ok(Number.isFinite(e.frequency) && e.frequency >= 48 && e.frequency <= 106);
        assert.ok(e.engine >= 0 && e.engine <= .16); assert.ok(e.wind >= 0 && e.wind <= .024);
    }
    for (const f of [frame({ complete: true }), frame({ reducedMotion: true })]) {
        assert.equal(aircraftAudioEnvelope(f).engine, 0); assert.equal(aircraftAudioEnvelope(f).wind, 0);
    }
});
test('blocked, muted, suspended and reduced motion starts do not unlock or defer sound', () => {
    assert.equal(new WorldAircraftAudio(() => null).start(frame()), false);
    const { audio, context, route } = fixture();
    route.enabled = false; assert.equal(audio.start(frame()), false);
    route.enabled = true; context.state = 'suspended'; assert.equal(audio.start(frame()), false);
    context.state = 'running'; assert.equal(audio.start(frame({ reducedMotion: true })), false);
    audio.sync(frame()); assert.equal(context.nodes.length, 0); assert.equal(context.resumes, 0);
});
test('engine and wind use only injected effects bus; music has no route or controls', () => {
    const { audio, context, destination, finish } = fixture();
    assert.equal(audio.start(frame()), true); assert.equal(audio.activeVoiceCount, 1);
    assert.equal(context.nodes.filter(n => n.starts.length).length, 2);
    assert.equal(context.nodes.filter(n => n.destinations.includes(destination)).length, 1);
    assert.equal(context.resumes, 0);
    finish(); assert.equal(audio.activeVoiceCount, 0); assert.ok(context.nodes.every(n => n.disconnected));
});
test('mute and suspension cancel, and restoring state never resurrects sound', () => {
    for (const mode of ['mute', 'suspend']) {
        const { audio, context, route, finish } = fixture(); audio.start(frame());
        if (mode === 'mute') route.enabled = false; else context.state = 'suspended';
        audio.sync(frame()); finish(); assert.equal(audio.activeVoiceCount, 0);
        assert.ok(context.nodes.every(n => n.disconnected));
        const count = context.nodes.length; route.enabled = true; context.state = 'running'; audio.sync(frame());
        assert.equal(context.nodes.length, count);
    }
});
test('skip, blur, completion and repeated replay release bounded resources with short stop ramp', () => {
    const { audio, context, finish } = fixture();
    for (let i = 0; i < 30; i++) audio.start(frame());
    assert.equal(context.nodes.filter(n => !n.disconnected).length, 7);
    audio.cancel(); audio.cancel(); assert.equal(audio.activeVoiceCount, 0);
    assert.ok(context.nodes.some(n => n.gain.events.some(([v,t]) => v === 0 && t === .015)));
    finish(); assert.ok(context.nodes.every(n => n.disconnected));
    audio.start(frame()); audio.setPaused(true); finish();
    assert.equal(audio.start(frame()), false); audio.setPaused(false); audio.sync(frame()); assert.equal(audio.activeVoiceCount, 0);
    audio.start(frame()); audio.sync(frame({ complete: true })); finish(); assert.equal(audio.activeVoiceCount, 0);
    audio.start(frame()); audio.dispose(); audio.dispose(); finish();
    assert.equal(audio.start(frame()), false); assert.ok(context.nodes.every(n => n.disconnected));
});
test('route replacement and partial construction failure clean up without throwing', () => {
    const { audio, context, route, finish } = fixture(); audio.start(frame());
    route.destination = new Node(); audio.sync(frame()); finish(); assert.equal(audio.activeVoiceCount, 0);
    context.createBufferSource = () => { throw new Error('device lost'); };
    assert.equal(audio.start(frame()), false); assert.ok(context.nodes.every(n => n.disconnected));
});
