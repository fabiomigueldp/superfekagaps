# Guaíra — revisão dos percursos e da dificuldade

16/10/2026. Esta revisão substitui as conclusões sobre extensão e desafio dos
percursos anteriores. As conferências anteriores de controles, arte e mapa
continuam úteis, mas não demonstravam que as fases tinham conteúdo suficiente.

A continuidade de 17/10 acrescenta seis desvios altos, vinte moedas e seis guardas. Veja a [revisão da exploração](exploration-polish.md) e o [registro atual](exploration-verification.json). Os números da tabela abaixo já incluem essa continuidade.

## Diagnóstico

As seis fases de exploração não tinham inimigos. Suas larguras eram de 704 a
1.536 pixels: entre 2,2 e 4,8 telas de 320 pixels, sem contar deslocamento
vertical e retornos. A maior parte do trabalho do jogador era descobrir um
registro, esperar um transporte ou repetir uma passagem já compreendida.
Depois de aprender a regra inicial, frequentemente já estava perto da saída.

Os percursos gravados provavam que era possível chegar ao fim, conservar o
capacete e usar os controles nativos. Isso não provava variedade, tensão ou
uma curva de aprendizado. Em particular, esperar muito por um elevador
aumentava a duração sem aumentar as decisões do jogador.

A intervenção preserva as primeiras lições e desenvolve cada uma em uma
sequência maior. Os novos trechos usam terreno, inimigos, dano, sentada,
plataformas, pressão e checkpoints do motor principal. O fim da fase foi
deslocado de verdade: alcançar a antiga saída não concede conclusão.

## Dimensão e função de cada fase

| Fase | Largura anterior → atual | Novas áreas | Inimigos | Função na jornada |
|---|---:|---:|---:|---|
| Travessia da Vala Seca | 1.536 → 4.032 px | 4 | 7 | Aprender a combinar travessia, manutenção e combate |
| Pátio das Comportas | 960 → 3.008 px | 4 | 6 | Ler consequências dos registros e escolher uma aproximação |
| Passagem dos Respiros | 1.152 → 3.584 px | 4 | 5 | Observar pressão enquanto posicionamento e terreno mudam |
| Subida à Casa da Vazão | 1.344 → 3.648 px | 4 | 6 | Dominar saltos, transporte e apoios que não permitem esperar |
| Galeria dos Remendos | 704 → 2.432 px | 3 | 5 | Explorar abaixo da rota, atravessar e retornar à superfície |
| Câmara de Alívio | 736 → 2.400 px | 3 | 4 | Escolher manutenção ou execução no intervalo da água |

São 22 áreas novas e 33 inimigos, incluindo os seis guardas dos desvios altos. Largura é a dimensão do cenário, não a
distância efetivamente percorrida nem uma estimativa de duração. As oficinas
opcionais continuam menores que os percursos principais, mas agora desenvolvem
suas escolhas além da primeira demonstração.

## Travessia da Vala Seca

**Problema anterior.** As comportas explicavam bem a relação entre placa e
ponte, mas o percurso terminava depois da repetição. Sem inimigos, o jogador
nunca precisava mudar a aproximação enquanto lia os canais.

**Sequência atual.** A abertura mantém as duas comportas e os canais de
inspeção. Depois vêm Taipas Vivas, Registro do Arroz, Água entre Taipas e
Última Colheita. Primeiro, patrulheiros simples e um cascudo ocupam margens
largas. Uma ponte acionada por sentada exige observar o desembarque. Duas
grelhas de pressão independentes pedem duas decisões, separadas por uma ilha
seca. O encerramento combina arremessador, tablados e um canal real.

**Exploração e perigo.** Uma sequência alta oferece moedas e capacete, sem
substituir a rota principal. O cascudo resiste ao primeiro salto; a sentada
resolve sua couraça diretamente. Canais abertos causam queda; água ativa e
inimigos causam dano nativo. A última margem tem espaço antes da saída.

**Ajustes da segunda passagem.** O patrulheiro foi afastado do ponto seguro;
o arremessador anuncia a ação de frente; a saída ganhou margem suficiente
para terminar sem prender o ator no limite do mundo. A ponte permanece
erguida ao restaurar um checkpoint posterior, permitindo voltar.

## Pátio das Comportas

**Problema anterior.** A escolha A/B tinha interesse espacial, mas a duração
dependia muito da espera dos transportes. A recompensa alta era praticamente
o único desvio; uma vez entendido B, faltava um desenvolvimento da fase.

