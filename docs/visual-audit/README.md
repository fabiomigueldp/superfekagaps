# Direção visual — Super Feka Gaps

Análise de 29/09/2026, baseada no código e no estado atual do projeto, incluindo alterações locais que já existiam antes desta análise.

**O principal salto de qualidade está em construir um sistema de arte consistente. A engine atual permite isso.** O jogo tem uma base funcional de pixel art, mas reúne personagens, cenários, interface e ilustração final com densidades de detalhe, paletas e métodos de desenho diferentes. A impressão de protótipo vem principalmente dessa combinação.

[Abrir o painel com as capturas e a proposta de direção](index.html).

[Prancha conceitual](concept-direction.png), criada com imagegen para explorar atmosfera, materiais e expressão. Não é uma captura, um layout definitivo nem um atlas: a densidade de detalhe e as proporções da ilustração precisam ser adaptadas à grade de 320×180. O boss foi recolorido para preservar pele verde e roupa roxa. [Prompts e registro da geração](concept-prompts.md).

## 1. Como os gráficos são feitos hoje

| Parte | Implementação atual | Consequência para a produção de arte |
| --- | --- | --- |
| Engine | TypeScript, Canvas 2D, Vite; sem dependências de runtime declaradas | Não há Phaser, Pixi ou uma pipeline WebGL no código analisado. É possível elevar a qualidade mantendo esta arquitetura. |
| Resolução | Cena em canvas auxiliar de **320×180**, tiles de **16×16**, ampliação inteira com tratamento de DPR | Boa base para pixels nítidos. Não é necessário aumentar a resolução do jogo para melhorar o desenho. |
| Feka | Matrizes de caracteres em `playerSpriteSpec.ts`, convertidas em retângulos coloridos | A matriz é **8×13**, ampliada internamente em 2×: ocupa **16×26 pixels lógicos**, com hitbox de **14×24**. Isso explica o aspecto mais grosseiro que o dos tiles. |
| Animação do Feka | Idle, dois desenhos de caminhada, salto, pose sentada e capacete separado | Caminhar muda principalmente as pernas; salto e queda compartilham uma pose; todas as fases da sentada usam o mesmo desenho. |
| Inimigos | Minion com círculos e retângulos; Joãozão com partes do corpo desenhadas por código | Não usam um conjunto compartilhado de sprites e regras de acabamento. O minion é arredondado; o boss é bastante retangular. |
| Texturas dos tiles | Sequências de `fillRect`, traços e formas em `Renderer.ts` | Terra, tijolo, gelo, plataforma e rocha não são imagens carregadas. São desenhos procedurais repetidos em cada tile visível. |
| Fundos | `BackgroundGenerator.ts`: nuvens, montanhas, colinas, cidade, muralha, caverna e cristais | Camadas geradas com semente determinística, armazenadas em canvas e repetidas com paralaxe. Há uma base reutilizável de temas. |
| Escala dos fundos | Camadas geradas em 4×, depois reduzidas; `drawBackgroundRegion` ativa suavização | Isso introduz bordas e tons intermediários diferentes do desenho manual em pixels. O cache das camadas já existe e deve ser preservado. |
| Interface | Texto `monospace` do sistema; HUD e telas redesenhados no canvas de alta resolução | O texto fica legível, mas sua grade e seus contornos não combinam com a cena. A pausa ainda usa o caminho de baixa resolução. |
| Yasmin | PNG RGBA de **1024×1536**, cerca de **2,5 MiB**, desenhado em alta resolução no final | É uma ilustração com muito mais detalhe que o Feka. A diferença permanece mesmo com `imageSmoothingEnabled = false`. |
| Efeitos | Partículas, curvas, transparência, gradientes, flashes, rotação e filtros | Há bons eventos para dar resposta visual, mas falta uma linguagem única de formas, cores e duração. |
| Ferramentas | Editor próprio de fases, temas e paralaxe; validadores de fases e matrizes do jogador | Vale evoluir essas ferramentas, mantendo a prévia do editor fiel ao jogo. |

