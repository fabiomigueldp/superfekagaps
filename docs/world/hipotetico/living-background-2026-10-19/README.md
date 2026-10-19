# Atividades após a destruição — 19/10/2026

O cenário principal preserva a entrada, os ataques e a destruição existentes. O novo diretor começa na recuperação final, dentro da mesma rua, e continua mesmo quando o relógio narrativo espera Feka.

- `HypotheticalAftermath.ts`: aproximação, investigação, contato, escuta, reação, virada, patrulha e retorno. O relógio não altera portões, inimigos, dano ou progressão. Contatos aguardam o enquadramento; nenhuma atividade secundária de uma rua futura é executada antecipadamente.
- Cada rua guarda duas alterações permanentes. As inspeções posteriores usam a pilha danificada, distâncias alternadas de patrulha, pausas e movimentos de observação. Personagens que fogem não reaparecem como novos alvos.
- Portaria: madeira deslocada e viga solta. Cais: caixas, tampa e corda. Arsenal: tampa de duto, vapor e reação ao escape de pressão. Bastião: pequena pilha de alvenaria atingida por uma pisada.
- O rig existente recebe novas poses. Contato do focinho, inclinação do cavaleiro, rédeas, peso na aterrissagem, olhar e cauda acompanham cada atividade. A vista frontal distante usa a mesma paleta da lateral.
- Dois moradores por rua saem de trás dos materiais e alcançam recessos desenhados no cenário. Quatro aves reagem com atrasos diferentes e podem retornar pelo alto depois de um intervalo. Sem novas animações de ferimentos.
- Fragmentos têm quantidade fixa; contatos expiram após 88 ticks. A renderização não avança a simulação. Retentativas preservam o estado já produzido pelo fundo.

## Autoria visual

`scripts/render_hypothetical_aftermath.ts` gera 24 imagens, uma prancha de 16 quadros e 720 frames a 20 fps. As quatro cenas usam posições fixas escolhidas para composição e a atualização real de `HypotheticalModel`. O arquivo `art-study.json` registra relógios, fases, posições e progresso. Este é um estudo de 36 segundos de animação e composição, não uma partida, um teste automatizado ou uma medição de dificuldade.

```powershell
node --import tsx scripts/render_hypothetical_aftermath.ts .tmp/aftermath-final <modulo-canvas>
ffmpeg -framerate 20 -i .tmp/aftermath-final/frames/%05d.png -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart living-background.mp4
```

As revisões visuais corrigiram a altura do contato, a paleta da virada, o aparecimento dos moradores e a saída para o arco existente do bastião. O estudo isolado não substitui uma avaliação da luta por jogadores. A publicação segue `AGENTS.md`, sem suíte de testes, typecheck ou revisão de navegador.
