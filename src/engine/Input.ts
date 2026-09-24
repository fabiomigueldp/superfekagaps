// Sistema de Input - Super Feka Gaps

import { InputState } from '../types';

type HeldAction = 'left' | 'right' | 'jump' | 'run' | 'down';

const KEY_ACTIONS: Readonly<Record<string, HeldAction>> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', ArrowUp: 'jump', KeyW: 'jump',
  ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run'
};

const createState = (): InputState => ({
  left: false, right: false, jump: false, run: false, down: false,
  start: false, pause: false, mute: false,
  jumpPressed: false, jumpReleased: false, downPressed: false
});

export class Input {
  private state = createState();
  private pressedKeys = new Set<string>();
  private touchActions = new Set<HeldAction>();
  private touchMenuPressed = false;
  private pendingTouchMenu = false;
  private touchMenuAction = false;
  private pendingStart = false;
  private pendingPause = false;
  private pendingMute = false;
  private pendingJumpPressed = false;
  private pendingJumpReleased = false;
  private pendingDownPressed = false;

  private konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'];
  private konamiIndex = 0;
  private konamiJustTriggered = false;

  constructor() {
    window.addEventListener('keydown', (event) => this.handleKeyDown(event));
    window.addEventListener('keyup', (event) => this.handleKeyUp(event));
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
    this.setupTouchControls();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) {
      return;
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat || this.pressedKeys.has(event.code)) return;
    this.pressedKeys.add(event.code);

    if (event.code === 'Enter') this.pendingStart = true;
    if (event.code === 'Escape') this.pendingPause = true;
    if (event.code === 'KeyM') this.pendingMute = true;
    this.refreshHeldActions();

    if (event.code === this.konamiCode[this.konamiIndex]) {
      this.konamiIndex++;
      if (this.konamiIndex === this.konamiCode.length) {
        this.konamiJustTriggered = true;
        this.konamiIndex = 0;
      }
    } else {
      this.konamiIndex = event.code === this.konamiCode[0] ? 1 : 0;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.pressedKeys.delete(event.code);
    this.refreshHeldActions();
  }

  private refreshHeldActions(): void {
    const held = new Set(this.touchActions);
    this.pressedKeys.forEach((code) => {
      const action = KEY_ACTIONS[code];
      if (action) held.add(action);
    });

    const jump = held.has('jump');
    const down = held.has('down');
    this.pendingJumpPressed ||= jump && !this.state.jump;
    this.pendingJumpReleased ||= !jump && this.state.jump;
    this.pendingDownPressed ||= down && !this.state.down;
    this.state.left = held.has('left');
    this.state.right = held.has('right');
    this.state.jump = jump;
    this.state.run = held.has('run');
    this.state.down = down;
  }

  private setupTouchControls(): void {
    const attach = (canvas: HTMLCanvasElement | null): boolean => {
      if (!canvas) return false;
      for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const) {
        canvas.addEventListener(type, (event) => this.handleTouch(event), { passive: false });
      }
      return true;
    };

    const tryAttach = (): void => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
      if (!attach(canvas)) window.requestAnimationFrame(tryAttach);
    };
    tryAttach();
  }

  private handleTouch(event: TouchEvent): void {
    event.preventDefault();
    const canvas = event.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.touchActions.clear();
    let menuPressed = false;

    // Rebuild from all remaining fingers, including movements between controls.
    for (let i = 0; i < event.touches.length; i++) {
      const touch = event.touches[i];
      if (touch.target !== canvas) continue;
      const x = (touch.clientX - rect.left) / rect.width;
      const y = (touch.clientY - rect.top) / rect.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) continue;

      if (y > 0.7) {
        if (x < 0.15) this.touchActions.add('left');
        else if (x < 0.3) this.touchActions.add('right');
        else if (x > 0.85) this.touchActions.add('jump');
        else if (x > 0.7) this.touchActions.add('run');
      } else if (y < 0.2 && x > 0.4 && x < 0.6) {
        menuPressed = true;
      }
    }

    if (menuPressed && !this.touchMenuPressed) this.pendingTouchMenu = true;
    this.touchMenuPressed = menuPressed;
    this.refreshHeldActions();
  }

  update(): void {
    // Keep short taps that start and end between two simulation updates.
    this.state.start = this.pendingStart;
    this.state.pause = this.pendingPause;
    this.state.mute = this.pendingMute;
    this.touchMenuAction = this.pendingTouchMenu;
    this.pendingStart = false;
    this.pendingPause = false;
    this.pendingMute = false;
    this.pendingTouchMenu = false;
    this.state.jumpPressed = this.pendingJumpPressed;
    this.state.jumpReleased = this.pendingJumpReleased;
    this.state.downPressed = this.pendingDownPressed;
    this.pendingJumpPressed = false;
    this.pendingJumpReleased = false;
    this.pendingDownPressed = false;
  }

  getState(): InputState {
    return { ...this.state };
  }

  consumeKonami(): boolean {
    const triggered = this.konamiJustTriggered;
    this.konamiJustTriggered = false;
    return triggered;
  }

  consumeStart(): boolean {
    const pressed = this.state.start || this.touchMenuAction;
    this.state.start = false;
    this.touchMenuAction = false;
    return pressed;
  }

  consumePause(): boolean {
    const pressed = this.state.pause || this.touchMenuAction;
    this.state.pause = false;
    this.touchMenuAction = false;
    return pressed;
  }

  consumeMute(): boolean {
    const pressed = this.state.mute;
    this.state.mute = false;
    return pressed;
  }

  reset(): void {
    this.state = createState();
    this.pressedKeys.clear();
    this.touchActions.clear();
    this.touchMenuPressed = false;
    this.pendingTouchMenu = false;
    this.touchMenuAction = false;
    this.pendingStart = false;
    this.pendingPause = false;
    this.pendingMute = false;
    this.pendingJumpPressed = false;
    this.pendingJumpReleased = false;
    this.pendingDownPressed = false;
    this.konamiIndex = 0;
    this.konamiJustTriggered = false;
  }
}
