# Implementação World — versão jogável

[Revisão de fases e combates](revisao-fases.md) · [Direção](README.md) · [Galeria de produção](capturas/index.html) · [Assets](../../public/assets/world/README.md)

## Acesso

Execute `npm run dev` e abra a URL informada pelo Vite.

- `/`: Super Feka Gaps World.
- `/?classic=true`: campanha original do remaster.
- `/?worldEditor=true`: estúdio de fases World.
- `/?editor=true`: editor original, preservado.
- `/docs/world/capturas/`: galeria de imagens, atlas e prévias de música, disponível no servidor de desenvolvimento.
- `/docs/world/capturas/mecanismos/`: ciclos dos jatos e canhões, com pausa, linha do tempo e áreas de dano.

No mapa, use esquerda/direita para escolher fase e cima/baixo para mudar ilha. Enter confirma. Também é possível tocar nas ilhas, fases e botões. Os controles de movimento continuam A/D ou setas, W/espaço/Z para pular, Shift/X para correr e S/baixo no ar para a sentada. Esc pausa; M controla o som.

## O que está integrado

- 30 fases autoradas em seis mundos, com 24 percursos e seis arenas.
- Mapa navegável, trilhas, seis saídas secretas e atalhos da terceira fase ao chefe.
- 72 selos persistentes, galeria por ilha, moedas, capacete e Mini Fanta.
- Save próprio, versão, checkpoints, retomada canônica, importação e exportação. O progresso e placar do original usam suas próprias chaves.
- Plataformas móveis, elevadores, contrapesos, esteiras reversíveis, acionadores, barris, alvos quebráveis, jatos e suportes estruturais.
- Seis famílias de inimigos, incluindo o minion preservado e cinco comportamentos novos.
- João, Biel e Calabrezzo em dois encontros cada. Calabrezzo usa devolução de barris e roteamento contra gelo; Biel exige apoios e travessia elevada; João abre gaps e reage a impactos em suportes na revanche.
- Introdução, diálogos com texto, falas existentes de João, vocalização sintetizada, tela final e retorno ao mapa.
- Sprites nativos, seis cenários com paralaxe, materiais locais, animações, efeitos de impacto e coleta, interface e controles por toque.
- Seis temas de mundo, um tema de mapa e três temas de chefe com variação nas revanches, compostos para o sequenciador. Dez prévias WAV foram exportadas.
- Opções separadas de música, efeitos, vozes e tremor.
- Editor World com paleta, seleção/arraste de mecanismos, inspetor, destinos, ligações, undo/redo, JSON, importação/exportação e prévia isolada do save real.

## Primeiro contato e novas tentativas — 30/09/2026

- Comentários de percurso aparecem em uma faixa curta, sem pausar nem limpar as teclas mantidas. Falas de ensino de mecanismos, pressão e gelo e as apresentações de chefes conservam a primeira leitura com pausa.
- Falas concluídas ficam no save World e não se repetem ao morrer, retornar do mapa ou recarregar. Uma cena interrompida antes de fechar continua disponível. Saves anteriores e a campanha clássica são preservados.
- Cada nova prévia do editor permite reler falas alteradas e testar dicas novamente, sem afetar o save real. Morrer dentro da mesma prévia continua sem repetir as falas.
- Dicas de pulo e corrida aparecem nos trechos seguros de 1-1, com retomada no início de 1-2. Pular e aterrissar confirma o pulo; percorrer três tiles correndo confirma a corrida. Apertar teclas sem executar a ação não dispensa a dica.
- A sentada é explicada perto do primeiro acionador de 2-2 ou 3-2. A dica permanece após um golpe que erra e desaparece quando uma sentada ativa um mecanismo. Teclado e toque têm instruções próprias.
- As oito moedas sobre o gap do segundo selo de 1-1 agora indicam a descida e os apoios de retorno. O selo, terreno, arte, inimigos e saídas permanecem no lugar. A queda a pé e a recuperação com dois pulos comuns têm regressão usando a física real.
- As dicas têm prioridade sobre comentários; o aviso de checkpoint tem prioridade sobre ambos. O tempo de leitura de comentários para durante pausa e quando outra indicação ocupa a faixa.

