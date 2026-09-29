# Super Feka Gaps World — estudos visuais

29 de setembro de 2026 · 13 pranchas · Ferramenta de imagem integrada (`image_gen.imagegen`)

[Abrir a galeria](index.html) · [Direção geral](../README.md) · [Capturas da implementação](../capturas/index.html) · [Prompts completos e revisões](prompts.json) · [Inventário dos arquivos](manifest.json)

Esta entrega traduz a direção existente em imagens para orientar a próxima produção de cenários, personagens e animações. São seis mundos com estudos de peças, um elenco, duas pranchas com as seis famílias de inimigos, três pranchas cobrindo os seis confrontos e uma visão do arquipélago. Os PNGs finais estão em `imagens/`, todos com 1672 × 941 pixels.

**Estado:** conceitos gerados e inspecionados visualmente. As imagens ainda não são sprites, tiles ou fases integrados ao jogo. A galeria permite ampliar cada prancha e comparar os seis mundos com capturas da versão atual.

## Diagnóstico e direção

Nas capturas de partida, grandes retângulos e silhuetas de terreno semelhantes carregam boa parte da composição. As cores distinguem regiões, mas faltam estruturas que expliquem a atividade de cada lugar. Os sprites industriais também aproximam demais algumas profissões e tipos de inimigo.

Os estudos propõem três melhorias concretas:

1. **Uma construção reconhecível por mundo.** Farol e arcos costeiros; guindastes e contêineres; tanques e envase; estações e cabos; câmaras refrigeradas; residência e jardins. Essas formas devem aparecer também nos percursos e nas miniaturas do mapa.
2. **Cenário com função no percurso.** Contêineres viram escadas e túneis; os cabos sustentam plataformas; os tanques organizam passarelas; os arcos deixam visível uma passagem inferior. A decoração reforça a construção da fase.
3. **Ação legível pelo corpo.** Capacete removível, inclinação antes de correr, barril erguido antes da soltura, freio comprimido e chefe curvado durante a abertura. Cor complementa essas pistas.

## As pranchas

| Estudo | Direção principal |
| --- | --- |
| [01 · Costa dos Gaps](imagens/01-costa-dos-gaps.png) | Mar turquesa, falésias claras, grama, pontes e arcos naturais; caminho inferior visível |
| [02 · Porto do Bielzão](imagens/02-porto-do-bielzao.png) | Madeira, contêineres, grandes guindastes e patamares construídos pelas cargas |
| [03 · Fábrica de Suco](imagens/03-fabrica-de-suco.png) | Metal azul, vidro, tubos de cobre e suco roxo; retrato de Calabrezzo como identidade da operação |
| [04 · Serra Suspensa](imagens/04-serra-suspensa.png) | Picos estreitos, pinheiros, estações e grandes espaços de céu entre apoios |
| [05 · Reserva Gelada](imagens/05-reserva-gelada.png) | Armazenamento refrigerado, portas espessas, geada, vidro frio e líquido roxo |
| [06 · Domínio Pizzarino](imagens/06-dominio-pizzarino.png) | Casa e jardins habitados, pedra creme, telhas, fornos e sinais discretos de Yasmin e João |
| [07 · Elenco](imagens/07-elenco.png) | Feka, João, Calabrezzo e Biel: formas, atuação e alternativas de silhueta dos dois novos chefes |
| [08 · Patrulha e investida](imagens/08-inimigos-patrulha.png) | Minion, operário e investidor; proteção, impacto e recuperação |
| [09 · Carga, cabo e pressão](imagens/09-inimigos-maquinas.png) | Carregador, guarda dos cabos e agitador; equipamento explica a ação |
| [10 · Joãozão](imagens/10-chefe-joaozao.png) | Ponte temporariamente rompida e suporte que forma o caminho do confronto final |
| [11 · Bielzão](imagens/11-chefe-bielzao.png) | Elevação de apoios no porto e transferência entre estações na serra |
| [12 · Calabrezzo](imagens/12-chefe-calabrezzo.png) | Devolução pela esteira e roteamento dos barris pressurizados na reserva |
| [13 · Arquipélago](imagens/13-arquipelago.png) | Silhuetas das seis regiões e sequência da viagem |

