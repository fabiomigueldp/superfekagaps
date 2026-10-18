# Flávio Bolsonaro Hipotético · Mega boss

Encontro bônus de fantasia satírica, acessível pelo botão **MEGA BOSS** no título de Super Feka Gaps World ou por `/?encounter=hipotetico`. A caricatura é ficcional; as cenas não representam acontecimentos reais.

## Referências e direção de arte

A pesquisa encontrou a versão do meme com cavaleiro de terno/faixa, tiranossauro e fuzil na [descrição do Teoria Digital](https://www.teoriadigital.com.br/flavio-hipotetico-videos-feitos-com-ia-viram-meme-viral-nas-redes-antes-do-segundo-turno/) e no [quadro publicado pelo Metrópoles](https://www.metropoles.com/colunas/mario-sabino/bolsonaro-hipotetico-contra-o-exercito-do-lula). Foram consultadas também buscas por “Flávio hipotético”, “chad” e “dinossauro”; alguns resultados eram montagens de Jair, e não foram usados como identificação de Flávio.

A arte de produção é original e construída no Canvas nativo: mandíbula caricatural, cabelo penteado, terno azul, faixa, botas, fuzil, sela com lacres de latão e tiranossauro em tons de couro e bronze. Nenhuma imagem da pesquisa foi embutida no jogo. A animação articula pernas, joelhos, mandíbula, cauda, sela, casaco, braços e arma. Os passos usam distância percorrida; a mira, o recuo, os avisos e o ponto de saída dos projéteis compartilham os dados do combate.

## Travessia do arsenal · revisão 13

O pátio de 320 pixels com sete inimigos em ondas foi substituído por uma rua de 1.280 pixels, nove guardas já posicionados, oito andaimes e três portões físicos. A câmera acompanha Feka. Nenhum intervalo cria uma nova horda: o próximo posto acorda quando Feka entra nele.

| Posto | Defesa | Percurso |
| --- | --- | --- |
| Portaria | Batedor e blindado | Dois andaimes, guarita, relógio e primeiro portão |
| Cais de carga | Aríete, lançador alto e batedor com combinação | Três alturas, guindaste, carga suspensa e corredor após o portão |
| Arsenal | Blindado, batedor e dois lançadores com pares de barris | Sacadas em alturas distintas, capacete opcional e saída para o duelo |

`HypotheticalSiege.ts` concentra as posições, limites e progressão. O gatilho apenas desperta os guardas que já existem; enquanto esperam, não se movem, disparam ou causam dano. Os portões abrem ao derrotar a guarnição correspondente, em 72 ticks, com curva suave. O limite inferior desenhado da grade coincide com sua colisão. A passagem fica transitável quando há espaço real para o corpo de Feka. Os portões anteriores permanecem abertos. Esperar não conclui o encontro: é preciso caminhar até a saída.

Cada posto concluído vira um ponto de retomada, inclusive depois de uma morte ou de R. O próximo posto é reconstruído com sua formação inicial; os anteriores permanecem concluídos. Barris e pedras pendentes são retirados na abertura, evitando dano atrasado após a vitória. A retomada também conserva as ruínas e avança o dinossauro e os NPCs ao trecho correspondente. Os pontos de retomada pertencem somente ao bônus.

### Mecânicas e leitura dos guardas

- **Blindado:** salto comum é repelido quando o capacete está fechado. A sentada quebra a proteção, interrompe o ataque e atordoa, mas não mata instantaneamente. Outro salto finaliza. Durante a recuperação do escudo, o salto comum pode quebrar a armadura. O escudo anuncia por 650 ms, avança 14 pixels e recupera por 950 ms.
- **Aríete:** acelera e freia com a direção comprometida. A abertura ao frear permite matar com um salto. A sentada contra a proteção quebra o teto e atordoa; é necessário finalizar. O teto permanece visivelmente quebrado, com dobradiça rompida e condutor exposto.
- **Batedor:** patrulha a 0,8/0,88/0,96 pixel por tick nos três postos. No cais e arsenal, pode continuar a estocada com um passo de 28 pixels, aviso de 560 ms e recuperação de 1.100 ms. Cruzar atrás ou sair da altura antes da continuação cancela o segundo golpe. A arma tem alcance e intervalo ativo próprios.
- **Lançador:** alterna arcos baixos e altos e fixa a direção na preparação. A detecção vertical de 60 pixels deixava os postos altos sem alcançar Feka no chão; agora detecta até 110 pixels de diferença vertical, conservando o alcance horizontal de 170 para apresentar o guarda dentro da câmera. O aviso de 850 ms permanece completo. O arsenal usa pares, com preparação própria e reabastecimento maior após o segundo barril.
- **Combinação:** o lançador do cais pode cobrir a investida do aríete após reabastecer. As duas ações conservam seus avisos e oportunidades de contra-ataque. Lançadores iniciam a preparação em momentos diferentes conforme a posição no posto.
- **Formação:** infantaria preserva 18 pixels entre os corpos, espera espaço para atacar e vira com apoio de 180 ms entre ações. Limites por posto evitam a dispersão para áreas futuras. Atacar, recuar e girar usam deslocamento real para articular os pés.
- **Animação:** ombro, cotovelo, mão, arma, joelhos e botas acompanham preparação e movimento. Bolsa, barril, teto, escudo e fragmentos têm materiais próprios. Pintar não modifica a simulação. A opção de movimento reduzido conserva todos os avisos de perigo.

### Cenário do cerco

A portaria usa guarita com relógio; o cais, guindaste com roldana, corda e carga suspensa; o arsenal, portas reforçadas, tubulações e ventilação. Andaimes têm vigas, travessas, ferragens e bordas claras nas superfícies jogáveis. As grades possuem trilhos, correntes, travessas, lâmpadas e sinalização da saída. A decoração recuada usa contraste menor que personagens e apoios.

O dinossauro percorre continuamente os 1.280 pixels do fundo. Fachadas, destruição e NPCs têm posições na mesma rua; o dinossauro não volta ao início de um pátio repetido a cada passagem. Seis NPCs são atingidos por projéteis visíveis e dois escapam. Os disparos distantes permanecem fora da camada de colisão de Feka. Pedras no plano jogável têm aviso de um segundo.

`guard-atlas.png` reúne 40 poses explícitas, incluindo teto quebrado. `guards-play.mp4` mostra a travessia nativa dos três postos, com uma morte e retomada. `guard-encounters.json` registra nove derrotas, três aberturas e as capturas dos portões, apoios e proteções quebradas. Nenhuma posição de ator, câmera ou relógio é alterada para produzir a prova.

## Revisão do cenário e percurso

- **Três lugares ligados pela mesma cidade.** A perseguição atravessa uma ponte de cantaria sobre o canal, o cerco ocupa uma rua de fachadas com toldos e sacadas, e o duelo acontece diante de um portão com arcadas e bandeiras. A arquitetura do destino da ponte aparece em uma posição fixa do percurso, enquanto a cidade distante se desloca em paralaxe.
- **Superfícies com funções claras.** Cantaria, caixas de madeira, plataformas, colunas e mecanismos têm materiais próprios. A borda clara acompanha o topo real das superfícies de apoio. As colunas que param os tiros usam a mesma geometria no desenho e na colisão, com um pequeno escudo entalhado. Travessas e sombras de estrutura têm menor contraste.
- **Quedas visíveis.** A faixa horizontal que atravessava o fundo dos vãos foi removida da ponte. A água ocupa o espaço abaixo das partes ausentes; as marcas de margem ficam apenas nos blocos sólidos. O desenho do piso acompanha a máscara de colisão atual, inclusive durante o desabamento.
- **Rota opcional com retorno.** Três tablados entre x=720 e x=944 oferecem outra altura de passagem depois do primeiro vão. O tablado central tem um capacete e moedas, e a saída retorna ao piso antes do segundo vão. Um salto curto mantém a rota baixa; a rota alta exige alcançar a superfície elevada. O capacete foi levantado após os testes mostrarem que podia ser coletado por baixo. Os tablados perdem desenho e colisão quando seu apoio na ponte desaba.
- **Materiais e acabamento.** Telhas sobrepostas, venezianas, molduras, portas em arco, toldos, juntas de cantaria, tábuas, ferragens e pequenos grupos de desgaste substituem a repetição uniforme das fachadas. Os prédios distantes têm contraste menor que Feka e o cavaleiro. As fachadas destruídas preservam a base, os materiais e os escombros da construção.
- **Ambiente em movimento.** Água, pequenas nuvens, folhas e bandeiras têm movimentos lentos ligados ao relógio da simulação. Movimento reduzido mantém esses detalhes estáticos. Os fragmentos das fachadas acompanham a destruição já existente; não introduzem perigos sem aviso. As lâmpadas de duração dos pedais foram trazidas para dentro da base visível.

`HypotheticalLayout.ts` concentra tablados, sacadas e colunas. `HypotheticalScenery.ts` constrói o ambiente no mesmo Canvas e na mesma malha de pixels dos personagens. As duas rotas foram percorridas desde o ponto inicial, com os comandos de `tests/helpers/hypotheticalRoutes.ts`, sem mover os personagens diretamente: ambas chegam ao pátio sem morrer; somente a rota alta coleta o capacete. O vídeo completo usa a rota alta.

## Revisão de movimento e combate

- **Quadril apoiado na sela.** A flexão do salto e da investida acontece acima do quadril; cintura e base do casaco deixam de descer através da sela. Roupa e faixa se deformam com o tronco, preservando os encaixes dos dois ombros. O recuo também se concentra no tronco, sem arrastar a cintura. A arma e a cabeça conservam suas posições de combate.
- **Contato das patas.** A poeira dos passos usa a posição da pata apoiada, alternando os lados durante a passada. A emissão acompanha os apoios na aceleração e na frenagem, inclusive na investida de retorno. Os eventos sonoros continuam nos mesmos instantes.
- **Pele e anatomia.** Escamas maiores no dorso e grupos menores no flanco acompanham o volume das costelas. A região inferior tem sombra mais fria, e a garganta preserva o tom quente. Focinho, cavidade da mandíbula, gengiva, língua e dentes têm planos separados. As texturas acompanham as partes do corpo, sem trocar de posição entre quadros.
- **Articulações estáveis.** Coxa e canela mantêm seus comprimentos ao dobrar em torno da pata apoiada ou recolhida. Joelhos, tornozelos, dedos e garras têm volumes próprios. A passada do dinossauro no plano distante também acompanha a distância efetivamente percorrida, corrigindo o deslizamento dos pés.
- **Rosto, roupa e arreios.** A caricatura ganhou planos de bochecha e mandíbula, nariz, orelha, mechas e sobrancelhas mais definidos. O rosto reage menos que o ombro ao recuo; a boca se movimenta no rugido de transição. Lapelas, dobras, faixa, botas, estribo, costuras do couro e fivelas distinguem os materiais. Frente e perfil usam os mesmos acabamentos.
- **Movimentos secundários.** A casaca conserva um pequeno movimento depois da frenagem, e a cauda contrabalança o salto. A varredura perigosa continua usando exatamente a curva da colisão. Movimento reduzido desativa o balanço decorativo, a respiração e o piscar do dinossauro.
- **Uma única peça na recarga.** O carregador é retirado e recolocado pela mão de apoio. O desenho anterior mantinha um carregador na arma enquanto exibia outro solto; a nova animação desloca a mesma peça, com os detalhes metálicos acompanhando seu movimento.
- **Combinações com respostas diferentes.** A segunda fase combina salto e fuzil: depois das ondas no chão, Feka precisa encontrar cobertura ou escapar da mira. Ela também mantém mordida e cauda; se Feka se afastar mais de 120 pixels, a continuação passa a ser um salto. Na terceira fase, as salvas do fuzil emendam um salto e um terceiro ataque: mordida se Feka estiver a até 100 pixels, investida de ida e volta se estiver mais longe. Cauda e mordida formam outra combinação. Cada continuação tem um aviso completo de 44–49 ticks, sem reaproveitar projéteis ou dano do golpe anterior. O HUD mostra a etapa atual e a quantidade de ataques, inclusive 1/3–3/3. Um cabo armado ainda pode interromper a investida final e abrir a recuperação ampliada.
- **Progressão consistente.** A segunda fase começa pelo salto e a terceira pela investida de ida e volta, tanto na primeira tentativa quanto após uma retomada. A sequência evita repetir o salto imediatamente depois da combinação com o fuzil. O cavaleiro fica vulnerável somente ao terminar a sequência, mantendo a janela de contra-ataque.
- **Pressão do fuzil.** A primeira fase tem seis tiros em dois grupos de três. A segunda tem duas salvas de seis; a terceira, duas de nove, totalizando dezoito disparos antes do salto. Pequenos intervalos entre os grupos dão ritmo à rajada. Os avisos e as aberturas de contra-ataque permanecem completos.
- **Recarga com avanço.** Entre as salvas, o dinossauro avança 28 pixels na segunda fase ou 44 na terceira, respeitando as bordas da arena. Ele termina o passo antes dos 24 ticks finais de mira fixa. A mão troca o carregador, o mecanismo fecha e a segunda salva exige ler a nova posição. O avanço não causa dano de contato.
- **Impacto dos tiros.** Recuo de ombro e arma, ferrolho, clarão com dissipação, cápsulas individuais e aquecimento acompanham os disparos. A colisão calcula a primeira superfície atingida: a bala deixa lascas, faíscas e uma marca na coluna ou no piso. Feka continua vulnerável antes da cobertura, mas a bala não atravessa a coluna. Os efeitos de faísca e clarão ficam menores com movimento reduzido.
- **Áudio da arma.** O fuzil tem estalo curto, corpo grave e cauda filtrada; recarga e impactos têm sons próprios. O tiro distante usa outra intensidade e filtragem. Tudo passa pelo volume de efeitos do jogo e é cancelado na pausa, morte, retomada, mudo e saída; não há contexto de áudio separado.
- **Cerco encenado.** O cavaleiro levanta a arma, dispara e relaxa o braço entre salvas no plano intermediário. Oito NPCs têm movimentação própria: seis são atingidos ao longo das três passagens, com recuo e queda articulada, e dois escapam pelo portão. Os corpos permanecem na rua. Os disparos do fundo não causam dano no plano de Feka; as pedras mantêm seu aviso no chão. A primeira rajada acontece depois do título do ato.
- **Cauda e mandíbula.** A cauda levanta antes de varrer o piso; sua curva fornece as pequenas regiões de colisão. A mordida avança e fecha a mandíbula, com a região perigosa acompanhando a abertura da boca. O espaço vazio sob a mandíbula e acima da cauda não causa dano.
- **Passos e viradas.** A passada compensa a distância percorrida durante o apoio, mantendo o pé plantado na passada completa; o retorno levanta a pata. A inversão de sentido passa por uma pose frontal e por poses em três quartos, com focinho, olhos, peito, sela e cavaleiro próprios. A cauda gira para trás do quadril. Na investida de retorno, a virada acontece com o corpo parado e termina antes da arrancada.
- **Cavaleiro articulado.** O tronco se inclina com a velocidade e reage à aceleração e à frenagem. A mão de apoio deixa o fuzil para conduzir as rédeas durante a corrida, a mordida e o salto, voltando à arma para atirar. Ombro, punho, fuzil e ponto de saída da bala compartilham a mesma posição, mesmo durante a perseguição. A arma sobe e desce gradualmente nas trocas de ação.
- **Peso e continuidade.** Preparação, arrancada, voo e recuperação conservam a postura anterior ao trocar de estado. Salto e mordida aceleram e desaceleram ao longo do deslocamento. No salto, o dinossauro recolhe as pernas e o cavaleiro se abaixa. O arco de 48 pixels mantém a silhueta abaixo do HUD, com Feka e a marca de pouso visíveis. A aterrissagem comprime o corpo e acomoda a sela antes de retomar a postura.
- **Contra-ataque sem salto de pose.** Receber um acerto mantém a postura abaixada; o retorno à posição de ataque acontece gradualmente. Os nove rebites da sela correspondem à vida restante, com fragmentos de latão em cada acerto.
- **Leitura dos mecanismos.** O pedal armado abaixa e indica seu tempo restante. As setas da segunda investida apontam para o sentido do retorno. A marca de pouso continua visível durante o voo; o aviso de pedras tem uma contagem visual.
- **Acabamento dos sprites.** As pernas se abrem para frear a investida, com poeira direcional; a casaca e as tiras da sela acompanham o movimento. As rajadas aquecem o cano, movimentam o ferrolho e deixam pequenos rastros de calor. As ondas de impacto têm uma crista animada orientada pelo deslocamento.
- **Último acerto.** O fuzil abaixa, o dinossauro fecha os olhos e o cavaleiro fica atordoado antes de aparecer o resultado. Essa reação dura 60 ticks ativos. O tempo de conclusão já está congelado, e um pulo durante a reação não reinicia a luta por acidente.

As imagens em `grounded-footfall.png`, `return-footfall.png`, `airborne-tuck.png`, `planted-pivot.png`, `rider-lean.png`, `reins-takeoff.png`, `landing-weight.png`, `combo-rifle-tell.png` e `third-charge-tell.png` vêm do replay por controles nativos, sem posicionamento manual dos personagens. Os arquivos de rajadas, impactos e destruição também permanecem disponíveis nesta pasta.

`sprite-atlas.png` é uma prancha separada de inspeção: doze poses explícitas desenhadas pelo mesmo renderizador, em pixels nativos, para comparar materiais e articulações. Ela não é uma captura de partida nem uma folha de sprites carregada pelo jogo.

## Percurso

1. **A ponte do impossível.** Perseguição de 1.600 pixels: três obstáculos baixos, dois vãos de 64 pixels, moedas e rajadas com mira anunciada. A rota alta acrescenta três tablados, quatro moedas e o capacete opcional; a rota baixa permanece disponível. As rotas convergem antes do segundo vão. Piso e tablados perdem colisão e desenho conforme a ponte desaba atrás do dinossauro. Um portal marca a chegada ao pátio. Parar permite que o perseguidor alcance Feka, quebre o capacete e o derrote.
2. **A travessia do arsenal.** Três postos conectados, nove guardas e portões que abrem ao vencer cada guarnição. Lançadores ocupam as sacadas; os demais circulam no próprio posto. Enquanto isso, o cavaleiro atravessa o plano intermediário, derruba três fachadas e dispara contra os NPCs, com seis quedas cartunescas e dois sobreviventes que escapam. Pedras que chegam ao plano jogável têm uma marca no chão por um segundo antes de cair.
3. **O último lacre.** Nove acertos, três fases. Rajada mirável, investida, mordida com avanço, salto com ondas no solo e varredura de cauda. A última fase inclui investida de ida e volta, com aviso próprio antes do retorno. Os cabos laterais podem prender o dinossauro e ampliar a recuperação.

## Leitura e regras

- Âmbar marca perigo ou preparação; verde-água marca um cabo armado ou uma abertura para contra-atacar.
- No duelo, a mira fica comprometida nos 24 últimos ticks do aviso. O disparo não segue uma esquiva feita depois disso. Na perseguição, o fuzil mantém um ângulo para a frente enquanto o dinossauro corre; a distância converge suavemente para manter o perseguidor visível.
- Colunas sob as sacadas bloqueiam balas. Ondas no piso exigem salto ou altura. A arma não causa dano instantâneo por contato.
- Feka acerta a cabeça do cavaleiro por cima durante a recuperação. Um único acerto é permitido por abertura. A sela abaixa antes de ficar vulnerável.
- Aberturas normais oferecem aproximadamente 2,4 segundos de vulnerabilidade; um cabo amplia esse intervalo para aproximadamente 3,3 segundos.
- A retomada conserva o ato e os postos do cerco concluídos; no duelo, começa no início da fase de nove, seis ou três lacres. O equipamento é restaurado para a tentativa.
- A física, o salto variável, a corrida, a sentada, os inimigos, o capacete, a morte, o áudio, o pause e os controles são os de `WorldGame`. O bônus não grava conclusão, desbloqueio ou checkpoint na campanha.

**Controles:** A/D ou setas; Shift/X para correr; Espaço/Z/cima para pular; baixo no ar para a sentada; Esc para pausa; R para retomar o trecho. Após vencer, Enter, um novo comando de pulo ou o botão REJOGAR inicia outra tentativa.

## Verificação reproduzível

- `tests/hypothetical-boss.test.ts` e `tests/hypothetical-audio.test.ts`: 48 testes, incluindo rotas alta e baixa, alcance da recompensa, câmera e remoção dos tablados desabados, quadril apoiado durante flexão e recuo, encaixe dos ombros, origem da poeira sob as patas, comprimentos das articulações, movimento reduzido, curva de colisão da cauda, alinhamento entre arma e bala, combinações, cabos, salvas de 6/12/18 tiros, cobertura, NPCs, áudio, pausa e percurso completo por controles nativos.
- `tests/helpers/hypotheticalReplay.json`: replay por teclado, sem invulnerabilidade, teletransporte ou alteração de inimigos. A execução registrada atravessa os três atos e vence após duas mortes e retomadas.
- `scripts/verify_hypothetical_boss.cjs`: entrada pelo menu real, replay no navegador, pausa, vitória, repetição, inspeção em 390 pixels com movimento reduzido e pausa por toque.
- `scripts/prove_hypothetical_boss.ts`: quadros do mesmo replay no tamanho nativo de 320 × 180. O vídeo de revisão reproduz essa execução, incluindo a morte.
- `scripts/prove_hypothetical_sprites.ts`: prancha de doze poses em 768 × 456, para revisão visual dos sprites. A execução verifica que desenhar cada pose não altera o estado do combate.
- `tests/hypothetical-guards.test.ts`: 26 testes de preparação, ataque, defesa, apoio dos pés, articulação, combinações, separação e recarga. `tests/hypothetical-siege.test.ts`: seis testes de progressão espacial, patrulhas em espera, colisão dos portões, proteções quebráveis, lançadores elevados e travessia integral com retomada. Total: 80 testes do encontro.
- `scripts/prove_hypothetical_guards.ts`: 40 poses dos quatro guardas em 1280 × 512. `scripts/prove_hypothetical_guard_encounters.ts`: reproduz a travessia dos postos pelos controles normais, verifica nove guardas derrotados e três passagens, grava vídeo e registra dano/retomada.
- `scripts/render_hypothetical_audio.cjs`: renderiza o sintetizador de produção e coloca os sons de arma nos ticks registrados. A faixa de revisão contém fuzil, recarga e impactos; música e demais sons continuam disponíveis ao jogar. `audio-verification.json` registra a renderização sem saturação.

O replay confirma que há um percurso executável e que as transições funcionam. A dificuldade e o prazer do combate continuam sendo questões de experiência de jogadores; não são garantidos por uma execução automatizada.

Verificação desta revisão: 80 testes e build de produção concluídos; replay de 6.486 frames até a vitória, com duas mortes e retomadas; 6.207 ticks ativos. Os três postos foram atravessados por controles normais, com nove guardas derrotados, abertura dos três portões e uma retomada no arsenal. Navegador sem erros; pausa por teclado/toque, menu real, vitória e apresentação móvel de 390 pixels com movimento reduzido conferidos. A prévia dos postos tem 17,7 segundos; o vídeo completo inclui a reação de derrota e o resultado final.
