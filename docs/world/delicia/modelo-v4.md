# Império da Delícia: polimento do terreno e da água

5 de outubro de 2026. A revisão 4 trabalha sobre a arquitetura da revisão 3.
O foco é a integração entre relevo, rio, rochas, areia e mar. Os mestres das
revisões anteriores permanecem preservados.

## Alterações no modelo

- **Cachoeiras:** lâmina contínua curvada sobre os dois desníveis, perfil de
  queda acelerada, pequenas irregularidades na borda, cristas no líquido e
  reflexos de comprimentos diferentes. Espuma e gotículas se concentram nos
  pontos de impacto e se dispersam a jusante. O suco tem material sem metal,
  com reflexo de superfície e variação de âmbar entre corrente e margens.
- **Rio:** canal de largura variável, dois poços de queda, margem que encontra
  a superfície do líquido e uma foz ampla. A cor e a opacidade diminuem no
  encontro com o mar, eliminando a ponta sólida do render anterior.
- **Rochas:** afloramentos calcários com planos de fratura, arestas erodidas e
  estratos discretos. Grupos de volumes grandes e fragmentos menores substituem
  a distribuição regular de pedras trianguladas. As raízes dos afloramentos
  ficam embutidas na encosta; pequenos blocos da zona de maré ficam submersos.
- **Praias:** enseadas com declive suave, areia clara, faixa úmida, vegetação
  esparsa acima da maré e pequenas ondas interrompidas. A linha da água é
  calculada a partir da altura real do terreno.
- **Terreno:** malha mais densa, normais contínuas nas encostas e variação de
  cor entre calcário, vegetação, areia seca e areia molhada. A parte submersa
  desaparece gradualmente no mar do mapa.

A câmera e a escala fixa no atlas foram mantidas. Os 12 pontos de fase são
reprojetados a partir da cena, incluindo os pontos que acompanham o relevo.
IDs, desbloqueios e saves continuam com o mesmo contrato. O mapa da campanha
e o panorama World importam a mesma URL versionada do WebP.

## Fontes e reprodução

| Arquivo | Conteúdo |
| --- | --- |
| `imperio-delicia-v4.blend` | Cena editável, organizada por bairros |
| `imperio-delicia-v4.glb` | Geometria, materiais, cores por vértice, câmera e luzes |
| `island-render-v4.png` | Render mestre transparente, 2.560 × 1.600 |
| `island-map-v4.json` | Metadados e pontos projetados da câmera |
| `../../../tools/delicia/island_landscape.py` | Terreno, afloramentos, suco e praias |
| `../../../tools/delicia/rebuild_island.py` | Arquitetura, iluminação e montagem da cena |

```sh
blender -b --python tools/delicia/rebuild_island.py -- --draft
blender -b --python tools/delicia/rebuild_island.py -- --cpu
python tools/delicia/package_assets.py
npm run build
npm run size:build
```

As prévias ficam em `output/delicia/island-v4/`. O final usa Cycles com até 48
amostras adaptativas e denoising em CPU. A resolução e o processamento em tiles
reduzem o pico de memória. CUDA é usado no traçado quando disponível; `--cpu`
força o processamento em CPU. O GLB conserva geometria e
cores; os detalhes procedurais dos shaders ficam no Blender. A imagem do mapa
é um render estático do modelo 3D, sem simulação de fluido em tempo real.

`output/delicia/island-v4/review.html` permite comparar os dois renders no
mesmo enquadramento através do servidor Vite. Os arquivos de trabalho e os
mestres 3D não entram no pacote público do jogo.

## Conferência

O verificador `scripts/verify_delicia_island.cjs` usa perfis novos do Chromium,
com a instalação existente de Playwright indicada em `PLAYWRIGHT_LIB` e o
executável indicado em `CHROMIUM_PATH`. Ele confere imagem e metadados,
posições dos 12 marcadores, navegação por teclado, entrada em uma fase, pausa,
retorno ao mapa e toques em emulação móvel. Relatório e capturas ficam em
`output/delicia/island-v4/browser/`.

Resultados da revisão entregue:

- Cena com 6.086 objetos, 61 materiais utilizados e 12 pontos de fase.
- Terreno e rio sem faces degeneradas ou coordenadas não finitas; espaço
  entre queda e parede de 0,55 m e 0,51 m nos dois pontos conferidos.
- Render e WebP de 2.560 × 1.600. O WebP ocupa 277.354 bytes; o GLB, 37.776.644
  bytes. Cores por vértice e transparência foram verificadas na exportação.
- 21 testes da expansão aprovados, com nova conferência dos hashes dos assets
  depois do empacotamento final. TypeScript, validações do projeto e build aprovados.
- Chromium de produção: 12 marcadores alinhados, teclado, fase, pausa, retorno,
  panorama World e toque em emulação móvel aprovados, sem erros no navegador.
- Pacote compilado com 50.947.354 bytes, abaixo do limite de 53.000.000.

A renderização final foi concluída em CPU. A tentativa anterior com processos
concorrentes esgotou memória; o gerador agora usa tiles, resolução menor e
denoising em CPU para reduzir esse pico. O modelo 3D mantém a geometria completa.
Os relatórios `scene-audit.json`, `asset-audit.json` e `browser/report.json`, junto
às capturas de comparação e detalhe, ficam em `output/delicia/island-v4/`.
