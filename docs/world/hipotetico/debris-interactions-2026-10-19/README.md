# Atividades de fundo: variedade e consequências

Revisão de 19/10/2026, integrada ao encontro nativo `/?encounter=hipotetico`.

## Descobertas e perseguições

Refinamento 9: `HypotheticalAftermathEscape` acrescenta dois acontecimentos
ocasionais por pátio, com personagens próprios: descoberta num vão entre pedras
e saída de uma escotilha. Eles entram entre as doze performances do repertório
recorrente, depois da destruição inicial da pilha e de outras atividades.

O diretor só prepara uma cena quando a origem, o destino e a posição da
montaria cabem no enquadramento. Usa a caminhada e o giro nativos para chegar
ao ponto de preparação. Mudanças de câmera durante a aproximação podem
redirecionar a escolha, sem consumir o personagem. Uma cena já iniciada conclui
seus movimentos; uma nova rua conserva a prioridade de sua ação principal.

- **Pedras:** ruídos nos passos 12 e 22; espreitada a partir de 22; corrida em 64;
  reação da montaria em 82; grupos de tiros a partir de 112. Duração máxima de
  260 passos, com recuperação antecipada após um acerto.
- **Escotilha:** ruído inicial, espreitada em 32, abertura gradual da folha;
  corrida em 76; perseguição em 94; grupos de tiros a partir de 120. Duração
  máxima de 256 passos. O batente, o vão e a folha pertencem ao cenário desde
  antes da cena; a folha permanece aberta depois.

Os atores reaproveitam roupa, cabeça, marcha, olhar para trás e queda de
`HypotheticalBystanders`. A profundidade acompanha o pequeno salto sobre os
destroços e também entra no volume usado pela colisão. O cavaleiro antecipa o
movimento do alvo. As balas seguem o cano visível; a interseção real determina
o acerto. Os disparos que passam atingem o piso ou o fundo do abrigo no primeiro
ponto de contato do segmento, com marcas limitadas a oito por evento.

A montaria acelera progressivamente, mantém distância durante a corrida e
freia após o acerto ou a fuga. Apoios, ciclo de caminhada, poeira e mira usam a
posição real do corpo. O personagem atingido conserva parte do impulso da
corrida antes de concluir a queda compartilhada.

Cada pátio tem duas figuras finitas; não são reutilizadas depois de uma fuga
ou de um acerto. Há pelo menos 1260 passos e cinco outras performances antes
de preparar a segunda cena. O restante do repertório continua indefinidamente.
Eventos ambientais e chegadas de bandos aguardam os sinais principais da cena;
o primeiro grupo de tiros pode assustar aves próximas. As vozes sonoras usam
o barramento já existente. Não há temporizadores externos ao relógio do jogo.

O lançamento da torre, a tolerância de enquadramento ajustada pelo usuário e
a busca existente nos seus escombros foram preservados. As novas cenas não
interferem nos controles, colisões de Feka, portões ou progressão dos guardas.

`render_hypothetical_escapes.ts` produz quatro composições de cinco segundos,
a 60 fps, com o diretor e o renderizador nativos. `escape-study.json` registra
poses, atores e contatos do material. São composições com Feka parado, sem
combate ou áudio; não são testes ou partidas gravadas. A publicação usa apenas
o build Vite, sem suíte de testes, typecheck, prebuild ou revisão de navegador.

## Bandos e rajadas

Refinamento 8: os quatro pátios compartilham agora doze performances. `flush-fire`
tem três preparações (pisada, rugido e cauda) com disparos espaçados em grupos e
recuperação do cavaleiro. A abertura `flush` também passa a acompanhar as aves
que escapam do beiral, depois do contato principal com a pilha.

`HypotheticalAftermathFlock` substitui a trajetória puramente decorativa. Cada
ave tem apoio, alerta, decolagem, voo, chegada, queda e repouso. O fuzil antecipa
a trajetória e acompanha o ponto suavemente; cada projétil segue a direção do
cano. O acerto exige interseção do segmento percorrido com o corpo. Aves que
escapam continuam o voo, sem morte determinada apenas pelo relógio da cena.

