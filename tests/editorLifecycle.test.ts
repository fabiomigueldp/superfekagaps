import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { EditorController } from '../src/editor/EditorController';
import { EditorHistory } from '../src/editor/EditorHistory';
import { TileType, TILE_SIZE } from '../src/constants';
import { EditorTool, EnemyType, TriggerType, type LevelData } from '../src/types';

function level(id = 'original'): LevelData {
    return { id, name: id, width: 20, height: 15,
        tiles: Array.from({ length: 15 }, () => Array(20).fill(TileType.EMPTY)),
        playerSpawn: { x: 2, y: 2 }, goalPosition: { x: 18, y: 10 },
        enemies: [], collectibles: [], checkpoints: [], triggers: [], timeLimit: 300, isBossLevel: false };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

/** Minimal event surface: asynchronous listeners must not delay DOM bubbling. */
class Element {
    private listeners = new Map<string, Array<(event: any) => unknown>>();
    parent: Element | null = null;
    children: Element[] = [];
    files: unknown[] = [];
    value = '';
    textContent = '';
    innerText = '';
    disabled = false;
    checked = false;
    hidden = false;
    title = '';
    type = '';
    download = '';
    href = '';
    style: Record<string, string> = {};
    dataset: Record<string, string> = {};
    onclick: ((event?: unknown) => unknown) | null = null;
    onchange: ((event?: unknown) => unknown) | null = null;
    classList = {
        names: new Set<string>(),
        contains(name: string) { return this.names.has(name); },
        add(name: string) { this.names.add(name); },
        remove(name: string) { this.names.delete(name); },
        toggle(name: string, enabled?: boolean) {
            const next = enabled ?? !this.names.has(name);
            if (next) this.names.add(name); else this.names.delete(name);
            return next;
        }
    };
    constructor(readonly tagName = 'DIV', private onDownload = (_name: string) => {}) {}
    addEventListener(type: string, listener: (event: any) => unknown) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
    }
    dispatch(type: string, event: Record<string, unknown> = {}): Promise<void> {
        let stopped = false;
        const detail = { target: this, preventDefault() {}, stopPropagation() { stopped = true; }, ...event };
        const pending: unknown[] = [];
        for (let current: Element | null = this; current && !stopped; current = current.parent) {
            for (const listener of current.listeners.get(type) ?? []) pending.push(listener(detail));
            if (type === 'click' && current.onclick) pending.push(current.onclick(detail));
            if (type === 'change' && current.onchange) pending.push(current.onchange(detail));
        }
        return Promise.all(pending).then(() => {});
    }
    click() {
        if (this.tagName === 'A') this.onDownload(this.download);
        return this.dispatch('click');
    }
    appendChild(child: Element) { this.children.push(child); child.parent = this; return child; }
    replaceChildren() { this.children = []; }
    setAttribute() {}
    closest() { return null; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 640, height: 480 }; }
    setPointerCapture() {}
}

function editor(t: TestContext) {
    const elements = new Map<string, Element>();
    const downloads: string[] = [];
    const root = new Element();
    elements.set('editor-ui', root);
    const get = (id: string) => {
        if (!elements.has(id)) {
            const element = new Element();
            element.parent = root;
            elements.set(id, element);
        }
        return elements.get(id)!;
    };
    const logicTab = new Element('BUTTON');
    const windowMock = Object.assign(new Element(), {
        confirm: () => true,
        setTimeout(callback: () => void) { callback(); return 0; }
    });
    const documentMock = {
        getElementById: get,
        querySelectorAll: () => [],
        querySelector: (selector: string) => selector.includes('tab-logic') ? logicTab : null,
        createElement: (tag: string) => new Element(tag.toUpperCase(), name => downloads.push(name)),
        activeElement: null
    };
    for (const [name, value] of [['document', documentMock], ['window', windowMock]] as const) {
        const original = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
        t.after(() => {
            if (original) Object.defineProperty(globalThis, name, original);
            else Reflect.deleteProperty(globalThis, name);
        });
    }

    const controller: any = Object.create(EditorController.prototype);
    const data = level();
    const history = new EditorHistory<LevelData>();
    history.reset(data);
    const errors: unknown[] = [];
    Object.assign(controller, {
        levelData: data, history, documentVersion: 0, loadRequest: 0, boundsResizeStart: null,
        camera: { x: 0, y: 0 }, zoom: 1, canvas: new Element('CANVAS'),
        activeTool: EditorTool.BRUSH, activeContent: { type: 'TILE', id: TileType.BRICK },
        activeSelection: null, isDragging: false, isResizingBounds: false, isCtrlPressed: false,
        showBounds: true, EDGE_THRESHOLD: 8, lastMousePos: { x: 0, y: 0 }, currentWorldMouse: { x: 0, y: 0 },
        saving: false, mountedFile: false, currentLevelFilename: 'original.ts',
        updateStatusBar() {}, updateDocumentUI() {}, updateBoundsUI() {}, updateInspector() {},
        populateThemeEditor() {}, updateTheme() {}, fitLevelToScreen() {}, showMessage() {},
        showError(error: unknown) { errors.push(error); },
        fs: { isSupported: true, isMounted: false, listLevels: async () => [] }
    });
    const fields = {
        uiMountBtn: 'btn-mount', uiSaveBtn: 'btn-save', uiLevelList: 'level-list', uiShowBgChk: 'chk-show-bg',
        uiBoundsWidth: 'bounds-width', uiBoundsHeight: 'bounds-height', uiShowBoundsChk: 'chk-show-bounds',
        uiDimOutsideChk: 'chk-dim-outside', uiZoomLabel: 'zoom-level'
    };
    for (const [field, id] of Object.entries(fields)) controller[field] = get(id);
    return { controller, get, logicTab, downloads, errors };
}

