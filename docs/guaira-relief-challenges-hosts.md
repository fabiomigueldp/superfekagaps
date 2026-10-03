# Objetivos opcionais da Câmara nos hosts

O capítulo e a visita livre da Galeria usam os mesmos três controles. Depois da chegada viva na Câmara, o principal oferece **OUTRA ROTA**: uma chegada com alívio aberto propõe conservar tampa e capacete; uma chegada com tampa intacta propõe abrir o alívio e alcançar a saída. **TENTAR** reconstrói a Câmara mantendo o objetivo escolhido. Pausa conserva a tentativa; retomar não reinicia o desafio.

O objetivo e seu resultado vêm de `routes.snapshot` e `reliefChallengeMessage`, inclusive no resumo que o host substitui após a chegada. Falhar no objetivo mantém a passagem concluída. Os objetivos são locais à tentativa: não alteram saves, moedas, medalhas, desbloqueios, recibos obrigatórios ou água/áudio do capítulo.

`GuairaReliefReplayControls` captura `other-route` e `retry` quando apresenta os comandos e renova os listeners a cada `routes.revision`. Antes de consumir, verifica proprietário, foco/visibilidade, revisão e a pressão de tecla/ponteiro. As pressões sobrevivem à troca de runtime nos botões reutilizados pela visita livre. O host descarta os comandos e a cena anterior antes de chamar `factory(canvas, status, options)`; opções também são preservadas na recuperação de falha de carregamento.

## QA e seletores

- Livre: `guaira-galeria.html`, Galeria real → `#lab-pause` (ALÍVIO) → Câmara. Na chegada, `#lab-pause` vira OUTRA ROTA; `#lab-retry` repete o objetivo; `#lab-exit` mantém o link nativo do Bairro.
- Capítulo: `guaira-capitulo.html`, jornada → Bairro da Vala Seca / Galeria dos Remendos → caminhar até o Bairro → entrar na Galeria → `#chapter-primary` (ALÍVIO). Na Câmara concluída, o mesmo botão vira OUTRA ROTA; `#chapter-retry` repete; `#chapter-map-return` volta ao Bairro.
- Nome acessível de OUTRA ROTA: `Tentar outra rota na Câmara de Alívio`. Mensagens em `#lab-status`.
- Vitórias reais: `tests/helpers/guairaGalleryReplay.json` abre a passagem; `tests/helpers/guairaReliefReplay.json` contém `maintenance`, `interval` e `headBump`. Aplicar os eventos de teclado ou os botões DOM de toque nos frames gravados, sem alterar posições, tiles ou flags. Manutenção abre o alívio; intervalo conserva tampa e capacete.

## Evidência automatizada

`guaira-gallery-continuation-native.test.ts` percorre as duas rotas com teclado e toque, aciona OUTRA ROTA, cumpre o novo objetivo, usa TENTAR e conclui uma rota que falha no objetivo mantendo a passagem concluída. `guaira-relief-challenge-chapter.test.ts` usa os botões reais em 0/5, 1/5 e 5/5, nos dois inícios de capítulo, e verifica sucesso/falha opcional com recibos, água e áudio intactos. `guaira-relief-host-actions.test.ts` verifica callbacks e pressões antigas através de conclusão, pausa/retomada, blur, hidden, retry e descarte. Os testes do núcleo cobrem morte/reconstrução e a invalidação nativa correspondente.

DOM, canvas, áudio e transporte de assets são fronteiras simuladas nesses testes; QA visual no navegador é uma etapa separada. Sem publicação, push ou acesso ao Oracle nesta integração.

A integração também passou no Chromium com o build de produção: Galeria e Câmara
percorridas por eventos DOM de teclado a 60 Hz, sem alterar posição, vida ou
conclusão. Nos hosts livre e capítulo foram verificados os dois objetivos, falha
opcional com passagem concluída, retry do mesmo objetivo, descarte da cena antiga,
foco e invalidação após blur. A tela de capítulo em 390 × 844, com movimento
reduzido, voltou à maquete sem overflow. Isso não mede FPS em dispositivo físico.