**Sequência atual.** As Docas de Serviço introduzem patrulha, couraça e salto
entre margens. A Comporta Central exige preparar uma ponte. O Retorno da Água
oferece duas respostas: ler o intervalo pelo piso ou subir aos apoios e fechar
o registro. A Doca do Arrozal combina desembarque, altura e arremesso.

**Exploração e perigo.** O percurso opcional A/B continua acessível e suas
moedas continuam registradas. As novas docas não exigem coletar todas as
moedas. O caminho alto tem vantagem concreta sobre a grelha; o caminho baixo
permanece possível por leitura de pressão. Os apoios antes e depois do canal
separam a preparação do salto da resposta ao inimigo.

**Retomada.** Um checkpoint nas docas posteriores restaura o fornecimento B
da primeira área. Isso evita chegar à nova saída com um requisito antigo
impossível de satisfazer. A ponte do trecho já vencido também fica aberta.

## Passagem dos Respiros

**Problema anterior.** A leitura da pressão já existia, mas quase todo o
trajeto era um corredor de grelhas. Depois de entender o ciclo, andar e
esperar resolvia a maior parte da fase sem mudar a estratégia.

**Sequência atual.** O Ritmo das Grelhas começa com duas descargas defasadas,
uma margem intermediária e uma patrulha após a travessia. A Oficina Suspensa
oferece um registro alto. As Taipas Partidas intercalam canais, inimigos e
uma nova grelha. O Último Respiro acrescenta arremessador, altura e uma
descarga final independente.

**Exploração e perigo.** Fechar um registro não desativa o bairro inteiro.
A rota alta pode passar acima da coluna máxima de água; sua altura foi
corrigida durante a revisão para que o apoio prometido seja realmente seguro.
O caminho baixo exige esperar antes de comprometer o salto. Os manômetros,
a água desenhada e a região que causa dano vêm do mesmo estado hidráulico.

**Retomada.** O arremessador foi recuado em relação ao último checkpoint.
O jogador pode observar a área sem receber uma descarga ou um barril no
momento de reaparecer. Cada nova grelha entra na leitura contextual do HUD.

## Subida à Casa da Vazão

**Problema anterior.** A subida, os telhados e o mirante tinham caminhos
alternativos, mas faltavam riscos que desenvolvessem a habilidade de saltar.
Esperar parado sobre os apoios era uma solução quase universal.

**Sequência atual.** Os Telhados da Vazão introduzem patrulhas e um canal.
O Guincho da Oficina ergue o tabuleiro até uma sacada mais alta, guardada por
um arremessador. Os Andaimes Vivos usam tábuas que cedem após o contato.
A Portaria da Vazão apresenta uma investida anunciada e termina num salto
entre margens.

**Exploração e perigo.** Os telhados antigos continuam sendo alternativa ao
elevador. No trecho novo, moedas e capacete motivam o apoio alto. Tábuas
rachadas têm uma aparência própria e realmente caem. O investidor permite
esperar a preparação, saltar e aproveitar a recuperação; o jogador também
pode escolher uma aproximação por cima.

**Ajustes da segunda passagem.** A placa do guincho foi movida para antes do
tablado, onde pode ser vista e acionada. O lado direito do guincho acompanha
a altura real da sacada. Um apoio inferior oferece recuperação local. O
cascudo foi afastado do checkpoint seguinte.

## Galeria dos Remendos

**Problema anterior.** Duas tampas e uma oficina inferior formavam uma boa
ideia de exploração, mas ainda pequena. Era possível decorar uma sequência
curta sem enfrentar uma variação que exigisse outra decisão.

**Sequência atual.** O Poço de Manutenção acrescenta uma tampa real, uma
parede de contenção e uma passagem por baixo. Três degraus permitem voltar.
A Oficina Ocupada combina arremessador, andaime e uma grelha. As Tábuas da
Galeria encerram o percurso com apoios frágeis e uma patrulha após o canal.

**Exploração e perigo.** A descida oferece moedas e reencontra o eixo do
percurso, sem um beco que exija morrer. O inimigo antes colocado sob a
parede foi movido para a margem de cima: a saída do túnel precisa aparecer
antes do contato. A câmera acompanha o piso de recepção do poço e mantém
o capacete abaixo da interface.

**Correção de geometria.** Uma fresta de um bloco junto à nova tampa permitia
ignorar a manutenção repetindo saltos. A tampa agora fecha todo o vão até a
parede. O caminho previsto continua completo pelos controles nativos.
Checkpoints posteriores restauram as aberturas antigas necessárias para
continuar, sem conceder vitória por apenas carregá-los.

