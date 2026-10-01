# Domínio Pizzarino — mapa diorama

M6 é uma residência costeira habitada: pedra creme e azul, jardins cuidados,
toldos vermelhos, telhados de terracota, forno quente e uma ponte frontal de arco.
O pequeno conjunto de duas cadeiras e vasos fica junto à fachada, fora da circulação.
As referências são [a campanha](../campanha.md#m6--domínio-pizzarino),
[o conceito de M6](../conceitos/imagens/06-dominio-pizzarino.png) e
[o arquipélago](../conceitos/imagens/13-arquipelago.png).

## Contrato de circulação

- Cinco patamares: `6-1` jardins, `6-2` forno/passarelas, `6-3` passagem dos fundos,
  `6-4` última travessia e `6-5` terraço de dois níveis do Grande Gap
- Quatro ligações principais contínuas; a escada de serviço liga `6-3` a `6-5`
  sem passar por `6-4`
- Entrada congelada: `6-1 = (5.3, -2.4, 1.35)`, raio livre de 1.0; piso de 1.30
  até `(6.35, -2.4, 1.35)`. O conector aditivo Reserva–Domínio possui as docas
  e o segundo barco, fora deste asset-base
- Origem no atlas `(1.5, -1.8)`, escala 1; nenhuma outra ilha é reposicionada
- Câmera ortográfica 20.6, imagem 1920×1200 e tamanho original do Feka preservados
- Ritmo de caminhada 1.73 unidades/s, calculado pelos comprimentos 3D. Timings
  e coordenadas são exportados no metadata; não há mecânica nova de gameplay

O arco tem 14 blocos estruturais, dois encontros enraizados na costa e 5 cm de
sobreposição com o tabuleiro. As subidas têm pisos contínuos apoiados e juntas
rasas; não são degraus soltos. A frente da ponte permanece aberta para o Feka.

## Reprodução portátil

Requer Blender 4.x, Node.js e Python 3 com Pillow. Execute a partir da raiz do
checkout; mantenha `.blend`, PNGs de prova e arquivos intermediários fora dele.

```sh
blender -b -t 8 -P tools/diorama/render_dominio_map.py -- --build-only --output-dir /tmp/dominio-blockout
blender -b -t 8 -P tools/diorama/check_dominio_map.py -- --output-dir /tmp/dominio-audit
blender -b -t 8 -P tools/diorama/render_dominio_map.py -- --final --static --output-dir /tmp/dominio-final
python tools/diorama/package_dominio_map.py --input-dir /tmp/dominio-final --audit /tmp/dominio-audit/dominio-validation.json --output-dir /tmp/dominio-package --docs-dir /tmp/dominio-docs
```

Sem `--final`, o builder usa uma prévia 960×600 de 8 amostras. Sem `--static`,
também produz a prova com o sprite original do Feka em geometria de pixels,
participando da profundidade. O export final é transparente, sem atores ou barcos
embutidos. O packager gera WebP de qualidade 93, metadata, manifesto e gate conciso.

## Fonte congelada e validação

Builder: `tools/diorama/render_dominio_map.py`  
SHA-256: `75dad697e5401ec60e0f6225a5c87c1184d8284e8b9a15931ae7ddd82f055615`

O [manifesto](dominio-art-manifest.json) registra os hashes dos assets, câmera,
bounds e timings; o [gate](dominio-validation.json) registra a fonte e o checker.
O empacotamento exige `PASS`, hash atual do builder igual ao auditado e metadata
do render igual ao auditado. Também verifica dimensões e preservação do alpha
após decodificar o WebP. Os assets instalados são cópias exatas desse pacote.

O gate final passou 312 amostras de rota, 936 raios de apoio, 936 raios de altura livre,
contenção em sólidos fechados e o suporte do arco. Foram 549.120 raios sobre o
sprite original, com idle e seis frames de caminhada nos dois sentidos, mais
541.125 raios raster nos perfis 1180×757, 400×606 e 846×392. Não houve colisão física
nem oclusão corporal, de cabeça ou rosto. Os dois pixels inferiores são
registrados separadamente como contato de piso; não são descartados do relatório.

Esses gates cobrem a ilha-base, seus patamares, quatro rotas, atalho e entrada.
O conector, a varredura dos barcos, o carregamento/fallback e a câmera/HUD reais
pertencem à integração. A apresentação interna utilizou `paintWorldAtlas` e
`paintMapActor` do runtime em replay SVG, sem se apresentar como captura de
navegador. A aceitação final do compositor ocorre na prévia completa do jogo.
