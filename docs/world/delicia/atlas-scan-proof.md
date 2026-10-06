# Delícia: leitura das dimensões na primeira varredura do atlas

Base: `20feb1d62786afce3cf3201bcf8be1db90ee5b90`.

A alteração captura `canvas.width` e `canvas.height` uma vez, depois de
atribuir o tamanho do canvas, e reutiliza os valores nos limites e índices.
Mantém o limiar alpha `>32`, os recortes, o fallback de células vazias, as
chaves e identidades do cache, o posicionamento e as alocações de canvas e
readback. Não altera assets, renderização, saves ou serviços.

## Regressão focada

Com Node 24.19.0 e o backend opcional já disponível `@napi-rs/canvas 0.1.100`:

```sh
node --import tsx --test tests/delicia-atlas-frames.test.ts
```

- Antes da alteração: ambos os testes falham somente na contagem de getters,
  depois de confirmar os recortes e identidades esperados.
- Depois: **2 testes passam, 0 ignorados**.
- Os dois atlases publicados, `props.webp` e `landmarks-v2.webp`, preservam os
  **15 recortes exatos** registrados na base.
- Para esses dois atlases, leituras de `width`: **2.753.058 → 2**; de `height`:
  **32 → 2**. Continuam sendo dois canvases, dois desenhos e dois readbacks.
- A fixture sintética cobre alpha 32/33, arredondamento de células ímpares,
  células vazias, argumentos de desenho e cache por dimensões da grade.
  O teste nativo também separa a grade regular do layout `landmarks-v5`.
- Sem o backend opcional, somente o caso nativo é explicitamente ignorado;
  a regressão determinística continua obrigatória. Nenhuma dependência nova.

Verificação TypeScript focada aprovada:

```sh
./node_modules/.bin/tsc --noEmit --target ES2020 --module ESNext \
  --moduleResolution bundler --lib ES2020,DOM,DOM.Iterable --types node \
  --strict --skipLibCheck --noUnusedLocals --noUnusedParameters \
  src/adventure/delicia/DeliciaSpriteFrames.ts tests/delicia-atlas-frames.test.ts
```

`git diff --check` também passou. A suíte completa e o build não foram
executados nesta verificação focada.

## Limites da evidência

O A/B nativo anterior, com o resolvedor real e os mesmos assets, mediu
313,4–334,9 ms antes e 42,7–67,1 ms com dimensões locais, em três pares.
São medições de primeira resolução dos atlases no backend nativo, sem teste
de tempo como critério de regressão. Não representam Chrome, FPS ou tempo
total de carregamento. Nenhum navegador foi iniciado nesta verificação;
o encerramento conhecido do navegador com erro 9 continua sem diagnóstico
confirmado e não é apresentado como corrigido por esta alteração.
