# Direção de arte e áudio

> Registro da direção de pré-produção. A execução posterior e seus limites estão em [implementação](implementacao.md).

[Voltar à direção](README.md) · [Referência do remaster](../graphics-v2/README.md)

Este é um briefing de produção. Nenhum sprite, composição musical ou voz nova é entregue por este documento. As capturas do remaster foram consultadas como referência; os arquivos de voz foram inventariados pelo manifesto, sem avaliação auditiva nesta etapa.

**Atualização visual:** foram produzidas [13 pranchas de conceito](conceitos/index.html), com [análise, revisões de identidade e aplicação às 30 fases](conceitos/README.md). Elas detalham esta direção e servem de referência para a autoria dos próximos sprites e cenários.

## Direção visual

Pixel art expressiva, mais luminosa e colorida que a campanha atual, mantendo a família visual do remaster. Escala de referência: 320 × 180, tiles de 16 × 16, luz principal superior esquerda e contorno escuro colorido nos atores. Fundo tem contraste menor; plano caminhável, perigos e personagens recebem a definição principal.

Manter Feka reconhecível pelos óculos, cabelo, roupa azul e proporções. Referência atual de arte: 16 × 26; colisão de referência: 14 × 24. Não aumentar silenciosamente a hitbox ao acrescentar movimento de braços ou acessórios. João e Yasmin partem das representações atuais, não dos helpers legados.

### Paletas e marcos por mundo

As cores são amostras de direção, não paletas finais nem instrução para recolorir automaticamente o código atual.

| Mundo | Cores de referência | Materiais e três planos principais | Marco reconhecível |
| --- | --- | --- | --- |
| Costa | turquesa `#48BFC3`, folha `#79AF59`, areia `#EACB87` | céu/nuvens; falésias/ilhas; vegetação costeira atrás do terreno | ponte sobre grande gap |
| Porto | azul `#437FA3`, amarelo `#E3B74E`, madeira `#A96B4B` | céu; guindastes distantes; cais e cargas de fundo | guindaste de Biel |
| Fábrica | metal `#466D88`, suco `#A95ADF`, espuma `#E6BEFA` | estrutura distante; tanques; tubos e equipamentos recuados | tanque com retrato de Calabrezzo |
| Serra | céu `#B4A4D5`, pedra `#A9B7C2`, pinheiro `#498576` | céu; picos; torres e cabos distantes | estação de teleférico |
| Reserva | gelo `#A6DDEB`, sombra `#477292`, suco `#A95ADF` | câmaras; tanques de reserva; tubulações frias | reservatório congelado iluminado |
| Domínio | creme `#EBD7AD`, vermelho `#CD615D`, pedra `#657FA3` | céu; torres/jardins distantes; arcos e interiores recuados | residência e ponte de João |

Três planos por mundo são a composição inicial: 18 planos lógicos, com peças e cores reutilizáveis quando coerentes. Caverna, interior de contêiner e interior de fábrica podem recompor peças desses kits e do remaster, sem exigir seis cenários adicionais completos.

### Suco e sinalização

- Líquido roxo, sombra violeta e espuma lilás. Verde-limão `#B7D957` aparece em instrumentos, setas e pontos de energia; não cria uma segunda química de líquido.
- Barril comum: corpo metálico, cinta larga, tampa e rótulo legível como símbolo na escala nativa.
- Barril pressurizado: válvula proeminente, cinta diagonal e pulso de preparação. A diferença continua legível em tons de cinza.
- Tanque fechado: moldura e reflexo do vidro; líquido atrás dele não sugere superfície caminhável.
- Cuba aberta: borda física, sinal de perigo e superfície exposta. Mostrar onde começa o contato perigoso.
- Nenhum brilho verde faz sozinho a distinção seguro/perigoso. Adicionar posição, forma e animação.

## Personagens e animação

### Estudos necessários antes da folha final

Criar pelo menos três estudos de silhueta para Calabrezzo e três para Biel, na escala aproximada de jogo, ao lado de Feka e João. Escolher pela leitura e pela atuação, não pela quantidade de detalhe. As características faciais pessoais permanecem abertas até referências do autor; não inventar semelhança real.

| Personagem | Proposta de silhueta | Contraste de atuação |
| --- | --- | --- |
| Feka | corpo pequeno, óculos, roupa azul, braços expressivos | peito estufado antes da ação; recomposição rápida após constrangimento |
| João | silhueta robusta conhecida, pele verde e roupa roxa | peso, confiança e golpes amplos |
| Calabrezzo | tronco largo, pernas menores, luvas e barril ao ombro; roupa creme/laranja com detalhes violetas | poses comerciais e arremesso teatral |
| Biel | volume quadrado, equipamento azul-petróleo/amarelo, luvas e faixa de trabalho | economia de gestos; mover carga parece fácil |
| Yasmin | preservar cabelo, roupa e proporções do sprite do remaster | olhar, aceno e surpresa discretos |

Quadros dos novos chefes podem começar em caixas de aproximadamente 48 × 48 ou 48 × 56. São hipóteses; verificar lado a lado com João e dentro da arena antes de definir atlas ou colisão. Acessórios podem extrapolar o corpo visual sem causar dano invisível.

