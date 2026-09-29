# Campanha — fichas das 30 fases

> Registro da direção de pré-produção. A execução posterior e seus limites estão em [implementação](implementacao.md).

[Voltar à direção](README.md) · [Regras de progressão](gameplay.md) · [Confrontos](chefes.md)

## Como usar estas fichas

Os IDs `1-1` a `6-5` são estáveis para o planejamento. Nomes podem mudar, exceto **Fábrica de Suco**. Cada ficha descreve intenção, sequência, checkpoints, recompensas, assets específicos e uma condição observável de revisão. A geometria em tiles depende do protótipo de movimento; não está sendo afirmada como pronta ou jogável.

Em fases de percurso, S1/S2/S3 são os três selos locais. São IDs distintos mesmo quando descritos de forma semelhante. Só as terceiras fases têm uma segunda saída; outros desvios voltam ao percurso e não criam fases adicionais. A quarta fase pode ser pulada, portanto apenas consolida habilidades ou apresenta conteúdo dispensável que será reensinado quando necessário.

Referências de ritmo, a validar: percurso comum de 3–5 minutos numa tentativa bem-sucedida, exploração de 5–8 minutos; aproximação de chefe de 20–40 segundos, seguida por luta de aproximadamente 1–2 minutos, com margem maior no final. Não estimar duração total multiplicando esses valores sem considerar aprendizagem, mortes e exploração.

## M1 — Costa dos Gaps

**Imagem:** mar turquesa, rocha clara, grama viva, pontes e cavernas frias. **Aprendizado:** salto, corrida, sentada e caminhos inferiores. **Mapa após J1:** uma embarcação de serviço fica acessível; João se retira por outra rota. Desembarque no porto de M2.

### 1-1 — Pé na Estrada

- **Ideia e sequência:** praia larga → degraus e moedas em arco → primeiro minion isolado → pequeno desnível com recuperação → mirante do porto. Ensinar corrida com espaço de frenagem e sentada numa tampa marcada sobre chão seguro.
- **Checkpoint:** depois da tampa, antes do trecho que combina minion e salto.
- **Selos:** S1 no arco sobre degrau; S2 sob a tampa; S3 em plataforma alta alcançada com corrida, com chão abaixo.
- **Momento e lore:** Feka faz pose ao enxergar o barco de João ao longe; o jogador mantém controle no chão seguro.
- **Assets específicos:** espuma costeira, barco distante, tampa fraturada e placa do porto.
- **Revisão:** alguém que não conhece o jogo identifica a rota e executa a primeira sentada sem precisar abrir uma tela de controles.

### 1-2 — Ponte Bamba

- **Ideia e sequência:** apresentar plataforma instável sobre areia → atravessar grupos curtos → introduzir mola em poço seguro → combinar queda temporizada e salto de mola sobre caminho inferior.
- **Checkpoint:** depois da primeira travessia completa, antes da combinação com mola.
- **Selos:** S1 sobre primeiro grupo de tábuas; S2 numa enseada inferior com retorno por mola; S3 acima de dois apoios instáveis, com recuperação inferior.
- **Momento e lore:** placas recém-colocadas desviam Feka; ele toma a direção mais complicada com entusiasmo.
- **Assets específicos:** estacas, tábuas com aviso de colapso, cordas decorativas e versão costeira da mola.
- **Revisão:** tremor e som permitem distinguir o tempo de preparação da queda; cair no primeiro exemplo não mata.

### 1-3 — Por Baixo do Gap

- **Ideia e sequência:** bifurcação com chão inferior visível → caverna de pedra e cristais → passagens de sentada e molas → subida para a saída comum. Não usar queda sem mostrar o destino.
- **Checkpoints:** entrada da caverna; base da subida final, antes da escolha entre as duas saídas.
- **Selos:** S1 na entrada; S2 atrás de tampa fraturada; S3 numa sequência opcional de molas com apoio de retorno.
- **Saída secreta:** rachadura lateral mostra luz e moedas; sentada abre a entrada para uma passagem ascendente curta. Revela escadaria no mapa entre 1-3 e 1-5 e também abre 1-4.
- **Momento e assets:** a rota mais baixa chega a um mirante surpreendente; raízes, teto recortado, cristais discretos e escadaria de serviço.
- **Revisão:** é possível antecipar o piso inferior; o brilho decorativo não se confunde com selos ou plataformas.

