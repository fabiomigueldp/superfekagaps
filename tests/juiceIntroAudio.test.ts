import test from 'node:test';
import assert from 'node:assert/strict';
import { JuiceIntroAudio, juiceIntroScore, type IntroAudioRoute } from '../src/adventure/experimental/JuiceIntroAudio';
import { WorldAudio } from '../src/adventure/WorldAudio';
import type { IntroCue } from '../src/adventure/experimental/JuiceIntroDirector';

class Param {
    value = 0;
    events: number[][] = [];
    setValueAtTime(v: number, t: number) { this.events.push([v, t]); }
    linearRampToValueAtTime(v: number, t: number) { this.events.push([v, t]); }
    exponentialRampToValueAtTime(v: number, t: number) { this.events.push([v, t]); }
    setTargetAtTime(v: number, t: number) { this.events.push([v, t]); }
}
class Node {
    gain = new Param(); frequency = new Param(); type = ''; buffer: unknown;
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
function fixture() {
    const context = new Context(), destination = new Node();
    const route = { context, destination, enabled: true };
    const audio = new JuiceIntroAudio(() => route as unknown as IntroAudioRoute);
    return { context, destination, route, audio };
}

test('scores are finite, bounded and boo never lasts two seconds', () => {
    const cues: IntroCue[] = ['fanfare','footstep','pose','awkward','laugh','boo','pressure','invitation','resolve','combat'];
    for (const cue of cues) for (const n of juiceIntroScore(cue)) {
        assert.ok(n.at >= 0 && n.duration > 0 && n.at + n.duration < 4);
        assert.ok(n.frequency > 0 && n.volume > 0 && n.volume <= .2);
    }
    assert.ok(Math.max(...juiceIntroScore('boo').map(n => n.at + n.duration)) < 2);
    assert.deepEqual(juiceIntroScore('cancel'), []);
});
test('uninitialized, muted and suspended routes never unlock or defer cues', () => {
    assert.equal(new JuiceIntroAudio(() => null).play('fanfare'), false);
    const { audio, context, route } = fixture();
    route.enabled = false; assert.equal(audio.play('fanfare'), false);
    route.enabled = true; context.state = 'suspended'; assert.equal(audio.play('fanfare'), false);
    context.state = 'running'; audio.sync();
    assert.equal(context.nodes.length, 0); assert.equal(context.resumes, 0);
});
test('all cues use supplied effects destination and disconnect after natural end', () => {
    const { audio, context, destination } = fixture();
    assert.equal(audio.play('pressure'), true);
    const sources = context.nodes.filter(n => n.starts.length);
    assert.equal(sources.length, juiceIntroScore('pressure').length);
    assert.equal(context.nodes.filter(n => n.destinations.includes(destination)).length, sources.length);
    sources.forEach(n => n.onended?.());
    assert.equal(audio.activeVoiceCount, 0);
    assert.ok(context.nodes.every(n => n.disconnected));
});
test('pause and focus interruption cancel future sounds; resume never replays', () => {
    const { audio, context } = fixture(); audio.play('invitation');
    audio.setPaused(true); assert.equal(audio.activeVoiceCount, 0);
    assert.ok(context.nodes.every(n => n.disconnected));
    const count = context.nodes.length;
    assert.equal(audio.play('boo'), false);
    audio.setPaused(false); audio.sync(); assert.equal(context.nodes.length, count);
    audio.play('pressure'); context.state = 'suspended'; audio.sync(); assert.equal(audio.activeVoiceCount, 0);
});
test('mute cancels pending cues; unmute cannot resurrect them', () => {
    const { audio, context, route } = fixture(); audio.play('boo'); route.enabled = false; audio.sync();
    assert.equal(audio.activeVoiceCount, 0); const count = context.nodes.length;
    route.enabled = true; audio.sync(); assert.equal(context.nodes.length, count);
});
test('skip, replay, repeated cues, combat and dispose have bounded resources', () => {
    const { audio, context } = fixture();
    for (let i = 0; i < 30; i++) audio.play('pressure');
    assert.equal(audio.activeVoiceCount, juiceIntroScore('pressure').length);
    audio.play('cancel'); audio.cancel(); assert.equal(audio.activeVoiceCount, 0);
    assert.ok(context.nodes.every(n => n.disconnected));
    audio.play('fanfare'); audio.cancel(); audio.play('combat'); audio.dispose(); audio.dispose();
    assert.equal(audio.activeVoiceCount, 0); assert.equal(audio.play('fanfare'), false);
});
test('WorldAudio route accessor is inert before gesture and preserves existing mute bus', () => {
    const old = globalThis.AudioContext;
    Object.assign(globalThis, { AudioContext: Context });
    try {
        const world = new WorldAudio({ music: .5, effects: .6, voice: .7 } as ConstructorParameters<typeof WorldAudio>[0]);
        assert.equal(world.getEffectsRoute(), null);
        world.unlock(); const route = world.getEffectsRoute()!;
        assert.ok(route); assert.equal(route.enabled, true);
        const dest = route.destination as unknown as Node;
        world.toggle(); assert.equal(world.getEffectsRoute()!.destination, route.destination);
        assert.equal(world.getEffectsRoute()!.enabled, false);
        assert.equal(dest.gain.events[dest.gain.events.length - 1][0], 0);
    } finally { Object.assign(globalThis, { AudioContext: old }); }
});