### Estados mínimos de produção

As quantidades abaixo são orçamentos de autoria iniciais, não exigência de todos os quadros serem desenhos exclusivos. Poses sustentadas devem usar duração adequada; espelhamento só quando acessórios e ação permitirem.

| Conjunto | Estados e referência de desenhos |
| --- | --- |
| Feka — núcleo | revisar idle 2, corrida/caminhada 6 existentes, subida/ápice/queda, sentada preparação/queda/impacto/recuperação, dano, morte, respawn e celebração |
| Feka — cenas | ajeitar óculos 2–3, pose de herói 2–3, surpresa/recomposição 2–3; sem novos movimentos obrigatórios de controle |
| Cada chefe — núcleo | idle 2–3; locomoção 4–6; preparação de cada ataque 2–3; execução 2–4; recuperação 2–3; dano 2; derrota/retirada 3–5 |
| Cada chefe — revanche | acessórios e poses específicas do mecanismo; reutilizar locomoção e reações quando cabível, sem só trocar cor |
| Yasmin | idle 2, olhar lateral 2, aceno 3, surpresa 2 |
| E1 minion | aproveitar ciclo e reações existentes após revisão de paleta local |
| E2/E3/E4/E6 | locomoção quando aplicável, aviso de ataque, execução, recuperação, dano/derrota; poses distintas para regra de proteção |
| E5 agitador | descanso, preparação, atividade e parada, com indicação clara de colisão |
| Mapa | Feka caminhando/esperando; ícones de fases, chefes, saídas, selos e conexões abrindo |

Todo frame de ator registra tamanho, âncora dos pés, duração, direção, pontos de acessório e nome do estado. Não desenhar uma sentada genérica e reutilizá-la como dano apenas por conveniência. Testar continuidade dos pés, centro visual e leitura de contato em ciclos completos.

## Inventário de materiais, objetos e efeitos

| Kit | Entregas |
| --- | --- |
| Terreno | seis famílias de aparência; topo, miolo, faces laterais, cantos, plataforma atravessável e variantes controladas |
| Transporte | plataforma móvel, elevador, contrapeso, carga de apoio, carga perigosa, trilho, cabine e paradas |
| Comandos | acionador padrão, válvula ligada a acionador, indicadores de duas posições e símbolos de pareamento |
| Fábrica | esteira nas duas direções, barris de dois tipos, anteparo alvo, tanque, cuba e bocais |
| Reserva | piso de gelo, placa de gelo alvo, calha, proteção congelada e decoração de condensação |
| Final | suporte fraturado que baixa até batente, ponte de segmentos e portão |
| Recompensas/UI | moeda, Mini Fanta e capacete revisados; selo, bandeira secreta, estados de mapa e galeria |

Efeitos compartilhados: poeira de pouso, poeira de corrida, impacto da sentada, acerto, coleta, ativação de checkpoint e partículas curtas de quebra. Efeitos específicos: espuma/salpico de suco, aviso e jato, gelo fraturado, tensão/impacto de carga, rachadura/gap de João e onda de chão final.

Cada efeito precisa de origem, duração, área visual e prioridade. Partículas não ocultam o ponto de contato ou a marcação de um chefe. O efeito de quebrar gelo não cria colisões novas. Fumaça e espuma desaparecem antes de uma nova decisão crítica naquele local.

## Cena de referência e revisão de arte

Primeira cena: trecho de **3-1**, aproximadamente duas telas de jogo, com Feka, barril, esteira, carregador, fundo de fábrica e HUD. Um pequeno espaço contíguo de teste pode mostrar acionador, jato e Calabrezzo sem alegar que fazem parte do layout final de 3-1.

Entregar primeiro quadro de composição e depois captura do trecho em movimento no renderizador real. Revisar em resolução nativa e ampliação inteira: distinguir apoio/perigo/decoração, leitura dos óculos e do barril, contraste do líquido, escala dos atores e sincronização de som/impacto.

Referências ou imagens conceituais não contam como sprites prontos. Todo asset de produção precisa respeitar grade, paleta, transparência, pivô e sequência de animação. Preservar fonte editável ou gerador determinístico junto da exportação.

Não produzir os seis kits inteiros antes de aprovar a cena de referência visualmente e jogar com ela. Depois, fazer uma cena pequena por novo mundo para verificar identidade e continuidade.

## Áudio: três camadas de atuação

### Gravações existentes do João

O [manifesto atual](../../src/voice/joaozaoVoiceManifest.ts) contém seis falas. Os formatos OGG e WebM no diretório de assets são alternativas do mesmo material, não doze falas diferentes. A duração abaixo vem do manifesto e deve ser conferida ouvindo os arquivos antes da edição.

