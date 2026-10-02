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

## Montagem e descarte

`GuairaChapterApp` possui a sessão e um escopo de visualização. Ao trocar de
cena, invalida a tentativa anterior e descarta seus controles, áudio, renderer,
input, observadores e frames antes de montar a próxima. Imports assíncronos
carregados depois de MAPA, TENTAR ou saída não podem criar um jogo tardio.

`GuairaChapterScenes` importa as classes nativas sob demanda; não importa os
entrypoints das páginas. Seu `sample()` relê o resultado no instante da ação.
`GuairaChapterSession` valida sessão, geração e tentativa. `GuairaChapterMapView`
cuida apenas da apresentação e chegada pela estrada autoral.

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

Essas provas não equivalem a jogar todo o capítulo em um telefone físico. O gate
de navegador deve registrar separadamente foco/modal, entrada e retorno,
repetição, pausa, saída, histórico e composição compacta. A dificuldade humana
dos experimentos continua em avaliação; o capítulo organiza suas regras atuais.
