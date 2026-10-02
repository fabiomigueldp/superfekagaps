# Guaíra · travessia experimental

Route: `/guaira-travessia.html`. Guaíra is a fictional setting. The short traversal is separate from the six-world campaign, and its in-memory store never reads or writes browser storage.

The level is 1152×288 world pixels (72×18 tiles), about 3.6 native screens. Ground top is y224. It connects a dry red street (x0–416), a maintenance bridge over the sluice (x416–624), and an irrigated rice bank (x624–1152). Two workers are friendly scenery. Clean cyan water is cosmetic, with no swimming, damage or fluid simulation.

Feka starts at x48 with the normal helmet. Use the existing movement, jump and sentada controls. The ordinary switch at x352–384, y216–224 links to an ordinary gated lift. Jump and press down above the switch to raise the bridge from y336 to y224. Its home lies below the normal fall-death boundary; the 208px opening cannot be crossed by an ordinary maximum run jump. The mechanism can be toggled again; its collision geometry comes directly from `WorldObjects`, as does its moving deck art.

The native checkpoint is at x656, safely past the crossing. Death before the checkpoint resets the valve. Death after it restores the valve and bridge to their solved position through the local adapter, and uses the normal checkpoint helmet, coins and death/reveal pipeline. Recomeçar always starts a new local traversal. No save schema or campaign IDs are extended.

Reaching x1080 while grounded after solving the bridge fixes the local result and reveals the native Ossabravo action. The CURRAL action navigates explicitly to `/guaira-lab.html`. Water animation continues and Feka settles into his native idle pose after completion; the run time remains fixed, and pause freezes the scene. There is no experimental campaign exit and no call to `finishStage`. The map action returns to `./guaira.html?at=town` before the checkpoint or `./guaira.html?at=rice` afterward, preserving local spatial continuity. Only the real completed traversal adds `&visit=traversal-clear` at the rice arrival. Reaching the checkpoint alone is not completion. This visit summary says the water reached the rice field; it does not say the public neighborhood branch has reopened.

The toolbar uses native buttons/links containing the existing 44px bitmap action painter. Three actions are visible: PAUSA/TENTAR/MAPA, or CURRAL/TENTAR/MAPA after finishing. Pausing the completed scene exposes CONTINUAR in the same slot. Focus follows a replaced PAUSA/CURRAL control, and click-time validation rejects an obsolete CURRAL activation during pause or after retry. The completed map return remains available while paused. Retry synchronously clears its visit summary, returns to the town arrival and restores canvas focus before the next animation frame. The URL is only a typed summary of the visit just left, with no storage or unlock. Enter/Space on those controls do not reach gameplay. Escape, HUD pause, blur and document hiding pause the real engine. Reduced motion disables shake and decorative motion while retaining necessary bridge movement. Touch uses the ordinary movement/jump/down controls.

Verification: `tests/guaira-traversal.test.ts` exercises a frozen keyboard replay through real Input, Player, WorldObjects and WorldGame, checkpoint and death recovery, failed puzzle bypass, pause/visibility, touch, toolbar navigation and campaign/storage isolation. The browser harness substitutes DOM boundaries only. An actual offline Canvas replay is a rendering proof, not a browser capture; proof media lives outside the repository.

O ponto seguro pertence somente à tentativa aberta. A mensagem efêmera é **PONTO SEGURO NESTA TENTATIVA**; os status locais explicam que sair e reentrar inicia outra tentativa. A campanha continua usando sua mensagem e persistência anteriores. Isso altera apenas feedback textual, não posição, capacete, moedas, física ou restauração.

## Movimento decorativo da travessia

O moinho mantém torre/eixo firmes e constrói suas pás no grid nativo ao longo da rotação. Os dois trabalhadores usam sete poses desenhadas, com pés fixos, trabalho curto de braços/ferramentas e reação ao estado real da comporta. As poses são obtidas diretamente de válvula e altura da ponte; um checkpoint restaurado não depende de um evento de abertura antigo. Eles continuam cenários sem colisão, ataque, comando obrigatório ou diálogo novo.

Reflexos ficam recortados no canal, no interior dos arrozais, na queda e no pool existente. O trecho à esquerda aponta o fluxo para a esquerda, os arrozais para a direita e a queda para baixo. A orientação decorativa não representa a reabertura do ramal público do bairro, que pertence ao encontro opcional do Prefeito. Os períodos de repetição coincidem com o espaçamento dos reflexos, evitando recuos no fim do ciclo. O pool conserva sua linha e cor originais e diverge do centro da queda. Os reflexos do arroz são pintados antes das folhas; Feka permanece na frente da camada de objetos.

Os dois módulos visuais recebem somente tempo e estado do jogo, sem timers, RAF, armazenamento ou alteração de mecanismo. Pausa conserva o tempo; movimento reduzido mantém poses estáveis para o estado atual. Tiles, suporte, ponte, placa, risco, câmera, controles e coleta permanecem sob as mesmas autoridades do motor.

`tests/guaira-vitality.test.ts` cobre pés/envelope, estados estáticos, moinho/eixo, ausência de água decorativa quando seca, clips e continuidade dos quatro fluxos. O replay de 585 quadros foi comparado antes/depois, incluindo Player, corpos, tempo, resultado, checkpoint, moedas e IDs coletados em cada quadro; o digest foi idêntico e cada render preservou a simulação. As provas visuais combinadas são Canvas offline, sem alegação de FPS ou substituição de QA em navegador.

## Continuidade da distribuição

Dois ramais inclinados de bronze ligam os ombros da comporta às pontas do canal esquerdo e do arrozal. As flanges seguem a linguagem da tubulação da Casa da Vazão. Os tubos ficam atrás da alvenaria, das correntes e do deck real; suas bordas discretas não usam a faixa clara dos apoios jogáveis. A mudança é só de pintura, sem alterar canais animados, trabalhadores, estado da válvula ou geometria da ponte. A comparação no mesmo enquadramento usa o render real em Canvas offline; o replay de 585 quadros preserva o digest de simulação e cada render deixa o estado intacto.

## Ensino da sentada e visibilidade de Feka

A placa orienta `PULE. NO AR, APERTE BAIXO`. A sentada exige uma nova pressão de
baixo quando Feka já está no ar; o texto anterior com `+` podia sugerir uma
combinação simultânea. Nenhuma regra de input ou física foi alterada. O Pátio,
abertura alternativa do capítulo, usa a mesma sequência e continua identificando
o ramal A/B que receberá água.

A faixa da comporta fica oculta somente quando seus pixels e sombra poderiam
cobrir o corpo, capacete ou pés no enquadramento nativo. A mensagem da página
permanece disponível. Ao sair dessa área, a faixa reaparece com a instrução ou
o estado atual da ponte. O capítulo começa exibindo seu objetivo em vez do
rótulo genérico do experimento.

`tests/guaira-traversal-guidance.test.ts` exercita salto alto, retorno da faixa,
toque, movimento reduzido, pausa e os textos de conclusão nas duas entradas.
`tools/guaira/render_traversal_guidance.mts` gera a comparação offline com Input,
Player e pintores reais, usando um checkout anterior como baseline. Seus PNGs
ficam fora do output de produção; não equivalem a captura do navegador.
