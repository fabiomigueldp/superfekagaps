# Perseguição: expansão e direção

A perseguição passa de 4.480 para 8.192 px. A saída fica em 8.064; a distância
desde o nascimento de Feka equivale a aproximadamente 38 segundos à velocidade
nativa de corrida, antes de considerar desvios, aceleração e erros. Essa é uma
estimativa geométrica, não uma medição de partida.

## Percurso implementado

| Região | Intervalo | Decisão principal |
| --- | --- | --- |
| Cais | 0–1.120 | Aprender os vãos e a primeira carga que freia o perseguidor. |
| Carga | 1.120–2.240 | Superar o batedor e escolher entre andaimes e pista durante a investida. |
| Pórtico | 2.240–3.520 | O RPG rompe a estrutura; usar os decks que assentam ou a passarela de manutenção. |
| Comportas | 3.520–4.928 | Perceber a pressão, superar a crista de água e alcançar a rota elevada. |
| Passarelas | 4.928–6.560 | Cruzar o carrinho e manter a corrida durante o salto comprometido do dinossauro. |
| Portaria | 6.560–8.064 | Batedor com salto curto, último contrapeso, investida e combinação final de rajadas. |

Os checkpoints ficam em 2.240, 4.640 e 6.560. Eles recriam o trecho seguinte,
marcam os eventos anteriores como consumidos e removem patrulhas já ultrapassadas.
A etapa seguinte do arsenal e o duelo continuam no mesmo encontro.

## Construção e integração

- `HypotheticalLayout`: dados únicos de regiões, ataques, vãos, plataformas,
  inimigos, contrapesos e eventos.
- `HypotheticalChaseGunplay`: inclinação e velocidade dos tiros, intervalos
  reservados e estimativa de espaço para completar cada sequência.
- `HypotheticalChaseSetpieces`: relógio da preparação do RPG, disparo pelo
  encaixe real da arma, ignição após a saída do cano, impacto, decks,
  reservatório e salto. A pintura consulta o estado; não dispara eventos.
- `HypotheticalEncounter.update`: acrescenta cada deck à colisão nativa quando
  ele assenta. O mesmo apoio participa da cobertura dos projéteis. A passagem
  do perseguidor remove colisão e inicia o destroço correspondente.
- `HypotheticalChaseSetpieceArt`: juntas, parafusos, correntes, grampos, vigas,
  captação de água, mostrador de pressão, tampa, foguete, fumaça e crista. As
  vigas desprendidas descem até a água; correntes acompanham suas âncoras.
- `HypotheticalChasePatrol`: batedores com preparação e investida comprometida;
  a última variante acrescenta um salto curto. O operador solta um carrinho com
  rodas, gravidade, colisão nativa e possibilidade de quebrá-lo por cima.
- `WorldFoe.contactPoint` / `WorldGame`: dano, ressalto e partículas usam o
  objeto realmente atingido. Acertar o carrinho não desloca Feka até a sacada
  do operador. O padrão dos demais inimigos permanece na própria entidade.
- `HypotheticalMotion`: compressão, soltura das pernas, cauda, cabeça, cavaleiro
  e recuperação do salto compartilham a trajetória do corpo.
- `HypotheticalChaseCounterplay.escapeCredit`: a carga acertada conserva uma
  vantagem de distância e a reduz progressivamente, em vez de recuperá-la
  imediatamente.
- `HypotheticalGame`: câmera antecipa decisões com transição suave; preserva
  o avanço funcional com movimento reduzido. O HUD acompanha as seis regiões.
- `HypotheticalChaseLife`: fachadas, trabalhadores, aves, barcos e indústria
  cobrem toda a nova extensão, com alturas e materiais das respectivas regiões.

## Orquestração

RPG, água, salto e encontros com patrulhas reservam intervalos do percurso.
Neles, novas rajadas e investidas não são iniciadas. Projéteis que já estavam
em voo conservam sua trajetória. Ataques atrasados expiram quando Feka passa
de sua janela de entrada.

A primeira rajada baixa depois do pórtico foi antecipada para o vão seguinte:
o projeto permite combinar a esquiva com a travessia. O salto do dinossauro
tem 30 ticks de preparação, 42 de voo e 24 de recuperação; a aterrissagem
é comprometida e não persegue a posição de Feka durante o voo.

O reservatório avisa antes de romper e só libera a água após a aproximação
do dinossauro. A colisão fica dentro da crista clara de 30 px; a espuma e a
esteira atrás dela são efeitos. O fluxo termina no canal aberto.

Não foram acrescentados “PISE”, “ALTO”, “BAIXO” ou instruções flutuantes.
Postura, direção da arma, cabo, válvula, borda dos apoios e água comunicam as
ações. As descrições detalhadas continuam no status acessível fora da tela.

## Segunda passagem: contatos, peso e continuidade

