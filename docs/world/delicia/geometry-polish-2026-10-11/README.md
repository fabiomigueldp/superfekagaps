# Império da Delícia — encaixes e alvenaria

Esta revisão trabalha a geometria do mapa no Blender: encontros de caminhos,
escadas, patamares, bases e terminações. Mantém a câmera, a arquitetura e os
materiais da ilha, com o personagem, o HUD e a caminhada do World.

## Alterações

- Os caminhos e pequenos largos são unidos antes da triangulação. Assim,
  as bifurcações têm um piso único, sem faixas e bordas atravessadas.
- Os acessos oeste e sul do aqueduto e a escada do arquivo recebem volumes
  fechados, degraus proporcionados, muretas laterais, capeamento e pilares.
- A subida do palácio passa pela encosta leste. A chegada da fase 11 fica
  fora da cobertura da fábrica; dois lances e um patamar conduzem ao palácio.
- As guias acompanham a inclinação dos caminhos. Bases expostas recebem
  fiadas de pedra e os corrimãos existentes ganham terminações apoiadas.
- O terreno é assentado sob os acessos e uma árvore é deslocada por inteiro
  para desobstruir a aproximação do aqueduto.

## Fonte e reprodução

O [modelo v7](../imperio-delicia-v7.blend) contém a coleção
**15 • Joined paving and architectural finishing**. Os elementos substituídos
da v6 são preservados, ocultos e identificados por `v7_replaced`.

Na raiz do repositório, com Blender 5.2 e Python com Shapely 2.1 e Pillow:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec docs/world/delicia/imperio-delicia-v6.blend --python tools/delicia/finish_island_geometry.py
python tools/delicia/package_island.py --revision 7
```

Acrescente `-- --draft` ao comando do Blender para renderizar uma prévia em
`output/delicia/geometry-polish-2026-10-11/`, sem publicar os assets.
`unify_map_paving.py` executa a união planar e a triangulação; a elevação,
os volumes, os materiais e a navegação são construídos no Blender.

`export_island_navigation.py` exporta a imagem transparente, a distância
linear da câmera e as 16 rotas da mesma cena. O empacotador mantém a
profundidade em PNG R:G sem perda, preserva os mestres e atualiza o manifesto.

As escadas e os pisos novos são verificados como volumes fechados. Os
degraus têm piso de pelo menos 20 cm e espelho de até 20 cm. A revisão no
navegador confere a leitura de Feka ao longo das rotas, as 14 chegadas,
a entrada e o retorno das fases, além do enquadramento no celular.

Duas prévias permitiram corrigir a altura do patamar e retirar a subida do
palácio de trás da fábrica. A inspeção em alta resolução revelou ainda um
largo calculado antes da atualização da posição da fase 11: a construção
agora atualiza as transformações e verifica esse encontro explicitamente.
O terreno recortado pelo acesso anterior também é restaurado.

[Galeria e caminhada](index.html) · [Resultados da verificação](verification.json)
