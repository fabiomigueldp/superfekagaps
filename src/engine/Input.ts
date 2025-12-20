// Sistema de Input - Super Feka Gaps

import { InputState } from '../types';

export class Input {
  private state: InputState = {
    left: false,
    right: false,
    jump: false,
    run: false,
    down: false,
    start: false,
    pause: false,
    mute: false,
    jumpPressed: false,
    jumpReleased: false,
    downPressed: false,
  };

  private previousJump = false;
  private previousDown = false;
  private muteJustPressed = false;
  private pauseJustPressed = false;
  private startJustPressed = false;

  constructor() {
    this.setupKeyboardListeners();
    this.setupTouchControls();
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  private handleKeyDown(e: KeyboardEvent): void {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.state.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.state.right = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.state.down = true;
        break;
      case 'Space':
      case 'KeyZ':
      case 'ArrowUp':
      case 'KeyW':
        this.state.jump = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
      case 'KeyX':
        this.state.run = true;
        break;
      case 'Enter':
        if (!this.startJustPressed) {
          this.state.start = true;
          this.startJustPressed = true;
        }
        break;
      case 'Escape':
        if (!this.pauseJustPressed) {
          this.state.pause = true;
          this.pauseJustPressed = true;
        }
        break;
      case 'KeyM':
        if (!this.muteJustPressed) {
          this.state.mute = true;
          this.muteJustPressed = true;
        }
        break;
    }
    
    // Previne scroll com setas e espaço
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.state.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.state.right = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.state.down = false;
        break;
      case 'Space':
      case 'KeyZ':
      case 'ArrowUp':
      case 'KeyW':
        this.state.jump = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
      case 'KeyX':
        this.state.run = false;
        break;
      case 'Enter':
        this.state.start = false;
        this.startJustPressed = false;
        break;
      case 'Escape':
        this.state.pause = false;
        this.pauseJustPressed = false;
        break;
      case 'KeyM':
        this.state.mute = false;
        this.muteJustPressed = false;
        break;
    }
  }

  private setupTouchControls(): void {
    // Touch controls serão renderizados e gerenciados pelo Renderer
    // Aqui configuramos os listeners
    const attach = (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return false;
      canvas.addEventListener('touchstart', (e) => this.handleTouch(e, true));
      canvas.addEventListener('touchend', (e) => this.handleTouch(e, false));
      canvas.addEventListener('touchcancel', (e) => this.handleTouch(e, false));
      return true;
    };

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    if (attach(canvas)) return;

    // Re-tentar até o canvas aparecer (ex: script foi carregado cedo)
    const tryAttach = () => {
      const c = document.getElementById('game-canvas') as HTMLCanvasElement | null;
      if (attach(c)) return;
      window.requestAnimationFrame(tryAttach);
    };
    window.requestAnimationFrame(tryAttach);
  }

  private handleTouch(e: TouchEvent, isPressed: boolean): void {
    e.preventDefault();
    const canvas = e.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const x = (touch.clientX - rect.left) / rect.width;
      const y = (touch.clientY - rect.top) / rect.height;
      
      // Botões na parte inferior da tela
      if (y > 0.7) {
        // Lado esquerdo - movimento
        if (x < 0.15) {
          this.state.left = isPressed;
        } else if (x < 0.3) {
          this.state.right = isPressed;
        }
        // Lado direito - ações
        else if (x > 0.85) {
          this.state.jump = isPressed;
        } else if (x > 0.7) {
          this.state.run = isPressed;
        }
      }
      // Toque no centro superior - pause/start
      else if (y < 0.2 && x > 0.4 && x < 0.6) {
        if (isPressed) {
          this.state.pause = true;
          this.state.start = true;
        }
      }
    }
  }

  update(): void {
    // Detecta transição de jump (para pulo variável)
    this.state.jumpPressed = this.state.jump && !this.previousJump;
    this.state.jumpReleased = !this.state.jump && this.previousJump;
    this.previousJump = this.state.jump;

    // Detecta transição de down
    this.state.downPressed = this.state.down && !this.previousDown;
    this.previousDown = this.state.down;
  }

  getState(): InputState {
    return { ...this.state };
  }

  // Consome o estado de start (para não repetir)
  consumeStart(): boolean {
    if (this.state.start) {
      this.state.start = false;
      return true;
    }
    return false;
  }

  // Consome o estado de pause
  consumePause(): boolean {
    if (this.state.pause) {
      this.state.pause = false;
      return true;
    }
    return false;
  }

  // Consome o estado de mute
  consumeMute(): boolean {
    if (this.state.mute) {
      this.state.mute = false;
      return true;
    }
    return false;
  }

  // Reset para quando mudar de estado
  reset(): void {
    this.state = {
      left: false,
      right: false,
      jump: false,
      run: false,
      down: false,
      start: false,
      pause: false,
      mute: false,
      jumpPressed: false,
      jumpReleased: false,
      downPressed: false,
    };
    this.previousJump = false;
    this.previousDown = false;
  }
}