- **RPG:** a preparação dura 52 ticks e conserva uma pausa com a arma apoiada
  antes do disparo. Depois de lançar, o cano mantém a direção comprometida.
  Clarão curto, fumaça desprendida da arma, aletas abrindo e núcleo de chama
  distinguem a expulsão do foguete da ignição do motor.
- **Pórtico:** `HypotheticalChaseChoreography` compartilha o movimento entre
  pintura e eventos. Cabos tensionam antes de romper; as vigas giram sobre as
  juntas e conservam a rotação durante a queda. O primeiro canto que encontra
  a água define o respingo e seu som. Cada piso assenta após 36 ticks, com
  atrasos de 0, 6 e 12 ticks. Os grampos amortecem abaixo da superfície fixa
  que recebe os pés e a colisão nativa.
- **Água:** a crista cresce durante 8 ticks e acelera suavemente de 4 para
  5,4 px/tick nos primeiros 14 ticks. Desenho e dano usam a mesma trajetória.
  A área de dano fica dentro da crista e termina na borda do canal. A tampa
  percorre um arco, rebate e assenta; o jato pulsa, a espuma circula e a água
  escoa ao chegar ao canal, deixando uma esteira que se dissipa.
- **Salto:** a altura passa a 42 px. Os pés preservam a pose de saída,
  recolhem de forma assimétrica e se estendem nos últimos 12 ticks de voo.
  O pé dianteiro toca primeiro, o traseiro dois ticks depois. Durante a
  absorção inicial, permanecem presos ao mundo; a corrida retorna até o
  16º tick após a aterrissagem. O cavaleiro reage depois do corpo, com
  inclinação da cabeça e tensão das rédeas. O balanço de corrida diminui
  durante o salto. Uma única sombra acompanha o corpo sobre o chão.
- **Banco de aterrissagem:** o vão seguinte foi deslocado de 5.696–5.776
  para 5.776–5.856, conservando seus 80 px. A recuperação do dinossauro
  acontece sobre o cais; Feka continua até a próxima travessia e suas
  passarelas, em vez de assistir aos pés se apoiando sobre água.
- **Leitura:** a câmera acompanha o foguete e recupera o enquadramento do
  perseguidor conforme os apoios assentam. Permanecem os intervalos sem
  novas rajadas/investidas sobre esses eventos.

Esses ajustes aumentam a pressão da água e encurtam um pouco o voo do
perseguidor. São parâmetros de projeto, ainda sem comprovação por partida
ou avaliação de jogadores nesta revisão.

## Terceira passagem: contato com as estruturas e reação do corpo

- **Primeiro apoio:** `chaseStrikeX` usa o montante de entrada, 23 px antes do
  centro do conjunto. Preparação, aviso, ruptura e reconstrução de checkpoint
  consultam esse mesmo marco. Antes, a cabeça atravessava esse apoio antes de
  começar a quebra. O alcance continua em 56 px à frente do corpo.
- **Peso por material:** a compressão máxima acompanha a falha do primeiro
  encaixe; a recuperação do pescoço segue a liberação da viga. Madeira,
  guindaste, comporta e pórtico usam a ordem de ruptura própria de cada conjunto.
  O avanço perde brevemente uma fração do impulso e se recupera de forma
  limitada, mantendo o controle de distância da perseguição.
- **Movimento secundário:** tronco, cabeça do cavaleiro, roupa, rédeas e ponta
  da cauda têm respostas defasadas. `dinosaurTail` aceita uma articulação distal
  independente nesta animação; as poses anteriores continuam usando seu
  parâmetro padrão.
- **Textura e partículas:** as fissuras progridem na união do apoio; lascas ou
  pequenas peças de metal saem da altura do contato, percorrem um arco, rebatem
  e repousam. A névoa local se dissipa rapidamente. Cada montante fica inteiro
  até seu próprio instante de ruptura, e o som do segundo encaixe acompanha
  essa separação. A viga e o cabo usam a mesma pose, sem um tremor isolado que
  deslocava a polia.
- **Assentamento:** as peças rígidas giram pelo canto que tocou a margem,
  conservando a identidade desse canto durante o tombamento. Um deslizamento
  residual curto dissipa o impulso, em vez de arrastar a viga inteira pela
  origem usada durante a queda.

Os intervalos reservados ao RPG, à água, ao salto e às patrulhas continuam
separando esses eventos da entrada de novas rajadas. Os estilhaços destas
estruturas são cenográficos e ficam no plano atrás do perseguidor.

`scripts/render_hypothetical_chase_impacts.ts` produziu as pranchas em
`impacts/` e uma sequência dirigida de **495 quadros a 30 fps** (16,5 segundos,
sem áudio). O roteiro seleciona estruturas pelo tipo, em vez de índices que
ficaram desatualizados após a expansão do mapa. Há uma sequência isolada do
corpo e duas das cargas suspensas para observar os encaixes.

