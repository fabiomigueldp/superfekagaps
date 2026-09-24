import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EditorController } from '../src/editor/EditorController';
import { EditorHistory } from '../src/editor/EditorHistory';
import { fitLevelToContent, resizeLevel, screenToWorld } from '../src/editor/editorGeometry';
import { TileType, TILE_SIZE } from '../src/constants';
import { EditorTool, TriggerType, type LevelData } from '../src/types';

function level(): LevelData {
    return { id: 'test', name: 'Test', width: 20, height: 15,
        tiles: Array.from({ length: 15 }, () => Array(20).fill(TileType.EMPTY)),
        playerSpawn: { x: 2, y: 2 }, goalPosition: { x: 18, y: 10 },
        enemies: [], collectibles: [], checkpoints: [], triggers: [], timeLimit: 300, isBossLevel: false };
}

// Exercise real controller events with a CSS-sized canvas, independent of a GPU/browser.
function editor(): any {
    const controller = Object.create(EditorController.prototype);
    const data = level();
    const history = new EditorHistory<LevelData>();
    history.reset(data);
    Object.assign(controller, {
        levelData: data, history, documentVersion: 0,
        camera: { x: -32, y: -16 }, zoom: 2,
        canvas: { width: 1800, height: 900, style: {},
            getBoundingClientRect: () => ({ left: 40, top: 76, width: 900, height: 450 }) },
        activeTool: EditorTool.BRUSH, activeContent: { type: 'TILE', id: TileType.BRICK },
        activeSelection: null, isDragging: false, isResizingBounds: false,
        isCtrlPressed: false, showBounds: true, EDGE_THRESHOLD: 8,
        lastMousePos: { x: 0, y: 0 }, currentWorldMouse: { x: 0, y: 0 },
        updateStatusBar() {}, updateDocumentUI() {}, updateBoundsUI() {}, updateInspector() {},
        isLogicMode: () => true,
        uiZoomLabel: { innerText: '' }
    });
    return controller;
}

function pointer(controller: any, x: number, y: number, button = 0, buttons = 1): any {
    return { clientX: 40 + (x - controller.camera.x) * controller.zoom,
        clientY: 76 + (y - controller.camera.y) * controller.zoom,
        button, buttons, preventDefault() {} };
}

test('CSS pointer coordinates match the rendered world at arbitrary zoom and DPR', () => {
    assert.deepEqual(screenToWorld({ x: 240, y: 80 }, { x: -32, y: 16 }, 2), { x: 88, y: 56 });
    const e = editor();
    e.onMouseDown(pointer(e, 3 * TILE_SIZE + 4, 4 * TILE_SIZE + 4));
    e.onMouseUp({});
    assert.equal(e.levelData.tiles[4][3], TileType.BRICK);
    assert.equal(e.levelData.tiles[2][1], TileType.EMPTY);
});

test('brush reaches boundary tiles without resizing the map', () => {
    const e = editor();
    e.onMouseDown(pointer(e, 1, 1)); e.onMouseUp({});
    assert.equal(e.levelData.tiles[0][0], TileType.BRICK);
    assert.equal(e.levelData.width, 20);
    assert.equal(e.levelData.originX, undefined);
});

test('a quick brush stroke fills intermediate tiles and undoes as a single gesture', () => {
    const e = editor();
    e.onMouseDown(pointer(e, 40, 40));
    e.onMouseMove(pointer(e, 152, 40));
    e.onMouseUp({});
    for (let col = 2; col <= 9; col++) assert.equal(e.levelData.tiles[2][col], TileType.BRICK);
    assert.equal(e.history.undo().tiles[2][5], TileType.EMPTY);
    assert.equal(e.history.canUndo, false);
});

test('click without pointer movement creates one tile rectangle instead of using stale hover', () => {
    const e = editor();
    e.activeTool = EditorTool.RECTANGLE;
    e.hoveredCol = 19; e.hoveredRow = 14;
    e.onMouseDown(pointer(e, 40, 40)); e.onMouseUp({});
    assert.equal(e.levelData.tiles.flat().filter((v: number) => v === TileType.BRICK).length, 1);
});