As quedas têm impulso herdado, gravidade, arrasto, giro, pequeno ressalto e
acomodação no pavimento. Há duas plumagens, penas com deriva e sombras de
contato. Até oito corpos permanecem temporariamente no chão; até 42 penas e
12 projéteis podem coexistir. Os corpos desaparecem gradualmente depois de um
tempo; nunca são reutilizados como aves vivas no beiral.

As aves sobre a pilha decolam quando seu apoio se desloca. As dos beirais
permanecem para a resposta posterior. Após a fuga, novos bandos chegam de fora
do enquadramento, com intervalo de 940–1479 passos e pelo menos 110 passos sem
novo ruído forte. A chegada não acontece durante a torre ou em outra rua fora
do enquadramento. Um bando que pousou pode motivar a próxima combinação; essa
prioridade pede espaço para uma passagem mais calma e outras performances.
O repertório também pode escolher a combinação espontaneamente quando há alvo.

O diretor preserva a exclusão das duas últimas ações, evita repetir a cadência
anterior nas ações com variação e reserva o trecho da rajada contra incidentes
ambientais concorrentes. As buscas usam duas farejadas com expiração. Sons
curtos de asas e impactos secos compartilham o barramento e o limite de vozes
existentes; pausa e descarte continuam interrompendo as vozes.

**Preservado:** prioridade, tolerância de enquadramento e sequência da torre,
assim como a busca existente entre seus escombros. Nenhum desses módulos foi
reescrito nesta rodada. O avanço de Feka continua determinando a próxima rua.

`render_hypothetical_flocks.ts` produz quatro recortes de quatro segundos,
a 60 fps, com posições de Feka mantidas para composição. Usa o renderizador e
o diretor nativos, sem navegador, combate, asserções ou testes. `flock-study.json`
registra os instantes, poses e atores dos recortes; `flock-flight-board.png`
amplia os detalhes sem suavizar a pixel art. O vídeo é mudo.

```sh
node --import tsx scripts/render_hypothetical_flocks.ts .tmp/flock-polish-final <caminho-do-canvas>
```

Publicação pelo fluxo autorizado do projeto: build Vite de produção, sem suíte
de testes, typecheck, prebuild ou revisão de navegador.

## Refinamento 7: apoio, deslocamento e repercussão

Durante puxadas, sacudidas, investidas e rajadas, os apoios passam a ser definidos no espaço da rua. O movimento do tronco é compensado nas patas, e os joelhos são reconstruídos pelo mesmo esqueleto articulado do jogo. A preparação reposiciona uma pata por vez nos passos 2–14 e 13–25. Puxadas usam uma base recuada sob o quadril para evitar alongar a perna dianteira além do alcance. O fim da performance libera os apoios em sequência.

A poeira da caminhada agora parte do apoio calculado pelo mesmo desenho. Deslocamentos de esforço deixam de avançar o ciclo de caminhada. A aproximação de um alvo próximo usa uma duração proporcional, com mínimo de 18 passos; uma distância praticamente nula pula diretamente para a orientação/preparação. A aproximação cinematográfica da torre mantém seu tempo próprio.

Pancadas, quedas de peças, passos e rugidos podem transmitir um impulso ao pátio. Ele chega aos objetos próximos primeiro, perde força com a distância e desaparece gradualmente. Panos presos, correntes ancoradas e poças já formadas pelos vazamentos respondem a essa energia. Não há sorteio por quadro. São até seis impulsos, com expiração em 160 passos, e os fragmentos de uma mesma queda não reiniciam repetidamente a reação. Movimento reduzido omite esses movimentos decorativos.

O ponto de saída da arma também incorpora a inclinação do corpo, como o desenho da sela e do ombro já faziam.

`weight-response.mp4` reúne 14,63 segundos a 30 fps, com sacudida na Portaria, pedra no Cais, chapa no Arsenal e investida no Bastião. A composição usa posições dirigidas de Feka, sem áudio ou combate em primeiro plano. `weight-study.json` guarda as poses, posições do corpo, apoios e impulsos. É material de autoria; não é teste, partida gravada ou avaliação de dificuldade.

