# Interface do jogo

O jogador abre a partida no navegador e precisa enxergar o cenário, o personagem e a próxima ação. A moldura escura já existente acompanha a arte em pixels sem competir com ela.

## Responsabilidade

- O site apresenta a coleção e abre o jogo. Durante a partida, oferece apenas voltar à coleção e tela cheia.
- O jogo controla pausa, opções, som, ajuda, reinício, progresso e retorno ao mapa.
- Uma ação não deve aparecer simultaneamente no site, numa barra de capítulo e no jogo.
- Menus de desenvolvimento e editores não são padrões para a campanha.

## Estados

| Estado | Interface |
| --- | --- |
| Partida | HUD nativo, alvo de pausa sobre o símbolo existente e controles de toque quando necessários. |
| Pausa | Continuar, Opções, Voltar ao mapa. |
| Opções de Guaíra | Som, Controles, Recomeçar, Voltar. |
| Conclusão | Uma ação para continuar; desvios opcionais podem apresentar uma segunda rota e retorno ao mapa. |
| Carregamento | Mensagem breve. Recuperação explícita se falhar. |
| Falha ao salvar | Aviso real, acessível e visível. Não mostrar uma confirmação permanente de salvamento. |

O enquadramento não muda entre partida, pausa, ajuda e conclusão. Os menus são sobrepostos dentro da superfície do jogo. A pausa pode usar a área de letterbox em telas pequenas, para preservar alvos legíveis sem reduzir o cenário.

## Aparência

Usar `WorldWorkshopUI` e a fonte bitmap existente: tinta, painel petróleo, papel claro e latão. A ação de continuidade recebe o destaque claro. As ações secundárias compartilham largura, altura e tratamento visual. Evitar molduras decorativas adicionais, sombras luminosas e fontes alternativas para cada capítulo.

HUDs de mecânicas distintas podem variar na informação. A posição da pausa, os nomes de navegação e a responsabilidade dos menus permanecem previsíveis. Moeda acompanhada de número já é um contador; não precisa de “no trecho”.

## Texto e acesso

Rótulos curtos: Continuar, Opções, Controles, Recomeçar, Voltar ao mapa. Instruções completas pertencem à ajuda, mantendo avisos contextuais indispensáveis ao combate. Não repetir o significado de um botão em outro parágrafo.

Alvos de pelo menos 44 px, foco visível, nomes acessíveis e navegação por teclado. Esc fecha primeiro a ajuda, depois opções; na pausa, retoma a partida. Som e ajuda não reiniciam nem retomam a tentativa. Manter redução de movimento, controles de toque, pausa ao perder foco e origem dos saves.
