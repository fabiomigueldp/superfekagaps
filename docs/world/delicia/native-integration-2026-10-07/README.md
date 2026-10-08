# Império da Delícia — integração ao World

Revisão de 7 de outubro de 2026. [Abrir galeria visual](index.html).

## Diagnóstico e resultado

O capítulo usava um controlador próprio a 120 Hz, aceleração e gravidade diferentes,
dash com invulnerabilidade, outra proporção de personagem e cenários ilustrados
em 960 × 540. Essa combinação mudava tanto a leitura da tela quanto a memória
muscular exigida do jogador.

Agora o capítulo instancia `Player`, a mesma classe do World, a 60 Hz. Caminhada,
corrida, frenagem, salto variável, tolerância de borda, buffer de pulo, sentada e
rebote em inimigos compartilham a implementação da campanha. A câmera usa
`advanceCampaignCamera`, com margem superior para os percursos elevados e
enquadramento adicional dos chefes.

As coordenadas autoradas foram preservadas por um adaptador de escala: três
unidades do capítulo correspondem a um pixel nativo. `DeliciaCollision` fornece
ao jogador as superfícies do capítulo, incluindo colisão lateral, teto, plataformas
unidirecionais, molas e pisos móveis. Os IDs de fases, válvulas, memórias e selos
continuam os mesmos.

## Arte e rodadas de revisão

1. Registro de 50 cenas anteriores: proporção de Feka, resolução inconsistente,
   filtragem, leitura de objetos e distância entre as rotas.
2. Reconstrução em grade 320 × 180: sete biomas, oito famílias de inimigos, Jajá,
   Guina, coletas, máquinas, válvulas, plataformas e sinalização de ataques.
3. Polimento de escala, ancoragem dos pés, contornos, retratos, fachadas, mercado,
   arquivos, tanques e referências de cada trecho. Feka, bandeiras, paleta,
   tipografia e proteção após dano reutilizam os componentes do World.
4. Revisão final das 50 cenas, da prancha de poses e da apresentação no navegador.
   Nenhuma cena possui pixels fora dos blocos nativos de 3 × 3 da captura.

As artes jogáveis são fontes editáveis em `PixelGrid` e primitivas de pixels
inteiros, rasterizadas por `SpriteAtlas`. Não dependem de imagens baixadas durante
a fase. A prancha `cenas/sprites.png` mostra uma amostra de poses; as sequências
completas permanecem no código. As ilustrações antigas estão preservadas como
material histórico e não são usadas pelo novo renderizador das fases.

## Percursos e mecânicas

- 12 rotas de exploração, incluindo os dois santuários, mantêm a passagem inferior
  por válvulas e oferecem três selos em caminhos elevados.
- Rotas comuns exigem salto segurado; molas, elevadores e jatos sustentam os
  percursos altos dos pomares, reservatórios e relógio.
- Os dois chefes mantêm três fases, avisos, válvulas de alívio, sementes, defesa e
  janelas de ataque. A corrida não oferece a invulnerabilidade do antigo dash.
- O rebote em inimigos usa `Player.bounceFromSurface`, compartilhado com o World.
  Dano cancela a preparação da sentada; queda e checkpoint limpam estados antigos
  de pulo, ataque e suporte de plataforma.
- Teclado, controle e toque continuam disponíveis. A entrada pelo mapa do World
  abre o capítulo no mesmo documento e o retorno descarta sua instância.

## Verificação final

| Verificação | Resultado |
| --- | --- |
| Suíte TypeScript completa | 2.744 aprovados, 1 ignorado, 0 falhas |
| Suíte `.mjs` | 3 aprovados, 0 falhas |
| Total | **2.747 aprovados, 1 ignorado, 0 falhas** |
| Validação de níveis, sprites e World | Aprovada pelo prebuild |
| Typecheck da aplicação e ferramentas | Aprovado |
| Build Vite de produção | Aprovado |
| Paridade do jogador | 280 quadros idênticos entre World e Delícia no roteiro comparativo |
| Rotas de exploração | 12 rotas atravessadas a 60 e 120 Hz, sem respawn em gaps |
| Selos | 36 rotas alcançáveis, sem atribuir posição/velocidade após o início |
| Chefes | Jajá e Guina vencidos a 60 e 120 Hz pelas entradas da simulação |
| Cenas | 50 capturas, 0 pixels fora da grade, 0 erros de página |
| Navegador | Teclado, toque, pausa, entrada e retorno pelo World aprovados |

Os números da suíte correspondem ao estado compartilhado do repositório nesta
execução. O único caso ignorado depende do pacote opcional `@napi-rs/canvas` e
verifica o atlas antigo; o renderizador novo foi conferido no navegador.
Os testes geométricos removem inimigos e prensas para isolar as rotas;
os replays de chefes preservam ataques e colisões. As capturas da galeria são poses
preparadas no renderizador real. Não substituem um playtest humano integral de
dificuldade e ritmo.

A medição local das 50 cenas, após aquecer o atlas, obteve média de **1,97 ms** e
máximo de **2,86 ms** por desenho de cenário. É uma amostra do renderizador em
Edge headless na máquina de desenvolvimento, não uma garantia de FPS do jogo em
outros dispositivos. Dados: [art-review.json](art-review.json) e
[browser-checks.json](browser-checks.json).

## Fontes principais

- `src/entities/Player.ts`: contrato de terreno e rebote compartilhado.
- `src/adventure/delicia/DeliciaNative.ts`: unidades e passo da simulação.
- `src/adventure/delicia/DeliciaCollision.ts`: superfícies do capítulo.
- `src/adventure/delicia/DeliciaSimulation.ts`: uso do jogador e câmera do World.
- `src/adventure/delicia/DeliciaLevelDesign.ts`: percursos recalibrados.
- `src/adventure/delicia/DeliciaNativeArt.ts`: composição da cena nativa.
- `src/adventure/delicia/DeliciaPixelScenery.ts`: biomas, marcos e máquinas.
- `src/adventure/delicia/DeliciaPixelSprites.ts`: inimigos, chefes e coletas.
- `tests/delicia-native-engine.test.ts`: paridade, colisão, rebote e recuperação.
- `tests/delicia-reward-routes.test.ts`: desafios físicos dos 36 selos.

## Reprodução

Na raiz do repositório, em PowerShell:

```powershell
$cases = rg --files tests -g '*.test.ts'
node --import tsx --test --test-concurrency=4 @cases
node --test --test-concurrency=4 tests/*.test.mjs
npm run build
```

Com Vite em `http://localhost:3000`, Playwright disponível e Edge instalado:

```powershell
node tools/qa/review_delicia_native.cjs
node tools/qa/prove_delicia_native.cjs
```

`PLAYWRIGHT_LIB` permite indicar a instalação externa de Playwright.
`DELICIA_URL`, `DELICIA_OUTPUT` e `CHROMIUM_CHANNEL` configuram a revisão visual.
Os relatórios completos desta execução estão em `output/delicia/`, ignorado pelo
Git. Esta pasta conserva as capturas finais e os relatórios compactos.