Foram feitas duas passagens de autoria visual: a primeira mostrou as poses
e os contatos; a segunda incorporou o assentamento pelo canto e a apresentação
do pico de compressão. As imagens são poses preparadas, não uma partida nem
uma medição da dificuldade. O vídeo também não comprova a sincronização sonora.

## Quarta passagem: rajadas descendentes e pressão do percurso

A programação passa de **6 para 9 rajadas**, sendo **7 inclinadas para baixo**
(antes eram 2). Cada rajada contém 4 ou 5 disparos, em vez de 3. O total
programado passa de 18 para 40 tiros; é um máximo de autoria, pois contrapesos,
atrasos, checkpoints e interrupções podem impedir algumas sequências. As duas
investidas continuam no percurso.

| Entrada de Feka | Sequência | Papel no percurso |
| --- | --- | --- |
| 600 | Alta, 4 tiros | Apresentar a direção da arma antes de exigir a esquiva descendente. |
| 912 | Baixa, 4 tiros | Retomar a pressão depois do segundo vão; a rota elevada permite interrompê-la com a carga. |
| 3.056 / 3.392 | Duas baixas, 5 tiros cada | Combinar a saída do pórtico com o salto seguinte e uma segunda preparação na margem. |
| 4.560 | Baixa, 4 tiros | Reabrir a pressão depois do canal da água, antes do próximo operador. O checkpoint em 4.640 já a considera consumida. |
| 5.984 / 6.288 | Baixas, 4 e 5 tiros | Retomar depois da aterrissagem do dinossauro e aumentar a cadência antes do próximo batedor. |
| 7.336 | Alta com 4, seguida de baixa com 5 | Preparar separadamente a mudança de altura junto da travessia final. |

Os tiros baixos mantêm **0,29 radianos de inclinação** (aproximadamente 16,6°).
A arma conserva essa direção durante a rajada, embora sua origem acompanhe o
corpo e o recuo. A mira não muda para acompanhar o salto de Feka. O desenho
preserva espaço sob a trajetória para uma aproximação do dinossauro, com o
risco de contato, além da possibilidade de saltar a sequência no momento certo.

A velocidade baixa progride de 7,1 para 7,3 px/tick. As primeiras sequências
têm 5 ticks entre tiros e 40 de preparação; as mais intensas chegam a 4 ticks
entre tiros e 34 de preparação. Esses valores são parâmetros de projeto,
não medidas de dificuldade ou de reação de jogadores.

`chaseSequenceFits` considera a preparação, a duração, a eventual troca de
mira e o tempo estimado para o último projétil ultrapassar a largura inteira
de Feka, à velocidade nativa de corrida. A estimativa usa a distância atual,
no mínimo o espaçamento de perseguição de 110 px, com uma margem para recuo
e recuperação do avanço. O próximo intervalo reservado vem da mesma lista
usada por `HypotheticalChaseSetpieces.reservesAttack`.

Se não houver espaço para concluir a sequência, ela não começa; seu aviso
nunca é encurtado para encaixá-la. A segunda rajada da combinação também
reavalia a janela antes de começar. A colisão real com chão e cobertura
continua podendo encerrar um projétil antes da estimativa. Essa proteção
de agendamento não é uma simulação de todas as trajetórias possíveis.

`gunplay.png` apresenta quatro poses preparadas da combinação final, usando
as inclinações, velocidades e encaixes nativos da arma. O script de autoria
`render_hypothetical_chase_counterplay.ts` calcula as posições da prancha
sem avançar a simulação nem reproduzir controles. Os títulos ficam somente
na apresentação; não foram acrescentadas instruções visíveis no jogo.

## Arte e limites da revisão

`scripts/render_hypothetical_chase_expansion.ts` compõe 449 quadros dirigidos
com os renderizadores nativos. Ele não atualiza a simulação, não reproduz
entradas, não executa asserções e não abre uma sessão de navegador. As pranchas
permitem examinar os contatos, a direção do foguete, a crista e a extensão
das pernas. Os tempos e posições preparados para apresentação não são
registros de uma partida.

- `chase-expansion.png`: 16 composições dos eventos, rotas e inimigos.
- `rider-details.png`: apoio da arma e saída do foguete, ampliados em pixels inteiros.
- `water.png`: composição da crista e rota elevada.
- `event-detail.png`: doze composições da queda, água e anatomia do salto.
- `chase-expansion.mp4`: 449 quadros / 30 fps, composição dirigida sem áudio.
- `art-study.json`: metadados que identificam a natureza dessas imagens.

Por instrução do projeto, não foram executados testes, typecheck, scripts de
validação ou revisão de navegador. Inspeção de código, pranchas de arte e build
de produção são evidências distintas. O equilíbrio de dificuldade e a resposta
de jogadores não podem ser comprovados por essas pranchas.
