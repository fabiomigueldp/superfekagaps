# Guaíra — materiais e movimento nas fases

Revisão de 16/10/2026 sobre `ea82c8e8e4f8a3550955f5aefa72c8798ebbb004`.
Página local: `/docs/world/guaira/level-finish-2026-10-16/index.html`.

## Acabamento

- Oito fases compartilham detalhes de materiais em `GuairaMaterials.ts`.
  Argila com inclusões discretas, reboco com reparos, pedra em fiadas de
  32 × 16 pixels e madeira com juntas mais espaçadas e veios longitudinais.
- A segunda rodada reduziu a densidade da argila e variou o tamanho dos reparos.
  A primeira comparação havia ficado ruidosa ao rolar a câmera.
- O solo respeita os tiles presentes. Os detalhes da Travessia e da Subida
  continuam recortados pelas máscaras dos terrenos; buracos, retentores,
  plataformas de mão única e bordas de apoio mantêm sua autoridade.
- Veios dos elevadores e pontes usam coordenadas locais da peça. Texturas não
  deslizam pelo tablado quando ele se move.
- Ossabravo: contorno recortado do tórax e crânio, costelas curvas, vértebras,
  articulações, dentes e chifres com luz e sombra. Interpolação inteira entre
  as seis poses-chave produz 18 poses em 18 ticks, incluindo a emenda do ciclo.
  Os quatro cascos permanecem no chão na frenagem, sem salto para a recuperação.
- Prefeito: a máscara parcial que durava 120 ticks foi substituída por pálpebras
  de seis ticks (100 ms). Movimento reduzido mantém os olhos abertos.

Sem alterações de física, colisão, velocidades, duração dos ataques, progresso
ou mapa 3D. Os trabalhadores, vegetação, mecanismos e água já existentes foram
revisados nas capturas e mantidos. Esta rodada não redesenha o protagonista.

## Verificação

- **880 testes de Guaíra passaram**, incluindo novas regressões para continuidade
  dos cascos, emenda da corrida e duração/limite facial da piscada.
- **Build passou**: validação de níveis, assets do protagonista, mundo,
  TypeScript da aplicação e ferramentas, Vite.
- **56 poses**: entradas, câmeras avançadas, percursos de inspeção e movimento
  reduzido. Repetibilidade e ausência de mutação da simulação verificadas.
- **Quatro replays nativos sem dano**, concluídos: Travessia 1.048 updates,
  Pátio 893, Respiros 877 e Subida 1.339. Câmera, personagem e relógios não foram
  reposicionados nesses replays. Simulação a 60 Hz, captura a 15 fps.
- **Edge/Chromium, perfil separado**: entrada nas oito fases pelo hospedeiro
  real, movimento por teclado, pausa com imagem estável, mesma janela de jogo
  e retorno ao mapa. Sem erros de página. Viewport 844 × 390 sem overflow.
- Amostras de 90 renders por fase: medianas locais de 1,3–3,3 ms e percentis 95
  de 2,8–3,8 ms. Medição do render isolado, não garantia de FPS em hardware físico.

Os vídeos de chefes são **poses de inspeção dos renderizadores de produção**,
com ampliação inteira. Não representam uma vitória jogada. Os quatro vídeos
de percurso, por sua vez, usam entradas nativas gravadas e chegam ao resultado
de conclusão sem dano. Nenhum progresso do perfil do usuário foi alterado.

## Reproduzir

Usar um módulo `@napi-rs/canvas` já instalado, sem instalar dependências novas:

```text
node --import tsx scripts/prove_guaira_scenery.ts <output> <canvas-module> --tour --replay --motion
node --import tsx scripts/prove_guaira_level_finish.ts <output-sprites> <canvas-module> ea82c8e8e4f8a3550955f5aefa72c8798ebbb004
```

`scripts/verify_guaira_level_finish.cjs` usa `PLAYWRIGHT_MODULE` apontando para
Playwright instalado, `FEKA_UI_URL` opcional e Microsoft Edge. O servidor deve
estar pronto antes da execução. `GUAIRA_OUTPUT` permite mudar o diretório.

Capturas intermediárias, logs dos testes/build e PNGs de cada quadro ficam em
`output/guaira/level-finish-2026-10-16/` (ignorado pelo Git). A página contém
cópias autocontidas das evidências finais e os três relatórios JSON.
