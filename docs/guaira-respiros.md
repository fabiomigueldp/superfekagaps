# Guaíra · Passagem dos Respiros

Fatia efêmera do arrozal, implementada sobre `WorldGame`, `Input`, `Player`, `WorldObjects` e o ciclo nativo `jetCycle`. O trecho ensina a observar uma descarga, partir numa janela seca e frear no refúgio antes de avaliar outro ritmo. Não há física própria, corrida/salto obrigatório, moeda, seletor ou requisito oculto de checkpoint.

## Geometria e recuperação

Galeria de 704×384 px, piso sólido contínuo em y304. Entrada x0–160, primeira grelha x160–256, refúgio x256–384, segunda grelha x384–560 e saída x560–704. Spawn x48 com capacete; checkpoint nativo x304/y304. A chegada real, viva, apoiada no piso e com x≥656 conclui a tentativa. O checkpoint nunca representa conclusão.

Cada grelha é um `jet` nativo em y176/height132: boca em y304 e coluna máxima de128 px. Período4200 ms, fases0 e1200 ms. `objects.time` controla colisão, aviso, altura, textura e decoração. A carga nativa de800 ms não machuca. Somente a coluna visível é perigosa; canais decorativos e névoa não têm colisão.

Morte reinicia os ciclos em time0 e reconstrói o ponto de entrada ou a ilha. O capacete do checkpoint segue o estado capturado pelo mecanismo nativo. Tentar chama `load` sem resume e limpa imediatamente resultado, checkpoint, input e fase. Sair/reentrar sempre começa outra tentativa. Nenhuma leitura ou escrita de localStorage, mudança de campanha, saída global ou desbloqueio persistente.

## Enquadramento local

A galeria fixa a câmera vertical em144: piso na linha160, topo da coluna na linha32, ápice do salto completo de Feka por volta da linha33, abaixo do cabeçalho de23 px. O alvo horizontal é x−48 com easing nativo de12% e limites do nível; ao recuar, Feka mantém pelo menos24 px de margem esquerda. No refúgio do replay (x309.025), a câmera assentada é261.025 e mostra a grelha inteira e21 px da margem direita antes da partida. Esta adaptação só pertence à fatia; a câmera global não muda.

Pausa, perda de foco e aba oculta usam o fluxo nativo e limpam comandos segurados. A retomada é explícita. Ao concluir, o estado da cena congela enquanto a interface continua aceitando pausa e som. Movimento reduzido remove tremor, impactos e poeira; sinais essenciais e coluna mantêm a mesma simulação.

## Prova offline reproduzível

`tests/guaira-respiros.test.ts` usa o DOM/canvas/audio de teste somente na fronteira. As colisões, teclas/toques, movimento, frenagem, jatos, dano e checkpoint são código de produção. `tests/helpers/guairaRespirosReplay.json` é o replay congelado de teclado e toque: um frame inicial,160 parado,128 para direita,48 parado,180 para direita e60 parado (577 frames, incluindo o repouso final). O repouso por três ciclos continua coberto separadamente nos testes de segurança das margens. Nenhum reposicionamento, invocação de conclusão, corrida, salto ou dano artificial acontece nesse replay.

O adaptador conclui x657.3253406888704, pés304, capacete intacto e checkpoint0. Ele congela na primeira chegada apoiada, antes do x674 observado pela prova primitiva anterior. A repetição integral produz o mesmo estado.

Uma segunda rota real de teclado/toque pula a bandeira, sem reposicionar Feka:161 frames parado,110 à direita,40 à direita com salto segurado,271 parado e180 à direita. Ela conclui com capacete e checkpoint nulo, comprovando que o ponto de recuperação é opcional.

A varredura controla apenas o estado inicial do ensaio e testa252 fases a60 Hz, com um frame inicial e depois `phase` frames parados. Cada partida começa em repouso e usa apenas direita:

| Travessia | Partida/alvo | Duração | Fases iniciais seguras, inclusivas | Total | Maior janela cíclica |
| --- | --- | --- | --- | --- | --- |
| Grelha1 | x128→304 |91 frames /1516.67 ms |0–41 e137–251 |157/252 |2616.67 ms |
| Grelha2 | x304→608 |155 frames /2583.33 ms |41–157 |117/252 |1950 ms |

Partir no fim da retração oferece3500 ms até a próxima água perigosa. A caminhada inteira ao alvo profundo da segunda margem leva2583.33 ms, sobrando916.67 ms: acima da exigência de600 ms, sem corrida.

Comparação da travessia completa em252 fases iniciais: direita contínua89/252, corrida contínua87/252 e saltos fixos24 frames ligados/24 desligados100/252. Uma política que caminha até a margem, solta para frear e observa a retração completa antes de cada grelha conclui252/252 sem perder o capacete. O ritmo muda a decisão e a segunda fase precisa ser reavaliada.

Também coberto:

