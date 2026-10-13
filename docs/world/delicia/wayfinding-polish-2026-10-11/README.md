# Império da Delícia — caminhos e pisos refinados

A revisão 8 limpa a indicação dos percursos e corrige o terreno que atravessava
a pavimentação. O mapa continua usando o personagem, as placas, a seleção de
fases e o motor de caminhada do World.

- Retirada a camada de pontilhados sobre as 16 rotas da Delícia. Os percursos
  físicos já estão presentes no cenário e permanecem como dados de navegação.
- Retirado o aro amarelo sobre o destino. A placa nativa selecionada, a seta
  em pixel art e o painel da fase indicam a seleção.
- As placas próximas não desenham linhas sobre os caminhos. A ligação visual
  fica reservada às placas deslocadas pela borda da tela ou pelo agrupamento.
- O terreno foi assentado sob a largura real dos pisos, incluindo os encontros
  e as bordas. Imagem, profundidade e metadados são exportados da mesma cena.

## Modelo e reprodução

O [modelo v8](../imperio-delicia-v8.blend) parte da v7 preservada. O ajuste usa
a interseção dos triângulos de terreno e pavimentação, com 8,5 cm de folga
sob a superfície. As diagonais dos quadriláteros do terreno são fixadas antes
do ajuste para que a edição de altura não altere a triangulação na exportação.
O atributo de cor do terreno e seu sombreamento suave são preservados.

Na raiz do projeto, com Blender 5.2 e Python com Shapely 2.1 e Pillow:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec docs/world/delicia/imperio-delicia-v7.blend --python tools/delicia/polish_map_surfaces.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec docs/world/delicia/imperio-delicia-v8.blend --python tools/delicia/polish_map_surfaces.py -- --audit-only
python tools/delicia/package_island.py --revision 8
```

Acrescente `-- --draft` ao primeiro comando para gerar uma prévia em
`output/delicia/wayfinding-polish-2026-10-11/`. O empacotamento final mantém a
profundidade como PNG R:G de 16 bits, sem compressão com perda.

## Revisão

As comparações usam capturas do jogo com câmera, resolução e destino iguais.
O material anterior é a v7 com o pontilhado; o atual é a v8 com a nova
apresentação das rotas. Os vídeos mostram a caminhada no runtime final.

[Comparação e vídeos](index.html) · [Resultados da verificação](verification.json)