Regressões específicas: `tests/world-guidance.test.ts` e `tests/world-opening-route.test.ts`. Para revisão visual, usar uma sessão de teste isolada: primeiro pulo/corrida em 1-1, queda pelo rastro de moedas, morte e nova passagem em Ponte Bamba, primeira leitura/interrupção de uma instrução e uma sentada errada/correta no acionador. Repetir com toque. A execução sem navegador testa fluxo e física, mas não substitui essa revisão de legibilidade e sensação de jogo.

Neste ambiente, o comando agregado `npm run check` encontra `EPERM` ao abrir o pipe temporário do CLI `tsx`. As mesmas etapas podem ser executadas sem esse CLI: `node --import tsx --test tests/*.test.ts`, `node --test tests/*.test.mjs`, `node --import tsx scripts/validate_levels.ts`, `node --import tsx scripts/validate_player_assets.ts`, `node --import tsx scripts/validate_world.ts`, `npm run typecheck` e `node node_modules/vite/bin/vite.js build`. Nenhuma configuração ou dependência do projeto foi alterada por essa limitação.

## Estrutura do código

| Arquivo em `src/adventure/` | Responsabilidade |
| --- | --- |
| `campaign.ts` | layouts autorados, ilhas, posicionamento de objetos, itens, saídas e diálogos |
| `types.ts` | contratos de campanha e objetos |
| `progress.ts` | grafo de desbloqueio, persistência e validação |
| `WorldPhysics.ts` | transporte, colisões de apoios, mecanismos e barris |
| `WorldEnemies.ts` | comportamento dos inimigos comuns |
| `BossEncounter.ts` | estados e regras dos seis encontros |
| `WorldAssets.ts` | fontes dos sprites e ciclos na grade nativa |
| `WorldArt.ts` / `WorldScenery.ts` | cenários, materiais, estruturas autoradas, mecanismos e desenho dos atores |
| `WorldPainting.ts` | peças de pixel art compartilhadas: tanques, portas, tubulações, construções e vegetação |
| `WorldBackdrop.ts` | três planos de paralaxe por mundo, variações por fase e cache limitado a seis conjuntos |
| `WorldTerrain.ts` | materiais caminháveis, bordas, plataformas, gelo e ponte do primeiro confronto |
| `WorldMechanisms.ts` / `WorldStageArt.ts` | mecanismos, seis arenas e miniaturas próprias do mapa |
| `WorldMachineState.ts` | temporização compartilhada entre a animação, a colisão do jato e a saída dos projéteis |
| `WorldMachineAssets.ts` / `WorldMachineArt.ts` | bocais, canhões, variações de material, fluido, chamas, vapor e recuo |
| `WorldTransportArt.ts` | correias, roletes, elevadores guiados, teleféricos, acionadores e suportes de madeira |
| `WorldAudio.ts` | composição, efeitos, vozes e reprodução das gravações |
| `WorldGame.ts` | fluxo, input, encontros, interface e cenas |
| `WorldTutorial.ts` | dicas contextuais e confirmação de movimentos executados, exclusivas do World |
| `WorldEditor.ts` | autoria e prévia dos dados World |

Player, Input, Renderer, PixelGrid, atlas, fonte e parte dos assets vêm da base do remaster. O World mantém seu coordenador de campanha separado das regras lineares do original.

## Aplicação dos conceitos — 29/09/2026

As [13 pranchas](conceitos/index.html) passaram a orientar a arte usada pelo jogo. As peças foram desenhadas na grade nativa; os PNGs de conceito continuam como referências.

