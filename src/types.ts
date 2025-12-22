// Tipos e interfaces do jogo Super Feka Gaps

// Vetor 2D básico
export interface Vector2 {
  x: number;
  y: number;
}

// Retângulo para colisões
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FallingPlatformPhase = 'contact' | 'arming' | 'falling' | 'cooldown';

// Entidade base
export interface Entity {
  position: Vector2;
  velocity: Vector2;
  width: number;
  height: number;
  active: boolean;
}

// Dados do player
export enum GroundPoundState {
  NONE = 'NONE',
  WINDUP = 'WINDUP',
  FALL = 'FALL',
  RECOVERY = 'RECOVERY'
}

export interface PlayerData extends Entity {
  isGrounded: boolean;
  isRunning: boolean;
  facingRight: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  isJumping: boolean;
  isDead: boolean;
  deathTimer: number;
  deathTimerMax: number;
  invincibleTimer: number;
  hasHelmet: boolean;
  coffeeTimer: number;
  animationFrame: number;
  animationTimer: number;
  groundPoundState: GroundPoundState;
  groundPoundTimer: number;
}

// Dados de inimigo
export interface EnemyData extends Entity {
  type: EnemyType;
  facingRight: boolean;
  isDead: boolean;
  deathTimer: number;
  animationFrame: number;
  animationTimer: number;
  health?: number; // Para o boss
  attackTimer?: number;
  // Rotação visual aplicada na morte (radians)
  deadRotation?: number;
  // Se a morte foi iniciada mas aguardando algo (ex: fala) antes de executar a animação final
  pendingDeath?: boolean;
}

export enum EnemyType {
  MINION = 'MINION',
  JOAOZAO = 'JOAOZAO',
}

// Dados de coletável
export interface CollectibleData extends Entity {
  type: CollectibleType;
  collected: boolean;
  animationFrame: number;
  animationTimer: number;
}

export enum CollectibleType {
  COIN = 'COIN',
  COFFEE = 'COFFEE',
  HELMET = 'HELMET',
}

// Dados de checkpoint
export type FlagKind = 'checkpoint' | 'goal';
export type FlagState = 'inactive' | 'activating' | 'active' | 'clear';

export interface FlagData {
  id: number;
  kind: FlagKind;
  anchor: Vector2;
  trigger: Rect;
  state: FlagState;
  stateTimer: number;
  enabled: boolean;
}

export interface BackgroundLayerSpec {
  type: 'clouds' | 'mountains' | 'hills' | 'city' | 'castle_wall';
  color: string; // Hex ou rgba
  baseHeight?: number; // Altura base da camada
  scrollFactor: number; // 0.0 (fixo) a 1.0 (segue o player)
  speedX?: number; // Para nuvens que se movem sozinhas
  roughness?: number; // Para geração procedural (ex: montanhas mais pontudas)
}

export interface LevelTheme {
  skyGradient: [string, string]; // [Topo, Base]
  layers: BackgroundLayerSpec[];
}

// Dados do nível
export interface LevelData {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: number[][];
  playerSpawn: Vector2;
  enemies: EnemySpawnData[];
  collectibles: CollectibleSpawnData[];
  checkpoints: Vector2[];
  goalPosition: Vector2;
  timeLimit: number;
  isBossLevel: boolean;
  theme?: LevelTheme;
}

export interface EnemySpawnData {
  type: EnemyType;
  position: Vector2;
}

export interface CollectibleSpawnData {
  type: CollectibleType;
  position: Vector2;
}

// Estado do jogo salvo
export interface GameSaveState {
  currentLevel: number;
  score: number;
  lives: number;
  checkpointPosition: Vector2 | null;
}

// Input state
export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  run: boolean;
  down: boolean;
  start: boolean;
  pause: boolean;
  mute: boolean;
  jumpPressed: boolean; // Para detectar o momento do pressionamento
  jumpReleased: boolean;
  downPressed: boolean;
}

// Camera
export interface CameraData {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  shakeTimer: number;
  shakeMagnitude: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

// Partículas para efeitos visuais
export interface Particle {
  position: Vector2;
  velocity: Vector2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

// Firework particle + container
export interface FireworkParticle extends Particle {
  // por ora, usa Particle como base
}

export interface Firework {
  id: number;
  phase: 'ROCKET' | 'EXPLODED';
  x: number;
  y: number;
  targetY: number; // Altura onde vai explodir
  velocity: Vector2;
  color: string;
  particles: FireworkParticle[]; // Partículas da explosão
  trailTimer: number; // Para desenhar o rastro na subida
}

// Balão de diálogo
export interface SpeechBubbleRenderState {
  text: string;
  position: Vector2;
  alpha: number;
}

// Dados do HUD
export interface HudData {
  score: number;
  lives: number;
  time: number;
  level: string;
  coins: number;
  soundEnabled: boolean;
}

// Projétil (para o boss)
export interface Projectile extends Entity {
  damage: number;
  owner: 'player' | 'enemy';
}

// Tipos de eventos do jogo
export type GameEventType =
  | 'COIN_COLLECTED'
  | 'ENEMY_DEFEATED'
  | 'PLAYER_DAMAGED'
  | 'PLAYER_DIED'
  | 'CHECKPOINT_REACHED'
  | 'LEVEL_COMPLETE'
  | 'BOSS_DEFEATED'
  | 'GAME_OVER'
  | 'POWERUP_COLLECTED';

export interface GameEvent {
  type: GameEventType;
  data?: unknown;
}

// Callback de evento
export type GameEventCallback = (event: GameEvent) => void;
