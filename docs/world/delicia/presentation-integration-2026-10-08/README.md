# Império da Delícia — apresentação compartilhada

Revisão de 8 de outubro de 2026. [Comparação visual](index.html).

A revisão anterior compartilhou o controlador e a arte nativa, mas manteve a janela
esticada e uma interface HTML própria para HUD, conversas e menus. Esta revisão
substitui essa camada pela apresentação da campanha.

- `DeliciaPresentation` instancia o mesmo `Renderer` do World. Cenário, personagens,
  HUD, texto e botões são compostos em 320 × 180 e ampliados uma única vez.
- `WorldSceneUI` é chamado tanto pelo World quanto pela Delícia para pausa,
  diálogo, resultado, cabeçalho de opções e informações dos chefes.
- O HUD usa `drawWorkshopHud` e `WorldHudAccessibility`; os controles usam
  `CanvasMenuAccessibility`, montado dentro do capítulo e descartado ao sair.
- Conversas têm a mesma revelação gradual e o mesmo botão Continuar. Falas longas
  expandem o painel para cima sem mover o botão ou cortar o texto.
- Música, efeitos, vozes e tremor usam as preferências da campanha. Memórias,
  assistência e recuperação de progresso seguem o mesmo desenho dos menus.
- Toque reutiliza o desenho e as posições dos comandos básicos do World, com
  alvos nativos de pelo menos 44 pixels CSS e ações extras do capítulo.
- Os links `delicia.html` e `?delicia=true` levam ao mapa compartilhado. A volta
  ao mapa restaura o renderizador anterior e libera controles e listeners.
- A revisão visual encontrou e corrigiu símbolos ausentes na fonte e chefes
  parcialmente cortados na entrada da arena. O enquadramento considera o sprite
  completo e o escudo, além da caixa de colisão.

## Verificação

- `npm test`: 2.751 testes aprovados, nenhuma falha; um teste opcional de atlas
  ignorado porque `@napi-rs/canvas` não está instalado.
- `npm run build`: validação de níveis, assets e World, TypeScript e Vite aprovados.
- Testes adicionais cobrem o enquadramento completo dos chefes, todos os diálogos
  autorados, os avisos de combate e os símbolos nativos de controle.

`review_delicia_presentation.cjs` executou cinco configurações: 1366 × 900,
1920 × 1080, 1536 × 864/DPR 1,25, 390 × 844/DPR 3 e 844 × 390/DPR 3.
Foram produzidas 60 capturas e nenhum erro de navegador.

Em todas as configurações, a posição e as dimensões da janela foram iguais às do
World. A comparação dos pixels do painel/botões de pausa e do cabeçalho/volumes
das opções foi idêntica. O teste também verificou preferências, entrada,
movimento, pausa, ajuda, memórias, saída e reentrada sem interfaces duplicadas.

`prove_delicia_native.cjs` verificou teclado real (caminhada, corrida mantida,
salto variável, sentada e pausa), retorno pelo mapa na mesma página e gesto real
de toque com soltura. Os testes de simulação verificam travessia das fases,
os 36 selos e ambos os chefes vencíveis a partir do ponto inicial autorado.

As capturas de fases avançadas, resultados e erro de gravação são estados
preparados para inspecionar a apresentação, não gravações de partidas completas.

Relatórios: [apresentação](presentation-report.json) e [jogabilidade](gameplay-report.json).
