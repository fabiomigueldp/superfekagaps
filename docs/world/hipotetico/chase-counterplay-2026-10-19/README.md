# Perseguição — cargas, rotas e combinações de tiros

19.10.2026. Revisão de mecânicas, ataques e interação com o ambiente da perseguição do Flávio Hipotético.

## Problemas encontrados no código

- Os andaimes ofereciam altura e itens, mas a maior parte da destruição era iniciativa exclusiva do perseguidor. O jogador tinha poucas maneiras de usar o cenário para mudar o ritmo da fuga.
- Os ataques duravam 78 ticks independentemente da ação. A rajada baixa tardia tinha uma segunda salva nos ticks 41/46/51 sem uma nova preparação. A fila de ataques era iniciada por posição sem limite de validade para o trecho.
- As balas consideravam o chão e a água, mas ignoravam os pisos elevados que Feka usava. Visual e colisão de cobertura não expressavam a mesma geometria.
- O trecho das comportas tinha uma sequência menor de oportunidades verticais que os bairros adjacentes.

## Implementação

- `HypotheticalLayout.CHASE_COUNTERS` define três pedais em plataformas nativas: cais (x834), comportas (x2564) e portaria (x3400). A carga fica atrás do pedal e cai sobre o percurso do perseguidor. O pedal é acionado uma vez pelo apoio descendente dos pés, apenas enquanto o piso correspondente existe. Seguir pela pista inferior não o aciona.
- `HypotheticalChaseCounterplay` mantém três estados finitos. A liberação precede a queda em quatro ticks; gravidade, rotação e limites da carga definem seu retângulo de contato. A sobreposição real com o corpo do perseguidor inicia a reação. Não é uma colisão com Feka nem um acerto garantido por acionar o pedal.
- O acerto reduz a velocidade do chefe a 32% e a recupera suavemente durante 42 ticks. `HypotheticalModel.chase` cancela a ação e a continuação ainda não disparadas. As balas em voo são preservadas. A reação usa o movimento corrente, sem deslocar o chefe por teletransporte ou alterar a física do jogador.
- Uma carga que erra continua no chão até o perseguidor avançar além dela. Ao perder o apoio, conserva a velocidade vertical e cai no rio, com recorte na superfície, ondas e evento sonoro no primeiro contato com a água. Cargas atrás de um checkpoint são marcadas como gastas; um novo modelo reinicia os mecanismos do trecho retomado.
- `HypotheticalChasePerformance` aplica compressão do tronco, recuo da cabeça, abertura da mandíbula, tensão das rédeas e resposta atrasada de cavaleiro, roupa e cauda. Os pés continuam no ciclo existente. A cor e a idade do impacto conduzem os fragmentos nativos; dois painéis maiores preservam a leitura da massa da carga.
- `HypotheticalChaseCounterplayArt` desenha os pilares próprios do guincho, travessas, tambor, retorno do cabo, pedal, carga e ruptura em pixel art. A tipoia usa a mesma transformação da carga. A placa de latão tem cavidade, mola, dobradiça e três pixels de curso, articulados em quatro ticks. O fecho abre ao terminar esse curso, antes da queda. Movimento reduzido diminui as partículas.
- `CHASE_TERRACES` recebe três plataformas nas comportas (x2448/y192, x2528/y168, x2640/y184). São mecanismos `support` nativos com as mesmas regras de apoio e destruição. A ordem das plataformas anteriores foi preservada para não renumerar os IDs das moedas existentes; a nova rota recebe as moedas da regra já existente.
- `HypotheticalEncounter.update` fornece os pisos vivos a `HypotheticalModel.chaseCover`. A mesma lista habilita os pedais e participa da busca pelo primeiro impacto de projétil. Pisos destruídos saem da lista no próximo passo nativo. Fragmentos usam madeira ou metal conforme o piso atingido. A parte perigosa do percurso da bala continua limitada pela primeira superfície encontrada.
- `CHASE_ATTACKS` declara posição de início, última posição válida, preparação, duração e instantes de tiro. Entradas atrasadas expiram antes do trecho seguinte. A preparação começa quando o chefe está a menos de 180 px do jogador, após 18 ticks de descanso e fora da reação à carga.
- A investida final começa em x3280. A combinação de x3664 usa mira alta (42 ticks de aviso, tiros 1/6/11, duração 22), seguida de novo aviso baixo de 34 ticks (tiros 1/7/13, duração 34). `preparePursuit` preserva a pose/arma anterior e emite um aviso por troca. A leitura visual usa a postura, a arma e a linha da mira.

