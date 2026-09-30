# Costa e Porto · mapa-diorama 2.5D

Apresentação do mapa com dioramas autorais para a Costa dos Gaps e o Porto do Bielzão. Cada extensão passa por uma prévia separada e revisão no navegador antes da promoção à produção.

## Direção e composição

A Costa foi modelada e iluminada no Blender: praia, arco natural, falésias estratificadas, palmeiras, ponte suspensa, caminhos e escadas, farol listrado, casa e cais. O Porto aparece como outra camada ao fundo. Os cinco pontos e as rotas são projetados pela própria câmera ortográfica do render, não posicionados por aproximação visual.

A apresentação tem uma câmera dirigida, aproximação inicial, botão de panorama, mar e gaivotas com movimento discreto. Feka percorre as rotas entre os pontos. A saída secreta da fase 1-3 revela a ligação para 1-5. O Porto tem cinco áreas de carga e uma passarela de manutenção 2-3 → 2-5; sua autoria e verificações estão em `porto.md` e `porto-art-direction.md`. As quatro ilhas restantes mantêm a apresentação cartográfica legada até seus próximos recortes.

## Arquitetura

- `WorldMapModel.ts`: coordenadas, câmera, seleção, progresso e percursos puros/testáveis
- `WorldMapArt.ts`: compositor Canvas sem DOM, listeners ou relógio próprio
- `WorldMapView.ts`: camada dedicada de alta resolução, controles HTML semânticos e ciclo de vida
- `WorldGame.ts`: continua sendo o único dono do loop; o mapa retorna antes da renderização 320×180
- `map.css`: layout responsivo para desktop e telefone, foco visível e estados de progresso
- `WorldMapIcons.ts`: emblemas SVG originais, compartilhados entre os controles e as seis ilhas
- `public/assets/world/fonts`: Nunito variável local (600–900), subconjunto latino/português e licença OFL
- `public/assets/world/map`: camadas e metadados exportados pelo Blender
- `tools/diorama`: fonte reproduzível da cena, descrita em `art-direction.md`

O gameplay, a física e o render 320×180 das fases permanecem separados. São preservados os seis mundos, 30 IDs de fase, 72 selos, saídas secretas, checkpoints, save v1, galeria, opções, modo clássico e editor. O mapa reutiliza o mesmo `isUnlocked`, `ProgressStore` e `load` da campanha.

### HUD de expedição

A HUD usa uma pequena placa de identificação, contadores de progresso, uma ficha de fase com ação coral e seis medalhões ligados por uma rota. O mar continua sob a interface, sem uma faixa opaca no rodapé. Os emblemas são SVGs originais e a tipografia é servida pelo próprio jogo; não há dependência de fontes externas. Selos, cadeados e fases concluídas têm estados visuais e rótulos acessíveis.

O canvas ocupa a tela toda. O enquadramento mede os limites reais do cabeçalho, ferramentas e ficha para manter farol, cais e marcadores livres. O mesmo `ResizeObserver` acompanha alterações de tamanho da HUD, inclusive quebra de título e carregamento da fonte; não há outro loop. Container queries consideram a largura útil do mapa, incluindo os 340 px reservados para o editor. Em paisagem baixa, ficha e rota ficam lado a lado. Os botões mantêm alvos de pelo menos 44 px, navegação nativa e movimento reduzido.

Os controles têm rótulos acessíveis, foco visível e estado da seleção anunciado. Setas/WASD navegam; Enter/Espaço ativam botões nativos; Escape retorna ao menu. Toque em um ponto seleciona; tocar novamente ou usar “Jogar fase” entra. Fase bloqueada continua inspecionável, sem desbloqueio indevido. Há botão Menu também no telefone. Na prévia do editor, a camada ocupa apenas a área do jogo e não cobre o painel de autoria.

## Movimento e custo

