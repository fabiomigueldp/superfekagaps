import { SpeechBubbleRenderState, Vector2 } from '../types';

export interface SpeechBubbleOptions {
  fadeOutMs: number;
  offset?: Vector2;
}

export class SpeechBubbleController {
  private text: string = '';
  private visible: boolean = false;
  private alpha: number = 0;
  private fadeOutMs: number;
  private fadeTimer: number = 0;
  private fading: boolean = false;
  private offset: Vector2;
  private anchorProvider: (() => Vector2) | null = null;

  constructor(options: SpeechBubbleOptions) {
    this.fadeOutMs = Math.max(0, options.fadeOutMs);
    this.offset = options.offset ?? { x: 0, y: 0 };
  }

  setAnchorProvider(provider: () => Vector2): void {
    this.anchorProvider = provider;
  }

  show(text: string): void {
    this.text = text;
    this.visible = true;
    this.alpha = 1;
    this.fading = false;
    this.fadeTimer = 0;
  }

  hide(): void {
    if (!this.visible) return;
    if (this.fadeOutMs <= 0) {
      this.hideImmediate();
      return;
    }
    this.fading = true;
    this.fadeTimer = this.fadeOutMs;
  }

  hideImmediate(): void {
    this.visible = false;
    this.alpha = 0;
    this.fading = false;
    this.fadeTimer = 0;
  }

  update(deltaMs: number): void {
    if (!this.fading) return;
    this.fadeTimer -= deltaMs;
    if (this.fadeTimer <= 0) {
      this.hideImmediate();
      return;
    }
    this.alpha = Math.max(0, this.fadeTimer / this.fadeOutMs);
  }

  getRenderState(): SpeechBubbleRenderState | null {
    if (!this.visible || this.alpha <= 0 || !this.text) return null;
    const anchor = this.anchorProvider ? this.anchorProvider() : { x: 0, y: 0 };
    return {
      text: this.text,
      position: {
        x: anchor.x + this.offset.x,
        y: anchor.y + this.offset.y
      },
      alpha: this.alpha
    };
  }
}
