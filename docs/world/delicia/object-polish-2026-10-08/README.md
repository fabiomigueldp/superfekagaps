# Objetos e criaturas — 8 de outubro de 2026

Esta rodada refina a arte nativa do Império da Delícia. As alterações estão no renderizador usado pelas fases, com a paleta `ART`, os pixels inteiros e o `SpriteAtlas` compartilhados pelo World.

## Arte

- Oito inimigos: Polpa com casca e folhas; Besouro com carapaça segmentada; Vespa com quatro posições de asas; Rolo com engrenagem e visor; Guarda com elmo e escudo; Garrafa com gargalo, reflexos e líquido; Barril com madeira, aros, dentes e língua; Flor com pétalas, folhas e boca lançadora.
- Jajá: rosto, barba, avental costurado, bolso, botas e caneca de madeira com alça. Guina: cabelo, bigode, coroa com joia, capa, armadura, medalhão cítrico e taça. Recuperação, atordoamento e derrota têm poses próprias; Guina deixa a coroa no chão na derrota.
- Coletáveis: laranja, coração de cura, selo com fitas e gota de memória. Sementes, gotas de suco e corações de Guina têm sprites próprios; o coração hostil é diferente do coletável inclusive na silhueta.
- Válvula: base, tubulação, roda arredondada, raios, manômetro, ponteiro e confirmação desenhada. Prensas: guias, pistão, parafusos, faixas e sinais do ciclo. Jatos: bocal e impulso ascendente. Vapor: placa triangular e coluna quente. Vento: ventilador com pás e suporte até o chão. Molas: capuz e espiras visíveis. Suco: superfície, bolhas e reflexos.

## Integração e revisão

Os atiradores registram o instante real do disparo para mostrar a reação por 240 ms, sem acrescentar um estado de ataque à colisão. O atordoamento tem prioridade. Vespas olham na direção do movimento e os barris distantes ficam parados. Os sinais essenciais de máquinas seguem o relógio da simulação mesmo quando as animações decorativas são reduzidas.

A revisão nas fases revelou uma sobreposição entre a bandeira compartilhada do World e a válvula. Foram ajustados o posicionamento dos checkpoints, corações, válvulas e primeiras frutas dessas áreas. Os elevadores e as rotas superiores mantêm suas posições; os testes de transporte e acesso aos 36 selos passaram.

Foram revisadas três rodadas de capturas: sprites iniciais; objetos e poses integrados; correções de sobreposição, confirmação de abertura e suporte do ventilador. As imagens são estados preparados do renderizador real, não partidas completas. As pequenas mudanças de enquadramento entre as capturas de objetos servem para manter o objeto em foco.

## Verificação

- `npm run build`: concluído com validações de fases, assets, World e TypeScript.
- `npx tsx --test tests/delicia-*.test.ts tests/world-scene-ui.test.ts`: 140 aprovados, zero falhas, um teste opcional de canvas ignorado neste ambiente.
- `review_delicia_native.cjs`: 50 enquadramentos das 14 fases, zero erros no navegador e zero pixels fora da grade nativa.
- `review_delicia_objects.cjs`: 14 capturas de objetos em diferentes estados, zero erros, grade íntegra e ausência de mutação da simulação durante o desenho.
- `review_delicia_presentation.cjs`: 60 capturas em cinco configurações de tela; seis grupos de verificações, sem erros. Inclui janela compartilhada, teclado, toque, diálogo, pausa, configurações e os chefes nas três fases.

A [galeria](index.html) permite pausar e avançar as animações, escolher poses, comparar os sprites e conferir cada estado das máquinas. `atlas.json` contém os quadros exportados do código em uso. Os relatórios JSON e os logs de build/testes estão nesta pasta.
