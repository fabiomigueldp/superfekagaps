import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { WorldAudio } from '../src/adventure/WorldAudio';

class Param {
    value = 0;
    setValueAtTime() {}
    linearRampToValueAtTime() {}
    exponentialRampToValueAtTime() {}
    setTargetAtTime() {}
}
class Node {
    gain = new Param(); frequency = new Param(); Q = new Param(); type = '';
    onended: (() => void) | null = null;
    starts: number[] = []; stops: (number | undefined)[] = []; disconnected = false;
    connect() {}
    disconnect() { this.disconnected = true; }
    start(t: number) { this.starts.push(t); }
    stop(t?: number) { this.stops.push(t); }
}
class Context {
    currentTime = 0; state = 'running'; destination = new Node(); nodes: Node[] = [];
    make() { const n = new Node(); this.nodes.push(n); return n; }
    createGain() { return this.make(); }
    createOscillator() { return this.make(); }
    createBiquadFilter() { return this.make(); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
}
function fixture(t: TestContext) {
    const original = globalThis.AudioContext;
    Object.assign(globalThis, { AudioContext: Context });
    const audio = new WorldAudio({ music: .5, effects: .6, voice: .7, shake: true }, { scenes: {} });
    t.after(() => {
        audio.dispose();
        if (original) globalThis.AudioContext = original;
        else Reflect.deleteProperty(globalThis, 'AudioContext');
    });
    audio.select(1); audio.unlock();
    const context = audio.getEffectsRoute()!.context as unknown as Context;
    return { audio, context, sources: () => context.nodes.filter(n => n.starts.length) };
}

test('pause/resume preserves the synth beat cursor without layering a duplicate beat', t => {
    const { audio, context, sources } = fixture(t);
    audio.tick(16);
    const firstBeat = sources(); assert.equal(firstBeat.length, 3);
    for (let i = 0; i < 5; i++) {
        audio.pause(true); audio.tick(16); audio.pause(false); audio.tick(16);
        assert.equal(sources().length, firstBeat.length, 'a frozen clock cannot schedule another beat');
    }
    assert.ok(firstBeat.every(n => !n.disconnected), 'existing note envelopes continue after resume');
    context.currentTime = .14; audio.tick(16);
    assert.equal(sources().length, 4);
    assert.equal(sources().at(-1)!.starts[0], .2, 'next beat retains its original audio-clock timestamp');
    context.currentTime = 5; audio.tick(16);
    assert.equal(sources().at(-1)!.starts[0], 5, 'device clock jumps still use existing catch-up logic');
});

test('speech cancel, pause and scene handoff discard synth syllables without stopping music', t => {
    for (const boundary of ['cancel', 'pause', 'scene'] as const) {
        const { audio, sources } = fixture(t);
        audio.tick(16); const music = sources();
        audio.say('feka', 'fala'); audio.tick(16); audio.tick(70);
        const syllables = sources().filter(n => !music.includes(n));
        assert.equal(syllables.length, 1);
        if (boundary === 'cancel') audio.cancelSpeech();
        if (boundary === 'pause') audio.pause(true);
        if (boundary === 'scene') audio.select(2);
        assert.ok(syllables.every(n => n.disconnected && n.stops.includes(undefined)));
        if (boundary !== 'scene') assert.ok(music.every(n => !n.disconnected));
        if (boundary === 'pause') audio.pause(false);
        const count = sources().length; audio.tick(70);
        if (boundary !== 'scene') assert.equal(sources().length, count, 'canceled speech must not resume');
        audio.dispose(); assert.ok(sources().every(n => n.disconnected));
    }
});

test('naturally ended synth syllables are removed from cancellation ownership', t => {
    const { audio, sources } = fixture(t);
    audio.say('feka', 'fala'); audio.tick(16); audio.tick(70);
    const voice = sources().find(n => n.type === 'sawtooth')!;
    voice.onended?.(); const stops = voice.stops.length;
    audio.cancelSpeech(); audio.dispose();
    assert.equal(voice.stops.length, stops); assert.ok(voice.disconnected);
});
