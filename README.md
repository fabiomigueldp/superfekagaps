# Super Feka Gaps

[English](#english) | [Português](#português)

---

<a name="english"></a>

## English

### Project Overview

Super Feka Gaps is a 2D side-scrolling platformer built in TypeScript with a custom engine. It focuses on pixel-perfect rendering, deterministic gameplay, and an 8-bit aesthetic powered by procedural audio.

### Key Features

- Fixed-timestep game loop (60 FPS) for stable physics.
- Pixel-art rendering via offscreen canvas and integer scaling.
- Tile-based levels with AABB collision, hazards, and dynamic tiles (breakable/falling).
- Procedural SFX and music management with crossfades and ducking.
- Keyboard and touch input support.
- Zero runtime dependencies.

### Technical Stack

- **Language:** TypeScript (ES modules).
- **Runtime:** Modern browsers (HTML5 Canvas + Web Audio API).
- **Build:** Vite.
- **Tooling:** tsx for scripts, TypeScript for type checks.
- **Node:** 20+.

### Architecture

- **Game Loop:** `src/game/Game.ts` manages state, fixed timestep, and orchestration.
- **Engine:** `src/engine/` provides rendering, input, audio, and background generation.
- **World & Physics:** `src/world/Level.ts` handles tilemaps and collision resolution.
- **Entities:** `src/entities/` defines player and enemies.
- **Content:** `src/data/levels.ts` stores level layouts; `src/assets/` holds sprites.
- **Voice System:** `src/voice/` manages voice playback and speech bubbles.

### Setup & Scripts

```bash
npm install
npm run validate
npm run dev
```

Other useful commands:

```bash
npm run typecheck
npm run build
npm run preview
```

### Input Mapping

| Action | Keys |
| --- | --- |
| Move | Arrow Keys, A/D |
| Jump | Space, Z, W, Arrow Up |
| Run | Shift, X |
| Ground Pound | Arrow Down, S (mid-air) |
| Start/Confirm | Enter |
| Pause | Esc |
| Mute | M |

### License

MIT.

---

<a name="português"></a>

## Português

### Visão Geral do Projeto

Super Feka Gaps é um jogo de plataforma 2D side-scroller feito em TypeScript com engine própria. O foco é renderização pixel-perfect, gameplay determinístico e estética 8-bit com áudio procedural.

### Características

- Loop de jogo com timestep fixo (60 FPS) para física estável.
- Renderização de pixel art via canvas offscreen e escala inteira.
- Fases em tilemap com colisão AABB, hazards e tiles dinâmicos (quebráveis/instáveis).
- SFX procedural e gerenciamento de música com crossfade e ducking.
- Suporte a teclado e toque.
- Sem dependências de runtime.

### Stack Técnica

- **Linguagem:** TypeScript (ES modules).
- **Runtime:** Navegadores modernos (HTML5 Canvas + Web Audio API).
- **Build:** Vite.
- **Ferramentas:** tsx para scripts, TypeScript para typecheck.
- **Node:** 20+.

### Arquitetura

- **Loop de Jogo:** `src/game/Game.ts` coordena estados, timestep fixo e orquestração.
- **Engine:** `src/engine/` entrega render, input, áudio e background.
- **Mundo e Física:** `src/world/Level.ts` trata tilemap e colisões.
- **Entidades:** `src/entities/` define player e inimigos.
- **Conteúdo:** `src/data/levels.ts` guarda os layouts; `src/assets/` contém sprites.
- **Voz:** `src/voice/` gerencia voz e balões de fala.

### Instalação e Scripts

```bash
npm install
npm run validate
npm run dev
```

Outros comandos úteis:

```bash
npm run typecheck
npm run build
npm run preview
```

### Mapeamento de Entrada

| Ação | Teclas |
| --- | --- |
| Mover | Setas, A/D |
| Pular | Espaço, Z, W, Seta Cima |
| Correr | Shift, X |
| Ground Pound | Seta Baixo, S (no ar) |
| Start/Confirmar | Enter |
| Pausar | Esc |
| Mutar | M |

### Licença

MIT.
