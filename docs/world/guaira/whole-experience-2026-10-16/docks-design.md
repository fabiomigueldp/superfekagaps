# Guaíra — armazém e cais de transbordo

Revisão de 17/10/2026. Continuação da revisão dos percursos, após a Bacia das Bombas e a Contrapressão. [Ver as gravações](index.html#docas).

## Diagnóstico e alteração

Os finais da Travessia e do Pátio repetiam tablado, arremessador e canal. O cenário genérico também fazia encontros diferentes parecerem o mesmo lugar. A revisão preserva as lições iniciais e trabalha a combinação dessas lições no fim de cada fase.

Na **Travessia**, o Terreiro da Colheita oferece duas aproximações. O caminho baixo enfrenta o carregador e cruza dois canais, com uma taipa firme entre os saltos. O caminho alto sobe ao armazém, enfrenta uma couraça e atravessa uma tábua frágil para alcançar mais moedas. Não há porta artificial exigindo derrotar os inimigos: a geometria permite lutar, esquivar e escolher a aproximação. A saída alta desce por degraus contíguos; há chão livre antes da patrulha final.

No **Pátio**, o Cais de Transbordo desenvolve a leitura dos elevadores. Dois motores alternam a altura; o jogador embarca, alcança uma ilha fixa, observa o segundo movimento e desembarca numa doca com escada. A ilha permite parar sem tomar dano. O cais tem um novo checkpoint antes da travessia, e os apoios ausentes continuam sendo quedas reais. Os dois elevadores usam transporte, colisão, aceleração, parada e animação nativos do jogo.

| Fase | Largura anterior | Atual | Inimigos atuais | Alteração principal |
| --- | ---: | ---: | ---: | --- |
| Travessia | 4.032 px | 4.352 px | 8 | Dois canais e alternativa pelo armazém |
| Pátio | 3.008 px | 3.840 px | 7 | Dois elevadores, ilha de transferência e doca |

As seis fases desenvolvidas somam agora 38 inimigos comuns, 25 distritos e 25 checkpoints acrescentados às lições originais. Essas quantidades descrevem o conteúdo; não são uma medida de diversão.

## Duas correções durante a revisão visual

O primeiro desenho do cais deixava a ilha abaixo do elevador. No ápice de um salto completo, Feka e o destino não cabiam juntos na altura útil da tela. A ilha e a doca foram elevadas até a altura superior de transferência. Os testes agora verificam a superfície de chegada durante os saltos, além de manter o capacete e os pés visíveis.

A primeira saída do armazém também convidava a saltar entre apoios cada vez mais baixos. Ela foi substituída por uma escada contínua. O jogador pode descer andando, e a câmera antecipa os próximos degraus e a margem. O mesmo desenho é usado no desembarque do cais.

Os prédios repetidos foram removidos das áreas dos novos encontros. Madeira, depósito de arroz, sacos, estacas, alvenaria e água em plano de fundo explicam o uso do lugar. Os pilares e mecanismos se ligam ao terreno real. Bordas claras indicam apoios físicos; fundos e ferragens permanecem atrás dos personagens. As roldanas e os cabos seguem o movimento real dos elevadores. Movimento reduzido conserva os avisos e o movimento necessário para jogar.

## Conferência e reprodução

- Três percursos completos desde o início: Travessia baixa, Travessia alta e Pátio com transbordo. Todas as ações usam os controles nativos; não há edição de posição, relógio ou inimigos nas gravações.
- Quatro tempos de chegada para cada percurso, totalizando 12 execuções concluídas sem dano. Na Travessia, as abordagens enfrentam defensores diferentes. No Pátio, os dois motores transportam o jogador e a ilha separa os embarques.
- Duas falhas provocadas por controles: permanecer na tábua frágil e sair do elevador fora do apoio. Ambas causam morte real, retorno ao checkpoint conquistado e continuação sem dano.
- Dez segundos de observação na ilha central, seguidos de nova travessia com o motor em outra fase.
- As gravações existentes foram refeitas a partir da aproximação alterada, mantendo os comandos anteriores a ela. Os testes de lições, desvios, recuperação, campanha e progressão continuam verificando o conteúdo inicial.
- Teclado, toque simulado, movimento reduzido e pausa conferidos no navegador. A campanha normal percorre as oito cenas, com progresso, retorno ao mapa e liberação da Serra.

Os resultados, hashes dos arquivos e contagens da suíte estão em [docks-verification.json](docks-verification.json). As execuções de controles e campanha estão em [docks-surface-verification.json](docks-surface-verification.json) e [docks-campaign-verification.json](docks-campaign-verification.json).

Os auxiliares `record_guaira_docks.ts` e `guairaDockController.ts` são ferramentas de QA, não assistência de jogo. A implementação de produção usa os mesmos sistemas de física e controle do restante da campanha. Os testes específicos estão em `tests/guaira-dock-crossings.test.ts`.

## Limites

As gravações são ensaiadas. Elas demonstram travessias viáveis, consequências de erro, leitura dos apoios e recuperação; não medem descoberta, curva de aprendizagem ou diversão em uma primeira partida. Toque e Gamepad API foram simulados, sem ensaio em hardware físico. As gravações das quatro outras fases e dos chefes foram mantidas das rodadas anteriores; a progressão integrada foi conferida novamente. O modelo 3D da ilha não foi alterado nesta rodada.
