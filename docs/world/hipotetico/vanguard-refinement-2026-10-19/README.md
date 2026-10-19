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

## Segunda rodada: cobertura, contato e leitura

O lançador do quarto posto reconhece uma preparação primária do Vanguarda:
investida pede arco alto; salto pede arco baixo. A solicitação só é atendida
depois de 1.100 ms de reabastecimento, com o jogador no alcance habitual. Cada
manobra aceita no máximo uma cobertura, com os 850 ms completos de preparação.
Não há mudança de direção após o aviso. O arremesso comum continua disponível.
O lançador não inicia novo arremesso enquanto o capitão está atordoado, e não
prepara mais um se já há dois barris vivos dentro do posto. Arremessos já
comprometidos e projéteis existentes continuam seguindo a física nativa.

As poses do Vanguarda guardam a postura anterior e se misturam ao longo de seis
quadros, sem alterar as janelas de dano. O salto tem subida, descida e amortecimento
próprios. Um salto bloqueado registra o contato no capacete, com breve flexão do
corpo e faíscas locais. O efeito da aterrissagem fica limitado à sacada e perde
o brilho ativo depois dos oito quadros de dano.

Investida/corte, varredura, bloqueio e pouso têm quatro sons sintetizados distintos
no canal de efeitos já existente. São disparados pelos instantes da simulação,
sem temporizadores adicionais. O limite de vozes, pausa, volume e descarte do
sintetizador permanecem compartilhados com os efeitos do encontro.

Quando um rebote deixa o corpo do Vanguarda abaixo do enquadramento, uma pequena
indicação na borda inferior mostra a posição horizontal, o tipo de ataque e o
progresso do aviso. Só aparece durante preparação/ataque e desaparece quando ele
retorna ao enquadramento. O HUD também indica as combinações com o barril.
O lançador do bastião ganhou uma insígnia que o aproxima visualmente do Vanguarda.

## Captura e limites

`bastion-play.mp4`: 567 quadros a 30 fps, 18,9 s, 960×540, escala por vizinho
mais próximo. Trecho contínuo do quarto posto: uma derrota, retomada e passagem
aberta. Sem áudio. Controles de toque e tremor desligados apenas na captura.

`native-input.json`: 9.377 quadros de entrada de teclado, com transição para o
duelo no quadro 4.421. Recibo final: vitória, fase 3, saúde do chefe zero,
quatro mortes acumuladas. O quarto posto acrescenta uma morte; o duelo, outra.
O prefixo anterior contém duas. Nenhuma alteração de posição, vida, proteção,
tempo de cena ou câmera foi usada para a captura.

`capture.json` documenta os instantes e estados, incluindo uma cobertura alta e
sete bloqueios. A cobertura baixa foi inspecionada na prancha de poses; não
apareceu nesta gravação. O vídeo é silencioso e não documenta a mixagem sonora.
A sequência foi dirigida por
escolha programática de teclas no mesmo motor do jogo; não é uma sessão humana
nem mede sozinha a qualidade do balanceamento. A suíte de testes e a checagem
de tipos não foram executadas, conforme o fluxo de publicação do repositório.
Os casos existentes foram ajustados à nova resistência/alcance, e a fita de
entrada foi atualizada para a rota vencedora.

`vanguard-atlas.png`: 32 poses explícitas, 1024×720.
`guards-atlas.png`: 50 poses explícitas, 1280×640.
`bastion-detail.png`: 12 poses explícitas de bloqueio e arremesso, 960×384.
As pranchas inspecionam arte; não constituem capturas de gameplay.

Ferramentas de autoria: `scripts/prove_hypothetical_vanguard.ts`,
`scripts/prove_hypothetical_guards.ts`, `scripts/render_hypothetical_vanguard_play.ts`
e `scripts/render_hypothetical_bastion_detail.ts`.