```powershell
node --import tsx scripts/render_hypothetical_material_responses.ts .tmp/aftermath-weight-7 C:/Users/fabio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas/index.js --weight
```

## Refinamento 6: reação, intenção e contato

O gesto genérico de atenção foi substituído por quatro respostas. Cabeça, mandíbula, cauda e apoio do corpo participam da reação; o cavaleiro responde quatro passos depois, e ambos voltam ao repouso antes da caminhada seguinte.

| Origem | Reação | Duração, em passos nativos | Possíveis respostas no mesmo objeto |
| --- | --- | --- | --- |
| Madeira | Abaixar a cabeça e farejar duas vezes | 64–70 | Sacudir, erguer ou investir |
| Pedra | Inspeção mais baixa, voltada ao piso | 68–74 | Afastar, remexer ou pisar |
| Corrente / chapa | Recuo curto e apoio do corpo | 58–64 | Forçar, investir com rajada ou golpear com a cauda |
| Vazamento | Recuo, fechamento breve dos olhos e sopro | 78–84 | Forçar, investir com rajada ou atirar na estrutura |

As respostas evitam as duas ações recentes e dependem de alcance, enquadramento e estado da peça. Quando não há resposta adequada, o diretor retorna ao repertório geral. Um evento fora do enquadramento deixa de esconder outro ruído visível. A reação reserva seu objeto para evitar que um novo evento o mova durante a observação.

O sopro usa a posição real da boca nos passos 34, 39 e 44. Seu som ocorre uma vez. Fragmentos passam a ter origem no contato, trajetórias determinísticas, gravidade e ressalto próprios por material, atrito e acomodação. Poeira no piso e o novo som discreto de resíduos acompanham a primeira queda. Os fragmentos pequenos expiram entre 76 e 88 passos; as peças grandes continuam persistentes. O vento e os estalos não recomeçam uma demolição já concluída.

`material-responses.mp4` contém quatro trechos selecionados, totalizando 24,03 segundos a 30 fps. O registro `material-study.json` documenta estalo seguido de erguer uma viga, acomodação seguida de busca na pedra, corrente seguida de investida e rajada, e vazamento seguido de manipulação da chapa. As sequências usam o diretor e renderizador nativos, com posições dirigidas de Feka, sem áudio e sem combate em primeiro plano. São material de autoria, não testes ou uma avaliação de jogabilidade.

```powershell
node --import tsx scripts/render_hypothetical_material_responses.ts .tmp/aftermath-responses-6 C:/Users/fabio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas/index.js
```

O argumento `--stills` produz somente as 16 poses e a prancha. O vídeo anterior de 120 segundos permanece disponível para comparação do repertório.

## O que mudou nesta rodada

O repertório passa de nove para **onze performances**. A ordem fixa foi substituída por uma seleção ponderada, com semente na entrada da rua. As duas ações anteriores são evitadas; as que ficaram muito tempo sem aparecer ganham prioridade quando há um alvo acessível. Cada pátio tem preferências próprias. Depois de duas passagens mais ruidosas, as investigações recebem mais peso.

Não há encerramento do ciclo enquanto Feka permanece na etapa. O avanço da rua seguinte continua dependendo do jogador. A queda da torre e a busca nos seus escombros ficam reservadas ao começo das atividades secundárias do Bastião, antes dos novos pequenos eventos ambientais.

## Novas performances

- **Sacudir a viga:** aproximação e pegada, esforço para erguer, três sacudidas alternadas, soltura e acomodação. Cabeça, viga e partículas compartilham o ponto da boca. O cavaleiro compensa o movimento cinco passos depois do dinossauro, com rédeas, tronco e roupa. Os pés deixam de reproduzir um ciclo de caminhada durante a manipulação.
- **Investida seguida de rajada:** antecipação, impacto do focinho no material, recuo e duas sequências de tiros do cavaleiro. A chapa responde pela dobradiça; não é substituída por um objeto novo. Os disparos ocorrem depois do contato principal, deixando as duas ações legíveis.

