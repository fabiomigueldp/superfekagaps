import { CameraData, LevelData, Vector2, EnemyType, CollectibleType } from '../types';
import { FileSystemManager } from './FileSystemManager';
import { TileType, TILE_SIZE, COLORS, GAME_WIDTH, GAME_HEIGHT } from '../constants';
import { Renderer } from '../engine/Renderer';

export class EditorController {
    public camera: CameraData;
    public fs: FileSystemManager;
    public levelData: LevelData | null = null;
    public selectedTile: number = 1; // Default to Ground
    public currentLevelFilename: string = '';

    private isDragging: boolean = false;
    private lastMousePos: Vector2 = { x: 0, y: 0 };
    private canvas: HTMLCanvasElement;
    private scale: number = 1; // Used for coordinate mapping (Window -> Game Resolution)
    private zoom: number = 1; // Used for visual zoom (Game Resolution -> View)

    // Bounds Visualization
    private showBounds: boolean = true;
    private dimOutside: boolean = true;
    private showCoords: boolean = false;
    private boundsColor: string = '#00FFFF'; // Cyan
    private boundsThickness: number = 2;

    // Hover State for coordinates display
    private hoveredCol: number = -1;
    private hoveredRow: number = -1;

    // Bounds Edge Drag State
    private isResizingBounds: boolean = false;
    private activeEdge: 'right' | 'bottom' | 'corner' | null = null;
    private hoveredEdge: 'right' | 'bottom' | 'corner' | null = null;
    private readonly EDGE_THRESHOLD: number = 8; // pixels to detect edge hover

    // UI Elements
    private uiMountBtn: HTMLButtonElement;
    private uiSaveBtn: HTMLButtonElement;
    private uiLevelList: HTMLDivElement;
    private uiPalette: HTMLDivElement;
    private uiFileLabel: HTMLSpanElement;
    private uiShowBgChk: HTMLInputElement;
    private uiZoomLabel: HTMLSpanElement;
    private uiBoundsWidth: HTMLInputElement;
    private uiBoundsHeight: HTMLInputElement;
    private uiShowBoundsChk: HTMLInputElement;
    private uiDimOutsideChk: HTMLInputElement;
    private uiShowCoordsChk: HTMLInputElement;
    private uiBoundsInfoSize: HTMLSpanElement;
    private uiBoundsInfoPixels: HTMLSpanElement;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.fs = new FileSystemManager();

        // Initialize default blank level (width/height in TILES, not pixels!)
        this.levelData = {
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
            goalPosition: { x: 95, y: 11 },
            timeLimit: 300,
            isBossLevel: false
        };

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
        this.uiFileLabel = document.getElementById('current-file-label') as HTMLSpanElement;
        this.uiShowBgChk = document.getElementById('chk-show-bg') as HTMLInputElement;
        this.uiZoomLabel = document.getElementById('zoom-level') as HTMLSpanElement;

        // Bounds UI Elements
        this.uiBoundsWidth = document.getElementById('bounds-width') as HTMLInputElement;
        this.uiBoundsHeight = document.getElementById('bounds-height') as HTMLInputElement;
        this.uiShowBoundsChk = document.getElementById('chk-show-bounds') as HTMLInputElement;
        this.uiDimOutsideChk = document.getElementById('chk-dim-outside') as HTMLInputElement;
        this.uiShowCoordsChk = document.getElementById('chk-show-coords') as HTMLInputElement;
        this.uiBoundsInfoSize = document.getElementById('bounds-info-size') as HTMLSpanElement;
        this.uiBoundsInfoPixels = document.getElementById('bounds-info-pixels') as HTMLSpanElement;

