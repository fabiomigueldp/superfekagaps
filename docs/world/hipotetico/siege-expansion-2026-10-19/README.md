# Praça e bastião — 19/10/2026

O cerco passou de 1.536 para 2.048 pixels, com quatro postos, onze defensores e três ligações elevadas. O bastião acrescenta quatro apoios, equipamento na aproximação, um lançador e o Vanguarda. A praça ganhou oito personagens no plano de Feka, dois abrigos, faixa e mobiliário. O primeiro portão começa a abrir em 220 ticks, mantendo os guardas recolhidos até a segunda passagem.

O diretor do cenário usa entrada e enquadramento. Cenas posteriores não se executam enquanto Feka permanece no posto anterior. Travessias rápidas podem deixar construções intactas; a retomada mantém a instância real do cenário, sem fabricar destruição. Na gravação, os cinco contatos com fachadas aconteceram dentro da câmera normal.

O Vanguarda tem quatro pontos de resistência e três padrões: investida, corte duplo com uma segunda preparação, salto para o destino marcado. Proteção da cabeça, crista e avisos indicam defesa e abertura. A sentada causa dois pontos quando encontra uma abertura. Depois do acerto, ele recua antes de recompor o ataque. Física, plataformas, colisões e equipamentos continuam nativos.

## Verificação

- 204 testes selecionados: encontro e regressões dos mecanismos compartilhados.
- Build de produção com validação e checagem TypeScript.
- Replay por teclado até a vitória: 8.704 frames de entrada, 8.308 ticks ativos, três mortes. Nenhuma posição, proteção ou vida alterada pelo replay.
- Navegador: menu, quatro postos, vitória, pausa, reinício, 390px com movimento reduzido, sem erros.
- Vídeo: 273 frames a 30 fps, 9,1 segundos do bastião; áudio de arma/destruição do sintetizador de produção. Não contém a trilha musical nem todos os efeitos do jogo.
- Prancha de 24 poses: inspeção explícita de arte, não gravação de gameplay.

## Reprodução

```powershell
node --import tsx --test tests/hypothetical-*.test.ts tests/world-barrel-lifecycle.test.ts tests/world-carrier-motion.test.ts tests/world-machines.test.ts tests/world-secret-cannon.test.ts
npm run build
node scripts/verify_hypothetical_boss.cjs
node --import tsx scripts/prove_hypothetical_siege.ts <pasta-de-saida> <modulo-canvas>
node --import tsx scripts/prove_hypothetical_vanguard.ts <arquivo-png> <modulo-canvas>
node scripts/render_hypothetical_audio.cjs <audio-cues.json> <arquivo-wav>
```

O verificador do navegador aceita `PLAYWRIGHT_MODULE`, `FEKA_UI_URL` e `HYPOTHETICAL_OUTPUT`. O resultado não substitui uma avaliação de dificuldade por jogadores com níveis diferentes de experiência.
