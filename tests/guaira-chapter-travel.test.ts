import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GuairaMapModel, parseGuairaMetadata, type GuairaArrival } from '../src/adventure/experimental/guaira/GuairaMapModel';
import { GuairaChapterTravel } from '../src/adventure/experimental/guaira/chapter/GuairaChapterTravel';

const metadata = parseGuairaMetadata(JSON.parse(readFileSync(new URL('../public/assets/world/experimental/guaira/guaira-diorama.meta.json', import.meta.url), 'utf8')))!;

test('chapter travel follows the same road and timing as the free map for the shared continuation', () => {
    const free = new GuairaMapModel(metadata, 'rice'), chapter = new GuairaChapterTravel(metadata, 'rice');
    free.walkToCorral(); chapter.walkTo('corral');
    for (let i = 0; i < 2000 && free.moving; i++) {
        const dt = [1 / 60, .01, .1][i % 3]; free.tick(dt); chapter.tick(dt);
        assert.deepEqual(chapter.point, free.point); assert.equal(chapter.facingLeft, free.facingLeft);
    }
    assert.equal(chapter.arrival, 'corral'); assert.equal(chapter.moving, false);
});

test('all chapter entry/return anchors use the authored road in both directions without jumping on selection', () => {
    for (const from of ['town', 'rice', 'corral', 'vazao'] as const)
        for (const to of ['town', 'rice', 'corral', 'vazao'] as const) {
            const travel = new GuairaChapterTravel(metadata, from), start = travel.point;
            travel.walkTo(to); assert.deepEqual(travel.point, start);
            let last = travel.distance;
            for (let i = 0; i < 4000 && travel.moving; i++) {
                travel.tick(1 / 60); assert.ok(Math.abs(travel.distance - last) <= 170 / 60 + 1e-6); last = travel.distance;
            }
            assert.equal(travel.arrival, to); assert.equal(travel.moving, false);
            assert.deepEqual(travel.point, new GuairaMapModel(metadata, to).point);
        }
});

test('reversals, reduced motion and disposal preserve a single real actor position', () => {
    const travel = new GuairaChapterTravel(metadata, 'town'); travel.walkTo('vazao');
    travel.tick(.03); const at = travel.point; travel.walkTo('rice'); assert.deepEqual(travel.point, at);
    travel.tick(.03); travel.walkTo('town'); assert.equal(travel.moving, true);
    travel.setReducedMotion(true); assert.equal(travel.arrival, 'town'); assert.equal(travel.moving, false);
    travel.walkTo('vazao'); assert.equal(travel.arrival, 'vazao');
    travel.walkTo('untrusted' as GuairaArrival); assert.equal(travel.arrival, 'vazao');
    travel.setReducedMotion(false); travel.walkTo('town'); travel.tick(.02);
    travel.dispose(); const stopped = travel.point;
    travel.tick(50); travel.skip(); travel.walkTo('rice'); travel.setReducedMotion(true); travel.dispose();
    assert.deepEqual(travel.point, stopped); assert.equal(travel.moving, false);
});
