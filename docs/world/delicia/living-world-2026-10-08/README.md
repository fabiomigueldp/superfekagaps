# Império da Delícia — cenários em movimento

Continuação da revisão de objetos e criaturas de 8 de outubro de 2026. A implementação está no renderizador usado pelo capítulo dentro do World. A galeria apenas permite inspecionar essa arte e comparar os mesmos 50 enquadramentos com a rodada anterior.

## Arte e composição

- **Cais:** velas com costuras e dobras, movimento dos barcos, flâmulas, toldos, carga suspensa e polia do guindaste. Caixas com tábuas e ferragens, cordas enroladas, cestos e frascos nas bancas.
- **Pomares:** copas em movimentos pequenos e desencontrados, flores nas pérgolas, folhas e flores junto às plataformas. O movimento permanece preso ao elemento do cenário durante a rolagem.
- **Aqueduto:** roda visível dentro do arco, eixo com suporte e retorno de água. A animação e o fluxo adicional seguem a fonte exigida pela ponte daquele trecho; a segunda válvula não liga por engano a roda do bairro.
- **Reservatório:** linhas de água, espuma, gotas e ondulações; mais fraturas e musgo nas rochas, com um arco-íris discreto no cânion.
- **Adega:** chama das lanternas, mesa de leitura com página que se ergue, livros, garrafas rotuladas e torneiras dos barris.
- **Refinaria e santuário do relógio:** vapor conectado aos tubos, fornalhas, polias ligadas por correia, biela ligada à roda, ventilação, mostrador e pêndulo. A correia aberta gira ambas as polias no mesmo sentido, com a menor girando mais rápido.
- **Cidadela:** estandartes, vasos e ornamentos. O salão de Guina recebe vitral com rosácea de oito pétalas, quatro painéis facetados, divisórias e coroa em relevo.

Todos esses desenhos usam a grade nativa de 320 × 180 e materiais compatíveis com a paleta do World. Fundo e decoração recebem menos contraste que personagens, coletáveis e superfícies jogáveis. As decorações são desenhadas atrás dos atores.

## Passadas de revisão

1. Materiais e movimento por ambiente, com capturas de todas as fases.
2. Revisão de composição: roda reposicionada no vão do arco; rosácea com pétalas definidas; acabamento dos objetos pequenos; coerência entre correia, polias e biela.
3. Revisão em movimento: a chama de uma lanterna expôs uma coordenada fracionária no preenchimento de polígonos. O preenchimento agora amostra linhas inteiras na grade nativa. Nova verificação de quadros animados, rolagem e apresentação.

O relógio visual das novas animações continua separado dos sinais necessários à jogabilidade. Com movimento reduzido, os detalhes ficam estáticos; os avisos de perigo continuam seguindo a simulação. Desenhar não altera o estado da partida.

## Verificações

- `npm run build`: passou, incluindo validações de conteúdo e TypeScript.
- `npx tsx --test tests/delicia-*.test.ts tests/world-scene-ui.test.ts`: 140 passaram, zero falhas, 1 ignorado porque o módulo opcional `@napi-rs/canvas` não está instalado.
- `review_delicia_native.cjs`: 50 enquadramentos nas 14 fases, sem pixels fora da grade ou erros no navegador.
- `review_delicia_living.cjs`: 56 quadros animados; zero pixels fora da grade e zero mutações da simulação. Movimento observado e congelamento decorativo verificado nas 14 fases. Rodas dos dois trechos do aqueduto conferidas com a fonte correta e a fonte não relacionada.
- `review_delicia_scenery.cjs`: 700 quadros em 14 fases, variando posição e altura da câmera. Zero pixels transparentes, zero mutações e nenhum salto acima do limite do verificador. Nesta execução local, o desenho apenas do fundo teve mediana de 0,7 ms e p95 de 2,7 ms; essa medição não representa o tempo total de um quadro do jogo.
- `review_delicia_presentation.cjs`: 60 capturas em cinco tamanhos de tela, zero erros. Verifica janela, renderizador e Player compartilhados, menus, diálogos, controles de teclado/toque, navegação e estados preparados dos chefes.
- `review_delicia_living_gallery.cjs`: 50 comparações carregadas; reprodução, pausa, avanço manual, fontes, câmera e movimento reduzido verificados. Sem transbordamento horizontal a 390 px; a prévia mantém 320 px nesse tamanho. Zero erros no navegador.

Capturas e estados da galeria são preparados para revisão visual. Não representam uma campanha completa jogada. As alterações desta rodada não constituem novos resultados de playthrough.

## Arquivos principais

- `src/adventure/delicia/DeliciaSceneDetails.ts`: tecidos, mecanismos, água, fogo, vapor, vitral e pássaros.
- `src/adventure/delicia/DeliciaPropArt.ts`: objetos pequenos, plantas e ventilação.
- `src/adventure/delicia/DeliciaPixelBackdrop.ts`: integração das camadas de fundo.
- `src/adventure/delicia/DeliciaSceneryLandmarks.ts`: marcos dos trechos e resposta visual às fontes.
- `src/adventure/delicia/DeliciaSceneryPrimitives.ts`: copas e rasterização na grade nativa.
- `src/adventure/delicia/DeliciaPixelScenery.ts` e `DeliciaNativeArt.ts`: conexão dos detalhes ao relógio visual do capítulo.

Veja os relatórios JSON e os logs de build/testes nesta pasta. A galeria interativa precisa do servidor de desenvolvimento, pois importa os mesmos módulos de desenho do jogo. As capturas PNG permanecem disponíveis separadamente.
