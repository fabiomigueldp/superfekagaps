# A torre do Bastião

Cena integrada ao encontro nativo `/?encounter=hipotetico`, no pátio da Vanguarda. Revisão de 19/10/2026, quarta rodada: abertura fixa das atividades secundárias e continuação entre os escombros.

## Direção

A torre anterior era um desenho estático. Agora tem fundação, arco inferior, corpo, campanário, cobertura e sino. O desenho intacto e as ruínas usam essas mesmas partes, com cantaria, cornijas, telhas, suportes, rachaduras e bordas fraturadas. Os movimentos são desenhados na grade de pixels do cenário.

O cavaleiro põe o fuzil na bandoleira e pega o lançador das costas. O tubo percorre uma trajetória contínua até o ombro. Empunhaduras, boca do tubo, escape e projétil compartilham a mesma geometria. A sustentação do corpo antecede o disparo; cavaleiro e montaria reagem ao lançamento. A arma acompanha a descida da torre antes de ser guardada.

A munição carregada e o foguete em voo compartilham o desenho e a posição da ponta. O primeiro quadro não avança o projétil: ele se separa do tubo antes de acelerar, com propulsão, aletas e um som de passagem próprio. A fumaça é emitida a cada três pixels percorridos, incluindo posições intermediárias nos passos mais rápidos. Cada emissão fica no local e se dispersa, sem esticar a fumaça atrás do foguete.

O corpo do motor emerge atrás da ogiva. Sua extensão é compartilhada pela arte e pelo emissor, mantendo chama, aletas e fumaça na mesma cauda. O rastro começa após a ignição: um filamento curto conecta as emissões recentes, e a continuidade se desfaz conforme elas expandem e derivam. O volume cresce enquanto a opacidade diminui, evitando a aparência de pontos isolados ou nuvens que implodem.

A explosão atinge o corpo abaixo do campanário. Há um clarão curto, expansão quente, projeção de material e uma nuvem que perde contraste. O topo inclina sobre o apoio antes de cair. A cobertura se rompe em duas partes, expondo as travessas. O sino se desprende da suspensão em movimento. O primeiro contato do campanário dispara sua fragmentação em dois pilares, lintel e soleira.

As peças soltas usam uma simulação local com gravidade, velocidade angular, impulso no contato, restituição e atrito. Há dois subpassos por quadro para resolver os cantos em rotação. As superfícies consideradas são a rua, a base preservada e as peças já acomodadas; é uma física cênica delimitada, sem simulação geral de colisões entre todos os corpos móveis. Movimentos residuais sustentados abaixo de um pixel levam ao repouso. As ruínas e parte dos fragmentos permanecem no cenário.

## Materiais e continuidade dos efeitos

- As rupturas emitem nas juntas transformadas de cada peça, em vez do centro geométrico. A soltura do sino usa madeira da suspensão; as extremidades das travessas ficam nos pilares depois da fragmentação.
- Pedra, telha e madeira têm proporções, tons e realces diferentes. Os contatos registram o deslizamento tangencial, que orienta os grãos e a poeira. O impacto do sino emite uma quantidade menor de poeira.
- O badalo tem velocidade angular própria. Responde à aceleração do corpo do sino, sofre amortecimento e encontra um limite de curso na borda interna. Esse detalhe não cria novos sons repetitivos.
- Seis emissões de fumaça, entre os passos 8 e 68 após o impacto, capturam a posição da abertura no corpo de alvenaria. Depois de emitidas, derivam independentemente; nenhuma emissão atrasada continua nascendo no espaço deixado pela torre.
- As sombras consideram a altura sobre a superfície de apoio e continuam visíveis nas peças em repouso. A abertura danificada é desenhada sobre a ornamentação, com interior escuro, bordas expostas e trincas progressivas.
- Nos primeiros 16 passos do impacto, um reflexo breve ilumina arestas próximas e o bronze. Movimento reduzido omite esse reflexo; não há clarão de tela inteira.

## Tempos

Passos nativos a 60 Hz; deslocamento até a posição e virada acontecem antes da sequência.

| Ação | Passo da sequência | Tempo |
| --- | ---: | ---: |
| Fuzil para a bandoleira | 0–28 | 0–0,47 s |
| Lançador das costas ao ombro | 30–98 | 0,50–1,63 s |
| Disparo | 142 | 2,37 s |
| Recolher o tubo | 286–324 | 4,77–5,40 s |
| Voltar ao fuzil | 324–354 | 5,40–5,90 s |

O voo termina ao alcançar a posição da torre, não em um relógio fixo. Nesta composição, o impacto acontece no passo 166 (2,77 s): 24 passos de voo após a saída. A propulsão começa quatro passos depois do lançamento.

| Elemento | Liberação após o impacto | Comportamento |
| --- | ---: | --- |
| Corpo de alvenaria | 18 passos | Cede abaixo do topo e gira para fora |
| Campanário | 40 passos | Herda a inclinação e se fragmenta no primeiro contato |
| Cobertura | 48 passos | Separa duas partes, com velocidades e giros diferentes |
| Sino | 56 passos | Herda a posição e o movimento da suspensão |
| Arco inferior | 88 passos | Solta-se por último, perto da base preservada |

