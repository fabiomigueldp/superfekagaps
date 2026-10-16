# Guaíra — trabalhadores e arrozais

Continuação de 16/10/2026 sobre a [revisão de materiais e chefes](../level-finish-2026-10-16/README.md).
Página local: `/docs/world/guaira/life-polish-2026-10-16/index.html`.

## Alterações

- Mecânico e trabalhador do arrozal: sete poses distintas por ciclo de 3,6 s
  (antes, quatro), incluindo preparação, esforço, retorno e piscada de 80 ms.
  Chapéus, roupas e botas receberam pequenos detalhes na paleta existente.
- Os dois trabalhadores estáticos da Subida passaram a usar o renderizador
  compartilhado. O inspetor ganhou prancheta, lápis, escrita e olhar elevado.
  Cada trabalhador observa sua própria plataforma quando ela se afasta e
  retoma o trabalho ao retornar. A posição vem do corpo físico; a animação,
  de `objects.time`. Não há novo temporizador nem estado de simulação.
- Arrozais da Travessia, Pátio e Respiros: folhas novas e plantas maduras com
  espigas arqueadas, alturas e inclinações variadas. Fileiras desencontradas
  no Pátio. Uma segunda passagem aqueceu os grãos para separá-los das folhas.
- Bases e silhuetas permanecem ligadas ao chão; o vento modifica as pontas.
  As cores recuam nos campos de fundo, sem competir com água perigosa, bordas
  de plataformas e controles hidráulicos.

Esta rodada altera a apresentação de quatro fases. Os demais ambientes e os
chefes conservam o acabamento anterior e entram na verificação de regressão.
Física, colisões, caminhos do mapa e progresso não foram alterados.

## Verificação

- **883 testes de Guaíra aprovados**. As novas regressões cobrem limites dos
  sprites, botas fixas, relógio da Subida, reação à plataforma real, piscadas,
  conexão das espigas às raízes e estabilidade ao deslocar a câmera.
- **Build aprovado**, incluindo validadores de níveis, assets do protagonista
  e mundo; TypeScript da aplicação e ferramentas; Vite.
- **56 poses/enquadramentos** nas oito fases, com normal/reduzido, repetibilidade
  e ausência de mutação por desenho.
- **Quatro replays nativos concluídos sem dano**: Travessia (1.048 atualizações),
  Pátio (893), Respiros (877), Subida (1.339). Entradas gravadas passam pelo Input,
  física e câmera reais. Sem reposicionar Feka ou editar o relógio no percurso.
  Simulação a 60 Hz, captura a 15 fps.
- **Edge/Chromium, perfil separado**: oito fases no hospedeiro nativo; teclado,
  pausa estável, mesma janela de jogo e retorno ao mapa. Sem erros de página.
  Viewport 844 × 390 sem overflow. Amostras de render foram registradas durante
  a codificação dos vídeos; não são um benchmark isolado de desempenho.
- Página comparativa: oito imagens e cinco vídeos decodificados no navegador;
  seletor de fases, controle de comparação pelo teclado e reprodução verificados.
  Sem overflow em 1440, 390 e 320 pixels. Relatório em `review-verification.json`.

O vídeo dos trabalhadores mostra poses de inspeção, não uma partida. Usa os
renderizadores de produção e o mesmo relógio para antes/depois, a 30 fps, com
ampliação inteira. O inspetor anterior era estático. Os quatro vídeos de
percurso são replays nativos completos. O perfil do usuário não foi modificado.

## Reprodução e evidências

`baseline-source/` preserva os dois renderizadores anteriores a esta rodada.
Isso inclui o acabamento de materiais já feito e ainda não commitado. O script
rebaseia seus imports para os módulos compartilhados e registra os hashes.

```text
node --import tsx scripts/prove_guaira_life.ts <output-sprites> <canvas-module> docs/world/guaira/life-polish-2026-10-16/baseline-source
node --import tsx scripts/prove_guaira_scenery.ts <output-scenes> <canvas-module> --tour --replay
ffmpeg -framerate 30 -i <output-sprites>/workers/%04d.png -c:v libx264 -crf 17 -pix_fmt yuv420p -movflags +faststart workers.mp4
```

Usar `@napi-rs/canvas` instalado. A verificação do navegador reutiliza
`scripts/verify_guaira_level_finish.cjs`, com `PLAYWRIGHT_MODULE` e `GUAIRA_OUTPUT`.
O servidor local deve estar pronto antes da execução.

Relatórios publicados: `scenery-verification.json`, `sprite-verification.json`
e `browser-verification.json`. Capturas intermediárias, fontes anteriores,
frames e logs de testes/build estão em `output/guaira/life-polish-2026-10-16/`.

As imagens "antes" são capturas anteriores às alterações deste ciclo; incluem
os materiais da revisão precedente. Não se trata de uma comparação com o HEAD.
