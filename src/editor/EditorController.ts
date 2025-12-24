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

    // UI Elements
    private uiMountBtn: HTMLButtonElement;
    private uiSaveBtn: HTMLButtonElement;
    private uiLevelList: HTMLDivElement;
    private uiPalette: HTMLDivElement;
    private uiFileLabel: HTMLSpanElement;
    private uiShowBgChk: HTMLInputElement;
    private uiZoomLabel: HTMLSpanElement;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.fs = new FileSystemManager();

        // Initialize default blank level
        this.levelData = {
            id: 'new_level',
            name: 'New Level',
            width: 100 * TILE_SIZE,
            height: 15 * TILE_SIZE,
            tiles: Array(15).fill(0).map((_, row) =>
                Array(100).fill(row >= 13 ? TileType.GROUND : TileType.EMPTY)
            ),
            playerSpawn: { x: 50, y: 100 },
            enemies: [],
            collectibles: [],
            checkpoints: [],
            goalPosition: { x: 90 * TILE_SIZE, y: 11 * TILE_SIZE },
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

        this.bindEvents();
        this.buildPalette();
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
            { id: TileType.PLATFORM, label: 'Plat' },
            { id: TileType.PLATFORM_FALLING, label: 'Fall' },
            { id: TileType.SPIKE, label: 'Spike' },
            { id: TileType.ICE, label: 'Ice' },
            { id: TileType.SPRING, label: 'Spring' },
            { id: TileType.LAVA_TOP, label: 'Lava' },
            { id: TileType.COIN, label: 'Coin' },
            { id: TileType.POWERUP_MINI_FANTA, label: 'Mini Fanta' },
            { id: TileType.POWERUP_HELMET, label: 'Helmet' },
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

            // 1. Draw Tiles (Using Game Renderer for pixel-perfect accuracy)
            this.renderEditorView(mainCtx, renderer);
        }

        // 2. Draw Grid
        this.drawGrid(mainCtx);

        mainCtx.restore();

        // 3. Draw UI overlays (e.g. current selection indicator if needed)
        // ...
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
                        // Manually draw coin entity sprite
                        (renderer as any).drawCoin(x, y, 0); // Access private method or refactor renderer
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

    private onMouseDown(e: MouseEvent) {
        this.updateScale();
        const startX = e.offsetX / this.scale;
        const startY = e.offsetY / this.scale;

        // Left click: Paint
        if (e.button === 0) {
            this.paintTile(startX, startY);
            this.isDragging = true;
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
        if (!this.isDragging) return;

        const currentX = e.offsetX / this.scale;
        const currentY = e.offsetY / this.scale;

        // Panning
        if (e.buttons === 2) {
            const dx = (currentX - this.lastMousePos.x) / this.zoom;
            const dy = (currentY - this.lastMousePos.y) / this.zoom;
            this.camera.x -= dx;
            this.camera.y -= dy;
        }

        // Painting
        if (e.buttons === 1) {
            this.paintTile(currentX, currentY);
        }

        this.lastMousePos = { x: currentX, y: currentY };
    }

    private onMouseUp(_e: MouseEvent) {
        this.isDragging = false;
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
