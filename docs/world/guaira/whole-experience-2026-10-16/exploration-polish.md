# Guaíra — exploração em altura e leitura dos percursos

Continuação desta rodada: [risco legível, contato das tábuas, descidas e novas tentativas](route-clarity.md).

Revisão concluída em 17/10/2026, continuando a expansão das seis fases.
Este documento descreve a rodada de exploração. O diagnóstico da expansão
está em [course-design.md](course-design.md).

## O problema encontrado

A extensão anterior acrescentou 22 áreas e perigos reais, mas boa parte do
percurso ainda se concentrava no chão. Alguns apoios altos ofereciam apenas
uma moeda ou um capacete e terminavam rapidamente. Era possível identificar
o caminho principal, mas havia poucas razões para investigar a arquitetura.

Havia também problemas de leitura: a câmera favorecia a direita mesmo ao
retornar, um aviso de água distante podia esconder a preparação de um
arremessador próximo, e a interface podia alertar sobre uma grelha abaixo de
uma viga segura. As conexões hidráulicas dos trechos novos tinham segmentos
sem terminação e não contornavam corretamente um acionamento elevado.

## As seis escolhas novas

| Fase | Desvio | Decisão e recompensa | Retorno |
|---|---|---|---|
| Travessia | Varanda do Arroz | Continuar a subida existente, atravessar duas varandas e enfrentar uma couraça; três moedas | Apoio a 128 px de altura, depois margem e checkpoint |
| Pátio | Passadiço das Docas | Cruzar docas em níveis diferentes; escolher entre manter a margem e enfrentar a patrulha alta; três moedas | Dois patamares de descida e checkpoint antes do registro |
| Respiros | Ponte do Reservatório | Continuar acima da grelha; atravessar tábuas frágeis e enfrentar uma couraça; três moedas | Patamar intermediário antes das taipas partidas |
| Subida | Beiral da Portaria | Escolher a investida no piso ou a sequência de apoio frágil e patrulha no beiral; três moedas | Sacada existente e margem antes do último canal |
| Galeria | Viga de Inspeção | Desenvolver o andaime da oficina por cima do respiro, com uma tábua frágil e patrulha; quatro moedas | Duas descidas, checkpoint e início das tábuas da galeria |
| Alívio | Alto do Coletor | Subir pelo registro, continuar sobre o coletor e atravessar um apoio estreito; quatro moedas | Dois patamares levam ao checkpoint antes do cascudo |

São seis desvios, seis guardas e vinte moedas adicionais. As fases mantêm as
larguras da expansão: o conteúdo novo desenvolve altura, aproximação e retorno.
O capítulo passa a ter 33 inimigos comuns nesses seis percursos. Os desvios
usam as plataformas, couraças, dano, sentada, pickups e plataformas frágeis
do motor nativo.

## Segunda passagem: aterrissagem, descida e retomada

A primeira versão do passadiço colocava a patrulha muito perto da chegada de
um salto ascendente. A sacada foi alargada para separar aterrissagem e combate.
Na Subida, o guarda alto foi afastado da trajetória do salto usado para evitar
a investida no chão. As gravações anteriores continuam atravessáveis sem dano.

Outra revisão encontrou descidas grandes cujo chão não aparecia na tela.
Foram acrescentados oito apoios de retorno, com desníveis de 48 a 80 pixels,
além da sacada existente da Subida. A câmera antecipa o próximo apoio e limita
o movimento adicional dessa antecipação a seis pixels por atualização. O
enquadramento mantém o corpo e o capacete visíveis; a câmera pode acompanhar
mais rapidamente uma queda quando isso é necessário para conservar o ator.

Três checkpoints foram deslocados dentro das áreas seguras para receber
também quem desce dos desvios: Pátio, Galeria e Alívio. Todos os 22 pontos
novos da expansão foram novamente conferidos parados e em percursos de saída.
Os controles gravados para as 25 rotas anteriores permanecem os mesmos;
algumas coletas esperadas mudaram porque agora há moedas nas trajetórias altas.

## Apresentação integrada

- Os caminhos altos têm estruturas próprias: armazém de arroz, estacas das
  docas, reservatório rebitado, portaria, ferramental de inspeção e coletor.
  Pilares e contraventamentos pertencem às plataformas que realmente existem.
- Setas de subida com moeda identificam exploração opcional. As descidas têm
  marcas discretas sob os apoios. Os capitéis claros continuam indicando os
  pisos físicos; o cenário de fundo usa valores mais suaves.
- A câmera olha para trás depois de um deslocamento sustentado. Uma pequena
  correção de posição não provoca uma troca brusca de direção.
- Os avisos consideram distância, altura e fase real dos perigos. A preparação
  próxima de um inimigo tem prioridade sobre uma grelha distante; água abaixo
  da passarela não substitui a orientação da rota alta.
- Os registros novos têm conexões contínuas, curvas nos dois sentidos,
  encaixes nos mecanismos e uma animação de fluxo ao longo da conexão inteira.
  A pausa usa o relógio do jogo; movimento reduzido conserva a leitura dos estados.

## O que a conferência demonstra

As seis rotas altas foram percorridas desde o início da fase, com entradas
nativas, todas as vinte moedas novas, os seis guardas vencidos e chegada ao
fim sem dano. Há verificações de enquadramento, visibilidade do próximo apoio
na descida, avisos simultâneos, retorno da câmera e pintura sem alteração do
estado do jogo. Teclado e toque simulado foram conferidos no navegador, com
pausa estável pixel a pixel e movimento reduzido.

As gravações são execuções ensaiadas, com simulação a 60 Hz. Seus tempos não
estimam uma primeira partida. Testes automatizados comprovam os contratos
verificados; descoberta, preferência de rota e dificuldade percebida ainda
precisam ser calibradas com primeiras partidas de jogadores externos.

Os resultados, dimensões e hashes da versão conferida estão em
[exploration-verification.json](exploration-verification.json). Os vídeos e
capturas atuais estão na [página integrada](index.html#percursos).
