# Atividades de fundo: variedade e consequências

Revisão de 19/10/2026, integrada ao encontro nativo `/?encounter=hipotetico`.

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
- Um ruído pode levar o dinossauro a virar e observar por 34–50 passos antes de escolher a próxima ação. Há intervalo entre essas reações.
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