O mapa é uma proposta de composição geográfica. Os pontos dourados representam deslocamento entre regiões, não fases individuais. Permanecem **cinco fases por mundo**, com chefe na quinta; os 30 nós, atalhos e estados de desbloqueio devem ser desenhados como elementos próprios da interface.

## Continuidade dos personagens

| Personagem | Leitura a preservar |
| --- | --- |
| Feka | Pequeno, óculos pretos, cabelo escuro, pele morena e roupa azul; confiança maior que a força física |
| Joãozão | Pele verde, roupa roxa, antebraços pesados e força direta; principal rival |
| Calabrezzo | Tronco em V, roupa laranja/creme, gota roxa, luvas e cinto; dono da Fábrica de Suco e apresentador do produto |
| Bielzão | Corpo quadrado, barba, capacete amarelo, roupa azul-petróleo e equipamento de trabalho; responsável pelas cargas e teleféricos |
| Carregador | Corpo compacto, boné azul baixo, óculos âmbar, bolsa clara e barril dominante; sem barba e sem o conjunto de equipamento de Biel |

Calabrezzo e Biel seguem a proposta de papéis já registrada em [lore](../lore.md). As aparências são interpretações dos sprites e do briefing do projeto, não retratos de pessoas reais. Yasmin não recebeu um redesenho nesta rodada. O Domínio mantém o subtexto do casal, e o encerramento continua sendo **FEKA SALVOU YASMIN?**.

### Seis famílias de inimigos

| Família no código | Forma principal | Poses que precisam sobreviver à redução |
| --- | --- | --- |
| `minion` | Bola vermelha, olhos grandes e pés escuros | Passo comprimido/esticado; reação ao pisão |
| `helmet` | Capacete alto sobre corpo curto | Patrulha; capacete saltando; atordoado sem proteção |
| `charger` | Tronco e braços inclinados para a frente | Preparação com pés presos; corrida; recuperação ofegante |
| `loader` | Barril horizontal acima de um corpo compacto | Erguer; soltar em arco; recuar com as mãos vazias |
| `rail` | Caixa suspensa com rodas e garras | Deslocamento; freio/pausa; inversão, sempre presa ao trilho |
| `agitator` | Motor baixo com pás horizontais | Vibração; giro com pontas claras; parada com motor exposto |

“Investidor” conserva o nome de exibição atual do inimigo `charger`; não cria uma família adicional. As sequências são estudos de poses principais. Quadros intermediários, duração, âncora, espelhamento e áreas de contato ainda precisam de autoria e revisão no jogo.

## Variação visual nas cinco fases de cada mundo

Aplicação proposta às fichas já existentes em [campanha](../campanha.md). Cada fase deve ter uma composição própria usando o conjunto de peças do mundo.

| Mundo | Percursos 1 a 4 | Quinto nível |
| --- | --- | --- |
| Costa | **1-1:** chegada aberta e mirantes baixos. **1-2:** pontes com pilares e vãos reconhecíveis. **1-3:** praia e passagem sob o arco. **1-4:** sequência de falésias com o farol orientando a saída. | Ponte de João com trechos distinguíveis e apoios permanentes nas extremidades |
| Porto | **2-1:** cais de recebimento. **2-2:** pátio de contrapesos. **2-3:** corredores dentro e entre contêineres. **2-4:** guindastes e passarelas sobre o expediente. | Pórtico central, símbolos correspondentes nos comandos e elevadores |
| Fábrica | **3-1:** doca de barris. **3-2:** esteiras e envase. **3-3:** silhuetas altas de tanques e passarelas de serviço. **3-4:** tubos, manômetros e corredores de pressão. | Linha reversível e pedestal de controle de qualidade |
| Serra | **4-1:** estação de embarque. **4-2:** torres e contrapesos expostos. **4-3:** cruzamento visual de linhas e paradas. **4-4:** travessia aberta entre agulhas de pedra. | Duas estações, plataforma de transferência e cabine de Biel |
| Reserva | **5-1:** estoque organizado em câmaras. **5-2:** tubos congelados e passagens de manutenção. **5-3:** reservatório iluminado como marco. **5-4:** alternância visual entre áreas secas e geladas. | Calhas, alvos de gelo marcados e apoios de manutenção |
| Domínio | **6-1:** jardins e terraços. **6-2:** fornos e passarelas. **6-3:** fundos da residência e caminhos sob arcos. **6-4:** grande ponte com apoios estruturais reconhecíveis. | Dois níveis e suportes com batentes; casa do casal ao fundo |

