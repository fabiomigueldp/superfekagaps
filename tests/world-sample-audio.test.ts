import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { WorldSampleAudio, type WorldSample, type WorldSamplePack, type WorldSampleRoute } from '../src/adventure/WorldSampleAudio';
import { WorldAudio } from '../src/adventure/WorldAudio';

class Param {
    value = 0;
    events: number[][] = [];
    setValueAtTime(v: number, t: number) { this.events.push([v, t]); }
    linearRampToValueAtTime(v: number, t: number) { this.events.push([v, t]); }
    exponentialRampToValueAtTime(v: number, t: number) { this.events.push([v, t]); }
    setTargetAtTime(v: number, t: number) { this.events.push([v, t]); }
}
class Node {
    gain = new Param(); frequency = new Param(); type = '';
    buffer: { duration: number } | null = null; loop = false; loopStart = 0; loopEnd = 0;
    destinations: Node[] = []; disconnected = false; stops: (number | undefined)[] = []; starts: number[] = [];
    onended: (() => void) | null = null;
    connect(n: Node) { this.destinations.push(n); }
    disconnect() { this.disconnected = true; }
    start(t: number) { this.starts.push(t); }
    stop(t?: number) { this.stops.push(t); }
}
class Context {
    state = 'running'; currentTime = 0; nodes: Node[] = []; destination = new Node();
    decoded: { duration: number }[] = []; decodeFails = false;
    make() { const node = new Node(); this.nodes.push(node); return node; }
    createGain() { return this.make(); }
    createOscillator() { return this.make(); }
    createBufferSource() { return this.make(); }
    async decodeAudioData(bytes: ArrayBuffer) {
        if (this.decodeFails) throw new Error('unsupported');
        const buffer = { duration: new Uint8Array(bytes)[0] }; this.decoded.push(buffer); return buffer;
    }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
}
const sample = (name: string, extra: Partial<WorldSample> = {}): WorldSample => ({ path: `assets/audio/test/${name}.mp3`, gain: .8, ...extra });
const music = sample('music', { loop: { start: 1, end: 8 } });
const pack: WorldSamplePack = { scenes: {
    test: { music, effects: { jump: [sample('jump-a', { maxSeconds: .2 }), sample('jump-b', { maxSeconds: .2 })] } },
    next: { music: sample('next', { loop: { start: 0, end: 6 } }), effects: {} },
} };
function network(t: TestContext) {
    const requests: { path: string; signal: AbortSignal; resolve(response: unknown): void }[] = [];
    t.mock.method(globalThis, 'fetch', (path: string, init: RequestInit) => new Promise(resolve => {
        assert.equal(init.credentials, 'omit');
        requests.push({ path, signal: init.signal!, resolve });
    }));
    const deliver = (index: number, ok = true, duration = 10) => requests[index].resolve({ ok, arrayBuffer: async () => new Uint8Array([duration]).buffer });
    return { requests, deliver };
}
async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
function fixture(t: TestContext, selectedPack = pack) {
    const net = network(t), context = new Context();
    const route = { context, music: new Node(), effects: new Node(), enabled: true, musicEnabled: true, effectsEnabled: true };
    let connected = true;
    const audio = new WorldSampleAudio(() => connected ? route as unknown as WorldSampleRoute : null, selectedPack);
    t.after(() => audio.dispose());
    return { ...net, audio, context, route, disconnect: () => { connected = false; } };
}

test('empty catalog, unknown scene and locked device do not fetch or create nodes', t => {
    const f = fixture(t); f.audio.select('unknown'); assert.equal(f.audio.tick(), false);
    assert.equal(f.audio.play('jump'), false); f.audio.select('test'); f.disconnect();
    assert.equal(f.audio.tick(), false); assert.equal(f.audio.play('jump'), false);
    assert.equal(f.requests.length, 0); assert.equal(f.context.nodes.length, 0);
});

test('loading does not defer a jump; prepared variants alternate only on fresh triggers and share effects bus', async t => {
    const f = fixture(t); f.audio.select('test');
    assert.equal(f.audio.play('jump'), false); assert.equal(f.requests.length, 3);
    f.requests.forEach((_, i) => f.deliver(i)); await settle();
    assert.equal(f.context.nodes.length, 0);
    for (let i = 0; i < 20; i++) assert.equal(f.audio.play('jump'), true);
    const sources = f.context.nodes.filter(n => n.starts.length);
    assert.equal(sources[0].buffer, sources[2].buffer); assert.notEqual(sources[0].buffer, sources[1].buffer);
    assert.equal(sources.filter(n => !n.disconnected).length, 1);
    assert.equal(sources.at(-1)!.stops[0], .2);
    assert.ok(f.context.nodes.filter(n => !n.starts.length).every(n => n.destinations.includes(f.route.effects)));
    sources.at(-1)!.onended?.(); assert.ok(f.context.nodes.every(n => n.disconnected));
});

