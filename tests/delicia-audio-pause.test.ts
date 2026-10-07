import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { DeliciaAudio } from '../src/adventure/delicia/DeliciaAudio';

class Param {
    value = 0;
    events: (string | number)[][] = [];
    setValueAtTime(value: number, time: number) { this.events.push(['set', value, time]); }
    linearRampToValueAtTime(value: number, time: number) { this.events.push(['linear', value, time]); }
    exponentialRampToValueAtTime(value: number, time: number) { this.events.push(['exponential', value, time]); }
    setTargetAtTime(value: number, time: number, constant: number) { this.events.push(['target', value, time, constant]); }
    cancelScheduledValues(time: number) { this.events.push(['cancel', time]); }
}
class Node {
    gain = new Param(); frequency = new Param(); type = '';
    buffer: { name: string } | null = null; loop = false;
    destinations: Node[] = []; starts: (number | undefined)[] = []; stops: (number | undefined)[] = [];
    onended: (() => void) | null = null;
    connect(node: Node) { this.destinations.push(node); }
    disconnect() { this.destinations = []; }
    start(time?: number) { this.starts.push(time); }
    stop(time?: number) { this.stops.push(time); }
}
class Context {
    currentTime = 0; state = 'running'; destination = new Node(); nodes: Node[] = [];
    events: string[] = [];
    make() { const node = new Node(); this.nodes.push(node); return node; }
    createGain() { return this.make(); }
    createBufferSource() { return this.make(); }
    createOscillator() { return this.make(); }
    decodeAudioData(data: ArrayBuffer) { return Promise.resolve({ name: new TextDecoder().decode(data) }); }
    resume() { this.events.push('resume'); this.state = 'running'; return Promise.resolve(); }
    suspend() { this.events.push('suspend'); this.state = 'suspended'; return Promise.resolve(); }
    close() { this.events.push('close'); this.state = 'closed'; return Promise.resolve(); }
    advance(seconds: number) { if (this.state === 'running') this.currentTime += seconds; }
}
function fixture(t: TestContext) {
    const originalAudioContext = globalThis.AudioContext, originalFetch = globalThis.fetch;
    const contexts: Context[] = [], requests: string[] = [];
    Object.assign(globalThis, {
        AudioContext: class extends Context { constructor() { super(); contexts.push(this); } },
        fetch: async (url: string) => {
            const name = url.split('/').at(-1)!.replace('.ogg', '');
            requests.push(name); return new Response(name);
        },
    });
    const audio = new DeliciaAudio();
    t.after(() => {
        audio.dispose(); globalThis.fetch = originalFetch;
        if (originalAudioContext) globalThis.AudioContext = originalAudioContext;
        else Reflect.deleteProperty(globalThis, 'AudioContext');
    });
    return { audio, contexts, requests };
}
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
const sources = (context: Context) => context.nodes.filter(node => node.starts.length);

test('changing sound in paused Delicia settings cannot restart the audio clock or existing loops', async t => {
    const { audio, contexts } = fixture(t);
    audio.music('orchard'); await audio.unlock(); await settle();
    const context = contexts[0], playing = sources(context);
    assert.deepEqual(playing.map(node => node.buffer?.name), ['orchard', 'orchard-air']);
    context.advance(2); audio.pause(true);
    const resumes = context.events.filter(event => event === 'resume').length;
    for (let i = 0; i < 4; i++) {
        // DeliciaApp's settings checkbox invokes both methods, even from the pause menu.
        audio.toggleMute(); await audio.unlock(); await settle(); context.advance(3);
        assert.equal(context.state, 'suspended', 'unlock must honor the game pause');
        assert.equal(context.currentTime, 2, 'existing music and ambience must retain their paused playheads');
        assert.equal(context.events.filter(event => event === 'resume').length, resumes);
        assert.deepEqual(sources(context), playing, 'the existing loops must be preserved without duplicates');
    }
    audio.pause(false); context.advance(1);
    assert.equal(context.state, 'running'); assert.equal(context.currentTime, 3);
    assert.ok(playing.every(node => node.starts.length === 1 && node.stops.length === 0));
});

test('first user unlock while paused suspends a newly created context until play resumes', async t => {
    const { audio, contexts } = fixture(t);
    audio.music('orchard'); audio.pause(true);
    assert.equal(contexts.length, 0, 'pausing and selecting music cannot create an audio context');
    await audio.unlock(); await settle();
    const context = contexts[0];
    assert.equal(context.state, 'suspended');
    assert.equal(context.events.filter(event => event === 'resume').length, 0);
    assert.equal(sources(context).length, 0);
    audio.pause(false); await settle();
    assert.equal(context.state, 'running');
    assert.deepEqual(sources(context).map(node => node.buffer?.name), ['orchard', 'orchard-air']);
});

test('ordinary unlock keeps the original music fade, ambience and effect behavior', async t => {
    const { audio, contexts, requests } = fixture(t);
    audio.music('orchard'); audio.effect('jump'); audio.voice('guina-final'); audio.pause(false);
    await settle(); assert.equal(contexts.length, 0); assert.equal(requests.length, 0);
    await audio.unlock(); await settle();
    const context = contexts[0], [music, ambience] = sources(context);
    assert.equal(context.state, 'running');
    assert.deepEqual(music.destinations[0].gain.events, [['set', 0, 0], ['linear', .45 * .7, .65]]);
    assert.equal(ambience.destinations[0].gain.value, .7 * .08);
    audio.effect('jump'); const jump = sources(context).at(-1)!;
    assert.deepEqual(jump.frequency.events, [['set', 420, 0], ['exponential', 420 * 1.7, .1]]);
    assert.deepEqual(jump.stops, [.15]);
    await audio.unlock(); await settle();
    assert.equal(sources(context).length, 3, 'repeated unlock cannot layer music or ambience');
});

