// Sistema de Input - Super Feka Gaps

import { InputState } from '../types';
import { DisposalScope } from './DisposalScope';

export type InputAction = 'left' | 'right' | 'jump' | 'run' | 'down';
type HeldAction = InputAction;
type ActionOwner = number | symbol;

/** One independent gesture. Release commits a tap; cancel/dispose discard only its pending edges. */
export interface InputActionSource {
  press(action: InputAction): void;
  release(): void;
  cancel(): void;
  dispose(): void;
}
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
  private readonly lifetime = new DisposalScope();
  private attachFrame: number | null = null;
  get isDisposed(): boolean { return this.lifetime.isDisposed; }
  private state = createState();
  private pressedKeys = new Set<string>();
  private touchActions = new Set<HeldAction>();
  private touchMenuPressed = false;
  // Pending touch edges keep their gesture owner, so cancellation cannot erase
  // keyboard presses or another finger's queued action.
  private touchOwners = new Map<ActionOwner, HeldAction | 'menu'>();
  private activeCanvasTouches = new Set<number>();
  private actionSources = new Map<symbol, (() => void) | undefined>();
  private pendingSourceTaps = new Map<symbol, HeldAction>();
  private completedSourceTaps = new Set<HeldAction>();
  private canvasTouchSuspensions = new Set<symbol>();
  private pendingTouchJump = new Set<ActionOwner>();
  private pendingTouchDown = new Set<ActionOwner>();
  private pendingTouchRelease = new Set<ActionOwner>();
  private completedTouchMenu = false;
  private pendingTouchMenu = new Set<ActionOwner>();
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

  constructor(canvas?: HTMLCanvasElement) {
    try {
      // Capture gameplay keys before page widgets can stop bubbling.
      this.lifetime.listen(window, 'keydown', (event) => this.handleKeyDown(event), true);
      this.lifetime.listen(window, 'keyup', (event) => this.handleKeyUp(event), true);
      this.lifetime.listen(window, 'blur', () => this.reset());
      this.lifetime.listen(window, 'pagehide', () => this.reset());
      // Modern rotation events belong to ScreenOrientation, not window. Keep
      // the legacy event only as a fallback so one rotation does not reset twice.
      const orientation = window.screen?.orientation;
      if (typeof orientation?.addEventListener === 'function') this.lifetime.listen(orientation, 'change', () => this.reset());
      else this.lifetime.listen(window, 'orientationchange', () => this.reset());
      this.lifetime.listen(document, 'visibilitychange', () => {
        if (document.hidden) this.reset();
      });
      this.setupTouchControls(canvas);
    } catch (error) { this.dispose(); throw error; }
  }

  /** Terminal: releases all gestures and cancels a pending canvas attachment. */
  dispose(): void {
    if (this.isDisposed) return;
    this.lifetime.dispose();
    if (this.attachFrame !== null) window.cancelAnimationFrame(this.attachFrame);
    this.attachFrame = null;
    const notifications = [...this.actionSources.values()];
    this.actionSources.clear(); this.canvasTouchSuspensions.clear();
    this.reset();
    this.notifySourceResets(notifications);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    if (target instanceof HTMLElement && target.id !== 'game-canvas' && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) {
      return;
    }
    // Native activation belongs to focused page controls, not jump/start.
    if (target instanceof HTMLElement && target.closest('button, a[href]') &&
      ['Enter', 'Space'].includes(controlCode(event))) return;

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

    if (action === 'jump' && this.pendingTouchJump.size) this.pendingJumpPressed = true;
    if (action === 'down' && this.pendingTouchDown.size) this.pendingDownPressed = true;
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

  private refreshHeldActions(captureEdges = true): void {
    const held = new Set(this.touchActions);
    this.pressedKeys.forEach((code) => {
      const action = KEY_ACTIONS[code];
      if (action) held.add(action);
    });

    const jump = held.has('jump');
    const down = held.has('down');
    if (captureEdges) {
      this.pendingJumpPressed ||= jump && !this.state.jump;
      this.pendingJumpReleased ||= !jump && this.state.jump;
      this.pendingDownPressed ||= down && !this.state.down;
    }
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

  private setupTouchControls(ownedCanvas?: HTMLCanvasElement): void {
    const attach = (canvas: HTMLCanvasElement | null): boolean => {
      if (!canvas) return false;
      for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const) {
        this.lifetime.listen(canvas, type, (event) => this.handleTouch(event, type), { passive: false });
      }
      return true;
    };

    const tryAttach = (): void => {
      this.attachFrame = null;
      if (this.isDisposed) return;
      const canvas = ownedCanvas ?? document.getElementById('game-canvas') as HTMLCanvasElement | null;
      if (!attach(canvas)) this.attachFrame = window.requestAnimationFrame(tryAttach);
    };
    tryAttach();
  }

  private handleTouch(event: TouchEvent, phase: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel'): void {
    const cancelled = phase === 'touchcancel';
    if (this.canvasTouchSuspensions.size) return;
    event.preventDefault();
    const canvas = event.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const owners = new Map([...this.touchOwners].filter(([id]) => typeof id === 'symbol'));
    const activeIds = new Set<ActionOwner>(owners.keys());
    // Only a new touchstart can own a gesture. After reset/suspension, stale
    // move/end events (including fingers alongside a fresh touch) stay inert.
    const admitted = new Set(this.activeCanvasTouches);
    if (phase === 'touchstart') {
      const started = event.changedTouches ?? event.touches;
      for (let i = 0; i < started.length; i++) {
        if (started[i].target === canvas) admitted.add(started[i].identifier ?? i);
      }
    }
    // Rebuild from remaining fingers. Real Touch objects always have identifiers;
    // the fallback supports older synthetic event adapters.
    for (let i = 0; i < event.touches.length; i++) {
      const touch = event.touches[i];
      if (touch.target !== canvas || !admitted.has(touch.identifier ?? i)) continue;
      activeIds.add(touch.identifier ?? i);
      const x = (touch.clientX - rect.left) / rect.width;
      const y = (touch.clientY - rect.top) / rect.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) continue;
      let action: HeldAction | 'menu' | undefined;
      if (this.menuMode) action = 'menu';
      else if (y > 0.7) {
        if (x < 0.15) action = 'left';
        else if (x < 0.3) action = 'right';
        else if (x > 0.85) action = 'jump';
        else if (x > 0.7) action = 'run';
        else if (x > 0.44 && x < 0.56) action = 'down';
      } else if (y < 0.2 && x > 0.4 && x < 0.6) action = 'menu';
      if (action) owners.set(touch.identifier ?? i, action);
    }
    this.activeCanvasTouches = new Set([...activeIds].filter((id): id is number => typeof id === 'number'));
    const cancelledIds = cancelled ? event.changedTouches
      ? Array.from(event.changedTouches, touch => touch.identifier)
      : [...this.touchOwners.keys()].filter(id => typeof id === 'number' && !owners.has(id)) : [];
    this.applyActionOwners(owners, activeIds, cancelled, cancelledIds);
  }

  private applyActionOwners(owners: Map<ActionOwner, HeldAction | 'menu'>,
    activeIds: Set<ActionOwner>, cancelled = false, cancelledIds: ActionOwner[] = []): void {
    if (cancelled) {
      for (const id of cancelledIds) {
        this.pendingTouchJump.delete(id);
        this.pendingTouchDown.delete(id);
        this.pendingTouchRelease.delete(id);
        this.pendingTouchMenu.delete(id);
        if (typeof id === 'symbol') this.pendingSourceTaps.delete(id);
      }
    } else {
      for (const [id, action] of owners) {
        if (this.touchOwners.get(id) === action) continue;
        if (action === 'jump' && (!this.state.jump || this.pendingTouchJump.size > 0)) this.pendingTouchJump.add(id);
        if (action === 'down' && (!this.state.down || this.pendingTouchDown.size > 0)) this.pendingTouchDown.add(id);
        if (action === 'menu' && (!this.touchMenuPressed || this.pendingTouchMenu.size > 0)) this.pendingTouchMenu.add(id);
      }
    }
    const wasJump = this.state.jump;
    const previousOwners = this.touchOwners;
    this.touchOwners = owners;
    this.touchActions.clear();
    for (const action of owners.values()) if (action !== 'menu') this.touchActions.add(action);
    this.touchMenuPressed = [...owners.values()].includes('menu');
    this.refreshHeldActions(false);
    // A cancelled gesture is not a release command. Ordinary short taps retain
    // both their press and release edges until the next simulation update.
    if (!cancelled && wasJump && !this.state.jump) {
      for (const [id, action] of previousOwners) if (action === 'jump') this.pendingTouchRelease.add(id);
    }
    if (!cancelled) {
      // Finished taps are committed; reusing a Touch identifier for a later
      // cancelled gesture must not erase an earlier valid tap.
      for (const id of this.pendingTouchJump) if (!activeIds.has(id)) { this.pendingJumpPressed = true; this.pendingTouchJump.delete(id); }
      for (const id of this.pendingTouchDown) if (!activeIds.has(id)) { this.pendingDownPressed = true; this.pendingTouchDown.delete(id); }
      for (const id of this.pendingTouchRelease) if (!activeIds.has(id)) { this.pendingJumpReleased = true; this.pendingTouchRelease.delete(id); }
      for (const id of this.pendingTouchMenu) if (!activeIds.has(id)) { this.completedTouchMenu = true; this.pendingTouchMenu.delete(id); }
    }
  }

  /** Opt-in controls use the same owned action path as canvas touches, never fake keys. */
  createActionSource(onReset?: () => void): InputActionSource {
    const owner = Symbol('input-action');
    if (!this.isDisposed) this.actionSources.set(owner, onReset);
    const change = (action: HeldAction | null, cancelled: boolean): void => {
      if (this.isDisposed || !this.actionSources.has(owner)) return;
      const previous = this.touchOwners.get(owner);
      if (action === previous || (!action && !previous)) return;
      const owners = new Map(this.touchOwners);
      if (action) owners.set(owner, action); else owners.delete(owner);
      if (action && (action === 'left' || action === 'right' || action === 'run')) this.pendingSourceTaps.set(owner, action);
      if (!action && !cancelled) {
        const tap = this.pendingSourceTaps.get(owner);
        if (tap) this.completedSourceTaps.add(tap);
        this.pendingSourceTaps.delete(owner);
      }
      const active = new Set<ActionOwner>([...this.activeCanvasTouches, ...[...owners.keys()].filter(id => typeof id === 'symbol')]);
      this.applyActionOwners(owners, active, cancelled, cancelled ? [owner] : []);
    };
    return {
      press: action => {
        if (this.touchOwners.get(owner) === action) return;
        if (this.touchOwners.has(owner)) change(null, true);
        change(action, false);
      },
      release: () => change(null, false),
      cancel: () => change(null, true),
      dispose: () => { change(null, true); this.actionSources.delete(owner); }
    };
  }

  /** Scoped suppression; disposing an optional bar restores legacy canvas controls. */
  suspendCanvasTouchControls(): () => void {
    if (this.isDisposed) return () => {};
    const suspension = Symbol('canvas-touch');
    this.canvasTouchSuspensions.add(suspension);
    const canvasIds = [...new Set([...this.activeCanvasTouches, ...this.touchOwners.keys(),
      ...this.pendingTouchJump, ...this.pendingTouchDown, ...this.pendingTouchRelease, ...this.pendingTouchMenu])]
      .filter(id => typeof id === 'number');
    const owners = new Map([...this.touchOwners].filter(([id]) => typeof id === 'symbol'));
    this.activeCanvasTouches.clear();
    this.applyActionOwners(owners, new Set(owners.keys()), true, canvasIds);
    return () => { this.canvasTouchSuspensions.delete(suspension); };
  }

  update(): void {
    if (this.isDisposed) return;
    this.refreshHeldActions();
    // Queued taps are a fallback, never a replacement for a surviving owner.
    // Two opposite touch holds intentionally resolve to neutral, but still own
    // horizontal input until one is released or cancelled.
    const horizontalHeld = this.state.left || this.state.right ||
      this.touchActions.has('left') || this.touchActions.has('right');
    // External pointer/assistive clicks shorter than a frame retain one movement step.
    if (this.completedSourceTaps.size || this.pendingSourceTaps.size) {
      const taps = new Set([...this.completedSourceTaps, ...this.pendingSourceTaps.values()]);
      if (!horizontalHeld) {
        this.state.left = taps.has('left') && !taps.has('right');
        this.state.right = taps.has('right') && !taps.has('left');
      }
      this.state.run ||= taps.has('run');
      this.completedSourceTaps.clear();
      this.pendingSourceTaps.clear();
    }
    // A tap shorter than 1/60 s still moves for one simulation step.
    if (this.pendingHorizontal && !horizontalHeld) {
      this.state.left = this.pendingHorizontal === 'left';
      this.state.right = this.pendingHorizontal === 'right';
    }
    this.pendingHorizontal = null;
    // Keep short taps that start and end between two simulation updates.
    this.state.start = this.pendingStart;
    this.state.pause = this.pendingPause;
    this.state.mute = this.pendingMute;
    this.touchMenuAction = this.completedTouchMenu || this.pendingTouchMenu.size > 0;
    this.completedTouchMenu = false;
    this.pendingStart = false;
    this.pendingPause = false;
    this.pendingMute = false;
    this.pendingTouchMenu.clear();
    this.state.jumpPressed = this.pendingJumpPressed || this.pendingTouchJump.size > 0;
    this.state.jumpReleased = this.pendingJumpReleased || this.pendingTouchRelease.size > 0;
    this.state.downPressed = this.pendingDownPressed || this.pendingTouchDown.size > 0;
    this.pendingTouchJump.clear();
    this.pendingTouchDown.clear();
    this.pendingTouchRelease.clear();
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
    this.touchOwners.clear();
    this.activeCanvasTouches.clear();
    this.pendingSourceTaps.clear();
    this.completedSourceTaps.clear();
    this.pendingTouchJump.clear();
    this.pendingTouchDown.clear();
    this.pendingTouchRelease.clear();
    this.touchMenuPressed = false;
    this.completedTouchMenu = false;
    this.pendingTouchMenu.clear();
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
    // Invalidates active DOM captures too; an old move/up can never re-arm a reset gesture.
    this.notifySourceResets([...this.actionSources.values()]);
  }

  private notifySourceResets(notifications: Iterable<(() => void) | undefined>): void {
    for (const notify of notifications) {
      try { notify?.(); } catch (error) { console.warn('Input gesture cleanup failed', error); }
    }
  }
}
