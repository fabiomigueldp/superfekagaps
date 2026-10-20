import { GamepadDevice, type GamepadMenuCommand } from './GamepadDevice';
import './controls.css';

const ids = new WeakMap<HTMLElement, number>();
let nextId = 0;
export function menuId(root: HTMLElement): string {
    if (!ids.has(root)) ids.set(root, ++nextId);
    return `dom:${ids.get(root)}`;
}
const visible = (node: HTMLElement) => !node.closest('[hidden], [inert], [aria-hidden="true"]')
    && !node.matches(':disabled') && node.getClientRects().length > 0
    && getComputedStyle(node).visibility !== 'hidden';
const selector = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"][tabindex], [role="region"][tabindex="0"]';

/** Operates actual semantic controls, without forging keyboard or pointer input. */
export class DomGamepadMenu {
    private readonly events = new AbortController();
    private marked: HTMLElement | null = null;
    private keyboard: HTMLElement | null = null;
    private textTarget: HTMLInputElement | HTMLTextAreaElement | null = null;
    constructor() {
        const clear = () => this.marked?.classList.remove('feka-pad-focus');
        document.addEventListener('pointerdown', clear, { signal: this.events.signal, capture: true });
        document.addEventListener('keydown', clear, { signal: this.events.signal, capture: true });
    }
    focus(node: HTMLElement): void {
        this.marked?.classList.remove('feka-pad-focus');
        this.marked = node; node.classList.add('feka-pad-focus');
        node.focus({ preventScroll: true }); node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    control(root: HTMLElement, command: GamepadMenuCommand, back: () => void): void {
        if (command === 'scroll-up' || command === 'scroll-down') {
            const region = document.activeElement?.closest<HTMLElement>('[role="region"], .world-controls-content')
                ?? root.querySelector<HTMLElement>('[role="region"], .world-controls-content') ?? root;
            region.scrollBy({ top: command === 'scroll-up' ? -100 : 100, behavior: 'instant' }); return;
        }
        if (command === 'back' || command === 'pause' || command === 'guide') {
            if (this.keyboard) this.closeKeyboard(); else back(); return;
        }
        const scope = this.keyboard?.isConnected ? this.keyboard : root;
        const nodes = Array.from(scope.querySelectorAll<HTMLElement>(selector)).filter(visible);
        if (!nodes.length) {
            if (command === 'up' || command === 'down') root.scrollBy({ top: command === 'up' ? -90 : 90, behavior: 'instant' });
            return;
        }
        let target = document.activeElement as HTMLElement;
        if (!nodes.includes(target)) { target = nodes[0]; this.focus(target); if (command !== 'confirm') return; }
        const horizontal = command === 'left' || command === 'right';
        if (target.getAttribute('role') === 'region' && (command === 'up' || command === 'down')) {
            const available = command === 'up' ? target.scrollTop > 0 : target.scrollTop + target.clientHeight < target.scrollHeight - 2;
            if (available) { target.scrollBy({ top: command === 'up' ? -100 : 100, behavior: 'instant' }); return; }
        }
        if (target instanceof HTMLSelectElement && (horizontal || command === 'confirm')) {
            const options = Array.from(target.options).filter(o => !o.disabled);
            const i = options.indexOf(target.selectedOptions[0]), step = command === 'left' ? -1 : 1;
            const option = options[(i + step + options.length) % options.length];
            if (option) { target.value = option.value; target.dispatchEvent(new Event('change', { bubbles: true })); }
            return;
        }
        if (target instanceof HTMLInputElement && target.type === 'range' && horizontal) {
            command === 'left' ? target.stepDown() : target.stepUp();
            target.dispatchEvent(new Event('input', { bubbles: true })); target.dispatchEvent(new Event('change', { bubbles: true })); return;
        }
        if (command === 'confirm') {
            if ((target instanceof HTMLInputElement && ['text', 'search', 'email'].includes(target.type)) || target instanceof HTMLTextAreaElement) {
                this.openKeyboard(target); return;
            }
            if (target instanceof HTMLInputElement && target.type === 'file') return;
            target.click(); return;
        }
        if (!['up', 'down', 'left', 'right'].includes(command)) return;
        const rect = target.getBoundingClientRect(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
        const sign = command === 'left' || command === 'up' ? -1 : 1;
        const candidates = nodes.filter(n => n !== target).map(node => {
            const r = node.getBoundingClientRect(), dx = r.x + r.width / 2 - x, dy = r.y + r.height / 2 - y;
            const along = (horizontal ? dx : dy) * sign, across = Math.abs(horizontal ? dy : dx);
            return { node, along, score: along + across * 3 };
        }).filter(c => c.along > 3).sort((a, b) => a.score - b.score);
        const next = candidates[0]?.node ?? nodes[(nodes.indexOf(target) + sign + nodes.length) % nodes.length];
        this.focus(next);
    }
    private openKeyboard(target: HTMLInputElement | HTMLTextAreaElement): void {
        this.closeKeyboard(); this.textTarget = target;
        const keyboard = this.keyboard = document.createElement('div');
        keyboard.className = 'feka-pad-keyboard'; keyboard.setAttribute('role', 'group'); keyboard.setAttribute('aria-label', 'Escrever nome');
        const change = (value: string) => {
            const limit = target.maxLength > 0 ? target.maxLength : 80;
            target.value = value.slice(0, limit); target.dispatchEvent(new Event('input', { bubbles: true }));
        };
        for (const character of [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 'Espaço', 'Apagar', 'Concluir']) {
            const b = document.createElement('button'); b.type = 'button'; b.textContent = character;
            b.addEventListener('click', () => {
                if (character === 'Concluir') { this.closeKeyboard(); return; }
                change(character === 'Apagar' ? target.value.slice(0, -1) : target.value + (character === 'Espaço' ? ' ' : character));
            });
            keyboard.append(b);
        }
        target.insertAdjacentElement('afterend', keyboard); this.focus(keyboard.querySelector('button')!);
    }
    closeKeyboard(): void {
        this.keyboard?.remove(); this.keyboard = null;
        const target = this.textTarget; this.textTarget = null;
        if (target?.isConnected) this.focus(target);
    }
    dispose(): void { this.closeKeyboard(); this.marked?.classList.remove('feka-pad-focus'); this.marked = null; this.events.abort(); }
}
export function closeGamepadDialog(dialog: HTMLDialogElement): void {
    if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
}

/** DOM-only views own a small poller; gameplay hosts keep their simulation clock. */
export function installDomGamepad(root: () => HTMLElement | null, back: () => void = () => {}): () => void {
    const device = new GamepadDevice(), menu = new DomGamepadMenu();
    let frame = 0, disposed = false;
    const poll = () => {
        if (disposed) return;
        const current = root();
        const command = device.menu(current ? menuId(current) : null);
        if (current && command) menu.control(current, command, () => current instanceof HTMLDialogElement ? closeGamepadDialog(current) : back());
        frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => { disposed = true; cancelAnimationFrame(frame); device.dispose(); menu.dispose(); };
}