Os tempos de contato resultam da simulação. `art-study.json` registra os contatos efetivos desta composição. Argamassa acompanha a separação das partes; poeira e sons de pedra acompanham as aterrissagens. O sino usa um corpo tonal com dois parciais de decaimento próprio. Os sons permanecem no barramento de efeitos existente, respeitam seu limite de vozes e têm intervalo entre os impactos de escombros.

## Orquestração e continuidade

- A cena é exclusiva do quarto pátio. O diretor assume no passo local 226, depois da recuperação da ação principal de entrada. A torre é a primeira atividade secundária, antes das buscas nos objetos de serviço e das seleções recorrentes.
- O diretor verifica se torre e personagem cabem no enquadramento antes de escolher a posição e iniciar o saque.
- A câmera compartilha seu enquadramento com o diretor. A compensação horizontal é suavizada e mantém pelo menos 48 pixels adiante do corpo de Feka; ao fim da busca, retorna gradualmente à composição habitual.
- Até a ignição, sair desse enquadramento provoca recolhimento da arma e libera uma tentativa futura. A retirada não reproduz o recuo de um disparo.
- Depois da ignição, projétil e escombros terminam sua trajetória mesmo se a câmera se afasta.
- A queda ocorre uma única vez. A busca nas ruínas vem em seguida, antes das nove atividades recorrentes. Se a câmera deixa o grupo, os próximos momentos da descoberta e do ataque aguardam; fragmentos livres e poeira continuam se movendo.
- O estado pertence ao cenário persistente do cerco, preservado no retry do mesmo encontro. Um novo encontro começa com a torre intacta.
- O evento pertence ao plano de fundo. Não bloqueia o controle de Feka, não modifica a colisão dos percursos e não cria um novo projétil contra o jogador.
- Movimento reduzido remove o escape luminoso, os rastros e a fumaça decorativa, reduz fragmentos e poeira e atenua o clarão. A trajetória e a queda física permanecem iguais.
- O rastro tem até 36 emissões, e a fragmentação tem até 64 partículas. Fragmentos menores expiram, e peças acomodadas deixam de integrar movimento. As nove ações recorrentes não recriam nem reiniciam a destruição.

## Busca nas ruínas

O dinossauro caminha até a posição física da parte esquerda do telhado depois que ela se acomoda. Primeiro fareja e revolve pequenos fragmentos existentes. Depois prende a peça, faz força, levanta e a solta. A parte mantém sua textura e geometria; só há um corpo, transferido entre repouso, boca e movimento livre. Peças apoiadas nela são despertadas quando o apoio sai do lugar.

O NPC de camisa vermelha com estrela branca aparece no espaço exposto, com o mesmo desenho de roupas, rosto e membros dos moradores do cenário. Há um momento de percepção, tentativa de recuo e antecipação do dinossauro. Na captura, o corpo articulado é desenhado entre as camadas da boca, sob os dentes; acompanha o mesmo ponto usado pelo pescoço. A mordida tem fechamento, deslocamento de peso e reação do cavaleiro. O personagem cai inteiro junto às ruínas e permanece no cenário.

| Momento da busca | Passo local |
| --- | ---: |
| Farejar e revolver fragmentos | 0–54 |
| Prender a cobertura | 58 |
| A peça cede; levantar e inspecionar | 86–138 |
| Soltar a cobertura para a física | 138 |
| NPC emerge; percebe a montaria | 166–194 |
| Preparar a investida e capturar | 218–242 |
| Levantar e morder | 242–278 |
| Soltar e acomodar o personagem | 312–350 |
| Retomar o restante das atividades | 392 |

A continuação possui seu próprio relógio de atuação e um relógio livre para a poeira. Os contatos sonoros pertencem aos passos de esforço, captura e mordida. Não se reinicia a busca nem se recriam moradores a cada ciclo.

## Material de autoria e limites

`tower-sequence.mp4` tem 20 segundos, 60 fps e ampliação inteira de uma composição nativa de 320 × 180 pixels. Não inclui áudio nem combate em primeiro plano. A câmera e a posição de Feka foram fixadas para dirigir o enquadramento; o diretor real escolhe e executa a atividade. O registro mostra a queda, a continuação nos escombros e a retomada das demais buscas.

`art-study.json` registra poses, tempos, estados físicos, contatos, posições de emissão de fumaça, ângulo do badalo, continuação e sinais sonoros da composição. O vídeo e as vinte imagens são material de autoria, não uma partida gravada ou teste de gameplay. O som e a disputa de atenção durante a luta completa não foram avaliados em uma partida nesta rodada.

```powershell
node --import tsx scripts/render_hypothetical_tower.ts .tmp/tower-discovery-final C:/Users/fabio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas/index.js
```

Publicação pelo fluxo autorizado do projeto, somente com build de produção, sem suíte de testes, typecheck ou revisão de navegador.