`prefers-reduced-motion` remove interpolação de câmera, percurso e animação ambiente. Uma única instância da camada é reutilizada nas voltas ao mapa; não há RAF adicional. Quando o documento está oculto, o mapa não é pintado. Em movimento reduzido, quadros estáticos não fazem nenhuma chamada de pintura; progresso, seleção, panorama e resize invalidam a imagem normalmente. Mudanças repetidas de destino preservam o trecho já percorrido e podem inverter o sentido sem cortar pelo terreno. O backing canvas é limitado a DPR 2 e aproximadamente 4 megapixels (mais eventual arredondamento de um pixel), inclusive em telas ultrawide.

Os assets de cada diorama são carregados apenas na primeira visita àquela ilha e ficam em cache nas voltas. A imagem principal e os metadados precisam estar disponíveis em conjunto; camadas opcionais não atrasam esse par. Respostas tardias de outra ilha não trocam a cena atual. Nós, quatro percursos principais, atalho e seus endpoints são validados; caso contrário é usada a apresentação legada funcional, evitando pinos ou percursos incorretos. O runtime não inclui Blender, WebGL ou dependência 3D.

## Verificação visual e limites

`costa-review.png`, `costa-secret-review.png` e `costa-mobile-review.png` são composições de revisão offline. O cenário vem das chamadas reais do painter de produção, serializadas em SVG e rasterizadas pelo Inkscape. O texto, os botões e os marcadores nessas imagens são uma reprodução SVG de revisão. **Essas imagens não são capturas de navegador e não comprovam o layout CSS ou o desempenho do navegador.** Os renders Blender foram inspecionados diretamente.

O navegador local/loopback está bloqueado neste ambiente; não foi contornado. A prévia pública separada na Vercel foi aberta no Chromium da nuvem em 1180×757, 500×757, 400×606 e 846×392 pixels CSS. Foram verificados teclado, ponteiro, panorama, bloqueios, mudanças rápidas de seleção, entrada/volta da fase e seleção persistida após reload. O teste revelou sobreposição do contador com o farol e marcadores grandes em paisagem curta; as correções foram revalidadas no navegador. A silhueta mantém o farol livre dos controles e o cais acima do rodapé; o modo paisagem usa um rodapé menor e pinos com alvo de 44×54px. Panorama aplica seu afastamento depois do enquadramento para continuar distinto em cenas curtas. DevTools está desabilitado pela política do navegador, portanto não houve emulação touch, medição de FPS nem teste da preferência de movimento reduzido no navegador. Movimento reduzido continua coberto pelos testes de integração. Leitor de tela e dispositivo touch físico também não foram testados. O site de produção anterior não foi usado como evidência desta mudança. A câmera considera também os alvos de toque, seus anéis de foco e a silhueta da ilha, inclusive no modo paisagem curto. Os URLs de assets respeitam a base de implantação relativa do Vite.

## Reproduzir os checks

Neste sandbox o executável `tsx` tenta abrir IPC e recebe EPERM. O equivalente sem socket executa as mesmas entradas:

```sh
node --import tsx --test tests/*.test.ts
node --test tests/*.test.mjs
node --import tsx scripts/validate_levels.ts
node --import tsx scripts/validate_player_assets.ts
node --import tsx scripts/validate_world.ts
npm run typecheck
node node_modules/vite/bin/vite.js build
node --import tsx scripts/render_diorama_review.ts
inkscape docs/world/diorama/costa-review.svg -o docs/world/diorama/costa-review.png
inkscape docs/world/diorama/costa-secret-review.svg -o docs/world/diorama/costa-secret-review.png
inkscape docs/world/diorama/costa-mobile-review.svg -o docs/world/diorama/costa-mobile-review.png
```

Os renders PNG, versões lossless, imagens de revisão e SVGs intermediários são reproduzíveis e ficam apenas no ambiente de autoria, fora do Git e da publicação. O gerador de revisão usa os WebPs enviados ao jogo. A fonte Blender, os relatórios de geometria e os quatro arquivos de runtime ficam versionados. Os SVGs incorporam os WebPs como base64. O script imprime quantidade de comandos e tempo de serialização offline, sem apresentar esse tempo como custo de rasterização ou FPS.
