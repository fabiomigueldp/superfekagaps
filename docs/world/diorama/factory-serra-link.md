# Ligação Fábrica → Serra

Depois de C1 (3-5), o equipamento que bloqueava a saída para a Serra para (`docs/world/campanha.md:115`). A travessa de inspeção recolhe para a máquina azul lateral; o piso apoiado continua no mesmo lugar nos dois estados. Feka sai pela lateral direita do Controle de Qualidade, sem passar atrás do telhado. A ligação não usa cabos como piso.

## Geometria e contrato

Fábrica permanece em `(1.98,0.03)` e Serra em `(2.78,-0.65)`, escala 1. As câmeras têm a mesma orientação e ortho 20.6; câmera e alvo da Serra são 1.35 unidade mais altos. O registro afim de autoria preserva Z e a posição projetada de ambos os modelos. Os cinco nós, rotas, câmera e objetos da Fábrica são preservados; o builder compara os metadados com `fabrica-composition-approved.meta.json`.

A aproximação da Fábrica é `(3.9,1.92,2.37) → (5.1,1.92,2.37) → (5.55,1.92,2.37) → (5.55,4.95,2.37)`. Na Serra, as coordenadas locais são `(-5.75,-4.85,1.65) → 4-1(-5.75,-3.60,1.65)`. O vão mede 10.794885 unidades e desce 0.72 unidade, com inclinação de 3.824°. A passagem lateral começa com largura 0.94 e abre para 1.92. O piso novo fica 0.004 abaixo da âncora dos pés para evitar superfícies coplanares. Longarinas, travessas, 30 pilares e sapatas são geometria real, sem Boolean de terreno.

`factory-serra-link.meta.json` fornece `placements`, `islands.fabrica/serra`, joins 3-5/4-1, aproximações locais, bounds incluindo os patamares dos joins e `walkRoute` em atlas. Os landings do vão são `(2.8256492,0.4587555)` e `(2.9165519,0.0507513)`. A convenção física de 1.73 unidade/s gera durações de 2.7052s (aproximação de 4.68 unidades da Fábrica), 6.2398s (vão) e 0.7225s (aproximação de 1.25 unidade da Serra).

Os dois WEBP usam recorte comum 484×882, left 2.7328125, top -0.0025, widthInMap 0.252083333 e heightInMap 0.735. Foram renderizados novamente em Cycles, 96 amostras, sem denoise, densidade nativa 1920/1200 pixels por unidade do atlas, e codificados em WebP qualidade 94. Não são ampliações dos renders de protótipo. A decodificação mantém o alpha do PNG exatamente. Os três assets instalados somam 139.987 bytes; hashes constam do manifesto.

## Reprodução portátil

Dependências: Blender 4.3.2 (versão verificada), Python com Pillow, Node e dependências de desenvolvimento do repositório (`tsx`). Execute na raiz do checkout:

```sh
export FEKA_FACTORY_SERRA_OUT=/tmp/feka-factory-serra-rebuild
node --import tsx tools/diorama/export_factory_serra_sprite.mjs
blender -b -t 8 -P tools/diorama/render_factory_serra_link.py -- --build-only
blender -b -t 8 -P tools/diorama/check_factory_serra_link.py
blender -b -t 8 -P tools/diorama/check_factory_serra_structure.py
blender -b -t 8 -P tools/diorama/render_factory_serra_link.py -- --build-only --closed
blender -b -t 8 -P tools/diorama/check_factory_serra_link.py -- --closed
blender -b -t 8 -P tools/diorama/render_factory_serra_link_layers.py -- --final
blender -b -t 8 -P tools/diorama/render_factory_serra_link_layers.py -- --final --closed
python tools/diorama/package_factory_serra_link.py
```

O builder constrói a Serra por `render_serra_map.py` com `FEKA_SERRA_BUILD_ONLY=True`, constrói a Fábrica pelo limite de autoria já utilizado pela ponte Porto→Fábrica e gera seus próprios caches no diretório temporário. Nenhum `.blend` externo é entrada; nenhuma saída intermediária pertence ao Git. O exportador de sprite importa as máscaras reais de `playerSpriteSpec.ts` e lê a escala de `WorldAtlasArt.ts`.

