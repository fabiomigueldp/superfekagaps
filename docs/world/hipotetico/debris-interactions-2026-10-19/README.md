# Buscas e interações nos escombros

Revisão de 19/10/2026, integrada ao encontro nativo `/?encounter=hipotetico`.

## Direção

O ciclo anterior continuava ativo, mas vários contatos terminavam na mesma sacudida genérica. Esta rodada acrescenta três performances com objetos persistentes e encadeia algumas delas às consequências de ataques anteriores. O repertório passa de seis para nove ações.

- **Madeira:** aproximação, pegada, esforço antes de a viga ceder, elevação, breve inspeção, soltura e acomodação no chão. A viga sai efetivamente da pilha e pode ser manipulada novamente onde ficou.
- **Pedra:** o dinossauro segura uma pedra solta, desloca-a e volta a observar o espaço descoberto. A abertura da mandíbula acompanha o volume da pedra. Rotação, queda e pequenos ressaltos pertencem à mesma peça.
- **Metal:** o dinossauro força o puxador inferior de uma chapa articulada. O topo continua preso ao batente. A abertura revela a estrutura de serviço; a chapa volta com rebote amortecido, preservando as deformações anteriores.

O cavaleiro compensa o esforço com tronco, rédeas e postura, ligeiramente depois do movimento do dinossauro. Os pés permanecem apoiados durante a elevação dos materiais. O ponto de contato da boca é compartilhado pela pose e pela peça, incluindo orientação e altura. Investidas e ações de remexer também passam a ajustar a cabeça à altura do alvo.

## Orquestração

Um material recém-atingido pode motivar a busca seguinte. Essa prioridade tem intervalo próprio e não ocupa indefinidamente o ciclo: ações elegíveis ausentes das últimas seis seleções recebem prioridade. As duas ações mais recentes continuam sendo evitadas quando há alternativas visíveis. A ordem inicial e sua rotação permanecem específicas de cada pátio.

As performances usam antecipação, esforço, contato e recuperação. O diretor escolhe os pontos visíveis antes de iniciar a ação. Uma caminhada pode ser redirecionada quando a câmera muda bastante; um contato já iniciado mantém seu destino. A entrada na rua seguinte continua reservada à apresentação original daquela rua.

| Busca | Pegada | Material cede | Soltura | Duração da ação |
| --- | ---: | ---: | ---: | ---: |
| Viga | 54 | 78 | 154 | 212 passos |
| Pedra | 58 | 80 | 132 | 192 passos |
| Chapa | 56 | 82 | 128 | 190 passos |

São passos nativos a 60 Hz. Deslocamento, eventual virada e recuperação ocorrem além desses tempos. A cena continua alternando estas buscas com investidas, pisadas, rajadas, caudadas, remexidas e rugidos.

## Continuidade e acabamento

- Há uma viga e uma pedra manipuláveis por pátio. Cada uma existe em um único lugar: pilha, boca ou chão. Nenhuma nova cópia é criada a cada repetição.
- As peças conservam posição, orientação e desgaste. O deslocamento fica limitado ao espaço dos materiais. A viga se acomoda sobre o piso depois da queda.
- Se a etapa muda durante uma pegada, a peça se solta onde está e termina de cair. O novo palco assume o personagem.
- A chapa tem dobradiça, puxador, nervuras, marcas de impacto e uma estrutura visível atrás da abertura. Madeira e pedra receberam desenhos próprios para funcionar também soltas e giradas.
- Os sons de contato distinguem madeira, pedra e metal e acompanham a pegada, o esforço e a aterrissagem. Usam o barramento de efeitos e o limite de vozes já existentes.
- As partículas continuam breves e contidas no plano de fundo. Movimento reduzido preserva as ações principais e reduz oscilações e efeitos decorativos.

## Material de autoria

O vídeo reúne 80 segundos de composições simultâneas nos quatro pátios, feitos com o renderizador de produção. Os primeiros 60 segundos mantêm as posições; os últimos 20 percorrem o mesmo pátio com posições dirigidas. Não inclui áudio nem o combate em primeiro plano. Não é uma partida gravada, teste automatizado ou avaliação da dificuldade.

`art-study.json` registra os momentos e posições usados na composição. A prancha organiza aproximação, esforço, elevação e soltura da viga, deslocamento da pedra e abertura da chapa.

Nesse material de autoria, cada pátio registrou 15 inícios de performances e passou pelos nove tipos de ação. Isso descreve a composição produzida, não uma validação de gameplay.

```powershell
node --import tsx scripts/render_hypothetical_aftermath.ts .tmp/aftermath-handling-release C:/Users/fabio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas/index.js --handling
```

Publicação pelo fluxo do projeto, somente com build de produção, sem suíte de testes, typecheck ou revisão de navegador.