test('music starts on a tick with validated loop bounds; pause does not restart its timeline', async t => {
    const f = fixture(t); f.audio.select('test'); assert.equal(f.audio.tick(), false);
    f.requests.forEach((_, i) => f.deliver(i)); await settle(); assert.equal(f.audio.tick(), true);
    const source = f.context.nodes.find(n => n.loop)!;
    assert.deepEqual([source.loopStart, source.loopEnd], [1, 8]); assert.equal(source.stops.length, 0);
    f.context.state = 'suspended'; f.audio.tick(); f.context.state = 'running'; f.audio.tick();
    assert.equal(source.starts.length, 1); assert.equal(f.context.nodes.filter(n => n.loop).length, 1);
    f.audio.select(); assert.ok(source.disconnected); assert.equal(f.audio.tick(), false);
});

test('scene changes and disposal abort fetches and reject stale completion without playback or retained buffers', async t => {
    const f = fixture(t); f.audio.select('test'); f.audio.tick();
    f.audio.select('next'); assert.ok(f.requests.every(r => r.signal.aborted));
    f.requests.forEach((_, i) => f.deliver(i)); await settle(); assert.equal(f.context.decoded.length, 0);
    f.audio.tick(); assert.equal(f.requests.length, 4);
    f.audio.dispose(); f.deliver(3); await settle();
    assert.equal(f.context.nodes.length, 0); assert.equal(f.audio.tick(), false); assert.equal(f.audio.play('jump'), false);
});

test('404, corrupt or empty audio keeps fallback and never retries each frame', async t => {
    for (const mode of ['404', 'decode', 'empty']) {
        const f = fixture(t, { scenes: { test: { music, effects: {} } } });
        f.context.decodeFails = mode === 'decode'; f.audio.select('test'); f.audio.tick();
        f.deliver(0, mode !== '404', mode === 'empty' ? 0 : 10); await settle();
        for (let i = 0; i < 100; i++) assert.equal(f.audio.tick(), false);
        assert.equal(f.requests.length, 1); assert.equal(f.context.nodes.length, 0);
    }
});

test('invalid paths and loop bounds never silence fallback or fetch an external resource', async t => {
    const f = fixture(t, { scenes: { test: { music: sample('bad-loop', { loop: { start: 0, end: 99 } }), effects: {
        jump: [sample('invalid', { path: 'https://provider.invalid/audio.mp3' }), sample('traversal', { path: 'assets/audio/../../private.wav' })],
    } } } });
    f.audio.select('test'); f.audio.tick(); assert.equal(f.requests.length, 1);
    f.deliver(0); await settle(); assert.equal(f.audio.tick(), false); assert.equal(f.audio.play('jump'), false);
    assert.equal(f.context.nodes.length, 0);
});

test('muting effects or suspending cancels one-shots; later readiness or unmute cannot replay them', async t => {
    const f = fixture(t); f.audio.select('test'); f.audio.tick();
    f.requests.forEach((_, i) => f.deliver(i)); await settle();
    f.audio.play('jump'); f.route.effectsEnabled = false; f.audio.tick();
    assert.equal(f.context.nodes.filter(n => n.starts.length && !n.loop && !n.disconnected).length, 0);
    f.route.effectsEnabled = true; const before = f.context.nodes.length; f.audio.tick(); assert.equal(f.context.nodes.length, before);
    f.audio.play('jump'); f.context.state = 'suspended'; f.audio.tick();
    assert.equal(f.context.nodes.filter(n => n.starts.length && !n.loop && !n.disconnected).length, 0);
    f.audio.dispose(); assert.ok(f.context.nodes.every(n => n.disconnected));
});

test('WorldAudio switches from synthesized music only after decode, preserves buses, and disposes all resources', async t => {
    const net = network(t), original = globalThis.AudioContext;
    Object.assign(globalThis, { AudioContext: Context });
    t.after(() => { if (original) globalThis.AudioContext = original; else Reflect.deleteProperty(globalThis, 'AudioContext'); });
    const world = new WorldAudio({ music: .5, effects: .6, voice: .7, shake: true }, pack);
    t.after(() => world.dispose()); world.select(1, false, 'test'); world.tick(16); assert.equal(net.requests.length, 0);
    world.unlock(); const route = world.getEffectsRoute()!, context = route.context as unknown as Context;
    world.tick(16); const synth = context.nodes.filter(n => n.starts.length && !n.buffer); assert.ok(synth.length > 0);
    net.requests.forEach((_, i) => net.deliver(i)); await settle(); world.tick(16);
    assert.ok(synth.every(n => n.disconnected)); const count = context.nodes.length;
    context.currentTime = 10; world.tick(16); assert.equal(context.nodes.length, count);
    world.sfx('jump'); world.pause(true); assert.ok(context.nodes.filter(n => n.buffer && !n.loop).every(n => n.disconnected));
    world.pause(false); world.toggle(); const muted = context.nodes.length; world.sfx('jump'); assert.equal(context.nodes.length, muted);
    world.select(0); assert.ok(context.nodes.filter(n => n.loop).every(n => n.disconnected));
    world.dispose(); assert.ok(context.nodes.every(n => n.disconnected)); assert.equal(context.state, 'closed');
});
