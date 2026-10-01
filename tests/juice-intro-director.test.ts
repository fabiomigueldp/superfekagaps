import test from 'node:test';
import assert from 'node:assert/strict';
import { JuiceIntroDirector, JUICE_INTRO_SCRIPT } from '../src/adventure/experimental/JuiceIntroDirector';
test('declarative script has unique beats and bounded timed scenes', () => {
    assert.equal(new Set(JUICE_INTRO_SCRIPT.map(b => b.id)).size, JUICE_INTRO_SCRIPT.length);
    assert.ok(JUICE_INTRO_SCRIPT.filter(b => Number.isFinite(b.durationMs)).reduce((s,b) => s + b.durationMs, 0) <= 42000);
});
for (const dt of [1000 / 60, 1000 / 30, 100, 1000]) test(`deterministic intro at dt=${dt}`, () => {
    const a = new JuiceIntroDirector(), b = new JuiceIntroDirector(); const cues: string[] = [];
    for (let i = 0; i < 10000 && !a.complete; i++) {
        const input = { right: true, presentPressed: true };
        a.advance(dt, input); b.advance(dt, input);
        assert.deepEqual(a.frame, b.frame); cues.push(...a.drainCues()); b.drainCues();
    }
    assert.ok(a.complete); assert.equal(a.fekaX, 68);
    for (const cue of ['fanfare','footstep','pose','awkward','laugh','boo','pressure','invitation','resolve']) assert.equal(cues.filter(c => c === cue).length, 1, cue);
});
test('holds have no timeout, invalid time is inert, and skip cancels rather than replaying cues', () => {
    const d = new JuiceIntroDirector();
    for (let i = 0; i < 40; i++) d.advance(100);
    assert.equal(d.beat, 'walk'); const x = d.fekaX;
    for (let i = 0; i < 1000; i++) d.advance(100);
    assert.equal(d.beat, 'walk'); assert.equal(d.fekaX, x);
    const frozen = d.frame;
    for (const dt of [-1, 0, NaN, Infinity]) d.advance(dt);
    assert.deepEqual(d.frame, frozen);
    d.skip(); assert.ok(d.complete); assert.deepEqual(d.drainCues(), ['cancel']);
    d.skip(); assert.deepEqual(d.drainCues(), []);
});
test('each beat can be skipped without advancing intermediate callbacks', () => {
    for (const target of JUICE_INTRO_SCRIPT.filter(b => b.id !== 'complete')) {
        const d = new JuiceIntroDirector();
        for (let i = 0; i < 10000 && d.beat !== target.id; i++) d.advance(100, { right: true, presentPressed: true });
        assert.equal(d.beat, target.id); d.drainCues(); d.skip();
        assert.deepEqual(d.drainCues(), ['cancel']); assert.equal(d.fekaX, 68);
    }
});

test('presentation tap is buffered through the short prompt settling window', () => {
    const d = new JuiceIntroDirector();
    for (let i=0;i<1000 && d.beat!=='prepare';i++) d.advance(100,{right:true});
    assert.equal(d.beat,'prepare');
    d.advance(16,{presentPressed:true});
    for(let i=0;i<10;i++) d.advance(16);
    assert.equal(d.beat,'reveal');
});
