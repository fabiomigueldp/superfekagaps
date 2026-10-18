# Guaíra — controles da água

Revisão de 18/10/2026. [Comparação visual e animações](index.html).

## Continuação — resposta dos controles

A segunda rodada está no [seletor de partidas reais](index.html#resposta). Os 11 controles dos percursos ampliados agora dão retorno específico sobre o mecanismo que alteram. O aviso de ponte pronta exige a chegada exata do tabuleiro; subir e descer continuam indicados como movimento. Na Subida, essa informação permanece na beirada e no apoio de espera, mesmo depois de terminar a breve resposta à sentada.

Cada registro identifica a saída controlada e o caminho de retorno: o registro da Galeria fecha a grelha acima e à esquerda, mas a saída do túnel fica nos degraus à direita. A contrapressão informa que somente a segunda grelha foi fechada. Perigos imediatos, arremessos e tábuas cedendo continuam acima desse retorno na prioridade dos avisos. Reabrir uma saída produz uma indicação de cuidado e preserva o aviso nativo antes da descarga.

O manômetro da saída isolada repete o símbolo de filetes interrompidos do pedal. O traço simples continua identificando o intervalo seco de um ciclo. A distinção depende também da forma, permanece com movimento reduzido e não altera o limite perigoso da água.

As conexões dos 11 controles usam trajetos contínuos em coordenadas do mundo. Nas ligações curtas da Galeria e da contrapressão, as braçadeiras foram transferidas para trechos verticais reais; antes, uma ficava além da curva. O vidro permanece contínuo pelos cotovelos e pelas abraçadeiras. O ponto de alimentação da ponte continua preso ao guincho enquanto o tabuleiro se move.

O [levantamento nativo](response/native-verification.json) registra aproximação, sentada e resposta dos 11 mecanismos, em seis fases. Nove percursos completos terminaram sem dano. Dois percursos adicionais, nos Respiros e no Alívio, verificam o acionamento e a volta ao piso sem dano, encerrando ali a observação; eles não são provas de conclusão dessas duas fases. Nenhuma dessas capturas altera posição, câmera, relógio, terreno ou colisão. Os estudos de encaixes são composições preparadas, identificadas separadamente.

Oito testes adicionais verificam continuidade de todos os canos, apoio das braçadeiras, ancoragem durante a subida da ponte, novo estado dos manômetros, confirmação exata da ponte, efeito no corredor superior, prioridade dos perigos e permanência da informação no apoio da Subida. A suíte desta rodada concluiu com **3.778 aprovados, uma exclusão opcional e zero falhas**. O build, as duas verificações de tipos e os três testes JavaScript passaram. A campanha normal concluiu nove execuções no navegador; as 33 capturas foram conferidas em telas de 1440 e 390 px, sem erros. Os [resultados desta continuação](response/verification.json) separam os testes, capturas e verificações no navegador dos resultados da primeira rodada abaixo.

Reprodução adicional:

```powershell
node --import tsx --test tests/guaira-control-response.test.ts tests/guaira-respiros-art.test.ts
node --import tsx scripts/prove_guaira_control_response.ts OUTPUT CAMINHO_DO_CANVAS
```

Os três novos percursos usam `tests/helpers/guairaControlResponseReplays.json`; os demais reutilizam as partidas já verificadas. Evidências locais: `output/guaira/control-response-2026-10-18`.

## Primeira rodada — aparência e posicionamento

Foram analisados os 18 pedais de sete cenas e a tampa hidráulica da Câmara de Alívio. Ossabravo não possui um controle de água acionado pelo jogador; sua partida entrou na verificação de integração do capítulo.

## Problemas encontrados

- Os pedais originais, os registros dos percursos ampliados, o seletor A/B e os controles do chefe tinham acabamentos e sinais diferentes.
- O símbolo `✓` dos registros ampliados não existe na fonte e aparecia como `?`. Além disso, o estado do botão não explica se uma ponte já chegou ao destino.
- A indicação A/B não distinguia, no próprio pedal, o ramal fornecido do pedido durante os 400 ms de transferência.
- O registro C ocupava todo o seu apoio de 32 px. Outros três controles opcionais ficavam na extremidade de apoios de 48 px.
- A tampa de alívio compartilhava a aparência de tijolos quebráveis comuns, apesar de controlar a pressão.
- Os novos mostradores inicialmente coincidiam com moedas e duas placas de exploração. A inspeção de todas as posições identificou e corrigiu essas sobreposições antes da versão final.

## Implementação

`GuairaControlArt.ts` contém o pedal comum: sola escura, latão, rebites, face esmaltada e janela de resposta. A face comprime em três posições e retorna em 160 ms, usando `changedAt` e o relógio nativo. A base permanece dentro do corpo físico de 28 ou 32 × 8 px. Movimento reduzido conserva uma pose estável e todas as informações funcionais.

Os mostradores são pequenos objetos presos ao pedal. A miniatura da ponte acompanha a altura real do tabuleiro; a confirmação exige a chegada ao destino. Os registros mostram filetes interrompidos por uma trava ao isolar a saída. Um intervalo seco do jato não é confundido com isolamento. As setas indicam a direção do alvo, incluindo o retorno à esquerda na Galeria e na eclusa.

No Pátio, a letra principal permanece sendo o ramal fornecido. Durante a transferência, o pedido aparece ao lado, com aviso âmbar. No Prefeito, a base comum conserva os sinais específicos de disponibilidade, subida, travessia e espera durante a contrapressão. Os registros da arena não receberam placas altas que pudessem encobrir a faixa perigosa.

A tampa hidráulica mantém barro, rachaduras e colisão integral, com um selo esmaltado de alívio. Cada selo desaparece com seu próprio tijolo. O rompimento e os fragmentos continuam usando o sistema nativo.

## Composição e percursos

| Local | Ajuste |
| --- | --- |
| Respiros, registro C | Apoio de 32 para 64 px, com 16 px de preparação em cada lado; moedas enquadram o pedal. |
| Pátio, registro do retorno | Apoio superior de 48 para 64 px, acrescentando 16 px na aproximação. |
| Respiros, oficina suspensa | Mesmo espaço lateral; placa do desvio deslocada 20 px sobre seu apoio real. |
| Alívio, ramal independente | Mesmo espaço lateral; placa do desvio deslocada 20 px. |
| Registros restantes dos percursos | Oito moedas elevadas acima dos mostradores, preservando identificadores e o alcance pelos percursos verificados. |

Todos os pedais têm apoio sob a largura inteira. Os quatro apoios revistos têm um ladrilho livre em cada lado; as placas deslocadas continuam fisicamente apoiadas. Os guardas das rotas de manutenção continuam participando dos encontros. As conexões agora são pintadas antes dos mecanismos, incluindo os retornos à esquerda, para não atravessarem seus mostradores.

## Verificação

Os [resultados consolidados](verification.json) registram testes, build e conferência no navegador. Sete testes novos verificam o estado real das pontes e dos jatos, animação e limites dos pedais, movimento reduzido, apoio e clareza dos 18 controles, quatro aproximações e desaparecimento individual dos selos.

Os [oito percursos nativos](native-verification.json) terminaram sem dano, com a mesma duração e o mesmo total de moedas da referência. Foram comparados 183 estados amostrados. Um estado de Respiros mudou com o novo apoio; os outros 182 mantiveram posição, câmera e demais campos registrados. A [campanha normal](campaign-verification.json) concluiu nove execuções no navegador, com entrada pelo mapa e visita às fases opcionais.

Os vídeos são estudos preparados de arte, com o acionamento nativo em 1 s e o rearme em 5 s. As posições iniciais e a câmera são escolhidas para inspeção; os percursos reais estão documentados separadamente. O quadro de acabamento do Prefeito usa repouso; seus 64 estados de combate aparecem no levantamento nativo.

Essa revisão melhora a consistência e a legibilidade demonstradas pelas capturas e pelos testes. A compreensão espontânea por alguém que nunca jogou ainda precisa de observação em uma primeira partida.

## Reprodução

```powershell
node --import tsx --test tests/guaira-controls.test.ts tests/guaira-junction-feedback.test.ts tests/guaira-traversal-guidance.test.ts tests/guaira-clay-impact.test.ts
npm run build
```

`scripts/prove_guaira_interactables.ts` recebe saída, caminho de `@napi-rs/canvas` e baseline. `scripts/prove_guaira_chapter_readability.ts` verifica as partidas completas. `scripts/verify_guaira_controls_review.cjs` verifica os seis vídeos e os sete quadros, em 1440 e 390 px. `scripts/verify_guaira_chapter_readability.cjs` verifica a campanha normal em um servidor com `VITE_DEVELOPMENT_UNLOCKED_SAVE=false`.

O baseline e os logs desta rodada estão na pasta local ignorada `output/guaira/interactables-2026-10-17`; o trabalho começou em 17/10 e foi concluído em 18/10.