## Segunda rodada — leitura visual e vida no cenário

- Removidos o `PISE`, sua seta flutuante, `drawChaseVolleyCue` e os rótulos `ALTO/BAIXO` junto à arma. Também removida a instrução de aproximação ao pedal do hint. Na perseguição em andamento, `HypotheticalGame` usa a faixa de progresso de 16 px; a linha explicativa não é desenhada. As descrições do ataque continuam no status acessível. Derrotas e os outros atos preservam suas apresentações.
- A placa de latão se distingue por material, relevo, desgaste, ranhuras e encaixe. O cabo liga a articulação ao tambor; a rotação da came e a abertura do fecho seguem a compressão de quatro ticks que já precedia a queda. A tipoia e o fecho se encontram no mesmo ponto.
- `HypotheticalModel.chaseAlerts` registra uma aproximação por estrutura a 128 px. O contato principal permanece a 56 px. Os tempos são finitos, seguem a pausa do modelo e não dependem da câmera. Checkpoints inicializam estruturas anteriores como passadas, sem reproduzir seus sons. Um ruído discreto de cabo, madeira ou pressão usa o barramento existente.
- `drawChaseApproachEffects` substitui o pequeno loop de grãos que reiniciava no ar por quedas finitas a partir das juntas superiores. Cada grão alcança o apoio antes de se dissipar. `chaseFragmentAt` emite fragmentos dos dois apoios e da viga nos respectivos marcos de ruptura. As faíscas das juntas metálicas respeitam a mesma ordem. Nós e fibras da madeira usam as transformações rígidas das vigas.
- `chaseDoorAt` só começa a fechar depois que o trabalhador terminou de se esconder atrás do batente. As folhas fecham com atraso por fachada e um pequeno assentamento antes do trinco.
- `chaseCartAt` desloca o carrinho oito pixels até um batente visível. A roda gira pela distância percorrida; a carga faz um único assentamento e a corda perde sua oscilação. A sombra acompanha o deslocamento.
- `chasePumpAt` integra a desaceleração em 58 ticks, preservando a fase angular e evitando o giro inverso causado por multiplicar o ângulo por uma velocidade decrescente. O volante para com a biela conectada. A tampa de alívio se ergue e o vapor completa sua trajetória finita; o vapor ambiente diminui.
- As placas comerciais giram pelo ponto de suspensão com seu desenho preso à mesma transformação. Pássaros usam uma batida de asas com descida mais curta, retorno mais longo e partida defasada. Não foram adicionadas novas colisões ou perigos decorativos.

## Autoria visual e limites

`scripts/render_hypothetical_chase_counterplay.ts` compõe as pranchas com os pintores nativos. O vídeo reúne 246 quadros a 30 fps: 60 quadros para cada uma das três cargas e 66 para a combinação final. Não há áudio. Posições do jogador, acertos e estados do chefe são dirigidos; o script não executa `model.update`, inputs, asserts ou uma partida.

As mídias foram recompostas para a segunda rodada. `render_hypothetical_chase_atmosphere.ts` produz uma prancha com rotina, alerta, resposta e repouso nos quatro bairros e um filme dirigido de 720 quadros a 30 fps. `render_hypothetical_chase_impacts.ts` compõe as poses estruturais com tempos de aproximação e contato preparados. A inspeção visual dessas imagens é parte da autoria da arte, não uma revisão de navegador ou teste de integração.

As imagens servem para revisar composição, cores e poses. Elas não comprovam dificuldade, equilíbrio dos saltos, colisões em execução, fluidez em dispositivo ou áudio. Os tempos de ataque foram estruturados a partir do código e da velocidade/salto nativos, sem teste de gameplay.

Conforme `AGENTS.md`, não são executados testes, typecheck, scripts de validação ou revisão de navegador. A publicação usa somente o build Vite de produção pelo fluxo autorizado em `docs/deploy.md`.
