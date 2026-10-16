# Ossabravo — leitura da recuperação e dos ossos

Revisão de 16/10/2026. Abrir `index.html` com o servidor do jogo em execução.

## Problema reproduzido

O fim de uma abertura perdida trocava diretamente a pose aberta pela pose de
descanso. O contato lateral voltava a causar dano naquele mesmo quadro.
`baseline-miss-replay.json` e `before.mp4` registram uma ocorrência com comandos
nativos, sem alterações nos atores: perda do capacete no quadro **245**.

A nova rota repete todos os comandos anteriores até o quadro 299. Feka sai
andando, conserva o capacete e acerta a próxima abertura no quadro **385**.
O trecho de recuperação tem 390 quadros e termina com cinco pontos de vida no
chefe; não é apresentado como uma vitória completa.

## Comportamento e arte

- A recuperação perdida usa os **24 ticks do descanso existente**. Não há
  extensão do ciclo. As costelas fecham em quatro poses; o HUD e o texto
  acessível dizem `COSTELAS FECHANDO! RECUE`.
- O corpo permite recuar durante esses 24 ticks. Nenhum acerto é concedido;
  uma aterrissagem tardia rebate. No próximo aviso o corpo recupera sua
  colisão perigosa, e o aviso conserva sua duração integral.
- Um acerto no último tick vulnerável continua válido. Acertos bem-sucedidos,
  morte, vitória e reinício não herdam a tolerância de uma abertura perdida.
- A preparação dos ossos levanta as patas, comprime o corpo e mostra duas
  peças chegando aos pontos de lançamento reais. O render lê os mesmos
  descritores usados para criar os projéteis.
- Os ossos giram em quatro poses inteiras, com contornos recortados nas
  articulações. Sombras acompanham a altura física. Poeira de quique usa a
  posição real do último contato, sem relógio adicional ou partículas que
  sobrevivam ao cancelamento do ataque.
- Movimento reduzido mantém as informações e o movimento necessário dos
  projéteis, fixa as poses decorativas e omite a poeira. A pausa congela pixels
  e simulação.

## Evidência

`verification.json` reúne os resultados atuais e hashes do código e dos
arquivos relevantes. `baseline-source/` preserva os quatro arquivos anteriores
a esta rodada; o render de ossos em módulo separado foi criado nesta revisão.

- `before.mp4`: 299 quadros, 4,983 s; perda de capacete no quadro 245.
- `recovery.mp4`: 390 quadros, 6,5 s; nenhum dano, acerto no quadro 385.
- `fight.mp4`: 1.267 quadros, 21,117 s; vitória com salto, sem dano.
- A rota nativa alternativa de sentada continua com 1.251 quadros, vitória e
  nenhum dano. Os três percursos também foram exercitados no navegador com
  teclado e botões de toque DOM simulados.
- Os dois atlas usam cópias imediatas dos pixels de seis quadros cada, com
  correspondência verificada contra suas capturas individuais.

Todos os vídeos são capturas a 60 Hz da implementação nativa, ampliados por
vizinho mais próximo para 960 × 540, sem áudio. As capturas usam comandos reais
de teclado; não alteram posição, saúde, câmera ou relógio. A vibração da câmera
é desativada na captura para manter comparações estáveis. A verificação no
navegador usa as preferências normais ou movimento reduzido.

Os casos unitários que posicionam atores manualmente estão identificados nos
testes: exercitam os limites da colisão e não são usados como vídeo de partida.
Toque foi simulado, não medido em aparelho físico. O custo de render registrado
é tempo de CPU, não uma medição de quadros apresentados pela GPU. Dificuldade
percebida e descoberta das estratégias exigem observação de jogadores novos.

## Reprodução

```powershell
$guairaTests = @(rg --files tests -g 'guaira-*.test.ts')
node --import tsx --test --test-reporter=tap @guairaTests
npm run build

node --import tsx scripts/prove_guaira_bull_recovery.ts OUTPUT CANVAS_MODULE tests/helpers/guairaBullMissReplay.json
node --import tsx scripts/prove_guaira_bull_rhythm.ts OUTPUT CANVAS_MODULE

$env:PLAYWRIGHT_MODULE = 'CAMINHO/ABSOLUTO/DO/playwright'
$env:GUAIRA_BULL_RECOVERY = '1'
$env:GUAIRA_REVIEW_PATH = '/docs/world/guaira/bull-recovery-2026-10-16/index.html'
$env:GUAIRA_REVIEW_MIN_SECONDS = '1'
$env:GUAIRA_OUTPUT = 'output/guaira/bull-recovery-2026-10-16/browser'
node scripts/verify_guaira_bull_rhythm.cjs
```

O verificador aceita `GUAIRA_BULL_MODE=play` ou `review` para separar execução
das rotas e inspeção dos arquivos da página. O padrão executa ambos.