Fontes principais: [Renderer.ts](../../src/engine/Renderer.ts), [BackgroundGenerator.ts](../../src/engine/BackgroundGenerator.ts), [playerSpriteSpec.ts](../../src/assets/playerSpriteSpec.ts), [constants.ts](../../src/constants.ts), [Game.ts](../../src/game/Game.ts) e [package.json](../../package.json).

`src/assets/feka_concept_art.png` é uma referência ilustrada, não a spritesheet usada no jogo; seu conteúdo é JPEG apesar da extensão. `src/engine/Assets.ts` contém utilitários de atlas/animação, mas não encontrei consumidores desses utilitários no código atual. Portanto, não há um fluxo de atlas integrado ao desenho dos personagens.

## 2. O que merece ser preservado

- **O personagem e o humor:** óculos, cabelo escuro, roupa azul, Mini Fanta, capacete e sentada dão elementos próprios ao jogo. O redesenho deve torná-los mais reconhecíveis.
- **A resolução e a estrutura em tiles:** são adequadas ao tamanho dos personagens e ao gênero. Mudar a resolução agora multiplicaria o trabalho sem resolver a direção de arte.
- **A caverna como ponto de partida:** a combinação de rocha azul, profundidade fria e cristais já sugere uma identidade mais forte que os cenários de superfície.
- **A separação de fundos em camadas:** o sistema já permite profundidade e temas distintos. Precisa de melhor composição e desenho.
- **O editor e as regras compartilhadas de terreno:** mantêm os elementos visuais ligados a comportamentos verificáveis.

## 3. Diagnóstico e prioridades

As prioridades abaixo combinam impacto visual, frequência de exposição e dependências de produção. São recomendações de direção, não alterações já aplicadas.

### P0 — Unificar o pixel e a interface

**Densidade de pixel inconsistente.** O Feka usa blocos de 2×2 pixels lógicos; terreno e pequenos detalhes usam 1×1; moedas e minions usam curvas rasterizadas; o texto usa a resolução física da tela. A [folha extraída do renderizador](09-assets.png) torna a diferença explícita.

Recomendação: definir **1 pixel de arte = 1 pixel lógico** para toda a cena e desenhar o Feka novamente em aproximadamente 16×26 pixels reais. Preservar inicialmente a hitbox de 14×24 e a posição dos pés. Não basta diminuir `PLAYER_PIXEL_SIZE`: isso encolheria o personagem existente. É necessário desenhar mais informação na mesma área visual.

**A suavização está em mais de um ponto.** Desligar a interpolação na apresentação final não desfaz pixels intermediários produzidos antes. Gerar os fundos na resolução lógica, desenhar silhuetas em degraus e substituir elipses/traços livres por frames controlados resolve a causa. Não recomendar simplesmente trocar todos os `true` por `false`: formas já suavizadas e gradientes continuariam na imagem. A propriedade de Canvas controla a interpolação de imagens escaladas; não converte desenho vetorial em pixel art autoral. [Referência MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled).

**HUD com sobreposição confirmada.** A terceira vida ocupa x=120–126; o capacete é desenhado aproximadamente em x=119–129. A [captura com os dois itens](10-hud-items.png) confirma a sobreposição. Mais vidas ampliam o problema para os campos seguintes.

Recomendação: um retrato pequeno do Feka com `×3`, áreas reservadas para os itens e um único caminho de desenho do HUD. Usar fonte bitmap com acentos portugueses, números e símbolos necessários. Manter o editor em HTML com fonte normal; a interface do editor tem necessidades diferentes da arte do jogo.

**As cores não têm uma fonte única.** A camisa do sprite vem de `PLAYER_PALETTE.B = #0044cc`; o indicador de vidas usa `COLORS.FEKA_SHIRT = #4169E1`. A paleta de pele também diverge. Várias cores de terreno e efeitos estão embutidas diretamente no renderizador. Centralizar as cores por personagem, material e função antes de redesenhar todo o conteúdo.

