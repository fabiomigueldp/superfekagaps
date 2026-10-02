# Salão da Fábrica de Suco — contrato de campanha

Implementação em `codex/fabrica-salao-campaign/2026-10-02`. Base solicitada:
`1fad188374d84b46acfec50bbd5a0753e07171a7`, reconciliada com o lote de integração
`a36684079aaac43721a1beafc922c047c2eb8564` e a arte
`f20494c74b20b9f4648e5c20fa1724e983c561a7`. Não promover à main nem fazer deploy.
`vercel.json` mantém `git.deploymentEnabled=false`. Não havia `.agents/skills`
ou `AGENTS.md` no checkout disponibilizado.

## Encaixe e progressão

O salão é uma visita opcional em **3-3 — Tanques de Mistura**, junto ao segundo
checkpoint. Usa o patamar existente dos tiles 104–119, com chegada pelo checkpoint
107. É necessário chegar à porta, estar no chão e acionar **E** ou **Entrar no salão**.
Não há entrada automática ao cruzar a porta.

A campanha tem 30 fases, com Calabrezzo C1 em 3-5. A saída secreta original de
3-3 permite acessar 3-5; a saída normal permite seguir para 3-4. Nenhum desses
contratos muda. Turbosuco não substitui C1, não é uma 31ª fase e não exige nova
condição no mapa, nos saves antigos ou na progressão principal.

Jornada: entrar em 3-3 pelo mapa → atravessar a fase até o patamar → entrada
explícita → introdução original (caminhar à marca, apresentar pose, jurados e
convite) → combate nativo → pouso após vitória → epílogo compartilhado →
**Voltar à fase** → continuar até a saída normal ou secreta existente.

O resultado lateral é `seen: optional:factory-salon:turbosuco`. Só a saída após
encerrar ou pular o epílogo válido o registra, uma única vez. A porta informa
“Turbosuco derrotado · Revisitar salão”. Não concede selos, recordes, completions,
saída secreta, saúde ou capacete à campanha. `seen` já faz parte do save v1 e
sobrevive à importação/exportação. O limite de leitura do diário sobe de 200
para 201 para não expulsar uma flag de um save antigo já no limite quando a
conquista é adicionada; não é necessário migrar ou resetar o save.
A saída antes do epílogo, derrota ou retry não fabricam resultado.

## Runtime e isolamento

`FactoryCampaign` estende `WorldGame`; `src/main.ts` seleciona essa classe somente
para a campanha normal. Editor e clássico continuam com os hosts anteriores.
A mudança de conexão em main é um import e a troca de `new WorldGame(canvas)`
por `new FactoryCampaign(canvas)`, caso outro integrador precise reaplicá-la.

A instância da campanha fica pausada, mantendo Player, objetos, checkpoint,
coletáveis, posição e relógio em memória. Um diálogo modal contém uma instância
efêmera de `FactorySalonSession`, que estende o **JuiceLabHost já entregue**.
O RAF da campanha atualiza/renderiza a sessão; não há segundo RAF da simulação.
A saída descarta os recursos da sessão e retoma a mesma campanha. Teclas de menu
não escapam do modal para retomar o jogo de fundo. Escape pausa/retoma; blur e
visibility continuam usando os handlers nativos. Controles são nativos, focáveis
e têm altura mínima de 44px; o modal contém foco e admite rolagem em telas baixas.

A sessão copia preferências de áudio da campanha, respeitando movimento reduzido.
As mudanças locais de áudio não gravam o save da campanha. A experiência em
`juice-lab.html`, seu host e os hosts de Guaíra não recebem alterações deste lote.
Epílogo: [contrato compartilhado](../experimental/juice-epilogue.md), controller
`JuiceEpilogue`, pintura `drawJuiceEpilogue`, instalação `JuiceLabHost`.

Fechar/recarregar a página durante a visita abandona a sessão efêmera; o último
checkpoint persistido da campanha continua válido. Não se promete salvar combate
ou posição exata da visita após recarregar. Falha de armazenamento conserva o
resultado em sessão e usa o aviso existente de `ProgressStore` no mapa.

## Contrato da arte

Fonte única: `src/adventure/factory/FactorySalon.ts`, constante `FACTORY_SALON`.
Todas as coordenadas abaixo são pixels lógicos, não pixels CSS/devicePixelRatio.

| Elemento | Contrato |
| --- | --- |
| Fase | `3-3` |
| Suporte existente | x=1664…1920, y=224; largura 256 |
| Porta/interação | x=1776, y=184; 24×40 |
| Quadro lógico | 320×180 |
| Chegada no patamar | câmera y limitada a 72; coroa abaixo do HUD |
| Introdução/epílogo | piso visual y=160; câmera própria original |
| Combate | arena 320×288; piso físico y=224; câmera (0,64) |

