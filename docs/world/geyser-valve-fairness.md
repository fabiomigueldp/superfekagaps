# Repressurização de válvulas: patch mecânico separado

## Problema reproduzido

Na versão anterior, um jato fechado às 1000 ms e reaberto às 2000 ms volta imediatamente à coluna cheia do relógio global. O aviso de 800 ms desaparece. A primeira válvula da Reserva Gelada (5-2) e mecanismos importados com esse vínculo estão sujeitos a isso.

## Mudança

Uma reabertura efetiva **pelo acionador manual** reinicia a máquina no começo de seu aviso de pressão. A abertura mantém o período configurado, incluindo sua proporção de aviso, e passa a ter cadência local previsível. Fechar continua retirando o perigo imediatamente. O debounce de 400 ms do acionador não muda.

Não há novos danos, ampliação de hitbox, velocidade maior, mudanças de layout ou aceleração de ciclo. Máquinas que nunca foram desligadas preservam integralmente o relógio e os offsets autorais. O som de pressão ocorre uma vez após a reabertura próxima ao jogador; o desenho e a colisão usam o mesmo relógio.

## Integração

Este patch é deliberadamente separado do polimento visual. Acrescenta `jetCycleTick` em `WorldMachineState`, usa-o na apresentação do gêiser e adiciona `jetOpenedAt` somente no acionador manual, além de uma condição no ramo **jet** de `WorldPhysics`. Não altera o ramo **launcher**, barris ou canhões. O timestamp genérico `changedAt` não controla a repressurização: Calabrezzo continua usando seu próprio reset de fase, incluindo o repouso inicial de 1000 ms.

Como o contrato de simulação é compartilhado, a regra também se aplica a um queimador que seja controlado por válvula em uma fase importada. Os queimadores normais sem alternância e seus offsets não mudam.

`tests/world-geyser-valves.test.ts` cobre reabertura no perigo antigo, janela completa, som único, novo período estável, períodos customizados, offset negativo, debounce, fechamento imediato, relógios não tocados e resets reais dos chefes 3-5/5-5.
