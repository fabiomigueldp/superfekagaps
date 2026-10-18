# Guaíra — bocais, retorno e despressurização

Continuação de [canos e água em movimento](../fluid-finish-2026-10-17/README.md), em 17/10/2026.

## Problemas encontrados e mudanças

- O ciclo original dos Respiros terminava com quatro marcas subindo em linha. As gotas agora descrevem pequenos arcos de volta à grelha, com alturas e durações diferentes. A cor perde contraste no fim, e cada gota desaparece ao retornar.
- A saída compartilhada pelos percursos ampliados não desenhava o resíduo do desligamento. Ela passou a usar o mesmo ciclo e o mesmo registro nativo de fechamento dos Respiros. A Câmara de Alívio recebeu o mesmo acabamento ao terminar um ciclo normal.
- A bica pública tinha um filete quase todo escondido e uma bacia sem apoio próprio evidente. A bacia foi assentada sobre dois pés no piso da praça; um bocal permanente enquadra a saída, e a queda fica visível até a superfície. A liberação continua pertencendo ao estado final do encontro.
- O fundo do retorno da oficina permanecia parado. Pequenas correntes agora saem da entrada e atravessam o interior da bacia. As barras da grade continuam na frente; o filete da curva conserva sua direção e fase.
- O reflexo do visor da reserva saltava do fundo para o topo. Agora ele entra e sai pelas bordas, com recorte contínuo.

## Integração

`GuairaFluidArt.ts` concentra os resíduos de pressão, usados pelo pintor original dos Respiros, pela saída compartilhada de `GuairaCoursePresentation.ts` e pelo Alívio. `GuairaWaterworksArt.ts` fornece a pequena queda e as correntes das bacias. Os cenários do Prefeito e do Alívio usam esses elementos com suas próprias posições e condições de abertura.

Nenhum relógio de animação novo foi introduzido. A pressão continua vindo de `jetCycle`; o fechamento usa `jetShutdown`; os objetos e a câmera não são modificados pela pintura. A água perigosa permanece opaca e coincide com o retângulo de dano, inclusive nas bordas fracionárias. Movimento reduzido remove os resíduos e fixa os reflexos, preservando os avisos e a altura real da pressão.

## Provas

Veja a [comparação em movimento](index.html), os [quatro estudos](animation-studies.json), a [comparação dos percursos](native-verification.json) e os [resultados consolidados](verification.json).

Os estudos têm 252 quadros a 30 fps, câmera e condições preparadas para inspeção, sem personagem. O estudo de isolamento aciona o registro nativo em momentos definidos e mostra apenas o componente compartilhado sobre o cenário dos Respiros. Esses estudos não são apresentados como partidas.

Separadamente, oito partidas inteiras usam comandos normais, sem alterar personagem, câmera ou relógio. Os estados amostrados, eventos, posições, duração e moedas são comparados com uma execução anterior à alteração. A campanha também é verificada no navegador com um perfil isolado e acesso de desenvolvimento desligado.

Os oito novos testes cobrem arcos e limites dos resíduos, igualdade entre saídas, fechamento e reabertura, continuidade da queda, origem das correntes, oclusão pela grade, conexão da bica ao piso e o recorte do visor. O teste anterior de Alívio conserva o mesmo hash das peças e avisos: só exclui as novas gotas depois de comprovar que ocupam ar vazio acima da grelha, sem perigo ativo.

## Reprodução

```powershell
node --import tsx --test tests/guaira-outlet-finish.test.ts tests/guaira-hydraulics-art.test.ts tests/guaira-respiros-art.test.ts tests/guaira-relief-art.test.ts tests/guaira-relief-flow.test.ts
npm run build
```

Os scripts `prove_guaira_outlet_finish.ts` e `prove_guaira_chapter_readability.ts` recebem uma pasta de saída e o caminho absoluto de `@napi-rs/canvas`. O primeiro recebe também a cópia anterior dos arquivos de arte. O baseline desta rodada está em `output/guaira/outlet-finish-2026-10-17/baseline`, pasta local ignorada pelo Git.

`verify_guaira_outlet_review.cjs` abre a página em 1440 e 390 pixels, decodifica e busca quadros dos quatro vídeos, confere as imagens, o ajuste à largura e os erros do navegador. Configure `PLAYWRIGHT_MODULE`, `FEKA_UI_URL` e, opcionalmente, `GUAIRA_OUTPUT` para o ambiente local.

## Resultado final

3.763 testes TypeScript aprovados, zero falhas e um caso opcional ignorado; três testes JavaScript aprovados. Validadores, dois projetos TypeScript e build concluídos. Oito novos testes. Oito partidas nativas com 183 estados amostrados idênticos à referência; nove execuções da campanha normal no navegador. Quatro vídeos decodificados em duas larguras, sem erros ou transbordamento horizontal.
