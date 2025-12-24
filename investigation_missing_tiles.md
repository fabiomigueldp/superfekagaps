# Investigação e Plano: Blocos Ausentes no Editor

## 1. Blocos Identificados como Ausentes
Com base na análise do código fonte (`constants.ts`, `EditorController.ts`, `Game.ts`, `Renderer.ts`), os seguintes tiles funcionais existem no motor do jogo mas não estão acessíveis na paleta do editor:

### A. Blocos de Power-Up (Blocos "?" ou Tijolos Premiados)
Atualmente, o editor expõe apenas os tiles 8 e 9 (`POWERUP_MINI_FANTA` e `POWERUP_HELMET`), que o jogo interpreta como **coletáveis flutuantes** (entidades) e não como blocos físicos.

Os blocos físicos reais são:
- **`POWERUP_BLOCK_MINI_FANTA` (ID 11)**
  - **Comportamento:** Bloco sólido. Ao ser atingido por baixo (cabeçada), transforma-se em `BLOCK_USED` e libera o item *Mini Fanta*.
  - **Status:** Lógica de colisão, destruição e spawn implementada em `Game.ts`. Renderização implementada em `Renderer.ts`.
- **`POWERUP_BLOCK_HELMET` (ID 12)**
  - **Comportamento:** Idem ao anterior, mas libera o item *Capacete*.
  - **Status:** Totalmente funcional.

### B. Lava de Preenchimento
- **`LAVA_FILL` (ID 18)**
  - **Comportamento:** Bloco de lava sólido (visualmente) ou líquido (lógica de dano). Diferente do `LAVA_TOP`, ele não desenha a borda superior se houver outro bloco de lava acima, permitindo criar lagos profundos visualmente contínuos.
  - **Status:** Renderização e colisão implementadas.

---

## 2. Plano de Inclusão no Editor

O objetivo é adicionar esses itens à paleta "Tiles" do editor (`src/editor/EditorController.ts`).

### Alterações Propostas em `src/editor/EditorController.ts`

Localizar o método `buildPalette()` e inserir os novos itens no array `tiles`.

**Sugestão de Organização:**
1.  **Blocos de Power-Up:** Inserir logo após os blocos de tijolos, para manter a lógica de "blocos sólidos".
2.  **Lava Fill:** Inserir logo após `LAVA_TOP`.

#### Código Proposto (Exemplo):

```typescript
const tiles = [
    { id: TileType.EMPTY, label: 'Erase' },
    { id: TileType.GROUND, label: 'Ground' },
    { id: TileType.BRICK, label: 'Brick' },
    { id: TileType.BRICK_BREAKABLE, label: 'Break' },
    
    // NOVOS: Blocos de Power-Up
    { id: TileType.POWERUP_BLOCK_MINI_FANTA, label: 'Blk Fanta' },
    { id: TileType.POWERUP_BLOCK_HELMET, label: 'Blk Helm' },
    
    { id: TileType.PLATFORM, label: 'Plat' },
    { id: TileType.PLATFORM_FALLING, label: 'Fall' },
    { id: TileType.SPIKE, label: 'Spike' },
    { id: TileType.ICE, label: 'Ice' },
    { id: TileType.SPRING, label: 'Spring' },
    
    { id: TileType.LAVA_TOP, label: 'Lava Top' },
    // NOVO: Lava Fill
    { id: TileType.LAVA_FILL, label: 'Lava Fill' },
    
    { id: TileType.COIN, label: 'Coin' },
    // Manter as entidades antigas se desejar spawning direto sem bloco
    { id: TileType.POWERUP_MINI_FANTA, label: 'Item Fanta' },
    { id: TileType.POWERUP_HELMET, label: 'Item Helm' },
    
    { id: TileType.HIDDEN_BLOCK, label: 'Hidden' },
    { id: TileType.CHECKPOINT, label: 'Check' },
    { id: TileType.FLAG, label: 'Goal' },
    { id: 999, label: 'Minion' }
];
```

### Validação Visual (Thumbnails)
O sistema de thumbnails do editor (`EditorController.ts` -> `renderer.drawTile`) usa um canvas pequeno para desenhar o ícone.
- **Blocos de Power-Up:** O `Renderer` desenha o bloco padrão, funcionará perfeitamente.
- **Lava Fill:** O `Renderer` verifica se há ar acima. No contexto da thumbnail (grid isolado), ele desenhará o preenchimento corretamente, diferenciando-se visualmente do `Lava Top`.

## 3. Próximos Passos
1.  Aprovar este plano.
2.  Executar a modificação em `src/editor/EditorController.ts`.
3.  Verificar no navegador (se possível) ou confirmar a alteração no código.
