# Direção do cenário — 19/10/2026

Esta rodada trabalha a destruição arquitetônica nas cinco fachadas do cerco. Não altera a abertura com os personagens, as colisões ou os ataques do primeiro plano.

- Fratura de seis ticks, seguida de cinco painéis assimétricos com atrasos e tempos de queda próprios. As texturas da fachada permanecem nos pedaços durante a queda.
- Interior exposto, vigas, telhas e pequenos fragmentos persistentes. Os chips têm um rebote e posição final estável; não há lista crescente de partículas.
- Poeira de contato, parede e telhado em pulsos separados. Sons de escombros sincronizados com os mesmos instantes de aterrissagem.
- Cais: vibração, ruptura e recuo gradual da corda; cinta acompanha a carga; caixas se separam depois do pouso.
- Arsenal: ruptura do tubo com rajada inicial e vazamento residual.
- Bastião: sino com arco pendular e amortecimento; uma fixação da faixa se solta e a outra permanece presa; fumaça finita.
- Todo movimento causal usa o relógio do cenário existente, que espera a chegada e o enquadramento do jogador. O renderizador não altera a simulação.

## Material visual

`scripts/render_hypothetical_setpieces.ts` gera 24 quadros e 161 frames de três cenas lado a lado. Câmeras e tempos são escolhidos explicitamente para direção de arte; não é replay de gameplay. O vídeo monta as três cenas em sequência, com 16,1 segundos a 30 fps e sem áudio.

```powershell
node --import tsx scripts/render_hypothetical_setpieces.ts output/hipotetico/scenic-direction <modulo-canvas>
```

## Publicação

Fluxo rápido descrito em `AGENTS.md`: build Vite e publicação incremental. Sem executar suíte de testes, typecheck ou revisão automática de navegador. A expectativa existente de áudio na chegada foi atualizada para os novos instantes de queda; o teste não foi executado nesta rodada.

O trabalho não demonstra uma avaliação da dificuldade por jogadores nem garante ausência de regressões de gameplay.
