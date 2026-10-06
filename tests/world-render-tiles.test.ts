import assert from 'node:assert/strict';
import test from 'node:test';
import { FALLING_PLATFORM_ARM_MS, FALLING_PLATFORM_FALL_MS, FALLING_PLATFORM_MIN_CONTACT_MS,
    FALLING_PLATFORM_RESPAWN_MS, TileType as T } from '../src/constants';
import { STAGES, ISLANDS } from '../src/adventure/campaign';
import { WorldLevel } from '../src/adventure/WorldPhysics';
import { drawWorldTerrain } from '../src/adventure/WorldTerrain';

const levelFor = (id = '1-1') => new WorldLevel(STAGES.find(stage => stage.id === id)!.level);
function assertSnapshotParity(level: WorldLevel): void {
    assert.deepEqual(level.getRenderTiles(), level.getModifiedTiles());
}

test('clean World render views avoid every tile array and cell copy', () => {
    for (const [id, cells] of [['1-1', 3680], ['4-4', 4232]] as const) {
        const level = levelFor(id), source = level.data.tiles;
        assert.equal(source.reduce((count, row) => count + row.length, 0), cells);
        const snapshot = level.getModifiedTiles();
        assert.notEqual(snapshot, source);
        assert.equal(snapshot.filter((row, index) => row !== source[index]).length + 1, 24);
        for (let frame = 0; frame < 120; frame++) assert.equal(level.getRenderTiles(), source);
        assertSnapshotParity(level);
    }
});

test('several masks share one row copy and never modify authored tiles', () => {
    const level = levelFor(), source = level.data.tiles;
    level.setTile(8, 14, T.PLATFORM_FALLING);
    level.removeTileTemporarily(4, 14, 1000);
    level.removeTileTemporarily(5, 14, 1000);
    level.markFallingPlatformContact(8, 14);
    // Both mask collections may contain the same cell without copying its row twice.
    level.removeTileTemporarily(8, 14, 1000);
    const before = structuredClone(source), view = level.getRenderTiles();
    assert.notEqual(view, source);
    assert.equal(view.filter((row, index) => row !== source[index]).length, 1);
    assert.equal(view[14].length, 160, 'Only 160 tile cells, rather than 3,680, are copied.');
    for (const col of [4, 5, 8]) assert.equal(view[14][col], T.EMPTY);
    assert.deepEqual(source, before);
    assertSnapshotParity(level);
    level.removeTileTemporarily(4, 15, 1000);
    assert.equal(level.getRenderTiles().filter((row, index) => row !== source[index]).length, 2);
    assertSnapshotParity(level);
});

test('render views reflect direct edits and replacements without cache invalidation', () => {
    const level = levelFor();
    level.getRenderTiles();
    level.setTile(3, 14, T.ICE);
    assert.equal(level.getRenderTiles()[14][3], T.ICE);
    level.removeTileTemporarily(4, 14, 1000);
    level.getRenderTiles();
    level.data.tiles[14][5] = T.ICE;
    level.data.tiles[15] = level.data.tiles[15].map(() => T.BRICK);
    const view = level.getRenderTiles();
    assert.equal(view[14][5], T.ICE);
    assert.equal(view[15], level.data.tiles[15]);
    assertSnapshotParity(level);
    level.data.tiles = level.data.tiles.map(row => [...row]);
    assertSnapshotParity(level);
});

test('temporary gaps expire and reset restores direct sharing', () => {
    const level = levelFor();
    level.removeTileTemporarily(4, 14, 1000);
    level.updateDynamicTiles(999);
    assert.equal(level.getRenderTiles()[14][4], T.EMPTY);
    assertSnapshotParity(level);
    level.updateDynamicTiles(1);
    assert.equal(level.getRenderTiles(), level.data.tiles);
    level.removeTileTemporarily(4, 14, 1000);
    level.setTile(8, 14, T.PLATFORM_FALLING);
    level.markFallingPlatformContact(8, 14);
    level.reset();
    assert.equal(level.getRenderTiles(), level.data.tiles);
    assertSnapshotParity(level);
});