function pointer(x: number, y: number): any {
    return { clientX: x, clientY: y, button: 0, buttons: 1, preventDefault() {} };
}

test('import survives its change event bubbling through the editor before file reading finishes', async t => {
    const { controller: e, get, errors } = editor(t);
    e.bindEvents();
    const content = deferred<string>();
    const input = get('level-import');
    input.files = [{ name: 'imported.json', text: () => content.promise }];
    input.value = 'imported.json';
    const loading = input.dispatch('change');
    assert.equal(e.documentVersion, 0, 'an unchanged bubbling field event is not a document edit');
    content.resolve(JSON.stringify(level('imported')));
    await loading;
    assert.deepEqual(errors, []);
    assert.equal(e.levelData.id, 'imported');
    assert.equal(e.currentLevelFilename, 'imported.json');
    assert.equal(input.value, '');
});

test('mounting another directory exports the current document instead of overwriting a same-named file there', async t => {
    const { controller: e, get, downloads, errors } = editor(t);
    const writes: string[] = [];
    let directory = 'old-folder';
    e.mountedFile = true;
    e.fs = {
        isSupported: true, isMounted: true,
        async mount() { directory = 'new-folder'; return true; },
        async listLevels() { return []; },
        async saveLevel(filename: string) { writes.push(`${directory}/${filename}`); }
    };
    e.bindEvents();
    await get('btn-mount').dispatch('click');
    await e.save();
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    assert.deepEqual(downloads, ['original.ts']);
    assert.equal(e.mountedFile, false);
});

test('the last requested level wins even when an earlier read finishes first', async t => {
    const { controller: e, get, errors } = editor(t);
    const first = deferred<LevelData>();
    const last = deferred<LevelData>();
    e.fs = {
        isSupported: true, isMounted: true,
        listLevels: async () => ['first.ts', 'last.ts'],
        readLevel: (filename: string) => filename === 'first.ts' ? first.promise : last.promise
    };
    await e.refreshLevelList();
    const [firstButton, lastButton] = get('level-list').children;
    const firstLoading = firstButton.dispatch('click');
    const lastLoading = lastButton.dispatch('click');
    first.resolve(level('first'));
    await firstLoading;
    assert.equal(e.levelData.id, 'original', 'an obsolete read must not replace the active document');
    last.resolve(level('last'));
    await lastLoading;
    assert.deepEqual(errors, []);
    assert.equal(e.levelData.id, 'last');
    assert.equal(e.currentLevelFilename, 'last.ts');
});

test('shrinking and expanding a boundary in one gesture restores tiles from the gesture start', t => {
    const { controller: e } = editor(t);
    e.activeTool = EditorTool.SELECT;
    e.levelData.tiles[4][18] = TileType.BRICK;
    e.history.reset(e.levelData);
    e.onMouseDown(pointer(20 * TILE_SIZE, 4 * TILE_SIZE));
    e.onMouseMove(pointer(11 * TILE_SIZE, 4 * TILE_SIZE));
    assert.equal(e.levelData.width, 12);
    e.onMouseMove(pointer(19 * TILE_SIZE, 4 * TILE_SIZE));
    e.onMouseUp({});
    assert.equal(e.levelData.width, 20);
    assert.equal(e.levelData.tiles[4][18], TileType.BRICK);
});

test('tile editing neither erases nor selects an invisible logic region', t => {
    const { controller: e, logicTab } = editor(t);
    const trigger = { id: 'hidden-zone', type: TriggerType.DIALOG, x: 96, y: 96,
        width: 32, height: 32, active: true, oneShot: false, text: 'Hello' };
    e.levelData.triggers.push(trigger);
    e.levelData.tiles[6][6] = TileType.BRICK;
    e.activeTool = EditorTool.ERASER;
    e.onMouseDown(pointer(104, 104)); e.onMouseUp({});
    assert.equal(e.levelData.triggers.length, 1);
    assert.equal(e.levelData.tiles[6][6], TileType.EMPTY);
    e.activeTool = EditorTool.SELECT;
    e.onMouseDown(pointer(104, 104)); e.onMouseUp({});
    assert.equal(e.activeSelection, null);
    logicTab.classList.add('active');
    e.activeTool = EditorTool.ERASER;
    e.onMouseDown(pointer(104, 104)); e.onMouseUp({});
    assert.equal(e.levelData.triggers.length, 0, 'visible logic regions remain erasable');
});

test('erasing a selected enemy clears its detached selection and inspector', t => {
    const { controller: e } = editor(t);
    const enemy = { type: EnemyType.MINION, position: { x: 6, y: 6 } };
    e.levelData.enemies.push(enemy);
    e.activeTool = EditorTool.SELECT;
    e.onMouseDown(pointer(104, 104)); e.onMouseUp({});
    assert.equal(e.activeSelection?.data, enemy);
    e.activeTool = EditorTool.ERASER;
    let inspectorRefreshes = 0;
    e.updateInspector = () => { inspectorRefreshes++; };
    e.onMouseDown(pointer(104, 104)); e.onMouseUp({});
    assert.equal(e.levelData.enemies.length, 0);
    assert.equal(e.activeSelection, null);
    assert.ok(inspectorRefreshes > 0);
});
