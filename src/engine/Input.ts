// Sistema de Input - Super Feka Gaps

import { InputState } from '../types';

type HeldAction = 'left' | 'right' | 'jump' | 'run' | 'down';
type HorizontalAction = 'left' | 'right';

const KEY_ACTIONS: Readonly<Record<string, HeldAction>> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', ArrowUp: 'jump', KeyW: 'jump',
  ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run'
};

const LETTER_KEYS: Readonly<Record<string, string>> = {
  a: 'KeyA', d: 'KeyD', w: 'KeyW', s: 'KeyS',
  z: 'KeyZ', x: 'KeyX', m: 'KeyM'
};

function controlCode(event: KeyboardEvent): string {
  // `key` follows the character printed by the active keyboard layout. This
  // also covers virtual keyboards that report `code: "Unidentified"`.
  const key = event.key?.toLowerCase();
  if (key && LETTER_KEYS[key]) return LETTER_KEYS[key];
  if (event.code && event.code !== 'Unidentified') return event.code;
  if (event.key === ' ') return 'Space';
  if (event.key === 'Shift') return 'ShiftLeft';
  return event.key ?? '';
}

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
  private pendingHorizontal: HorizontalAction | null = null;
  private menuMode = false;

  setMenuMode(enabled: boolean): void { this.menuMode = enabled; }

  private konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'];
  private konamiIndex = 0;
  private konamiJustTriggered = false;

  constructor() {
    // Capture gameplay keys before page widgets can stop bubbling.
    window.addEventListener('keydown', (event) => this.handleKeyDown(event), true);
    window.addEventListener('keyup', (event) => this.handleKeyUp(event), true);
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
    this.setupTouchControls();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    if (target instanceof HTMLElement && target.id !== 'game-canvas' && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) {
      return;
    }

    // Semantic map controls own native Enter/Space and directional navigation.
    if (this.menuMode && target instanceof HTMLElement && target.closest('.world-map') && controlCode(event) !== 'KeyM') return;

    // Let browser/system shortcuts keep their normal behaviour.
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const code = controlCode(event);
    if (!code) return;
    const action = KEY_ACTIONS[code];

    if (action || code === 'Enter' || code === 'Escape' || code === 'KeyM') {
      event.preventDefault();
    }
    // Repeated direction keys can recover after a missed initial keydown.
    // Repeats must not create another jump, attack, menu or Konami action.
    if (event.repeat) {
      if ((action === 'left' || action === 'right') && !this.pressedKeys.has(code)) {
        this.pressedKeys.add(code);
        this.refreshHeldActions();
      }
      return;
    }
    if (this.pressedKeys.has(code)) {
      if (action !== 'left' && action !== 'right') return;
      // A fresh keydown after a missed keyup is a new directional press.
      this.pressedKeys.delete(code);
    }
    this.pressedKeys.add(code);

    if (action === 'left' || action === 'right') {
      this.pendingHorizontal = action;
    }

    if (code === 'Enter') this.pendingStart = true;
    if (code === 'Escape') this.pendingPause = true;
    if (code === 'KeyM') this.pendingMute = true;
    this.refreshHeldActions();

    if (code === this.konamiCode[this.konamiIndex]) {
      this.konamiIndex++;
      if (this.konamiIndex === this.konamiCode.length) {
        this.konamiJustTriggered = true;
        this.konamiIndex = 0;
      }
    } else {
      this.konamiIndex = code === this.konamiCode[0] ? 1 : 0;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.pressedKeys.delete(controlCode(event));
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
    // The most recently pressed horizontal key wins. Releasing it restores any
    // older held key, including an arrow-key alias, without a dead frame.
    let keyboardDirection: HorizontalAction | null = null;
    this.pressedKeys.forEach((code) => {
      const action = KEY_ACTIONS[code];
      if (action === 'left' || action === 'right') keyboardDirection = action;
    });
    const touchLeft = this.touchActions.has('left');
    const touchRight = this.touchActions.has('right');
    const direction = keyboardDirection ?? (touchLeft === touchRight ? null : touchLeft ? 'left' : 'right');
    this.state.left = direction === 'left';
    this.state.right = direction === 'right';
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

      if (this.menuMode) {
        menuPressed = true;
      } else if (y > 0.7) {
        if (x < 0.15) this.touchActions.add('left');
        else if (x < 0.3) this.touchActions.add('right');
        else if (x > 0.85) this.touchActions.add('jump');
        else if (x > 0.7) this.touchActions.add('run');
        else if (x > 0.44 && x < 0.56) this.touchActions.add('down');
      } else if (y < 0.2 && x > 0.4 && x < 0.6) {
        menuPressed = true;
      }
    }

    if (menuPressed && !this.touchMenuPressed) this.pendingTouchMenu = true;
    this.touchMenuPressed = menuPressed;
    this.refreshHeldActions();
  }

  update(): void {
    this.refreshHeldActions();
    // A tap shorter than 1/60 s still moves for one simulation step.
    if (this.pendingHorizontal) {
      this.state.left = this.pendingHorizontal === 'left';
      this.state.right = this.pendingHorizontal === 'right';
      this.pendingHorizontal = null;
    }
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
    this.pendingHorizontal = null;
    this.konamiIndex = 0;
    this.konamiJustTriggered = false;
  }
}
