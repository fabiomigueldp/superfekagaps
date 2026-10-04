# Polimento de Guaíra — 4 de outubro de 2026

Base: `098c243927d30bd4929c2f860065312077a07278`.

## Alterações

- Rodas, polias e batentes da Subida acompanham o deslocamento real dos corpos.
  A compressão visual é limitada a dois pixels, abaixo das superfícies de apoio.
  Movimento reduzido fixa a pose cosmética, preservando o deslocamento necessário.
- A conclusão de Ossabravo aponta a falta de água no bairro e a Casa da Vazão.
  A abertura do ramal público reconhece os moradores. Ambos os textos dependem
  dos recibos aceitos do capítulo, sem novos flags, diálogos ou bloqueios.
- Travessia, Subida e Respiros exibem o total nativo de moedas da tentativa, com
  ícone parado e rótulo “NO TRECHO”. Morte e reinício mantêm a semântica existente;
  moedas não viram exigência de conclusão nem saldo persistente.
- A barra compacta preserva áreas seguras, controles de toque podem quebrar linha
  e nomes acessíveis quebram linha em cores forçadas. Conteúdo longo faz a barra
  rolar, reservando até 90 pixels para a imagem. Em telas menores, um controle de
  44 pixels e o padding medido têm prioridade; telas impossivelmente pequenas
  continuam limitadas ao espaço disponível.

IDs, física, colisões, tempos, danos, schema de save, desbloqueios, assets,
dependências e configuração de publicação não foram alterados.

## Validação consolidada

- 1.473 testes TypeScript e três testes de servidor passaram, sem falhas.
- Validadores de níveis, sprites do jogador e World passaram, assim como os dois
  typechecks, build de produção e verificação do orçamento de saída.
- Output: 170 arquivos, 43.539.879 bytes; margem de 1.460.121 bytes para 45 MB.
- `git diff --check` passou e a revisão independente não encontrou bloqueadores.
- O replay nativo de 1.339 frames da Subida produziu o mesmo hash de estado na
  base, com o polimento e em movimento reduzido:
  `41ce4f85c9399faad5bc6800dc3736d7b71d8ae03c097fa6f64c352f4ea9c2c1`.
- Replays nativos confirmaram os dois textos no primeiro frame da conclusão.
  Os nove pares de leitura de moedas, inclusive em movimento reduzido e sem som,
  alteraram somente o espaço reservado do HUD, sem mutar a simulação.

O wrapper `npm test` não iniciou os testes porque a criação do pipe IPC do `tsx`
foi bloqueada neste ambiente. A sequência equivalente foi executada sem socket:
`node --import tsx --test tests/*.test.ts`, `node --test tests/*.test.mjs`, os três
validadores com `node --import tsx`, `npm run typecheck`, `node node_modules/vite/bin/vite.js build`
e `node --import tsx scripts/check_build_size.ts`.

## Limites da evidência

As provas visuais usam o renderer Canvas real e entrada/replay nativos. As imagens
de texto do capítulo usam composição equivalente, claramente identificada como
offline. Os testes responsivos verificam CSS e medidas DOM injetadas, não fontes
e quebras de linha de um navegador real.

A navegação local do navegador retornou `ERR_BLOCKED_BY_CLIENT`; outro fixture
Chromium não pôde criar seu socket. Não houve desvio dessas restrições. Ainda
faltam revisão visual em navegador de scroll/foco/cores forçadas e quebras de
texto em telas compactas, além de medição de FPS em hardware real.
