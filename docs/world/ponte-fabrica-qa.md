# QA da ligação Porto–Fábrica

Revisão de 1 de outubro de 2026. O primeiro candidato integrado é `3a93e232eb1870a38574c52b525f9e34dfac00b6`; a revisão seguinte restringe as placas de partida à região ativa no close, preservando as quatro direções no panorama.

## Contrato e regressões locais

- 320 testes TypeScript e 3 testes do servidor aprovados; validadores de fases, sprites e campanha, ambos os projetos TypeScript e build de produção aprovados
- Porto e Fábrica usam as posições fixas e os percursos auditados em `diorama/port-factory-bridge.md`; a ponte aberta acompanha o desbloqueio existente de `3-1`
- Costa→Fábrica percorre o barco, desembarque, Porto e ponte sem persistir as fases intermediárias. A ponte usa caminhada normal; só a travessia marítima muda o cais do barco
- Falhas, dimensões incorretas e respostas tardias da Fábrica não desativam a ligação Costa↔Porto. Geometria nova só é aplicada numa chegada segura
- Reversão, troca rápida de destino, Pular, movimento reduzido, recarregamento e entrada explícita conservam os IDs e o formato de save
- Alvos nativos separados em 320×568, 400×606, 590×378 e 740×320; a placa FÁBRICA tem 128×56 e cabe o acento na face, sem alterar as sete imagens de placas já publicadas
- O carregamento inicial da Costa não solicita a Fábrica. Ela carrega quando solicitada, no panorama ou numa visita ao Porto com a ponte já desbloqueada

## Exercitado no navegador

Chrome na origem de prévia da branch `feat/connected-coast-port`, com save inteiramente sintético limitado a essa origem. Nenhum save de teste foi importado na produção.

- Bundle `index-CM89DFFt.js` confirmado contra o primeiro candidato
- Importação pelo seletor de arquivos real confirmou sucesso
- Travessia completa Porto→Fábrica e retorno pela ponte; Feka fica visível no centro do piso e as placas ficam ocultas durante o movimento
- Enter durante a caminhada permanece no mapa; Pular chega sem iniciar gameplay
- Entrada real em `3-1 Recebimento de Barris`, pausa e retorno mantêm a chegada em `3-1`
- Duas mudanças de direção pelo teclado durante a ponte conservaram a caminhada; Pular concluiu em Porto
- Recarregar durante o retorno na ponte restaurou `3-1`, a última chegada confirmada
- Panorama de três regiões e closes inspecionados em 1180×757 e 590×378 pixels CSS. O tamanho estreito foi obtido por zoom de 200%, não por um aparelho com toque

## Correções da revisão

O destino final Fábrica fazia a câmera omitir os limites do barco durante uma viagem direta desde a Costa. A câmera agora acompanha o barco enquanto a aresta ativa é marítima, independentemente do destino final.

Uma prévia bloqueada da Fábrica a partir de um save posterior misturava coordenadas locais e de atlas; agora ela usa o atlas e deixa Feka fora da vista quando ele está em outra região. A recuperação após falha da ponte também preserva o cais real do barco e evita embarque do lado onde ele não está.

A inspeção em 590×378 revelou que a placa de ida do Porto reaparecia junto à chegada na Fábrica. Os closes agora mostram somente as partidas da região ativa; o panorama conserva as direções de ambas as pontas.

## Limites

Falhas de carregamento, respostas tardias e preferência de movimento reduzido foram exercitadas nos testes automatizados; não foram induzidas no navegador. Não foram medidos FPS nem toque físico. A ponte tem estados estáticos levantado e baixado, sem animação intermediária.

Os assets novos da Fábrica e da ponte somam 253.152 bytes; a placa opcional usa 7.798 bytes de imagem mais 1.135 bytes de metadados. Os arquivos de autoria são reproduzíveis e ficam fora do carregamento do jogo. Não há save de teste, captura de QA, arquivo Blender ou implantação Oracle no produto.
