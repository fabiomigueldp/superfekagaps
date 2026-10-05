# Ilha da Delícia: reconstrução do modelo

Esta página registra a revisão 3. O gerador atual e o asset do jogo usam a
[revisão 4, com o polimento do terreno e da costa](modelo-v4.md). Os arquivos
Blender, GLB e PNG da revisão 3 continuam preservados para comparação.

5 de outubro de 2026. O modelo foi refeito a partir de uma cena vazia do Blender,
em resposta à revisão visual da ilha anterior. O conceito `world-concept-v2.png`
orientou a composição; a imagem usada no mapa é um render da geometria nova.

## O que foi reconstruído

- **Relevo:** uma superfície contínua, costa irregular, vale central com duas
  cascatas, encostas, afloramentos calcários e vegetação nas bordas. Cores por
  vértice dão continuidade ao solo e às rochas.
- **Vila portuária:** sobrados agrupados em torno da praça, telhas curvas
  individuais, esquadrias, portas em arco, varandas, cunhais, chaminés, fonte,
  toldos, frutas, cais de pedra, escadas, píeres e barcos com velas curvas.
- **Pomares:** caminhos que acompanham a encosta, muros de pedra, árvores de
  tamanhos variados, moinho com estrutura de madeira e tecido nas pás.
- **Aqueduto e nascente:** arcos abertos, pilares, aduelas, canal de suco,
  comportas, pontes, anfiteatro e uma caneca cerimonial proporcional ao conjunto.
- **Refinaria:** salão de máquinas em alvenaria, janelas industriais, telhado,
  passarela, chaminé, tanques de cobre, tubulações, medidores e roda d'água.
- **Palácio:** corpo principal de alvenaria, galerias, torres com telhados,
  cúpula de cobre apoiada em tambor octogonal, bandeiras e escadaria de acesso.
- **Jardim:** canteiros, pérgola, balaustradas, fonte, campanário e caminho costeiro.

As versões anteriores continuam preservadas. As fases e o progresso existentes
mantêm os mesmos IDs. Os 12 marcadores foram reprojetados pela câmera do Blender.
O mapa da campanha e o panorama World usam o mesmo WebP com URL versionada.

## Arquivos editáveis e reprodução

| Arquivo | Uso |
| --- | --- |
| `imperio-delicia-v3.blend` | Cena completa, organizada por bairros |
| `imperio-delicia-v3.glb` | Geometria, cores, materiais, câmera e luzes exportados |
| `island-render-v3.png` | Render transparente de 3.200 × 2.000 pixels |
| `island-map-v3.json` | Projeção dos pontos e metadados da cena |
| `../../../tools/delicia/rebuild_island.py` | Construção reproduzível da cena |
| `../../../tools/delicia/island_geometry.py` | Componentes de arquitetura e modelagem |

```sh
blender -b --python tools/delicia/rebuild_island.py -- --draft
blender -b --python tools/delicia/rebuild_island.py
python tools/delicia/package_assets.py
npm run build
```

O modo draft salva apenas em `output/delicia/island-v3/`. O render final usa
Cycles, 96 amostras e denoising. CUDA é selecionado quando disponível, com fallback
para CPU; `--cpu` força o render em CPU. O GLB conserva a geometria e as cores;
o micro-relevo procedural dos materiais pertence à cena Blender.

## Verificação

Foram feitas três prévias de composição para revisar os telhados, a continuidade
do relevo, os apoios, as fachadas, a costa e a foz. Os mestres Blender e GLB ficam
fora de `public/`; somente o render WebP e os metadados atualizam o pacote do jogo.
As evidências de integração ficam em `output/delicia/island-v3/`.

Resultados finais:

- Render de 3.200 × 2.000, transparente, inspecionado em alta resolução e no jogo.
- GLB validado: cabeçalho glTF 2.0, 30.528.336 bytes, cores de vértice do terreno
  presentes. A cena Blender mede 63,28 m de largura na geometria do terreno.
- Os 21 testes da expansão passaram, incluindo hashes dos assets empacotados.
- TypeScript, validações de níveis/mundo e build Vite concluídos sem erros.
- Navegadores de desenvolvimento e produção sem erros; panorama World, 12
  destinos, áudio, teclado, saves e toque verificados. Os marcadores próximos
  ao palácio foram reduzidos no celular; toques reais no teste de navegador
  alcançam separadamente escadaria, palácio, arquivo, refinaria e cais.
- Pacote total: 51.429.046 bytes, abaixo do limite de 53.000.000. Mídia da expansão:
  7.747.625 bytes. Detalhamento em `build-size-v3.json` e `runtime-manifest.json`.

Relatórios: `output/delicia/island-v3/browser/browser-report.json` e
`output/delicia/island-v3/production/report.json`. O relatório de produção declara
o save sintético utilizado para inspecionar destinos desbloqueados. A conferência
dos toques móveis usa um perfil novo, sem alterar o save do usuário.

Prévia do pacote compilado: `http://127.0.0.1:3031/delicia.html`.
