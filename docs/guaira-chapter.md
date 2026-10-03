# Guaíra: capítulo experimental nesta sessão

Entrada dedicada: `/guaira-capitulo.html`. A página monta a maquete e uma cena
nativa por vez. Os experimentos livres continuam disponíveis em suas próprias
páginas; o capítulo não altera a campanha de seis regiões nem seu save.

## Jornada e resultados

A abertura é Travessia da Vala Seca ou Pátio das Comportas. Depois seguem Passagem
dos Respiros, Ossabravo, Subida à Casa da Vazão e Prefeito da Vazão. A escolha da
abertura fica fixada ao entrar na primeira tentativa. Reiniciar o capítulo
permite escolher novamente.

O contador de cinco trechos só aumenta quando o jogador conclui o objetivo real
e escolhe CONTINUAR ou MAPA. Os resultados vêm dos mesmos adaptadores jogáveis
dos experimentos: chegada ao fim, derrota de Ossabravo ou liberação da água pelo
Prefeito. Checkpoint, seleção, caminhada, chegada à placa e parâmetros de URL
nunca representam conclusão.

- CONTINUAR durante a pausa retoma a tentativa. Ao concluir, volta à maquete e
  recomenda o próximo trecho, sem iniciar outra cena automaticamente
- MAPA antes da conclusão abandona a tentativa atual. Depois da conclusão aceita
  o resultado, inclusive quando o jogador pausou; o movimento no mapa continua
  sendo uma escolha explícita
- TENTAR remonta uma tentativa nova do mesmo trecho. Resultados anteriores da
  sessão permanecem. Repetir um trecho concluído não duplica seu resultado
- JORNADA permite selecionar o próximo trecho ou repetir os já concluídos. Os
  demais explicam o predecessor. ENTRAR depende também da chegada física de Feka
- CHEGAR e movimento reduzido pulam somente a caminhada, nunca a fase

Conclusões duram apenas nesta página. Recarregar, sair ou voltar a uma página
restaurada pelo histórico inicia uma sessão vazia. Não há armazenamento local,
restauração por query string, novos selos de campanha ou migração de save.

## Desvio opcional pelo Bairro

JORNADA mantém seus cinco trechos e oferece à parte o Bairro da Vala Seca /
Galeria dos Remendos. A seleção caminha pela estrada existente; GALERIA só abre
o percurso após a chegada física e uma ação explícita. CHEGAR e movimento
reduzido não entram no jogo. A visita opcional está disponível antes do primeiro
trecho, entre trechos e depois de 5/5.

- BAIRRO retorna à maquete na mesma página, parado no Bairro e com GALERIA
  disponível para outra visita. Também funciona durante carregamento, erro,
  pausa, morte e conclusão local
- RETOMAR restaura a seleção obrigatória que estava retida, inclusive um replay
  já concluído; caminha até ela sem entrar automaticamente
- TENTAR cria uma Galeria nativa nova, descartando as tampas abertas e o
  checkpoint local. PAUSA / CONTINUAR só pausa ou retoma a Galeria
- Acesso de inspeção aberto é feedback local. Não há sexto resultado, selo de
  visita, histórico opcional ou mudança de recomendação e recibos
- Para fazer o desvio a partir de uma tentativa obrigatória, primeiro use MAPA.
  Essa ação continua aceitando o resultado real ou abandonando a tentativa
  incompleta; não suspende equipamento/checkpoint para retomá-los depois

Uma visita opcional antes do primeiro trecho não fixa a abertura. Falhas de
carregamento da Galeria oferecem TENTAR e BAIRRO; falhas da maquete oferecem
TENTAR sem apagar a sessão ou a chegada. O retorno interno não muda URL nem
histórico. Recarregar, sair da página ou restaurá-la pelo Voltar/Avançar do
navegador continua iniciando uma sessão vazia.

## Montagem e descarte

`GuairaChapterApp` possui a sessão e um escopo de visualização. Ao trocar de
cena, invalida a tentativa anterior e descarta seus controles, áudio, renderer,
input, observadores e frames antes de montar a próxima. Imports assíncronos
carregados depois de MAPA, TENTAR ou saída não podem criar um jogo tardio.

`GuairaChapterScenes` importa as classes nativas sob demanda; não importa os
entrypoints das páginas. Seu `sample()` relê o resultado no instante da ação.
`GuairaChapterSession` valida sessão, geração e tentativa. `GuairaChapterMapView`
cuida apenas da apresentação e chegada pela estrada autoral.

`GuairaChapterNavigation` separa o destino da maquete da seleção obrigatória.
Cada ação captura geração da sessão e revisão imutável da navegação; até
selecionar novamente o Bairro invalida ações antigas. `GuairaChapterExcursions`
carrega somente a classe nativa da Galeria, com identidade própria por tentativa
e sem adaptador de resultado. O host distingue os dois tipos de runtime,
registra o descarte antes de instalar controles e mantém a preferência de áudio
em memória. Imports concluídos com a página oculta começam pausados.

O capítulo reutiliza a imagem, máscara de água, poses e controles bitmap
existentes. Não adiciona texturas. O orçamento do output continua em
45.000.000 bytes e o filtro de originais dispensáveis da publicação permanece
em vigor.

## Evidências e limites

Os testes de sessão exercitam sequências repetidas e inválidas. Os de maquete
usam pintura e estrada reais com fronteiras DOM/canvas substituídas. A jornada
nativa executa os replays reais das duas aberturas até o Prefeito com o Player e
Input de produção, incluindo uma derrota natural, pausa, abandono, replay e
descarte. Nenhuma vitória é obtida escrevendo flags de conclusão.

Os testes do host usam fábricas nativas e injetam resultados de forma explícita
para provar preservação dos mesmos recibos, seleção e recomendação em 0/5, 1/5
e 5/5 nas duas aberturas. Essas fixtures não provam vitória jogada. O mesmo
harness verifica revisões obsoletas, imports tardios, tentativas repetidas,
retorno durante carga, falhas parciais e descarte de recursos.

Essas provas não equivalem a jogar todo o capítulo em um telefone físico. O gate
de navegador deve registrar separadamente foco/modal, entrada e retorno,
repetição, pausa, saída, histórico e composição compacta. A dificuldade humana
dos experimentos continua em avaliação; o capítulo organiza suas regras atuais.
