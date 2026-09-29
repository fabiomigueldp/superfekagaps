import { BackgroundLayerSpec, CameraData, LevelData, LevelTheme, Vector2, EnemyType, CollectibleType, EditorTool, PaletteItem, TriggerType, LevelTrigger } from '../types';
import { FileSystemManager } from './FileSystemManager';
import { parseLevelFromText, serializeLevelToTS } from './levelSerialization';
import { CAMPAIGN_LEVELS } from '../data/levels';
import { EditorHistory } from './EditorHistory';
import { screenToWorld, resizeLevel, fitLevelToContent } from './editorGeometry';
import { MUSIC_TRACKS } from '../engine/audioCatalog';
import { TileType, TILE_SIZE, GAME_HEIGHT } from '../constants';
import { MEADOW_THEME } from '../graphics/BackgroundScene';
import { PLAYER_RENDER_OFFSET_X, PLAYER_RENDER_OFFSET_Y } from '../assets/playerSpriteSpec';
import { Renderer } from '../engine/Renderer';
import { ENEMY_SPECS, enemySpawnRect } from '../entities/enemies/enemyCatalog';




export class EditorController {
    public camera: CameraData;
    public fs: FileSystemManager;
    public levelData: LevelData | null = null;
    public activeContent: PaletteItem = { type: 'TILE', id: 1 }; // Default to Ground
    public activeTool: EditorTool = EditorTool.BRUSH;
    public currentLevelFilename: string = '';

    private isCtrlPressed: boolean = false;
    private currentWorldMouse: Vector2 = { x: 0, y: 0 };

    private isDragging: boolean = false;
    private dragStartTile: Vector2 | null = null;
    private lastMousePos: Vector2 = { x: 0, y: 0 };
    private lastPaintPosition: Vector2 | null = null;
    private canvas: HTMLCanvasElement;

    private readonly history = new EditorHistory<LevelData>();
    private saving = false;
    private mountedFile = false;
    private newDocument = false;
    private documentVersion = 0;
    private loadRequest = 0;
    private boundsResizeStart: LevelData | null = null;
    private readonly renderer: Renderer;
    private zoom: number = 1; // Used for visual zoom (Game Resolution -> View)
    private undergroundDraft: LevelTheme['underground'];
    private paletteBiome: LevelTheme['biome'];

    // Bounds Visualization
    private showBounds: boolean = true;
    private dimOutside: boolean = true;
    private boundsColor: string = '#00FFFF'; // Cyan
    private boundsThickness: number = 2;

    // Status Bar UI Elements
    private statusCoords: HTMLSpanElement | null = null;
    private statusWorld: HTMLSpanElement | null = null;
    private statusLevel: HTMLSpanElement | null = null;
    private statusZoom: HTMLSpanElement | null = null;

    // Hover State for coordinates display
    private hoveredCol: number = -1;
    private hoveredRow: number = -1;

    // Bounds Edge Drag State
    private isResizingBounds: boolean = false;
    private activeEdge: 'left' | 'right' | 'top' | 'bottom' | 'corner-br' | 'corner-tl' | null = null;
    private hoveredEdge: 'left' | 'right' | 'top' | 'bottom' | 'corner-br' | 'corner-tl' | null = null;
    private readonly EDGE_THRESHOLD: number = 8; // pixels to detect edge hover

    // Selection State
    private activeSelection: {
        type: 'ENEMY' | 'COLLECTIBLE' | 'SPAWN' | 'CHECKPOINT' | 'GOAL' | 'TRIGGER';
        data: any; // Reference to the actual data object
    } | null = null;
    private selectionDragOffset: { x: number, y: number } = { x: 0, y: 0 };

    // UI Elements
    private uiInspectorContent: HTMLDivElement;
    private uiMountBtn: HTMLButtonElement;
    private uiSaveBtn: HTMLButtonElement;
    private uiLevelList: HTMLDivElement;
    private uiPalette: HTMLDivElement;
    private uiLogicPalette: HTMLDivElement;
    private uiFileLabel: HTMLSpanElement;
    private uiShowBgChk: HTMLInputElement;
    private uiZoomLabel: HTMLSpanElement;
    private uiBoundsWidth: HTMLInputElement;
    private uiBoundsHeight: HTMLInputElement;
    private uiShowBoundsChk: HTMLInputElement;
    private uiDimOutsideChk: HTMLInputElement;
    private uiBoundsInfoSize: HTMLSpanElement;
    private uiBoundsInfoPixels: HTMLSpanElement;

    constructor(canvas: HTMLCanvasElement, renderer: Renderer) {
        this.renderer = renderer;
        this.canvas = canvas;
        this.fs = new FileSystemManager();

        this.levelData = this.createBlankLevel();

        // Initialize fully compliant CameraData
        this.camera = {
            x: 0,
            y: 0,
            targetX: 0,
            targetY: 0,
            shakeTimer: 0,
            shakeMagnitude: 0,
            bounds: {
                minX: 0,
                maxX: 1000 * TILE_SIZE,
                minY: 0,
                maxY: GAME_HEIGHT
            }
        };

        // UI Binding
        this.uiMountBtn = document.getElementById('btn-mount') as HTMLButtonElement;
        this.uiSaveBtn = document.getElementById('btn-save') as HTMLButtonElement;
        this.uiLevelList = document.getElementById('level-list') as HTMLDivElement;
        this.uiPalette = document.getElementById('tile-palette') as HTMLDivElement;
        this.uiLogicPalette = document.getElementById('logic-palette') as HTMLDivElement;
        this.uiFileLabel = document.getElementById('current-file-label') as HTMLSpanElement;
        this.uiShowBgChk = document.getElementById('chk-show-bg') as HTMLInputElement;
        this.uiZoomLabel = document.getElementById('zoom-level') as HTMLSpanElement;

        // Bounds UI Elements
        this.uiBoundsWidth = document.getElementById('bounds-width') as HTMLInputElement;
        this.uiBoundsHeight = document.getElementById('bounds-height') as HTMLInputElement;
        this.uiShowBoundsChk = document.getElementById('chk-show-bounds') as HTMLInputElement;
        this.uiDimOutsideChk = document.getElementById('chk-dim-outside') as HTMLInputElement;
        this.uiBoundsInfoSize = document.getElementById('bounds-info-size') as HTMLSpanElement;
        this.uiBoundsInfoPixels = document.getElementById('bounds-info-pixels') as HTMLSpanElement;

        // Inspector UI
        this.uiInspectorContent = document.getElementById('inspector-content') as HTMLDivElement;

        // Status Bar Elements
        this.statusCoords = document.querySelector('.status-coords');
        this.statusWorld = document.querySelector('.status-world');
        this.statusLevel = document.querySelector('.status-level');
        this.statusZoom = document.querySelector('.status-zoom');

        this.history.reset(this.levelData);
        this.bindEvents();
        this.buildPalette();
        this.buildLogicPalette();
        this.updateBoundsUI();
    }

    private createBlankLevel(): LevelData {
        return {
            id: 'new_level',
            name: 'New Level',
            width: 100,  // in tiles
            height: 15,  // in tiles
            tiles: Array(15).fill(0).map((_, row) =>
                Array(100).fill(row >= 13 ? TileType.GROUND : TileType.EMPTY)
            ),
            playerSpawn: { x: 2, y: 11 },
            enemies: [],
            collectibles: [],
            checkpoints: [],
            triggers: [],
            goalPosition: { x: 95, y: 11 },
            timeLimit: 300,
            isBossLevel: false
        };
    }

