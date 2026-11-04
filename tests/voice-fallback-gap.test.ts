import assert from 'node:assert/strict';
import test from 'node:test';
import type { AudioEngine } from '../src/engine/AudioEngine';
import { AudioVoicePlayer } from '../src/voice/AudioVoicePlayer';

function playback(gapAfterMs = 50) {
    const events: string[] = [];
    const player = new AudioVoicePlayer({ ensureReady: () => false } as AudioEngine, {
        onClipStart: clip => events.push(`start:${clip.id}`),
        onClipEnd: (clip, info) => events.push(`end:${clip.id}:${info.reason}`),
        onQueueComplete: info => events.push(`complete:${info.reason}`),
    });
    player.playQueue(['first', 'second'].map(id => ({
        clip: { id, text: id, url: '/unused.ogg', expectedDurationSec: 0.1 }, gapAfterMs,
    })));
    return { player, events };
}

for (const deltas of [[100, 49], [90, 30, 29], [25, 25, 25, 25, 49]]) {
    test(`fallback preserves the full inter-clip gap across updates ${deltas.join('/')}`, () => {
        const { player, events } = playback();
        for (const delta of deltas) player.update(delta);
        assert.deepEqual(events, ['start:first', 'end:first:ended'], '149ms cannot finish a 100ms clip plus 50ms gap');
        player.update(1);
        assert.deepEqual(events, ['start:first', 'end:first:ended', 'start:second'], 'only unused elapsed time advances the gap');
        player.update(99);
        assert.equal(events.length, 3, 'the second clip retains its own duration');
        player.update(1);
        player.update(1000);
        assert.deepEqual(events, ['start:first', 'end:first:ended', 'start:second', 'end:second:ended', 'complete:ended']);
    });
}

test('zero-gap fallback starts the next clip immediately without completing it twice', () => {
    const { player, events } = playback(0);
    player.update(100);
    assert.deepEqual(events, ['start:first', 'end:first:ended', 'start:second']);
    player.update(100);
    assert.deepEqual(events, ['start:first', 'end:first:ended', 'start:second', 'end:second:ended', 'complete:ended']);
});

test('stopping during the fallback gap never starts the queued clip', () => {
    const { player, events } = playback();
    player.update(100);
    player.stop();
    player.update(1000);
    assert.deepEqual(events, ['start:first', 'end:first:ended', 'complete:stopped']);
});
