# Guaíra — caminhos e ponte, revisão 6

15/10/2026. [Comparação e detalhes](index.html) · [modelo editável](guaira-paths.blend) · [verificação](verification.json).

Construído sobre `../entrance-finish-2026-10-15/guaira-entrances.blend`. Os oito acessos e doze percursos mantêm suas posições.

## Ajustes

- Meios-fios: 58 peças recortadas de seis faixas contínuas, com juntas de 3 mm no modelo. Segmentos pequenos das curvas não são mais omitidos; os cantos se encontram sem os buracos deixados por pontas retas. Os vãos de portas, escada e ponte permanecem livres.
- Ponte: quatro cabeceiras de pedra assentadas no terreno; vigas contínuas ligadas aos apoios e ao tablado; postes, sapatas de ferro, guarda-corpos e travamentos. As tábuas têm fixações sobre as vigas. Duas aproximações inclinadas acompanham as alturas do trajeto nativo.
- Placas: o layout compartilhado reserva o espaço de Feka antes de posicionar os botões. A placa B, perto da galeria, deixa de saltar para o outro lado da praça. O arredondamento considera a borda externa da área ocupada para não descartar uma posição próxima por uma fração de pixel.

## Revisão visual

Prévia de 1280 × 800 seguida de inspeção ampliada da ponte e dos caminhos. As ampliações usam a câmera de produção a 3840 × 2400 antes do recorte; o jogo usa arte e profundidade a 1920 × 1200. O primeiro teste de placas revelou um deslocamento excessivo causado pelo arredondamento de coordenadas fracionárias; isso foi corrigido antes das capturas finais.

## Verificação

- 585 testes aprovados e build de produção aprovado.
- 548 malhas fechadas e conectadas, com volume positivo e sem faces degeneradas; 122 sólidos novos.
- 25 bases com apoio. A menor folga medida entre a água e a parte inferior das vigas é 0.021 m.
- 590 amostras dos caminhos e 1770 sondagens de apoio: sem falta de chão ou contato com o corpo.
- 1374 amostras de profundidade; cabeça visível nas oito entradas. O abrigo do aeroporto continua ocultando parcialmente Feka durante a passagem sob seu telhado.
- 1780 poses do avião e 1230 contatos de rodas: nenhuma colisão ou falta de apoio, considerando a margem conservadora de 5 cm.
- Entrada e retorno das oito cenas, chegada, partida, reversão, pulo de caminhada e movimento reduzido verificados no navegador.
- 1118 quadros de caminhada no computador e 752 em tela estreita: sem perda de enquadramento, placas sobre Feka ou placas sobre outras placas.
- O layout compartilhado também foi conferido no Império da Delícia. Veja as resoluções, os acessos e os resultados em `verification.json`.

O manifesto registra os hashes dos assets. Os relatórios de geometria, avião e ampliações usam o mesmo SHA-256 da fonte final. Arte, profundidade e água restaurada foram exportadas novamente. A revisão de cache é 6; as coordenadas de navegação, fases, terreno e voo foram preservadas. Não houve publicação remota.

## Reproduzir a arte

Blender 5.2.1 LTS; Python com Shapely 2.1, Pillow e NumPy. As peças substituídas ficam ocultas na coleção `Paths v5 — preserved source`.

```powershell
$blenderExe = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
$sourceV5 = 'docs/world/guaira/entrance-finish-2026-10-15/guaira-entrances.blend'
$sourceV6 = 'docs/world/guaira/path-finish-2026-10-15/guaira-paths.blend'
$pathOut = 'output/guaira/path-finish-2026-10-15'
& $blenderExe -b $sourceV5 -P tools/diorama/guaira_campaign/inspect_path_finish.py
python tools/diorama/guaira_campaign/layout_path_finish.py
& $blenderExe -b $sourceV5 -P tools/diorama/guaira_campaign/finish_paths.py
& $blenderExe -b $sourceV6 -P tools/diorama/guaira_campaign/audit_path_finish.py
& $blenderExe -b $sourceV6 -P tools/diorama/guaira_campaign/audit_native_paths.py -- --output-dir $pathOut
& $blenderExe -b $sourceV6 -P tools/diorama/guaira_campaign/build_restored_water.py -- --output-dir $pathOut
python tools/diorama/guaira_campaign/package_restored_water.py --input "$pathOut/guaira-water-restored.png" --source "$pathOut/restored-water-source.json"
python tools/diorama/guaira_campaign/package_path_finish.py
```

As verificações cobrem os percursos e interações descritos; não equivalem a uma nova conclusão manual de toda a campanha ou a um teste em aparelho móvel físico.
