import { WorldGame } from './WorldGame';
import { STAGES } from './campaign';
import { resetPreviewGuidance, validateStage } from './progress';
import type { AdventureStage, MechanismKind } from './types';
import { TileType } from '../constants';
import { rect } from './WorldArt';
import { editorCarrierDefaults, translateEditorMechanism } from './WorldMechanismDefaults';
import './editor.css';
/** World authoring uses the exact runtime scene, with an isolated save and explicit JSON export. */
export class WorldEditor {
    private game: WorldGame;
    private draft: AdventureStage = structuredClone(STAGES[0]);
    private preview = false;
    private history: string[] = [];
    private future: string[] = [];
    private tool = 'select';
    private selected = -1;
    private status!: HTMLElement;
    private json!: HTMLTextAreaElement;
    private inspector!: HTMLElement;
    private pan!: HTMLInputElement;
    private bar: HTMLElement;
    constructor(private canvas: HTMLCanvasElement) {
        document.body.classList.add('world-editor');
        this.game = new WorldGame(canvas, true);
        this.bar = document.createElement('aside');
        this.bar.className = 'world-editor-panel';
        document.body.append(this.bar);
        const title = document.createElement('h1');
        title.textContent = 'World · Estúdio';
        this.bar.append(title);
        const select = document.createElement('select');
        for (const s of STAGES) {
            const o = document.createElement('option');
            o.value = s.id;
            o.textContent = `${s.id} — ${s.name}`;
            select.append(o);
        }
        select.onchange = () => { this.draft = structuredClone(STAGES.find(s => s.id === select.value)!); this.history = []; this.future = []; this.selected = -1; this.reload(); };
        this.bar.append(select);
        const controls = document.createElement('div');
        controls.className = 'world-editor-actions';
        this.bar.append(controls);
        this.addButton(controls, 'Jogar / editar', () => { this.preview = !this.preview; this.reload(); });
        this.addButton(controls, 'Desfazer', () => this.undo());
        this.addButton(controls, 'Refazer', () => this.redo());
        const tools = document.createElement('select');
        for (const [value, label] of [['select', 'Selecionar mecanismo'], ['erase', 'Apagar tile'], ['tile:1', 'Terreno'], ['tile:3', 'Plataforma'], ['tile:10', 'Bloco quebrável'], ['tile:14', 'Mola'], ['tile:15', 'Gelo'], ['tile:16', 'Plataforma instável'], ['platform', 'Plataforma móvel'], ['lift', 'Elevador'], ['belt', 'Esteira'], ['switch', 'Acionador'], ['jet', 'Jato'], ['launcher', 'Lançador'], ['target', 'Alvo'], ['support', 'Suporte']]) {
            const o = document.createElement('option');
            o.value = value;
            o.textContent = label;
            tools.append(o);
        }
        tools.onchange = () => this.tool = tools.value;
        this.bar.append(tools);
        const pan = this.pan = document.createElement('input');
        pan.type = 'range';
        pan.min = '0';
        pan.max = String(this.draft.level.width * 16 - 320);
        pan.value = '0';
        pan.ariaLabel = 'Posição horizontal da câmera';
        pan.oninput = () => this.game.camera.x = Number(pan.value);
        this.bar.append(pan);
        this.inspector = document.createElement('div');
        this.inspector.className = 'world-editor-inspector';
        this.bar.append(this.inspector);
        this.json = document.createElement('textarea');
        this.json.spellcheck = false;
        this.json.ariaLabel = 'Dados da fase World';
        this.json.rows = 13;
        this.bar.append(this.json);
        const files = document.createElement('div');
        files.className = 'world-editor-actions';
        this.bar.append(files);
        this.addButton(files, 'Aplicar JSON', () => {
            try {
                const next = this.read(this.json.value);
                this.remember();
                this.draft = next;
                this.reload();
                this.message('Dados aplicados.');
            }
            catch (e) {
                this.message(String(e));
            }
        });
        this.addButton(files, 'Exportar fase', () => this.export());
        this.addButton(files, 'Importar fase', () => this.import());
        this.status = document.createElement('p');
        this.status.setAttribute('role', 'status');
        this.bar.append(this.status);
        const help = document.createElement('p');
        help.textContent = 'Clique para pintar ou selecionar. Arraste um mecanismo para mover. O inspetor usa pixels; tiles têm 16 px. O JSON permite editar inimigos, saídas, selos e diálogos. A prévia não altera seu progresso.';
        this.bar.append(help);
        const back = document.createElement('a');
        back.href = './';
        back.textContent = 'Voltar ao jogo';
        this.bar.append(back);
        let dragging = false, startX = 0, startY = 0, originX = 0, originY = 0;
        const point = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * 320 / r.width + this.game.camera.x, y: (e.clientY - r.top) * 180 / r.height + this.game.camera.y }; };
        canvas.addEventListener('pointerdown', e => {
            if (this.preview)
                return;
            const p = point(e);
            if (this.tool === 'select') {
                this.selected = this.draft.mechanisms.findIndex(m => p.x >= m.x && p.x <= m.x + m.width && p.y >= m.y - 8 && p.y <= m.y + m.height + 8);
                this.inspect();
                if (this.selected >= 0) {
                    this.remember();
                    dragging = true;
                    startX = p.x;
                    startY = p.y;
                    originX = this.draft.mechanisms[this.selected].x;
                    originY = this.draft.mechanisms[this.selected].y;
                    canvas.setPointerCapture(e.pointerId);
                }
                return;
            }
            this.remember();
            if (this.tool === 'erase' || this.tool.startsWith('tile:')) {
                const row = Math.floor(p.y / 16), col = Math.floor(p.x / 16);
                if (this.draft.level.tiles[row]?.[col] !== undefined)
                    this.draft.level.tiles[row][col] = this.tool === 'erase' ? TileType.EMPTY : Number(this.tool.split(':')[1]);
            }
            else {
                const kind = this.tool as MechanismKind, id = `${kind}-${Date.now().toString(36)}`, x = Math.floor(p.x / 16) * 16, y = Math.floor(p.y / 16) * 16;
                this.draft.mechanisms.push({ id, kind, x, y, width: kind === 'switch' ? 24 : kind === 'jet' ? 12 : kind === 'launcher' ? 16 : 64, height: kind === 'jet' ? 48 : kind === 'launcher' ? 16 : 8, ...editorCarrierDefaults(kind, x, y, this.draft.world), ...(kind === 'belt' ? { direction: 1 } : {}), ...(kind === 'launcher' ? { direction: -1, period: 3200 } : {}) });
                this.selected = this.draft.mechanisms.length - 1;
            }
            this.reload();
        });
        canvas.addEventListener('pointermove', e => {
            if (!dragging || this.preview || this.selected < 0)
                return;
            const p = point(e), m = this.draft.mechanisms[this.selected];
            Object.assign(m, translateEditorMechanism(m, Math.round((originX + p.x - startX) / 8) * 8,
                Math.round((originY + p.y - startY) / 8) * 8));
            this.reload(false);
        });
        canvas.addEventListener('pointerup', () => { dragging = false; this.inspect(); });
        canvas.addEventListener('pointercancel', () => dragging = false);
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.reload();
        let last = performance.now(), acc = 0;
        const frame = (now: number) => {
            const dt = Math.min(100, now - last);
            last = now;
            if (this.preview) {
                acc += dt;
                while (acc >= 1000 / 60) {
                    this.game.update(1000 / 60);
                    acc -= 1000 / 60;
                }
            }
            this.game.render();
            if (!this.preview && this.selected >= 0) {
                const m = this.draft.mechanisms[this.selected], c = this.game.renderer.getContext(), x = m.x - this.game.camera.x, y = m.y - this.game.camera.y;
                rect(c, x, y - 1, m.width, 1, '#ffe09a');
                rect(c, x, y + m.height, m.width, 1, '#ffe09a');
                rect(c, x - 1, y, 1, m.height, '#ffe09a');
                rect(c, x + m.width, y, 1, m.height, '#ffe09a');
                this.game.renderer.present();
            }
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }
    private addButton(parent: HTMLElement, label: string, fn: () => void) { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; parent.append(b); }
    private resize() { const width = Math.max(320, window.innerWidth - 350), height = window.innerHeight; const scale = Math.max(.5, Math.min(width / 320, height / 180)); this.canvas.style.width = `${Math.floor(320 * scale)}px`; this.canvas.style.height = `${Math.floor(180 * scale)}px`; }
    private message(text: string) { this.status.textContent = text; }
    private remember() {
        this.history.push(JSON.stringify(this.draft));
        if (this.history.length > 60)
            this.history.shift();
        this.future = [];
    }
    private undo() {
        const data = this.history.pop();
        if (!data)
            return;
        this.future.push(JSON.stringify(this.draft));
        this.draft = JSON.parse(data);
        this.selected = -1;
        this.reload();
    }
    private redo() {
        const data = this.future.pop();
        if (!data)
            return;
        this.history.push(JSON.stringify(this.draft));
        this.draft = JSON.parse(data);
        this.selected = -1;
        this.reload();
    }
    private reload(inspect = true) {
        const errors = validateStage(this.draft);
        if (errors.length) this.preview = false;
        const maxX = Math.max(0, this.draft.level.width * 16 - 320);
        this.pan.max = String(maxX);
        const camera = { x: Math.min(maxX, this.game.camera.x), y: this.draft.encounter ? 64 : 88 };
        this.pan.value = String(camera.x);
        resetPreviewGuidance(this.game.store.save);
        if (!this.game.store.save.seen.includes(`intro:${this.draft.id}`))
            this.game.store.save.seen.push(`intro:${this.draft.id}`);
        this.game.load(this.draft.id, false, this.draft);
        if (!this.preview) {
            this.game.camera.x = camera.x;
            this.game.camera.y = camera.y;
            this.game.audio.pause(true);
        }
        this.json.value = JSON.stringify(this.draft, null, 2);
        if (inspect)
            this.inspect();
        this.message(errors.length ? `Revise a fase antes de jogar ou exportar: ${errors.join(' · ')}`
            : this.preview ? 'Prévia jogável · Esc para pausar.' : 'Edição · alterações em memória até exportar.');
    }
    private inspect() {
        this.inspector.replaceChildren();
        const m = this.draft.mechanisms[this.selected];
        if (!m)
            return;
        for (const key of ['id', 'x', 'y', 'width', 'height', 'period', 'phase', 'direction', 'link'] as const) {
            const label = document.createElement('label');
            label.textContent = key;
            const input = document.createElement('input');
            input.value = String(m[key] ?? '');
            input.type = ['id', 'link'].includes(key) ? 'text' : 'number';
            input.onchange = () => {
                this.remember();
                const values = m as unknown as Record<string, unknown>;
                if (input.value === '')
                    delete values[key];
                else if (key === 'x' || key === 'y')
                    Object.assign(m, translateEditorMechanism(m, key === 'x' ? Number(input.value) : m.x, key === 'y' ? Number(input.value) : m.y));
                else
                    values[key] = input.type === 'number' ? Number(input.value) : input.value;
                this.reload();
            };
            label.append(input);
            this.inspector.append(label);
        }
        for (const axis of ['x', 'y'] as const) {
            const label = document.createElement('label');
            label.textContent = `destino ${axis}`;
            const input = document.createElement('input');
            input.type = 'number';
            input.value = String(m.to?.[axis] ?? m[axis]);
            input.onchange = () => { this.remember(); m.to ??= { x: m.x, y: m.y }; m.to[axis] = Number(input.value); this.reload(); };
            label.append(input);
            this.inspector.append(label);
        }
        this.addButton(this.inspector, 'Excluir mecanismo', () => { this.remember(); this.draft.mechanisms.splice(this.selected, 1); this.selected = -1; this.reload(); });
    }
    private read(text: string): AdventureStage {
        const data = JSON.parse(text) as AdventureStage;
        const errors = validateStage(data);
        if (errors.length)
            throw Error(errors.join('\n'));
        return data;
    }
    private export() {
        try {
            const data = this.read(JSON.stringify(this.draft));
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), a = document.createElement('a');
            a.href = url;
            a.download = `world-${data.id}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            this.message('Fase exportada.');
        }
        catch (e) {
            this.message(String(e));
        }
    }
    private import() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async () => {
            try {
                if (!input.files?.[0])
                    return;
                const data = this.read(await input.files[0].text());
                this.remember();
                this.draft = data;
                this.selected = -1;
                this.reload();
            }
            catch (e) {
                this.message(String(e));
            }
        };
        input.click();
    }
}
