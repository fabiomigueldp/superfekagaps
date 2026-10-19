# Vanguarda e bastião — 19/10/2026

O quarto posto precisava de maior variedade, pressão espacial e uma arena que
permitisse perceber os golpes durante os saltos. Esta rodada altera a implementação
do jogo, além das pranchas de apresentação.

## Combate

- Cinco pontos de resistência. Salto normal causa um ponto; pancada descendente, dois.
- Investida de até 106 px, ou 120 px ferido; perseguição a 2,05 px por quadro,
  ou 2,35 px ferido. A velocidade de recuo é 2,6 px por quadro.
- Varredura baixa: avanço de 32 px e lâmina baixa, com preparação distinta.
- Corte duplo conserva duas preparações. Ferido, permite corte seguido de salto
  ou investida seguida de varredura, conforme posição e distância.
- No máximo dois golpes por combinação. Recuperação garantida de 34 a 44 quadros,
  conforme o ataque e a saúde. O detalhe verde-claro no capacete indica exposição.
- O histórico do último ataque quebra a antiga alternância repetitiva de salto
  e corte. A seleção considera apoio real numa sacada; passar no ar não basta.
- Direção e destino são comprometidos no começo do aviso, sem perseguição no ar.
- Planejamento do salto usa a gravidade e colisão nativas, verifica a primeira
  aterrissagem, espaço para o corpo e separação dos aliados.
- Aviso e dano de aterrissagem compartilham a mesma extensão de 18 px além de cada
  lado do corpo, limitada à plataforma real.

## Arena e arte

Quatro sacadas: (1568,192,64), (1656,168,56), (1784,176,56),
(1872,164,64), em coordenadas (x,y,largura). Piso em y=224. Vanguarda inicia
em x=1704; lançador, x=1876, sobre a sacada direita. A câmera do bastião usa
32 px de folga acima de Feka, frente aos 38 px das outras etapas.

Plataformas receberam chapas, marcas de uso, rebites e pequenos sinais recuados.
O piso central usa um painel visual rebaixado, sem colisão adicional. Os guardas
receberam costuras e detalhes ligados às poses, riscos no escudo e articulação
do cotovelo do lançador. O brilho de dano intercala a silhueta colorida.

Vanguarda: placas, tecido e botas mais definidos; passo de recuo corrigido;
virada apoiada; pernas recolhem durante o salto; varredura agachada; lenço e
poeira acompanham o movimento. A lâmina luminosa usa o retângulo de perigo real.

## Captura e limites

`bastion-play.mp4`: 731 quadros a 30 fps, 24,37 s, 960×540, escala por vizinho
mais próximo. Trecho contínuo do quarto posto: uma derrota, retomada e passagem
aberta. Sem áudio. Controles de toque e tremor desligados apenas na captura.

`native-input.json`: 9.705 quadros de entrada de teclado, com transição para o
duelo no quadro 4.749. Recibo final: vitória, fase 3, saúde do chefe zero,
quatro mortes acumuladas. O quarto posto acrescenta uma morte; o duelo, outra.
O prefixo anterior contém duas. Nenhuma alteração de posição, vida, proteção,
tempo de cena ou câmera foi usada para a captura.

`capture.json` documenta os instantes e estados. A sequência foi dirigida por
escolha programática de teclas no mesmo motor do jogo; não é uma sessão humana
nem mede sozinha a qualidade do balanceamento. A suíte de testes e a checagem
de tipos não foram executadas, conforme o fluxo de publicação do repositório.
Os casos existentes foram ajustados à nova resistência/alcance, e a fita de
entrada foi atualizada para a rota vencedora.

`vanguard-atlas.png`: 32 poses explícitas, 1024×720.
`guards-atlas.png`: 50 poses explícitas, 1280×640.
As pranchas inspecionam arte; não constituem capturas de gameplay.

Ferramentas de autoria: `scripts/prove_hypothetical_vanguard.ts`,
`scripts/prove_hypothetical_guards.ts`, `scripts/render_hypothetical_vanguard_play.ts`.
