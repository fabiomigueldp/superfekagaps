# Super Feka Gaps 🎮

Um jogo 2D side-scroller platformer estilo 8-bit, 100% gerado por código (sem assets externos).

## 🎯 História

**Feka** precisa salvar **Yasmin**, que foi sequestrada pelo vilão **Joãozão**! 
Atravesse fases cheias de "gaps" (buracos), inimigos e armadilhas para resgatar sua amada!

## 🚀 Como Rodar

```bash
# Instalar dependências
npm install

# Rodar em modo desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview
```

O jogo abrirá automaticamente no navegador em `http://localhost:3000`

## 🎮 Controles

### Teclado
| Tecla | Ação |
|-------|------|
| ← → ou A D | Mover |
| Espaço, Z, ↑ ou W | Pular |
| Shift ou X | Correr |
| Enter | Start/Confirmar |
| Esc | Pause |
| M | Toggle Som |

### Touch (Mobile)
- Botões na parte inferior da tela para movimento e ações

## 🎨 Características

- **100% Código**: Todos os gráficos são desenhados via Canvas 2D
- **Estilo 8-bit**: Paleta reduzida e resolução 320x180 escalada
- **Física estilo Mario**: Coyote time, jump buffer, pulo variável
- **Áudio Procedural**: Sons gerados com WebAudio API
- **3 Fases**: Tutorial, Desafio e Boss

## 🗺️ Fases

1. **World 1-1 (Tutorial)**: Aprenda os controles, gaps pequenos
2. **World 1-2 (Desafio)**: Mais inimigos e plataformas
3. **Boss: Joãozão**: Enfrente o vilão e salve Yasmin!

## 📁 Estrutura do Projeto

```
src/
├── main.ts              # Ponto de entrada
├── constants.ts         # Constantes do jogo
├── types.ts             # Tipos TypeScript
├── game/
│   └── Game.ts          # Loop principal e estados
├── engine/
│   ├── Input.ts         # Sistema de input
│   ├── Audio.ts         # Áudio procedural
│   └── Renderer.ts      # Renderização Canvas
├── world/
│   └── Level.ts         # Sistema de níveis
├── entities/
│   ├── Player.ts        # Feka (jogador)
│   └── enemies/
│       ├── Minion.ts    # Inimigo básico
│       └── Joaozao.ts   # Boss
└── data/
    └── levels.ts        # Definição dos níveis
```

## 🏆 Sistema de Pontuação

- **Moeda**: +100 pontos
- **Derrotar Inimigo**: +200 pontos
- **Derrotar Boss**: +1000 pontos
- **Bônus de Tempo**: Segundos restantes × 10

## 💡 Dicas

- Segure o pulo para saltar mais alto
- Use Shift para correr e pular mais longe
- Pule na cabeça dos inimigos para derrotá-los
- O café aumenta sua velocidade por 10 segundos
- O capacete protege de um hit

## 🛠️ Stack Técnica

- **Vite**: Build tool e dev server
- **TypeScript**: Tipagem estática
- **HTML5 Canvas**: Renderização 2D
- **WebAudio API**: Som procedural
- **Zero Assets**: Tudo gerado por código

## 📜 Licença

MIT © FekaLabs 2024

---

Feito com ❤️ e muito código!
