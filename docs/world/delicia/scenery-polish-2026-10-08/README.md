# Cenários do Império da Delícia — 8 de outubro de 2026

Esta revisão melhora a arte em execução nas 14 fases, sobre a integração de renderizador, HUD, diálogos e controles já concluída. Não altera mapas de colisão, física, recompensas ou progresso.

## Arte

- Porto: vila em terraços, fachadas variadas, velas de tecido, guindaste, mercado e píeres com tábuas, pregos e travessas.
- Pomares: copas com massas sobrepostas, galhos, frutas, terraços de irrigação, estufa, pérgolas, moinhos e solo com raízes e estratos.
- Aqueduto: arcos abertos em dois níveis, juntas de pedra, vegetação, tubulações e canais.
- Reservatório: paredões facetados, quedas d'água, fontes e uma composição própria para a nascente de Jajá. Maré de Laranja apresenta rio e barcos.
- Arquivo: abóbadas, lamparinas, livros, garrafas e barris em combinações diferentes.
- Refinaria: tanques de cobre, soldas, medidores, tubos, chaminés, treliças e fornalhas.
- Cidadela: torres, telhados, portões, estandartes e vitral da coroa no salão de Guina.

As figuras são rasterizadas em pixels inteiros na grade nativa 320 × 180. Os materiais usam a paleta compartilhada; os planos distantes usam cores menos saturadas e contrastadas. Sem imagens remotas, filtros de suavização ou dependências adicionais. A decoração usa o relógio de movimento reduzido existente; os avisos das máquinas continuam seguindo a simulação.

## Passadas de revisão

1. Reconstrução das silhuetas e composições de cada ambiente, substituindo os prédios, montanhas e árvores repetidos.
2. Ajustes a partir das 50 capturas: copas conectadas, raízes e materiais próprios, juntas dos arcos, detalhes de rocha e metal, decoração variada no chão. Texturas limitadas ao interior das plataformas pequenas.
3. Revisão final: contraste da vegetação, continuidade do aqueduto, deslocamento contínuo do sol e vapor sem reinício abrupto. Inspeção com HUD, diálogos, chefes e controles de toque.

## Verificação

- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado, incluindo as validações de níveis e assets.
- `npx tsx --test tests/delicia-*.test.ts tests/world-scene-ui.test.ts`: 136 passaram; 1 teste opcional de canvas nativo ignorado; 0 falhas.
- `tools/qa/review_delicia_native.cjs`: 50 enquadramentos nas 14 fases; nenhum pixel fora da grade 3 × 3 na exportação 960 × 540; sem erros no navegador.
- `tools/qa/review_delicia_scenery.cjs`: 700 quadros com rolagem e variação de altura; fundo totalmente preenchido, nenhuma mutação de estado pela pintura e nenhuma troca abrupta de camada detectada pelo limite de diferença entre câmeras adjacentes. As medições de tempo são diagnósticos locais de desenho, não garantia de FPS.
- `tools/qa/review_delicia_presentation.cjs`: 60 capturas em cinco tamanhos; janela e interfaces compartilhadas, toque, preferências, saída e reentrada aprovados; sem erros no navegador.
- `tools/qa/prove_delicia_native.cjs`: caminhar, correr, salto variável, golpe para baixo, pausa, retorno ao mapa e toque real aprovados.

As imagens de comparação são capturas do renderizador real com câmeras e poses preparadas. A revisão não deve ser interpretada como uma partida manual completa de cada fase. `antes/` preserva a arte do começo desta revisão; `depois/` contém os mesmos enquadramentos com a nova arte.

## Arquivos da implementação

- `src/adventure/delicia/DeliciaPixelBackdrop.ts`: paisagens, arquitetura e camadas de profundidade.
- `src/adventure/delicia/DeliciaSceneryLandmarks.ts`: marcos associados aos trechos de cada fase.
- `src/adventure/delicia/DeliciaSceneryPrimitives.ts`: formas, vegetação e materiais na grade nativa.
- `src/adventure/delicia/DeliciaPixelScenery.ts`: terreno e decoração próximos do jogador, integrados às máquinas existentes.
