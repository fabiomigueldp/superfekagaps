# Prefeito da Vazão — ritmo e resposta, 16/10/2026

Esta rodada modifica o encontro em produção, compartilhado pela entrada direta
e pelo capítulo de Guaíra. A página `index.html` mostra capturas e duas partidas
completas dessa implementação, com controles e física nativos.

## Mecânicas e leitura

- As duas últimas etapas alternam três sequências de jatos quando o jogador
  perde uma abertura. Cada etapa começa pela sequência introdutória anterior.
  Os próximos disparos aparecem acima do chefe, na ordem de leitura da tela,
  mesmo quando a pose está espelhada. Cada disparo conserva seu aviso completo.
- Um registro acionado perto do fim da recuperação pode completar a viagem
  real da plataforma. A tolerância é concedida uma única vez, por 84 ticks.
  Na primeira chegada válida, há pelo menos 144 ticks úteis para atacar.
  São 60 ticks de aviso da emenda, 24 de água ativa e 60 para o contra-ataque.
- O indicador da abertura começa na chegada real. Fechar e reabrir não renova
  esse tempo; uma plataforma que não chega encerra a tolerância. Sem registro,
  a recuperação continua terminando em 210 ticks.
- Cortar a salva pelo registro continua sendo uma alternativa mais rápida:
  cancela os disparos restantes, as carimbadas seguintes e o pulso da emenda
  naquela abertura. Não há sorteio nem mudança de alvo durante a antecipação.

## Arte e animação

- Três poses de retorno de pressão antes da recuperação, durante no máximo
  18 ticks. A pose de costas expostas tem prioridade assim que a subida termina.
- Um reflexo discreto parte do registro usado e percorre os tubos existentes
  até a caixa dos lacres. Não usa as cores dos volumes de água que causam dano.
- Cada golpe rompe o lacre correspondente em sua posição física, com duas
  partes de cera e metal. O último acerto envia uma resposta até a bica pública.
- No impacto, a compressão desloca apenas o tronco. Botas e ferramentas
  permanecem assentadas sobre o patamar. Chave e carimbo também foram ajustados
  nas poses de recuperação e descanso para não atravessar o piso.
- Efeitos limitados a quatro registros breves, movidos pelo relógio da
  simulação. O desenho lê o estado sem alterá-lo. Movimento reduzido usa
  indicações estáveis; pausa congela as imagens e os registros dos efeitos.

## Conferência

- **1.146 testes de Guaíra passaram, zero falhas**, incluindo 14 novos casos.
  Os contratos anteriores da abertura foram atualizados para o novo prazo útil.
- `npm run build` aprovado.
- Cinco percursos completos de produção, capturados a 60 fps sem dano:
  balcão (1.822 quadros), espera (1.882), piso (1.885), interrupções (1.255)
  e abertura perdida seguida de registro tardio (2.660).
- Os quatro percursos anteriores preservam os quadros dos três acertos.
  O novo percurso acerta nos quadros **407, 1779 e 2476**. A segunda tentativa
  alterna para jato baixo da direita seguido de alto da direita. O registro é
  acionado no quadro **1589**, nove antes do prazo antigo; a passarela chega
  no **1659**, a descarga começa no **1719** e o contra-ataque ocorre no **1779**.
- A gravação deliberada de derrota foi atualizada para a sequência nova:
  perde o capacete no quadro 935 e morre no 1204, com dois lacres intactos.
  Os testes de jornada comprovam que essa tentativa não concede conclusão e
  que o reinício permite completar o capítulo normalmente.
- Navegador Edge: piso, interrupções e nova tentativa concluídos com teclado
  e controles DOM de toque simulado, incluindo movimento reduzido e reinício.
  O verificador do capítulo completou as oito cenas sem erro de página.
- Pausa verificada durante cortes pelos dois registros, quebra de lacre e
  liberação final: pixels e estado idênticos após 90 atualizações pausadas,
  tanto em movimento normal quanto reduzido.
- Página em 1440 e 390 px, sem rolagem horizontal. Todas as imagens carregadas
  e ambos os vídeos efetivamente decodificados: 20,916667 e 44,333333 segundos,
  960 × 540, 60 fps. Ampliação por vizinho mais próximo, sem suavização.
- Cada uma das 24 células dos dois atlas gerados foi comparada pixel a pixel
  com seu quadro individual. O gerador agora copia os pixels imediatamente;
  referências adiadas ao canvas reutilizado podiam trocar imagens do atlas.

As partidas são ensaiadas. O vídeo da nova tentativa espera deliberadamente
para testar uma abertura perdida e o registro tardio; essa espera não é
obrigatória para vencer. Estas provas não medem diversão, descoberta por
jogadores novos ou desempenho de um dispositivo móvel físico.

## Reprodução

Caminhos relativos à raiz do repositório. `CANVAS_MODULE` aponta para a
instalação local de `@napi-rs/canvas`; `PLAYWRIGHT_MODULE`, para Playwright.
O navegador usa o Vite em localhost:3000.

```powershell
$guairaTests = @(rg --files tests -g 'guaira-*.test.ts')
node --import tsx --test --test-reporter=tap @guairaTests
npm run build

$env:GUAIRA_MAYOR_PROOF = 'rhythm'
node --import tsx scripts/prove_guaira_mayor_rework.ts OUTPUT CANVAS_MODULE

$env:GUAIRA_MAYOR_EXTRA_ROUTE = 'tests/helpers/guairaMayorInterruptReplay.json,tests/helpers/guairaMayorRetryReplay.json'
$env:GUAIRA_MAYOR_REVIEW_PATH = '/docs/world/guaira/mayor-pressure-rhythm-2026-10-16/index.html'
$env:GUAIRA_MAYOR_VIDEO_COUNT = '2'
node scripts/verify_guaira_mayor_rework.cjs

$env:GUAIRA_ASCENT_ROUTE = 'roof'
node scripts/verify_guaira_chapter_readability.cjs
```

`baseline-source/` preserva os seis arquivos do encontro antes desta rodada;
é referência, não código importado pelo jogo. `baseline-mayor-replay.json`
preserva o percurso pelo piso. Os dois quadros de comparação usam o mesmo
instante 577 do percurso por interrupções, antes e depois desta rodada.

Resultados: `verification.json`, `native-verification.json`,
`browser-verification.json`, `review-browser-verification.json`,
`feedback-pause.json` e `atlas-verification.json`.
