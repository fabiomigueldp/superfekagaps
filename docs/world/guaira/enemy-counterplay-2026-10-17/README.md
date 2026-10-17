# Guaíra — defesas e oportunidades de contra-ataque

Rodada de 17/10/2026, continuação da [revisão das seis famílias](../enemies-2026-10-17/README.md). [Vídeos e comparação visual](index.html).

## O que faltava

O vagonete tinha aceleração e rodas próprias, mas um pisão o derrotava em qualquer ponto da patrulha. A pausa nas pontas tinha pouco valor para o combate. O investidor tinha tempos físicos diferentes, mas a recuperação quase repetia a silhueta de proteção. Os avisos também filtravam inimigos por uma diferença de altura menor que 64 pixels: o beiral da Portaria e a quicada sobre a couraça podiam esconder uma abertura do HUD, embora o inimigo continuasse visível logo abaixo.

## Revisão implementada

O teto do vagonete agora protege contra pisões comuns enquanto ele anda. O contato rebate Feka com a resposta nativa de golpe bloqueado, sem retirar vida do inimigo. Nas pontas, a mesma pausa física de 550 ms abre as chapas e expõe o piloto a um pisão. A sentada vence a proteção em movimento. O contato lateral continua causando dano em ambos os estados.

As chapas articuladas, a suspensão e as pernas recolhidas distinguem o veículo. A barra verde mede o tempo restante da abertura, em vez de parecer a preparação de um golpe. As rodas continuam ligadas à distância; o resíduo de frenagem dura 150 ms e usa o relógio da simulação. Movimento reduzido mantém as indicações e remove o resíduo e a cintilação do golpe bloqueado.

O investidor abaixa o corpo em três poses durante os 800 ms de preparação. Depois da corrida, a testa exposta e as placas abertas mostram a oportunidade de ataque durante os mesmos 1.400 ms de recuperação. A postura volta a subir por etapas. Seus tempos, trajetória e colisão não foram alterados nesta rodada.

O aviso passa a reconhecer uma abertura próxima abaixo do jogador, até 112 pixels de diferença entre os pés, desde que o inimigo esteja visível e a menos de 96 pixels na horizontal. Isso se aplica à couraça atordoada, ao investidor em recuperação e ao vagonete freando. Outros inimigos conservam o filtro do piso em que o jogador está.

A regra do teto é uma variante explícita dos inimigos de Guaíra no `WorldFoe`. A física, o pisão, a quicada, a sentada, o som de bloqueio e as regras de dano continuam sendo os do jogo. A posição dos inimigos, as plataformas, as moedas e os checkpoints não foram modificados.

## Percursos conferidos

| Encontro | Resposta executada | Contato observado a 60 Hz |
| --- | --- | --- |
| Couraça na Travessia | Dois pisões, usando a quicada do primeiro | Quebra no passo 87; derrota no 115, durante o atordoamento |
| Investidor da Portaria | Salto para o beiral, saída pela borda e queda sobre a testa | Derrota no passo 137, aos 350 ms de recuperação |
| Mexedor do Registro das Taipas | Espera na margem firme; salto após o recolhimento | Derrota no passo 222, aos 367 ms de descanso |
| Vagonete na freada | Salto curto sobre o piloto exposto | Derrota no passo 161, aos 333 ms da abertura |
| Vagonete andando | Pisão bloqueado, seguido por sentada a partir da quicada | Rebote no passo 194; derrota no 203, ainda em movimento |

Todos começam pelo carregamento normal de checkpoints em saves de teste. Depois disso, as gravações usam apenas comandos e atualizações nativas. Não há ajuste de posição, vida, fase, velocidade ou relógio para forçar o resultado. Os cinco percursos preservam o capacete, mantêm o jogador enquadrado e não têm quadros com o ataque ativo próximo fora da área vertical visível. A campanha completa é verificada separadamente, desde suas entradas normais.

## Verificação e limites

Os 19 casos novos cobrem os cinco encontros em movimento normal e reduzido, o teto nas duas direções, a continuidade da regra antiga fora de Guaíra, quatro pausas durante aberturas e a diferenciação visual dos estados. As rotas de exploração e manutenção anteriores continuam fazendo parte da suíte.

A suíte completa aprovou 3.699 testes TypeScript, com zero falhas e um caso opcional ignorado, além de três testes JavaScript. Validadores de fases, sprites e mundo, os dois projetos TypeScript e o build passaram. No navegador, dez execuções dos encontros — teclado e gamepad simulado — reproduziram os contatos esperados; quatro pausas congelaram estado e pixels e retomaram normalmente. A campanha normal completou as oito cenas, os dois chefes e uma revisita ao Pátio em nove execuções com gamepad simulado.

Resultados finais e hashes dos fontes estão em [verification.json](verification.json). Registros separados: [capturas](native-verification.json), [navegador](browser-verification.json), [campanha](campaign-verification.json) e [página de revisão](review-verification.json).

Os ensaios não equivalem a primeiras partidas de jogadores novos. Teclado e gamepad são exercitados no navegador; o gamepad é simulado. A comparação de poses é um estudo sobre piso de teste, separado dos cinco vídeos de entrada nativa.
