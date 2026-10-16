# Ossabravo — progressão, ritmo e acabamento, 16/10/2026

A entrada direta `guaira-lab.html` e o encontro do capítulo usam a mesma
implementação `GuairaBullLab`, com Player, Input, física, capacete, áudio,
pausa, morte e reinício do jogo. Esta rodada modifica essa implementação.

## Progressão do confronto

- Com seis ou cinco pontos de resistência, conserva as investidas simples e
  o padrão de ossos baixos. A direção é escolhida antes do aviso e não segue
  o jogador durante o ataque. Continua evitando investidas sem espaço na parede.
- Com quatro ou três pontos, os ossos passam a quicar. O arco tem 32 px de
  altura e período de 36 ticks, com velocidade horizontal de 3 px/tick.
  Há no máximo dois projéteis. Um aviso de 48 ticks mostra a trajetória do
  primeiro osso; o cálculo vertical é compartilhado com a física.
- Com dois ou um ponto, cada investida tem ida e volta. Dois sinais de chifre
  anunciam as passagens. Depois da ida, há outro aviso completo de 42 ticks,
  com direção travada e costelas fechadas. A volta termina nos 20 ticks de
  frenagem e 52 de recuperação vulnerável.
- O deslocamento mantém 5 px/tick; Feka conserva sua física nativa. Os acertos
  continuam exigindo contato superior em queda, uma vez por abertura.
  Salto e sentada funcionam.
- A colisão dos ossos considera também seu deslocamento vertical entre passos.
  As poses finais dos projéteis que saem da arena continuam visíveis enquanto
  seus contatos são válidos. A recuperação limpa imagens e colisões pendentes.

## Arte e conclusão

- Preparação do retorno em três poses, apoio firme e poeira breve. Fraturas
  discretas acompanham os acertos. Ossos com acabamento de luz/sombra, núcleo
  local e sombra no chão. Sem rotação ou suavização de sprites.
- Casa da comporta com telhado, madeira, guias, ferragens, eixo, bases e canal
  contínuo até o cocho, atrás da cerca da arena.
- Vitória em seis poses: joelhos dobram, caixa torácica desce e crânio repousa.
  A revisão visual corrigiu um alongamento da caixa torácica e um salto
  vertical do crânio no início da queda.
- A mensagem de vitória espera 48 ticks pela acomodação, sem bloquear as
  opções de continuar ou sair. A comporta local sobe e abastece o cocho.
  Isso não resolve o objetivo da água pública do Prefeito.
- Todos os movimentos usam o relógio da simulação. Movimento reduzido mantém
  poses estáveis e avisos funcionais, sem partículas decorativas nem tremor.
  Na vitória, mostra diretamente a ossada acomodada.

## Validação

- **1.163 testes de Guaíra aprovados**, incluindo 17 novos casos.
- `npm run build` aprovado: validadores de níveis, assets do jogador e mundo,
  os dois projetos TypeScript e Vite.
- Salto: **1.267 quadros**, acertos em **180, 338, 548, 697, 961 e 1177**.
- Sentada: **1.251 quadros**, acertos em **180, 338, 548, 697, 945 e 1161**.
  A contagem começa em 1. Ambos preservam o capacete e terminam com a comporta
  aberta. Os quatro primeiros acertos coincidem com a gravação anterior.
- Salto contra o retorno validado com início deslocado em −3, 0 e +3 ticks,
  preservando o capacete e alcançando a abertura. Não mede todos os momentos
  possíveis do salto.
- A política antiga de pular parada em ciclos fixos continua sem vencer:
  perde o capacete e morre no quadro 1302, com uma resistência restante.
  Isso não prova que toda estratégia estacionária falha.
- Duas rotas completas no Edge, cada uma por teclado e toque DOM simulado.
  O topo visual de Feka fica pelo menos 38 px abaixo do topo da tela.
  Nova tentativa, invalidação da continuação, movimento reduzido e avisos
  sonoros, incluindo o aviso do retorno, foram conferidos.
- Pausa durante retorno e queda final: pixels e estado idênticos após 90
  atualizações pausadas, em movimento normal e reduzido.
- Oito cenas concluídas no navegador, cinco resultados principais persistidos
  e oficinas preservando o progresso do capítulo.
- Página em 1440 e 390 px, sem rolagem horizontal; imagens carregadas e três
  vídeos efetivamente decodificados: 21,116667, 20,85 e 17,75 s, 960 × 540,
  60 fps. Ampliação por vizinho mais próximo, sem áudio.

São partidas ensaiadas e toque simulado. A descoberta das estratégias, diversão,
equilíbrio da dificuldade e desempenho em aparelho físico exigem avaliação
própria. `renderCpuMs` registra apenas o tempo local de submissão de atualização
e desenho no Edge headless, durante verificações concorrentes; não é FPS.

## Reprodução

Caminhos relativos à raiz. `CANVAS_MODULE` aponta para `@napi-rs/canvas` e
`PLAYWRIGHT_MODULE`, para Playwright. O navegador usa Vite em localhost:3000.
Os percursos usam apenas comandos nativos, sem alterar jogador, câmera, vida
ou relógio para forçar uma vitória.

```powershell
$guairaTests = @(rg --files tests -g 'guaira-*.test.ts')
node --import tsx --test --test-reporter=tap @guairaTests
npm run build

node --import tsx scripts/prove_guaira_bull_rhythm.ts OUTPUT CANVAS_MODULE
node scripts/verify_guaira_bull_rhythm.cjs

$env:GUAIRA_OUTPUT = 'OUTPUT_CHAPTER'
$env:GUAIRA_ASCENT_ROUTE = 'roof'
node scripts/verify_guaira_chapter_readability.cjs
```

O verificador aceita `GUAIRA_BULL_MODE=play` ou `review` para separar jogo e
página. Sem a variável, executa ambos.

Os quatro arquivos anteriores estão em `baseline-source/`; o percurso anterior
está em `baseline-replay.json`. Eles não são importados pelo jogo. A comparação
estática usa o mesmo quadro 140, antes das diferenças de mecânica. O vídeo
anterior foi capturado antes das alterações e preserva seus 1.065 quadros.

Resultados e hashes: `verification.json`, `native-verification.json`,
`browser-verification.json`, `chapter-browser-verification.json` e
`review-browser-verification.json`.
