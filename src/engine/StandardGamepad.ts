import { Input, type InputActionSource } from './Input';
import { GamepadDevice, type GamepadMenuCommand } from './GamepadDevice';
export type { GamepadMenuCommand, GamepadMenuDirection } from './GamepadDevice';
export type GamepadMode = 'playing' | 'paused' | 'inactive';

/** Adapts one device to owned Input actions. The host keeps its own frame clock. */
export class StandardGamepad {
    readonly device: GamepadDevice;
    private readonly sources: InputActionSource[] = [];
    constructor(private readonly input: Input) {
        this.device = new GamepadDevice(() => { for (const source of this.sources) source.cancel(); });
        for (let i = 0; i < 4; i++) this.sources.push(input.createActionSource(i === 0 ? () => this.device.reset() : undefined));
    }
    update(mode: GamepadMode): boolean {
        const ready = this.device.game(mode !== 'inactive');
        const disconnected = this.device.consumeDisconnect();
        if (disconnected && mode === 'playing') return true;
        if (!ready || this.input.isDisposed) return false;
        if (this.device.pressed('pause')) { this.device.reset(); return true; }
        if (mode !== 'playing') return false;
        const left = this.device.down('left'), right = this.device.down('right');
        const direction = left === right ? null : left ? 'left' : 'right';
        if (direction) this.sources[0].press(direction); else this.sources[0].release();
        for (const [index, action] of [[1, 'jump'], [2, 'run'], [3, 'down']] as const) {
            if (this.device.down(action)) this.sources[index].press(action); else this.sources[index].release();
        }
        for (const action of ['guide', 'interact'] as const) if (this.device.pressed(action)) this.input.queueCommand(action);
        return false;
    }
    updateMenu(owner: string | null, now = performance.now()): GamepadMenuCommand | null {
        const command = this.device.menu(owner, now);
        this.device.consumeDisconnect();
        return command;
    }
    dispose(): void { this.device.dispose(); for (const source of this.sources) source.dispose(); }
}
