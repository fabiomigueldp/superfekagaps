import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ARCADE_AUDIO_PACK, GUAIRA_MAP_AUDIO_PACK } from '../src/adventure/ArcadeAudioPack';
import { publicWaterAudioLevel } from '../src/adventure/experimental/guaira/chapter/GuairaChapterAudio';
import { GuairaChapterSession } from '../src/adventure/experimental/guaira/chapter/GuairaChapterSession';

const root = new URL('../', import.meta.url);
const production = JSON.parse(readFileSync(new URL('audio-pilots/arcade-r2/production-manifest.json', root), 'utf8'));
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
test('all 14 originals, editing masters and shipped derivatives match their recorded hashes', () => {
    assert.equal(production.records.length, 14);
    for (const r of production.records) {
        assert.equal(hash(readFileSync(new URL(`audio-pilots/arcade-r2/originais/${r.source.file}`, root))), r.source.sha256);
        assert.equal(hash(readFileSync(new URL(`audio-pilots/arcade-r2/masters/${r.id}.flac`, root))), r.master.sha256);
        assert.equal(hash(readFileSync(new URL(`public/assets/audio/arcade-r2/${r.delivery_file}`, root))), r.delivery.sha256);
        assert.equal(r.heard, false); assert.equal(r.artistic_approval, false);
        assert.ok(r.delivery.true_peak_dbtp < -5, `${r.id} keeps mix headroom`);
    }
    assert.ok(production.records.reduce((n: number, r: { delivery: { bytes: number } }) => n + r.delivery.bytes, 0) < 2_200_000);
});
test('catalog only references shipped assets with measured loop bounds; purple discharge stays out of clean-water scenes', () => {
    for (const pack of [ARCADE_AUDIO_PACK, GUAIRA_MAP_AUDIO_PACK]) for (const scene of Object.values(pack.scenes)) {
        for (const clip of [scene.music, ...Object.values(scene.effects).flat(), ...Object.values(scene.ambience ?? {})]) {
            if (!clip) continue;
            const record = production.records.find((r: { delivery_file: string }) => clip.path.endsWith('/' + r.delivery_file));
            assert.ok(record, clip.path); assert.ok(clip.gain > 0 && clip.gain <= 2);
            if (clip.loop) assert.ok(clip.loop.end <= record.delivery.decoded_seconds && clip.loop.end > clip.loop.start);
        }
    }
    assert.equal(ARCADE_AUDIO_PACK.scenes['guaira-respiros'].effects.jet, undefined);
    assert.ok(ARCADE_AUDIO_PACK.scenes['juice-lab'].effects.jet.every(s => s.path.includes('discharge')));
    for (const record of production.records.filter((r: { edit: { crossfade?: number } }) => r.edit.crossfade))
        assert.equal(record.delivery.decoded_samples_per_channel, Math.round((record.edit.end - record.edit.start) * 48000));
});
test('public-water audio requires an accepted receipt from this session and proximity to the painted source', () => {
    const session = new GuairaChapterSession(), point = { x: 926, y: 606 };
    assert.equal(publicWaterAudioLevel(session.snapshot(), point), 0);
    for (const sceneId of session.snapshot().route) {
        const attempt = session.enterScene(sceneId, session.snapshot().generation)!;
        const result = sceneId === 'guaira-prefeito' ? { sceneId, kind: 'mayor-water-released' as const }
            : sceneId === 'guaira-lab' ? { sceneId, kind: 'defeated-bull' as const } : { sceneId, kind: 'reached-finish' as const };
        assert.equal(publicWaterAudioLevel(session.snapshot(), point), 0);
        session.continueFrom(attempt, { attempt, state: 'playing', alive: true, result });
    }
    assert.equal(publicWaterAudioLevel(session.snapshot(), point), 1);
    assert.equal(publicWaterAudioLevel(session.snapshot(), { x: 400, y: 400 }), 0);
    assert.equal(publicWaterAudioLevel(session.snapshot()), 0);
    const old = session.snapshot();
    assert.equal(publicWaterAudioLevel({ ...old, generation: { ...old.generation, sessionId: old.generation.sessionId + 1 } }, point), 0);
});