| Performance | Contatos principais | Soltura / tiros | Duração da ação |
| --- | --- | --- | --- |
| Sacudir viga | Pegada 52; esforço 78; sacudidas 112, 138 e 164 | Soltura 194 | 250 passos |
| Investida e rajada | Investida 52 | Tiros 88, 93, 98, 103, 118 e 123 | 166 passos |

São passos nativos a 60 Hz. Caminhada, eventual virada e recuperação são adicionais. As manipulações anteriores de viga, pedra e chapa continuam usando as mesmas peças persistentes.

O ponto de queda considera também o espaço necessário para o corpo e a boca na busca seguinte. Isso evita abandonar uma viga junto à borda da tela, ainda visível, mas impossível de alcançar na mesma composição.

## Ritmo e pontaria

As rajadas isoladas têm quatro cadências, com seis a nove tiros. A arma percorre pontos dentro da superfície do alvo, em vez de disparar sempre no centro. Cada projétil conserva o ponto amostrado na saída. Perfurações ficam no material e acompanham a chapa quando ela abre. Há até doze marcas persistentes por objeto.

Pisadas variam entre um, dois e três contatos. As remexidas têm séries de dois, três ou quatro movimentos; os rugidos alternam uma emissão longa e duas mais curtas. A pose lê os mesmos tempos que disparam os efeitos. As recuperações variam, com respiração, atenção ao objeto e manejo da arma.

## O ambiente responde

Cinco tipos de evento pequeno complementam as ações: **estalos de madeira, acomodação de pedras, corrente e chapa vibrando, rajadas de vento e vazamentos**. Um ataque pode provocar uma consequência atrasada. Há também eventos espaçados, com variação de intervalo e material. Não são sorteados novamente a cada quadro.

- Pedra solta usa a física existente. Uma peça presa na boca ou uma chapa sendo manipulada fica protegida desses eventos.
- Correntes têm fixação, elos e oscilação amortecida. Panos dobram a partir da amarração; folhas e poeira passam perto do piso.
- Cais e Arsenal têm juntas de tubulação visíveis, gotas, pequenos respingos e marcas de umidade. O Arsenal acrescenta um sopro de vapor.
- Um ruído pode levar o dinossauro a virar e reagir por 58–84 passos antes de uma resposta no mesmo objeto. Há intervalo entre essas reações.
- Aves bicam no pouso, fogem de impactos fortes e retornam com intervalos variados.
- Estalos, correntes e vazamentos têm sons breves próprios no barramento existente de efeitos, com o mesmo limite de vozes.

Os eventos começam apenas no pátio visível, respeitam a cena da torre e evitam os instantes próximos aos principais impactos e tiros. Estado e listas de efeitos são limitados. Movimento reduzido mantém poses essenciais, encaixes e desgaste, omitindo rajadas decorativas de vento e simplificando partículas.

## Material de autoria

O vídeo reúne **120 segundos**, a **30 quadros por segundo**, dos quatro pátios em composições simultâneas. Usa o renderizador de produção com posições dirigidas de Feka, sem áudio e sem combate em primeiro plano. Não é uma partida gravada nem uma avaliação da dificuldade. A simulação de animação continua a 60 Hz.

`art-study.json` registra a composição em vídeo, as escolhas de atividade e os eventos ambientais. `pose-study.json` registra uma segunda composição para a prancha, incluindo o contrapeso na direção oposta da sacudida. Ela apresenta sacudida, contrapeso do cavaleiro, investida, rajada, atenção a ruídos e pontaria.

Nessa composição de poses, cada pátio passou pelas onze performances. São observações do material de autoria, não uma validação do combate.

```powershell
node --import tsx scripts/render_hypothetical_aftermath.ts .tmp/aftermath-orchestration-final C:/Users/fabio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas/index.js --orchestration
```

Acrescente `--stills` para produzir somente a prancha e suas poses, sem gravar os quadros do vídeo.

Publicação pelo fluxo do projeto, somente com build de produção, sem suíte de testes, typecheck ou revisão de navegador.