### P1 — Redesenhar Feka, minion e Joãozão como um elenco

**Feka:** aumentar a definição dos óculos, separar rosto e cabelo, distinguir braços do tronco, dar volume à camisa e diferenciar as pernas. Trabalhar a silhueta antes dos detalhes: o personagem precisa ser reconhecível em 1×, parado e correndo.

Conjunto inicial proposto:

| Estado | Desenhos propostos | Leitura desejada |
| --- | --- | --- |
| Parado | 2 | Respiração discreta, sem balanço excessivo |
| Caminhada/corrida | 4–6, com cadência ligada à velocidade | Braços em oposição às pernas e apoio dos pés claro |
| Salto e queda | 1–2 para cada fase | Distinguir subida, ápice e descida |
| Sentada | Antecipação, queda, impacto e recuperação | Transformar a ação mais característica em assinatura visual |
| Dano e morte | 2–4 | Expressão e silhueta próprias, sem depender apenas de transparência |
| Capacete | Overlay com âncora por pose | Permanecer encaixado durante o movimento |

Essas quantidades são um ponto de partida, não uma exigência de produção simultânea. Um primeiro ciclo de quatro frames bem desenhados já vale mais que muitos frames quase iguais.

**Minion:** preservar a criatura pequena e vermelha, mas definir uma cabeça/corpo em pixels, uma sombra de contato e olhos com direção inequívoca. Diferenciar frente e costas. Criar quatro frames de andar, um de reação e dois de achatamento.

Há um problema concreto de cadência: `animationTimer` recebe milissegundos em `Minion.update`, enquanto o pé usa `sin(animationTimer * 0.2)`. O período é aproximadamente **31,4 ms**, cerca de 32 oscilações por segundo. É uma oscilação excessiva para passos legíveis e produz amostragem irregular a 60 Hz. Usar, por exemplo, frames de 100–140 ms como ponto de ajuste, com deslocamentos inteiros e apoio dos pés coerente.

**Joãozão:** manter porte grande, pele verde e roupa roxa, mas substituir o boneco de retângulos por uma silhueta intencional: ombros, mãos, mandíbula, postura e expressão. Desenhar preparação, golpe, recuperação, dano e derrota; a preparação deve antecipar claramente o ataque. A mesma fonte de luz, contorno e número de tons dos demais personagens precisa valer para ele.

Não mudar colisões para acomodar detalhes de desenho. Hitboxes atuais: minion 16×19 e boss 32×40. Os frames podem incluir espaço transparente para mãos e antecipações, mantendo a âncora dos pés. Fonte: [enemyCatalog.ts](../../src/entities/enemies/enemyCatalog.ts).

### P1 — Construir materiais, não apenas repetir quadrados

**Terra e grama:** o padrão repete pontos e linhas quase idênticos. A grama cobre o topo, mas faltam bordas laterais, cantos, paredes expostas e uma leitura convincente de massa de terra. Redesenhar um pequeno conjunto de topo, miolo, laterais, cantos internos/externos e 3–4 variações de preenchimento.

**Rocha da caverna:** está mais elaborada, porém a moldura de cada tile cria uma parede de blocos muito regular. Reduzir o contraste das divisões internas, agrupar rachaduras em formas maiores e preservar o brilho no topo caminhável. Escolher variantes por coordenada e semente estável, nunca por sorteio a cada frame.

**Plataformas:** normal e instável têm quase a mesma forma; a segunda muda apenas pequenos riscos. A instável deve ter rachadura estrutural, pontas soltas ou apoio quebrado visível em 1×. A plataforma atravessável por baixo deve manter uma borda de apoio clara e uma parte inferior leve.

**Perigos e itens:** redesenhar a moeda em 4–6 frames de largura discreta, a lava com uma pequena sequência de textura em pixels, e os blocos de item com símbolos reconhecíveis em vez de letras do sistema. Espinhos e mola já usam detalhes em pixels: harmonizar acabamento e contraste, sem descartar o trabalho existente.

