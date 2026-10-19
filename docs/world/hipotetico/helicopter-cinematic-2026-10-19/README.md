# Helicóptero na chegada ao arsenal

Cena adicional do encontro satírico Flávio Hipotético, depois dos ataques iniciais no pátio e antes do primeiro confronto com guardas.

## Encenação e integração

- O intervalo começa no tick 304 da chegada e acrescenta 372 ticks (6,2 s a 60 Hz). `arrivalBeat` desloca as entradas posteriores; `arrivalStoryTime` conserva os tempos locais das ações já existentes. A multidão inicial, os detritos e os efeitos continuam envelhecendo durante esse intervalo.
- A grade do primeiro abrigo abre no tick 676. A entrada da segunda praça continua aguardando o jogador em `ARRIVAL.watchX`; o combate só é admitido pela grade seguinte.
- O cavaleiro reconhece a aproximação, baixa o fuzil, alcança o RPG, leva o tubo ao ombro, mira e dispara no frame 154 da nova cena. A aeronave inicia um pequeno recuo e ganho de altura.
- `launcherGeometry` fornece as mesmas posições do tubo, das mãos, da boca e da saída traseira para arte e simulação. O foguete acelera em linha reta; a interseção do segmento com o polígono girado da fuselagem produz o impacto.
- A ruptura libera chapa, cauda e rotor em etapas. O trem de pouso e a porta cedem no primeiro contato com o pavimento. Velocidade, gravidade, rotação, atrito, pequenos rebotes e repouso pertencem ao modelo, não ao desenho.
- O pátio elevado está atrás da rua percorrida pelo dinossauro. Carcaça, peças, fragmentos e marca no piso permanecem. Plumas, rastros e contatos têm duração e capacidade limitadas.
- A cena usa o relógio do jogo e o barramento existente de efeitos sonoros. O rotor tem pulsos próprios e a falha de motor tem queda de frequência. Pausa interrompe a simulação e as vozes; checkpoints já concluídos não reproduzem o lançamento.
- Os efeitos atmosféricos continuam se dissipando se o jogador demora a atravessar o pátio. O modo de movimento reduzido diminui pás aparentes, partículas e oscilação decorativa sem alterar as colisões ou a abertura das grades.

## Arte e evidência

`scripts/render_hypothetical_helicopter.ts` produz uma composição dirigida com o renderizador nativo de 320 × 180. Não executa navegador, testes, controle do jogador ou asserções. O vídeo é uma seleção de 30 quadros por segundo de uma simulação a 60 Hz, com câmera fixa, sem áudio e sem combate em primeiro plano.

`art-study.json` registra os quadros, os tempos dos sons e as poses usadas na composição. Nesta versão, o foguete encontra a fuselagem 23 ticks após o disparo, e o primeiro contato do corpo com o chão acontece 71 ticks depois do impacto.

Foram feitas três passagens de autoria: enquadramento da cauda, paleta, recuo antes do disparo, fumaça e continuidade do RPG guardado; depois, contato dos fragmentos, acomodação das chapas sobre o piso e separação entre o sol e a trajetória do foguete. A publicação usa apenas o build de produção solicitado pelo usuário, sem testes, typecheck ou revisão de navegador. Esse build não comprova equilíbrio de gameplay.

Esta página e o vídeo são materiais locais de revisão; os arquivos de documentação não entram no pacote público do jogo.