    private bindEvents() {
        // ... (Canvas events preserved via logic, but overwriting block method)
        this.canvas.addEventListener('pointerdown', e => {
            this.canvas.setPointerCapture(e.pointerId);
            this.onMouseDown(e);
        });
        this.canvas.addEventListener('pointermove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('pointerup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('pointercancel', () => this.cancelGesture());
        this.canvas.addEventListener('lostpointercapture', () => this.cancelGesture());
        this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
        window.addEventListener('blur', () => { this.isCtrlPressed = false; this.cancelGesture(); });
        window.addEventListener('beforeunload', e => {
            if (this.levelData && this.history.isDirty(this.levelData)) { e.preventDefault(); e.returnValue = ''; }
        });
        document.getElementById('editor-ui')?.addEventListener('change', () => this.recordChange());
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());

        this.uiMountBtn.disabled = !this.fs.isSupported;
        if (!this.fs.isSupported) this.uiMountBtn.title = 'Use Importar arquivo neste navegador.';
        this.uiMountBtn.addEventListener('click', async () => {
            if (this.saving) return;
            try {
                if (await this.fs.mount()) {
                    this.loadRequest++;
                    // A document belongs to the directory it was read from.
                    this.mountedFile = false;
                    this.updateDocumentUI();
                    await this.refreshLevelList();
                    this.selectTab('tab-levels');
                    this.showMessage('Pasta aberta. Selecione um arquivo para editar.');
                }
            } catch (error) { this.showError(error); }
        });
        this.uiSaveBtn.addEventListener('click', () => void this.save());
        document.getElementById('btn-export')?.addEventListener('click', () => void this.save(true));
        document.getElementById('btn-import')?.addEventListener('click', () =>
            document.getElementById('level-import')?.click());
        document.getElementById('level-import')?.addEventListener('change', async e => {
            const input = e.target as HTMLInputElement;
            const file = input.files?.[0];
            const version = this.documentVersion;
            const request = ++this.loadRequest;
            try {
                if (file) {
                    const data = parseLevelFromText(await file.text());
                    if (request === this.loadRequest && version === this.documentVersion && this.canReplaceDocument()) this.loadLevel(data, file.name, false);
                }
            } catch (error) { this.showError(error); }
            input.value = '';
        });
        document.getElementById('btn-undo')?.addEventListener('click', () => this.restoreHistory(false));
        document.getElementById('btn-redo')?.addEventListener('click', () => this.restoreHistory(true));
        document.getElementById('btn-fit-view')?.addEventListener('click', () => this.fitLevelToScreen());
        document.getElementById('btn-new-level')?.addEventListener('click', () => {
            if (this.canReplaceDocument()) this.loadLevel(this.createBlankLevel(), 'new_level.ts', false, true);
        });
        for (const [id, key] of [['level-id', 'id'], ['level-name', 'name']] as const) {
            document.getElementById(id)?.addEventListener('change', event => {
                if (!this.levelData) return;
                const input = event.target as HTMLInputElement;
                const value = input.value.trim();
                if (value) this.levelData[key] = value;
                else input.value = this.levelData[key];
            });
        }
        document.getElementById('level-time-limit')?.addEventListener('change', event => {
            if (!this.levelData) return;
            const input = event.target as HTMLInputElement;
            const value = Number(input.value);
            if (input.value.trim() && Number.isFinite(value) && value > 0) this.levelData.timeLimit = value;
            else input.value = String(this.levelData.timeLimit);
        });
        document.getElementById('level-is-boss')?.addEventListener('change', event => {
            if (this.levelData) this.levelData.isBossLevel = (event.target as HTMLInputElement).checked;
        });

        // Tab Switching Logic
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                // Deactivate all
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                // Activate clicked
                btn.classList.add('active');
                const target = (btn as HTMLElement).dataset.tab;
                if (target) {
                    document.getElementById(target)?.classList.add('active');
                }
            });
        });

        // Show BG Toggle
        if (this.uiShowBgChk) {
            this.uiShowBgChk.addEventListener('change', () => {
                // Render loop will pick up the change automatically
            });
        }


        // Add Layer Button
        document.getElementById('btn-add-layer')?.addEventListener('click', () => {
            if (!this.levelData) return;
            if (!this.levelData.theme) this.ensureTheme();

            this.levelData.theme!.layers.push({
                type: 'mountains',
                color: '#555555',
                scrollFactor: 0.5
            });
            this.populateThemeEditor();
            this.updateTheme();
            this.recordChange();
        });

        // Sky Inputs
        document.getElementById('theme-biome')?.addEventListener('change', e => {
            if (!this.levelData) return;
            this.ensureTheme();
            const biome = (e.target as HTMLSelectElement).value;
            if (biome !== 'meadow' && biome !== 'ember' && biome !== 'citadel') return;
            this.levelData.theme!.biome = biome;
            this.updateTheme();
            this.recordChange();
        });
        document.getElementById('theme-sky-top')?.addEventListener('input', (e) => {
            if (!this.levelData) return;
            this.ensureTheme();
            this.levelData.theme!.skyGradient[0] = (e.target as HTMLInputElement).value;
            // No need to regenerate background for sky, as it is drawn every frame in render()
            // BUT `prepareLevelBackground` generates the offscreen layers.
        });
        document.getElementById('theme-sky-bottom')?.addEventListener('input', (e) => {
            if (!this.levelData) return;
            this.ensureTheme();
            this.levelData.theme!.skyGradient[1] = (e.target as HTMLInputElement).value;
        });

        document.getElementById('theme-underground-enabled')?.addEventListener('change', (e) => {
            if (!this.levelData) return;
            this.ensureTheme();
            const theme = this.levelData.theme!;
            if ((e.target as HTMLInputElement).checked) {
                theme.underground = this.undergroundDraft ?? {
                    startRow: (this.levelData.originY ?? 0) + Math.floor(this.levelData.height * 0.55),
                    skyGradient: ['#17283d', '#07111f'],
                    layers: [
                        { type: 'cavern', color: '#29465a', scrollFactor: 0.18 },
                        { type: 'crystals', color: '#69d6d4', scrollFactor: 0.45 }
                    ]
                };
            } else {
                this.undergroundDraft = theme.underground;
                delete theme.underground;
            }
            this.populateThemeEditor();
            this.updateTheme();
        });

        document.getElementById('theme-underground-start-row')?.addEventListener('change', e => {
            const underground = this.levelData?.theme?.underground;
            if (!underground) return;
            const input = e.target as HTMLInputElement;
            const value = Number(input.value);
            const min = this.levelData?.originY ?? 0;
            const max = min + (this.levelData?.height ?? 0) - 1;
            if (Number.isInteger(value) && value >= min && value <= max) {
                underground.startRow = value;
                this.updateTheme();
            } else {
                input.value = String(underground.startRow);
            }
        });
        for (const [id, index] of [['theme-underground-top', 0], ['theme-underground-bottom', 1]] as const) {
            document.getElementById(id)?.addEventListener('input', e => {
                const underground = this.levelData?.theme?.underground;
                if (underground) underground.skyGradient[index] = (e.target as HTMLInputElement).value;
            });
        }
        document.getElementById('btn-add-underground-layer')?.addEventListener('click', () => {
            const underground = this.levelData?.theme?.underground;
            if (!underground) return;
            underground.layers.push({ type: 'cavern', color: '#31566c', scrollFactor: 0.35 });
            this.populateThemeEditor();
            this.updateTheme();
            this.recordChange();
        });

        // ===== BOUNDS CONTROLS =====

        // Width/Height direct input
        this.uiBoundsWidth?.addEventListener('change', () => {
            if (!this.levelData) return;
            const newWidth = Math.max(10, Math.min(500, parseInt(this.uiBoundsWidth.value) || 100));
            this.resizeTileGrid(newWidth, this.levelData.tiles.length);
        });

        this.uiBoundsHeight?.addEventListener('change', () => {
            if (!this.levelData) return;
            const newHeight = Math.max(5, Math.min(100, parseInt(this.uiBoundsHeight.value) || 14));
            this.resizeTileGrid(this.levelData.tiles[0]?.length || 100, newHeight);
        });

        // Increment/Decrement buttons
        document.querySelectorAll('.number-input-group .mini-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = (btn as HTMLElement).dataset.target;
                if (!target) return;
                const input = document.getElementById(target) as HTMLInputElement;
                if (!input) return;

                const isIncrement = btn.classList.contains('increment');
                const step = target === 'bounds-width' ? 5 : 1;
                const min = parseInt(input.min) || 1;
                const max = parseInt(input.max) || 500;
                let value = parseInt(input.value) || 0;

                value = isIncrement ? Math.min(max, value + step) : Math.max(min, value - step);
                input.value = value.toString();
                input.dispatchEvent(new Event('change'));
            });
        });

        // Visualization checkboxes
        this.uiShowBoundsChk?.addEventListener('change', () => {
            this.showBounds = this.uiShowBoundsChk.checked;
        });

        this.uiDimOutsideChk?.addEventListener('change', () => {
            this.dimOutside = this.uiDimOutsideChk.checked;
        });

        // Action buttons
        document.getElementById('btn-fit-content')?.addEventListener('click', () => {
            try { this.fitToContent(); } catch (error) { this.showError(error); }
        });

        // Key modifiers
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Control') this.isCtrlPressed = true;
            if ((e.target as HTMLElement)?.closest('input, textarea, select, [contenteditable="true"]')) return;
            const key = e.key.toLowerCase();
            if (e.ctrlKey || e.metaKey) {
                if (key === 's') { e.preventDefault(); void this.save(); }
                if (key === 'z' || key === 'y') {
                    e.preventDefault(); this.restoreHistory(key === 'y' || e.shiftKey);
                }
                return;
            }
            const shortcuts: Record<string, EditorTool> = { b: EditorTool.BRUSH, e: EditorTool.ERASER,
                s: EditorTool.SELECT, r: EditorTool.RECTANGLE, h: EditorTool.HAND };
            if (shortcuts[key]) { e.preventDefault(); this.setTool(shortcuts[key]); }
            if (key === 'f') { e.preventDefault(); this.fitLevelToScreen(); }

            // Deletion Logic
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.activeSelection) {
                // Prevent deletion if editing inspector inputs
                if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                    return;
                }

                if (!this.levelData) return;
                const sel = this.activeSelection;
                let deleted = false;

                if (sel.type === 'TRIGGER' && this.levelData.triggers) {
                    this.levelData.triggers = this.levelData.triggers.filter(t => t !== sel.data);
                    deleted = true;
                }
                else if (sel.type === 'ENEMY' && this.levelData.enemies) {
                    this.levelData.enemies = this.levelData.enemies.filter(en => en !== sel.data);
                    if (sel.data.type === EnemyType.JOAOZAO) {
                        this.levelData.isBossLevel = false;
                        (document.getElementById('level-is-boss') as HTMLInputElement).checked = false;
                    }
                    deleted = true;
                }
                else if (sel.type === 'COLLECTIBLE' && this.levelData.collectibles) {
                    this.levelData.collectibles = this.levelData.collectibles.filter(c => c !== sel.data);
                    deleted = true;
                }
                else if (sel.type === 'CHECKPOINT') {
                    this.levelData.checkpoints = this.levelData.checkpoints.filter(cp => cp !== sel.data);
                    deleted = true;
                }

                if (deleted) {
                    this.activeSelection = null;
                    this.updateInspector();
                    e.preventDefault();
                    this.recordChange();
                }
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.key === 'Control') this.isCtrlPressed = false;
        });
    }

    private selectTab(tabId: string) {
        const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`) as HTMLElement;
        if (btn) btn.click();
    }

    private ensureTheme() {
        if (!this.levelData) return;
        if (!this.levelData.theme) {
            this.levelData.theme = {
                biome: 'meadow',
                skyGradient: [...MEADOW_THEME.skyGradient],
                layers: MEADOW_THEME.layers.map(layer => ({ ...layer }))
            };
        }
    }

    private updateTheme() {
        const renderer = this.renderer;
        if (renderer && this.levelData && this.levelData.theme) {
            renderer.prepareLevelBackground(this.levelData.theme);
            const biome = this.levelData.theme.biome ?? 'meadow';
            if (this.paletteBiome !== biome) {
                this.paletteBiome = biome;
                this.buildPalette();
            }
        }
    }

    // ===== BOUNDS MANAGEMENT METHODS =====

    private updateBoundsUI(): void {
        if (!this.levelData) return;

        const width = this.levelData.tiles[0]?.length || 100;
        const height = this.levelData.tiles.length;
        const originX = this.levelData.originX ?? 0;
        const originY = this.levelData.originY ?? 0;

        // Update input fields
        if (this.uiBoundsWidth) this.uiBoundsWidth.value = width.toString();
        if (this.uiBoundsHeight) this.uiBoundsHeight.value = height.toString();
        const undergroundStartInput = document.getElementById('theme-underground-start-row') as HTMLInputElement | null;
        if (undergroundStartInput) {
            undergroundStartInput.min = String(originY);
            undergroundStartInput.max = String(originY + height - 1);
        }

        // Update info display
        if (this.uiBoundsInfoSize) {
            const originInfo = (originX !== 0 || originY !== 0)
                ? ` @ (${originX}, ${originY})`
                : '';
            this.uiBoundsInfoSize.textContent = `Size: ${width} × ${height} tiles${originInfo}`;
        }
        if (this.uiBoundsInfoPixels) {
            this.uiBoundsInfoPixels.textContent = `${width * TILE_SIZE} × ${height * TILE_SIZE} px`;
        }

        // Sync width/height in LevelData
        this.levelData.width = width;
        this.levelData.height = height;

        // Also update status bar
        this.updateStatusBar();
    }

    private resizeTileGrid(newWidth: number, newHeight: number): void {
        if (!this.levelData) return;
        resizeLevel(this.levelData, newWidth, newHeight);
        this.updateBoundsUI();
        if (!this.isDragging) this.recordChange();
    }

    private fitToContent(): void {
        if (!this.levelData) return;
        fitLevelToContent(this.levelData);
        this.updateBoundsUI();
        this.recordChange();
        this.fitLevelToScreen();
    }

    private populateThemeEditor() {
        if (!this.levelData) return;
        this.ensureTheme();
        const theme = this.levelData.theme!;

        const biomeInput = document.getElementById('theme-biome') as HTMLSelectElement | null;
        if (biomeInput) biomeInput.value = theme.biome ?? 'meadow';

        (document.getElementById('theme-sky-top') as HTMLInputElement).value = this.colorForInput(theme.skyGradient[0]);
        (document.getElementById('theme-sky-bottom') as HTMLInputElement).value = this.colorForInput(theme.skyGradient[1]);
        this.populateLayerList('theme-layers-list', theme.layers);

        const underground = theme.underground;
        (document.getElementById('theme-underground-enabled') as HTMLInputElement).checked = !!underground;
        (document.getElementById('theme-underground-controls') as HTMLDivElement).hidden = !underground;
        if (!underground) return;
        const startInput = document.getElementById('theme-underground-start-row') as HTMLInputElement;
        startInput.min = String(this.levelData.originY ?? 0);
        startInput.max = String((this.levelData.originY ?? 0) + this.levelData.height - 1);
        startInput.value = String(underground.startRow);
        (document.getElementById('theme-underground-top') as HTMLInputElement).value = this.colorForInput(underground.skyGradient[0]);
        (document.getElementById('theme-underground-bottom') as HTMLInputElement).value = this.colorForInput(underground.skyGradient[1]);
        this.populateLayerList('theme-underground-layers-list', underground.layers);
    }

    private colorForInput(color: string): string {
        // A color picker cannot represent alpha; display the RGB swatch without
        // changing the original rgba() value until the user edits that field.
        const context = document.createElement('canvas').getContext('2d')!;
        context.fillStyle = color;
        const normalized = context.fillStyle;
        if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized;
        const rgb = normalized.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (rgb) return `#${rgb.slice(1, 4).map(component => Number(component).toString(16).padStart(2, '0')).join('')}`;
        return '#ffffff';
    }

    private populateLayerList(id: string, layers: BackgroundLayerSpec[]): void {
        const list = document.getElementById(id)!;
        list.replaceChildren();
        const layerTypes: { value: BackgroundLayerSpec['type']; label: string }[] = [
            { value: 'mountains', label: 'Montanhas' },
            { value: 'hills', label: 'Colinas' },
            { value: 'clouds', label: 'Nuvens' },
            { value: 'city', label: 'Cidade' },
            { value: 'castle_wall', label: 'Muralha' },
            { value: 'cavern', label: 'Caverna' },
            { value: 'crystals', label: 'Cristais' }
        ];
        layers.forEach((layer, index) => {
            const div = document.createElement('div');
            div.className = 'layer-item';
            const options = layerTypes.map(type =>
                `<option value="${type.value}" ${layer.type === type.value ? 'selected' : ''}>${type.label}</option>`
            ).join('');
            div.innerHTML = `
                <div class="control-row">
                    <label for="${id}-type-${index}">Tipo</label>
                    <select class="layer-type" id="${id}-type-${index}">${options}</select>
                    <button class="mini-btn remove" type="button" title="Remover camada" aria-label="Remover camada ${index + 1}">×</button>
                </div>
                <div class="control-row">
                    <label for="${id}-color-${index}">Cor</label>
                    <input type="color" class="layer-color" id="${id}-color-${index}">
                </div>
                <div class="control-row">
                    <label for="${id}-scroll-${index}">Paralaxe</label>
                    <input type="range" class="layer-scroll" id="${id}-scroll-${index}" min="0" max="1" step="0.01" value="${layer.scrollFactor}">
                    <output>${layer.scrollFactor.toFixed(2)}</output>
                </div>
            `;
            const color = div.querySelector<HTMLInputElement>('.layer-color')!;
            color.value = this.colorForInput(layer.color);
            div.querySelector<HTMLSelectElement>('.layer-type')!.addEventListener('change', event => {
                layer.type = (event.target as HTMLSelectElement).value as BackgroundLayerSpec['type'];
                this.updateTheme();
            });
            color.addEventListener('input', event => {
                layer.color = (event.target as HTMLInputElement).value;
                this.updateTheme();
            });
            div.querySelector<HTMLInputElement>('.layer-scroll')!.addEventListener('input', event => {
                layer.scrollFactor = Number((event.target as HTMLInputElement).value);
                div.querySelector('output')!.value = layer.scrollFactor.toFixed(2);
                // The renderer keeps a reference to the layer specification.
            });
            div.querySelector<HTMLButtonElement>('.remove')!.addEventListener('click', () => {
                layers.splice(index, 1);
                this.populateThemeEditor();
                this.updateTheme();
                this.recordChange();
            });
            list.appendChild(div);
        });
    }

    private buildPalette() {
        this.uiPalette.innerHTML = '';

        type UIItem = PaletteItem & { label: string };

        // 1. Define Palette Items
        const items: UIItem[] = [
            // --- TOOLS / SPECIAL TILES ---
            { type: 'TILE', id: TileType.EMPTY, label: 'Erase' }, // Acts as Eraser for tiles if clicked, but we have a tool now. Keep for compatibility? Or just 'Empty Air'. 

            // --- STANDARD TILES ---
            { type: 'TILE', id: TileType.GROUND, label: 'Ground' },
            { type: 'TILE', id: TileType.BRICK, label: 'Brick' },
            { type: 'TILE', id: TileType.BRICK_BREAKABLE, label: 'Break' },
            { type: 'TILE', id: TileType.PLATFORM, label: 'Plat' },
            { type: 'TILE', id: TileType.PLATFORM_FALLING, label: 'Fall' },
            { type: 'TILE', id: TileType.SPIKE, label: 'Spike' },
            { type: 'TILE', id: TileType.ICE, label: 'Ice' },
            { type: 'TILE', id: TileType.SPRING, label: 'Spring' },
            { type: 'TILE', id: TileType.LAVA_TOP, label: 'Lava Top' },
            { type: 'TILE', id: TileType.LAVA_FILL, label: 'Lava Fill' },
            { type: 'TILE', id: TileType.HIDDEN_BLOCK, label: 'Hidden' },
            { type: 'TILE', id: TileType.CAVE_STONE, label: 'Rocha' },
            { type: 'TILE', id: TileType.CAVE_PLATFORM, label: 'Saliente' },
            { type: 'TILE', id: TileType.GLOW_CRYSTAL, label: 'Cristal' },

            { type: 'TILE', id: TileType.POWERUP_BLOCK_MINI_FANTA, label: 'Blk Fanta' },
            { type: 'TILE', id: TileType.POWERUP_BLOCK_HELMET, label: 'Blk Helm' },

            // --- ENTITIES ---
            { type: 'ENTITY', id: 'coin', entityType: 'COLLECTIBLE', label: 'Coin' },
            { type: 'ENTITY', id: 'mini_fanta', entityType: 'COLLECTIBLE', label: 'Item Fanta' },
            { type: 'ENTITY', id: 'helmet', entityType: 'COLLECTIBLE', label: 'Item Helm' },
            { type: 'ENTITY', id: 'checkpoint', entityType: 'CHECKPOINT', label: 'Check' },
            { type: 'ENTITY', id: 'goal', entityType: 'GOAL', label: 'Goal' },
            { type: 'ENTITY', id: 'minion', entityType: 'ENEMY', label: 'Minion' },
            { type: 'ENTITY', id: 'boss_joaozao', entityType: 'ENEMY', label: 'Boss' },
            { type: 'ENTITY', id: 'spawn', entityType: 'SPAWN', label: 'Spawn' }
        ];

        const renderer = this.renderer; // Access global renderer for thumbnails

        items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'tile-btn';
            btn.type = 'button';
            btn.title = item.label;
            if (item.type !== 'TRIGGER' && this.activeContent.type !== 'TRIGGER' && this.activeContent.type === item.type && this.activeContent.id === item.id) {
                btn.classList.add('selected');
            }

            // Create mini canvas for thumbnail
            const thumb = document.createElement('canvas');
            thumb.width = TILE_SIZE * 2; // 2x Zoom for clarity
            thumb.height = TILE_SIZE * 2;
            thumb.style.imageRendering = 'pixelated';
            thumb.style.marginBottom = '5px';

            // Draw thumbnail
            if (renderer) {
                const ctx = thumb.getContext('2d')!;
                ctx.scale(2, 2); // Scale up for visibility

                // --- TILE RENDERING ---
                if (item.type === 'TILE') {
                    if (item.id === TileType.EMPTY) {
                        ctx.fillStyle = '#333';
                        ctx.fillRect(0, 0, 32, 32);
                        ctx.strokeStyle = '#555';
                        ctx.strokeRect(0, 0, 32, 32);
                        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(32, 32); ctx.stroke();
                    }
                    else if (item.id === TileType.HIDDEN_BLOCK) {
                        ctx.globalAlpha = 0.5;
                        const dummyGrid = [[item.id], [TileType.EMPTY]];
                        renderer.drawTile(TileType.BRICK, 0, 0, dummyGrid, 0, 0, ctx);
                    }
                    else {
                        const dummyGrid = [[item.id], [TileType.EMPTY]];
                        renderer.drawTile(item.id, 0, 0, dummyGrid, 0, 0, ctx);
                    }
                }
                // The palette uses the production sprite at its correct ground anchor.
                else if (item.type === 'ENTITY') {
                    thumb.width = thumb.height = 48;
                    thumb.style.width = thumb.style.height = '32px';
                    ctx.imageSmoothingEnabled = false;
                    const tall = ['boss_joaozao', 'spawn', 'minion', 'checkpoint', 'goal'].includes(item.id);
                    renderer.drawEditorGhost(item, item.id === 'boss_joaozao' ? 8 : 16, tall ? 47 : 16, 1, ctx);
                }
            }

            btn.appendChild(thumb);

            const label = document.createElement('span');
            label.innerText = item.label;
            label.style.fontSize = '10px';
            btn.appendChild(label);

            btn.onclick = () => {
                this.activeContent = item;

                // Smart Tool Switching:
                // If we are using ERASER or SELECT, selecting a tile implies we want to paint -> Switch to BRUSH.
                // If we are using BRUSH or RECTANGLE, keep the tool (user might want to paint a rect of the new tile).
                if (this.activeTool === EditorTool.ERASER || this.activeTool === EditorTool.SELECT) {
                    this.activeTool = EditorTool.BRUSH;
                }

                // Update UI state
                Array.from(this.uiPalette.children).forEach(c => c.classList.remove('selected'));
                btn.classList.add('selected');

                // Sync Tool UI
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                const activeBtn = document.querySelector(`.tool-btn[data-tool="${this.activeTool}"]`);
                if (activeBtn) activeBtn.classList.add('active');

            };
            this.uiPalette.appendChild(btn);
        });
    }

    private buildLogicPalette() {
        this.uiLogicPalette.innerHTML = '';

        const items = [
            { triggerType: TriggerType.AUDIO, label: 'Audio', icon: '🎵' },
            { triggerType: TriggerType.CAMERA, label: 'Camera', icon: '🎥' },
            { triggerType: TriggerType.DAMAGE, label: 'Damage', icon: '💀' },
            { triggerType: TriggerType.DIALOG, label: 'Dialog', icon: '💬' }
        ];

        items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'tile-btn';
            btn.type = 'button';
            btn.title = item.label;
            btn.style.display = 'flex';
            btn.style.flexDirection = 'column';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';

            const icon = document.createElement('div');
            icon.innerText = item.icon;
            icon.style.fontSize = '24px';
            icon.style.marginBottom = '5px';
            btn.appendChild(icon);

            const label = document.createElement('span');
            label.innerText = item.label;
            label.style.fontSize = '10px';
            btn.appendChild(label);

            btn.onclick = () => {
                this.activeContent = { type: 'TRIGGER', triggerType: item.triggerType };

                // Auto-select Rectangle tool for zones
                this.activeTool = EditorTool.RECTANGLE;

                // Update UI state
                Array.from(this.uiLogicPalette.children).forEach(c => c.classList.remove('selected'));
                Array.from(this.uiPalette.children).forEach(c => c.classList.remove('selected')); // Clear other palette too
                btn.classList.add('selected');

                // Sync Tool UI
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                const activeBtn = document.querySelector(`.tool-btn[data-tool="${this.activeTool}"]`);
                if (activeBtn) activeBtn.classList.add('active');

            };
            this.uiLogicPalette.appendChild(btn);
        });
    }

    private async refreshLevelList() {
        const files = this.fs.isMounted ? await this.fs.listLevels() : [];
        this.uiLevelList.replaceChildren();
        const add = (name: string, load: () => void) => {
            const button = document.createElement('button');
            button.className = 'level-list-item';
            button.textContent = name;
            button.onclick = load;
            this.uiLevelList.appendChild(button);
        };
        if (this.fs.isMounted) {
            files.forEach(file => add(file, async () => {
                const version = this.documentVersion;
                const request = ++this.loadRequest;
                try {
                    const level = await this.fs.readLevel(file);
                    if (request === this.loadRequest && version === this.documentVersion && this.canReplaceDocument()) this.loadLevel(level, file, true);
                } catch (error) { this.showError(error); }
            }));
            if (!files.length) this.uiLevelList.textContent = 'Nenhuma fase nesta pasta. Importe um arquivo ou abra src/data/levels.';
        } else {
            CAMPAIGN_LEVELS.forEach(({ data: level, filename }) => add(level.name, () => {
                if (this.canReplaceDocument()) {
                    this.loadLevel(level, filename, false);
                }
            }));
        }
    }

    private loadLevel(level: LevelData, filename: string, mounted: boolean, newDocument = false): void {
        if (level.theme) {
            const underground = level.theme.underground;
            const colors = [
                ...level.theme.skyGradient,
                ...level.theme.layers.map(layer => layer.color),
                ...(underground ? [...underground.skyGradient, ...underground.layers.map(layer => layer.color)] : [])
            ];
            for (const color of colors) {
                if (!CSS.supports('color', color)) throw new Error('A fase contém uma cor inválida: ' + color);
            }
        }
        this.cancelGesture();
        this.loadRequest++;
        this.levelData = structuredClone(level);
        this.undergroundDraft = undefined;
        this.documentVersion++;
        this.currentLevelFilename = filename;
        this.mountedFile = mounted;
        this.newDocument = newDocument;
        this.activeSelection = null;
        this.updateLevelSettingsUI();
        this.populateThemeEditor();
        this.updateTheme();
        this.updateBoundsUI();
        this.updateInspector();
        this.history.reset(this.levelData);
        this.updateDocumentUI();
        this.fitLevelToScreen();
        this.showMessage('Fase carregada.');
    }

    private updateLevelSettingsUI(): void {
        if (!this.levelData) return;
        (document.getElementById('level-id') as HTMLInputElement).value = this.levelData.id;
        (document.getElementById('level-name') as HTMLInputElement).value = this.levelData.name;
        (document.getElementById('level-time-limit') as HTMLInputElement).value = String(this.levelData.timeLimit);
        (document.getElementById('level-is-boss') as HTMLInputElement).checked = this.levelData.isBossLevel;
    }

    private canReplaceDocument(): boolean {
        return !this.saving && (!this.levelData || !this.history.isDirty(this.levelData)
            || window.confirm('Descartar as alterações não salvas desta fase?'));
    }

    private async save(exportOnly = false): Promise<void> {
        if (!this.levelData || this.saving) return;
        this.cancelGesture();
        const data = structuredClone(this.levelData);
        const filename = this.newDocument
            ? `level_${data.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.ts`
            : this.currentLevelFilename || 'new_level.ts';
        this.saving = true;
        this.updateDocumentUI();
        try {
            if (!exportOnly && this.newDocument && this.fs.isMounted) {
                await this.fs.createLevel(filename, data);
                this.currentLevelFilename = filename;
                this.mountedFile = true;
                this.newDocument = false;
                await this.refreshLevelList();
                this.showMessage('Nova fase criada em ' + filename + '.');
            } else if (!exportOnly && this.mountedFile && this.fs.isMounted) {
                await this.fs.saveLevel(filename, data);
                this.showMessage('Fase salva em ' + filename + '.');
            } else {
                const blob = new Blob([serializeLevelToTS(data)], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename.replace(/\.json$/i, '.ts');
                link.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                this.showMessage('Arquivo exportado. Copie-o para src/data/levels para atualizar o jogo.');
            }
            this.history.markSaved(data);
        } catch (error) { this.showError(error); }
        finally { this.saving = false; this.updateDocumentUI(); }
    }

    private showMessage(message: string): void {
        const target = document.getElementById('editor-message');
        if (target) target.textContent = message;
    }

    private showError(error: unknown): void {
        this.showMessage(error instanceof Error ? error.message : 'Não foi possível concluir a operação.');
    }

    private recordChange(): void {
        if (!this.levelData) return;
        if (this.history.record(this.levelData)) this.documentVersion++;
        this.updateDocumentUI();
    }

    private updateDocumentUI(): void {
        const dirty = this.levelData && this.history.isDirty(this.levelData);
        this.uiFileLabel.textContent = (this.currentLevelFilename || 'Nova fase') + (dirty ? ' •' : '');
        this.uiSaveBtn.textContent = this.saving ? 'Salvando…' : this.newDocument && this.fs.isMounted
            ? 'Criar fase' : this.mountedFile ? 'Salvar' : 'Exportar .ts';
        this.uiSaveBtn.disabled = this.saving;
        this.uiMountBtn.disabled = this.saving || !this.fs.isSupported;
        const exportButton = document.getElementById('btn-export') as HTMLButtonElement;
        exportButton.hidden = !this.mountedFile;
        exportButton.disabled = this.saving;
        (document.getElementById('btn-undo') as HTMLButtonElement).disabled = !this.history.canUndo;
        (document.getElementById('btn-redo') as HTMLButtonElement).disabled = !this.history.canRedo;
    }

    private restoreHistory(redo: boolean): void {
        this.cancelGesture();
        const data = redo ? this.history.redo() : this.history.undo();
        if (!data) return;
        this.levelData = data;
        this.undergroundDraft = undefined;
        this.documentVersion++;
        this.activeSelection = null;
        this.updateLevelSettingsUI();
        this.populateThemeEditor(); this.updateTheme(); this.updateBoundsUI(); this.updateInspector();
        this.updateDocumentUI();
    }

    private cancelGesture(): void {
        const changed = this.isDragging;
        this.isDragging = false;
        this.isResizingBounds = false;
        this.activeEdge = null;
        this.dragStartTile = null;
        this.lastPaintPosition = null;
        this.boundsResizeStart = null;
        if (changed) this.recordChange();
    }

    private setTool(tool: EditorTool): void {
        this.cancelGesture();
        this.activeTool = tool;
        document.querySelectorAll<HTMLButtonElement>('.tool-btn').forEach(button => {
            const active = button.dataset.tool === tool;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        this.updateCursor();
    }

    public init() {
        // Show editor UI
        const ui = document.getElementById('editor-ui');
        if (ui) ui.classList.add('active');

        // Add editor-mode class to body for canvas positioning
        document.body.classList.add('editor-mode');

        // Bind Tool Buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = (btn as HTMLElement).dataset.tool as keyof typeof EditorTool;
                if (tool && EditorTool[tool]) {
                    this.setTool(EditorTool[tool]);

                    // Update Visuals
                    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                }
            });
        });

        // Resize canvas to fit in editor layout
        this.resizeCanvasForEditor();
        window.addEventListener('resize', () => this.resizeCanvasForEditor());

        // Initialize status bar
        this.updateStatusBar();

        const firstLevel = CAMPAIGN_LEVELS[0];
        this.loadLevel(firstLevel.data, firstLevel.filename, false);
        void this.refreshLevelList();
        this.showMessage('B: pincel · E: apagar · S: selecionar · R: área · H: mover · F: enquadrar · Roda: zoom');
    }

    private resizeCanvasForEditor(): void {
        const toolbar = document.querySelector('.toolbar')!.getBoundingClientRect();
        const sidebar = document.querySelector('.sidebar')!.getBoundingClientRect();
        const tools = document.querySelector('.tools-sidebar')!.getBoundingClientRect();
        const statusbar = document.querySelector('.editor-statusbar')!.getBoundingClientRect();
        const width = Math.max(1, sidebar.left - tools.right);
        const height = Math.max(1, statusbar.top - toolbar.bottom);
        const dpr = window.devicePixelRatio || 1;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.canvas.style.left = tools.right + 'px';
        this.canvas.style.top = toolbar.bottom + 'px';
        this.canvas.width = Math.round(width * dpr);
        this.canvas.height = Math.round(height * dpr);
        this.canvas.getContext('2d')!.imageSmoothingEnabled = false;
    }

    private updateStatusBar(): void {
        // Update coordinates
        if (this.statusCoords) {
            this.statusCoords.textContent = `Tile: (${this.hoveredCol}, ${this.hoveredRow})`;
        }

        // Update world coordinates
        if (this.statusWorld) {
            const worldX = this.hoveredCol * TILE_SIZE;
            const worldY = this.hoveredRow * TILE_SIZE;
            this.statusWorld.textContent = `World: (${worldX}, ${worldY}) px`;
        }

        // Update level size
        if (this.statusLevel && this.levelData) {
            const w = this.levelData.tiles[0]?.length || 0;
            const h = this.levelData.tiles.length;
            this.statusLevel.textContent = `${w} × ${h} tiles`;
        }

        // Update zoom
        if (this.statusZoom) {
            this.statusZoom.textContent = `${Math.round(this.zoom * 100)}%`;
        }
    }

    public update(_deltaTime: number) {
        // Editor update
    }

    public render(renderer: Renderer) {
        // Render and pointer events share CSS pixels; only the backing buffer uses DPR.
        const mainCtx = this.canvas.getContext('2d')!;
        const rect = this.canvas.getBoundingClientRect();
        const deviceScale = this.canvas.width / rect.width;
        mainCtx.setTransform(1, 0, 0, 1, 0, 0);

        // Clear Main Canvas (as we are taking over control)
        mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);

        const finalZoom = this.zoom * deviceScale;

        mainCtx.save();
        mainCtx.scale(finalZoom, this.zoom * this.canvas.height / rect.height);

        if (this.levelData) {
            // 0. Draw Background
            if (this.uiShowBgChk && this.uiShowBgChk.checked) {
                // Calculate logical visible area to tell renderer how much to fill
                const visibleWidth = (mainCtx.canvas.width / deviceScale) / this.zoom;
                const visibleHeight = (mainCtx.canvas.height / deviceScale) / this.zoom;

                renderer.drawBackground(this.camera, mainCtx, visibleWidth, visibleHeight);
            } else {
                // Draw simple dark background
                const visibleWidth = (mainCtx.canvas.width / deviceScale) / this.zoom;
                const visibleHeight = (mainCtx.canvas.height / deviceScale) / this.zoom;

                mainCtx.fillStyle = '#111';
                mainCtx.fillRect(0, 0, visibleWidth, visibleHeight);
            }

            // 1. Dim Outside Area BEFORE tiles (so tiles draw over it)
            if (this.dimOutside) {
                this.drawOutsideDim(mainCtx);
            }

            // 2. Draw Tiles (Using Game Renderer for pixel-perfect accuracy)
            this.renderEditorView(mainCtx, renderer);

            // 2.5 Draw Tool Previews (Rectangle Overlay)
            this.drawRectanglePreview(mainCtx);

            // 2.6 Draw Ghost Preview (Brush/Item placement)
            this.drawGhostPreview(renderer, mainCtx);
        }

        // 3. Draw Grid
        this.drawGrid(mainCtx);

        if (this.uiShowBgChk.checked) {
            this.drawUndergroundBoundary(mainCtx, rect.width / this.zoom, rect.height / this.zoom);
        }

        // 4. Draw Bounds Frame
        if (this.showBounds) {
            this.drawBoundsFrame(mainCtx);
        }

        mainCtx.restore();

        // Status bar is now updated via HTML elements, no canvas drawing needed
    }

    private drawUndergroundBoundary(ctx: CanvasRenderingContext2D, viewportWidth: number, height: number): void {
        const level = this.levelData;
        const startRow = level?.theme?.underground?.startRow;
        if (startRow === undefined) return;
        const y = startRow * TILE_SIZE - this.camera.y;
        if (y < 0 || y > height) return;
        const left = (level?.originX ?? 0) * TILE_SIZE - this.camera.x;
        const right = left + (level?.width ?? 0) * TILE_SIZE;
        const lineLeft = Math.max(0, left);
        const lineRight = Math.min(viewportWidth, right);
        if (lineLeft >= lineRight) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(120, 245, 230, 0.85)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(lineLeft, Math.round(y) + 0.5);
        ctx.lineTo(lineRight, Math.round(y) + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '10px Consolas, monospace';
        const labelX = Math.max(lineLeft + 4, Math.min(lineRight - 148, left + 4));
        const labelY = Math.max(12, y - 5);
        ctx.fillStyle = 'rgba(8, 25, 35, 0.85)';
        ctx.fillRect(labelX - 3, labelY - 11, 147, 14);
        ctx.fillStyle = '#9ffff0';
        ctx.fillText(`SUBSOLO · LINHA ${startRow}`, labelX, labelY);
        ctx.restore();
    }

    private renderEditorView(ctx: CanvasRenderingContext2D, renderer: Renderer) {
        if (!this.levelData) return;
        const tiles = this.levelData.tiles;

        // Get origin offset
        const originX = this.levelData.originX ?? 0;
        const originY = this.levelData.originY ?? 0;

        // Visual region uses ZOOM-adjusted visible area
        // We use the transform from the context to be accurate
        const t = ctx.getTransform();
        const visibleWidth = ctx.canvas.width / t.a;
        const visibleHeight = ctx.canvas.height / t.d;

        // Calculate visible range in WORLD tile coordinates
        const worldStartCol = Math.floor(this.camera.x / TILE_SIZE);
        const worldEndCol = worldStartCol + Math.ceil(visibleWidth / TILE_SIZE) + 1;
        const worldStartRow = Math.floor(this.camera.y / TILE_SIZE);
        const worldEndRow = worldStartRow + Math.ceil(visibleHeight / TILE_SIZE) + 1;

        // Convert to ARRAY indices
        const startCol = worldStartCol - originX;
        const endCol = worldEndCol - originX;
        const startRow = worldStartRow - originY;
        const endRow = worldEndRow - originY;

        // Check for Logic Mode
        const isLogicMode = this.isLogicMode();

        // 1. Draw Tiles
        ctx.save();
        if (isLogicMode) ctx.globalAlpha = 0.4;

        for (let r = startRow; r < endRow; r++) {
            if (r < 0 || r >= tiles.length) continue;
            for (let c = startCol; c < endCol; c++) {
                if (c < 0 || c >= tiles[0].length) continue;
                const tile = tiles[r][c];

                // Convert array index back to world position for rendering
                const worldCol = c + originX;
                const worldRow = r + originY;
                const x = Math.floor(worldCol * TILE_SIZE - this.camera.x);
                const y = Math.floor(worldRow * TILE_SIZE - this.camera.y);

                if (tile !== 0) {
                    // Special Handling for Editor-Only Visuals
                    if (tile === TileType.HIDDEN_BLOCK) {
                        ctx.save();
                        ctx.globalAlpha = 0.5; // Ghost mode
                        renderer.drawTile(TileType.BRICK, x, y, tiles, r, c, ctx, worldCol, worldRow);
                        ctx.restore();
                    }
                    else {
                        renderer.drawTile(tile, x, y, tiles, r, c, ctx, worldCol, worldRow);
                    }
                }
            }
        }
        ctx.restore();

        // Objects are drawn from the same placements used by the game.

        if (this.levelData.enemies) {
            this.levelData.enemies.forEach(e => {
                const rect = enemySpawnRect(e.type, e.position);
                // Mock Enemy Data for Renderer
                const mockEnemy: any = {
                    type: e.type,
                    position: { x: rect.x, y: rect.y },
                    active: true,
                    facingRight: false,
                    isDead: false,
                    width: rect.width, height: rect.height,
                    animationTimer: 0,
                    animationFrame: 0
                };
                renderer.drawEnemy(mockEnemy, this.camera, ctx);
            });
        }

        if (this.levelData.collectibles) {
            this.levelData.collectibles.forEach(c => {
                const mockCol: any = {
                    type: c.type,
                    position: { x: c.position.x * TILE_SIZE, y: c.position.y * TILE_SIZE },
                    active: true,
                    collected: false,
                    animationTimer: 0
                };
                renderer.drawCollectible(mockCol, this.camera, ctx);
            });
        }

        for (const checkpoint of this.levelData.checkpoints) {
            renderer.drawFlagTile(Math.round(checkpoint.x * TILE_SIZE - this.camera.x),
                Math.round(checkpoint.y * TILE_SIZE - this.camera.y), ctx);
        }
        renderer.drawFlagTile(Math.round(this.levelData.goalPosition.x * TILE_SIZE - this.camera.x),
            Math.round(this.levelData.goalPosition.y * TILE_SIZE - this.camera.y), ctx, 'goal');

        // 3. Draw Player Spawn (Editor Visual)
        if (this.levelData.playerSpawn) {
            // Draw Player Idle Sprite at Spawn Location
            const spawnX = Math.round(this.levelData.playerSpawn.x * TILE_SIZE - this.camera.x);
            const spawnY = Math.round(this.levelData.playerSpawn.y * TILE_SIZE - this.camera.y);

            // Use renderer's sprite drawing
            // Reuse the logic from drawEditorGhost for 'spawn'
            // We can manually draw it or add a helper in renderer. 
            // Let's implement manual draw here for now to avoid altering Renderer public API too much just for this.
            // Or better: Use renderer.drawPlayer with a mock player object

            const mockPlayer: any = {
                position: { x: this.levelData.playerSpawn.x * TILE_SIZE, y: this.levelData.playerSpawn.y * TILE_SIZE - 24 },
                velocity: { x: 0, y: 0 },
                isGrounded: true,
                isDead: false,
                facingRight: true,
                animationTimer: 0,
                width: 14, height: 24,
                invincibleTimer: 0,
                miniFantaTimer: 0,
                hasHelmet: false,
                groundPoundState: 'NONE'
            };

            ctx.save();
            ctx.globalAlpha = 0.7; // Slightly transparent to indicate it's a marker
            renderer.drawPlayer(mockPlayer, this.camera, ctx);

            // Draw "SPAWN" text label (smaller)
            ctx.font = '6px Consolas';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#FFFFFF';
            // Center text above player
            ctx.fillText('SPAWN', spawnX + 7, spawnY - 30);
            ctx.restore();
        }

        // 4. Draw Triggers
        if (isLogicMode && this.levelData.triggers) {
            this.levelData.triggers.forEach(t => {
                ctx.save();
                if (!t.active) ctx.globalAlpha = 0.35;
                renderer.drawTrigger(t, this.camera, ctx);
                ctx.restore();
            });
        }

        // 5. Draw Selection Gizmo
        this.drawSelectionGizmo(ctx);
    }

    private drawRectanglePreview(ctx: CanvasRenderingContext2D) {
        if (!this.dragStartTile || this.activeTool !== EditorTool.RECTANGLE) return;

        // Current Hover is maintained in hoveredCol/hoveredRow (World Coordinates)
        const startX = this.dragStartTile.x; // World Tile X
        const startY = this.dragStartTile.y; // World Tile Y
        const endX = this.hoveredCol;
        const endY = this.hoveredRow;

        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);

        // Calculate screen coordinates
        const x = Math.floor(minX * TILE_SIZE - this.camera.x);
        const y = Math.floor(minY * TILE_SIZE - this.camera.y);
        const width = (maxX - minX + 1) * TILE_SIZE;
        const height = (maxY - minY + 1) * TILE_SIZE;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.strokeStyle = 'cyan';
        ctx.lineWidth = 1; // logical pixel width (will be scaled by context)

        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
        ctx.restore();
    }

    private drawGrid(ctx: CanvasRenderingContext2D) {
        // We are already scaled by `finalZoom` (which is zoom * deviceScale)
        // so `ctx.canvas.width` is the RAW pixel width (e.g. 1920)
        // We need 'logical' width relative to our current scale factor

        // Inverse transform to get logical viewport bottom-right
        const transform = ctx.getTransform();
        // Since we did scale(finalZoom, finalZoom), the scale factor is in a or d component
        // But safer to just use values we know:
        const visibleWidth = ctx.canvas.width / transform.a;
        const visibleHeight = ctx.canvas.height / transform.d;

        const startX = Math.floor(this.camera.x / TILE_SIZE) * TILE_SIZE;
        const endX = startX + visibleWidth + TILE_SIZE;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        // Make line extremely crisp: 1 physical pixel width
        // If we are at scale 6x (device) * 1x (zoom) = 6x, then 1 logical unit = 6 pixels.
        // To get 1 pixel line, we need width = 1 / 6.
        ctx.lineWidth = 1 / transform.a;

        ctx.beginPath();

        // Vertical lines
        for (let x = startX; x <= endX; x += TILE_SIZE) {
            const screenX = x - this.camera.x;
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, visibleHeight);
        }

        // Horizontal lines
        const startY = Math.floor(this.camera.y / TILE_SIZE) * TILE_SIZE;
        const endY = startY + visibleHeight + TILE_SIZE;

        for (let y = startY; y <= endY; y += TILE_SIZE) {
            const screenY = y - this.camera.y;
            ctx.moveTo(0, screenY);
            ctx.lineTo(visibleWidth, screenY);
        }

        ctx.stroke();
    }

    private drawOutsideDim(ctx: CanvasRenderingContext2D): void {
        if (!this.levelData) return;

        const transform = ctx.getTransform();
        const visibleWidth = ctx.canvas.width / transform.a;
        const visibleHeight = ctx.canvas.height / transform.d;

        const boundsWidth = this.levelData.tiles[0]?.length * TILE_SIZE || 0;
        const boundsHeight = this.levelData.tiles.length * TILE_SIZE;

        // Get origin offset
        const originX = (this.levelData.originX ?? 0) * TILE_SIZE;
        const originY = (this.levelData.originY ?? 0) * TILE_SIZE;

        // Bounds position in screen coordinates (considering origin)
        const boundsLeft = originX - this.camera.x;
        const boundsTop = originY - this.camera.y;
        const boundsRight = boundsLeft + boundsWidth;
        const boundsBottom = boundsTop + boundsHeight;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';

        // Left region (outside left edge)
        if (boundsLeft > 0) {
            ctx.fillRect(0, 0, boundsLeft, visibleHeight);
        }

        // Right region (outside right edge)
        if (boundsRight < visibleWidth) {
            ctx.fillRect(boundsRight, 0, visibleWidth - boundsRight, visibleHeight);
        }

        // Top region (between left and right bounds)
        if (boundsTop > 0) {
            const left = Math.max(0, boundsLeft);
            const right = Math.min(visibleWidth, boundsRight);
            ctx.fillRect(left, 0, right - left, boundsTop);
        }

        // Bottom region (between left and right bounds)
        if (boundsBottom < visibleHeight) {
            const left = Math.max(0, boundsLeft);
            const right = Math.min(visibleWidth, boundsRight);
            ctx.fillRect(left, boundsBottom, right - left, visibleHeight - boundsBottom);
        }
    }

    private drawBoundsFrame(ctx: CanvasRenderingContext2D): void {
        if (!this.levelData) return;

        const transform = ctx.getTransform();
        const boundsWidth = this.levelData.tiles[0]?.length * TILE_SIZE || 0;
        const boundsHeight = this.levelData.tiles.length * TILE_SIZE;

        // Get origin offset
        const originX = (this.levelData.originX ?? 0) * TILE_SIZE;
        const originY = (this.levelData.originY ?? 0) * TILE_SIZE;

        // Position in screen space (considering origin)
        const x = originX - this.camera.x;
        const y = originY - this.camera.y;

        // Draw border
        ctx.strokeStyle = this.boundsColor;
        ctx.lineWidth = this.boundsThickness / transform.a;
        ctx.strokeRect(x, y, boundsWidth, boundsHeight);

        // Draw corner markers for better visibility
        const markerSize = 8 / transform.a;
        ctx.fillStyle = this.boundsColor;

        // Top-left corner
        ctx.fillRect(x - markerSize / 2, y - markerSize / 2, markerSize, markerSize);
        // Top-right corner
        ctx.fillRect(x + boundsWidth - markerSize / 2, y - markerSize / 2, markerSize, markerSize);
        // Bottom-left corner
        ctx.fillRect(x - markerSize / 2, y + boundsHeight - markerSize / 2, markerSize, markerSize);
        // Bottom-right corner
        ctx.fillRect(x + boundsWidth - markerSize / 2, y + boundsHeight - markerSize / 2, markerSize, markerSize);

        // Draw size label near top-left (also show origin if non-zero)
        ctx.font = `${10 / transform.a}px Consolas`;
        ctx.fillStyle = this.boundsColor;
        const width = this.levelData.tiles[0]?.length || 0;
        const height = this.levelData.tiles.length;
        const originLabelX = this.levelData.originX ?? 0;
        const originLabelY = this.levelData.originY ?? 0;
        const label = originLabelX !== 0 || originLabelY !== 0
            ? `${width} × ${height} @ (${originLabelX}, ${originLabelY})`
            : `${width} × ${height}`;
        ctx.fillText(label, x + 4 / transform.a, y - 4 / transform.a);
    }

    private drawGhostPreview(renderer: Renderer, ctx: CanvasRenderingContext2D) {
        // Only valid for BRUSH or RECTANGLE (and not dragging Rectangle)
        if (this.activeTool !== EditorTool.BRUSH && this.activeTool !== EditorTool.RECTANGLE) return;
        if (this.activeTool === EditorTool.RECTANGLE && this.isDragging) return; // Don't show item ghost while dragging rect
        if (this.activeContent.type === 'TRIGGER') return; // Triggers usually have different display

        let ghostX = this.currentWorldMouse.x;
        let ghostY = this.currentWorldMouse.y;

        // Snapping Logic
        if (this.activeContent.type === 'TILE') {
            // Tiles ALWAYS snap to grid
            const col = Math.floor(ghostX / TILE_SIZE);
            const row = Math.floor(ghostY / TILE_SIZE);
            ghostX = col * TILE_SIZE - this.camera.x;
            ghostY = row * TILE_SIZE - this.camera.y;
        }
        else if (this.activeContent.type === 'ENTITY') {
            if (this.isCtrlPressed) {
                // Ctrl Pressed: Free Movement (Pixel Perfect)
                ghostX -= this.camera.x;
                ghostY -= this.camera.y;
            } else {
                // Default: Snap to Grid
                const col = Math.floor(ghostX / TILE_SIZE);
                const row = Math.floor(ghostY / TILE_SIZE);
                ghostX = col * TILE_SIZE - this.camera.x;
                ghostY = row * TILE_SIZE - this.camera.y;
            }
        }

        renderer.drawEditorGhost(this.activeContent, ghostX, ghostY, 0.5, ctx);
    }


    private onMouseDown(e: MouseEvent) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;

        // Calculate world coordinates for edge detection
        const { x: worldX, y: worldY } = screenToWorld({ x: startX, y: startY }, this.camera, this.zoom);
        this.currentWorldMouse = { x: worldX, y: worldY };
        this.hoveredCol = Math.floor(worldX / TILE_SIZE);
        this.hoveredRow = Math.floor(worldY / TILE_SIZE);
        this.lastPaintPosition = { x: worldX, y: worldY };


        // Left click: Check for bounds edge first, then paint
        if (e.button === 0) {
            const edge = this.activeTool === EditorTool.SELECT ? this.detectBoundsEdge(worldX, worldY) : null;
            if (edge) {
                // Start bounds resize
                this.isResizingBounds = true;
                this.boundsResizeStart = structuredClone(this.levelData);
                this.activeSelection = null;
                this.updateInspector();
                this.activeEdge = edge;
                this.isDragging = true;
            } else {
                if (this.activeTool === EditorTool.HAND) this.isDragging = true;
                // Tool Action
                if (this.activeTool === EditorTool.BRUSH) {
                    this.handleBrushInteract(worldX, worldY);
                    this.isDragging = true;
                }
                else if (this.activeTool === EditorTool.ERASER) {
                    this.handleEraserInteract(worldX, worldY);
                    this.isDragging = true;
                }
                else if (this.activeTool === EditorTool.RECTANGLE) {
                    this.dragStartTile = { x: Math.floor(worldX / TILE_SIZE), y: Math.floor(worldY / TILE_SIZE) };
                    this.isDragging = true;
                }
                else if (this.activeTool === EditorTool.SELECT) {
                    this.handleSelectClick(worldX, worldY);
                }
            }
        }
        // Right click: Pan Start
        if (e.button === 2 || e.button === 1) {
            this.isDragging = true;
        }
        this.lastMousePos = { x: startX, y: startY };
    }



    private onMouseMove(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        // Always track hovered tile for HUD display
        // And track precise world mouse for Ghost
        const worldX = (currentX / this.zoom) + this.camera.x;
        const worldY = (currentY / this.zoom) + this.camera.y;

        this.currentWorldMouse = { x: worldX, y: worldY };

        this.hoveredCol = Math.floor(worldX / TILE_SIZE);
        this.hoveredRow = Math.floor(worldY / TILE_SIZE);

        // Update status bar with current coordinates
        this.updateStatusBar();

        // Detect edge hover for cursor change
        this.hoveredEdge = this.activeTool === EditorTool.SELECT ? this.detectBoundsEdge(worldX, worldY) : null;
        this.updateCursor();

        // Handle bounds resize dragging
        if (this.isResizingBounds && this.activeEdge && e.buttons === 1) {
            this.handleBoundsResize(worldX, worldY);
            this.lastMousePos = { x: currentX, y: currentY };
            return;
        }

        if (!this.isDragging) return;

        // Panning
        if (e.buttons === 2 || e.buttons === 4 || (e.buttons === 1 && this.activeTool === EditorTool.HAND)) {
            const dx = (currentX - this.lastMousePos.x) / this.zoom;
            const dy = (currentY - this.lastMousePos.y) / this.zoom;
            this.camera.x -= dx;
            this.camera.y -= dy;
        }

        // Painting (only if not resizing bounds)
        if (e.buttons === 1 && !this.isResizingBounds) {
            if (this.activeTool === EditorTool.BRUSH) {
                // Only paint tiles on drag, NOT entities
                if (this.activeContent.type === 'TILE') {
                    const previous = this.lastPaintPosition ?? { x: worldX, y: worldY };
                    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(worldX - previous.x), Math.abs(worldY - previous.y)) / (TILE_SIZE / 2)));
                    for (let step = 1; step <= steps; step++) {
                        this.handleBrushInteract(previous.x + (worldX - previous.x) * step / steps,
                            previous.y + (worldY - previous.y) * step / steps);
                    }
                    this.lastPaintPosition = { x: worldX, y: worldY };
                }
            } else if (this.activeTool === EditorTool.ERASER) {
                this.handleEraserInteract(worldX, worldY);
            } else if (this.activeTool === EditorTool.SELECT && this.activeSelection) {
                // Handle Dragging Selection
                let newX = worldX - this.selectionDragOffset.x;
                let newY = worldY - this.selectionDragOffset.y;

                // Snap logic
                if (!this.isCtrlPressed) {
                    // Enemy spawn points are ground contacts, above the rendered sprite.
                    newX = Math.round(newX / TILE_SIZE) * TILE_SIZE;
                    newY = this.activeSelection.type === 'ENEMY'
                        ? Math.round((newY + ENEMY_SPECS[this.activeSelection.data.type as EnemyType].height) / TILE_SIZE) * TILE_SIZE
                            - ENEMY_SPECS[this.activeSelection.data.type as EnemyType].height
                        : Math.round(newY / TILE_SIZE) * TILE_SIZE;
                }

                // Update Data (Convert back to Tile Units)
                if (this.activeSelection.type === 'TRIGGER') {
                    this.activeSelection.data.x = newX;
                    this.activeSelection.data.y = newY;
                } else if (this.activeSelection.type === 'SPAWN' ||
                    this.activeSelection.type === 'CHECKPOINT' || this.activeSelection.type === 'GOAL') {
                    this.activeSelection.data.x = newX / TILE_SIZE;
                    this.activeSelection.data.y = newY / TILE_SIZE;
                } else {
                    this.activeSelection.data.position.x = newX / TILE_SIZE;
                    this.activeSelection.data.position.y = this.activeSelection.type === 'ENEMY'
                        ? (newY + ENEMY_SPECS[this.activeSelection.data.type as EnemyType].height) / TILE_SIZE
                        : newY / TILE_SIZE;
                }
            }
        }

        this.lastMousePos = { x: currentX, y: currentY };
    }

    private onMouseUp(_e: MouseEvent) {
        if (this.isDragging && this.activeTool === EditorTool.RECTANGLE && this.dragStartTile) {
            this.applyRectangleTool();
        }

        this.cancelGesture();
        if (this.activeSelection) this.updateInspector();
    }

    private applyRectangleTool() {
        if (!this.dragStartTile || !this.levelData) return;

        // Don't rect-fill entities, only TILEs or ERASER or TRIGGERS
        if (this.activeContent.type === 'ENTITY') {
            console.warn('Rectangle tool not supported for Entities');
            return;
        }

        const startX = this.dragStartTile.x;
        const startY = this.dragStartTile.y;
        const endX = this.hoveredCol;
        const endY = this.hoveredRow;

        const minCol = Math.min(startX, endX);
        const maxCol = Math.max(startX, endX);
        const minRow = Math.min(startY, endY);
        const maxRow = Math.max(startY, endY);

        // 1. Handle TRIGGER Creation
        if (this.activeContent.type === 'TRIGGER') {
            const x = minCol * TILE_SIZE;
            const y = minRow * TILE_SIZE;
            const width = (maxCol - minCol + 1) * TILE_SIZE;
            const height = (maxRow - minRow + 1) * TILE_SIZE;

            const baseTrigger = {
                id: crypto.randomUUID(),
                x,
                y,
                width,
                height,
                oneShot: false,
                active: true
            };

            let newTrigger: LevelTrigger;

            switch (this.activeContent.triggerType) {
                case TriggerType.AUDIO:
                    newTrigger = { ...baseTrigger, type: TriggerType.AUDIO, trackId: 'theme', action: 'PLAY' };
                    break;
                case TriggerType.CAMERA:
                    newTrigger = { ...baseTrigger, type: TriggerType.CAMERA, zoom: 1.5, lockX: false, lockY: false };
                    break;
                case TriggerType.DAMAGE:
                    newTrigger = { ...baseTrigger, type: TriggerType.DAMAGE, damagePerTick: 1, instantKill: false };
                    break;
                case TriggerType.DIALOG:
                    newTrigger = { ...baseTrigger, type: TriggerType.DIALOG, text: 'Hello World' };
                    break;
                default:
                    return;
            }

            if (!this.levelData.triggers) this.levelData.triggers = [];
            this.levelData.triggers.push(newTrigger);

            return;
        }

        // 2. Handle TILE Filling
        const originX = this.levelData.originX ?? 0;
        const originY = this.levelData.originY ?? 0;

        for (let r = Math.max(minRow, originY); r <= Math.min(maxRow, originY + this.levelData.height - 1); r++) {
            for (let c = Math.max(minCol, originX); c <= Math.min(maxCol, originX + this.levelData.width - 1); c++) {
                // Convert world coords to array coords
                const arrayRow = r - originY;
                const arrayCol = c - originX;

                if (arrayRow >= 0 && arrayRow < this.levelData.tiles.length &&
                    arrayCol >= 0 && arrayCol < this.levelData.tiles[0].length) {

                    if (this.activeContent.type === 'TILE') {
                        this.levelData.tiles[arrayRow][arrayCol] = this.activeContent.id;
                    }
                }
            }
        }

    }

    private detectBoundsEdge(worldX: number, worldY: number): 'left' | 'right' | 'top' | 'bottom' | 'corner-br' | 'corner-tl' | null {
        if (!this.levelData || !this.showBounds || this.activeTool !== EditorTool.SELECT) return null;

        // Get level bounds considering origin offset
        const originX = this.levelData.originX ?? 0;
        const originY = this.levelData.originY ?? 0;
        const boundsLeft = originX * TILE_SIZE;
        const boundsTop = originY * TILE_SIZE;
        const boundsRight = (originX + (this.levelData.tiles[0]?.length || 0)) * TILE_SIZE;
        const boundsBottom = (originY + this.levelData.tiles.length) * TILE_SIZE;

        // Threshold in world coordinates (scaled by zoom)
        const threshold = this.EDGE_THRESHOLD / this.zoom;

        // Check edges
        const nearLeft = Math.abs(worldX - boundsLeft) < threshold;
        const nearRight = Math.abs(worldX - boundsRight) < threshold;
        const nearTop = Math.abs(worldY - boundsTop) < threshold;
        const nearBottom = Math.abs(worldY - boundsBottom) < threshold;

        // Check corners first (have priority)
        if (nearRight && nearBottom) {
            return 'corner-br';
        }
        if (nearLeft && nearTop) {
            return 'corner-tl';
        }

        // Check individual edges (within perpendicular bounds)
        if (nearRight && worldY >= boundsTop && worldY <= boundsBottom) {
            return 'right';
        }
        if (nearLeft && worldY >= boundsTop && worldY <= boundsBottom) {
            return 'left';
        }
        if (nearBottom && worldX >= boundsLeft && worldX <= boundsRight) {
            return 'bottom';
        }
        if (nearTop && worldX >= boundsLeft && worldX <= boundsRight) {
            return 'top';
        }

        return null;
    }

    private handleBoundsResize(worldX: number, worldY: number): void {
        if (!this.levelData || !this.activeEdge) return;

        const source = this.boundsResizeStart ?? this.levelData;
        const originX = source.originX ?? 0;
        const originY = source.originY ?? 0;
        const currentWidth = source.width;
        const currentHeight = source.height;

        // Calculate new world tile position
        const mouseTileX = Math.floor(worldX / TILE_SIZE);
        const mouseTileY = Math.floor(worldY / TILE_SIZE);

        let newWidth = currentWidth;
        let newHeight = currentHeight;
        let newOriginX = originX;
        let newOriginY = originY;

        // Handle right/left edges
        if (this.activeEdge === 'right' || this.activeEdge === 'corner-br') {
            // Expanding/shrinking from right
            newWidth = Math.max(10, Math.min(500, mouseTileX - originX + 1));
        }
        if (this.activeEdge === 'left' || this.activeEdge === 'corner-tl') {
            // Expanding/shrinking from left - changes origin and width
            const rightEdge = originX + currentWidth;
            const newLeft = Math.max(rightEdge - 500, Math.min(mouseTileX, rightEdge - 10));
            newOriginX = newLeft;
            newWidth = rightEdge - newLeft;
        }

        // Handle bottom/top edges  
        if (this.activeEdge === 'bottom' || this.activeEdge === 'corner-br') {
            // Expanding/shrinking from bottom
            newHeight = Math.max(5, Math.min(100, mouseTileY - originY + 1));
        }
        if (this.activeEdge === 'top' || this.activeEdge === 'corner-tl') {
            // Expanding/shrinking from top - changes origin and height
            const bottomEdge = originY + currentHeight;
            const newTop = Math.max(bottomEdge - 100, Math.min(mouseTileY, bottomEdge - 5));
            newOriginY = newTop;
            newHeight = bottomEdge - newTop;
        }

        resizeLevel(this.levelData, newWidth, newHeight, newOriginX, newOriginY, source);
        this.updateBoundsUI();
    }

    private updateCursor(): void {
        if (!this.canvas) return;

        const edge = this.isResizingBounds ? this.activeEdge : this.hoveredEdge;

        if (edge) {
            switch (edge) {
                case 'corner-br':
                case 'corner-tl':
                    this.canvas.style.cursor = 'nwse-resize';
                    break;
                case 'left':
                case 'right':
                    this.canvas.style.cursor = 'ew-resize';
                    break;
                case 'top':
                case 'bottom':
                    this.canvas.style.cursor = 'ns-resize';
                    break;
            }
        } else {
            this.canvas.style.cursor = this.activeTool === EditorTool.HAND ? 'grab' : 'crosshair';
        }
    }

    private onWheel(e: WheelEvent) {
        // Zoom on Wheel centered on mouse
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Convert mouse screen pos to world pos before zoom
        const worldMouseX = (mouseX / this.zoom) + this.camera.x;
        const worldMouseY = (mouseY / this.zoom) + this.camera.y;

        const zoomSpeed = 0.0002; // ~2% per scroll step (was 0.0005 = ~5%)
        const zoomDelta = -e.deltaY * zoomSpeed;
        const newZoom = Math.max(0.03, Math.min(8, this.zoom + zoomDelta));

        // Apply new zoom
        this.zoom = newZoom;

        // Update Zoom Label and Status Bar
        if (this.uiZoomLabel) {
            this.uiZoomLabel.innerText = Math.round(this.zoom * 100) + '%';
        }
        this.updateStatusBar();

        // Adjust camera so that worldMouse is still under mouseX/mouseY
        // newWorldMouseX = (mouseX / newZoom) + newCameraX
        // We want newWorldMouseX == worldMouseX
        // So: worldMouseX = (mouseX / newZoom) + newCameraX
        // newCameraX = worldMouseX - (mouseX / newZoom)

        this.camera.x = worldMouseX - (mouseX / this.zoom);
        this.camera.y = worldMouseY - (mouseY / this.zoom);
    }

    private handleBrushInteract(worldX: number, worldY: number) {
        if (!this.levelData) return;

        // --- TILE PLACEMENT ---
        if (this.activeContent.type === 'TILE') {
            const originX = this.levelData.originX ?? 0;
            const originY = this.levelData.originY ?? 0;
            const col = Math.floor(worldX / TILE_SIZE) - originX;
            const row = Math.floor(worldY / TILE_SIZE) - originY;

            if (row >= 0 && row < this.levelData.tiles.length &&
                col >= 0 && col < this.levelData.tiles[0].length) {
                this.levelData.tiles[row][col] = this.activeContent.id;
            }
            return;
        }

        // --- ENTITY PLACEMENT ---
        if (this.activeContent.type === 'ENTITY') {
            const gridX = Math.floor(worldX / TILE_SIZE);
            const gridY = Math.floor(worldY / TILE_SIZE);
            const originX = this.levelData.originX ?? 0;
            const originY = this.levelData.originY ?? 0;
            if (gridX < originX || gridX >= originX + this.levelData.width ||
                gridY < originY || gridY >= originY + this.levelData.height) return;
            let placeX = worldX;
            let placeY = worldY;

            // Snapping Logic
            if (this.isCtrlPressed) {
                // Ctrl: Free Placement (World Coords)
                // No modification needed, worldX is already absolute
            } else {
                // Default: Snap to Grid (World Coords)
                placeX = Math.floor(worldX / TILE_SIZE) * TILE_SIZE;
                placeY = Math.floor(worldY / TILE_SIZE) * TILE_SIZE;
            }

            // Convert to Level Units (Tiles)
            // Assuming LevelData stores positions in Tile Units (e.g. 10.5 for 168px)
            const finalX = placeX / TILE_SIZE;
            const finalY = placeY / TILE_SIZE;

            if (this.activeContent.id === 'spawn') {
                Object.assign(this.levelData.playerSpawn, { x: finalX, y: finalY });
            } else if (this.activeContent.entityType === 'ENEMY') {
                const type = this.activeContent.id === 'boss_joaozao' ? EnemyType.JOAOZAO : EnemyType.MINION;
                if (type === EnemyType.JOAOZAO) {
                    if (this.levelData.enemies.some(enemy => enemy.type === EnemyType.JOAOZAO)) return;
                    this.levelData.isBossLevel = true;
                    if (typeof document !== 'undefined') {
                        (document.getElementById('level-is-boss') as HTMLInputElement).checked = true;
                    }
                }
                this.levelData.enemies.push({
                    type: type,
                    position: { x: finalX, y: finalY }
                });
            } else if (this.activeContent.entityType === 'COLLECTIBLE') {
                const type = {
                    coin: CollectibleType.COIN,
                    mini_fanta: CollectibleType.MINI_FANTA,
                    helmet: CollectibleType.HELMET
                }[this.activeContent.id];
                if (!type || this.levelData.collectibles.some(item => item.type === type &&
                    item.position.x === finalX && item.position.y === finalY)) return;
                this.levelData.collectibles.push({ type, position: { x: finalX, y: finalY } });
            } else if (this.activeContent.entityType === 'CHECKPOINT') {
                if (!this.levelData.checkpoints.some(point => point.x === gridX && point.y === gridY)) {
                    this.levelData.checkpoints.push({ x: gridX, y: gridY });
                }
            } else if (this.activeContent.entityType === 'GOAL') {
                Object.assign(this.levelData.goalPosition, { x: gridX, y: gridY });
            }
        }
    }

    private handleEraserInteract(worldX: number, worldY: number) {
        if (!this.levelData) return;

        for (let i = this.isLogicMode() ? this.levelData.triggers.length - 1 : -1; i >= 0; i--) {
            const t = this.levelData.triggers[i];
            if (worldX >= t.x && worldX < t.x + t.width && worldY >= t.y && worldY < t.y + t.height) {
                this.levelData.triggers.splice(i, 1);
                this.activeSelection = null;
                this.updateInspector();
                return;
            }
        }
        for (let i = this.levelData.collectibles.length - 1; i >= 0; i--) {
            const rect = this.getEntityRect('COLLECTIBLE', this.levelData.collectibles[i]);
            if (worldX >= rect.x && worldX < rect.x + rect.w && worldY >= rect.y && worldY < rect.y + rect.h) {
                this.levelData.collectibles.splice(i, 1);
                this.activeSelection = null;
                this.updateInspector();
                return;
            }
        }

        for (let i = this.levelData.checkpoints.length - 1; i >= 0; i--) {
            const rect = this.getEntityRect('CHECKPOINT', this.levelData.checkpoints[i]);
            if (worldX >= rect.x && worldX < rect.x + rect.w && worldY >= rect.y && worldY < rect.y + rect.h) {
                this.levelData.checkpoints.splice(i, 1);
                this.activeSelection = null;
                this.updateInspector();
                return;
            }
        }

        for (let i = this.levelData.enemies.length - 1; i >= 0; i--) {
            const enemy = this.levelData.enemies[i];
            const rect = this.getEntityRect('ENEMY', enemy);
            if (worldX >= rect.x && worldX < rect.x + rect.w &&
                worldY >= rect.y && worldY < rect.y + rect.h) {
                this.levelData.enemies.splice(i, 1);
                if (enemy.type === EnemyType.JOAOZAO) {
                    this.levelData.isBossLevel = false;
                    if (typeof document !== 'undefined') {
                        (document.getElementById('level-is-boss') as HTMLInputElement).checked = false;
                    }
                }
                this.activeSelection = null;
                this.updateInspector();
                return;
            }
        }

        const goal = this.getEntityRect('GOAL', this.levelData.goalPosition);
        if (worldX >= goal.x && worldX < goal.x + goal.w && worldY >= goal.y && worldY < goal.y + goal.h) {
            this.showMessage('A fase precisa de um objetivo. Use seleção para movê-lo.');
            return;
        }

        // 2. Fallback: Erase Tile
        const originX = this.levelData.originX ?? 0;
        const originY = this.levelData.originY ?? 0;
        const col = Math.floor(worldX / TILE_SIZE) - originX;
        const row = Math.floor(worldY / TILE_SIZE) - originY;

        if (row >= 0 && row < this.levelData.tiles.length &&
            col >= 0 && col < this.levelData.tiles[0].length) {
            this.levelData.tiles[row][col] = TileType.EMPTY;
        }
    }

    private fitLevelToScreen(): void {
        if (!this.levelData) return;
        const rect = this.canvas.getBoundingClientRect();
        const width = this.levelData.width * TILE_SIZE;
        const height = this.levelData.height * TILE_SIZE;
        this.zoom = Math.max(0.03, Math.min(2, rect.width / (width * 1.1), rect.height / (height * 1.1)));
        this.camera.x = (this.levelData.originX ?? 0) * TILE_SIZE + width / 2 - rect.width / (2 * this.zoom);
        this.camera.y = (this.levelData.originY ?? 0) * TILE_SIZE + height / 2 - rect.height / (2 * this.zoom);
        this.uiZoomLabel.textContent = Math.round(this.zoom * 100) + '%';
        this.updateStatusBar();
    }

    // --- SELECTION LOGIC ---

    private isLogicMode(): boolean {
        return document.querySelector('.tab-btn[data-tab="tab-logic"]')?.classList.contains('active') ?? false;
    }

    private getEntityRect(type: 'ENEMY' | 'COLLECTIBLE' | 'SPAWN' | 'CHECKPOINT' | 'GOAL' | 'TRIGGER', data: any): { x: number, y: number, w: number, h: number } {
        // Spawn, checkpoints and goal are vectors; enemies and collectibles have positions.

        let tx = 0, ty = 0;

        if (type === 'SPAWN' || type === 'CHECKPOINT' || type === 'GOAL') {
            tx = data.x;
            ty = data.y;
        } else {
            tx = data.position?.x ?? 0;
            ty = data.position?.y ?? 0;
        }

        const x = tx * TILE_SIZE;
        const y = ty * TILE_SIZE;

        if (type === 'SPAWN') {
            return { x: x + PLAYER_RENDER_OFFSET_X, y: y + PLAYER_RENDER_OFFSET_Y, w: 14, h: 24 }; // Approx player size
        } else if (type === 'ENEMY') {
            const rect = enemySpawnRect(data.type, data.position);
            return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
        } else if (type === 'COLLECTIBLE') {
            return { x, y, w: 16, h: 16 };
        } else if (type === 'CHECKPOINT' || type === 'GOAL') {
            return { x, y, w: TILE_SIZE, h: TILE_SIZE };
        } else if (type === 'TRIGGER') {
            return { x: data.x, y: data.y, w: data.width, h: data.height };
        }
        return { x, y, w: 16, h: 16 };
    }

    private handleSelectClick(worldX: number, worldY: number) {
        if (!this.levelData) return;

        // Check priorities using helper: Spawn > Enemy > Collectible

        // 1. Spawn
        if (this.levelData.playerSpawn) {
            const rect = this.getEntityRect('SPAWN', this.levelData.playerSpawn);
            if (worldX >= rect.x && worldX < rect.x + rect.w &&
                worldY >= rect.y && worldY < rect.y + rect.h) {

                this.activeSelection = { type: 'SPAWN', data: this.levelData.playerSpawn };
                this.selectionDragOffset = { x: worldX - this.levelData.playerSpawn.x * TILE_SIZE,
                    y: worldY - this.levelData.playerSpawn.y * TILE_SIZE };
                this.isDragging = true;
                this.updateInspector();
                return;
            }
        }

        // 2. Enemies (Reverse order)
        if (this.levelData.enemies) {
            for (let i = this.levelData.enemies.length - 1; i >= 0; i--) {
                const e = this.levelData.enemies[i];
                const rect = this.getEntityRect('ENEMY', e);
                if (worldX >= rect.x && worldX < rect.x + rect.w &&
                    worldY >= rect.y && worldY < rect.y + rect.h) {
                    this.activeSelection = { type: 'ENEMY', data: e };
                    this.selectionDragOffset = { x: worldX - rect.x, y: worldY - rect.y };
                    this.isDragging = true;
                    this.updateInspector();

                    return;
                }
            }
        }

        // 3. Collectibles
        if (this.levelData.collectibles) {
            for (let i = this.levelData.collectibles.length - 1; i >= 0; i--) {
                const c = this.levelData.collectibles[i];
                const rect = this.getEntityRect('COLLECTIBLE', c);
                if (worldX >= rect.x && worldX < rect.x + rect.w &&
                    worldY >= rect.y && worldY < rect.y + rect.h) {
                    this.activeSelection = { type: 'COLLECTIBLE', data: c };
                    this.selectionDragOffset = { x: worldX - rect.x, y: worldY - rect.y };
                    this.isDragging = true;
                    this.updateInspector();

                    return;
                }
            }
        }

        for (let i = this.levelData.checkpoints.length - 1; i >= 0; i--) {
            const point = this.levelData.checkpoints[i];
            const rect = this.getEntityRect('CHECKPOINT', point);
            if (worldX >= rect.x && worldX < rect.x + rect.w && worldY >= rect.y && worldY < rect.y + rect.h) {
                this.activeSelection = { type: 'CHECKPOINT', data: point };
                this.selectionDragOffset = { x: worldX - rect.x, y: worldY - rect.y };
                this.isDragging = true;
                this.updateInspector();
                return;
            }
        }
        const goalRect = this.getEntityRect('GOAL', this.levelData.goalPosition);
        if (worldX >= goalRect.x && worldX < goalRect.x + goalRect.w &&
            worldY >= goalRect.y && worldY < goalRect.y + goalRect.h) {
            this.activeSelection = { type: 'GOAL', data: this.levelData.goalPosition };
            this.selectionDragOffset = { x: worldX - goalRect.x, y: worldY - goalRect.y };
            this.isDragging = true;
            this.updateInspector();
            return;
        }

        // 4. Triggers
        if (this.isLogicMode() && this.levelData.triggers) {
            for (let i = this.levelData.triggers.length - 1; i >= 0; i--) {
                const t = this.levelData.triggers[i];
                // Triggers are stored in world pixels directly, not tile units
                if (worldX >= t.x && worldX < t.x + t.width &&
                    worldY >= t.y && worldY < t.y + t.height) {

                    this.activeSelection = { type: 'TRIGGER', data: t };
                    this.selectionDragOffset = { x: worldX - t.x, y: worldY - t.y };
                    this.isDragging = true;
                    this.updateInspector();

                    return;
                }
            }
        }

        // Nothing hit
        this.activeSelection = null;
        this.updateInspector();
    }

    private drawSelectionGizmo(ctx: CanvasRenderingContext2D) {
        if (!this.activeSelection) return;

        let rect = { x: 0, y: 0, w: 0, h: 0 };
        // Pass the raw data object to helper
        rect = this.getEntityRect(this.activeSelection.type, this.activeSelection.data);

        // Convert to Screen
        const sx = rect.x - this.camera.x;
        const sy = rect.y - this.camera.y;

        ctx.save();
        ctx.strokeStyle = '#FFFF00'; // Yellow
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(sx, sy, rect.w, rect.h);

        // Handles
        ctx.fillStyle = '#FFFF00';
        const hSize = 4;
        ctx.fillRect(sx - hSize / 2, sy - hSize / 2, hSize, hSize); // TL
        ctx.fillRect(sx + rect.w - hSize / 2, sy - hSize / 2, hSize, hSize); // TR
        ctx.fillRect(sx - hSize / 2, sy + rect.h - hSize / 2, hSize, hSize); // BL
        ctx.fillRect(sx + rect.w - hSize / 2, sy + rect.h - hSize / 2, hSize, hSize); // BR

        ctx.restore();
    }

    private updateInspector() {
        if (!this.uiInspectorContent) return;
        this.uiInspectorContent.innerHTML = '';

        if (!this.activeSelection) {
            this.uiInspectorContent.innerHTML = '<div style="color:#666; padding:10px; font-size:11px;">Select an object</div>';
            return;
        }

        const data = this.activeSelection.data;
        const type = this.activeSelection.type;

        // Header
        const header = document.createElement('div');
        header.style.padding = '5px';
        header.style.borderBottom = '1px solid #444';
        header.style.marginBottom = '5px';
        header.style.fontSize = '12px';
        header.style.fontWeight = 'bold';
        header.style.color = '#fff';
        header.innerText = `${type}`;
        this.uiInspectorContent.appendChild(header);

        if (type === 'TRIGGER') {
            // Basic Transform
            this.createInspectorInput('X', data.x, (v) => data.x = parseFloat(v));
            this.createInspectorInput('Y', data.y, (v) => data.y = parseFloat(v));
            this.createInspectorInput('Width', data.width, (v) => data.width = parseFloat(v));
            this.createInspectorInput('Height', data.height, (v) => data.height = parseFloat(v));

            const trigger = data as LevelTrigger;
            this.createInspectorCheckbox('Ativo', trigger.active, value => trigger.active = value);
            this.createInspectorCheckbox('Uma vez', trigger.oneShot, value => trigger.oneShot = value);
            // Trigger Specifics
            if (trigger.type === TriggerType.AUDIO) {
                this.createInspectorSelect('Track ID', Object.keys(MUSIC_TRACKS), trigger.trackId, v => trigger.trackId = v);
                this.createInspectorSelect('Action', ['PLAY', 'STOP'], (trigger as any).action, (v) => (trigger as any).action = v);
            }
            else if (trigger.type === TriggerType.CAMERA) {
                this.createInspectorInput('Zoom', (trigger as any).zoom, (v) => (trigger as any).zoom = parseFloat(v));
                this.createInspectorCheckbox('Lock X', (trigger as any).lockX, (v) => (trigger as any).lockX = v);
                this.createInspectorCheckbox('Lock Y', (trigger as any).lockY, (v) => (trigger as any).lockY = v);
            }
            else if (trigger.type === TriggerType.DAMAGE) {
                this.createInspectorInput('Dmg/Tick', (trigger as any).damagePerTick, (v) => (trigger as any).damagePerTick = parseFloat(v));
                this.createInspectorCheckbox('Instant Kill', (trigger as any).instantKill, (v) => (trigger as any).instantKill = v);
            }
            else if (trigger.type === TriggerType.DIALOG) {
                this.createInspectorTextArea('Text', (trigger as any).text, (v) => (trigger as any).text = v);
            }
        }
        else if (type === 'ENEMY' || type === 'COLLECTIBLE') {
            const e = data;
            // Coordinate in TILES not pixels for enemies usually, but getEntityRect uses position directly.
            // Let's assume data.position.x is tiles.
            this.createInspectorInput('X (Tiles)', e.position.x, (v) => e.position.x = parseFloat(v));
            this.createInspectorInput('Y (Tiles)', e.position.y, (v) => e.position.y = parseFloat(v));

        }
        else if (type === 'SPAWN' || type === 'CHECKPOINT' || type === 'GOAL') {
            this.createInspectorInput('X (Tiles)', data.x, (v) => data.x = parseFloat(v));
            this.createInspectorInput('Y (Tiles)', data.y, (v) => data.y = parseFloat(v));
        }
    }

    private createInspectorInput(label: string, value: any, onChange: (val: string) => void) {
        const row = document.createElement('div');
        row.className = 'control-row';

        const lbl = document.createElement('label');
        lbl.innerText = label;

        const input = document.createElement('input');
        input.type = typeof value === 'number' ? 'number' : 'text';
        input.value = value;
        input.style.width = '60%';
        input.style.background = '#222';
        input.style.border = '1px solid #444';
        input.style.color = 'white';
        input.style.padding = '2px';

        input.setAttribute('aria-label', label);
        input.onchange = () => {
            if (input.type === 'number') {
                const number = Number(input.value);
                const positive = ['Width', 'Height', 'Zoom'].includes(label);
                if (!input.value.trim() || !Number.isFinite(number) || (positive && number <= 0) || (label === 'Dmg/Tick' && number < 0)) {
                    input.value = String(value);
                    this.showMessage('Informe um número válido para ' + label + '.');
                    return;
                }
            }
            onChange(input.value);
            value = input.type === 'number' ? Number(input.value) : input.value;
        };

        row.appendChild(lbl);
        row.appendChild(input);
        this.uiInspectorContent.appendChild(row);
    }

    private createInspectorSelect(label: string, options: string[], value: string, onChange: (val: string) => void) {
        const row = document.createElement('div');
        row.className = 'control-row';

        const lbl = document.createElement('label');
        lbl.innerText = label;

        const select = document.createElement('select');
        select.style.width = '60%';

        options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt;
            o.innerText = opt;
            o.selected = opt === value;
            select.appendChild(o);
        });

        select.onchange = (e) => onChange((e.target as HTMLSelectElement).value);

        row.appendChild(lbl);
        row.appendChild(select);
        this.uiInspectorContent.appendChild(row);
    }

    private createInspectorCheckbox(label: string, value: boolean, onChange: (val: boolean) => void) {
        const row = document.createElement('div');
        row.className = 'control-row checkbox-row';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = value;
        input.id = `chk-${label.replace(/\s+/g, '')}`;

        const lbl = document.createElement('label');
        lbl.innerText = label;
        lbl.htmlFor = input.id;

        input.onchange = (e) => onChange((e.target as HTMLInputElement).checked);

        row.appendChild(input);
        row.appendChild(lbl);
        this.uiInspectorContent.appendChild(row);
    }

    private createInspectorTextArea(label: string, value: string, onChange: (val: string) => void) {
        const div = document.createElement('div');
        div.style.marginBottom = '5px';

        const lbl = document.createElement('label');
        lbl.innerText = label;
        lbl.style.display = 'block';
        lbl.style.marginBottom = '2px';
        lbl.style.fontSize = '11px';
        lbl.style.color = '#ccc';

        const txt = document.createElement('textarea');
        txt.value = value;
        txt.style.width = '100%';
        txt.style.height = '60px';
        txt.style.background = '#222';
        txt.style.border = '1px solid #444';
        txt.style.color = 'white';
        txt.style.padding = '4px';
        txt.style.fontSize = '11px';
        txt.style.fontFamily = 'monospace';

        txt.onchange = (e) => onChange((e.target as HTMLTextAreaElement).value);

        div.appendChild(lbl);
        div.appendChild(txt);
        this.uiInspectorContent.appendChild(div);
    }
}