**Biomas:** hoje o fundo muda bastante entre fases, mas o terreno principal continua usando a mesma grama e terra. Propor variações visuais do mesmo tile lógico: solo fértil na superfície, rocha fria na caverna, terra seca/pedra quente na segunda fase e alvenaria própria na arena. Começar pelo resolvedor visual de vizinhança em `drawTile`; manter IDs e regras de colisão.

### P1 — Melhorar fundo, profundidade e leitura do percurso

**Superfície:** montanhas e colinas são grandes faixas geométricas. Algumas cores disputam atenção com o personagem. Usar massas de cor mais suaves, silhuetas desenhadas, poucas árvores/arbustos e um ou dois elementos que identifiquem o lugar. A decoração deve enquadrar os saltos e deixar espaço ao redor de inimigos e bordas.

**Subsolo:** há cristais de fundo muito claros e grandes, semelhantes a objetos interativos. Diminuir tamanho, contraste e brilho dos cristais distantes. Os cristais de tile são decorativos, não coletáveis; eles não devem disputar o papel visual das moedas. Manter o topo caminhável da rocha bem separado das paredes ao fundo.

**Entrada da caverna:** a divisão de céu/subsolo usa `startRow`. É uma boa regra espacial, mas precisa de acabamento com teto, raízes, recortes de pedra e sombra localizada na abertura. A transição deve parecer parte do cenário, com visibilidade suficiente para o salto de entrada.

**WORLD 1-2:** o céu laranja/amarelo é muito dominante, com grande área quase preta logo abaixo. Atenuar a saturação do céu e usar tons quentes próximos entre si no fundo, preservando contraste para moedas, inimigos e chão.

Há também um defeito de cobertura: as imagens de fundo têm 180 pixels de altura e são deslocadas integralmente por `camera.y`. Na captura com câmera y=30, sobra uma faixa na parte inferior onde o fundo geométrico termina e só o gradiente aparece. Ver [WORLD 1-2](06-world-two.png). Estender a massa inferior, definir uma camada de preenchimento ou gerar a cobertura necessária aos limites da câmera. Conferir toda a faixa vertical do nível, não só a imagem inicial.

**Arena:** muralha de castelo e pequenos prédios são sobrepostos com escalas visuais pouco relacionadas. Escolher uma arquitetura reconhecível e compor um ponto focal para o boss. A grama da arena deve ser uma decisão de ambientação; hoje parece reaproveitamento do terreno genérico. Ver [arena atual](07-boss.png).

**Paralaxe:** manter 2–3 planos principais. Os fatores atuais já são configuráveis. Ajustá-los em movimento depois de acertar composição e contraste; adicionar mais camadas sozinho não melhora a leitura. Separar a semente visual da cor: atualmente a cor participa do hash em `seededRandom`, então recolorir uma camada também muda seu desenho.

### P1 — Reconciliar Yasmin e a tela final

A [tela final](08-ending.png) é a ruptura mais evidente: Feka ocupa 16×26 pixels lógicos, enquanto a Yasmin é uma ilustração detalhada apresentada com 60 pixels lógicos de altura, diretamente no canvas de alta resolução. O resultado parece juntar recursos de jogos diferentes.

Redesenhar Yasmin na mesma grade, linguagem e proporções humanas do Feka. Tomar o cabelo escuro da arte atualmente exibida como proposta de referência canônica; há também um método antigo `drawYasmin` com cabelo loiro, que não é chamado no fluxo atual. Definir uma aparência única e remover essa ambiguidade na produção futura.

Compor uma pequena cena de encerramento com ambos no mesmo chão e escala, reações expressivas e elementos do mundo. Se houver retratos maiores, desenhar retratos dos dois na mesma linguagem. Reduzir o rosa dominante e manter contraste nos textos; não usar uma única ilustração muito detalhada ao lado de um sprite ampliado.