test('all falling-platform phases remain hidden from terrain until respawn', () => {
    const level = levelFor();
    level.setTile(8, 14, T.PLATFORM_FALLING);
    level.markFallingPlatformContact(8, 14);
    for (const [elapsed, phase] of [[0, 'contact'], [FALLING_PLATFORM_MIN_CONTACT_MS, 'arming'],
        [FALLING_PLATFORM_ARM_MS, 'falling'], [FALLING_PLATFORM_FALL_MS, 'cooldown']] as const) {
        if (elapsed) level.updateFallingPlatforms(elapsed);
        assert.equal(level.getRenderTiles()[14][8], T.EMPTY, phase);
        assert.equal(level.getFallingPlatformRenderData()[0]?.phase, phase === 'cooldown' ? undefined : phase);
        assertSnapshotParity(level);
    }
    level.updateFallingPlatforms(FALLING_PLATFORM_RESPAWN_MS);
    assert.equal(level.getRenderTiles(), level.data.tiles);
    assert.equal(level.getRenderTiles()[14][8], T.PLATFORM_FALLING);
    level.markFallingPlatformContact(8, 14);
    level.clearFallingPlatformTouches();
    level.updateFallingPlatforms(1);
    assert.equal(level.getRenderTiles(), level.data.tiles, 'Abandoned contact also releases the mask.');
});

test('mutable snapshots retain independent rows before and after masks', () => {
    const level = levelFor();
    for (const masked of [false, true]) {
        if (masked) level.removeTileTemporarily(4, 14, 1000);
        const first = level.getModifiedTiles(), second = level.getModifiedTiles();
        const before = structuredClone(level.data.tiles);
        assert.notEqual(first, second);
        first.forEach((row, index) => {
            assert.notEqual(row, second[index]);
            assert.notEqual(row, level.data.tiles[index]);
        });
        first[14][5] = T.ICE;
        first[0].push(T.ICE);
        assert.deepEqual(level.data.tiles, before);
        assert.deepEqual(second, level.getRenderTiles());
    }
});

type PaintCall = { name: string; args: unknown[]; color: string };
function recordingContext() {
    const calls: PaintCall[] = [];
    const c = { fillStyle: '', imageSmoothingEnabled: false,
        fillRect(...args: number[]) { calls.push({ name: 'fillRect', args, color: c.fillStyle }); },
        drawImage(...args: unknown[]) { calls.push({ name: 'drawImage', args, color: c.fillStyle }); } };
    return { context: c as unknown as CanvasRenderingContext2D, calls };
}

test('World terrain retains exact paint commands across cameras, masks and edits', t => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
        createElement: () => ({ width: 0, height: 0, getContext: () => recordingContext().context })
    } });
    t.after(() => {
        if (previous) Object.defineProperty(globalThis, 'document', previous);
        else Reflect.deleteProperty(globalThis, 'document');
    });
    for (const id of ['1-1', '4-4']) {
        const level = levelFor(id), island = ISLANDS[Number(id[0]) - 1];
        const changes = [
            () => {},
            () => level.removeTileTemporarily(4, 14, 1000),
            () => { level.setTile(8, 14, T.PLATFORM_FALLING); level.markFallingPlatformContact(8, 14); },
            () => { level.setTile(9, 14, T.ICE); level.data.tiles[14][10] = T.ICE; },
            () => level.updateFallingPlatforms(FALLING_PLATFORM_MIN_CONTACT_MS),
            () => level.updateFallingPlatforms(FALLING_PLATFORM_ARM_MS),
            () => level.updateFallingPlatforms(FALLING_PLATFORM_FALL_MS),
            () => { level.updateDynamicTiles(1000); level.updateFallingPlatforms(FALLING_PLATFORM_RESPAWN_MS); },
            () => level.reset(),
        ];
        for (const change of changes) {
            change();
            const sourceBefore = structuredClone(level.data.tiles);
            for (const [cx, cy] of [[0, 80], [128, 40], [197, 65]]) {
                const reference = recordingContext(), actual = recordingContext(), renderTiles = level.getRenderTiles;
                try {
                    level.getRenderTiles = () => level.getModifiedTiles();
                    drawWorldTerrain(reference.context, level, island, cx, cy, 1250);
                } finally { level.getRenderTiles = renderTiles; }
                drawWorldTerrain(actual.context, level, island, cx, cy, 1250);
                assert.deepEqual(actual.calls, reference.calls, `${id} camera ${cx},${cy}`);
            }
            assert.deepEqual(level.data.tiles, sourceBefore, 'Painting never mutates gameplay terrain.');
            assertSnapshotParity(level);
        }
    }
});
