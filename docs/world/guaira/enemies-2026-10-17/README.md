# Guaíra — inimigos, ações e leitura dos perigos

Revisão de 17/10/2026. [Campanha](http://localhost:3000/?chapter=guaira) · [Vídeos, antes/depois e poses](index.html).

## Diagnóstico

A auditoria encontrou 44 posições de inimigos distribuídas por seis famílias. Todos usam `WorldFoe`, a colisão nativa, as mesmas regras de dano, pulo, sentada e recuperação do restante do jogo. Os principais problemas estavam na diferenciação das ações e na apresentação.

O problema mais grave era um perigo invisível: a pintura personalizada dos distritos ampliados desenhava mecanismos e sinalização, mas omitia `objects.barrels`. Os barris continuavam atualizando e causando dano. A camada agora os desenha nas seis fases e também quando atravessam de volta para uma região introdutória.

As patas usavam o tempo global do inimigo, inclusive quando ele estava parado. Os corpos compartilhavam praticamente a mesma superfície avermelhada. A mão do carregador não seguia a carga até o ponto de lançamento. A placa da couraça perdida subia continuamente. O investidor e o vagonete começavam e paravam instantaneamente.

## Famílias e respostas

| Família | Quantidade | Revisão mecânica e visual | Resposta verificável |
| --- | ---: | --- | --- |
| Pinçadeiro (`minion`) | 15 | Detecta aproximação no mesmo chão a menos de 52 px. Anuncia por 450 ms, avança durante 240 ms, estende uma pinça de 8 px além do corpo e descansa 900 ms. A pinça é perigosa entre 50 e 190 ms do ataque. | Salto, recuo ou desvio alto. A direção não acompanha o jogador depois do aviso. O ataque respeita a borda e o alcance da patrulha. |
| Couraça (`helmet`) | 17 | Placas segmentadas, rebordo quebrado, desprendimento e queda da proteção. Depois dos 700 ms de atordoamento, a velocidade sem armadura passa de 0,55 para 0,9 px por passo. | Dois pisões ou uma sentada; o segundo ataque pode aproveitar o atordoamento. |
| Investidor (`charger`) | 1 | Perfil de velocidade com rampas de 120 ms e máximo de 3,8 px por passo. Placas, postura, patas e rastro distinguem o ataque da recuperação. | Salto sobre a corrida comprometida e ataque na recuperação. O aviso de 800 ms continua completo. |
| Carregador (`loader`) | 9 | Alterna barril baixo (`vy=-2,5`, `vx=1,8`) e alto (`vy=-4,8`, `vx=2,1`). A carga é erguida de forma diferente e chega ao ponto físico de lançamento. | A passarela protege do primeiro arremesso; o segundo exige esquiva. A direção fica fixa durante os 850 ms de aviso. |
| Mexedor (`agitator`) | 1 | As pinças ampliam e recolhem o alcance entre 4 e 12 px por lado durante o giro. O aviso marca o alcance máximo; o desenho e a colisão usam a mesma extensão. | Esperar o giro e saltar sobre a recuperação. |
| Vagonete (`rail`) | 1 | Percurso suave entre as mesmas pontas, velocidade média de 0,9 e pico de 1,35 px por passo. Rodas acompanham distância; a inversão conserva a pausa de 550 ms. | Salto ou travessia durante a pausa na ponta. |

Essas variantes são ativadas explicitamente nos dados de Guaíra. O primeiro investidor da campanha original e seus tempos de introdução continuam cobertos pelos testes existentes.

## Distribuição nas fases

| Fase | Pinçadeiros | Couraças | Investidor | Carregadores | Mexedor | Vagonete |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Travessia | 3 | 4 | 0 | 1 | 0 | 0 |
| Pátio das Comportas | 3 | 3 | 0 | 1 | 0 | 0 |
| Passagem dos Respiros | 2 | 3 | 0 | 1 | 1 | 0 |
| Subida da Vazão | 2 | 3 | 1 | 2 | 0 | 0 |
| Galeria | 3 | 2 | 0 | 2 | 0 | 0 |
| Câmara de Alívio | 2 | 2 | 0 | 2 | 0 | 1 |

Os pinçadeiros e couraças ocupam margens e sacadas. Os carregadores combinam ameaça no piso e na aproximação elevada. Investidor, mexedor e vagonete mantêm encontros específicos: Portaria da Vazão, Registro das Taipas e Passadiço do Coletor. Os avisos contextuais distinguem pinça, arremesso alto, couraça quebrada e inversão.

Uma primeira implementação da pinçada parava a patrulha durante o pouso de um salto sobre água. A detecção foi corrigida para a aproximação no mesmo chão. Os percursos de manutenção e retorno da Eclusa também foram regravados com comandos nativos para responder à nova posição do guarda, preservando as moedas e a conclusão sem dano.

## Arte e continuidade

As seis famílias têm superfícies, olhos, articulações e equipamentos próprios. A marcha usa distância percorrida: um inimigo parado não desliza as patas. A couraça deixa um rebordo quebrado visível; o casco desprendido percorre um arco e desaparece. Os braços do carregador sustentam o barril durante a preparação e acompanham a soltura.

O barril carregado e o projétil compartilham uma silhueta de 14 × 16 pixels. A rotação usa desenhos na grade, com aros, tábuas, luz e sombra; não gira uma imagem com suavização. A poeira usa o instante de aterrissagem registrado pela física. Pausa congela tudo. Movimento reduzido conserva a posição, o perigo e os avisos, omitindo rotação decorativa e poeira.

## Provas de gameplay

- `pincer-counter.mp4`: esquiva da pinça por salto e chegada à margem seguinte, sem dano.
- `pincer-hit.mp4`: ignorar o aviso perde o capacete no passo 75, antes do contato com o corpo.
- `loader-counter.mp4`: o primeiro barril passa sob a passarela; um salto curto evita o arremesso alto e um ataque por cima derrota o carregador, sem dano.
- `loader-hit.mp4`: permanecer na mesma passarela funciona contra o primeiro arremesso, mas perde o capacete no passo 329 contra o segundo.

Esses quatro trechos começam pelo carregamento normal de checkpoints de um save de teste. Depois disso, usam somente entradas e atualizações a 60 Hz: posição, vida, câmera e relógios dos ataques não são editados. O salto curto contra o arremesso alto mantém jogador, passarela e carregador no enquadramento.

O estudo `animation.mp4` usa estados reais dos inimigos sobre um piso de teste. A perda da armadura é acionada para inspecionar a reação; ele é uma apresentação de poses, não uma prova de partida.

## Verificação e limites

Os 35 novos casos cobrem ações, direções comprometidas, proteção dos pousos, paredes, bordas, arremessos, projeção da pinça, recuperação, pausa, movimento reduzido e o desenho efetivo dos projéteis nas seis fases. Os testes anteriores de percursos, exploração, checkpoints e progresso continuam parte da validação.

A suíte completa terminou com 3.680 testes TypeScript aprovados, zero falhas e um caso opcional ignorado, além de três testes JavaScript aprovados. Os validadores de fases, sprites e mundo, os dois projetos TypeScript e o build passaram. O navegador executou oito encontros com teclado e toque simulado, quatro pausas e nove percursos da campanha normal com gamepad simulado: as oito cenas, incluindo os dois chefes, e uma revisita ao Pátio.

Os resultados finais ficam em [verification.json](verification.json), com os registros de [encontros](native-verification.json), [navegador](browser-verification.json), [campanha](campaign-verification.json) e [poses e inventário](art-verification.json).

Os ensaios verificam caminhos executáveis, dano real e integração. Não estabelecem, sozinhos, a diversão ou a dificuldade de descoberta na primeira partida. Teclado, toque e gamepad foram exercitados em navegador de desktop; toque e gamepad são simulados.
