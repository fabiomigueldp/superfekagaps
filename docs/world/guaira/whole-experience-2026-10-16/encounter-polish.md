# Guaíra — escolhas e combinações nos desfechos

Revisão de 17/10/2026, após o trabalho de [risco, descidas e retomadas](route-clarity.md).

## Diagnóstico

A revisão percorreu as seis fases desenvolvidas e observou os encontros através
dos controles nativos. As rotas já contêm canais, inimigos, manutenção e desvios,
mas alguns encerramentos ainda separavam demais as decisões: superar um
arremessador, atravessar uma grelha e chegar à bandeira. Repetir essa estrutura
não desenvolvia suficientemente o tema da fase.

Os Respiros e a Câmara de Alívio receberam novos desfechos nesta rodada.
A Bacia das Bombas desenvolve o transporte e o controle da aterrissagem.
A Contrapressão desenvolve a leitura de ciclos independentes e a opção de
intervir na instalação. As duas áreas acrescentam 672 pixels ao respectivo
cenário, com um ponto seguro de entrada em cada uma.

## Bacia das Bombas — Respiros

A doca alta e a passarela de serviço oferecem duas respostas ao mesmo canal.

- **Transporte:** subir à doca, aguardar a chegada, embarcar, acompanhar a
  travessia e desembarcar na sacada da outra margem. O motor nativo controla
  aceleração, parada, retorno, transporte do passageiro e rotação das rodas.
  O percurso custa espera, mas evita permanecer sobre a madeira frágil.
- **Passarela:** atravessar três apoios rachados, ajustando os saltos para
  aterrissar antes do próximo vão. É uma alternativa mais rápida e com moedas
  junto aos apoios. Permanecer parado causa ruptura e queda real.
- **Chegada:** a sacada permite observar a margem antes de descer. O cascudo
  ocupa a área seguinte, com espaço entre a borda do canal e sua patrulha.

O primeiro desenho deixava a tábua central 16 pixels abaixo das demais.
A inspeção das capturas mostrou que ela desaparecia sob a tela durante parte
do salto. Os apoios foram alinhados e passaram a participar da antecipação da
câmera. Isso preserva a exigência de controlar a aterrissagem sem depender de
um destino oculto.

Trilhos e carro usam o desenho compartilhado dos transportes do jogo. Seus
suportes terminam nas margens reais. A alvenaria da bacia, a casa da bomba e o
reservatório contextualizam a instalação; a madeira com rachaduras continua
distinta dos apoios fixos.

## Contrapressão — Câmara de Alívio

As duas saídas de água mantêm ciclos defasados. O piso entre elas e seu apoio
alto permitem dividir a travessia em decisões menores.

- **Pelo piso:** observar a primeira descarga, avançar ao intervalo central,
  ler a segunda grelha e preparar a aproximação ao arremessador.
- **Pela manutenção:** subir pelos apoios, enfrentar a couraça e acionar o
  registro elevado com a sentada. Ele fecha apenas a segunda grelha; a primeira
  conserva seu ciclo. A descida encontra um apoio antes do combate final.

O registro, a tubulação e a segunda grelha formam uma conexão visível.
Reservatórios recuados dão identidade à sala sem receber bordas que pareçam
plataformas. A sinalização foi reposicionada para deixar livre a silhueta do
jogador. Avisos imediatos de água, arremesso ou couraça mantêm prioridade sobre
a orientação geral da sala.

## Conferência

- Quatro percursos completos desde o início: duas alternativas em cada fase.
- Quatro tempos de chegada em cada alternativa: 16 execuções sem dano.
  O transporte foi realmente embarcado; a manutenção realmente derrotou seu
  guarda e fechou a segunda saída. A rota pelo piso manteve as duas ativas.
- Queda intencional por permanência na passarela, seguida de morte, retorno ao
  checkpoint conquistado e nova conclusão sem dano.
- Os checkpoints das seis fases desenvolvidas continuam conferidos após espera
  e em sua continuação até o fim. Onze gravações existentes foram estendidas,
  preservando os comandos anteriores e os objetivos opcionais da abertura.
- Teclado, toque simulado, movimento reduzido e pausa conferidos nas quatro
  alternativas. A pausa congela tanto a imagem quanto o estado do transporte,
  da água e do jogador.

Os vídeos de desfecho são recortes de execuções completas; os dois vídeos
completos correspondentes também foram atualizados. Resultados da suíte,
build, navegação da campanha e identificação dos arquivos estão em
[encounter-verification.json](encounter-verification.json).

Alguns testes anteriores fixavam o total antigo de moedas, inimigos,
mecanismos e checkpoints. Esses valores foram atualizados para o novo
percurso. As exigências de conclusão nativa, ausência de dano obrigatório,
objetivos da tampa inicial, isolamento de saves e pausa continuam presentes.

São percursos ensaiados e verificações automatizadas, acompanhados de inspeção
visual. Eles não medem descoberta, preferência entre as rotas ou diversão numa
primeira partida. A calibração dessas qualidades pede observação de jogadores
sem conhecimento prévio das soluções.