## Câmara de Alívio

**Problema anterior.** Abrir a tampa ou conservar tampa e capacete era uma
escolha interessante, mas a inspeção terminava logo após a primeira grelha.
O restante da sala oferecia pouca oposição.

**Sequência atual.** O Ramal de Pressão tem registro próprio e um caminho
alto de manutenção. A Oficina do Retorno combina cascudo, canal e apoios.
A Saída do Coletor exige aproximar-se de um arremessador e atravessar a última
grelha, com um lugar seco para preparar a travessia.

**Exploração e perigo.** Abrir o alívio inicial não neutraliza os ramais
posteriores. É possível conservar a tampa original e concluir pelo intervalo,
ou escolher manutenção. O desafio opcional conserva seu histórico: perder
capacete, morrer ou reconstruir a tentativa não apaga o erro. As novas saídas
exigem concluir o percurso inteiro antes de oferecer outra rota.

**Retomada.** O último carregador foi afastado do checkpoint. Os testes
incluem continuar depois de perder o capacete: é preciso ler a água também
ao saltar de um tablado, sem depender de absorver dano para atravessar.

## Os dois chefes na curva de aprendizado

**Ossabravo** continua sendo a prova intermediária de preparação, investida,
salto e contra-ataque. A arena já tem seis pontos de vida, investidas simples
e duplas, ossos rasantes e quicantes, recuperação após erro e abertura de
costelas. O percurso anterior agora dá prática real de leitura de inimigos
e posicionamento, em vez de desembocar num chefe após apenas esperar água.

**Prefeito da Vazão** continua sendo a aplicação final de registros,
passarela, posicionamento e ataque por cima. As três etapas, carimbos,
ondas e frases de jatos foram novamente percorridas. A Subida desenvolve
preparação de apoios e decisões durante movimento antes desse encontro.

Os dois combates não foram alongados nesta rodada. Suas regras e arenas
foram revisadas no contexto da nova progressão e suas execuções completas
foram verificadas novamente. Aumentar seus pontos de vida apenas para
compensar fases vazias não resolveria o problema identificado.

## Clareza, justiça e integração

- Quatro silhuetas identificam patrulheiro, cascudo, arremessador e investidor.
  Couraça, barril carregado e preparação da investida mostram a diferença.
- Os inimigos usam as colisões e reações do jogo principal. A arte tem poses
  de passada, preparação, recuperação, couraça quebrada e derrota ligadas a
  esses estados. Movimento reduzido preserva os avisos de perigo.
- Os arremessadores e investidores novos vigiam a aproximação frontal.
  Eles não começam um ataque novo pelas costas depois de saírem da câmera;
  um ataque já anunciado mantém a direção comprometida.
- Pisos, tampas, tábuas frágeis e grelhas são desenhados a partir da geometria
  que participa da física. A câmera mostra pés e capacete nos seis percursos.
- As 22 áreas novas começam com um ponto de retomada. Foram observados dez
  segundos parado em cada um, seguidos de uma travessia sem dano até o fim.
- Correr para a direita, ou repetir sempre o mesmo salto, não conclui os
  novos percursos. Há uma rota executável sem dano em cada fase, mas ela
  exige outras ações ou decisões sobre os momentos de avançar.
- As recompensas são opcionais. A campanha só aceita a conclusão na saída
  nova; os cinco recibos principais, o desvio de abertura e as duas oficinas
  mantêm suas funções no mapa.

## Evidência e limite da avaliação

Na primeira expansão passaram 1.232 testes de Guaíra, 70 testes compartilhados de inimigos e
combate, validadores, TypeScript e build de produção. As oito cenas têm
capturas pelo renderizador real; os seis percursos maiores e os dois chefes
foram concluídos sem dano nas gravações selecionadas.

Os registros de entrada foram refeitos para atravessar as áreas novas.
Testes curtos da lição inicial foram separados dos testes de conclusão:
chegar à antiga saída já não conta como terminar a fase.

Esses ensaios verificam execução, perigo, leitura espacial e recuperação.
Não medem diversão nem tempo de descoberta. A calibração com primeiras
partidas deve observar onde o jogador para, qual perigo entende antes de
errar, quais desvios percebe, quanto repete entre checkpoints e quais
trechos escolhe jogar novamente. Não houve essa sessão com jogadores
externos; esta revisão não atribui uma certificação subjetiva de excelência.

[Capturas e percursos atuais](index.html#percursos) ·
[Resultados reproduzíveis](course-verification.json)
