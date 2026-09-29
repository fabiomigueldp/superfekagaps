# Implementação World — versão jogável

[Revisão de fases e combates](revisao-fases.md) · [Direção](README.md) · [Galeria de produção](capturas/index.html) · [Assets](../../public/assets/world/README.md)

## Acesso

Execute `npm run dev` e abra a URL informada pelo Vite.

- `/`: Super Feka Gaps World.
- `/?classic=true`: campanha original do remaster.
- `/?worldEditor=true`: estúdio de fases World.
- `/?editor=true`: editor original, preservado.
- `/docs/world/capturas/`: galeria de imagens, atlas e prévias de música, disponível no servidor de desenvolvimento.

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
| `WorldAudio.ts` | composição, efeitos, vozes e reprodução das gravações |
| `WorldGame.ts` | fluxo, input, encontros, interface e cenas |
| `WorldEditor.ts` | autoria e prévia dos dados World |

Player, Input, Renderer, PixelGrid, atlas, fonte e parte dos assets vêm da base do remaster. O World mantém seu coordenador de campanha separado das regras lineares do original.

## Verificação reproduzível

- `npm run check`: regressões existentes e testes World, validação de conteúdo/sprites, typecheck e build.
- `scripts/verify_world.cjs`: fluxo de abertura/mapa, fase bloqueada, teclado, pausa, persistência, editor, toque e exportação da arte. Resultado em [verification.json](capturas/verification.json).
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
