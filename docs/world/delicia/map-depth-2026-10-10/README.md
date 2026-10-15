# Império da Delícia — caminhos e profundidade

Esta rodada corrige a relação entre o personagem e a geometria da ilha.
O motor de viagens, o sprite em pixel art, a animação, a sombra e o HUD
continuam sendo os componentes do World.

## Mudanças

- Quatro acessos foram refeitos no Blender: cais–pomar, pomar–aqueduto,
  descida para a ponte e caminho do Santuário das Raízes. As rotas antigas
  passavam por dentro das fundações da passarela elevada.
- A descida ganhou degraus e os encontros da ponte com o terreno foram
  assentados. As árvores que encobriam o percurso foram deslocadas por inteiro,
  mantendo troncos, copas, galhos e frutos editáveis.
- Corrimãos, copas e alvenaria em primeiro plano agora podem cobrir a parte
  correspondente do sprite. Feka já não é simplesmente desenhado sobre tudo.
- Os pontos luminosos dos caminhos respeitam a visibilidade da cena, sem
  atravessar visualmente paredes e coberturas.

## Fonte e reprodução

O [modelo v6](../imperio-delicia-v6.blend) preserva câmera, materiais e
proporções da v5. A coleção **14 • Clear orchard approaches** contém os
acessos novos. As superfícies substituídas estão ocultas e identificadas
com **v5 preserved**. Os arquivos das versões anteriores permanecem disponíveis.

Na raiz do repositório:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec docs/world/delicia/imperio-delicia-v5.blend --python tools/delicia/polish_map_depth.py
python tools/delicia/package_island.py --revision 6
```

`-- --draft` produz uma prévia em `output/`, sem publicar os assets.
O render final gera a imagem transparente em 2560 × 1600 e uma passagem
de distância linear da câmera. O empacotador transforma essa passagem em
PNG R:G de 16 bits sem perda, valida os pixels e publica imagem, profundidade,
coordenadas e manifesto juntos.

`WorldMapDepth` recorta o pintor existente de Feka usando somente os pixels
próximos ao personagem. A imagem de profundidade é lida uma vez; não há
leitura do canvas a cada quadro. A distância acompanha a mesma interpolação
do percurso usada pelo `WorldJourneyModel`, inclusive em reversões e chegadas.

## Revisão

Foram feitas três prévias antes do render final. A primeira revelou que o
personagem desapareceria dentro das fundações; a segunda mostrou um cruzamento
de caminhos em alturas incompatíveis. A terceira corrigiu esses encontros e
preservou a leitura do personagem ao longo das 16 rotas.

A [galeria](index.html) reúne as 14 chegadas, comparações no mesmo instante do
percurso e um vídeo de caminhada. Os resultados de testes e navegação estão em
[verification.json](verification.json).