- **Seis identidades:** arcos naturais e farol na Costa; pilhas de contêineres e guindastes no Porto; tanques fechados, cobre e envase na Fábrica; estações e pinheiros na Serra; portas isoladas e geada na Reserva; casa, flores, fornos e sinais de **Y + J** no Domínio. O mapa e as arenas usam o mesmo vocabulário visual.
- **Atores:** Joãozão, Bielzão e Calabrezzo receberam corpos e ações distintos, com respiração, preparação, lançamento/comando, impacto, recuperação e dano. A variante gelada de Calabrezzo mantém seu barril pressurizado desde a preparação. Operário, investidor, carregador, guarda dos cabos e agitador foram redesenhados; o minion usa sua pose de esmagamento.
- **Leitura dos mecanismos:** números correspondentes em botão e mecanismo, roletes e setas com a direção real da esteira, manômetros, antecipação dos lançadores, pás horizontais e gelo reforçado identificado. Os topos de tanques e contêineres são validados contra os tiles sólidos.
- **Linha de Envase (3-2):** patamares fixos antes das esteiras, três comandos, dois transportadores sobre caminhos inferiores de recuperação e uma passarela opcional de manutenção com selo. Os checkpoints separam os conjuntos de desafios.
- **Combates:** barris partem da altura das mãos e seguem um arco; o elevador de Calabrezzo só sobe durante a abertura; a abertura cancela uma rajada pendente; novas tentativas de lançamento têm preparação; gelo reforçado exige pressão; a onda final de João avisa antes de atingir o chão. O impacto visual acompanha o equipamento ou suporte realmente atingido.
- **Produção:** atlas com 260 entradas, seis fundos de referência, 24 panoramas e capturas renovadas. A galeria inclui seletores de poses dos chefes e inimigos e um controle para pausar as animações.

### Polimento dos jatos, canhões e barris

- Jatos têm bocal flangeado, válvula, manômetro e seis momentos: espera, pressão, subida, fluxo, recolhimento e dissipação. O suco tem núcleo irregular, espuma lilás e gotas; a Reserva recebe geada; os fornos usam línguas de fogo e fagulhas.
- A colisão acompanha a altura visível do jato. Fechar a válvula corta o dano imediatamente. Névoa e partículas soltas são decorativas. O ciclo padrão mantém 800 ms de aviso antes da emissão, com 120 ms de subida e 170 ms de recolhimento.
- Canhões pneumáticos têm tubo, boca, reservatório, carregador, seis poses e variação gelada. O disparo sai da boca correspondente à direção, seguido por clarão, recuo, escape de ar e recarga. O aviso de 650 ms continua antes de cada disparo.
- Barris possuem oito orientações por variante, rotação ligada ao deslocamento, poeira de pouso e rastro de devolução. Alvos quebrados projetam fragmentos. Pressurização, descarga e contato do barril têm efeitos sonoros próprios.
- Peças móveis e efeitos usam o relógio da física, incluindo pausa e congelamento de impacto. O editor cria canhões com as dimensões e a cadência usadas nas fases.
- Esteiras têm correia superior, retorno inferior, roletes, motor e setas. A correia mantém sua posição quando o sentido muda e usa a mesma velocidade do transporte de Feka.
- Elevadores possuem guias fixas, tambor de cabos e pistão; plataformas suspensas recebem carro de polias e suspensões. As polias acompanham o deslocamento, inclusive parada e retorno. Piso e ferragens usam materiais locais, com madeira no Porto e geada na Reserva.
- Acionadores mostram pressão, mola, luz e retorno. Suportes de João mostram travessas rompidas, descida do deck e fragmentos; o tremor fica nas colunas. Gelo reforçado tem braçadeiras e marca de pressão, com reação distinta ao barril que ele bloqueia.
- O [inspetor de mecanismos](capturas/mecanismos/index.html) reúne dez ciclos completos em 720 quadros exportados da produção, além de oito cenas das fases. A sobreposição diferencia apoios, alvos sólidos e projéteis.

Verificação desta revisão: **127 testes**, validação das **30 fases e 260 entradas de sprites**, typecheck e build; **34 verificações de navegador** (23 gerais e 11 de mecanismos) sem erros de execução; seis chefes vencidos por controles simulados, sem itens ou mortes. A auditoria das 24 rotas continua distinguida de uma partida completa, conforme descrito abaixo.