| Fala | Duração cadastrada | Contexto proposto |
| --- | --- | --- |
| Aqui é o João, namorado da Yasmin. | 1,92 s | introdução J1; apresentação completa uma vez |
| Eu sou o namorado dela. | 1,14 s | abertura J2; reforço irônico no contexto heroico |
| Para de encher o saco. | 0,96 s | reaparição de Feka em M3 ou reação pontual |
| Porra nenhuma. | 0,36 s | dano ou resposta a pose prematura, sem negar vitória já conquistada |
| Sei que você quer | 0,66 s | primeira parte de provocação preparada |
| Você não vai ter! | 0,66 s | segunda parte e eventual repetição cômica deliberada |

Manter texto da legenda igual à gravação. Não cortar fonemas para simular frases novas. O combo já existente pode ganhar pausas e enquadramento próprios. Tratar primeira vez e repetição de tentativa de forma diferente.

### Falas novas com texto e vocalização

Criar banco original de 8–12 unidades vocais curtas por personagem para Feka, João, Calabrezzo, Biel e Yasmin: aproximadamente 40–60 unidades no total como orçamento inicial. Unidades podem ser vocalizações gravadas para esse fim ou síntese de timbre vocal; escolher após ouvir uma amostra comparativa no contexto do jogo. Evitar um simples bip agudo incessante.

| Personagem | Direção de timbre/ritmo proposta |
| --- | --- |
| Feka | médio, rápido, entusiasmado, com pausas que acompanham sua pose |
| João | médio-grave, ritmo próximo ao das gravações existentes; continuidade deve ser avaliada ouvindo |
| Calabrezzo | encorpado, teatral, sílabas sustentadas em apresentação de produto |
| Biel | grave, seco, frases curtas e espaços maiores entre grupos |
| Yasmin | timbre leve e claro, ritmo calmo; identidade não depende de exagero agudo |

Algoritmo de interpretação: texto aparece em grupos curtos; uma unidade vocal acompanha um grupo, não cada letra. Espaços e pontuação criam pausas. Pequenas variações de altura e duração permanecem num intervalo coerente com o personagem. Não repetir a mesma unidade em sequência longa.

Ao revelar todo o texto, parar as unidades pendentes; não disparar de uma vez o restante da fila. Pular a fala cancela áudio e balão juntos. Não sobrepor vocalização a uma gravação inteligível. Diálogos novos têm identificação de personagem, texto, emoção, modo de voz e evento de disparo.

### Reações e esforço

Separar 4–6 reações curtas por personagem quando necessárias à atuação: esforço, surpresa, dano, satisfação e derrota. Para Yasmin, limitar às reações efetivamente usadas em cena. Grunhidos de combate não substituem o som de aviso do golpe; não repetir a mesma reação em cada salto do jogador.

## Prioridade, repetição e mixagem

- Aviso de perigo tem canal e espaço de mixagem próprios. Fala pode baixar de volume ou ser adiada para mantê-lo audível.
- Ordem de decisão para vozes: cena obrigatória em ambiente seguro; reação relevante; comentário contextual; provocação ambiente. Não confundir prioridade de voz com prioridade de som de gameplay.
- Primeira hipótese: intervalo de 12–20 segundos entre provocações ambientes, histórico das últimas três falas e no máximo uma repetição imediata em um combo deliberado por encontro.
- Reações ao dano podem ser mais frequentes, mas não interrompem cada sílaba de uma fala anterior. Testar com a luta em velocidade real.
- Sliders separados para música, efeitos e vozes; legendas disponíveis mesmo com voz silenciada.
- Pausa e transições precisam suspender/cancelar filas coerentemente. Uma fala antiga não começa depois de recarregar a fase.
- Não alterar agressivamente altura das gravações existentes para “fabricar” personalidade nova. Equalização, ganho e cortes de silêncio são avaliados por audição.

## Música, ambientes e efeitos sonoros

Orçamento inicial: **seis temas de mundo, três temas-base de chefes e um tema de mapa**. Reprises de chefe usam arranjos mais intensos da mesma identidade. Título e final podem adaptar motivos do jogo atual, preservando continuidade. Não é necessário um sistema de música adaptativa complexo para a primeira campanha.

| Mundo | Direção musical proposta | Ambiente discreto |
| --- | --- | --- |
| Costa | melodia aberta, percussão leve, sensação de partida | mar e aves distantes |
| Porto | ritmo de trabalho, madeira/metais, baixo marcado | água, guindastes e cargas espaçadas |
| Fábrica | groove mecânico, baixo elástico, timbres borbulhantes | motores e fluxo de líquido |
| Serra | melodia espaçada, instrumentos arejados, sensação de altura | vento leve e cabos; sem vento físico |
| Reserva | variação fria e cristalina do vocabulário da fábrica | refrigeração e estalos discretos |
| Domínio | retomada dos motivos de Feka e João, caráter grandioso | jardins, interior e fornos conforme a fase |

Criar sons distintos para acionador confirmado, inversão de esteira, preparação de jato, jato ativo, aproximação de carga, quebra de anteparo, barril comum/pressurizado, chefe vulnerável e conexão de mapa aberta. Reaproveitar sons do remaster quando cumprirem a mesma função e a mixagem combinar.

Revisar em fones e alto-falantes pequenos. Testar todas as pistas importantes com música e vozes simultâneas, além de conferir loops sem estalos. Material sonoro só é considerado pronto depois de ouvido no jogo.