### 1-4 — Falésias em Sequência

- **Ideia e sequência:** saltos de corrida → recuperação numa plataforma larga → duas pontes instáveis → mola e aterrissagem entre minions. Nenhuma regra nova para J1.
- **Checkpoints:** após a primeira sequência de corrida; antes das duas pontes.
- **Selos:** S1 na rota normal; S2 no caminho inferior com retorno; S3 sobre sequência opcional que combina mola e plataforma instável.
- **Momento e lore:** a ponte do chefe aparece ao fundo e se aproxima; Feka vê a silhueta de João esperando.
- **Assets específicos:** arcos de falésia, ponte distante e gaivotas apenas decorativas.
- **Revisão:** jogador que utiliza o atalho de 1-3 consegue compreender J1; esta fase oferece domínio, não informação obrigatória.

### 1-5 — Joãozão na Ponte

- **Percurso:** pequena travessia sem novidade → capacete opcional → checkpoint na plataforma de entrada → arena J1.
- **Confronto:** [J1](chefes.md#j1--joãozão-na-ponte); aprender a escapar de marcações fixas e aproveitar recuperação.
- **Recompensa:** conclusão e abertura de M2; sem selos na arena.
- **Momento:** a fala de apresentação de João precede o primeiro controle da luta; Feka ganha a travessia ao vencer.
- **Assets específicos:** segmentos de ponte destruíveis, marcação de impacto e animação de retirada.
- **Revisão:** morrer retorna ao checkpoint com arena íntegra e introdução pulável; o chefe nunca destrói a única rota possível.

## M2 — Porto do Bielzão

**Imagem:** água azul profunda, madeira quente, guindastes amarelos e cargas com cintas. **Aprendizado:** plataformas móveis, acionadores e contrapesos. **Mapa após B1:** uma ponte de carga baixa e conecta o porto à fábrica; Biel parte por uma cabine de manutenção.

### 2-1 — Carga Chegando

- **Ideia e sequência:** embarcar num elevador sobre chão → esperar uma parada → saltar entre duas plataformas em trajetórias separadas → cruzar o cais. Apresentar transporte sem exigir salto no primeiro contato.
- **Checkpoint:** depois do primeiro par de plataformas.
- **Selos:** S1 numa parada do elevador; S2 sob o cais acessível por escada de plataformas; S3 numa carga alta durante uma parada longa.
- **Momento e lore:** rótulos da Fábrica de Suco aparecem nas encomendas antes da visita a M3.
- **Assets específicos:** atracadouro, trilhos, plataformas com bordas seguras, guindaste distante.
- **Revisão:** Feka permanece estável sobre apoios em movimento e não escorrega por erro de transporte da física.

### 2-2 — Peso e Contrapeso

- **Ideia e sequência:** sentada num acionador move uma carga visível → repetir com duas posições → primeiro operário de capacete em chão largo → usar o contrapeso para acessar uma passarela.
- **Checkpoint:** após a apresentação do operário, antes do circuito maior.
- **Selos:** S1 na primeira carga elevada; S2 num compartimento aberto pela posição baixa; S3 numa travessia opcional entre posições.
- **Momento e lore:** Feka usa um sistema feito para carga como se fosse um monumento à sua chegada.
- **Assets específicos:** cabo decorativo ligado ao mecanismo, indicadores de posição, operário e acionador padrão.
- **Revisão:** qualquer estado do contrapeso permite voltar ao comando ou concluir; pulo comum no capacete rebate sem causar morte inesperada.

### 2-3 — Entre os Contêineres

- **Ideia e sequência:** passagens internas e externas → carga pendular inofensiva no primeiro contato → topo dos contêineres → percurso de contrapesos já conhecido.
- **Checkpoints:** saída do primeiro interior; base do último guindaste.
- **Selos:** S1 sobre contêiner baixo; S2 atrás de uma carga levantável; S3 numa plataforma pendular opcional.
- **Saída secreta:** janela mostra bandeira alternativa; posicionar um contrapeso revela passagem pela passarela de manutenção. Abre ligação 2-3 → 2-5.
- **Momento e assets:** panorama da fábrica no alto; interiores com cor mais fria, cintas, guindaste e bandeira secreta.
- **Revisão:** o jogador reconhece cargas de apoio e cargas perigosas pela forma; a pista da saída aparece antes da decisão de subir.

### 2-4 — Expediente Pesado

- **Ideia e sequência:** alternar cargas móveis → apresentar maromba de investida sozinho contra barreira → combinar travessias com áreas de espera. O maromba não é conhecimento obrigatório para B1.
- **Checkpoints:** antes do maromba; antes do último conjunto de plataformas.
- **Selos:** S1 em parada obrigatória; S2 atrás de barreira acessível pelo caminho inferior; S3 num topo opcional após uma investida.
- **Momento e lore:** cargas passam sobre Feka enquanto ele corre para alcançar a próxima; sensação de porto ativo.
- **Assets específicos:** barreira amortecedora para investida, maromba e conjunto de cargas decorativas de fundo.
- **Revisão:** não existem ciclos que exijam esperar tempo excessivo ou adivinhar uma plataforma fora da câmera.

### 2-5 — Mestre das Cargas

- **Percurso:** acesso à cabine de operações → capacete opcional → checkpoint fora da arena → B1.
- **Confronto:** [B1](chefes.md#b1--mestre-das-cargas); elevar apoios e alcançar Biel durante a recuperação.
- **Recompensa:** abertura de M3; sem selos na arena.
- **Momento:** Biel move uma carga com facilidade na introdução; depois utiliza o guindaste durante a luta.
- **Assets específicos:** cabine, carga com cinta de perigo, plataformas de apoio separadas e reação de pane.
- **Revisão:** cabo e marcação mostram destino do golpe; se Feka perde a oportunidade, o próximo ciclo restaura uma nova chance.

## M3 — Fábrica de Suco

**Imagem:** metal azul, suco roxo, espuma lilás, sinalização clara e indicadores verde-limão. **Aprendizado:** barris, esteiras reversíveis e pressão. **Mapa após C1:** o equipamento que bloqueava a saída para a serra para; uma carga de reserva segue pela linha privada de Calabrezzo até M5.

### 3-1 — Recebimento de Barris

- **Ideia e sequência:** barril rolando visível de longe → área para saltar com folga → esteira curta sobre piso seguro → carregador isolado → combinação com intervalo de descanso.
- **Checkpoint:** após a primeira esteira, antes do carregador.
- **Selos:** S1 num arco sobre o primeiro barril; S2 num galpão lateral; S3 sobre uma rota alta que exige posicionamento na esteira.
- **Momento e lore:** o letreiro completo “Fábrica de Suco” e o logotipo de Calabrezzo dominam a entrada.
- **Assets específicos:** letreiro, barril, esteira, carregador e galpão de recebimento.
- **Revisão:** barris são percebidos como perigos, não como plataformas ou itens; a origem de cada lançamento é visível.

### 3-2 — Linha de Envase

- **Ideia e sequência:** acionador inverte esteira e move barril para um anteparo marcado → agitador em ciclo isolado → inverter outra esteira para abrir passagem → combinar os dois.
- **Checkpoint:** depois do primeiro anteparo rompido, antes do agitador.
- **Selos:** S1 junto ao anteparo; S2 num corredor lateral aberto pela inversão; S3 sobre passarela opcional entre ciclos do agitador.
- **Momento e lore:** João atravessa uma passarela distante e reage brevemente à presença de Feka; o trecho é seguro.
- **Assets específicos:** engarrafadora, anteparo alvo, agitador, tubulação e passarela de fundo.
- **Revisão:** inversão afeta imediatamente a direção de transporte sem teletransportar barris; equipamento se recompõe em caso de tentativa perdida.

### 3-3 — Tanques de Mistura

- **Ideia e sequência:** observar aviso de jato numa área segura → subir entre tanques por plataformas fixas → acionar válvula para alternar duas saídas de pressão → travessia final com períodos de descanso.
- **Checkpoints:** após o primeiro jato; patamar antes da bifurcação final.
- **Selos:** S1 sobre a primeira válvula; S2 numa passarela atrás de um tanque; S3 numa subida opcional entre jatos alternados.
- **Saída secreta:** vidro revela uma passagem seca de manutenção; válvula redireciona o jato que a bloqueia. Um corredor curto termina na saída para 3-5; não há natação em suco.
- **Momento e assets:** maior tanque da fábrica no fundo; vidro, bolhas discretas, válvulas e indicadores de pressão.
- **Revisão:** o aviso continua legível com partículas e música; o comando não pode deixar Feka preso na área ativa.

### 3-4 — Pressão Máxima

- **Ideia e sequência:** esteira e barril → descanso → jatos com apoios fixos → circuito curto que combina inversão e passagem durante o descanso de pressão.
- **Checkpoints:** antes dos jatos; antes do circuito final.
- **Selos:** S1 na passagem comum; S2 num vão lateral após inverter uma esteira; S3 em plataforma alta acessível numa janela opcional ampla.
- **Momento e lore:** os equipamentos passam do funcionamento regular a um esforço exagerado, preparando a presença de Calabrezzo.
- **Assets específicos:** variante de máquina sobrecarregada, vapor de fundo e luzes de estado.
- **Revisão:** o jogador nunca precisa executar sentada num acionador enquanto um perigo inevitável já ocupa o ponto de aterrissagem.

### 3-5 — Controle de Qualidade

- **Percurso:** corredor de inspeção, barril demonstrativo contido, capacete opcional e checkpoint → C1.
- **Confronto:** [C1](chefes.md#c1--controle-de-qualidade); devolver o barril usando a esteira e atacar na abertura.
- **Recompensa:** passagem para M4; sem selos na arena.
- **Momento:** Calabrezzo apresenta o barril como produto de excelência antes de usá-lo contra Feka.
- **Assets específicos:** mesa de controle, esteira da arena, equipamento vulnerável e poses de arremesso/reação.
- **Revisão:** devolução sem acerto não bloqueia a luta; o próximo barril sempre permite repetir a estratégia.

## M4 — Serra Suspensa

**Imagem:** pedra clara, pinheiros, céu lilás e cabos entre estações quentes. **Aprendizado:** leitura de trajetórias suspensas e planejamento vertical. **Mapa após B2:** teleférico de passageiros volta a funcionar até a Reserva Gelada. Não introduzir vento físico nesta versão; fitas e nuvens são decorativas.

### 4-1 — Estação de Subida

- **Ideia e sequência:** cabine transporta Feka sobre chão → salto entre estação e cabine parada → primeiro vigia de trilho em área segura → subida por trechos separados.
- **Checkpoint:** estação intermediária antes do primeiro trajeto sobre abismo.
- **Selos:** S1 na primeira parada; S2 atrás de cabine estacionada; S3 num patamar opcional alto com plataforma de retorno.
- **Momento e lore:** uma cabine distante leva João e Yasmin; ela acena, Feka comemora em segurança.
- **Assets específicos:** cabines, torres, vigia, pinheiros e silhuetas distantes do casal.
- **Revisão:** a câmera mostra a estação de destino antes de pedir desembarque; nenhum apoio necessário passa invisível.

### 4-2 — Contrapeso nas Nuvens

- **Ideia e sequência:** relembrar acionador sobre chão → operar duas cargas alternadas → reapresentar o maromba em espaço seguro para quem pulou 2-4 → subir usando posições estáveis.
- **Checkpoint:** após a apresentação do maromba, antes do sistema duplo.
- **Selos:** S1 na carga baixa; S2 numa reentrância lateral; S3 no topo opcional do segundo contrapeso.
- **Momento e lore:** as estruturas de Biel conectam montanhas inteiras; Feka as reorganiza para abrir seu caminho.
- **Assets específicos:** suportes em rocha, grandes polias e abrigo de manutenção.
- **Revisão:** alterar um comando nunca abandona o outro fora de alcance; o jogador entende qual carga está ligada a cada símbolo.

### 4-3 — Cabos Cruzados

- **Ideia e sequência:** trajetórias separadas → encontro de duas linhas com paradas → carga pendular de apoio → estação com ramificação. Todo cruzamento tem área estável para observar.
- **Checkpoints:** antes do primeiro cruzamento; estação anterior à ramificação final.
- **Selos:** S1 na parada comum; S2 em torre lateral com retorno; S3 numa troca opcional entre cargas.
- **Saída secreta:** uma bandeira visível numa estação alta indica a rota; usar contrapeso para alcançar cabine de manutenção que termina em 4-5.
- **Momento e assets:** vista do arquipélago abaixo; estações com símbolos diferentes e cabos cuja cor não é o único identificador.
- **Revisão:** cruzamentos não sugerem colisão entre planos que só se sobrepõem visualmente; o apoio real fica claro.

### 4-4 — Travessia do Alto

- **Ideia e sequência:** combinar cabines, carga pendular e vigias → descanso panorâmico → subida final com dois contrapesos. Nenhuma perseguição ou regra inédita.
- **Checkpoints:** mirante central; antes da subida final.
- **Selos:** S1 na estação principal; S2 abaixo do mirante com retorno; S3 numa troca opcional de cabine, com patamar de recuperação.
- **Momento e lore:** a central de Biel aparece acima; a aproximação comunica que ele preparou uma nova barreira.
- **Assets específicos:** central no horizonte, bandeirolas e versão noturna suave das estações.
- **Revisão:** erros de transferência não exigem refazer uma subida longa; a câmera não oscila entre apoios próximos.

### 4-5 — Revanche nas Alturas

- **Percurso:** estação de serviço, capacete opcional e checkpoint → B2.
- **Confronto:** [B2](chefes.md#b2--revanche-nas-alturas); escolher rotas de cargas e criar acesso à cabine de Biel.
- **Recompensa:** abertura de M5; sem selos na arena.
- **Momento:** Biel fecha a linha de passageiros e inicia a linha de carga; Feka precisa usá-la contra ele.
- **Assets específicos:** central com dois níveis, desvios de trilho e cabine vulnerável.
- **Revisão:** existe sempre uma plataforma segura durante a marcação; nenhuma configuração esgota as possibilidades de alcançar o chefe.

## M5 — Reserva Gelada

**Imagem:** depósito frio, gelo azul, metal claro e suco roxo atrás de vidro. **Aprendizado:** frenagem no gelo e direcionamento de pressão; a silhueta industrial permanece, mas a atmosfera muda. **Mapa após C2:** a doca aquecida abre a travessia até M6; João aparece brevemente já do outro lado.

### 5-1 — Estoque a Frio

- **Ideia e sequência:** gelo plano com parede segura → alternar gelo e piso de freio → saltos curtos com aterrissagem larga → carregador em piso normal antes da combinação final.
- **Checkpoint:** depois da primeira alternância, antes dos barris.
- **Selos:** S1 sobre piso seguro; S2 numa câmara lateral; S3 numa rota alta de gelo com recuperação inferior.
- **Momento e lore:** embalagens e retratos mostram que a reserva também pertence a Calabrezzo.
- **Assets específicos:** piso congelado, vedação de portas, pallets frios e respiro ambiente.
- **Revisão:** o jogador identifica quando começa e termina a baixa aderência; o sprite não sugere escorregamento sobre piso normal.

### 5-2 — Tubulação Congelada

- **Ideia e sequência:** demonstrar anteparo de gelo marcado e jato que o rompe → acionar válvula reversível → repetir entre plataformas fixas → cruzar um trecho curto de gelo.
- **Checkpoint:** após a primeira barreira aberta, antes da sequência combinada.
- **Selos:** S1 atrás do primeiro anteparo; S2 em saída lateral de pressão com retorno; S3 acima de uma combinação opcional de dois jatos.
- **Momento e lore:** Feka abre passagens dentro de uma estrutura que estava conservando o estoque.
- **Assets específicos:** anteparo de gelo fraturável com símbolo, bocal direcionado e gotejamento decorativo.
- **Revisão:** todo anteparo obrigatório volta ao estado correto no checkpoint; o efeito de gelo quebrado não esconde a área ativa do jato.

### 5-3 — Reserva Especial

- **Ideia e sequência:** apresentar barril pressurizado contido → direcioná-lo por esteira para alvo de gelo → observar abertura de passagem → combinar direcionamento e janela de pressão.
- **Checkpoints:** após o exemplo contido; antes do depósito final.
- **Selos:** S1 junto ao exemplo; S2 atrás de anteparo lateral; S3 sobre passarela opcional com agitador já conhecido.
- **Saída secreta:** um alvo de gelo lateral revela o túnel de expedição. A válvula e o trilho permitem enviar um barril até ele; túnel leva ao nó 5-5.
- **Momento e assets:** estoque rotulado como reserva, barril com cinta/valvulação própria e portão translúcido.
- **Revisão:** errar a direção gera outro barril após intervalo seguro; ficar sem objetos nunca exige reiniciar a fase.

### 5-4 — Choque de Temperatura

- **Ideia e sequência:** alternar piso frio e seco → dirigir barris entre ciclos de pressão → saltar apoios estáveis com agitadores → circuito final curto. Sem gelo derretendo sob Feka ou nova física térmica.
- **Checkpoints:** depois da alternância; antes do circuito final.
- **Selos:** S1 no piso seco central; S2 num corredor lateral de retorno; S3 após direcionar barril a alvo opcional.
- **Momento e lore:** a iluminação muda entre câmaras e corredor técnico, dando variedade sem mudar regras.
- **Assets específicos:** portas de câmara, sinalização de temperatura e condensação contida.
- **Revisão:** combinação continua legível em baixa velocidade; não exige memorizar qual trecho vai aparecer fora da câmera.

### 5-5 — Calabrezzo: Reserva Especial

- **Percurso:** antecâmara, capacete opcional e checkpoint → C2.
- **Confronto:** [C2](chefes.md#c2--reserva-especial); romper proteção com pressão e acessar Calabrezzo.
- **Recompensa:** abertura de M6; sem selos na arena.
- **Momento:** Calabrezzo tenta preservar a pose enquanto veste equipamento do depósito; a revanche tem humor próprio.
- **Assets específicos:** proteção congelada, rampa de barris, plataforma de manutenção e poses com acessório de reserva.
- **Revisão:** perder uma abertura não cria uma arena cada vez mais difícil; fases da luta mantêm áreas secas de segurança.

## M6 — Domínio Pizzarino

**Imagem:** jardins vivos, pedra creme e azul, toldos vermelhos, fornos dourados e grandes pontes. **Aprendizado:** combinar o repertório e introduzir alvos estruturais de impacto antes de J2. **Mapa após J2:** todas as conexões conquistadas continuam acessíveis; retornar ao mapa depois do final para concluir pendências.

### 6-1 — Jardins Pizzarino

- **Ideia e sequência:** jardins com minions e operários → apoio fraturado marcado que baixa por sentada → saltos sobre novos patamares → repetição em estrutura maior, sempre local e recuperável.
- **Checkpoint:** após a primeira estrutura baixada, antes do trecho com operários.
- **Selos:** S1 na rota do jardim; S2 num pátio sob apoio baixado; S3 numa sequência alta opcional.
- **Momento e lore:** o lugar parece habitado e cuidado; Feka atravessa com a mesma pose heroica da abertura.
- **Assets específicos:** jardins, toldos, assentos de casal como detalhe discreto e suporte fraturável com símbolo próprio.
- **Revisão:** jogador entende que a estrutura baixa até um batente seguro, sem imaginar destruição livre de todo o cenário.

### 6-2 — Fornos e Passarelas

- **Ideia e sequência:** jatos de forno com a mesma sinalização temporal de pressão → esteiras de carga → operários e plataformas móveis → combinação curta com descanso.
- **Checkpoint:** após primeiro conjunto de fornos; antes da combinação final.
- **Selos:** S1 sobre passarela comum; S2 numa área de serviço; S3 entre duas passarelas opcionais com jatos alternados.
- **Momento e lore:** detalhes de pizzaria dão identidade a Pizzarino sem criar outro sistema de culinária.
- **Assets específicos:** forno, carrinho decorativo, esteira de pedra e jato com forma visual de calor.
- **Revisão:** jato quente conserva as regras aprendidas; mudança de aparência não introduz imunidades ou alcance escondidos.

### 6-3 — Passagem dos Fundos

- **Ideia e sequência:** alternar interior e exterior da muralha → contrapesos e suportes fraturados → plataformas suspensas → bifurcação para os portões.
- **Checkpoints:** torre intermediária; patamar antes da bifurcação.
- **Selos:** S1 na torre; S2 num balcão com retorno; S3 numa rota opcional que combina contrapeso e suporte.
- **Saída secreta:** janela permite ver uma escada de serviço; baixar um suporte libera sua entrada. A trilha no mapa contorna 6-4 e chega a 6-5.
- **Momento e assets:** sinais de uma residência aparecem nos interiores; janelas, escada, mosaico e portão distante.
- **Revisão:** quem escolhe o atalho já domina todas as interações necessárias a J2; não precisa ter jogado 6-4.

### 6-4 — A Última Travessia

- **Ideia e sequência:** três trechos curtos: cargas/contrapesos, pressão/esteiras, pontes/sentada. Pequeno descanso entre eles. Um obstáculo principal por tela, evitando juntar todo o catálogo simultaneamente.
- **Checkpoints:** entre o primeiro e o segundo trecho; antes do terceiro.
- **Selos:** S1 na primeira rota comum; S2 no desvio do segundo trecho; S3 na rota alta do terceiro.
- **Momento e lore:** a paisagem revisita visualmente as ilhas percorridas; João aparece esperando do outro lado.
- **Assets específicos:** ponte final, bandeiras e composição panorâmica com marcos dos mundos anteriores.
- **Revisão:** dificuldade vem da combinação dominada; nenhuma nova surpresa letal aparece no último salto.

### 6-5 — O Grande Gap

- **Percurso:** escadaria curta, capacete opcional e checkpoint → J2 → cena final.
- **Confronto:** [J2](chefes.md#j2--o-grande-gap); induzir impactos em suportes para criar acesso, escapar e atacar.
- **Recompensa:** campanha concluída, estatísticas e **FEKA SALVOU YASMIN?**; sem selos na arena.
- **Momento:** João retoma uma fala conhecida em contexto final; o último golpe é dado pelo jogador, sem substituição por cena automática.
- **Assets específicos:** arena de dois níveis, suportes, gaps fixos por ciclo, recuperação de João e cenário final de Yasmin.
- **Revisão:** a arena não pode ficar insolúvel; final e retorno ao mapa preservam o save, inclusive com fases opcionais ainda pendentes.

## Conferência de escopo

- 30 fichas: 24 percursos e seis encontros.
- 72 selos: três por percurso, zero por encontro.
- Seis saídas secretas: uma em cada fase de número 3.
- Seis conexões de atalho: cada uma liga a terceira fase ao chefe do mesmo mundo.
- Três personagens de chefe, cada um com dois encontros.
- Quartas fases não contêm aprendizado exclusivo necessário aos chefes.
- Duração e dificuldade dependem de testes; as fichas não substituem revisão de layouts e sessões observadas.