Isso orienta enquadramento, materiais e conjuntos de peças. A geometria de cada percurso continua sendo construída e validada com a física real; os vãos desenhados nas ilustrações não são medidas de salto.

## Passagem dos conceitos para o jogo

### Primeiro trecho a produzir

Usar **3-2 · Linha de Envase** como trecho de referência: entrada segura, esteira, um carregador, inversão claramente animada, tanque fechado ao fundo e saída para uma área de descanso. Em seguida, aplicar o mesmo padrão ao encontro **3-5 · Controle de Qualidade**. Essa combinação valida cenário, ator, objeto móvel, mecanismo e resposta visual com um único conjunto de materiais.

1. Desenhar o conjunto modular na grade real: topo, miolo, cantos, plataformas atravessáveis, suportes e conexão entre tubos. Separar vidro, líquido e moldura.
2. Refazer carregador e barris em escala nativa, começando por silhueta e poses de aviso/soltura/recuperação.
3. Separar os três planos de fundo e reduzir contraste junto aos saltos e às áreas de combate.
4. Construir e jogar o trecho com teclado e toque; ajustar câmera, contato, pausas e leitura dos mecanismos.
5. Usar uma cena da Costa para conferir se Feka e os minions continuam claros fora do ambiente industrial; então ampliar os conjuntos dos outros mundos.

### Restrições de produção

- Referência de direção: tela lógica de 320 × 180 e módulos de 16 × 16. Feka parte da arte de 16 × 26; novos chefes, das caixas previstas de aproximadamente 48 × 48/56. Confirmar dimensões efetivas nas fontes antes de exportar.
- As pranchas ampliam personagens para mostrar atuação. **A proporção desenhada não redefine hitboxes ou alcance de salto.** João aparece especialmente grande no estudo de combate; ajustar sua escala na arena real.
- Não reduzir e recortar automaticamente estas pinturas em um atlas. Há detalhes, bordas e agrupamentos de pixels que precisam ser redesenhados na grade nativa.
- Nos cenários, simplificar rebites, flores, espuma e textura antes de perder a leitura dos atores. Topos caminháveis precisam continuar claros em movimento.
- Distinguir carga perigosa de apoio por geometria e movimento. As faixas industriais das pranchas são vocabulário de material; sozinhas não podem definir uma hitbox perigosa.
- O líquido continua roxo, com espuma lilás. Verde-limão fica nos indicadores. Tanque fechado tem vidro e moldura; líquido exposto tem borda e contato claramente delimitados.
- As três poses de Calabrezzo exploram equipamento dos dois encontros. Separar o barril comum e o de pressão nos ciclos finais para manter a continuidade do objeto entre preparação e soltura.
- Avisos gráficos e setas dos estudos de combate explicam a intenção. O HUD final e os marcadores do chão precisam de desenho próprio, sem cobrir a trajetória do jogador.

## Revisão e rastreabilidade

Foram conferidos títulos, identidade dos personagens, paletas, distinção dos seis ambientes, presença das peças e leitura das poses. Cinco revisões pontuais corrigiram continuidade: retrato de Calabrezzo na fábrica; minion do Domínio; carregador distinto de Biel; atualização desse carregador na fábrica; agitador da Reserva alinhado à prancha de inimigos.

O [manifesto](manifest.json) registra caminho, tamanho e hash SHA-256 dos 13 PNGs. Os [prompts](prompts.json) guardam instruções, referências e revisões. Todos os finais foram copiados para este projeto. A geração usou a ferramenta integrada, sem CLI/API alternativa.

O critério para a próxima entrega é uma cena jogável que conserve estas identidades em escala nativa, com animação e leitura de contato verificadas. A qualidade da ilustração, por si só, não verifica dificuldade ou diversão das fases.
