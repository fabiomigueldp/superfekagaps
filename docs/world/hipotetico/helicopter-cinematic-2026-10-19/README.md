# Helicóptero na chegada ao arsenal

Cena adicional do encontro satírico Flávio Hipotético, depois dos ataques iniciais no pátio e antes do primeiro confronto com guardas.

## Encenação e integração

- O intervalo começa no tick 304 da chegada e acrescenta 372 ticks (6,2 s a 60 Hz). `arrivalBeat` desloca as entradas posteriores; `arrivalStoryTime` conserva os tempos locais das ações já existentes. A multidão inicial, os detritos e os efeitos continuam envelhecendo durante esse intervalo.
- A grade do primeiro abrigo abre no tick 676. A entrada da segunda praça continua aguardando o jogador em `ARRIVAL.watchX`; o combate só é admitido pela grade seguinte.
- O cavaleiro reconhece a aproximação, baixa o fuzil, alcança o RPG, leva o tubo ao ombro, mira e dispara no frame 154 da nova cena. As mãos chegam ao gatilho e ao apoio em momentos diferentes; há antecipação do corpo durante o saque e acomodação do peso no ombro. A mira permanece na direção do disparo antes de acompanhar a queda suavemente.
- `launcherGeometry` fornece as mesmas posições do tubo, das mãos, da boca e da saída traseira para arte e simulação. A parte do projétil ainda dentro do tubo fica recortada pelo plano da boca. `advanceRocketMotor` só inicia chama, fumaça e som quando a carcaça já ultrapassou a saída; o foguete então acelera. A torre também compartilha essa regra de ignição, preservando sua trajetória e duração de voo.
- A interseção do segmento com o polígono girado da fuselagem fornece ponto, normal e posição local do contato. A abertura e as trincas acompanham a chapa, enquanto faíscas e fragmentos se afastam na direção da superfície atingida. Os volumes da explosão se expandem, derivam e esfriam, sem encolher de volta para o ponto inicial.
- Após o impacto, o motor rompe no tick 9, a cauda se desprende no tick 16 e o rotor no tick 28. A falha do motor tem uma segunda expansão de fogo, chapa própria e fragmentos metálicos. As peças herdam a velocidade linear e o movimento angular do ponto de desprendimento.
- O trem de pouso e a porta cedem no primeiro contato com o pavimento. Poeira, faíscas de contato e a marca inicial nascem no vértice de apoio real. A carcaça se comprime um pouco ao assentar; arte e geometria de suporte usam a mesma deformação. Velocidade, gravidade, rotação, atrito, pequenos rebotes e repouso pertencem ao modelo, não ao desenho.
- O pátio elevado está atrás da rua percorrida pelo dinossauro. Carcaça, peças, fragmentos e marca no piso permanecem. Plumas, rastros e contatos têm duração e capacidade limitadas.
- A cena usa o relógio do jogo e o barramento existente de efeitos sonoros. O rotor tem pulsos próprios e a falha de motor tem queda de frequência. Pausa interrompe a simulação e as vozes; checkpoints já concluídos não reproduzem o lançamento.
- Os efeitos atmosféricos continuam se dissipando se o jogador demora a atravessar o pátio. O modo de movimento reduzido diminui pás aparentes, partículas e oscilação decorativa sem alterar as colisões ou a abertura das grades.

## Arte e evidência

`scripts/render_hypothetical_helicopter.ts` produz uma composição dirigida com o renderizador nativo de 320 × 180. Não executa navegador, testes, controle do jogador ou asserções. O vídeo registra os 60 quadros por segundo da simulação, com câmera fixa, sem áudio e sem combate em primeiro plano. `launch-study.png` amplia seis momentos do disparo e do impacto, sem interpolação dos pixels.

`art-study.json` registra os quadros, os tempos dos sons, as poses, o ponto de impacto e o primeiro contato com o chão. Nesta versão, a ignição começa 16 ticks após a ejeção; o foguete encontra a fuselagem 27 ticks após o disparo; o primeiro contato do corpo com o chão acontece 74 ticks depois do impacto.

Após as três passagens iniciais, esta revisão acrescenta duas passagens de autoria: continuidade da ejeção/ignição, direção dos fragmentos, superfícies de vidro e metal e contato dos patins; depois, ruptura do motor, fumaça durante a queda, compressão da fuselagem e recortes da sequência a 60 fps. A publicação usa apenas o build de produção solicitado pelo usuário, sem testes, typecheck ou revisão de navegador. Esse build não comprova equilíbrio de gameplay.

Esta página e o vídeo são materiais locais de revisão; os arquivos de documentação não entram no pacote público do jogo.
