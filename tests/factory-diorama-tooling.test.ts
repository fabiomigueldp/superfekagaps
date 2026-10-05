import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PLAYER_WALK } from '../src/assets/playerSpriteSpec';
import { paintMapActor } from '../src/adventure/WorldMapArt';
import { atlasActorScale } from '../src/adventure/WorldAtlasArt';
import { mapToScreen, screenToMap } from '../src/adventure/WorldMapModel';
import { measureFabricaEnvelopes } from '../tools/diorama/measure_fabrica_envelopes';

test('published Factory proof remains reproducible from current metadata, sprite and atlas sources', () => {
    const published = JSON.parse(readFileSync(new URL('../docs/world/diorama/fabrica-runtime-envelopes.json', import.meta.url), 'utf8'));
    assert.deepEqual(published, measureFabricaEnvelopes(), 'Regenerate and audit the report when its actual runtime inputs change.');
    assert.equal(published.model, 'world-atlas');
    assert.equal(published.profiles.length, 20);
});

test('current Factory envelopes contain every painted idle/walk pixel in both facings, including subpixel panorama rounding', () => {
    const report = measureFabricaEnvelopes();
    for (const profile of report.profiles) for (const candidate of profile.candidates) {
        const camera = candidate.camera, span = Math.min(camera.width / 1.6, camera.height) * camera.zoom;
        for (const phase of [.01, .49, .99]) for (const facingLeft of [false, true])
            for (let frame = -1; frame < PLAYER_WALK.length; frame++) {
                const foot = { x: Math.floor(camera.width / 2) + phase, y: Math.floor(camera.height / 2) + phase };
                const marker = screenToMap(foot, camera), anchor = mapToScreen(marker, camera);
                const bounds = profile.normalized;
                const context = { fillStyle: '', fillRect(x: number, y: number, width: number, height: number) {
                    const tolerance = 1e-8;
                    assert.ok(x - anchor.x >= bounds.left * span * 1.6 - tolerance, `${profile.profile}/${profile.mode}: left`);
                    assert.ok(x + width - anchor.x <= bounds.right * span * 1.6 + tolerance, `${profile.profile}/${profile.mode}: right`);
                    assert.ok(y - anchor.y >= bounds.top * span - tolerance, `${profile.profile}/${profile.mode}: top`);
                    assert.ok(y + height - anchor.y <= bounds.bottom * span + tolerance, `${profile.profile}/${profile.mode}: foot`);
                } } as unknown as CanvasRenderingContext2D;
                paintMapActor(context, { camera, marker, time: Math.max(0, frame) * 95, reducedMotion: false,
                    walking: frame >= 0, facingLeft, scale: atlasActorScale(camera), shadow: false });
            }
    }
});