test('trigger selection moves world pixels without dereferencing a nonexistent position', () => {
    const e = editor();
    e.activeTool = EditorTool.SELECT;
    const trigger = { id: 'zone', x: 100, y: 100, width: 50, height: 50,
        active: true, oneShot: false, type: TriggerType.DIALOG, text: 'Oi' };
    e.levelData.triggers.push(trigger);
    e.onMouseDown(pointer(e, 108, 108));
    e.onMouseMove(pointer(e, 156, 140)); e.onMouseUp({});
    assert.equal(trigger.x, 144); assert.equal(trigger.y, 128);
    assert.equal(trigger.width, 50);
});

test('wheel zoom retains the world point under the cursor', () => {
    const e = editor();
    const p = pointer(e, 91, 47);
    e.onWheel({ ...p, deltaY: -120 });
    assert.deepEqual(screenToWorld({ x: p.clientX - 40, y: p.clientY - 76 }, e.camera, e.zoom), { x: 91, y: 47 });
});

test('panning does not modify level data or create history entries', () => {
    const e = editor();
    const before = structuredClone(e.levelData);
    e.activeTool = EditorTool.HAND;
    e.onMouseDown(pointer(e, 40, 40));
    e.onMouseMove(pointer(e, 80, 60)); e.onMouseUp({});
    assert.deepEqual(e.levelData, before);
    assert.equal(e.history.canUndo, false);
    assert.equal(e.documentVersion, 0);
    assert.deepEqual(e.camera, { x: -72, y: -36 });
});

test('recording an unchanged DOM field event cannot invalidate asynchronous file import', () => {
    const e = editor();
    e.recordChange();
    assert.equal(e.documentVersion, 0);
    e.levelData.name = 'Changed'; e.recordChange();
    assert.equal(e.documentVersion, 1);
});

test('origin resizing preserves world tiles and entity positions', () => {
    const data = level(); data.tiles[3][2] = TileType.BRICK;
    resizeLevel(data, 25, 20, -5, -5);
    assert.equal(data.tiles[8][7], TileType.BRICK);
    assert.deepEqual(data.playerSpawn, { x: 2, y: 2 });
    assert.equal(data.width, 25); assert.equal(data.height, 20);
});

test('fit includes negative origins, spawn, checkpoints and full trigger rectangle', () => {
    const data = level();
    data.originX = -10; data.originY = -5;
    data.tiles[0][0] = TileType.GROUND;
    data.playerSpawn = { x: -12, y: -7 };
    data.checkpoints = [{ x: 22, y: 18 }];
    data.triggers = [{ id: 'zone', x: 25 * TILE_SIZE, y: 20 * TILE_SIZE,
        width: 3 * TILE_SIZE, height: 2 * TILE_SIZE, type: TriggerType.DIALOG,
        text: 'Oi', active: true, oneShot: false }];
    fitLevelToContent(data);
    assert.equal(data.originX, -12); assert.equal(data.originY, -7);
    assert.equal(data.width, 40); assert.equal(data.height, 29);
    assert.equal(data.tiles[2][2], TileType.GROUND);
});

test('history tracks saved snapshots across undo, redo and divergent edits', () => {
    const h = new EditorHistory<{ value: number }>(3);
    h.reset({ value: 0 });
    h.record({ value: 1 }); h.markSaved({ value: 1 }); h.record({ value: 2 });
    assert.equal(h.isDirty(h.undo()!), false);
    assert.deepEqual(h.redo(), { value: 2 });
    h.undo(); h.record({ value: 3 });
    assert.equal(h.canRedo, false);
    h.record({ value: 4 }); h.record({ value: 5 });
    assert.deepEqual(h.undo(), { value: 4 });
    assert.deepEqual(h.undo(), { value: 3 });
    assert.equal(h.undo(), null);
});

test('canceling pointer capture stops gestures and records already-painted work', () => {
    const e = editor();
    e.onMouseDown(pointer(e, 40, 40)); e.cancelGesture();
    assert.equal(e.isDragging, false);
    assert.equal(e.dragStartTile, null);
    assert.equal(e.history.canUndo, true);
});
