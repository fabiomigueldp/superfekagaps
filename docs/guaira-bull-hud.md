# Ossabravo: salto visível e HUD local

Base: `539eb244e73b4029df6200cd89689a38510e2967`.

O painel genérico do encontro (`192×24`, x64/y26, mais sombra) cobria o próprio Feka no ápice de um salto normal. O adapter de Ossabravo agora usa seu `renderEncounterHud` protegido para concentrar as informações na faixa nativa já existente de 23 px:

- Primeira linha: Guaíra, nome completo OSSABRAVO e seis marcadores em forma de osso, com estados cheio/vazio
- Segunda linha: dica inteira do estado atual, sempre presente no canvas com a fonte bitmap original em escala 1×
- Capacete e pausa mantêm suas posições; `LAB` identifica o protótipo
- O status acessível repete a dica ativa; a leitura durante o jogo não depende desse status

A faixa continua com a paleta local de barro, osso e lilás. Não há nova placa sobre a arena, truncamento de dica nem ocultação condicional durante o salto. Pausa, resumo de vitória e texto de continuação recebido do capítulo continuam iguais. A faixa também conserva sua posição de desenho acima da transição nativa de morte/retorno. Não foram alterados WorldGame, Renderer, modelo do touro, Player, câmera, física, regras, timings, telegráficos, arte da arena ou entradas de outras salas.

## Evidência nativa

`prove_guaira_bull_hud.mjs` executa o Input, Player, Renderer e WorldGame reais com as fronteiras de navegador do harness existente e um Canvas nativo. Nenhum estado do jogador ou ataque é fabricado nas provas visuais. Os inputs são o salto do spawn intacto e a gravação existente da luta vencida. Renderizar é verificado como operação sem alteração do estado de simulação.

| Caso | Frames observados | Frames com Feka sob o HUD antes → depois | Maior sobreposição antes → depois |
| --- | ---: | ---: | ---: |
| Salto curto, Espaço por 1 frame | 65 | 0 → 0 | 0 → 0 |
| Salto mantido, Espaço por 34 frames | 65 | 19 → 0 | 267 → 0 pixels |
| Mesmos saltos, movimento reduzido | 130 | 19 → 0 | 267 → 0 pixels |
| Luta gravada, normal + movimento reduzido | 2 × 1.067 | 0 → 0 | 0 → 0 |
| Salto com pausa/retomada no frame 21 | 23 | 11 → 0 | 266 → 0 pixels |

Cada luta contém 1.065 atualizações da gravação, mais duas observações de vitória e vitória pausada. O caso de pausa contém 21 atualizações e duas observações extras. O teste mede pixels opacos efetivos do ator, incluindo capacete; o HUD medido inclui a faixa opaca superior e o HUD local, não os modais intencionais de pausa/vitória. O menor y visível do ator no salto mantido é 29: seis linhas livres entre o último pixel da faixa (y22) e o capacete.

Os 2.417 pares de observações têm hash de simulação e raster do ator idênticos antes/depois. A gravação preserva os mesmos seis acertos, capacete intacto, vitória e nenhum save da campanha. Os frames escolhidos cobrem aviso e execução de investida, aviso e execução dos ossos, freada, recuperação, acertos, pausa e vitória. A comparação também afirma igualdade de todos os pixels da arena fora da antiga área do painel/sombra (x64–257, y26–51); só essa área e o cabeçalho mudam.

Artefatos de revisão gerados em `PROOF_DIR`, fora do build:

- `jump-before-after-native.png`
- `combat-before-after-native.png`
- `summaries-before-after-native.png`
- `comparison.json`
- `before/report.json` e `after/report.json` no mesmo diretório, com medidas por frame, hashes e PNGs nativos de 320×180

Os contact sheets colocam os frames nativos lado a lado, sem redimensionar. Foram inspecionados os pixels de salto, telegráficos, recuperação, pausa e vitória. Esta prova é offline, não é uma captura de navegador nem um teste humano de dificuldade, FPS ou toque. A inspeção integrada da prévia compacta pertence ao lote consolidado.

## Reproduzir

Use checkouts separados da base e da alteração. `CANVAS_MODULE` pode ser o nome `@napi-rs/canvas` já resolvível no ambiente ou um caminho absoluto para o módulo existente; não é dependência de runtime do jogo.

```sh
node --import tsx scripts/prove_guaira_bull_hud.mjs "$BASE_CHECKOUT" "$PROOF_DIR/before" "$CANVAS_MODULE"
node --import tsx scripts/prove_guaira_bull_hud.mjs "$UPDATED_CHECKOUT" "$PROOF_DIR/after" "$CANVAS_MODULE"
node --import tsx scripts/compare_guaira_bull_hud.mjs "$PROOF_DIR/before" "$PROOF_DIR/after" "$PROOF_DIR" "$CANVAS_MODULE"
node --import tsx --test tests/guaira-bull-hud.test.ts tests/guaira-lab.test.ts tests/guaira-replay.test.ts tests/guaira-bull-art.test.ts tests/guaira-bull-runway.test.ts tests/guaira-bull-projectile-visibility.test.ts
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p tsconfig.tools.json --noEmit
```

Resultado: 59 testes focados passaram, além dos dois projetos TypeScript. A suíte inteira e o build/publicação não foram executados neste ajuste local. Não houve navegador, Vercel ou acesso a Oracle.