## Verificação reproduzível

- `npm run check`: regressões existentes e testes World, validação de conteúdo/sprites, typecheck e build.
- `scripts/verify_world.cjs`: fluxo de abertura/mapa, fase bloqueada, teclado, pausa, persistência, editor, toque e exportação da arte. Resultado em [verification.json](capturas/verification.json).
- `scripts/verify_world_machines.cjs`: exporta os ciclos, confere o dano no coordenador real do jogo e verifica seleção, pausa, linha do tempo e sobreposição das colisões. Resultado em [mecanismos/verification.json](capturas/mecanismos/verification.json).
- `scripts/verify_world_combat.cjs`: seis encontros iniciados separadamente e executados com movimento, salto e sentada simulados, sem itens, invencibilidade ou alterações de vida. Resultado em [combate.json](capturas/combate.json).
- `scripts/export_world_audio.cjs`: render offline das mesmas notas e envelopes usados pelo sequenciador. Metadados de duração e pico em [audio/manifest.json](../../public/assets/world/audio/manifest.json).

Os scripts de navegador usam Playwright e Chromium. Com o Vite aberto, configure `GAME_URL` para a URL local, `PLAYWRIGHT_PATH` para o módulo Playwright instalado e `CHROME_PATH` para o executável do Chromium; execute cada script com `node`. Nenhuma dessas ferramentas é baixada pelos scripts.

As capturas de mundos e arenas têm câmera/posição preparadas para revisão. A auditoria geométrica das 24 fases testa saltos locais com o Player real e calcula conexões entre apoios. As arestas de transporte modelam as plataformas em seus pontos extremos e verificam o acesso aos acionadores. Isso não é uma partida completa com inimigos, temporização dos mecanismos e coleta de todos os selos.

## Ajustes feitos durante a implementação

- Aberturas de chefe aceitam aproximação lateral sem dano quando ele está atordoado; acertar ainda exige aterrissagem por cima. O ajuste evita punir uma aproximação ligeiramente baixa.
- Arenas têm câmera própria: personagem e aviso não ficam atrás do HUD.
- Ataques de João fixam o alvo e removem a hitbox de impacto após o período ativo; o golpe final reconhece os suportes corretamente.
- Retomadas de chefe restauram arena, objetos e vida, e não repetem a introdução como diálogo de percurso.
- Alvos de gelo têm colisão coerente com o desenho, mas barris usam sua própria resolução para ativá-los antes de serem descartados.
- O modo de toque muda junto com a tela, impedindo que o toque em “Jogar” seja interpretado como pausa na fase seguinte.
- Ao selecionar arenas no editor, a câmera e seu controle de deslocamento respeitam os novos limites.

## Alcance da revisão e próximos refinamentos

Esta é uma versão jogável de ponta a ponta, com o conteúdo e os sistemas integrados. A meta estética e de gameplay continua sendo a direção documentada. A quantidade de conteúdo e o resultado dos testes não certificam o nível de acabamento de uma produção Nintendo.

Os percursos são mais compactos que a hipótese inicial de 3–5 minutos por fase; a duração real precisa ser medida em sessões com jogadores novos. A validação automática de deslocamento não mede descoberta de segredos, ritmo, compreensão de todas as pistas ou diversão. O roteiro visual está representado por cenas e diálogos curtos; a atuação pode receber mais quadros e transições à medida que essas sessões indicarem onde faz diferença.

Ainda não foram realizadas sessões observadas com jogadores externos nem avaliação em aparelhos móveis físicos. O áudio foi gerado e inspecionado tecnicamente, mas a mixagem final precisa de audição comparativa em alto-falantes e fones. As exportações permitem essa revisão. Esses limites devem acompanhar qualquer apresentação da versão, sem tratar capturas preparadas ou testes automatizados como certificação de qualidade artística.
