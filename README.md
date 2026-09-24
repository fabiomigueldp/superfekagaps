# Super Feka Gaps

[Português](#português) · [English](#english)

## Português

Jogo de plataforma 2D em TypeScript, com engine própria, Canvas, Web Audio e editor de mundos no navegador. O jogo usa física com passo fixo de 60 Hz, pixel art, fases em tiles, inimigos, checkpoints, coletáveis e áudio procedural e gravado. Não há dependências de runtime.

### Rodar o projeto

Use uma versão do Node.js que atenda ao campo `engines` de [package.json](package.json).

```sh
npm ci
npm run dev
```

O Vite informa a URL local no terminal, normalmente `http://localhost:3000`. Abra essa URL para jogar; acrescente `?editor=true` para abrir o editor de mundos.

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Servidor local com recarregamento |
| `npm test` | Testes de regressão |
| `npm run check` | Executa testes, validações, typecheck e build |
| `npm run validate` | Valida fases e matrizes de sprites |
| `npm run typecheck` | Verificação estática de TypeScript |
| `npm run build` | Executa validação e typecheck, depois gera `dist/` |
| `npm run preview` | Serve o build de `dist/` para revisão local |

### Editor de mundos

1. Abra `http://localhost:3000/?editor=true` usando a porta indicada pelo Vite.
2. Selecione uma fase da lista de fases incluídas no jogo, ou importe um arquivo `.ts`/`.json` de nível.
3. Use a paleta para pintar terrenos e colocar entidades. A aba de lógica contém regiões de áudio, câmera, dano e diálogo; o inspetor edita as propriedades dos objetos selecionados.
4. Ajuste largura e altura pelos campos de limites. Com a ferramenta de seleção, arraste as bordas para redimensionar. `Fit to Content` ajusta a grade ao conteúdo; o histórico permite desfazer alterações.
5. Salve o resultado. Sem uma pasta conectada, o editor baixa o nível como TypeScript. Para gravar diretamente no projeto, use `Abrir pasta`, escolha **`src/data/levels`**, abra o arquivo da lista e salve.

O acesso direto a pastas depende da File System Access API em um navegador compatível, como Chrome ou Edge, em `localhost` ou HTTPS. Importação e download permitem trabalhar sem conectar uma pasta. O editor exibe erros de leitura e validação; arquivos importados não executam JavaScript.

No inspetor de regiões, `Ativo` habilita a zona e `Uma vez` limita sua ativação à primeira visita da sessão. Regiões de áudio usam as faixas do catálogo; `STOP` interrompe a música até outra região ou transição de estado. Regiões de diálogo exibem o texto em um balão. Regiões desativadas continuam visíveis na aba de lógica para edição.

Se um arquivo for alterado fora do editor, o salvamento é interrompido para evitar sobrescrever a mudança. Use `Exportar cópia` para guardar seu trabalho antes de reabrir o arquivo. Ao trocar de pasta, selecione novamente o arquivo antes de salvar diretamente nela.

| Ação no editor | Atalho / gesto |
| --- | --- |
| Pincel / borracha / seleção / retângulo / mão | `B` / `E` / `S` / `R` / `H` |
| Enquadrar o mapa | `F` |
| Desfazer | `Ctrl+Z` ou `Cmd+Z` |
| Refazer | `Ctrl+Shift+Z`, `Cmd+Shift+Z` ou `Ctrl+Y` |
| Salvar | `Ctrl+S` ou `Cmd+S` |
| Remover objeto selecionado | `Delete` / `Backspace` |
| Mover a câmera | Arrastar com a mão, botão direito ou botão do meio |
| Zoom | Roda do mouse |
| Posicionar entidades sem encaixe na grade | Segurar `Ctrl` |

As alterações ficam em memória até salvar. Ao adicionar uma nova fase ao jogo, coloque o arquivo em `src/data/levels/`, exporte `DATA` e registre a importação em [src/data/levels/index.ts](src/data/levels/index.ts). **A ordem de `ALL_LEVELS` define a campanha**; cada fase deve ter um `id` único. Salvar ou importar um arquivo no editor não altera essa lista automaticamente.

### Estrutura e convenções

| Caminho | Responsabilidade |
| --- | --- |
| `src/main.ts` | Inicialização |
| `src/game/` | Estados, progressão, pontuação e coordenação do jogo |
| `src/engine/` | Renderização, entrada, áudio e fundos |
| `src/world/Level.ts` | Tilemap, colisões e tiles dinâmicos |
| `src/world/levelValidation.ts` | Validação de dados compartilhada pelo editor e scripts |
| `src/editor/` | Interface, arquivos, serialização, geometria e histórico do editor |
| `src/data/levels/` | Um módulo `DATA: LevelData` por fase e índice da campanha |
| `src/entities/` | Jogador e inimigos |
| `src/assets/` | Especificações de pixel art e referências visuais |
| `src/voice/` | Falas e balões de diálogo |
| `public/` | Sprites, áudio, ícones e outros arquivos servidos diretamente |
| `scripts/` | Validação e manutenção de conteúdo em TypeScript |
| `tests/` | Regressões automatizadas executadas com `node:test` e `tsx` |
| `tools/` | Utilitários Python opcionais |

`width` e `height` contam tiles de **16 pixels**. `tiles[row][column]` usa índices locais à matriz; a posição no mundo é `(índice + originX/originY) × 16`. A origem é opcional e pode ser negativa. Spawn, objetivo, checkpoints, inimigos e coletáveis usam **coordenadas de tiles no mundo**; regiões de lógica usam **pixels no mundo**. As definições estão em [src/types.ts](src/types.ts) e [src/constants.ts](src/constants.ts).

Antes de entregar alterações, rode:

```sh
npm test
npm run build
```

Ou use `npm run check` para executar a sequência completa. A checagem de tipos inclui o jogo, os scripts, os testes e a configuração do Vite.

O validador confere formato, tipos de tiles e objetos, dimensões, IDs únicos e posições considerando a origem do mapa. O editor preserva objetos ao reduzir a grade; ajuste objetos que ficaram fora dela antes de incorporar a fase à campanha.

Para conferir grades de arquivos de fase sem modificá-los:

```sh
npx tsx scripts/normalize_tiles.ts --check
```

O mesmo comando **sem `--check`** ajusta a quantidade de linhas e colunas a `height`/`width`, completando com ar ou cortando excedentes. Revise o diff: a operação remove tiles além das dimensões declaradas. Os demais campos do arquivo são preservados.

Ferramentas opcionais: `python tools/scanner.py` cria uma visão textual do projeto; `tools/clean_sprite.py` trata fundos de sprites e requer Pillow e NumPy. Elas não participam do build do jogo.

### Controles do jogo

| Ação | Teclas |
| --- | --- |
| Mover | Setas esquerda/direita, `A` / `D` |
| Pular | Espaço, `Z`, `W`, seta para cima |
| Correr | Shift, `X` |
| Ataque para baixo no ar | Seta para baixo, `S` |
| Iniciar / confirmar | Enter |
| Pausar | Esc |
| Ativar / desativar som | `M` |

O jogo também oferece controles por toque. Licença: MIT.

## English

Super Feka Gaps is a TypeScript 2D platformer with a custom Canvas/Web Audio engine and an in-browser world editor. It has a fixed 60 Hz physics step, tile-based levels, collectibles, checkpoints, enemies and procedural/recorded audio, with no runtime dependencies.

### Development

Use Node.js matching `package.json`'s `engines`, then run `npm ci` and `npm run dev`. Open the URL printed by Vite (normally `http://localhost:3000`). Add `?editor=true` to open the world editor. Run `npm test` and `npm run build` before submitting changes; the build also runs level/sprite validation and TypeScript checks.

The editor opens bundled levels immediately, imports level `.ts`/`.json` files, and downloads saved TypeScript files. To save directly into the repository, use **Abrir pasta** (Open folder), select **`src/data/levels`**, and open a file from that folder. Direct folder access requires a browser supporting the File System Access API on localhost or HTTPS. Changes remain in memory until saved.

Editor tools use **B/E/S/R/H** (brush, eraser, selection, rectangle, hand); **F** frames the map. Undo with **Ctrl/Cmd+Z**, redo with **Ctrl/Cmd+Shift+Z** or **Ctrl+Y**, and save with **Ctrl/Cmd+S**. Pan with the hand, right mouse button or middle button; use the wheel to zoom. Hold **Ctrl** for free entity placement. Select objects to edit their properties and use **Delete/Backspace** to remove them.

### Content and architecture

Levels live in **`src/data/levels/`**, with one exported `DATA: LevelData` object per file. Add new files to `src/data/levels/index.ts` manually: `ALL_LEVELS` order defines the campaign, and level IDs must be unique. Importing/saving a file in the editor does not register it in the campaign.

The main modules are `src/game/` (orchestration), `src/engine/` (rendering/input/audio), `src/world/` (collision and shared validation), `src/entities/`, `src/voice/` and `src/editor/` (UI, geometry, history and serialization). Static files live in `public/`; validation/maintenance commands live in `scripts/`, regression tests in `tests/`, and optional Python utilities in `tools/`.

Dimensions and entity/spawn/checkpoint/goal positions use **16-pixel world tiles**. Tile arrays use local indices plus optional `originX`/`originY`, which may be negative. Trigger rectangles use **world pixels**. See `src/types.ts` and `src/constants.ts` for the schema. Resizing preserves objects; adjust any objects outside the grid before adding a level to the campaign.

`npx tsx scripts/normalize_tiles.ts --check` checks source grid dimensions without writing. Omit `--check` to pad missing rows/cells with air or trim excess tiles to the declared dimensions, preserving other level fields. Review the resulting diff.

Game controls: **arrows/A/D** move, **Space/Z/W/Up** jump, **Shift/X** run, **Down/S** ground pound, **Enter** confirm, **Esc** pause, **M** mute. Touch controls are also available. License: MIT.