A arte externa liga-se em `FactorySalonArt.ts`:
`drawFactorySalon(context, cameraX, cameraY, defeated)`. Esse adaptador chama `drawJuiceArrivalAtPortal` e `drawJuiceArrivalSign`
da entrega artística final. Recebe a câmera já arredondada com tremor e desenha
depois do terreno/landmarks, antes de objetos, checkpoint, jogador e HUD.
A ordem depois dos landmarks evita que a tubulação pré-existente encubra a coroa.
A arte não tem pixels abaixo do piso, preservando a soleira e o terreno já desenhado. Não inserir
colisão, diálogos, progresso ou novos controles na pintura. O patamar inteiro
continua transitável; manter a porta e o caminho visíveis e respeitar o HUD.

Direção combinada: anexo industrial, pórtico de aço, letreiro do campeonato,
insígnia de halteres, cortinas vinho e visor da gosma roxa. Suco Calabrezzo é gosma
roxa misteriosa/gíria de academia: sem frutas ou composição química definida.
Feka magro, elenco, humor e falas aprovadas são os originais, sem reautoria.
A ambientação final foi integrada do SHA artístico indicado acima. O cap local
de câmera y=72 mantém a fachada de 112px abaixo do HUD; não altera a câmera do
combate nem impede acompanhar a rota secreta acima. Não há novo pan/zoom animado.

## QA e reprodução

- `node --import tsx --test tests/factory-salon.test.ts`: suporte físico, acesso,
  chefe/saída secreta preservados, save v1, idempotência, progressão normal,
  vitória real via Input, pouso, epílogo, pausa e invalidação por retry.
- `npm run check`: **1.334 testes** (1.331 TS + 3 JS), validadores, dois projetos
  TypeScript e build Vite passaram; validação final inclui a arte conectada.
- `FACTORY_BROWSER=/caminho/agent-browser node scripts/verify_factory_salon_browser.cjs`:
  executar com Vite em localhost:3000 e Chromium. O script usa um perfil de QA;
  grava um save de teste na origem local. `FACTORY_URL` pode alterar a origem.
  Não apontar para um perfil/origem com progresso pessoal.
- Evidências estruturadas [normal](browser-evidence.json) e
  [movimento reduzido](browser-reduced-evidence.json): fixture de save antigo,
  caminhada real via Input do checkpoint até a entrada, introdução inteira com
  pose, derrota/auto-retry nativos, seis acertos, pouso, epílogo completo, blur,
  retorno, persistência e reentrada sem duplicação. Último acerto: frame 941.
- Chromium real: abrir página, E, Escape, retorno/reentrada e capturas em desktop
  1280×720 e compacto 360×640. Controles/DOM/render existem no navegador real.
  O script avança a simulação deterministicamente e emite eventos de teclado;
  **a vitória é replay de Input em Chromium, não uma vitória manual em tempo real**.
  Blur no script é evento sintético; os testes nativos também cobrem hidden.
  Não houve teste em aparelho físico ou percurso manual de toda a campanha.

Capturas da implementação integrada em Chromium:
[chegada desktop](arrival-desktop.png), [chegada 360px](arrival-compact.png),
[salão 360px](salon-compact.png). Nenhum asset de QA é publicado no build.

Build integrado: 156 arquivos, 42.715.470 bytes; gate de 45 MB aprovado.

## Revisão final de integração — 2026-10-02

A revisão final corrigiu a herança do mute por tecla M ao entrar no salão e
separou o status nativo do laboratório da região aria-live da campanha, evitando
anúncios repetidos do epílogo a cada frame. Regressões verificam preferências
independentes, movimento reduzido e uma única atualização do status final.

No executor cloud, o wrapper `npm run check` encontrou `EPERM` ao criar o pipe
local de IPC do CLI tsx. Os mesmos gates foram executados sem editar os scripts:
`node --import tsx --test tests/*.test.ts` (**1.332 aprovados**),
`node --test tests/*.test.mjs` (**3 aprovados**), os três validadores via
`node --import tsx`, `npm run typecheck`, Vite build e `check_build_size.ts`.
Resultado: **1.335 testes**, 156 arquivos e **42.715.691 bytes**, abaixo de
45.000.000. As evidências Chromium acima pertencem à entrega original; esta
revisão não repete nem amplia a alegação de vitória manual.

A configuração mantém `git.deploymentEnabled=false`. A saída publicável é
`dist/`, com URLs relativas (`base: './'`); documentação e capturas de QA não
entram no pacote. A publicação World deve continuar pelo empacotador isolado,
sem substituir outros jogos/serviços. Estes checks não constituem deploy.
