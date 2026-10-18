# Guaíra — canos, pressão e água em movimento

Revisão de 17/10/2026. [Comparações animadas e trechos de partidas](index.html).

## Diagnóstico

As conexões já compartilhavam rotas contínuas, mas usavam ritmos diferentes: o reflexo local avançava um pixel a cada 140 ms, a rota completa a cada 100 ms, a queda a cada 90 ms e os jatos dos Respiros a cada 70 ms. O fluxo parecia preso a poucos quadros. A água pressurizada dos Respiros tinha faixas verticais fixas; a Câmara de Alívio usava outro desenho e menos tons. Nas comportas, a bacia permanecia quase plana abaixo da superfície e a espuma alternava seis poses em conjunto. Os pequenos trechos de cano não tinham luvas nas extremidades. O resíduo após isolar a pressão caía com velocidade constante.

## Acabamento e animação

- **Canos:** luvas nas duas extremidades, junta escura, rebordos, sombra e ressaltos. O visor de três pixels continua aberto através das fixações, incluindo segmentos de sete pixels. O reflexo local e o da rota completa usam a mesma fase a partir da entrada, nas quatro direções.
- **Corrente:** canos avançam um pixel a cada 32 ms; quedas, a cada 28 ms. Superfícies, canais e arrozais têm velocidades mais baixas. As constantes ficam em `GuairaFluidArt`; todas recebem o relógio nativo da cena.
- **Jatos:** filetes curvos, com pontas estreitas, comprimentos definidos e fases diferentes entre colunas. A textura sobe a partir da grelha a cada 24 ms. Alterar a altura do jato revela ou esconde a mesma textura, sem arrastá-la junto à borda.
- **Unidade visual:** a entrada do Alívio usa a mesma paleta de cinco tons e o mesmo desenho dos Respiros e dos jatos das extensões. A segunda passagem visual corrigiu a diferença de contraste que ainda havia entre esses trechos.
- **Comportas:** filetes mais longos na queda; dois conjuntos de ondas sobrepostos na área de impacto, com espalhamento gradual e perda de contraste. Reflexos submersos se afastam da queda e ficam mais suaves em profundidade. A superfície e o fundo usam tons distintos da água perigosa.
- **Registro fechado:** gotas claras usam queda acelerada dentro do intervalo nativo de 300 ms. Elas não deixam resíduos ciano e terminam antes da superfície de caminhada. Movimento reduzido omite essas gotas.

A área de dano continua sendo a do mecanismo. O preenchimento opaco cobre todos os pixels intersectados pela água, inclusive nas bordas fracionárias e no primeiro/último pixel do ciclo. A pintura não altera válvulas, pressão, velocidades de plataformas ou progressão. Pausa, congelamento de impacto e movimento reduzido continuam ligados à simulação existente.

## Inspeção

1. Captura das oito cenas antes de alterar a arte, com a câmera e os comandos dos percursos existentes.
2. Primeira passagem nos componentes compartilhados, seguida de estudos dos ciclos completos de pressão e das conexões.
3. Correção da rasterização fracionária dos jatos, conferência da borda inteira e unificação da paleta do Alívio.
4. Nova passagem nas oito cenas, comparação de estados com a referência e campanha normal pelo mapa.

Os testes antigos de deslocamento de um pixel foram atualizados para os novos intervalos, preservando suas exigências de direção, continuidade e contenção. Os classificadores da água do Alívio incluem os dois tons acrescentados. O teste de animação dos fundos passou a observar vários instantes: dois momentos distantes podem coincidir com a mesma fase de um ciclo curto.

## Evidências

Validação final: **3.755 testes TypeScript aprovados**, zero falhas e um ignorado; três testes JavaScript, validadores, TypeScript e build aprovados.

- [Estudos de animação](animation-studies.json): quatro conjuntos, cada um com 252 quadros a 30 fps; comparação lado a lado nos mesmos momentos. São poses de inspeção dos pintores de produção, com câmera e relógio escolhidos e sem personagem. Não são partidas.
- [Percursos nativos](native-verification.json): oito conclusões sem dano, mesma duração e moedas; 183 estados amostrados de personagem/câmera iguais à referência. A inspeção gerou 386 vistas em 26 pranchas. Os clipes da Travessia e dos Respiros cobrem os quadros 450–1350 dessas partidas, com física a 60 Hz e vídeo a 30 fps.
- [Campanha normal](campaign-report.json): nove execuções usando gamepad simulado, incluindo entrada pelo mapa nas oito cenas e retorno ao Pátio opcional.
- [Página de revisão](browser-review.json): quatro vídeos comparativos e dois clipes nativos decodificados em larguras de 1440 e 390 pixels, sem transbordamento horizontal.
- [Validação consolidada](verification.json): testes TypeScript e JavaScript, validadores de fases/sprites, os dois projetos TypeScript e build.
- Oito novos casos conferem a cadência em sequência a 60 Hz, a textura presa à grelha, fase igual entre cano local e rota, visores dos canos curtos, repetição das ondas submersas e aceleração/expiração dos resíduos.

As comparações mostram o renderizador nativo de 320 × 180. Os tempos dos efeitos são tempo de simulação; as evidências não medem FPS em dispositivos físicos nem substituem a avaliação durante uma primeira partida.

## Reprodução

```powershell
node --import tsx --test tests/guaira-fluid-art.test.ts tests/guaira-hydraulics-art.test.ts tests/guaira-sluice-art.test.ts tests/guaira-relief-flow.test.ts tests/guaira-respiros-art.test.ts
npm run build

# CANVAS aponta para @napi-rs/canvas/index.js; BASELINE contém as fontes salvas.
node --import tsx scripts/prove_guaira_fluid_finish.ts OUTPUT CANVAS BASELINE
$env:GUAIRA_DENSE_SURVEY='1'
node --import tsx scripts/prove_guaira_chapter_readability.ts OUTPUT CANVAS

# Servidor de QA com VITE_DEVELOPMENT_UNLOCKED_SAVE=false.
$env:FEKA_UI_URL='http://127.0.0.1:3001'
$env:GUAIRA_NORMAL_CAMPAIGN='1'
$env:GUAIRA_GAMEPAD='1'
node scripts/verify_guaira_chapter_readability.cjs
node scripts/verify_guaira_fluid_review.cjs
```

Defina `PLAYWRIGHT_MODULE` se o pacote não estiver na resolução padrão. As fontes de referência e os logs desta rodada estão em `output/guaira/fluid-finish-2026-10-17/` no workspace.

Rodada anterior: [fundos das oito cenas](../chapter-backgrounds-2026-10-17/README.md).
