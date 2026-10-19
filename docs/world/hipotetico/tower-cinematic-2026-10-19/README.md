# A torre do Bastião

Cena integrada ao encontro nativo `/?encounter=hipotetico`, no pátio da Vanguarda. Revisão de 19/10/2026.

## Direção

A torre anterior era um desenho estático. Agora tem fundação, arco inferior, corpo, campanário, cobertura e sino. O desenho intacto e as ruínas usam essas mesmas partes, com cantaria, cornijas, telhas, suportes, rachaduras e bordas fraturadas. Os movimentos são desenhados na grade de pixels do cenário.

O cavaleiro põe o fuzil na bandoleira e pega o lançador das costas. O tubo percorre uma trajetória contínua até o ombro. Empunhaduras, boca do tubo, escape e projétil compartilham a mesma geometria. A sustentação do corpo antecede o disparo; cavaleiro e montaria reagem ao lançamento. A arma acompanha a descida da torre antes de ser guardada.

A explosão atinge o corpo abaixo do campanário. A ruptura expõe bordas irregulares, libera argamassa, lança fragmentos e inicia a queda em partes. O sino se solta da suspensão em movimento. Os blocos assentam acima da rua com ressalto amortecido, sem atravessar o piso. A base permanece no lugar, e parte dos fragmentos forma escombros persistentes.

## Tempos

Passos nativos a 60 Hz; deslocamento até a posição e virada acontecem antes da sequência.

| Ação | Passo da sequência | Tempo |
| --- | ---: | ---: |
| Fuzil para a bandoleira | 0–28 | 0–0,47 s |
| Lançador das costas ao ombro | 30–98 | 0,50–1,63 s |
| Disparo | 142 | 2,37 s |
| Recolher o tubo | 286–324 | 4,77–5,40 s |
| Voltar ao fuzil | 324–354 | 5,40–5,90 s |

O voo termina ao alcançar a posição da torre, não em um relógio fixo. Nesta composição, o impacto acontece no passo 159 (2,65 s).

| Elemento | Começa a cair após impacto | Contato com o chão após impacto |
| --- | ---: | ---: |
| Corpo de alvenaria | 18 passos | 92 passos |
| Telhado | 22 passos | 77 passos |
| Campanário | 28 passos | 126 passos |
| Sino | 48 passos | 108 passos |
| Arco inferior | 70 passos | 154 passos |

Argamassa acompanha a separação das partes; poeira e sons de pedra acompanham as aterrissagens. O sino usa um corpo tonal com dois parciais de decaimento próprio. Os sons permanecem no barramento de efeitos existente e respeitam seu limite de vozes.

## Orquestração e continuidade

- A cena é exclusiva do quarto pátio, depois da destruição inicial dos objetos de serviço.
- O diretor verifica se torre e personagem cabem no enquadramento antes de escolher a posição e iniciar o saque.
- Até a ignição, sair desse enquadramento provoca recolhimento da arma e libera uma tentativa futura. A retirada não reproduz o recuo de um disparo.
- Depois da ignição, projétil e escombros terminam sua trajetória mesmo se a câmera se afasta.
- A queda ocorre uma única vez. As nove atividades recorrentes continuam disponíveis depois dela.
- O estado pertence ao cenário persistente do cerco, preservado no retry do mesmo encontro. Um novo encontro começa com a torre intacta.
- O evento pertence ao plano de fundo. Não bloqueia o controle de Feka, não modifica a colisão dos percursos e não cria um novo projétil contra o jogador.
- Movimento reduzido remove o escape luminoso, os rastros e a fumaça decorativa, reduz fragmentos e poeira e retira tremores e oscilações. A trajetória principal continua visível.

## Material de autoria e limites

`tower-sequence.mp4` tem 20 segundos, 30 fps e ampliação inteira de uma composição nativa de 320 × 180 pixels. Não inclui áudio nem combate em primeiro plano. A câmera e a posição de Feka foram fixadas para dirigir o enquadramento; o diretor real escolhe e executa a atividade. Depois da queda, o registro mostra a retomada das atividades recorrentes.

`art-study.json` registra poses, tempos, estados e sinais sonoros da composição. O vídeo e as oito imagens são material de autoria, não uma partida gravada ou teste de gameplay. O som e a disputa de atenção durante a luta completa não foram avaliados em uma partida nesta rodada.

```powershell
node --import tsx scripts/render_hypothetical_tower.ts .tmp/tower-finish C:/Users/fabio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas/index.js
```

Publicação pelo fluxo autorizado do projeto, somente com build de produção, sem suíte de testes, typecheck ou revisão de navegador.