- Três ciclos completos parados em x128,304 e608; frenagem para ambas as bordas da ilha com caminhada/corrida e teclado/toque
- Inversão com teclas no meio de cada grelha, saída com salto curto/longo, enquadramento do ápice e da margem de chegada
- Perda real de capacete e morte por permanecer na coluna, antes/depois do checkpoint; retorno nativo com fase reiniciada e ilha segura
- Pausa por Escape/cabeçalho, blur e hidden durante carga e vazão; reentrada explícita sem comandos presos; cancelamento de toque
- Retry síncrono, capacete capturado, checkpoint sem resultado, chegada aérea sem resultado e chegada apoiada sem exigir checkpoint
- Repetição determinística, render sem mutação, movimento reduzido e ausência de armazenamento/finalização da campanha

Os testes de dano usam um posicionamento inicial declarado dentro do jato e deixam a simulação causar o dano; não chamam `hurt` ou `die`. Os testes isolados de conclusão usam fixtures declaradas para testar o predicado. Isso é distinto do replay contínuo sem atalhos.

A arte é fornecida por `GuairaRespirosArt.ts`; os testes do pintor verificam cobertura opaca do retângulo perigoso, câmeras fracionárias e primeiro/último pixel. Prova em navegador, capturas do render real, toque em dispositivo e toolbar pertencem ao gate de integração; o harness offline não os substitui.

## Integração

`GuairaRespiros` exporta `GUAIRA_RESPIROS`, `guairaRespirosStage`, `finished`, `mapReturnHref`, `canAdvanceToBoss` e `toggleRespirosPause`. MAPA sempre retorna a `./guaira.html?at=rice`; somente uma chegada concluída acrescenta `&visit=respiros-clear`. A entrada `/guaira-respiros.html` reutiliza a barra bitmap de três controles e a barra de toque DOM de 44 px. O mapa valida esse resumo e mantém a ação RESPIROS opcional no arrozal, o botão principal CURRAL e a sequência vigente. A ativação de CURRAL consulta `canAdvanceToBoss` no momento do clique; pausa e retry invalidam continuações antigas sem esperar o próximo frame. A passagem não reabre o ramal público nem conclui Ossabravo/Prefeito.

## Revisão de ritmo: observar o segundo aviso no refúgio

Base de integração: `bc431d5c492079a4565fe39fe96742f8dd790057` (inclui a bica
pós-vitória do Bairro). Escopo: dados e arte de Respiros, seus testes/replay e
prova visual. Travessia e Pátio foram diagnosticados e mantidos: a primeira já
ensina pular antes de pressionar baixo; o segundo já exige duas sentadas com
transporte nativo e retorno seco. Não há dependência nova de mapa, capítulo,
Input, física ou API de outra frente.

No percurso que caminha até x128, observa a retração de A e segue até a
bandeira, a chegada ocorre perto de 3,95 s. Com a fase antiga de B (2100 ms), a
segunda descarga já começava em 3,90 s: o jogador chegava depois do aviso.
Com a fase de 1200 ms, o aviso começa em 4,00 s, a água sobe em 4,80 s e retrai
completamente em 5,50 s. Assim, a pausa do refúgio mostra a sequência inteira
antes da caminhada mais longa. A placa `PARE E OLHE` aponta para o medidor
nativo; é cenário atrás de Feka e da bandeira, sem apoio ou colisão nova.

O teste da lição percorre a fase desde o spawn com quatro hesitações iniciais,
teclado, toque simulado e movimento reduzido. Observa pelo menos 47 frames de
carga (dos 48 nominais), freia dentro da ilha e conclui intacto mesmo aguardando
600 ms depois da retração. A comparação com o parâmetro antigo é explícita no
teste; seguir direto já era arriscado antes desta mudança. As 252 fases de
partida continuam solucionáveis pela política de observar ambas as grelhas.
A janela segura isolada de B permanece 117/252 fases e a margem de caminhada
permanece 916,67 ms. A mudança desloca a apresentação do risco; não acelera a
água nem exige mais precisão de movimento.

Validação sobre a base atualizada: `npm test` passou 1249 testes TypeScript e 3
JavaScript; `npm run build` passou validações de níveis/assets/world e os dois
projetos TypeScript. `npm run size:build`: 40.575.205 bytes/141 arquivos contra
40.574.974 bytes/141 arquivos na base (+231 bytes), abaixo de 45.000.000.
Nenhum asset ou dependência de runtime foi adicionado.

O Chromium local renderizou o percurso real com eventos DOM de teclado e
passos fixos de 16,67 ms, controlados externamente para comparação reproduzível.
As capturas em `/tmp/guaira-trio-proof` mostram a mesma chegada antes/depois,
o aviso, a descarga e a conclusão intacta. São capturas de navegador, mas o
relógio controlado não mede FPS nem substitui avaliação humana em tempo real.
Toque é testado no harness e o viewport estreito é emulado; não houve ensaio em
celular físico, escuta de áudio ou avaliação perceptual de qualidade comercial.
