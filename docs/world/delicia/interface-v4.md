# Interface da expansão

A interface usa a fonte de `src/graphics/BitmapFont.ts`, a paleta `ART` e os padrões de painel do World. Os menus não usam mais serifas, slogans ou a barra permanente de navegação.

- **Mapa:** ocupa a tela. A ficha mostra nome, selos, recorde e a ação de jogar. A lista completa aparece em **Fases**; os santuários entram nela quando desbloqueados. No celular, o mapa pode ser arrastado.
- **Partida:** HUD compacto com vida, laranjas, fontes e pausa. Chefes têm vida, fase e uma instrução de ataque; Guina também tem o medidor de pressão.
- **Menus:** **Opções** e **Memórias** voltam à tela de origem. Abrir esses menus durante a pausa preserva posição e tempo da tentativa.
- **Opções:** áudio e assistência ficam visíveis; controles e importação/exportação ficam em seções expansíveis.
- **Memórias:** exibe apenas os textos encontrados. As 20 entradas da história continuam no conteúdo do jogo.

Setas e Enter navegam no mapa; Esc fecha o menu atual. Menus têm botões HTML com nomes acessíveis e letras bitmap. O controle padrão usa direcional, A para selecionar, B para voltar e Menu para pausar. Os oito comandos de toque continuam disponíveis, separados entre direção e ações.

## Verificação

`scripts/verify_delicia.cjs` verifica entrada pelo World, movimento, pausa, retorno das opções/memórias, checkpoints, áudio e toque. `scripts/verify_delicia_ui.cjs` cobre bloqueios de fases, teclado, controle virtual, erro de importação, telas de resultado e viewports de 320, 390 e 844 pixels. `scripts/verify_delicia_production.cjs` confere o build com fases desbloqueadas em um perfil isolado.

Capturas e relatórios ficam em `output/delicia/ui-v4/`. Estados preparados de chefes e resultados servem à revisão visual; não representam uma campanha vencida nem uma verificação com controle físico.
