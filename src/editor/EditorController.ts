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

        this.bindEvents();
        this.buildPalette();
    }

    private bindEvents() {
        // Canvas Input
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());

        // UI Input
        this.uiMountBtn.addEventListener('click', async () => {
            const success = await this.fs.mount();
            if (success) {
                this.refreshLevelList();
            }
        });

        this.uiSaveBtn.addEventListener('click', async () => {
            if (this.currentLevelFilename && this.levelData) {
                await this.fs.saveLevel(this.currentLevelFilename, this.levelData);
                alert('Saved!');
            }
        });
    }

    private buildPalette() {
        this.uiPalette.innerHTML = '';

        // Manual list of interesting tiles for editing
        const tiles = [
            { id: TileType.EMPTY, color: '#000', label: 'Erase' },
            { id: TileType.GROUND, color: COLORS.GROUND_TOP, label: 'Ground' },
            { id: TileType.BRICK, color: COLORS.BRICK_MAIN, label: 'Brick' },
            { id: TileType.PLATFORM, color: '#888', label: 'Plat' }, // Platform color not in pallete directly as single color, using placeholder
            { id: TileType.SPIKE, color: '#f00', label: 'Spike' },
            { id: TileType.COIN, color: '#ffd700', label: 'Coin' },
            { id: TileType.BRICK_BREAKABLE, color: COLORS.BRICK_LIGHT, label: 'Break' },
            { id: TileType.POWERUP_COFFEE, color: '#6F4E37', label: 'Coffee' },
            { id: TileType.POWERUP_HELMET, color: '#555', label: 'Helmet' },
            // Virtual Tiles could be added here (99 for spawn, etc)
        ];
        tiles.forEach(t => {
            const btn = document.createElement('div');
            btn.className = 'tile-btn';
            btn.style.backgroundColor = t.color;
            btn.innerText = t.label;
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

                return func(TileType, EnemyType, undefined, COLORS, TILE_SIZE, GAME_WIDTH, GAME_HEIGHT);

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
        // CRITICAL: We must draw to offscreenCtx, because renderer.present() will overwrite 'ctx'
        // with the offscreen buffer.
        const ctx = (renderer as any).offscreenCtx as CanvasRenderingContext2D;

        ctx.save();
        ctx.scale(this.zoom, this.zoom);

        if (this.levelData) {
            // 1. Draw Tiles (Manual implementation since Renderer expects a 'Level' object, 
            // and we have raw LevelData. easier to just loop and draw rects for the editor)
            this.renderEditorView(ctx);
        }

        // 2. Draw Grid
        this.drawGrid(ctx);

        ctx.restore();

        // 3. Draw UI overlays (e.g. current selection indicator if needed)
        // ...
    }

    private renderEditorView(ctx: CanvasRenderingContext2D) {
        if (!this.levelData) return;
        const tiles = this.levelData.tiles;

        // Visual region uses ZOOM-adjusted visible area
        const visibleWidth = ctx.canvas.width / this.zoom;
        const visibleHeight = ctx.canvas.height / this.zoom;

        const startCol = Math.floor(this.camera.x / TILE_SIZE);
        const endCol = startCol + Math.ceil(visibleWidth / TILE_SIZE) + 1;
        const startRow = Math.floor(this.camera.y / TILE_SIZE);
        const endRow = startRow + Math.ceil(visibleHeight / TILE_SIZE) + 1;

        for (let r = startRow; r < endRow; r++) {
            if (r < 0 || r >= tiles.length) continue;
            for (let c = startCol; c < endCol; c++) {
                if (c < 0 || c >= tiles[0].length) continue;
                const tile = tiles[r][c];
                if (tile !== 0) {
                    let color = '#fff';
                    // Simple loop map
                    if (tile === TileType.GROUND) color = COLORS.GROUND_TOP;
                    else if (tile === TileType.BRICK) color = COLORS.BRICK_MAIN;
                    else if (tile === TileType.PLATFORM) color = '#888';
                    else if (tile === TileType.SPIKE) color = '#f00';
                    else if (tile === TileType.COIN) color = '#ffd700';
                    else if (tile === TileType.BRICK_BREAKABLE) color = COLORS.BRICK_LIGHT;
                    else if (tile === TileType.POWERUP_COFFEE) color = '#6F4E37';
                    else if (tile === TileType.POWERUP_HELMET) color = '#555';

                    ctx.fillStyle = color;
                    ctx.fillRect(Math.floor(c * TILE_SIZE - this.camera.x), Math.floor(r * TILE_SIZE - this.camera.y), TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }

    private drawGrid(ctx: CanvasRenderingContext2D) {
        const visibleWidth = ctx.canvas.width / this.zoom;
        const visibleHeight = ctx.canvas.height / this.zoom;

        const startX = Math.floor(this.camera.x / TILE_SIZE) * TILE_SIZE;
        const endX = startX + visibleWidth + TILE_SIZE;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1 / this.zoom; // Keep lines crisp
        ctx.beginPath();

        // Vertical lines
        for (let x = startX; x <= endX; x += TILE_SIZE) {
            const screenX = x - this.camera.x; // No Math.floor here, precise grid
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

            this.levelData.tiles[row][col] = this.selectedTile;
        }
    }
}
