# Guaíra — acabamento hidráulico

Continuação de 16/10/2026 sobre a [revisão de trabalhadores e arrozais](../life-polish-2026-10-16/README.md).
Página local: `/docs/world/guaira/hydraulics-polish-2026-10-16/index.html`.

## Alterações no jogo

- Pátio: curvas de bronze com passagens de água alinhadas aos tubos retos.
  Abraçadeiras com juntas, parafusos e luz/sombra; espaçamento maior para reduzir
  a repetição. O seletor A/B ganhou rebaixo e fixações ao redor da letra existente.
- A inspeção da água permanece contínua nos encaixes. Os reflexos respeitam o
  sentido de cada ramal e atravessam as extremidades sem aparecer fora do tubo.
  A cor continua seguindo a saída realmente abastecida, inclusive durante o aviso.
- Pistões com haste polida, encaixe sob o tablado, corpo do cilindro e base fixa.
  A posição superior vem do corpo físico da plataforma. Ao descer, ela oculta
  a estrutura; na doca não sobra uma base suspensa acima do tablado.
- Respiros: reflexos ascendentes presos ao bocal inferior. O desenho antigo
  repetia as faixas a cada 22 pixels, mas reiniciava o deslocamento a cada 17.
  Isso provocava saltos. A nova textura usa um período coerente e é recortada
  pela altura real, inclusive nos primeiros e últimos pixels perigosos.

Medição no Canvas nativo, coluna 86, entre 2.030 e 2.100 ms: deslocamento de
**seis pixels para baixo** antes; **um pixel para cima** depois, ambos com
correspondência exata dos pixels na amostra. Ver `flow-continuity.json`.

Esta rodada modifica a apresentação do Pátio e dos Respiros. Os demais cenários
entram na regressão. Física, área de dano, relógios hidráulicos, avisos, colisões
e progressão continuam no motor nativo.

## Verificação

- **887 testes de Guaíra passaram**. Novas regressões: movimento contínuo dos
  reflexos, recorte no vidro, conexão dos cotovelos, base fixa e desaparecimento
  do pistão sob a plataforma na doca.
- Os testes existentes conferem a cobertura exata da água perigosa ao longo de
  252 fases do ciclo, com movimento normal/reduzido, câmeras fracionárias,
  larguras variadas e os primeiros/últimos pixels da descarga.
- **Build passou**, incluindo validadores de níveis, assets do protagonista,
  mundo, TypeScript da aplicação e ferramentas, Vite.
- **56 enquadramentos** nas oito fases, repetíveis e sem mutação da simulação
  pelo desenho. Inspeção adicional de seis enquadramentos do Pátio e dos Respiros.
- **Quatro replays nativos completos, sem dano**: Travessia (1.048 updates),
  Pátio (893), Respiros (877) e Subida (1.339). Sem reposicionar Feka ou editar
  os relógios durante os percursos. Simulação a 60 Hz, captura a 15 fps.
- **Edge/Chromium, perfil separado**: entrada nas oito fases, movimento por
  teclado, janela estável ao pausar e retorno ao mapa. Nos Respiros, a pausa
  ocorreu aos 1.983 ms, durante a descarga plena; a imagem permaneceu idêntica.
  Sem erros de página; viewport 844 × 390 sem overflow. As amostras de render
  são medições locais, não um benchmark de FPS em dispositivo físico.
- Página de revisão: 12 imagens de comparação e os quatro arquivos de vídeo
  decodificados; controles e reprodução verificados. Sem overflow em 1440,
  390 e 320 pixels. Em telas estreitas, o comparativo da água empilha as duas
  versões para preservar a legibilidade. Relatório em `review-verification.json`.

O vídeo comparativo da água usa poses de inspeção dos renderizadores de produção,
com o mesmo estado nos dois lados, a 30 fps. Não é uma partida. Os dois vídeos
de percurso publicados usam as entradas nativas gravadas e chegam à conclusão.

## Reproduzir

`baseline-source/` preserva os dois renderizadores antes desta rodada, incluindo
as melhorias anteriores ainda não commitadas. O script registra seus hashes e
rebaseia os imports para os módulos compartilhados do projeto.

```text
node --import tsx scripts/prove_guaira_hydraulics.ts <output-details> <canvas-module> docs/world/guaira/hydraulics-polish-2026-10-16/baseline-source
node --import tsx scripts/prove_guaira_scenery.ts <output-scenes> <canvas-module> --tour --replay
ffmpeg -framerate 30 -i <output-details>/respiros-motion/%04d.png -c:v libx264 -crf 17 -pix_fmt yuv420p -movflags +faststart respiros-motion.mp4
```

Usar `@napi-rs/canvas` instalado. A composição das comparações congela cada
imagem de origem antes de juntar os lados, evitando referências a um Canvas
mutável no backend offline.

`scripts/verify_guaira_level_finish.cjs` verifica o hospedeiro nativo no navegador,
com `PLAYWRIGHT_MODULE` e `GUAIRA_OUTPUT`. A verificação dos Respiros aguarda a
descarga real antes de pausar, para conferir a estabilidade da água em movimento.

Evidências publicadas: `scenery-verification.json`, `detail-verification.json`,
`flow-continuity.json` e `browser-verification.json`. Fontes anteriores, quadros
intermediários, logs de testes e build estão em
`output/guaira/hydraulics-polish-2026-10-16/`. As comparações são contra o começo
desta rodada, não contra o HEAD.
