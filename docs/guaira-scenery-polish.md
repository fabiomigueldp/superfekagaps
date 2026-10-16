# Guaíra — cenários e movimento ambiente

Continuação de level design em 16/10: [retorno ao desafio no Pátio](world/guaira/route-recovery-2026-10-16/README.md),
com escada de manutenção, guias articuladas, recuperação local, câmera e HUD
compartilhado; 961 testes aprovados.

Level design em 16/10: [escolhas, exploração e percursos](guaira-level-design.md),
com andaimes, registro opcional, bolso escavável, saída da galeria de inspeção
e recompensas da manutenção; 946 testes aprovados.

Rede pelas fases em 16/10: [Pátio, Respiros, Alívio, Subida e Prefeito](world/guaira/network-finish-2026-10-16/README.md),
com cavaletes, abraçadeiras, coletores, retorno e reserva particular refinados,
água contínua nas curvas, relógios integrados e 924 testes aprovados.

Acabamento das comportas de 16/10: [reservatórios e encaixes](world/guaira/gate-finish-2026-10-16/README.md),
com apoios dos tubos na alvenaria, saída recortada nos reservatórios, correntes
convergentes, guias e acionamento ligados às pontes; 914 testes aprovados.

Revisão das conexões de 16/10: [tubos e água em movimento](world/guaira/connections-polish-2026-10-16/README.md),
com visores nos tubos inclinados, ondas a partir da queda, espuma de impacto,
conexões nos Respiros e 909 testes aprovados.

Revisão das comportas de 16/10: [pontes, roldanas e água](world/guaira/sluice-polish-2026-10-16/README.md),
com apoios nas margens, correntes ligadas aos tablados, canal final completo,
irrigação por válvula e 903 testes aprovados.

Continuação hidráulica de 16/10: [água, pressão e mecanismos](world/guaira/pressure-polish-2026-10-16/README.md),
com alimentação lateral dos pistões, fluxo pelas curvas, retorno de alívio animado,
aviso de pressão corrigido e 893 testes aprovados.

Revisão hidráulica de 16/10: [tubos, pistões e água em movimento](world/guaira/hydraulics-polish-2026-10-16/README.md),
com encaixes refinados, fluxo contínuo e 887 testes aprovados.

Continuação de 16/10: [trabalhadores, inspetor e arrozais](world/guaira/life-polish-2026-10-16/README.md),
com sete poses por ciclo, vegetação variada e 883 testes aprovados.

Atualização de 16/10: [materiais, Ossabravo e olhar do prefeito](world/guaira/level-finish-2026-10-16/README.md),
com comparações visuais, quatro percursos completos e 880 testes aprovados.

Passagem visual de 15/10/2026 nos renderizadores nativos das fases. A mesma arte
é usada pelos laboratórios e pelo capítulo; não há cenário paralelo nem novos
arquivos de imagem para carregar durante o jogo.

## Composição

- Travessia: céu suave, serras e horizonte contínuos, árvores de quintal, toldo,
  moinho apoiado no terreno e arrozais com taludes até a margem.
- Pátio: remoção dos blocos de paisagem suspensos; duas profundidades de campo,
  quintal da casa, árvores e arrozais apoiados. Placas presas ao terreno ou à
  tubulação que identificam.
- Respiros: vegetação e céu coerentes com a Travessia, luz de campo, sombra da
  árvore e toldo na estação de água. O ciano dos jatos continua exclusivo do dano.
- Curral: casa da comporta, campos recuados, árvores, cerca com travessas,
  cocho e sombras de contato. A faixa de combate continua visualmente limpa.
- Subida: vista elevada do vale, árvores e toldos, casas ligadas aos quintais e
  postes completos. Os quintais param nas margens existentes dos dois vãos.
- Prefeito: paisagem atrás da vila, copas e toldos discretos; válvulas, lacres,
  reserva, alertas e água pública continuam subordinados ao estado do encontro.
- Galeria e Câmara de Alívio: a luz e as serras vistas pelas janelas acompanham
  a paleta exterior. A composição interior e suas indicações permanecem estáticas.

## Movimento

`GuairaScenery.ts` reúne céu, nuvens, pássaros e vento. O relógio vem da própria
fase; Respiros mantém o relógio hidráulico nativo. Não há temporizador, aleatoriedade,
partículas soltas ou acumulação de objetos. Nuvens e bandos só repetem fora da tela;
os pássaros alternam pequenos batimentos com planagem e longos intervalos sem voo.

O vento tem fase no mundo, não na câmera. Raízes, troncos, sombras e fixações dos
toldos ficam parados. Folhas, arroz e tecido movem-se em um ou dois pixels. Com
movimento reduzido, a decoração fica estática e não há bandos atravessando a tela;
movimentos e sinais necessários à jogabilidade conservam seus contratos anteriores.

## Segunda revisão — percurso completo

A inspeção de câmeras intermediárias encontrou um defeito de geometria nos
taludes: a base era limitada pela altura da tela antes de calcular a inclinação.
Ao subir a câmera, o talude mudava de formato. Os vértices agora permanecem no
mundo, e o Canvas recorta o resultado. O descarte lateral inclui os pés inclinados.
O teste de translação reproduziu 802 pixels divergentes antes da correção e zero
depois, incluindo entradas e saídas pelas bordas.

- Copas com três silhuetas, proporção ligada à altura da árvore e massas de
  folhas assimétricas. Os apoios e a fase do vento continuam fixos no mundo.
