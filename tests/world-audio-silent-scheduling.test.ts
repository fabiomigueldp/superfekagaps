import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { WorldAudio } from '../src/adventure/WorldAudio';

const originalAudioContext = globalThis.AudioContext;
type Event = [string, ...number[]];
class Param {
    value = 0;
    events: Event[] = [];
    setValueAtTime(value: number, at: number) { this.events.push(['set', value, at]); }
    linearRampToValueAtTime(value: number, at: number) { this.events.push(['linear', value, at]); }
    exponentialRampToValueAtTime(value: number, at: number) { this.events.push(['exponential', value, at]); }
    setTargetAtTime(value: number, at: number, constant: number) { this.events.push(['target', value, at, constant]); }
}
class Node {
    gain = new Param(); frequency = new Param(); type = '';
    destinations: Node[] = []; disconnected = false;
    starts: number[] = []; stops: (number | undefined)[] = [];
    onended: (() => void) | null = null;
    connect(node: Node) { this.destinations.push(node); }
    disconnect() { this.disconnected = true; }
    start(at: number) { this.starts.push(at); }
    stop(at?: number) { this.stops.push(at); }
}
class Context {
    currentTime = 0; state = 'running'; nodes: Node[] = []; destination = new Node();
    resumes = 0;
    make() { const node = new Node(); this.nodes.push(node); return node; }
    createGain() { return this.make(); }
    createOscillator() { return this.make(); }
    resume() { this.resumes++; this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    advance(at: number) {
        this.currentTime = at;
        // Deliver natural endings so the test counts allocations, not normal tails as leaks.
        for (const node of this.nodes) {
            if (node.starts.length && node.stops.length && !node.disconnected && (node.stops.at(-1) ?? 0) <= at) node.onended?.();
        }
    }
}
function fixture(t: TestContext, music = .5, unlock = true) {
    Object.assign(globalThis, { AudioContext: Context });
    const audio = new WorldAudio({ music, effects: .6, voice: .7, shake: true }, { scenes: {} });
    t.after(() => {
        audio.dispose();
        if (originalAudioContext) globalThis.AudioContext = originalAudioContext;
        else Reflect.deleteProperty(globalThis, 'AudioContext');
    });
    audio.select(1);
    if (unlock) audio.unlock();
    const context = audio.getEffectsRoute()?.context as unknown as Context | undefined;
    return { audio, context: context!, sources: () => context?.nodes.filter(node => node.starts.length) ?? [] };
}
function trace(nodes: Node[]) {
    return nodes.filter(node => node.starts.length).map(node => ({
        type: node.type, frequency: node.frequency.value, starts: node.starts, stops: node.stops,
        envelope: node.destinations[0].gain.events,
    }));
}

test('muted and zero-volume synth music allocate no silent sources while the audible baseline is unchanged', t => {
    for (const mode of ['audible', 'muted', 'music-zero'] as const) {
        const { audio, context, sources } = fixture(t, mode === 'music-zero' ? 0 : .5);
        if (mode === 'muted') audio.toggle();
        for (let frame = 0; frame < 3600; frame++) {
            context.advance(frame / 60); audio.tick(1000 / 60);
        }
        const expected = mode === 'audible' ? 660 : 0;
        assert.equal(sources().length, expected, `${mode}: source allocations in 60 seconds`);
        assert.equal(context.nodes.length, 3 + expected * 2, `${mode}: three buses plus one gain per source`);
        audio.dispose(); assert.ok(context.nodes.every(node => node.disconnected));
    }
});

test('unmute and restoring music volume continue the same beat, envelopes and frequencies without replaying silent beats', t => {
    for (const mode of ['mute', 'volume'] as const) {
        const control = fixture(t), subject = fixture(t);
        for (let frame = 0; frame < 1200; frame++) {
            control.context.advance(frame / 60); subject.context.advance(frame / 60);
            // Repeated interruptions, including beats and partial beats.
            const silent = frame % 173 >= 31 && frame % 173 < 123;
            if (mode === 'mute' && subject.audio.enabled === silent) subject.audio.toggle();
            if (mode === 'volume') {
                const value = silent ? 0 : .5;
                if (subject.audio.preferences.music !== value) { subject.audio.preferences.music = value; subject.audio.volume(); }
            }
            const beforeControl = control.context.nodes.length, beforeSubject = subject.context.nodes.length;
            control.audio.tick(1000 / 60); subject.audio.tick(1000 / 60);
            assert.deepEqual(trace(subject.context.nodes.slice(beforeSubject)), silent ? [] : trace(control.context.nodes.slice(beforeControl)));
        }
    }
});

test('mute preserves existing envelopes and zero music volume leaves effects audible', t => {
    const { audio, context, sources } = fixture(t);
    audio.tick(16); const tail = sources(), before = context.nodes.length;
    const envelopes = structuredClone(trace(tail));
    audio.toggle(); audio.tick(16);
    assert.equal(context.nodes.length, before);
    assert.deepEqual(trace(tail), envelopes, 'mute leaves already scheduled note envelopes untouched');
    assert.deepEqual(tail[0].destinations[0].destinations[0].gain.events.at(-1), ['target', 0, 0, .06], 'the music bus retains its existing mute ramp');
    assert.ok(tail.every(node => !node.disconnected && node.stops.length === 1), 'mute does not cut the existing gain-ramp tail');
    context.advance(1); audio.tick(16);
    assert.ok(tail.every(node => node.disconnected));
    assert.equal(context.nodes.length, before, 'later silent beats cannot allocate nodes');
    audio.preferences.music = 0; audio.toggle();
    audio.sfx('jump');
    assert.equal(sources().length, tail.length + 2, 'the music slider does not suppress effects');
    assert.ok(sources().slice(-2).every(node => node.destinations[0].destinations.includes(audio.getEffectsRoute()!.destination as unknown as Node)));
});

test('suspended and paused audio cannot allocate or unlock; disposal and fresh entry keep ownership separate', t => {
    const locked = fixture(t, .5, false);
    locked.audio.tick(16); assert.equal(locked.audio.getEffectsRoute(), null);
    const { audio, context, sources } = fixture(t);
    audio.tick(16); const before = context.nodes.length, resumes = context.resumes;
    context.state = 'suspended';
    for (let frame = 0; frame < 60; frame++) audio.tick(16);
    assert.equal(context.nodes.length, before); assert.equal(context.resumes, resumes);
    audio.pause(true); audio.toggle(); audio.pause(false); audio.tick(16);
    assert.equal(context.nodes.length, before);
    audio.toggle(); audio.tick(16);
    assert.equal(context.nodes.length, before, 'the frozen audio clock cannot duplicate the first beat');
    context.advance(.14); audio.tick(16); assert.equal(sources().at(-1)!.starts[0], .2);
    audio.dispose(); const disposedCount = context.nodes.length;
    audio.unlock(); audio.tick(1000); audio.sfx('jump');
    assert.equal(context.nodes.length, disposedCount); assert.equal(context.state, 'closed');
    assert.ok(context.nodes.every(node => node.disconnected));
    const reentry = fixture(t); reentry.audio.tick(16);
    assert.notEqual(reentry.context, context); assert.equal(reentry.sources().length, 3);
});