### P2 — Dar acabamento às telas e aos efeitos

- **Título:** criar lettering próprio em pixels e mostrar um pequeno trecho do mundo com Feka. A tela atual comunica controles, mas pouco da personalidade visual da aventura.
- **HUD:** além da correção de layout, alinhar fonte, ícones, margens e cores; localizar rótulos de forma consistente. A pontuação, vidas, itens e tempo devem ter hierarquia clara.
- **Pausa, vitória e derrota:** uma família comum de caixas, bordas, títulos e ícones. Evitar que cada tela pareça um estilo de interface diferente.
- **Balões:** a função atual mede uma linha e não limita a caixa ao viewport. Implementar largura máxima, quebra de linhas e posicionamento que não cubra o jogador nem saia da tela.
- **Editor:** colocar o acesso no menu ou em uma opção apropriada; o link HTML aparece sobre a área do jogo nas capturas atuais.
- **Resposta ao movimento:** poeira curta ao aterrissar, pequena reação ao coletar, impacto da sentada com 3–4 desenhos e sombra de contato simples. Priorizar efeitos que explicam a ação.
- **Modo Delícia:** preservar a brincadeira, mas limitar chuva e filtro para não encobrir obstáculos e HUD. Hoje o filtro é aplicado depois da UI.
- **Tempo de animação:** padronizar a unidade. Jogador/inimigos usam ms, coletáveis contam ticks e vários efeitos consultam `Date.now()`. As gotas de chuva avançam no render, tornando a velocidade dependente da taxa de renderização. Usar um relógio de animação explícito e decidir quais efeitos continuam durante a pausa.
- **Zoom:** manter zoom inteiro no gameplay normal. Há interpolação contínua de zoom no código; se ela for usada em novas regiões, revisar pixels, cobertura e HUD. O trigger de câmera encontrado na campanha atual usa zoom 1; não tratei o problema potencial como defeito observado dessas fases.

## 4. Direção artística proposta

**Uma aventura cômica, acolhedora e expressiva, em pixel art com acabamento inspirado em 16 bits.** Formas claras, cores harmonizadas e personagens reconhecíveis, com o contraste necessário para um jogo de saltos.

“16 bits” aqui descreve uma direção estética, não uma limitação de hardware. Não é necessário simular fielmente um console. O propósito é ter mais definição no mesmo espaço e controlar melhor o desenho.

| Regra | Proposta inicial |
| --- | --- |
| Grade | 320×180, tiles 16×16, arte em pixels lógicos de 1×1 |
| Feka | Silhueta em aproximadamente 16×26; mesma hitbox inicial; óculos legíveis |
| Contorno | 1 pixel escuro e levemente colorido nos atores e itens importantes; fundo com contorno reduzido |
| Luz | Superior esquerda; normalmente sombra, base e luz por material |
| Paleta | Meta inicial de 24–32 cores compartilhadas, com variações controladas por bioma; ajustar após a cena de referência |
| Textura | Pequenos grupos de pixels que descrevem volume; pouco ruído e poucas linhas repetidas |
| Profundidade | Fundo mais suave; chão, perigos e personagens mais definidos |
| Animação | Poses distintas, movimento de braços e pernas, antecipação e recuperação |
| Interface | Fonte bitmap, ícones próprios e um sistema comum de margens e caixas |
| Assinaturas | Azul do Feka, laranja da Mini Fanta, cristais frios e expressão exagerada na sentada |

### Núcleo de cores para experimentar

Estas são **amostras de direção**, não a paleta final nem um recolor automático do jogo.