test('pausing during unlock keeps its asynchronous continuation from starting music', async t => {
    const { audio, contexts } = fixture(t);
    audio.music('orchard'); const unlocking = audio.unlock(); audio.pause(true);
    await unlocking; await settle();
    const context = contexts[0];
    assert.equal(context.state, 'suspended'); assert.equal(sources(context).length, 0);
    audio.pause(false); await settle();
    assert.equal(context.state, 'running');
    assert.deepEqual(sources(context).map(node => node.buffer?.name), ['orchard', 'orchard-air']);
});

test('disposed audio cannot unlock again and fresh entry owns an independent context', async t => {
    const { audio, contexts } = fixture(t);
    await audio.unlock(); await settle(); audio.pause(true); audio.dispose();
    const context = contexts[0], events = [...context.events];
    await audio.unlock(); await settle();
    assert.equal(context.state, 'closed'); assert.deepEqual(context.events, events); assert.equal(contexts.length, 1);
    const next = new DeliciaAudio(); t.after(() => next.dispose());
    next.music('orchard'); await next.unlock(); await settle();
    assert.equal(contexts.length, 2); assert.notEqual(contexts[1], context);
    assert.equal(contexts[1].state, 'running');
    assert.deepEqual(sources(contexts[1]).map(node => node.buffer?.name), ['orchard', 'orchard-air']);
    assert.deepEqual(context.events, events, 'reentry cannot resume the disposed chapter context');
});

test('a track decoded during pause is selected once on resume instead of retaining the previous scene music', async t => {
    const { audio, contexts } = fixture(t);
    audio.music('orchard'); await audio.unlock(); await settle();
    const context = contexts[0], original = sources(context);
    let finishDecode!: () => void;
    const decoding = new Promise<void>(resolve => { finishDecode = resolve; });
    const decode = context.decodeAudioData.bind(context);
    t.mock.method(context, 'decodeAudioData', async (bytes: ArrayBuffer) => {
        if (new TextDecoder().decode(bytes) === 'reservoir') await decoding;
        return decode(bytes);
    });
    audio.music('reservoir'); await settle(); audio.pause(true);
    finishDecode(); await settle();
    assert.deepEqual(sources(context), original, 'a paused decode cannot start the next track');
    audio.toggleMute(); audio.pause(false); await settle();
    assert.equal(sources(context).filter(node => node.buffer?.name === 'reservoir').length, 1);
    assert.ok(original.every(node => node.stops.length === 1), 'old music and orchard ambience must be retired');
    const reservoir = sources(context).find(node => node.buffer?.name === 'reservoir')!;
    assert.deepEqual(reservoir.destinations[0].gain.events.at(-1), ['linear', 0, .65], 'resuming must preserve mute');
    for (let index = 0; index < 3; index++) { audio.pause(true); audio.pause(false); await audio.unlock(); }
    await settle();
    assert.equal(sources(context).filter(node => node.buffer?.name === 'reservoir').length, 1);
});

test('orchard ambience decoded during pause starts once on resume without restarting music', async t => {
    const { audio, contexts } = fixture(t);
    await audio.unlock(); await settle();
    const context = contexts[0];
    let finishDecode!: () => void;
    const decoding = new Promise<void>(resolve => { finishDecode = resolve; });
    const decode = context.decodeAudioData.bind(context);
    t.mock.method(context, 'decodeAudioData', async (bytes: ArrayBuffer) => {
        if (new TextDecoder().decode(bytes) === 'orchard-air') await decoding;
        return decode(bytes);
    });
    audio.music('orchard'); await settle();
    assert.deepEqual(sources(context).map(node => node.buffer?.name), ['orchard']);
    audio.pause(true); finishDecode(); await settle();
    assert.equal(sources(context).length, 1);
    audio.pause(false); audio.pause(false); await audio.unlock(); await settle();
    assert.deepEqual(sources(context).map(node => node.buffer?.name), ['orchard', 'orchard-air']);
});

test('returning to the playing scene supersedes an older pending transition', async t => {
    const { audio, contexts } = fixture(t);
    audio.music('orchard'); await audio.unlock(); await settle();
    const context = contexts[0], original = sources(context);
    let finishDecode!: () => void;
    const decoding = new Promise<void>(resolve => { finishDecode = resolve; });
    const decode = context.decodeAudioData.bind(context);
    t.mock.method(context, 'decodeAudioData', async (bytes: ArrayBuffer) => {
        if (new TextDecoder().decode(bytes) === 'reservoir') await decoding;
        return decode(bytes);
    });
    audio.music('reservoir'); await settle(); audio.music('orchard');
    finishDecode(); await settle();
    assert.deepEqual(sources(context), original);
    assert.ok(original.every(node => node.stops.length === 0));
});

for (const voice of ['jaja-delicia', 'guina-oco'])
    test(`stage-entry unlock preserves the pending ${voice} intro and starts boss music once`, async t => {
        const { audio, contexts } = fixture(t);
        audio.music('orchard'); await audio.unlock(); await settle();
        const context = contexts[0];
        // DeliciaApp.loadStage: resume, fire-and-forget unlock, select the boss
        // track, then showDialogue queues its first voice before unlock resolves.
        audio.pause(false); const unlocking = audio.unlock(); audio.music('guina'); audio.voice(voice);
        await unlocking; await settle();
        assert.equal(sources(context).filter(node => node.buffer?.name === voice).length, 1);
        assert.equal(sources(context).filter(node => node.buffer?.name === 'guina').length, 1);
    });
