# Porto do Bielzão · segundo diorama

O Porto usa a campanha existente como referência: chegada ao cais, contrapesos, pátio de contêineres, expedição e cabine de operações. O atalho de manutenção liga 2-3 a 2-5. A câmera ortográfica e os cinco pontos de fase ficaram congelados após a revisão da estrutura, mantendo o enquadramento 8:5 da Costa.

A arte inclui decks e rampas apoiados, placas niveladas nas transições, pilares e travamentos, defensas e amarrações, ferragens dos contêineres, cabine, rebocador e pequenos apoios de pedra costeira. A carga suspensa foi movida para a área de içamento à direita: além da passagem física, sua projeção precisa deixar Feka e a rota visíveis.

## Arquivos e reprodução

- Fonte canônica: `tools/diorama/render_porto_map.py`
- Revalidação geométrica: `tools/diorama/check_porto_clearance.py`
- Exportação final do cache: `tools/diorama/render_porto_cached.py`
- Empacotamento e conferência das âncoras: `tools/diorama/package_porto_map.py`
- Runtime: `porto-diorama.webp` e `porto-diorama.meta.json`

```sh
blender -b -t 12 -P tools/diorama/render_porto_map.py -- --final
python tools/diorama/package_porto_map.py
```

O cache Blender é descartável. PNGs, cópias lossless e imagens de revisão ficam fora do Git e da publicação. O render principal tem 1920×1200 RGBA; o WebP usa qualidade 91. Imagem e metadados somam 187.342 bytes nesta exportação. Os tamanhos e hashes estão em `porto-art-manifest.json`.

## Verificação e integração

`porto-prototype-clearance.json` registra 666 verificações de espaço livre e 666 de apoio, sem falhas. `porto-projected-clearance.json` registra 273 amostras do percurso e da área ocupada pelo personagem, sem sobreposição com a carga suspensa. As verificações geométricas complementam a inspeção da imagem; não substituem a revisão do jogo no navegador.

O mapa carrega cada diorama na primeira visita à ilha e reutiliza seu cache nas voltas. A imagem principal e os metadados são ativados em conjunto; camadas opcionais não atrasam esse par. Respostas tardias de outra ilha não substituem a cena atual. Exportações incompletas, de outra ilha ou com pontas de rota desalinhadas usam o mapa alternativo funcional.

Os quatro trechos principais e o atalho são validados contra os cinco nós. Os IDs, desbloqueios, selos, save e fases permanecem os mesmos. A suíte cobre troca de ilha durante carregamento, retorno ao cache, falhas parciais, rotas/progresso de 2-1 a 2-5 e atualização com movimento reduzido. A revisão visual no navegador ocorre na prévia integrada antes da promoção à produção.
