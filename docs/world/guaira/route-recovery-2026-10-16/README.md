# Guaíra — retorno ao desafio no Pátio

Continuação de level design de 16/10/2026. O foco desta rodada é a recuperação
de erros no Pátio das Comportas e a clareza da recompensa durante a tentativa.

[Comparações e percursos](index.html)
· [Revisão anterior em cinco fases](../level-design-2026-10-16/index.html)

## Alterações

- Dois degraus suspensos são liberados ao capturar o checkpoint central. São
  mecanismos `lift` nativos, controlados pelo checkpoint, com velocidade nativa
  de 55 px/s. Ficam recolhidos em y264 e descem para y304 e y336, sob o piso y256.
- A posição recolhida fica fora do alcance dos saltos desde o piso y400 e fora
  da tolerância de transporte do jogador apoiado no patamar. Não permite pular
  a travessia A nem arrasta quem está no piso superior durante a abertura.
- Depois da chegada, a escada permanece aberta ao inverter A/B. Errar B ou o
  salto final permite retornar ao patamar por saltos comuns. Um salto mais alto
  pode dispensar o degrau superior. Não é preciso acionar outra placa no retorno.
- A morte restaura o checkpoint com a escada aberta e a configuração A/B segura
  já usada pelo jogo; as moedas da tentativa permanecem. Recomeçar recolhe os
  degraus e limpa o checkpoint e as moedas.
- Arte com guias telescópicas, braços cruzados, articulações, apoios, cabo e
  trava. Cada borda clara coincide com o topo do corpo físico. A placa distingue
  entrada, abertura e retorno. Movimento reduzido conserva o movimento necessário
  dos mecanismos e seus estados, como nas outras plataformas.
- A câmera antecipa a borda do patamar ao aproximar-se da escada pelo piso seco.
  O ajuste de oito pixels mantém o chão dentro da tela. O banner existente avisa
  a abertura; avisos A/B e movimento dos tablados mantêm prioridade.
- O HUD usa o contador de moedas compartilhado e o capacete nativo nas mesmas
  posições das outras fases. O indicador da água foi reposicionado sem perder
  legibilidade. As três moedas opcionais continuam dispensáveis para concluir.

## Verificação

961 testes de Guaíra aprovados, incluindo 15 novos nesta rodada:

- Oito percursos completos: direto/opcional × teclado/toque simulado × movimento
  normal/reduzido. Há uma queda real do salto final, uso dos dois degraus e
  conclusão sem dano, mantendo a água em B durante a recuperação.
- 36 combinações de posição, direção e duração do salto conferem que a escada
  recolhida não libera o checkpoint pelo piso inferior.
- Três posições sobre o patamar conferem que a abertura não transporta o jogador
  através do piso. Pausa congela a escada parcialmente aberta; morte, restauração
  e reinício mantêm o estado apropriado.
- Nove combinações de duração do salto recuperam pelo novo caminho. Saltos mais
  altos também permitem dispensar o degrau superior.
- Duas verificações do HUD cobrem coleta silenciosa, pausa, morte e reinício,
  com e sem movimento reduzido. O contador usa o registro nativo da tentativa.

`npm run build` aprovado, incluindo validadores, os dois projetos TypeScript
e Vite. As rotas anteriores do Pátio continuam passando; o seletor, o movimento
dos tablados e os encontros das outras fases mantêm suas verificações.

`browser-verification.json` registra a conferência das oito cenas no capítulo
real: teclado, pausa, canvas estável e retorno ao mapa, sem erros de página.
A janela 844 × 390 não apresentou transbordamento.

`native-browser-verification.json` registra os dois percursos novos em Edge,
com perfis isolados e teclado real do navegador. O driver assume apenas o
agendamento, avançando `game.update(1000/60)`; uma tentativa nova começa por
`load`. Não altera posição, câmera, coleta, mecanismos ou relógio durante o
percurso. O capítulo aceita a conclusão e Continuar retorna ao mapa.
Essa verificação não é uma medição de FPS nem um teste em aparelho físico.

A página comparativa passou em 1440, 390 e 320 pixels, sem rolagem horizontal:
seis imagens comparativas e os dois vídeos foram decodificados, os vídeos
reproduziram, o divisor respondeu ao teclado e os links retornaram sucesso.
`review-verification.json` registra os resultados. `source-verification.json`
confirma os quatro pares de hashes entre fontes atuais, capturas e referências.

| Percurso nativo | Atualizações | Moedas | Retorno do piso ao patamar | Dano |
| --- | ---: | ---: | ---: | --- |
| Direto, com erro no salto final | 1.409 | 0 | 5,30 s | Não |
| Exploração, com erro no salto final | 2.356 | 3 | 5,37 s | Não |

Os tempos são dos comandos ensaiados e não representam uma primeira partida.
Não houve playtest externo nesta rodada. O objetivo do ajuste é reduzir a
repetição após a falha mantendo a necessidade de dominar o salto final.

## Capturas e reprodução

`baseline-source/` preserva os quatro arquivos anteriores a esta rodada,
incluindo alterações anteriores ainda não commitadas; não usa o `HEAD` como
referência. `detail-verification.json` registra hashes, estados, apoios usados,
câmera, pureza da renderização e conclusão.

As seis imagens comparativas usam poses preparadas equivalentes nos estados
recolhido, abrindo e aberto. Os dois vídeos e as imagens de detalhe vêm de
tentativas novas, conduzidas só por entradas nativas. A física avança a 60 Hz;
os vídeos capturam a 15 fps e ampliam 320 × 180 para 960 × 540 sem suavização.

```powershell
node --import tsx scripts/prove_guaira_junction_recovery.ts output/guaira/route-recovery-2026-10-16 CAMINHO_PARA_CANVAS_MODULE docs/world/guaira/route-recovery-2026-10-16/baseline-source
```

O módulo de Canvas é `@napi-rs/canvas`. As gravações estão em
`tests/helpers/guairaJunctionRecoveryReplays.json`; os logs de teste, build,
captura e navegador ficam em `output/guaira/route-recovery-2026-10-16/`.