| Papel | Cor de referência | Uso |
| --- | --- | --- |
| Contorno | `#1B1F3B` | Contorno comum e sombras profundas |
| Feka | `#3D6FBE` | Azul principal do protagonista |
| Vegetação | `#4D8A62` | Folhagem e grama com saturação moderada |
| Terra | `#99614D` | Material quente em contraste com fundos frios |
| Recompensa | `#E6AC4E` | Dourado das moedas e detalhes de itens |
| Energia/caverna | `#50B9AD` | Cristais e iluminação em pixels |
| Antagonista | `#8B4D85` | Roupa e identidade do boss |
| Ameaça/impacto | `#C95751` | Criaturas vermelhas e resposta de dano |

Derivar sombras e luzes com pequena mudança de matiz, não apenas clareando tudo com branco. Usar forma, localização e animação junto à cor para diferenciar decoração, recompensa e perigo.

## 5. Fluxo recomendado para produzir a arte

**Manter Canvas 2D, TypeScript, Vite e o editor próprio.** A análise não mediu gargalo de GPU ou CPU que justifique migrar a engine. Uma migração não resolve paleta, poses, silhuetas, terreno ou identidade.

1. Desenhar uma cena de referência de 320×180 com Feka, um minion, uma moeda, terreno, fundo e HUD. Essa cena define as regras antes da produção em volume.
2. Guardar a fonte editável da arte e exportações determinísticas. Para desenho manual, Aseprite é uma opção adequada: exporta spritesheets e metadados JSON por linha de comando. Não é necessário introduzir dependência de runtime. [Documentação oficial](https://www.aseprite.org/docs/cli/).
3. Se a preferência for continuar com arte gerada por código, usar matrizes e pequenas funções de desenho com a mesma grade e paleta. Compilar frames estáticos para canvas/atlas em uma etapa de preparação. A qualidade depende do desenho, não de ser PNG ou TypeScript.
4. Introduzir um manifesto compartilhado com frame, duração em ms, âncora dos pés, offsets visuais, estados e pontos de encaixe de acessórios. A hitbox continua sendo uma informação de gameplay separada.
5. Separar gradualmente sprites, tiles, fundos, efeitos e UI do `Renderer.ts` de 2.661 linhas. Fazer a extração conforme cada parte for alterada; uma reescrita completa não é pré-requisito para a primeira melhoria.
6. Reutilizar o resolvedor visual no jogo e no editor. O editor deve mostrar o mesmo frame, variante de tile e origem de camada do jogo.
7. Estender a validação atual para os novos formatos: dimensões, pixels/paleta, frames obrigatórios, durações, âncoras e arquivos ausentes. Adicionar somente as verificações necessárias à pipeline escolhida.
8. Manter telas de referência reproduzíveis com tempo e estados controlados. Comparar captura anterior/posterior da mesma situação no mesmo ambiente, além de jogar o trecho em movimento.

Para arte gerada com IA, usar os resultados como exploração de direção e referência de desenho. Antes de virar asset do jogo, reconstruir/limpar na grade nativa, padronizar paleta e pivôs e revisar cada frame. Uma imagem com aparência de pixel art não garante pixels uniformes nem animação utilizável.

## 6. Ordem de execução sugerida

| Etapa | Entrega concreta | Concluída quando… |
| --- | --- | --- |
| 1. Base visual | Paleta compartilhada, regra de pixel, relógio de animação e correção do HUD | Capacete/vidas não colidem; cores de personagens têm uma fonte única; decisões de escala estão documentadas |
| 2. Pequeno trecho completo | Primeiros 20–30 segundos de WORLD 1-1 com novo Feka, minion, moeda, terreno e fundo | O conjunto parece pertencer ao mesmo jogo em 1× e 3×, parado e em movimento |
| 3. Passagem para o subsolo | Materiais, entrada, plataformas, cristais e cobertura vertical | É imediato reconhecer onde pisar, o que coletar e o que é decoração |
| 4. Restante do elenco e mundos | Joãozão, Yasmin, segunda fase e arena | Mesma escala de pixel e linguagem de luz; cada lugar tem identidade própria |
| 5. Apresentação | Título, HUD definitivo, pausa, vitória, derrota, final e efeitos | Nenhuma tela quebra a linguagem estabelecida pela cena de referência |

**Primeira implementação recomendada:** o trecho inicial com sua descida à caverna. Ele testa personagem, inimigo, item, superfície, profundidade, transição e interface com um conjunto pequeno de recursos. Serve de referência real para o restante do jogo.

## 7. Critérios para revisar o resultado

- O jogador, os inimigos e os perigos continuam reconhecíveis na resolução nativa, sem depender do zoom para entender detalhes.
- Os pés dos personagens mantêm a mesma referência durante a animação; o desenho não sugere contatos muito diferentes da colisão.
- Quinas caminháveis são claras. Variantes de textura não introduzem falsas rachaduras, buracos ou plataformas.
- A paleta e a densidade de textura preservam a separação entre fundo, terreno e atores, inclusive em uma inspeção em tons de cinza.
- Cristais decorativos e moedas têm funções visuais diferentes; inimigos não somem contra o fundo.
- Não há emendas aparentes nas repetições, faixas sem cobertura ao mover a câmera ou mudança aleatória de desenho entre recarregamentos.
- Caminhada, coleta, chão instável, sentada, dano e ataque do boss são avaliados em movimento, não apenas em imagens paradas.
- HUD testado com 1, 3 e 10 vidas, capacete e Mini Fanta simultâneos, pontuação alta e nomes longos.
- Testar ampliação 1×, 3× e 6×; DPR 1, 1,25, 1,5 e 2; zoom do navegador e telas menores. Ampliação CSS inteira sozinha não cobre todos os casos de pixels físicos. [Referência MDN](https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look).
- Conferir controles por toque e orientação horizontal em uma etapa própria: a inspeção visual principal desta análise foi feita em desktop.

## 8. Evidências e limites desta análise

As imagens foram capturadas em Chromium, viewport 960×540, DPR 1. Título, início de jogo e pausa foram abertos por entrada normal. Para inspecionar rapidamente diferentes áreas, arena e encerramento, as outras capturas usam **o Game e o Renderer existentes, com câmera/estado/posições ajustados apenas na memória de um navegador isolado**. Não representam uma partida completa. Posições e estados de itens dessas montagens não são evidência de falhas na física.

| Captura | O que observar |
| --- | --- |
| [01 — Título](01-title.png) | Tipografia do sistema, cenário ausente, identidade pouco apresentada |
| [02 — Início real](02-gameplay.png) | Escala do Feka versus moeda/minion, montanhas, textura repetida |
| [03 — Pausa real](03-pause.png) | Mudança da renderização do texto e unidade das caixas |
| [04 — Superfície](04-surface.png) | Materiais, preenchimento e composição de fundo |
| [05 — Caverna](05-cave.png) | Boa direção de cor; cristais distantes competem com interativos |
| [06 — WORLD 1-2](06-world-two.png) | Saturação, terreno reaproveitado e fim visível do fundo |
| [07 — Arena](07-boss.png) | Boss geométrico e sobreposição de arquiteturas |
| [08 — Final](08-ending.png) | Diferença de escala e linguagem entre Feka e Yasmin |
| [09 — Catálogo atual](09-assets.png) | Frames do Feka, inimigos e tiles desenhados pelo código atual; Yasmin loira é o helper legado, não o PNG exibido no final |
| [10 — HUD com itens](10-hud-items.png) | Sobreposição da terceira vida pelo capacete |

As capturas incluem o link HTML do editor que fica sobre a área visível. Não foi retocado. [Notas técnicas da captura](capture-notes.json).

`npm run check` passou: **68 testes**, validação dos **3 níveis**, validação dos sprites do jogador, typecheck e build. Isso verifica a base técnica; não é uma certificação de qualidade visual. Não foi realizado benchmark de desempenho, revisão completa em dispositivos móveis ou teste de todas as combinações de DPR.

Esta entrega acrescenta documentação, capturas e um estudo visual. **O código do jogo e os assets usados em produção não foram redesenhados nesta análise.**
