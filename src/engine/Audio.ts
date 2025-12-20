// Sistema de Audio Procedural - Super Feka Gaps

import { GameState } from '../constants';
import { AudioEngine } from './AudioEngine';
import { MusicContext, MusicManager } from './MusicManager';
import { MusicSnapshot } from './MusicPolicy';

export class Audio {
  private audioEngine: AudioEngine;
  private musicManager: MusicManager;

  constructor() {
    this.audioEngine = new AudioEngine();
    this.musicManager = new MusicManager(this.audioEngine);
  }

  toggle(): boolean {
    return this.audioEngine.toggle();
  }

  isEnabled(): boolean {
    return this.audioEngine.isEnabled();
  }

  // Cria um oscilador com envelope ADSR simples
  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'square',
    attack: number = 0.01,
    decay: number = 0.1,
    sustain: number = 0.3,
    release: number = 0.1,
    volume: number = 0.5
  ): void {
    const audioNodes = this.getSfxNodes();
    if (!audioNodes) return;

    const now = audioNodes.ctx.currentTime;
    const oscillator = audioNodes.ctx.createOscillator();
    const gainNode = audioNodes.ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    // Envelope ADSR
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + attack);
    gainNode.gain.linearRampToValueAtTime(volume * sustain, now + attack + decay);
    gainNode.gain.setValueAtTime(volume * sustain, now + duration - release);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioNodes.sfxGain);

    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  // Cria ruido branco
  private playNoise(duration: number, volume: number = 0.3): void {
    const audioNodes = this.getSfxNodes();
    if (!audioNodes) return;

    const bufferSize = audioNodes.ctx.sampleRate * duration;
    const buffer = audioNodes.ctx.createBuffer(1, bufferSize, audioNodes.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = audioNodes.ctx.createBufferSource();
    const gainNode = audioNodes.ctx.createGain();

    noise.buffer = buffer;
    gainNode.gain.setValueAtTime(volume, audioNodes.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioNodes.ctx.currentTime + duration);

    noise.connect(gainNode);
    gainNode.connect(audioNodes.sfxGain);

    noise.start();
    noise.stop(audioNodes.ctx.currentTime + duration);
  }

  private getSfxNodes(): { ctx: AudioContext; sfxGain: GainNode } | null {
    if (!this.audioEngine.ensureReady()) return null;
    const ctx = this.audioEngine.getContext();
    const sfxGain = this.audioEngine.getSfxDestination();
    if (!ctx || !sfxGain || !this.audioEngine.isEnabled()) return null;
    return { ctx, sfxGain };
  }

  // === SFX DO JOGO ===

  playJump(): void {
    // Som de pulo estilo 8-bit (sweep ascendente)
    const audioNodes = this.getSfxNodes();
    if (!audioNodes) return;

    const now = audioNodes.ctx.currentTime;
    const oscillator = audioNodes.ctx.createOscillator();
    const gainNode = audioNodes.ctx.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(200, now);
    oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.1);

    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    oscillator.connect(gainNode);
    gainNode.connect(audioNodes.sfxGain);

    oscillator.start(now);
    oscillator.stop(now + 0.15);
  }

  playCoin(): void {
    // Som de moeda (duas notas rapidas)
    this.playTone(988, 0.1, 'square', 0.01, 0.02, 0.5, 0.05, 0.4); // B5
    setTimeout(() => {
      this.playTone(1319, 0.15, 'square', 0.01, 0.02, 0.5, 0.1, 0.4); // E6
    }, 80);
  }

  playStomp(): void {
    // Som de esmagar inimigo
    const audioNodes = this.getSfxNodes();
    if (!audioNodes) return;

    const now = audioNodes.ctx.currentTime;
    const oscillator = audioNodes.ctx.createOscillator();
    const gainNode = audioNodes.ctx.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(400, now);
    oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.15);

    gainNode.gain.setValueAtTime(0.4, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    oscillator.connect(gainNode);
    gainNode.connect(audioNodes.sfxGain);

    oscillator.start(now);
    oscillator.stop(now + 0.15);
  }

  playBlockBreak(): void {
    // Som de quebra de bloco
    this.playNoise(0.12, 0.35);
    this.playTone(140, 0.12, 'square', 0.01, 0.02, 0.4, 0.05, 0.25);
  }

  playBlockBump(): void {
    // Som curto de batida no bloco
    this.playTone(220, 0.06, 'square', 0.01, 0.02, 0.3, 0.03, 0.2);
  }

  playHelmetBreak(): void {
    // Som de capacete quebrando
    this.playNoise(0.08, 0.3);
    this.playTone(520, 0.1, 'square', 0.01, 0.02, 0.4, 0.05, 0.25);
  }

  playDamage(): void {
    // Som de dano (buzzer + queda)
    const audioNodes = this.getSfxNodes();
    if (!audioNodes) return;

    const now = audioNodes.ctx.currentTime;

    // Primeira parte - buzz
    const osc1 = audioNodes.ctx.createOscillator();
    const gain1 = audioNodes.ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 150;
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(audioNodes.sfxGain);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Segunda parte - queda
    const osc2 = audioNodes.ctx.createOscillator();
    const gain2 = audioNodes.ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(300, now);
    osc2.frequency.exponentialRampToValueAtTime(50, now + 0.5);
    gain2.gain.setValueAtTime(0.2, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(audioNodes.sfxGain);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.5);
  }

  playDeath(): void {
    // Som de morte (descending tones)
    const notes = [392, 330, 262, 196]; // G4, E4, C4, G3
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 0.2, 'square', 0.01, 0.05, 0.8, 0.1, 0.4);
      }, i * 150);
    });
  }

  playVictory(): void {
    // Fanfarra de vitoria
    const melody = [
      { freq: 523, time: 0 },    // C5
      { freq: 659, time: 150 },  // E5
      { freq: 784, time: 300 },  // G5
      { freq: 1047, time: 450 }, // C6
      { freq: 784, time: 600 },  // G5
      { freq: 1047, time: 750 }, // C6
    ];

    melody.forEach(note => {
      setTimeout(() => {
        this.playTone(note.freq, 0.2, 'square', 0.01, 0.05, 0.7, 0.1, 0.4);
      }, note.time);
    });
  }

  playGameOver(): void {
    // Som de game over (triste)
    const notes = [330, 311, 294, 262]; // E4, Eb4, D4, C4
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 0.4, 'triangle', 0.01, 0.1, 0.6, 0.2, 0.35);
      }, i * 300);
    });
  }

  playCheckpoint(): void {
    // Som de checkpoint
    this.playTone(440, 0.1, 'square', 0.01, 0.02, 0.5, 0.05, 0.3);
    setTimeout(() => {
      this.playTone(554, 0.1, 'square', 0.01, 0.02, 0.5, 0.05, 0.3);
    }, 100);
    setTimeout(() => {
      this.playTone(659, 0.2, 'square', 0.01, 0.02, 0.5, 0.1, 0.3);
    }, 200);
  }

  playPowerup(): void {
    // Som de power-up (escalando)
    const audioNodes = this.getSfxNodes();
    if (!audioNodes) return;

    const now = audioNodes.ctx.currentTime;
    const oscillator = audioNodes.ctx.createOscillator();
    const gainNode = audioNodes.ctx.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(200, now);
    oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.3);

    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.setValueAtTime(0.3, now + 0.25);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    oscillator.connect(gainNode);
    gainNode.connect(audioNodes.sfxGain);

    oscillator.start(now);
    oscillator.stop(now + 0.35);
  }

  playMenuSelect(): void {
    this.playTone(440, 0.08, 'square', 0.01, 0.02, 0.5, 0.03, 0.3);
  }

  playMenuConfirm(): void {
    this.playTone(523, 0.05, 'square', 0.01, 0.01, 0.5, 0.02, 0.3);
    setTimeout(() => {
      this.playTone(659, 0.1, 'square', 0.01, 0.02, 0.5, 0.05, 0.3);
    }, 60);
  }

  playBossHit(): void {
    // Som quando acerta o boss
    this.playNoise(0.1, 0.4);
    this.playTone(200, 0.2, 'sawtooth', 0.01, 0.05, 0.5, 0.1, 0.4);
  }

  playBossAttack(): void {
    // Som do ataque do boss
    const audioNodes = this.getSfxNodes();
    if (!audioNodes) return;

    const now = audioNodes.ctx.currentTime;
    const oscillator = audioNodes.ctx.createOscillator();
    const gainNode = audioNodes.ctx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(100, now);
    oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.3);

    gainNode.gain.setValueAtTime(0.4, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    oscillator.connect(gainNode);
    gainNode.connect(audioNodes.sfxGain);

    oscillator.start(now);
    oscillator.stop(now + 0.3);
  }

  playFall(): void {
    // Som de cair no buraco
    const audioNodes = this.getSfxNodes();
    if (!audioNodes) return;

    const now = audioNodes.ctx.currentTime;
    const oscillator = audioNodes.ctx.createOscillator();
    const gainNode = audioNodes.ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, now);
    oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.5);

    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    oscillator.connect(gainNode);
    gainNode.connect(audioNodes.sfxGain);

    oscillator.start(now);
    oscillator.stop(now + 0.5);
  }

  playPause(): void {
    this.playTone(330, 0.1, 'square', 0.01, 0.02, 0.3, 0.05, 0.2);
  }

  playLevelClear(): void {
    // Fanfarra de fim de fase
    const melody = [
      { freq: 392, time: 0 },
      { freq: 392, time: 100 },
      { freq: 392, time: 200 },
      { freq: 523, time: 400 },
      { freq: 466, time: 550 },
      { freq: 440, time: 700 },
      { freq: 392, time: 850 },
      { freq: 523, time: 1000 },
      { freq: 659, time: 1150 },
      { freq: 784, time: 1300 },
    ];

    melody.forEach(note => {
      setTimeout(() => {
        this.playTone(note.freq, 0.15, 'square', 0.01, 0.03, 0.6, 0.08, 0.35);
      }, note.time);
    });
  }

  playGroundPoundStart(): void {
    // Som de "whoosh" ascendente rapido
    const audioNodes = this.getSfxNodes();
    if (!audioNodes) return;

    const now = audioNodes.ctx.currentTime;
    const oscillator = audioNodes.ctx.createOscillator();
    const gainNode = audioNodes.ctx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(200, now);
    oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.1);

    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    oscillator.connect(gainNode);
    gainNode.connect(audioNodes.sfxGain);

    oscillator.start(now);
    oscillator.stop(now + 0.15);
  }

  playGroundPoundImpact(): void {
    // Som de impacto pesado (thud)
    this.playNoise(0.2, 0.5);
    this.playTone(100, 0.3, 'sine', 0.01, 0.1, 0.4, 0.1, 0.6);
    this.playTone(60, 0.4, 'triangle', 0.01, 0.2, 0.3, 0.1, 0.5);
  }

  onStateChange(prevState: GameState, nextState: GameState, context: MusicContext): void {
    this.musicManager.onStateChange(prevState, nextState, context);
  }

  onPlayerDeathStart(): void {
    this.musicManager.onPlayerDeathStart();
  }

  onRespawn(): void {
    this.musicManager.onRespawn();
  }

  updateMusic(deltaTime: number, snapshot: MusicSnapshot): void {
    this.musicManager.update(deltaTime, snapshot);
  }
}