O empacotador prepara os três arquivos em `$FEKA_FACTORY_SERRA_OUT/final` e valida auditorias, dimensões, joins e alpha. Revisar os dois estados antes de uma atualização de arte. Somente `python tools/diorama/package_factory_serra_link.py --install-assets` copia os três assets da ligação para `public/assets/world/map`; os demais passos não alteram assets publicados. Os dois WEBP aprovados foram preservados byte a byte durante a preparação das fontes.

## Auditoria e limites

- 174 amostras da nova rota e 278 das rotas antigas, passos de no máximo 0.10 unidade; apoio e espaço livre em três pontos por amostra
- 795.520 raios usando pixels opacos reais de idle e seis frames de caminhada, ambos os lados, centro e quatro cantos por pixel fonte
- Aberto: zero falta de piso, zero obstrução de cabeça/corpo e zero novos objetos sobre o sprite ideal nas rotas antigas
- Fechado: contatos de cabeça/corpo restritos à travessa de bloqueio e suas faixas; rotas antigas livres
- Raster Math.round/Math.ceil: desktop 1180×757 zoom 1, portrait 400×606 zoom 1.05 e landscape 846×392 zoom 1; corpo livre no estado aberto
- Os contatos inferiores, até dois pixels fonte acima dos pés, são registrados separadamente. Incluem contatos com pisos e, em portrait, três pixels junto ao piso da junção antiga; não são ocultados no relatório
- 30 pilares com base dentro de sapata e topo encontrando um membro estrutural; zero Boolean

A conectividade estrutural usa bounds avaliados e não é uma simulação geotécnica. A auditoria física usa raios, não volumes contínuos. Os perfis de raster são cenários declarados; ainda é necessário medir o zoom efetivo do atlas integrado, labels, progressão e transições no runtime. Esta entrega não afirma aprovação dessa QA de runtime. Hashes de fontes, rebuild e resultados numéricos estão em `factory-serra-link-art-manifest.json`.

## Resultado do rebuild limpo

A sequência acima foi executada em diretório temporário novo, construindo os dois estados a partir da mesma versão de `render_serra_map.py` registrada em `freshRebuild`, anterior à separação final da cabine traseira. Todos os gates geométricos, de raster, estrutura e empacotamento passaram. O contrato semântico, os bounds e os recortes coincidem com os instalados. Os hashes dos renders reconstruídos são registrados separadamente dos aprovados: houve pequenas diferenças de pixels após a atualização interna da Serra e nova renderização/codificação. Os WEBP públicos aprovados foram mantidos byte a byte. O manifesto quantifica a diferença; não há alegação de reprodução byte a byte dos bitmaps.

## Revalidação da fonte final da Serra

Após a separação da cabine traseira e o ajuste do apoio superior, ambos os estados foram reconstruídos sem renderizar imagens usando `render_serra_map.py` SHA256 `a6feca3fe05ea5310fcba9b3633367409fa8b639ceaa4c3d898e619822823e7f`. Os 188 objetos da ligação em cada estado conservaram o mesmo fingerprint de geometria avaliada; câmera, rotas, bounds e medidas também coincidiram. Apoio, espaço livre, corpo do sprite e estrutura mantiveram os resultados aprovados.

No raster portrait, dois contatos junto aos pés passaram a ser atribuídos à seção adjacente do mesmo piso compartilhado; o total de contatos e o espaço livre do corpo não mudaram. Isso é compatível com empate de interseções na BVH após mudanças externas à ligação. A diferença está registrada explicitamente em `geometryRevalidation`, junto do hash novo; `freshRebuild` preserva os hashes históricos dos renders de 96 amostras. Os três assets públicos permanecem byte-idênticos, sem nova renderização nem alteração de contrato. Esta revalidação não inclui QA de runtime nem nova verificação de iluminação/pixels.