        this.bindEvents();
        this.buildPalette();
        this.updateBoundsUI();
    }

    private bindEvents() {
        // ... (Canvas events preserved via logic, but overwriting block method)
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());

        this.uiMountBtn.addEventListener('click', async () => {
            const success = await this.fs.mount();
            if (success) {
                this.refreshLevelList();
                this.selectTab('tab-levels');
            }
        });

        this.uiSaveBtn.addEventListener('click', async () => {
            if (this.currentLevelFilename && this.levelData) {
                await this.fs.saveLevel(this.currentLevelFilename, this.levelData);
                alert('Saved!');
            }
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
        });

        // Sky Inputs
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

        this.uiShowCoordsChk?.addEventListener('change', () => {
            this.showCoords = this.uiShowCoordsChk.checked;
        });

        // Action buttons
        document.getElementById('btn-fit-content')?.addEventListener('click', () => {
            this.fitToContent();
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
                skyGradient: [COLORS.SKY_LIGHT, COLORS.SKY_DARK],
                layers: []
            };
        }
    }

    private updateTheme() {
        const renderer = (window as any).renderer as Renderer;
        if (renderer && this.levelData && this.levelData.theme) {
            renderer.prepareLevelBackground(this.levelData.theme);
        }
    }

    // ===== BOUNDS MANAGEMENT METHODS =====

    private updateBoundsUI(): void {
        if (!this.levelData) return;

        const width = this.levelData.tiles[0]?.length || 100;
        const height = this.levelData.tiles.length;

        // Update input fields
        if (this.uiBoundsWidth) this.uiBoundsWidth.value = width.toString();
        if (this.uiBoundsHeight) this.uiBoundsHeight.value = height.toString();

        // Update info display
        if (this.uiBoundsInfoSize) {
            this.uiBoundsInfoSize.textContent = `Size: ${width} × ${height} tiles`;
        }
        if (this.uiBoundsInfoPixels) {
            this.uiBoundsInfoPixels.textContent = `${width * TILE_SIZE} × ${height * TILE_SIZE} px`;
        }

        // Sync width/height in LevelData
        this.levelData.width = width;
        this.levelData.height = height;
    }

    private resizeTileGrid(newWidth: number, newHeight: number): void {
        if (!this.levelData) return;

        const oldTiles = this.levelData.tiles;
        const oldHeight = oldTiles.length;
        const oldWidth = oldTiles[0]?.length || 0;

        // Don't do anything if size hasn't changed
        if (newWidth === oldWidth && newHeight === oldHeight) return;

        const newTiles: number[][] = [];

        for (let row = 0; row < newHeight; row++) {
            const newRow: number[] = [];
            for (let col = 0; col < newWidth; col++) {
                // Copy existing tiles or fill with EMPTY
                if (row < oldHeight && col < oldWidth) {
                    newRow.push(oldTiles[row][col]);
                } else {
                    newRow.push(TileType.EMPTY);
                }
            }
            newTiles.push(newRow);
        }

        this.levelData.tiles = newTiles;
        this.levelData.width = newWidth;
        this.levelData.height = newHeight;

        // Update UI
        this.updateBoundsUI();

        console.log(`📐 Resized level to ${newWidth}×${newHeight} tiles`);
    }

    private fitToContent(): void {
        if (!this.levelData) return;

        const tiles = this.levelData.tiles;
        let maxCol = 0;
        let maxRow = 0;

        // Find the furthest non-empty tile
        for (let row = 0; row < tiles.length; row++) {
            for (let col = 0; col < tiles[row].length; col++) {
                if (tiles[row][col] !== TileType.EMPTY) {
                    maxCol = Math.max(maxCol, col);
                    maxRow = Math.max(maxRow, row);
                }
            }
        }

        // Also consider entities (positions are in tile coordinates)
        this.levelData.enemies.forEach(e => {
            maxCol = Math.max(maxCol, Math.floor(e.position.x));
            maxRow = Math.max(maxRow, Math.floor(e.position.y));
        });

        this.levelData.collectibles.forEach(c => {
            maxCol = Math.max(maxCol, Math.floor(c.position.x));
            maxRow = Math.max(maxRow, Math.floor(c.position.y));
        });

        // Consider goal position
        maxCol = Math.max(maxCol, Math.floor(this.levelData.goalPosition.x));
        maxRow = Math.max(maxRow, Math.floor(this.levelData.goalPosition.y));

        // Consider checkpoints
        this.levelData.checkpoints.forEach(cp => {
            maxCol = Math.max(maxCol, Math.floor(cp.x));
            maxRow = Math.max(maxRow, Math.floor(cp.y));
        });

        // Precise fit: maxCol/maxRow are 0-indexed, so +1 gives exact count
        // Add only +1 to include the last tile fully (no extra margin)
        const newWidth = Math.max(10, maxCol + 1);
        const newHeight = Math.max(5, maxRow + 1);

        this.resizeTileGrid(newWidth, newHeight);

        console.log(`✂️ Fit to content: ${newWidth}×${newHeight} tiles`);
    }

    private populateThemeEditor() {
        if (!this.levelData) return;
        this.ensureTheme();
        const theme = this.levelData.theme!;

        // Sky
        (document.getElementById('theme-sky-top') as HTMLInputElement).value = theme.skyGradient[0];
        (document.getElementById('theme-sky-bottom') as HTMLInputElement).value = theme.skyGradient[1];

        // Layers
        const list = document.getElementById('theme-layers-list')!;
        list.innerHTML = '';

        theme.layers.forEach((layer, index) => {
            const div = document.createElement('div');
            div.className = 'layer-item';
            div.innerHTML = `
                <div class="control-row">
                    <label>Type</label>
                     <select class="layer-type" data-idx="${index}">
                        <option value="mountains" ${layer.type === 'mountains' ? 'selected' : ''}>Mountains</option>
                        <option value="hills" ${layer.type === 'hills' ? 'selected' : ''}>Hills</option>
                        <option value="clouds" ${layer.type === 'clouds' ? 'selected' : ''}>Clouds</option>
                        <option value="city" ${layer.type === 'city' ? 'selected' : ''}>City</option>
                        <option value="castle_wall" ${layer.type === 'castle_wall' ? 'selected' : ''}>Castle</option>
                     </select>
                     <button class="mini-btn remove" data-idx="${index}">x</button>
                </div>
                <div class="control-row">
                    <label>Color</label>
                    <input type="color" class="layer-color" data-idx="${index}" value="${layer.color}">
                </div>
                <div class="control-row">
                    <label>Parallax</label>
                    <input type="range" class="layer-scroll" data-idx="${index}" min="0" max="1" step="0.1" value="${layer.scrollFactor}">
                    <span>${layer.scrollFactor}</span>
                </div>
            `;
            list.appendChild(div);
        });

        // Bind dynamic inputs
        list.querySelectorAll('.layer-type').forEach(el => {
            el.addEventListener('change', (e) => {
                const idx = parseInt((e.target as HTMLElement).dataset.idx!);
                theme.layers[idx].type = (e.target as HTMLSelectElement).value as any;
                this.updateTheme();
            });
        });
        list.querySelectorAll('.layer-color').forEach(el => {
            el.addEventListener('input', (e) => {
                const idx = parseInt((e.target as HTMLElement).dataset.idx!);
                theme.layers[idx].color = (e.target as HTMLInputElement).value;
                this.updateTheme();
            });
        });
        list.querySelectorAll('.layer-scroll').forEach(el => {
            el.addEventListener('input', (e) => {
                const idx = parseInt((e.target as HTMLElement).dataset.idx!);
                const val = parseFloat((e.target as HTMLInputElement).value);
                theme.layers[idx].scrollFactor = val;
                ((e.target as HTMLElement).nextElementSibling as HTMLSpanElement).innerText = val.toFixed(1);
                // Parallax changes don't need texture regen, but `prepare` sets up the layers array logic.
                this.updateTheme();
            });
        });
        list.querySelectorAll('.remove').forEach(el => {
            el.addEventListener('click', (e) => {
                const idx = parseInt((e.target as HTMLElement).dataset.idx!);
                theme.layers.splice(idx, 1);
                this.populateThemeEditor();
                this.updateTheme();
            });
        });


    }

    private buildPalette() {
        this.uiPalette.innerHTML = '';

        // Manual list of interesting tiles for editing
        const tiles = [
            { id: TileType.EMPTY, label: 'Erase' },
            { id: TileType.GROUND, label: 'Ground' },
            { id: TileType.BRICK, label: 'Brick' },
            { id: TileType.BRICK_BREAKABLE, label: 'Break' },
            { id: TileType.POWERUP_BLOCK_MINI_FANTA, label: 'Blk Fanta' },
            { id: TileType.POWERUP_BLOCK_HELMET, label: 'Blk Helm' },
            { id: TileType.PLATFORM, label: 'Plat' },
            { id: TileType.PLATFORM_FALLING, label: 'Fall' },
            { id: TileType.SPIKE, label: 'Spike' },
            { id: TileType.ICE, label: 'Ice' },
            { id: TileType.SPRING, label: 'Spring' },
            { id: TileType.LAVA_TOP, label: 'Lava Top' },
            { id: TileType.LAVA_FILL, label: 'Lava Fill' },
            { id: TileType.COIN, label: 'Coin' },
            { id: TileType.POWERUP_MINI_FANTA, label: 'Item Fanta' },
            { id: TileType.POWERUP_HELMET, label: 'Item Helm' },
            { id: TileType.HIDDEN_BLOCK, label: 'Hidden' },
            { id: TileType.CHECKPOINT, label: 'Check' },
            { id: TileType.FLAG, label: 'Goal' },
            { id: 999, label: 'Minion' }
        ];
        const renderer = (window as any).renderer as Renderer; // Access global renderer for thumbnails

        tiles.forEach(t => {
            const btn = document.createElement('div');
            btn.className = 'tile-btn';

            // Create mini canvas for thumbnail
            const thumb = document.createElement('canvas');
            thumb.width = TILE_SIZE * 2; // 2x Zoom for clarity
            thumb.height = TILE_SIZE * 2;
            thumb.style.imageRendering = 'pixelated';
            thumb.style.marginBottom = '5px';

            // Draw thumbnail
            if (renderer && t.id !== TileType.EMPTY) {
                const ctx = thumb.getContext('2d')!;
                ctx.scale(2, 2); // Scale up for visibility

                // Hack: We need 'tiles' context for some (like Ground), passing dummy
                const dummyGrid = [[t.id], [TileType.EMPTY]];

                // Special handling for Entity-Tiles
                // Special handling for Entity-Tiles
                if (t.id === TileType.COIN) renderer.drawCoin(0, 0, 0, ctx);
                else if (t.id === TileType.POWERUP_MINI_FANTA) renderer.drawFanta(0, 0, 0, ctx);
                else if (t.id === TileType.POWERUP_HELMET) renderer.drawHelmet(0, 0, ctx);
                else if (t.id === TileType.HIDDEN_BLOCK) {
                    ctx.globalAlpha = 0.5;
                    renderer.drawTile(TileType.BRICK, 0, 0, dummyGrid, 0, 0, ctx);
                }
                else if (t.id === TileType.CHECKPOINT) renderer['drawFlagTile'](0, 0, ctx);
                else if (t.id === 999) {
                    // Virtual Minion ID
                    const mockEnemy: any = {
                        type: EnemyType.MINION,
                        position: { x: 0, y: 0 },
                        active: true, facingRight: false, isDead: false, width: 16, height: 16, animationTimer: 0, animationFrame: 0
                    };
                    const mockCam: any = { x: 0, y: 0 };
                    renderer.drawEnemy(mockEnemy, mockCam, ctx);
                }
                else {
                    renderer.drawTile(t.id, 0, 0, dummyGrid, 0, 0, ctx);
                }
            } else {
                // Empty / Eraser visual
                const ctx = thumb.getContext('2d')!;
                ctx.fillStyle = '#333';
                ctx.fillRect(0, 0, 32, 32);
                ctx.strokeStyle = '#555';
                ctx.strokeRect(0, 0, 32, 32);
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(32, 32); ctx.stroke();
            }

            btn.appendChild(thumb);

            const label = document.createElement('span');
            label.innerText = t.label;
            label.style.fontSize = '10px';
            btn.appendChild(label);

            btn.onclick = () => {
                this.selectedTile = t.id;
                // Visual selection
                Array.from(this.uiPalette.children).forEach(c => c.classList.remove('selected'));
                btn.classList.add('selected');
            };
            this.uiPalette.appendChild(btn);
        });
    }

    private async refreshLevelList() {
        if (!this.fs.isMounted) return;

        const files = await this.fs.listLevels();
        this.uiLevelList.innerHTML = '';

        files.forEach(file => {
            const div = document.createElement('div');
            div.className = 'level-list-item';
            div.innerText = file;
            div.onclick = async () => {
                // Load Level Logic
                // In a real implementation we would parse the TS file. 
                // For now, we unfortunately can't 'read' the TS file in browser easily without an AST parser 
                // unless we export as JSON.
                // fallback: We just set the name for saving, but we can't 'load' the visuals back from disk 
                // without more advanced logic (like dynamic import() which implies module loading).

                // WORKAROUND for Internal Tool: 
                // We assume the game has loaded ALL_LEVELS via import. 
                // We find the matching LevelData by some heuristic or ID.
                // Since we split files `level_0_world1 - 1.ts`, we can try to match the ID.

                this.currentLevelFilename = file;
                this.uiFileLabel.innerText = file;

                // Attempt to "Read" the file text (which we can do via FS API)
                // and extract the JSON object via Regex (hacky but works for this tool)
                const text = await this.fs.readFile(file) as string;
                this.levelData = this.parseLevelFromText(text);

                // Initialize Theme Editor with data
                this.populateThemeEditor();
                this.updateTheme(); // Force render of background
                this.updateBoundsUI(); // Sync bounds UI with loaded level
            };
            this.uiLevelList.appendChild(div);
        });
    }

    private parseLevelFromText(text: string): LevelData | null {
        try {
            // Find the JSON object part: "export const DATA: LevelData = { ... };"
            // We look for the first '{' and the last '}'
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start === -1 || end === -1) return null;

            let jsonStr = text.substring(start, end + 1);

            // JSON.parse is strict. We probably have mostly valid JSON 
            // EXCEPT for unquoted keys if we formatted nicely, OR standard objects.
            // Our serializer creates valid JSON mainly, but we might have issues with Enums or comments.
            // Ideally we should use a proper parser or just eval() since this is internal local tool.

            // Safety/Hack: Use Function constructor to evaluate object literal
            // We need to provide context for any Enums used (EnemyType.MINION)
            // We can naive-replace "EnemyType.MINION" with string "MINION" if needed

            return new Function(`return ${jsonStr} `)();

        } catch (e) {
            console.warn('Regex parsing failed, trying eval with context', e);

            // Fallback: Safe Eval with Context
            try {
                // Remove imports to avoid syntax errors in eval
                const CleanLines = text.split('\n').filter(l => !l.trim().startsWith('import '));
                let CleanText = CleanLines.join('\n');

                // We need to capture the variable 'DATA' if it is defined as "const DATA = ..."
                // Easy hack: Replace "const DATA" with "return " if it's the last export?
                // Or just append "; return DATA;" at the end.

                // We replace "export const DATA: LevelData =" (or without type) with "const DATA ="
                // Matches: export const DATA (: Type)? =
                CleanText = CleanText.replace(/export\s+const\s+DATA(\s*:\s*\w+)?\s*=/g, 'const DATA =');

                CleanText += ';\nreturn DATA;'; // Return the specific object we expect

                const func = new Function(
                    'TileType', 'EnemyType', 'CollectibleType', 'COLORS', 'TILE_SIZE', 'GAME_WIDTH', 'GAME_HEIGHT',
                    CleanText
                );

                return func(TileType, EnemyType, CollectibleType, COLORS, TILE_SIZE, GAME_WIDTH, GAME_HEIGHT);

            } catch (evalErr) {
                console.error('Context Eval failed:', evalErr);
                return null;
            }
        }
    }

    public init() {
        // show ui
        const ui = document.getElementById('editor-ui');
        if (ui) ui.classList.add('active');
    }

    public update(_deltaTime: number) {
        // Editor update
    }

    public render(renderer: Renderer) {
        // In TS we can cast to any to bypass privacy for this tool
        // HIGH-DPI UPDATE: We now draw directly to the MAIN canvas (ctx) to ensure crisp rendering
        // bypassing the low-res offscreen buffer.

        // We need to access 'ctx' and 'scale' from renderer
        const mainCtx = (renderer as any).ctx as CanvasRenderingContext2D;
        const deviceScale = (renderer as any).scale as number;

        // Clear Main Canvas (as we are taking over control)
        mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);

        // Effective Zoom = Editor Zoom * Device Up-Scale
        // Since the game is 320x180 but screen is e.g. 1920x1080 (6x),
        // we need to scale up our drawing so a 16px tile looks correct on the big screen.
        const finalZoom = this.zoom * deviceScale;

        mainCtx.save();
        mainCtx.scale(finalZoom, finalZoom);

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
        }

        // 3. Draw Grid
        this.drawGrid(mainCtx);

        // 4. Draw Bounds Frame
        if (this.showBounds) {
            this.drawBoundsFrame(mainCtx);
        }

        mainCtx.restore();

        // 5. Draw Editor HUD (coordinates display) - in screen space
        if (this.showCoords) {
            this.drawEditorHUD(mainCtx, deviceScale);
        }
    }

    private renderEditorView(ctx: CanvasRenderingContext2D, renderer: Renderer) {
        if (!this.levelData) return;
        const tiles = this.levelData.tiles;

        // Visual region uses ZOOM-adjusted visible area
        // We use the transform from the context to be accurate
        const t = ctx.getTransform();
        const visibleWidth = ctx.canvas.width / t.a;
        const visibleHeight = ctx.canvas.height / t.d;

        const startCol = Math.floor(this.camera.x / TILE_SIZE);
        const endCol = startCol + Math.ceil(visibleWidth / TILE_SIZE) + 1;
        const startRow = Math.floor(this.camera.y / TILE_SIZE);
        const endRow = startRow + Math.ceil(visibleHeight / TILE_SIZE) + 1;

        // 1. Draw Tiles
        for (let r = startRow; r < endRow; r++) {
            if (r < 0 || r >= tiles.length) continue;
            for (let c = startCol; c < endCol; c++) {
                if (c < 0 || c >= tiles[0].length) continue;
                const tile = tiles[r][c];
                const x = Math.floor(c * TILE_SIZE - this.camera.x);
                const y = Math.floor(r * TILE_SIZE - this.camera.y);

                if (tile !== 0) {
                    // Special Handling for Editor-Only Visuals
                    if (tile === TileType.HIDDEN_BLOCK) {
                        ctx.save();
                        ctx.globalAlpha = 0.5; // Ghost mode
                        renderer.drawTile(TileType.BRICK, x, y, tiles, r, c, ctx);
                        ctx.restore();
                    }
                    else if (tile === TileType.COIN) {
                        // Manually draw coin entity sprite with correct context
                        (renderer as any).drawCoin(x, y, 0, ctx);
                    }
                    else if (tile === TileType.POWERUP_MINI_FANTA) {
                        (renderer as any).drawFanta(x, y, 0, ctx);
                    }
                    else if (tile === TileType.POWERUP_HELMET) {
                        (renderer as any).drawHelmet(x, y, ctx);
                    }
                    else if (tile === TileType.CHECKPOINT) {
                        (renderer as any).drawFlagTile(x, y, ctx);
                    }
                    else {
                        renderer.drawTile(tile, x, y, tiles, r, c, ctx);
                    }
                }
            }
        }

        // 2. Draw Entities (Enemies, Collectibles from the Lists)
        // Note: These lists are populated in DATA, but sometimes we edit via Tiles.
        // If we want to visualize pre-placed entities:

        if (this.levelData.enemies) {
            this.levelData.enemies.forEach(e => {
                // Mock Enemy Data for Renderer
                const mockEnemy: any = {
                    type: e.type,
                    position: { x: e.position.x * TILE_SIZE, y: e.position.y * TILE_SIZE },
                    active: true,
                    facingRight: false,
                    isDead: false,
                    width: 16, height: 16,
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

        // Bounds position in screen coordinates
        const boundsLeft = -this.camera.x;
        const boundsTop = -this.camera.y;
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

        // Position in screen space
        const x = -this.camera.x;
        const y = -this.camera.y;

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

        // Draw size label near top-left
        ctx.font = `${10 / transform.a}px Consolas`;
        ctx.fillStyle = this.boundsColor;
        const label = `${this.levelData.tiles[0]?.length || 0} × ${this.levelData.tiles.length}`;
        ctx.fillText(label, x + 4 / transform.a, y - 4 / transform.a);
    }

    private drawEditorHUD(ctx: CanvasRenderingContext2D, deviceScale: number): void {
        // Draw in screen space (not scaled)
        const hudHeight = 24 * deviceScale;
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Account for sidebar width (250px)
        const sidebarWidth = 250 * deviceScale;
        const hudWidth = canvasWidth - sidebarWidth;

        // Background bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, canvasHeight - hudHeight, hudWidth, hudHeight);

        // Border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvasHeight - hudHeight);
        ctx.lineTo(hudWidth, canvasHeight - hudHeight);
        ctx.stroke();

        // Text
        const fontSize = 11 * deviceScale;
        ctx.font = `${fontSize}px Consolas, monospace`;
        ctx.textBaseline = 'middle';

        const textY = canvasHeight - hudHeight / 2;
        let textX = 10 * deviceScale;

        // Mouse coordinates
        ctx.fillStyle = '#0FF';
        const coordText = `Tile: (${this.hoveredCol}, ${this.hoveredRow})`;
        ctx.fillText(coordText, textX, textY);
        textX += ctx.measureText(coordText).width + 20 * deviceScale;

        // Separator
        ctx.fillStyle = '#444';
        ctx.fillText('│', textX, textY);
        textX += 20 * deviceScale;

        // Level size
        if (this.levelData) {
            ctx.fillStyle = '#888';
            const width = this.levelData.tiles[0]?.length || 0;
            const height = this.levelData.tiles.length;
            const sizeText = `Level: ${width}×${height} tiles`;
            ctx.fillText(sizeText, textX, textY);
            textX += ctx.measureText(sizeText).width + 20 * deviceScale;

            // Separator
            ctx.fillStyle = '#444';
            ctx.fillText('│', textX, textY);
            textX += 20 * deviceScale;
        }

        // Zoom
        ctx.fillStyle = '#888';
        const zoomText = `Zoom: ${Math.round(this.zoom * 100)}%`;
        ctx.fillText(zoomText, textX, textY);
    }


    private onMouseDown(e: MouseEvent) {
        this.updateScale();
        const startX = e.offsetX / this.scale;
        const startY = e.offsetY / this.scale;

        // Calculate world coordinates for edge detection
        const worldX = (startX / this.zoom) + this.camera.x;
        const worldY = (startY / this.zoom) + this.camera.y;

        // Left click: Check for bounds edge first, then paint
        if (e.button === 0) {
            const edge = this.detectBoundsEdge(worldX, worldY);
            if (edge) {
                // Start bounds resize
                this.isResizingBounds = true;
                this.activeEdge = edge;
                this.isDragging = true;
            } else {
                // Normal paint
                this.paintTile(startX, startY);
                this.isDragging = true;
            }
        }
        // Right click: Pan Start
        if (e.button === 2) {
            this.isDragging = true;
        }
        this.lastMousePos = { x: startX, y: startY };
    }

    private updateScale() {
        const rect = this.canvas.getBoundingClientRect();
        // Assuming aspect ratio is maintained, scale is width based
        this.scale = rect.width / GAME_WIDTH; // e.g. 960 / 320 = 3
    }

    private onMouseMove(e: MouseEvent) {
        this.updateScale();
        const currentX = e.offsetX / this.scale;
        const currentY = e.offsetY / this.scale;

        // Always track hovered tile for HUD display
        const worldX = (currentX / this.zoom) + this.camera.x;
        const worldY = (currentY / this.zoom) + this.camera.y;
        this.hoveredCol = Math.floor(worldX / TILE_SIZE);
        this.hoveredRow = Math.floor(worldY / TILE_SIZE);

        // Detect edge hover for cursor change
        this.hoveredEdge = this.detectBoundsEdge(worldX, worldY);
        this.updateCursor();

        // Handle bounds resize dragging
        if (this.isResizingBounds && this.activeEdge && e.buttons === 1) {
            this.handleBoundsResize(worldX, worldY);
            this.lastMousePos = { x: currentX, y: currentY };
            return;
        }

        if (!this.isDragging) return;

        // Panning
        if (e.buttons === 2) {
            const dx = (currentX - this.lastMousePos.x) / this.zoom;
            const dy = (currentY - this.lastMousePos.y) / this.zoom;
            this.camera.x -= dx;
            this.camera.y -= dy;
        }

        // Painting (only if not resizing bounds)
        if (e.buttons === 1 && !this.isResizingBounds) {
            this.paintTile(currentX, currentY);
        }

        this.lastMousePos = { x: currentX, y: currentY };
    }

    private onMouseUp(_e: MouseEvent) {
        this.isDragging = false;
        this.isResizingBounds = false;
        this.activeEdge = null;
    }

    private detectBoundsEdge(worldX: number, worldY: number): 'right' | 'bottom' | 'corner' | null {
        if (!this.levelData || !this.showBounds) return null;

        const boundsWidth = (this.levelData.tiles[0]?.length || 0) * TILE_SIZE;
        const boundsHeight = this.levelData.tiles.length * TILE_SIZE;

        // Threshold in world coordinates (scaled by zoom)
        const threshold = this.EDGE_THRESHOLD / this.zoom;

        // Check corner first (has priority)
        const nearRight = Math.abs(worldX - boundsWidth) < threshold;
        const nearBottom = Math.abs(worldY - boundsHeight) < threshold;

        if (nearRight && nearBottom) {
            return 'corner';
        }

        // Check right edge (within vertical bounds)
        if (nearRight && worldY >= 0 && worldY <= boundsHeight) {
            return 'right';
        }

        // Check bottom edge (within horizontal bounds)
        if (nearBottom && worldX >= 0 && worldX <= boundsWidth) {
            return 'bottom';
        }

        return null;
    }

    private handleBoundsResize(worldX: number, worldY: number): void {
        if (!this.levelData || !this.activeEdge) return;

        const currentWidth = this.levelData.tiles[0]?.length || 100;
        const currentHeight = this.levelData.tiles.length;

        // Calculate new size based on mouse position (snap to grid)
        const newWidth = this.activeEdge === 'right' || this.activeEdge === 'corner'
            ? Math.max(10, Math.ceil(worldX / TILE_SIZE))
            : currentWidth;

        const newHeight = this.activeEdge === 'bottom' || this.activeEdge === 'corner'
            ? Math.max(5, Math.ceil(worldY / TILE_SIZE))
            : currentHeight;

        // Only resize if changed (to avoid excessive updates)
        if (newWidth !== currentWidth || newHeight !== currentHeight) {
            this.resizeTileGrid(newWidth, newHeight);
        }
    }

    private updateCursor(): void {
        if (!this.canvas) return;

        if (this.isResizingBounds) {
            // Keep resize cursor while dragging
            if (this.activeEdge === 'corner') {
                this.canvas.style.cursor = 'nwse-resize';
            } else if (this.activeEdge === 'right') {
                this.canvas.style.cursor = 'ew-resize';
            } else if (this.activeEdge === 'bottom') {
                this.canvas.style.cursor = 'ns-resize';
            }
        } else if (this.hoveredEdge) {
            // Show resize cursor on hover
            if (this.hoveredEdge === 'corner') {
                this.canvas.style.cursor = 'nwse-resize';
            } else if (this.hoveredEdge === 'right') {
                this.canvas.style.cursor = 'ew-resize';
            } else if (this.hoveredEdge === 'bottom') {
                this.canvas.style.cursor = 'ns-resize';
            }
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    }

    private onWheel(e: WheelEvent) {
        // Zoom on Wheel centered on mouse
        this.updateScale();
        const mouseX = e.offsetX / this.scale;
        const mouseY = e.offsetY / this.scale;

        // Convert mouse screen pos to world pos before zoom
        const worldMouseX = (mouseX / this.zoom) + this.camera.x;
        const worldMouseY = (mouseY / this.zoom) + this.camera.y;

        const zoomSpeed = 0.0005; // Reduced sensitivity (was 0.001)
        const zoomDelta = -e.deltaY * zoomSpeed;
        const newZoom = Math.max(0.1, Math.min(5, this.zoom + zoomDelta));

        // Apply new zoom
        this.zoom = newZoom;

        // Update Zoom Label
        if (this.uiZoomLabel) {
            this.uiZoomLabel.innerText = Math.round(this.zoom * 100) + '%';
        }

        // Adjust camera so that worldMouse is still under mouseX/mouseY
        // newWorldMouseX = (mouseX / newZoom) + newCameraX
        // We want newWorldMouseX == worldMouseX
        // So: worldMouseX = (mouseX / newZoom) + newCameraX
        // newCameraX = worldMouseX - (mouseX / newZoom)

        this.camera.x = worldMouseX - (mouseX / this.zoom);
        this.camera.y = worldMouseY - (mouseY / this.zoom);
    }

    private paintTile(screenX: number, screenY: number) {
        if (!this.levelData) return;

        const worldX = (screenX / this.zoom) + this.camera.x;
        const worldY = (screenY / this.zoom) + this.camera.y;

        const col = Math.floor(worldX / TILE_SIZE);
        const row = Math.floor(worldY / TILE_SIZE);

        if (row >= 0 && row < this.levelData.tiles.length &&
            col >= 0 && col < this.levelData.tiles[0].length) {

            // Special Logic for Entities
            if (this.selectedTile === 999) {
                // Paint Minion
                // Check if already exists (using GRID coordinates)
                const alreadyExists = this.levelData.enemies.some(e =>
                    Math.abs(e.position.x - col) < 0.1 &&
                    Math.abs(e.position.y - row) < 0.1
                );

                if (!alreadyExists) {
                    this.levelData.enemies.push({
                        type: EnemyType.MINION,
                        position: { x: col, y: row } // Store as TILE coordinates
                    });
                }
            }
            else if (this.selectedTile === TileType.EMPTY) {
                // ERASE Tool: Clears Tile AND Entities
                this.levelData.tiles[row][col] = 0;

                // Remove enemies at this location (using GRID comparison)
                this.levelData.enemies = this.levelData.enemies.filter(e => {
                    return Math.abs(e.position.x - col) > 0.1 || Math.abs(e.position.y - row) > 0.1;
                });

                // Remove collectibles at this location (using GRID comparison)
                this.levelData.collectibles = this.levelData.collectibles.filter(c => {
                    return Math.abs(c.position.x - col) > 0.1 || Math.abs(c.position.y - row) > 0.1;
                });
            }
            else {
                // Normal Tile Paint
                this.levelData.tiles[row][col] = this.selectedTile;
            }
        }
    }
}