- Pequenos pássaros pousados nos telhados da Travessia e do Curral. Olham ao redor
  e levantam a cauda ocasionalmente, com pés fixos e silhueta sempre conectada.
- Respiros: taludes sob os canteiros, plantio alternado entre fileiras, alturas
  variadas e movimento concentrado na parte superior das hastes.
- Pátio: a primeira fileira de arroz encontra sua base; o quintal inferior chega
  aos postes e ao piso real de recuperação. A seta de retorno usa pixels próprios,
  pois o caractere `<` não existe na fonte do jogo.
- Placas do Curral na Travessia e em Respiros têm ligações completas à cerca.
- O último aviso de checkpoint da Travessia é encerrado ao concluir a fase;
  ele permanecia preso atrás do painel final porque seu temporizador já não avançava.

Evidências desta revisão em `output/guaira-scenery/refined/`:

- `overview.png`, `later.png` e os quatro arquivos `*-tour.png`: 56 poses com
  câmeras iniciais, intermediárias, elevadas e de recuperação. As 32 poses
  iniciais/avançadas incluem movimento normal e reduzido.
- `report.json`: poses reproduzíveis, ausência de mutação no render e quatro
  replays de entrada nativa concluídos sem dano: Travessia (1.048 atualizações),
  Pátio (893), Respiros (877) e Subida (1.339).
- `travessia-ambiente.mp4`: câmera fixa, 12 segundos de ambiente.
- `travessia-percurso.mp4`, `patio-percurso.mp4`, `respiros-percurso.mp4` e
  `subida-percurso.mp4`: controles gravados passando pelo Input, física e câmera
  reais, sem reposicionar Feka nem alterar o relógio. Vídeos a 15 fps, simulação
  a 60 Hz, raster original ampliado por vizinho mais próximo.

Os logs `refinement-phase-tests.log` (538 testes aprovados) e
`refinement-build.log` (validadores, dois projetos TypeScript e Vite aprovados)
ficam na pasta superior. Os novos testes cobrem a estabilidade dos taludes e a
conexão dos pássaros; a regressão de orientação também verifica a retirada do
aviso de checkpoint na conclusão, em laboratório e no capítulo.

No Chromium, os mesmos controles concluíram Travessia e Subida sem dano. A câmera
vertical da Subida percorreu de -19 a 172 pixels. Uma amostra de 335 renders teve
mediana de 1,6 ms e percentil 95 de 2,1 ms na máquina local; não é um benchmark de
FPS de dispositivo físico. Não houve erros no console. Na Subida, o Chromium
registrou um aviso de autoplay de áudio ao receber teclas sintéticas sem um
gesto confiável do usuário; esse replay verifica imagem e controles, não áudio.

Para reproduzir também os percursos:

```text
node --import tsx scripts/prove_guaira_scenery.ts output/guaira-scenery/refined <canvas-module> --tour --motion --replay
ffmpeg -framerate 15 -i output/guaira-scenery/refined/travessia-replay/%04d.png -vf scale=960:540:flags=neighbor -c:v libx264 -crf 18 -pix_fmt yuv420p output/guaira-scenery/refined/travessia-percurso.mp4
```

## Evidências da primeira revisão

Arquivos locais em `output/guaira-scenery/`:

- `before/overview.png`: captura anterior das oito cenas.
- `after/overview.png` e `after/later.png`: entradas e câmeras avançadas.
- `after/report.json`: 32 poses, incluindo movimento reduzido, repetibilidade e
  confirmação de que desenhar não altera física, objetos, câmera ou progresso.
- `after/travessia-ambiente.mp4`: 12 segundos de movimento ambiente, 15 fps,
  câmera e pose de jogo fixas. É uma demonstração do renderizador, não uma partida.
- `phase-tests-final.log`: 535 testes específicos de Guaíra passaram.
- `grounding-tests.log`: 60 testes passaram após o último ajuste de bases e
  placas, incluindo uma nova regressão para casas/postes da Subida.
- `build-final.log`: validação de níveis, sprites, mundo, TypeScript e build.

Reprodução das poses com um módulo instalado de `@napi-rs/canvas`:

```text
node --import tsx scripts/prove_guaira_scenery.ts output/guaira-scenery/after <canvas-module> --motion
ffmpeg -framerate 15 -i output/guaira-scenery/after/motion/%03d.png -vf scale=960:540:flags=neighbor -c:v libx264 -crf 18 -pix_fmt yuv420p output/guaira-scenery/after/travessia-ambiente.mp4
```

Revisão adicional em Chromium: Travessia, Curral, Subida e Respiros, inclusive
viewport móvel simulado 844×390. Pausar o curral manteve a imagem exatamente igual
entre capturas. Uma amostra de 180 renders de Respiros no navegador teve mediana
de 2 ms e percentil 95 de 4 ms; trata-se de render isolado na máquina local, sem
garantia de FPS em dispositivos físicos.

Na execução geral, 3.099 testes passaram, dez falharam e um foi ignorado. Durante
a execução, os arquivos do mapa estavam recebendo alterações independentes. Após
a atualização de `guaira-navigation.json`, as nove falhas de navegação de Guaíra
passaram na reexecução (`recheck-global.log`). Resta a comparação do relatório
publicado da Fábrica com seus metadados atuais (`factory-diorama-tooling.test.ts`),
fora desta alteração. Os três testes de leaderboard também passaram separadamente.
