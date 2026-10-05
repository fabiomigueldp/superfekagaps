# Polimento das fases — v5

Revisão dos 12 percursos (incluindo os dois santuários) e das duas arenas.

## Montagem

- Prédios posicionados sobre o terreno da própria seção, com proporção preservada e fundação parcialmente coberta pelo chão. A câmera não faz os prédios deslizarem sobre as plataformas.
- Novos prédios e pequenos objetos de cenário. A decoração tem posição definida sobre um piso; não há repetição automática de caldeiras e fontes nos vãos.
- Textura do topo separada da parede. Faixas internas espelhadas evitam reiniciar cantos e acabamentos a cada bloco de textura.
- Passarelas com escoras; elevadores com pórtico e cabos; travessias móveis suspensas entre margens; prensas com estrutura e sapatas. O topo visível continua alinhado à colisão.
- Pórtico de saída com bases, pilares, juntas e verga.
- Fundo com menos contraste e decoração mais discreta para destacar personagem, itens e perigos.

## Percursos

- Áreas de chegada ampliadas para separar bandeira, válvula, acesso à rota alta e memória.
- Válvulas antes do acesso à rota opcional, evitando passar voando por uma interação obrigatória.
- Curso das balsas limitado ao vão, com 6 px de folga em cada margem.
- Corrente de ar restrita à rota alta. A rota pelo chão não lança o jogador involuntariamente para o vão seguinte.
- Jatos afastados de elevadores e válvulas. Inimigos reposicionados fora das prensas; os corredores que combinam prensa e vapor têm espaço para leitura dos sinais.
- Válvula direita das arenas apoiada na plataforma alta; bandeira e válvula esquerda separadas.
- Selos, frutas e memórias sem sobreposição entre si ou com as rodas das válvulas. Identificadores persistentes de fases e itens mantidos.

## Sprites

As folhas antigas de personagens não têm células perfeitamente regulares. O recorte por divisão inteira incluía fragmentos de outros personagens e cortava braços. Os oito quadros de cada chefe e os oito inimigos agora usam regiões explícitas e pontos de apoio nos pés. O rolador gira em torno do centro do corpo.

Os prédios novos também usam regiões explícitas: a fachada do palácio não aparece mais junto à torre do sino. O código lê os limites de transparência dentro dessas regiões sem alterar os pixels das imagens.

## Assets e reprodução

Gerados com o **imagegen integrado**, sem CLI e sem chave de API. Parâmetro: `transparent_background: true`. As duas imagens finais foram geradas sem imagem de referência. Originais preservados:

- `docs/world/delicia/landmarks-v5.png` → `public/assets/delicia/landmarks-v2.webp`
- `docs/world/delicia/props-v5.png` → `public/assets/delicia/props.webp`

Os nomes públicos são estáveis; a aplicação solicita a revisão `v=5`. `python tools/delicia/package_assets.py` gera os WebP e atualiza os hashes em `runtime-manifest.json`. Os masters anteriores continuam disponíveis. Os recortes de prédios em `DeliciaSpriteFrames.ts` correspondem especificamente ao master v5 de 1224 × 1285 px; uma nova geração exige nova conferência dos recortes.

### Prompt dos prédios

```text
Create a NEW production sprite atlas for a charming hand-painted 2D side scrolling citrus island platform game. Nine separate simple believable buildings arranged in a STRICT 3 by 3 grid on a truly TRANSPARENT background. Large empty transparent gutters between sprites, each sprite entirely INSIDE its own cell with at least 12 percent padding on every side. Each building stands on a small coherent foundation with its lowest point at 85 percent cell height. Warm restrained storybook illustration, clear silhouettes, front elevation with very slight three-quarter depth, soft earthy cream, terracotta orange, muted teal and leaf green, wood and limestone textures. Do not add realistic glossy rendering, excessive decoration or thin ornate filigree. Top row: 1 small orange-striped market stall attached to a white stucco harbor cottage, 2 stone windmill with four wooden sails, 3 three limestone aqueduct arches. Middle row: 4 a golden chalice fountain on a round stone basin, 5 a low round archive building with a terracotta dome, 6 a stout teal orange-juice factory with two chimneys and functional brass pipes. Bottom row: 7 green glass orangery greenhouse, 8 narrow cream bell tower with teal roof, 9 a teal palace with terracotta orange dome and two small towers. Buildings must have structurally sound joined walls, roofs and foundations. No characters. No scenery behind or between buildings, no text, no numbers, no lines dividing the grid, no atmospheric haze. All empty areas completely transparent. Clean isolated antialiased silhouettes without colored edge halos. This is a texture atlas; gutters are mandatory.
```

### Prompt dos objetos

```text
A NEW game sprite atlas with SIX modest grounded environment props, STRICT 3 columns by 2 rows, each separate on clean alpha TRANSPARENT BACKGROUND. Soft hand-painted storybook 2.5D platform game art, believable joined construction, shallow three-quarter front view, muted moss green, teal, warm limestone and aged wood, orange accents. Not photorealistic, not glossy, readable simple silhouettes and delicate painterly material textures. Top row left: a LOW rectangular limestone planter with a lush small orange shrub, a few small orange fruits and leaves, low and wide. Top row center: two wooden citrus crates beside a short thick dock bollard with coiled rope, one cohesive little low harbor prop. Top row right: a LOW limestone balustrade with two end posts and one connected horizontal rail, all feet grounded at the same level. Bottom row left: a modest horizontal dark teal pipe on two short sturdy mounting feet with two brass bands, NO floating ends. Bottom row center: a small stout wooden shelf with TWO rows of three closed green glass juice bottles, all shelves connected, feet aligned. Bottom row right: a LOW small round limestone fountain basin with a small golden spout and a little orange juice, discreet and simple. Each complete prop centered in its cell, natural aspect ratios, 15 percent empty gutters on all sides, foundations aligned 82 percent down each cell. Entire canvas around and between props TRANSPARENT. No background matte, no large shadows, no lettering, no numbers, no decorative frame, no colored haze, no halo, no detached pieces. These are small rear-plane set dressing sprites, not large buildings or machines.
```

## Verificação

- `npm run check`: 1.442 testes TypeScript + 3 testes MJS; validação dos conteúdos, tipos e build aprovados.
- Quatro regressões adicionais: curso das balsas, apoio/separação das válvulas, passagem pelo chão sem vento forçado e separação dos colecionáveis.
- Teste de travessia: os 12 percursos chegam à saída sem reposicionamento artificial nem retorno após queda; inimigos e perigos de combate são isolados nesse teste de geometria.
- Testes dos dois chefes: vitória nas três fases usando movimento, projéteis, válvulas e colisão da simulação.
- `scripts/review_delicia_scenery.cjs`: 116 capturas, cobrindo os 48 trechos, as duas arenas e as oito poses de cada chefe. São posições preparadas para inspeção visual, não uma campanha completada manualmente.
- `scripts/verify_delicia.cjs`: 18 verificações de controles, pausa, áudio, checkpoint, arenas, mapa e apresentação móvel no navegador de desenvolvimento.
- `scripts/verify_delicia_production.cjs`: navegação e seis fases representativas na versão compilada, sem o objeto de desenvolvimento exposto.
- Relatórios, capturas e logs: `output/delicia/scenery-v5/`. Limite de distribuição verificado por `npm run size:build` (53.000.000 bytes).
